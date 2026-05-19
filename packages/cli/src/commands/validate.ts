import type { Command } from "commander";
import { validatePackage } from "@planweave/runtime";
import { formatValidationReport } from "../output.js";
import { resolveCliProjectRoot } from "../projectRoot.js";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate the current project's Plan Package")
    .action(async () => {
      const report = await validatePackage({ projectRoot: resolveCliProjectRoot() });
      console.log(formatValidationReport(report));
      if (!report.ok) {
        process.exitCode = 1;
      }
    });
}
