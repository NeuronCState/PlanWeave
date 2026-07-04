import { mkdir, readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { isNodeFileNotFoundError } from "../fs/optionalFile.js";
import { readJsonFile, writeJsonFile } from "../json.js";
import { projectWorkspacePaths } from "../project.js";
import type { ProjectWorkspace, ValidationIssue } from "../types.js";
import type { DesktopAutoRunEventLog, DesktopAutoRunEventLogDiagnostic, DesktopAutoRunLogEvent, DesktopAutoRunPhase, DesktopAutoRunState } from "./types.js";
import { loadProjectGraphForWorkspace, projectCanvasWorkspace } from "../projectGraph/index.js";
import { autoRunRoot, writeAutoRunState } from "./runStateStore.js";
import { normalizePersistedAutoRunState, recoverPersistedAutoRunState } from "./runRecovery.js";
import {
  compareRunDirectoriesNewestFirst,
  ensureAutoRunIdReservationsMigrated,
  highestRunId,
  isDesktopRunId,
  maxRunNumber,
  recordReservedAutoRunId,
  reserveAutoRunId,
  runNumber
} from "./autoRunIdReservations.js";

const autoRunLogEventDataKeys = new Set(["timestamp", "runId", "type", "phase", "stepCount", "currentRef"]);
const desktopAutoRunPhases = ["idle", "running", "pausing", "paused", "manual", "completed", "blocked", "failed", "stopped"] satisfies readonly DesktopAutoRunPhase[];
const desktopAutoRunPhaseSet = new Set<string>(desktopAutoRunPhases);

export type PersistedAutoRunStateReadDiagnostic = ValidationIssue;

export type PersistedAutoRunStateReadResult = {
  state: DesktopAutoRunState | null;
  diagnostics: PersistedAutoRunStateReadDiagnostic[];
};

export type LatestPersistedAutoRunStateResult = PersistedAutoRunStateReadResult;

type LatestAutoRunStateDiagnosticEntry = {
  runId: string;
  diagnostic: PersistedAutoRunStateReadDiagnostic;
};

type LatestAutoRunStatePointer = {
  version: 1;
  selectedRunId: string | null;
  selectedUpdatedAt: string | null;
  highestRunId: string | null;
  diagnostics: LatestAutoRunStateDiagnosticEntry[];
};

type LatestPersistedAutoRunStateScanResult = LatestPersistedAutoRunStateResult & {
  diagnosticEntries: LatestAutoRunStateDiagnosticEntry[];
  runIds: string[];
};

type LatestPersistedAutoRunStatePointerReadResult =
  | { kind: "result"; result: LatestPersistedAutoRunStateResult }
  | { kind: "selected_read_failed" }
  | { kind: "selected_filtered_out" };

const latestAutoRunStatePointerFileName = "latest-state.json";

function autoRunsRoot(workspace: ProjectWorkspace): string {
  return join(workspace.resultsDir, "auto-runs");
}

function latestAutoRunStatePointerPath(workspace: ProjectWorkspace): string {
  return join(autoRunsRoot(workspace), latestAutoRunStatePointerFileName);
}

function latestAutoRunStatePointerPathForState(state: DesktopAutoRunState): string {
  return join(dirname(dirname(state.statePath)), latestAutoRunStatePointerFileName);
}

function autoRunEventLogPath(workspace: ProjectWorkspace, runId: string): string {
  return join(autoRunRoot(workspace, runId), "events.ndjson");
}

function projectsRoot(workspace: ProjectWorkspace): string {
  return join(workspace.planweaveHome, "projects");
}

async function listRunDirectories(workspace: ProjectWorkspace): Promise<string[]> {
  return listRunDirectoriesAt(autoRunsRoot(workspace));
}

async function listRunDirectoriesAt(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && isDesktopRunId(entry.name)).map((entry) => entry.name);
  } catch (error) {
    if (isNodeFileNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

async function listProjectWorkspaceRoots(workspace: ProjectWorkspace): Promise<string[]> {
  try {
    const entries = await readdir(projectsRoot(workspace), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => join(projectsRoot(workspace), entry.name));
  } catch (error) {
    if (isNodeFileNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

function workspaceFromRoot(workspace: ProjectWorkspace, workspaceRoot: string): ProjectWorkspace {
  return projectWorkspacePaths({
    id: basename(workspaceRoot),
    kind: "managed",
    rootPath: workspaceRoot,
    sourceRoot: null,
    planweaveHome: workspace.planweaveHome,
    workspaceRoot
  });
}

async function listCanvasAutoRunRoots(workspace: ProjectWorkspace): Promise<string[]> {
  try {
    const loaded = await loadProjectGraphForWorkspace(workspace);
    return loaded.manifest.canvases.map((canvas) => autoRunsRoot(projectCanvasWorkspace(loaded.workspace, canvas)));
  } catch (error) {
    if (isNodeFileNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

async function listAutoRunRootsAcrossProjects(workspace: ProjectWorkspace): Promise<string[]> {
  const autoRunRoots = new Set([autoRunsRoot(workspace)]);
  for (const workspaceRoot of await listProjectWorkspaceRoots(workspace)) {
    autoRunRoots.add(join(workspaceRoot, "results", "auto-runs"));
    for (const canvasAutoRunRoot of await listCanvasAutoRunRoots(workspaceFromRoot(workspace, workspaceRoot))) {
      autoRunRoots.add(canvasAutoRunRoot);
    }
  }
  return [...autoRunRoots];
}

async function listPersistedRunDirectoriesAcrossProjects(workspace: ProjectWorkspace): Promise<string[]> {
  const runIds: string[] = [];
  for (const autoRunDirectory of await listAutoRunRootsAcrossProjects(workspace)) {
    runIds.push(...(await listRunDirectoriesAt(autoRunDirectory)));
  }
  return runIds;
}

function compareAutoRunStatesNewestFirst(left: DesktopAutoRunState, right: DesktopAutoRunState): number {
  const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);
  if (byUpdatedAt !== 0) {
    return byUpdatedAt;
  }
  return right.runId.localeCompare(left.runId, undefined, { numeric: true });
}

function maxRunId(left: string | null, right: string | null): string | null {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return compareRunDirectoriesNewestFirst(left, right) <= 0 ? left : right;
}

function isRunIdNewerThan(runId: string, baselineRunId: string | null): boolean {
  if (!baselineRunId) {
    return true;
  }
  const candidateNumber = runNumber(runId);
  const baselineNumber = runNumber(baselineRunId);
  return candidateNumber !== null && baselineNumber !== null
    ? candidateNumber > baselineNumber
    : runId.localeCompare(baselineRunId, undefined, { numeric: true }) > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLatestAutoRunStateDiagnosticEntry(value: unknown): LatestAutoRunStateDiagnosticEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const { runId, diagnostic } = value;
  if (typeof runId !== "string" || !isDesktopRunId(runId) || !isRecord(diagnostic)) {
    return null;
  }
  if (typeof diagnostic.code !== "string" || typeof diagnostic.message !== "string" || typeof diagnostic.path !== "string") {
    return null;
  }
  return {
    runId,
    diagnostic: {
      code: diagnostic.code,
      message: diagnostic.message,
      path: diagnostic.path
    }
  };
}

function parseLatestAutoRunStatePointer(value: unknown): LatestAutoRunStatePointer | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }
  const selectedRunId = typeof value.selectedRunId === "string" && isDesktopRunId(value.selectedRunId) ? value.selectedRunId : null;
  const selectedUpdatedAt = typeof value.selectedUpdatedAt === "string" ? value.selectedUpdatedAt : null;
  const highestRunId = typeof value.highestRunId === "string" && isDesktopRunId(value.highestRunId) ? value.highestRunId : selectedRunId;
  const diagnostics = Array.isArray(value.diagnostics)
    ? value.diagnostics.map(parseLatestAutoRunStateDiagnosticEntry).filter((entry): entry is LatestAutoRunStateDiagnosticEntry => entry !== null)
    : [];
  return {
    version: 1,
    selectedRunId,
    selectedUpdatedAt,
    highestRunId,
    diagnostics
  };
}

async function readLatestAutoRunStatePointerAt(path: string): Promise<LatestAutoRunStatePointer | null> {
  try {
    return parseLatestAutoRunStatePointer(await readJsonFile<unknown>(path));
  } catch (error) {
    if (isNodeFileNotFoundError(error) || error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

async function readLatestAutoRunStatePointer(workspace: ProjectWorkspace): Promise<LatestAutoRunStatePointer | null> {
  return readLatestAutoRunStatePointerAt(latestAutoRunStatePointerPath(workspace));
}

async function writeLatestAutoRunStatePointerAt(path: string, pointer: LatestAutoRunStatePointer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeJsonFile(path, pointer);
}

async function writeLatestAutoRunStatePointer(workspace: ProjectWorkspace, pointer: LatestAutoRunStatePointer): Promise<void> {
  await writeLatestAutoRunStatePointerAt(latestAutoRunStatePointerPath(workspace), pointer);
}

function isDesktopAutoRunPhase(value: unknown): value is DesktopAutoRunPhase {
  return typeof value === "string" && desktopAutoRunPhaseSet.has(value);
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function eventData(record: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!autoRunLogEventDataKeys.has(key)) {
      data[key] = value;
    }
  }
  return data;
}

function parseAutoRunLogEventLine(line: string, lineNumber: number, path: string, expectedRunId: string): {
  event: DesktopAutoRunLogEvent | null;
  diagnostic: DesktopAutoRunEventLogDiagnostic | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      event: null,
      diagnostic: {
        code: "auto_run_event_log_bad_line",
        message: `Line ${lineNumber} is not valid JSON: ${detail}`,
        line: lineNumber,
        path
      }
    };
  }

  if (!isRecord(parsed)) {
    return {
      event: null,
      diagnostic: {
        code: "auto_run_event_log_bad_line",
        message: `Line ${lineNumber} is not a JSON object.`,
        line: lineNumber,
        path
      }
    };
  }

  const issues: string[] = [];
  const timestamp = typeof parsed.timestamp === "string" ? parsed.timestamp : null;
  if (typeof parsed.timestamp !== "string") {
    issues.push(`timestamp must be a string, got ${formatUnknownValue(parsed.timestamp)}`);
  }
  const parsedRunId = typeof parsed.runId === "string" ? parsed.runId : null;
  if (typeof parsed.runId !== "string") {
    issues.push(`runId must be a string, got ${formatUnknownValue(parsed.runId)}`);
  } else if (parsed.runId !== expectedRunId) {
    issues.push(`runId "${parsed.runId}" does not match requested runId "${expectedRunId}"`);
  }
  const type = typeof parsed.type === "string" ? parsed.type : null;
  if (typeof parsed.type !== "string") {
    issues.push(`type must be a string, got ${formatUnknownValue(parsed.type)}`);
  }

  const event: DesktopAutoRunLogEvent = {
    line: lineNumber,
    timestamp,
    runId: parsedRunId,
    type,
    data: eventData(parsed)
  };
  if (parsed.phase !== undefined) {
    if (isDesktopAutoRunPhase(parsed.phase)) {
      event.phase = parsed.phase;
    } else {
      issues.push(`phase must be a DesktopAutoRunPhase, got ${formatUnknownValue(parsed.phase)}`);
    }
  }
  if (parsed.stepCount !== undefined) {
    if (typeof parsed.stepCount === "number" && Number.isFinite(parsed.stepCount)) {
      event.stepCount = parsed.stepCount;
    } else {
      issues.push(`stepCount must be a finite number, got ${formatUnknownValue(parsed.stepCount)}`);
    }
  }
  if (parsed.currentRef !== undefined) {
    if (typeof parsed.currentRef === "string" || parsed.currentRef === null) {
      event.currentRef = parsed.currentRef;
    } else {
      issues.push(`currentRef must be a string or null, got ${formatUnknownValue(parsed.currentRef)}`);
    }
  }

  return {
    event,
    diagnostic: issues.length > 0
      ? {
          code: "auto_run_event_log_bad_line",
          message: `Line ${lineNumber} has invalid Auto Run event fields: ${issues.join("; ")}.`,
          line: lineNumber,
          path
        }
      : null
  };
}

export async function nextPersistedAutoRunId(workspace: ProjectWorkspace, options: { isReserved?: (runId: string) => boolean } = {}): Promise<string> {
  await mkdir(autoRunsRoot(workspace), { recursive: true });
  const reservationState = await ensureAutoRunIdReservationsMigrated(workspace, () => listPersistedRunDirectoriesAcrossProjects(workspace));
  let nextNumber = maxRunNumber(reservationState.highestRunId ? [reservationState.highestRunId] : []) + 1;
  while (true) {
    const runId = `DESKTOP-RUN-${String(nextNumber).padStart(4, "0")}`;
    if (options.isReserved?.(runId)) {
      nextNumber += 1;
      continue;
    }
    if (!(await reserveAutoRunId(workspace, runId))) {
      nextNumber += 1;
      continue;
    }
    try {
      await mkdir(autoRunRoot(workspace, runId), { recursive: false });
      await recordReservedAutoRunId(workspace, runId);
      return runId;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        nextNumber += 1;
        continue;
      }
      throw error;
    }
  }
}

export async function readPersistedAutoRunState(workspace: ProjectWorkspace, runId: string, options: { hasActiveLoop?: boolean } = {}): Promise<DesktopAutoRunState | null> {
  const runRoot = autoRunRoot(workspace, runId);
  const statePath = join(runRoot, "state.json");
  const eventLogPath = join(runRoot, "events.ndjson");
  let raw: unknown;
  try {
    raw = await readJsonFile<unknown>(statePath);
  } catch (error) {
    if (isNodeFileNotFoundError(error)) {
      return null;
    }
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
  const state = normalizePersistedAutoRunState(raw, { statePath, eventLogPath });
  return state ? recoverPersistedAutoRunState(state, options.hasActiveLoop ?? false) : null;
}

function autoRunStateDiagnostic(code: string, message: string, path: string): PersistedAutoRunStateReadDiagnostic {
  return { code, message, path };
}

export async function readPersistedAutoRunStateWithDiagnostics(
  workspace: ProjectWorkspace,
  runId: string,
  options: { hasActiveLoop?: boolean } = {}
): Promise<PersistedAutoRunStateReadResult> {
  const runRoot = autoRunRoot(workspace, runId);
  const statePath = join(runRoot, "state.json");
  const eventLogPath = join(runRoot, "events.ndjson");
  let content: string;
  try {
    content = await readFile(statePath, "utf8");
  } catch (error) {
    if (isNodeFileNotFoundError(error)) {
      return {
        state: null,
        diagnostics: [
          autoRunStateDiagnostic("auto_run_state_missing", `Auto Run state '${statePath}' does not exist.`, statePath)
        ]
      };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return {
      state: null,
      diagnostics: [
        autoRunStateDiagnostic("auto_run_state_read_failed", `Failed to read Auto Run state '${statePath}': ${detail}`, statePath)
      ]
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      state: null,
      diagnostics: [
        autoRunStateDiagnostic("auto_run_state_invalid_json", `Auto Run state '${statePath}' is not valid JSON: ${detail}`, statePath)
      ]
    };
  }

  const state = normalizePersistedAutoRunState(raw, { statePath, eventLogPath });
  if (!state) {
    return {
      state: null,
      diagnostics: [
        autoRunStateDiagnostic("auto_run_state_invalid", `Auto Run state '${statePath}' is not a valid persisted Auto Run state.`, statePath)
      ]
    };
  }
  return {
    state: recoverPersistedAutoRunState(state, options.hasActiveLoop ?? false),
    diagnostics: []
  };
}

export async function listPersistedAutoRunStates(workspace: ProjectWorkspace, options: { hasActiveLoop?: (runId: string) => boolean } = {}): Promise<DesktopAutoRunState[]> {
  const states: DesktopAutoRunState[] = [];
  for (const runId of await listRunDirectories(workspace)) {
    const state = await readPersistedAutoRunState(workspace, runId, { hasActiveLoop: options.hasActiveLoop?.(runId) ?? false });
    if (state) {
      states.push(state);
    }
  }
  return states.sort(compareAutoRunStatesNewestFirst);
}

function diagnosticsForSelectedState(
  state: DesktopAutoRunState | null,
  diagnosticEntries: LatestAutoRunStateDiagnosticEntry[]
): PersistedAutoRunStateReadDiagnostic[] {
  if (!state) {
    return diagnosticEntries.map((entry) => entry.diagnostic);
  }
  return diagnosticEntries
    .filter((entry) => isRunIdNewerThan(entry.runId, state.runId))
    .map((entry) => entry.diagnostic);
}

function latestPointerFromResult(result: LatestPersistedAutoRunStateScanResult): LatestAutoRunStatePointer {
  return {
    version: 1,
    selectedRunId: result.state?.runId ?? null,
    selectedUpdatedAt: result.state?.updatedAt ?? null,
    highestRunId: highestRunId(result.runIds),
    diagnostics: result.state
      ? result.diagnosticEntries.filter((entry) => isRunIdNewerThan(entry.runId, result.state?.runId ?? null))
      : result.diagnosticEntries
  };
}

async function scanPersistedAutoRunStates(
  workspace: ProjectWorkspace,
  runIds: string[],
  options: {
    hasActiveLoop?: (runId: string) => boolean;
    matches?: (state: DesktopAutoRunState) => boolean;
  }
): Promise<LatestPersistedAutoRunStateScanResult> {
  const diagnosticEntries: LatestAutoRunStateDiagnosticEntry[] = [];
  const states: DesktopAutoRunState[] = [];
  for (const runId of runIds.sort(compareRunDirectoriesNewestFirst)) {
    const result = await readPersistedAutoRunStateWithDiagnostics(workspace, runId, {
      hasActiveLoop: options.hasActiveLoop?.(runId) ?? false
    });
    diagnosticEntries.push(...result.diagnostics.map((diagnostic) => ({ runId, diagnostic })));
    if (!result.state) {
      continue;
    }
    if (options.matches && !options.matches(result.state)) {
      continue;
    }
    states.push(result.state);
  }
  const state = states.sort(compareAutoRunStatesNewestFirst).at(0) ?? null;
  return {
    state,
    diagnostics: diagnosticsForSelectedState(state, diagnosticEntries),
    diagnosticEntries,
    runIds
  };
}

async function rebuildLatestPersistedAutoRunStatePointer(
  workspace: ProjectWorkspace,
  options: {
    hasActiveLoop?: (runId: string) => boolean;
  }
): Promise<LatestPersistedAutoRunStateResult> {
  const runIds = await listRunDirectories(workspace);
  const result = await scanPersistedAutoRunStates(workspace, runIds, options);
  await writeLatestAutoRunStatePointer(workspace, latestPointerFromResult(result));
  return {
    state: result.state,
    diagnostics: result.diagnostics
  };
}

async function readLatestPersistedAutoRunStateFromPointer(
  workspace: ProjectWorkspace,
  pointer: LatestAutoRunStatePointer,
  options: {
    hasActiveLoop?: (runId: string) => boolean;
    matches?: (state: DesktopAutoRunState) => boolean;
  },
  persistPointer: boolean
): Promise<LatestPersistedAutoRunStatePointerReadResult> {
  const states: DesktopAutoRunState[] = [];
  const diagnosticEntries: LatestAutoRunStateDiagnosticEntry[] = [];
  let selectedReadFailed = false;
  let selectedFilteredOut = false;

  if (pointer.selectedRunId) {
    const selected = await readPersistedAutoRunStateWithDiagnostics(workspace, pointer.selectedRunId, {
      hasActiveLoop: options.hasActiveLoop?.(pointer.selectedRunId) ?? false
    });
    diagnosticEntries.push(...selected.diagnostics.map((diagnostic) => ({ runId: pointer.selectedRunId as string, diagnostic })));
    if (selected.state && (!options.matches || options.matches(selected.state))) {
      states.push(selected.state);
    } else if (selected.state) {
      selectedFilteredOut = true;
    } else {
      selectedReadFailed = true;
    }
  }

  for (const entry of pointer.diagnostics) {
    const result = await readPersistedAutoRunStateWithDiagnostics(workspace, entry.runId, {
      hasActiveLoop: options.hasActiveLoop?.(entry.runId) ?? false
    });
    diagnosticEntries.push(...result.diagnostics.map((diagnostic) => ({ runId: entry.runId, diagnostic })));
    if (result.state && (!options.matches || options.matches(result.state))) {
      states.push(result.state);
    }
  }

  if (selectedReadFailed) {
    return { kind: "selected_read_failed" };
  }

  if (selectedFilteredOut) {
    return { kind: "selected_filtered_out" };
  }

  const runIds = await listRunDirectories(workspace);
  const newRunIds = runIds.filter((runId) => isRunIdNewerThan(runId, pointer.highestRunId));
  const newRuns = await scanPersistedAutoRunStates(workspace, newRunIds, options);
  if (newRuns.state) {
    states.push(newRuns.state);
  }
  diagnosticEntries.push(...newRuns.diagnosticEntries);

  const state = states.sort(compareAutoRunStatesNewestFirst).at(0) ?? null;
  const result: LatestPersistedAutoRunStateScanResult = {
    state,
    diagnostics: diagnosticsForSelectedState(state, diagnosticEntries),
    diagnosticEntries,
    runIds: [...new Set([...runIds, ...newRunIds])]
  };
  if (persistPointer) {
    await writeLatestAutoRunStatePointer(workspace, latestPointerFromResult(result));
  }
  return {
    kind: "result",
    result: {
      state: result.state,
      diagnostics: result.diagnostics
    }
  };
}

export async function readLatestPersistedAutoRunState(
  workspace: ProjectWorkspace,
  options: {
    hasActiveLoop?: (runId: string) => boolean;
    matches?: (state: DesktopAutoRunState) => boolean;
  } = {}
): Promise<LatestPersistedAutoRunStateResult> {
  const hasMatchFilter = typeof options.matches === "function";
  let pointer = await readLatestAutoRunStatePointer(workspace);
  if (!pointer && hasMatchFilter) {
    await rebuildLatestPersistedAutoRunStatePointer(workspace, { hasActiveLoop: options.hasActiveLoop });
    pointer = await readLatestAutoRunStatePointer(workspace);
  }
  if (pointer) {
    const result = await readLatestPersistedAutoRunStateFromPointer(workspace, pointer, options, !hasMatchFilter);
    if (result.kind === "result") {
      return result.result;
    }
    if (result.kind === "selected_read_failed") {
      await rebuildLatestPersistedAutoRunStatePointer(workspace, { hasActiveLoop: options.hasActiveLoop });
      const repairedPointer = await readLatestAutoRunStatePointer(workspace);
      if (repairedPointer) {
        const repairedResult = await readLatestPersistedAutoRunStateFromPointer(workspace, repairedPointer, options, !hasMatchFilter);
        if (repairedResult.kind === "result") {
          return repairedResult.result;
        }
      }
    }
  }
  if (hasMatchFilter) {
    const result = await scanPersistedAutoRunStates(workspace, await listRunDirectories(workspace), options);
    return {
      state: result.state,
      diagnostics: result.diagnostics
    };
  }
  return rebuildLatestPersistedAutoRunStatePointer(workspace, { hasActiveLoop: options.hasActiveLoop });
}

export async function writePersistedAutoRunState(state: DesktopAutoRunState): Promise<void> {
  await writeAutoRunState(state);
  const pointerPath = latestAutoRunStatePointerPathForState(state);
  const current = await readLatestAutoRunStatePointerAt(pointerPath);
  const currentSelectedRunId = current?.selectedRunId ?? null;
  const currentSelectedUpdatedAt = current?.selectedUpdatedAt ?? null;
  const nextStateIsNewest = !currentSelectedRunId || !currentSelectedUpdatedAt || compareAutoRunStatesNewestFirst(state, {
    runId: currentSelectedRunId,
    updatedAt: currentSelectedUpdatedAt
  } as DesktopAutoRunState) < 0;
  const selectedRunId = nextStateIsNewest ? state.runId : currentSelectedRunId;
  await writeLatestAutoRunStatePointerAt(pointerPath, {
    version: 1,
    selectedRunId,
    selectedUpdatedAt: nextStateIsNewest ? state.updatedAt : currentSelectedUpdatedAt,
    highestRunId: maxRunId(current?.highestRunId ?? null, state.runId),
    diagnostics: selectedRunId
      ? (current?.diagnostics ?? []).filter((entry) => isRunIdNewerThan(entry.runId, selectedRunId))
      : current?.diagnostics ?? []
  });
}

export async function readPersistedAutoRunEventLog(workspace: ProjectWorkspace, runId: string): Promise<DesktopAutoRunEventLog> {
  if (!isDesktopRunId(runId)) {
    const path = autoRunsRoot(workspace);
    return {
      runId,
      events: [],
      diagnostics: [
        {
          code: "auto_run_event_log_read_failed",
          message: `Invalid Auto Run runId '${runId}'. Expected format DESKTOP-RUN-0001 or another DESKTOP-RUN id with at least four digits.`,
          path
        }
      ]
    };
  }
  const path = autoRunEventLogPath(workspace, runId);
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (isNodeFileNotFoundError(error)) {
      return {
        runId,
        events: [],
        diagnostics: [
          {
            code: "auto_run_event_log_missing",
            message: `Auto Run event log '${path}' does not exist.`,
            path
          }
        ]
      };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return {
      runId,
      events: [],
      diagnostics: [
        {
          code: "auto_run_event_log_read_failed",
          message: `Failed to read Auto Run event log '${path}': ${detail}`,
          path
        }
      ]
    };
  }

  const lines = content.length === 0 ? [] : content.split(/\r?\n/);
  if (lines.length > 0 && (content.endsWith("\n") || content.endsWith("\r\n"))) {
    lines.pop();
  }

  const events: DesktopAutoRunLogEvent[] = [];
  const diagnostics: DesktopAutoRunEventLogDiagnostic[] = [];
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const parsed = parseAutoRunLogEventLine(line, lineNumber, path, runId);
    if (parsed.event) {
      events.push(parsed.event);
    }
    if (parsed.diagnostic) {
      diagnostics.push(parsed.diagnostic);
    }
  }

  return { runId, events, diagnostics };
}
