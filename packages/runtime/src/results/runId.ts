export function formatRunId(runCount: number): string {
  return `RUN-${String(runCount).padStart(3, "0")}`;
}

export function nextRunId(runCount: number): string {
  return formatRunId(runCount + 1);
}
