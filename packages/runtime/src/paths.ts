import { homedir } from "node:os";
import { join } from "node:path";

export function resolvePlanweaveHome(): string {
  return process.env.PLANWEAVE_HOME || join(homedir(), ".planweave");
}
