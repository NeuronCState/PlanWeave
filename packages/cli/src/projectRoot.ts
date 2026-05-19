export function resolveCliProjectRoot(): string {
  return process.env.INIT_CWD || process.cwd();
}
