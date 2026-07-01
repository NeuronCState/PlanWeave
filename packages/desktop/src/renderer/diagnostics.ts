import type { ValidationIssue } from "@planweave-ai/runtime";

const desktopPerformanceDiagnosticCodes = new Set([
  "desktop_projection_slow_part",
  "desktop_search_index_slow_part",
  "desktop_statistics_slow_part"
]);

export function isDesktopPerformanceDiagnostic(diagnostic: Pick<ValidationIssue, "code">): boolean {
  return desktopPerformanceDiagnosticCodes.has(diagnostic.code);
}

function desktopDiagnosticKey(diagnostic: ValidationIssue): string {
  return `${diagnostic.code}\u001f${diagnostic.message}\u001f${diagnostic.path ?? ""}`;
}

export function uniqueDesktopDiagnostics(diagnostics: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  const unique: ValidationIssue[] = [];
  for (const diagnostic of diagnostics) {
    const key = desktopDiagnosticKey(diagnostic);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(diagnostic);
  }
  return unique;
}
