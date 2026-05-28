import type { ValidationReport } from "@planweave-ai/runtime";

export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [];
  lines.push(report.ok ? "Validation passed." : "Validation failed.");

  if (report.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const error of report.errors) {
      lines.push(`- [${error.code}] ${error.message}${error.path ? ` (${error.path})` : ""}`);
    }
  }

  if (report.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of report.warnings) {
      lines.push(`- [${warning.code}] ${warning.message}${warning.path ? ` (${warning.path})` : ""}`);
    }
  }

  return lines.join("\n");
}
