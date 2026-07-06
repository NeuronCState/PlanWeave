---
name: plan-maker
description: Create a PlanWeave package-shaped draft from a fuzzy goal, sparse requirements, codebase context, or a user idea before a formal Plan Package exists. Use when the user asks to make, draft, design, break down, or plan PlanWeave work without an existing PRD, roadmap, issue set, or strong source plan; materialize only when explicitly asked.
---

# Plan Maker

Use this skill to design a PlanWeave package-shaped draft from incomplete input. Markdown is only an explanation view; the authoritative draft should map directly to PlanWeave package files. Do not execute work, audit an existing package, or write a Plan Package unless the user explicitly asks. Do not write/import a draft unless the user explicitly asks to materialize.

## Quick Start

1. Restate the user's goal, non-goals, constraints, and likely success criteria.
2. Ask only blocking clarification questions; otherwise state assumptions and continue.
3. Gather lightweight context from README, current code, schemas, tests, examples, and nearby docs.
4. Identify core objects, lifecycle stages, contracts, risks, and validation paths.
5. Draft canvases, tasks, blocks, formal project graph dependencies, prompt placement, review gates, verification, and the package files that would be written.
6. End with open assumptions and the recommended handoff: refine with the user, audit with `plan-auditor`, or materialize by writing a draft root and running package draft validate/quality/import.

## Context Discovery

- If strong source docs exist, prefer `plan-importer` instead of this skill.
- If no docs exist, inspect the current codebase enough to avoid invented architecture.
- Search producers and consumers for likely core objects before splitting tasks.
- Treat user goals as authority, but mark uncertain scope, missing domain rules, and unknown external dependencies.
- Do not invent large product requirements to make the plan look complete.

## Planning Principles

- Design around core object lifecycles: create, validate, transform, state, storage, consumption, side effects, final output, failure, retry, rollback, and manual intervention.
- Keep schema, types, APIs, CLI flags, events, files, and prompt inputs/outputs consistent across producers and consumers.
- Split tasks by data flow, contract boundary, ownership, risk, or independently verifiable acceptance.
- Do not split only to create more nodes; merge tiny tasks that cannot be claimed, tested, or reported independently.
- Model real execution order with explicit dependencies and gates.
- Parallel tasks must be genuinely independent in data, locks, and contract timing.
- For multi-canvas plans, model orchestration as a formal project graph, not as prose-only canvas order.
- Do not schedule broad UI/package polish before foundation contracts and runtime behavior are stable.
- Do not import other projects' skills, bootstrap rules, or prompt conventions unless this target repository explicitly requires them.

## Plan Shape

Output a package-shaped draft with these sections:

```md
## Goal
## Assumptions And Open Questions
## Draft Root And Package Files
## Canvas Strategy
## Project Graph
## Task Graph
## Prompt Placement
## Review Strategy
## Verification Strategy
## Risks And Recovery
## Handoff
```

For each task include:

- task id, title, owner canvas, objective, acceptance, dependencies, and likely files.
- blocks with type, purpose, parallel safety, done criteria, validation, and report expectations.
- review only when risk justifies it.
- complex blocks must include architecture boundaries, test location, config/env handling, README or `.env.example` updates when applicable, and real provider vs mock/dry-run expectations.

The `Draft Root And Package Files` section is the authority for materialization. It must list the intended `project-graph.json` when needed, each canvas `manifest.json`, task/block prompt files, and any layout/state reset expectation. The Markdown report must not be the only import source.

For multi-canvas drafts include a `Project Graph` section with:

- canvas ids, titles, package directories, and why each canvas exists.
- canvas-level dependency edges for phase/subsystem order.
- explicit `crossTaskEdges` for task-to-task blockers across canvases.
- which canvases can run in parallel and why their data, locks, contracts, and upstream blockers are independent.
- any manual graph-editing assumption; formal graph dependencies must not exist only in prose.

Small plans may stay single-canvas and omit `project-graph.json` materialization, but large plans, multi-phase plans, or plans split by subsystem should be drafted as a formal project graph.

## Materialization Workflow

Only materialize when the user explicitly asks to create/write/import the plan.

1. Write the draft under a temporary draft root, not into the active PlanWeave package.
2. Run `planweave package-draft validate --draft-root <draft> --json`.
3. Run `planweave package-draft quality --draft-root <draft> --json`.
4. Fix validation errors and serious quality errors in the draft root.
5. Run `planweave package import --from <draft> --dry-run --json` and report the preview.
6. Apply with `planweave package import --from <draft> --apply --json` only after confirmation when confirmation is required by the surrounding workflow.
7. Re-check the imported package with `planweave validate --json` and `planweave graph quality --json`.

For MCP clients, use `validate_package_draft`, `preview_package_import`, and `import_package_draft` with `apply: true` for the same flow.

Do not route a plan-maker Markdown report through `plan-importer` as the normal materialization path. `plan-importer` is for strong existing source documents, not for reinterpreting this skill's own package-shaped draft.

## Prompt Placement

- Global/project prompt: shared goals, architecture rules, coding standards, references, and cross-cutting risks.
- Task prompt: task-local context, acceptance rationale, dependencies, and likely files.
- Block prompt: exact execution instructions, constraints, validation commands, and report expectations.
- Keep requirements in source prompts or task acceptance, not only in the planning report.
- Do not leave block prompts empty; if inherited context is enough, state the concrete done condition.

## Review Strategy

- Skip review for simple docs, config tweaks, copy edits, and low-risk local fixes unless the user asks.
- Add review for cross-layer code, schema/API/CLI contracts, database changes, provider integration, security/privacy, architecture, or high-risk user-visible behavior.
- Review gates should explain why they exist, who should run them, what pass means, and where `needs_changes` returns.

## Verification Strategy

- Every block needs observable completion: commands, tests, output artifacts, state transitions, or end-to-end flows.
- Distinguish mock, dry-run, live path, and real artifacts.
- Reject acceptance like "implemented", "logic correct", or "looks usable".
- Include failure-path validation when the feature needs reliable execution.

## Rules

- This skill produces a plan draft, not runtime state. The draft should be package-shaped when intended for PlanWeave import.
- Do not create context nodes; place context in prompts, acceptance, or references.
- Do not create `feedback` blocks; feedback is runtime state.
- Do not model cross-canvas dependency order only in task prompts or narrative text; use project graph canvas edges and explicit cross-task dependencies in the draft.
- Do not write package files, run `planweave init`, import a draft, or submit work unless the user explicitly asks to materialize or execute the plan.
- If the draft is intended for execution, recommend auditing it before import when risk is high.
