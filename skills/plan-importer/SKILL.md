---
name: plan-importer
description: Generate a block-level PlanWeave Plan Package from project documentation and validate it through the PlanWeave CLI. Use when importing plans, PRDs, roadmaps, issue sets, or architecture notes into a PlanWeave package.
---

# Plan Importer

Use this skill to turn project planning material into a PlanWeave Plan Package.

## Command Entry

Resolve the command before writing files:

1. Use a user-provided command if given.
2. Else try global `planweave`.
3. In the PlanWeave repo, prefer `pnpm --filter @planweave/cli planweave`.
4. If the repo defines another local script, use that exact entry and show it in the report.

Write examples as `<pw> ...`, where `<pw>` is the resolved command.

## Workspace

- Run `<pw>` from the target project root, not from the PlanWeave repo unless PlanWeave itself is the target project.
- Do not create or write `./.planweave` inside the target project by hand.
- PlanWeave stores project plans under `PLANWEAVE_HOME` when set; otherwise defaults to:
  - macOS: `~/.planweave`
  - Linux: `~/.planweave`
  - Windows: `%USERPROFILE%\.planweave`
- Read the exact package path from `<pw> init --json` or `<pw> paths --json`; write only inside the returned `workspace.packageDir` / `packageDir`.
- Treat the CLI-returned package directory as the only writable Plan Package location.

## Import Workflow

1. Scan README, planning docs, ADRs, issues, specs, domain notes, and referenced source files.
2. Record the scanned source list before writing.
3. Extract executable Task Nodes and Blocks; default to task-only graph nodes.
4. Do not create context nodes by default. Put goals, requirements, constraints, risks, references, and architecture gates into project/global prompt, task acceptance, task prompt, or block prompt. Create context nodes only when the user explicitly asks for them.
5. Build a coverage map: each task has concrete acceptance, each block has verifiable done criteria, and key requirements have an explicit prompt placement.
6. Run `<pw> init --json`, then write `manifest.json`, task prompts, and block prompts under the returned package directory.
7. Run `<pw> validate --json`; fix validation errors and weak importer-created coverage.
8. Output a Plan Import Report listing source docs, command entry, package path, prompt placement, canvas strategy, review strategy, and validation result.

## Prompt Placement

- PlanWeave Global Prompt / Project Prompt: cross-cutting rules, architecture constraints, reference files, coding standards, shared risks.
- Task Prompt: task-local context, acceptance rationale, dependencies, files likely touched.
- Block Prompt: exact execution instructions, validation commands, output/report expectations.
- Do not write rendered prompt output back into source prompt files. Rendered prompts come from `<pw> prompt <ref>` and are derived artifacts.
- Do not leave block prompts empty. If a block needs no separate detail, say that it inherits task/project context and list the concrete done condition.

## Task And Block Granularity

- Do not split for the sake of splitting. Split by data flow, ownership boundary, dependency, risk, or independently verifiable acceptance.
- Merge tasks that are too small to claim, test, or report independently.
- Prefer `implementation` blocks for work and `check` blocks for explicit verification work.
- Add review blocks only for complex code, cross-contract changes, database/schema migration, provider integration, security/privacy, architecture changes, or high-risk user-visible behavior.
- Do not add review blocks for simple docs, config tweaks, local copy edits, or low-risk single-file changes unless the user asks.

## Multi-Canvas Strategy

- For small plans, use one package canvas.
- For large plans, especially 100+ tasks/nodes, split by phase, subsystem, workflow, or owner into task canvases.
- Keep each canvas small enough for an agent to scan and execute; prefer roughly 10-30 tasks per canvas when the source plan allows it.
- Express cross-canvas dependencies through task dependency edges in the package and explain canvas order in project/global prompt.
- Independent canvases may run in parallel only when dependencies and locks make that safe.

## Minimal Block Shape

```json
{
  "id": "B-001",
  "type": "implementation",
  "title": "Implement focused task slice",
  "prompt": "nodes/T-001/blocks/B-001.prompt.md",
  "depends_on": [],
  "parallel": { "safe": false, "locks": [] }
}
```

If review is justified, add `R-001` after implementation/check blocks with `review.required: true` and a clear review prompt.

## Rules

- Treat `package/manifest.json`, source prompts, and task/block prompt files as plan content source of truth.
- Do not create `feedback` block types; feedback is runtime state.
- Do not write implementation state into the manifest.
- Use `state.json` only for runtime task/block/feedback state.
- Do not create runtime graph mirrors, `.plan/`, SQLite stores, HTTP APIs, Docker services, or MCP servers.
- Do not use the Plan Import Report as a substitute for manifest edges, task acceptance, or prompt content.
