import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

describe("agent skill contract docs", () => {
  it("documents cross-platform PlanWeave home and package path discovery in plan-importer", async () => {
    const skill = await readFile(join(repoRoot, "skills/plan-importer/SKILL.md"), "utf8");

    expect(skill).toContain("Do not create or write `./.planweave` inside the target project by hand.");
    expect(skill).toContain("PLANWEAVE_HOME");
    expect(skill).toContain("macOS: `~/.planweave`");
    expect(skill).toContain("Linux: `~/.planweave`");
    expect(skill).toContain("Windows: `%USERPROFILE%\\.planweave`");
    expect(skill).toContain("<pw> paths --json");
    expect(skill).toContain("workspace.packageDir");
    expect(skill).toContain("Treat the CLI-returned package directory as the only writable Plan Package location.");
  });

  it("documents importer task-only defaults, prompt placement, and canvas/review strategy", async () => {
    const skill = await readFile(join(repoRoot, "skills/plan-importer/SKILL.md"), "utf8");

    expect(skill).toContain("Do not create context nodes by default.");
    expect(skill).toContain("Create context nodes only when the user explicitly asks for them.");
    expect(skill).toContain("Do not write rendered prompt output back into source prompt files.");
    expect(skill).toContain("Prompt Placement");
    expect(skill).toContain("100+ tasks/nodes");
    expect(skill).toContain("Do not add review blocks for simple docs");
    expect(skill).toContain("Do not split for the sake of splitting.");
  });

  it("documents importer plan quality checks before writing the package", async () => {
    const skill = await readFile(join(repoRoot, "skills/plan-importer/SKILL.md"), "utf8");

    expect(skill).toContain("Run the Plan Quality Gate below before writing.");
    expect(skill).toContain("Identify core objects and trace create");
    expect(skill).toContain("Keep schema, types, APIs, CLI flags, events, files, and prompt inputs/outputs consistent");
    expect(skill).toContain("Reject fake completion");
    expect(skill).toContain("Separate plan defects from PlanWeave toolchain defects in the report.");
  });

  it("documents JSON Claim Result branches and block-ref recovery commands in plan-runner", async () => {
    const skill = await readFile(join(repoRoot, "skills/plan-runner/SKILL.md"), "utf8");

    expect(skill).toContain('kind: "block"');
    expect(skill).toContain('kind: "feedback"');
    expect(skill).toContain('kind: "batch"');
    expect(skill).toContain('kind: "blocked"');
    expect(skill).toContain("<pw> submit-feedback --report");
    expect(skill).toContain("<pw> unblock <block-ref>");
    expect(skill).toContain("<pw> resolve-divergence <block-ref> --reason");
    expect(skill).toContain("Do not create feedback blocks");
  });

  it("documents that plan-runner may maintain editable source prompts", async () => {
    const skill = await readFile(join(repoRoot, "skills/plan-runner/SKILL.md"), "utf8");

    expect(skill).toContain("PlanWeave Global Prompt, Project Prompt, Task Node Prompt, and Block Prompt are editable source prompts");
    expect(skill).toContain("Do not write rendered prompt output back into source prompt files.");
  });

  it("documents runner explicit claims, fallback, prompt diagnostics, and subagent control", async () => {
    const skill = await readFile(join(repoRoot, "skills/plan-runner/SKILL.md"), "utf8");

    expect(skill).toContain("<pw> current");
    expect(skill).toContain("<pw> claim <ref>");
    expect(skill).toContain("<pw> claim-task <taskId>");
    expect(skill).toContain("<pw> claim --type review");
    expect(skill).toContain("<pw> claim-next --parallel --dry-run");
    expect(skill).toContain("Manual Fallback");
    expect(skill).toContain("Check source prompt placement");
    expect(skill).toContain("Controller duties");
    expect(skill).toContain("Review blocks are sequential gate work");
  });

  it("documents plan-auditor as a focused PlanWeave plan review skill", async () => {
    const skill = await readFile(join(repoRoot, "skills/plan-auditor/SKILL.md"), "utf8");

    expect(skill).toContain("Use when auditing, reviewing, checking, or challenging a PlanWeave plan before execution.");
    expect(skill).toContain("Do not import a new plan, execute blocks, repair state, or rewrite the package");
    expect(skill).toContain("Core Object Lifecycle");
    expect(skill).toContain("schema without runtime use");
    expect(skill).toContain("Separate plan design defects from PlanWeave toolchain defects.");
    expect(skill).toContain("End with the recommended revision order.");
  });
});
