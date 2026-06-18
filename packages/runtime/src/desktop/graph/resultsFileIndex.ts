import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ProjectWorkspace, ValidationIssue } from "../../types.js";
import { appendDesktopDiagnostic, desktopDiagnostic, errorMessage } from "./desktopDiagnostics.js";

const resultFilePattern = /\.(md|json|log|txt)$/;

export const maxIndexedResultFileBytes = 256_000;

export type ResultFileFingerprint = {
  path: string;
  mtimeMs: number;
  size: number;
};

export type ResultsFileIndexEntry = {
  absolutePath: string;
  relativePath: string;
  fingerprint: ResultFileFingerprint;
  body: string;
  bodyTruncated: boolean;
  metadata: Record<string, unknown> | null;
};

export type ResultsFileIndex = {
  workspace: ProjectWorkspace;
  entries: ResultsFileIndexEntry[];
  diagnostics: ValidationIssue[];
};

export type ResultsFileFingerprintSnapshot = {
  diagnostics: ValidationIssue[];
  files: ResultFileFingerprint[];
};

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function resultPath(resultsDir: string, path: string): string {
  const resultRelativePath = toPosixPath(relative(resultsDir, path));
  return resultRelativePath ? `results/${resultRelativePath}` : "results";
}

async function collectResultFiles(resultsDir: string, root: string, diagnostics: ValidationIssue[], files: string[]): Promise<void> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        await collectResultFiles(resultsDir, path, diagnostics, files);
      } else if (entry.isFile() && resultFilePattern.test(entry.name)) {
        files.push(path);
      }
    }
  } catch (caught) {
    appendDesktopDiagnostic(
      diagnostics,
      desktopDiagnostic(
        "desktop_results_read_failed",
        `Result files could not be listed: ${errorMessage(caught)}`,
        resultPath(resultsDir, root)
      )
    );
  }
}

async function readResultBody(path: string, size: number, resultsDir: string): Promise<{ body: string; diagnostics: ValidationIssue[] }> {
  if (size > maxIndexedResultFileBytes) {
    return { body: "", diagnostics: [] };
  }
  try {
    return { body: await readFile(path, "utf8"), diagnostics: [] };
  } catch (caught) {
    return {
      body: "",
      diagnostics: [
        desktopDiagnostic("desktop_result_file_read_failed", `Result file could not be read: ${errorMessage(caught)}`, resultPath(resultsDir, path))
      ]
    };
  }
}

function isMetadataPath(relativePath: string): boolean {
  return relativePath.includes("/blocks/") && relativePath.endsWith("/metadata.json");
}

function parseMetadata(body: string, path: string): { value: Record<string, unknown> | null; diagnostics: ValidationIssue[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch (caught) {
    return {
      value: null,
      diagnostics: [
        desktopDiagnostic("desktop_result_metadata_read_failed", `Result metadata could not be read or parsed: ${errorMessage(caught)}`, path)
      ]
    };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return { value: parsed as Record<string, unknown>, diagnostics: [] };
  }

  return {
    value: null,
    diagnostics: [
      desktopDiagnostic("desktop_result_metadata_invalid", "Result metadata must be a JSON object.", path)
    ]
  };
}

function sameResultsFingerprint(left: ResultFileFingerprint, right: ResultFileFingerprint): boolean {
  return left.path === right.path && left.mtimeMs === right.mtimeMs && left.size === right.size;
}

export async function snapshotResultsFileFingerprints(workspace: ProjectWorkspace): Promise<ResultsFileFingerprintSnapshot> {
  const diagnostics: ValidationIssue[] = [];
  const files: string[] = [];
  await collectResultFiles(workspace.resultsDir, workspace.resultsDir, diagnostics, files);
  const fingerprints: ResultFileFingerprint[] = [];
  for (const absolutePath of files) {
    const metadata = await stat(absolutePath);
    fingerprints.push({
      path: toPosixPath(relative(workspace.resultsDir, absolutePath)),
      mtimeMs: metadata.mtimeMs,
      size: metadata.size
    });
  }
  return {
    diagnostics,
    files: fingerprints.sort((left, right) => left.path.localeCompare(right.path))
  };
}

function sameDiagnostic(left: ValidationIssue, right: ValidationIssue): boolean {
  return left.code === right.code && left.message === right.message && left.path === right.path;
}

export function sameResultsFileFingerprintSnapshot(
  left: ResultsFileFingerprintSnapshot,
  right: ResultsFileFingerprintSnapshot
): boolean {
  return left.diagnostics.length === right.diagnostics.length
    && left.diagnostics.every((diagnostic, index) => sameDiagnostic(diagnostic, right.diagnostics[index]))
    && left.files.length === right.files.length
    && left.files.every((fingerprint, index) => sameResultsFingerprint(fingerprint, right.files[index]));
}

export async function buildResultsFileIndex(workspace: ProjectWorkspace): Promise<ResultsFileIndex> {
  const diagnostics: ValidationIssue[] = [];
  const files: string[] = [];
  await collectResultFiles(workspace.resultsDir, workspace.resultsDir, diagnostics, files);

  const entries: ResultsFileIndexEntry[] = [];
  for (const absolutePath of files) {
    let metadata;
    try {
      metadata = await stat(absolutePath);
    } catch (caught) {
      appendDesktopDiagnostic(
        diagnostics,
        desktopDiagnostic("desktop_result_file_read_failed", `Result file metadata could not be read: ${errorMessage(caught)}`, resultPath(workspace.resultsDir, absolutePath))
      );
      continue;
    }
    const relativePath = toPosixPath(relative(workspace.resultsDir, absolutePath));
    const bodyResult = await readResultBody(absolutePath, metadata.size, workspace.resultsDir);
    for (const diagnostic of bodyResult.diagnostics) {
      appendDesktopDiagnostic(diagnostics, diagnostic);
    }
    const resultDisplayPath = resultPath(workspace.resultsDir, absolutePath);
    const parsedMetadata = isMetadataPath(relativePath)
      ? metadata.size > maxIndexedResultFileBytes
        ? {
            value: null,
            diagnostics: [
              desktopDiagnostic(
                "desktop_result_metadata_read_failed",
                `Result metadata could not be read or parsed: file exceeds ${maxIndexedResultFileBytes} bytes.`,
                resultDisplayPath
              )
            ]
          }
        : parseMetadata(bodyResult.body, resultDisplayPath)
      : { value: null, diagnostics: [] };
    for (const diagnostic of parsedMetadata.diagnostics) {
      appendDesktopDiagnostic(diagnostics, diagnostic);
    }
    entries.push({
      absolutePath,
      relativePath,
      fingerprint: {
        path: relativePath,
        mtimeMs: metadata.mtimeMs,
        size: metadata.size
      },
      body: bodyResult.body,
      bodyTruncated: metadata.size > maxIndexedResultFileBytes,
      metadata: parsedMetadata.value
    });
  }

  return { workspace, entries, diagnostics };
}
