export type OpencodeJsonOutput = {
  parsedAny: boolean;
  sessionId: string | null;
  error: string | null;
  text: string;
  toolSummaries: string[];
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractSessionIdFromObject(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return (
    stringValue(value.sessionID) ??
    stringValue(value.sessionId) ??
    stringValue(value.session_id) ??
    stringValue(value.threadId) ??
    stringValue(value.thread_id) ??
    extractSessionIdFromObject(value.part)
  );
}

const ansiEscapePattern = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const sessionLabels = new Set(["opencodesessionid", "sessionid", "threadid"]);

function normalizeTerminalLine(line: string): string {
  return line.replace(ansiEscapePattern, "").trim();
}

function cleanSessionToken(value: string | undefined): string | null {
  const cleaned = value?.replace(/^[`'"]+|[`'",;]+$/g, "");
  if (!cleaned || !/^[A-Za-z0-9_.:-]+$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function firstSessionToken(value: string): string | null {
  for (const token of value.replaceAll("*", "").trim().split(/\s+/)) {
    const sessionId = cleanSessionToken(token);
    if (sessionId) {
      return sessionId;
    }
  }
  return null;
}

function labeledSessionId(line: string): string | null {
  const colonIndex = line.indexOf(":");
  const equalsIndex = line.indexOf("=");
  const separatorIndex =
    colonIndex === -1 ? equalsIndex : equalsIndex === -1 ? colonIndex : Math.min(colonIndex, equalsIndex);
  if (separatorIndex === -1) {
    return null;
  }
  const label = line
    .slice(0, separatorIndex)
    .replaceAll("*", "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (!sessionLabels.has(label)) {
    return null;
  }
  return firstSessionToken(line.slice(separatorIndex + 1));
}

function commandSessionId(line: string): string | null {
  const tokens = line.split(/\s+/).filter(Boolean);
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] !== "opencode") {
      continue;
    }
    const option = tokens[index + 1];
    if (option === "-s" || option === "--session") {
      return cleanSessionToken(tokens[index + 2]);
    }
  }
  return null;
}

export function extractOpencodeSessionId(output: string): string | null {
  const jsonSessionId = parseOpencodeJsonOutput(output).sessionId;
  if (jsonSessionId) {
    return jsonSessionId;
  }
  for (const line of output.split(/\r?\n/)) {
    const trimmed = normalizeTerminalLine(line);
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const sessionId = parsed.sessionID ?? parsed.sessionId ?? parsed.session_id ?? parsed.threadId ?? parsed.thread_id;
      if (typeof sessionId === "string" && sessionId.trim()) {
        return sessionId;
      }
    } catch {
      const sessionId = labeledSessionId(trimmed) ?? commandSessionId(trimmed);
      if (sessionId) {
        return sessionId;
      }
    }
  }
  return null;
}

function textPart(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const part = value.part;
  if (isRecord(part) && part.type === "text") {
    return stringValue(part.text);
  }
  if (value.type === "text") {
    return stringValue(value.text);
  }
  return null;
}

function toolSummary(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const part = isRecord(value.part) ? value.part : value;
  if (part.type !== "tool" && value.type !== "tool_use") {
    return null;
  }
  const tool = stringValue(part.tool) ?? "tool";
  const title = stringValue(part.title);
  const state = isRecord(part.state) ? part.state : {};
  const status = stringValue(state.status);
  const output = stringValue(state.output);
  return [`- ${tool}`, title ? ` ${title}` : "", status ? ` (${status})` : "", output ? `: ${output}` : ""].join("");
}

function errorMessage(value: unknown): string | null {
  if (!isRecord(value) || value.type !== "error") {
    return null;
  }
  const error = isRecord(value.error) ? value.error : {};
  const data = isRecord(error.data) ? error.data : {};
  return stringValue(data.message) ?? stringValue(error.message) ?? stringValue(error.name) ?? "OpenCode returned an error event.";
}

export function parseOpencodeJsonOutput(output: string): OpencodeJsonOutput {
  const textParts: string[] = [];
  const toolSummaries: string[] = [];
  let parsedAny = false;
  let sessionId: string | null = null;
  let error: string | null = null;

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    parsedAny = true;
    sessionId = sessionId ?? extractSessionIdFromObject(parsed);
    error = error ?? errorMessage(parsed);
    const text = textPart(parsed);
    if (text) {
      textParts.push(text);
    }
    const summary = toolSummary(parsed);
    if (summary) {
      toolSummaries.push(summary);
    }
  }

  return {
    parsedAny,
    sessionId,
    error,
    text: textParts.join("\n\n").trim(),
    toolSummaries
  };
}

const sessionListHint =
  "OpenCode session id was not found in this run output. Run `opencode session list` in the execution directory to find the latest OpenCode session.";

function withSessionListHint(report: string, output: OpencodeJsonOutput, fallbackStdout: string, fallbackStderr: string, knownSessionId?: string | null): string {
  const sessionId = knownSessionId ?? output.sessionId ?? extractOpencodeSessionId(`${fallbackStdout}\n${fallbackStderr}`);
  if (sessionId || !report.trim()) {
    return report;
  }
  return `${report.trim()}\n\n---\n${sessionListHint}`;
}

export function opencodeReport(output: OpencodeJsonOutput, fallbackStdout: string, fallbackStderr: string, knownSessionId?: string | null): string {
  let report: string;
  if (output.text) {
    report = output.text;
  } else if (output.toolSummaries.length > 0) {
    report = ["## OpenCode Tool Summary", "", ...output.toolSummaries].join("\n");
  } else {
    report = fallbackStdout.trim() || fallbackStderr.trim();
  }
  return withSessionListHint(report, output, fallbackStdout, fallbackStderr, knownSessionId);
}
