---
name: plan-runner
description: Claim, execute, review, and recover PlanWeave blocks through the CLI with manual fallback when runtime state is unreliable. Use when an agent is asked to run PlanWeave work, coordinate subagents, process feedback, or continue a Plan Package.
---

# Plan Runner

Use this skill to execute work from an existing PlanWeave Plan Package.

## Command Entry

Resolve the command before claiming work:

1. Use a user-provided command if given.
2. Else try global `planweave`.
3. In the PlanWeave repo, prefer `pnpm --filter @planweave/cli planweave`.

Write examples as `<pw> ...`.

## Controller Loop

1. Run `<pw> current` and `<pw> status --json`.
2. If a specific ref is known, use `<pw> claim <ref>`; for a whole task use `<pw> claim-task <taskId>`; for review use `<pw> claim --type review`.
3. Use `<pw> claim-next --dry-run` or `<pw> claim-next --parallel --dry-run` to preview scheduling. Use real `claim-next` only when automatic selection is desired.
4. If unsure why a block is or is not runnable, run `<pw> explain <ref>` or `<pw> why-not <ref>`.
5. Parse Claim Result: `kind: "block"`, `kind: "feedback"`, `kind: "batch"`, `kind: "none"`, or `kind: "blocked"`.
6. For `block`, render `<pw> prompt <ref>`, execute, then submit with `submit-result` or `submit-review`.
7. For `feedback`, handle content, write a Markdown report, run `<pw> submit-feedback --report <path>`, then follow `nextCommand`.
8. After submit, run `<pw> current` or `<pw> claim-next --dry-run` to decide the next step.

## Manual Fallback

The CLI is preferred but not assumed perfect.

- If CLI status/claim fails or contradicts visible files, read `package/manifest.json`, source prompts, and `state.json` directly.
- Manually assign only block refs that are dependency-ready, in scope, and not already claimed.
- Execute from rendered prompt when available; if prompt rendering fails, assemble context from global/project/task/block prompt sources and report the fallback.
- Try to write back through CLI submit commands. If write-back fails, preserve reports/results and tell the user exactly what could not be reconciled.
- Run `<pw> doctor` before recovery; use `<pw> doctor --repair` only for recoverable state/results drift.

## Prompt Diagnostics

- Check that rendered prompt is non-empty and names the current ref, submit command, and relevant context.
- Check source prompt placement: global/project prompt for cross-cutting rules, task prompt for task context, block prompt for execution details.
- If a prompt is empty or missing, inspect package source files before executing; do not assume the task is trivial.
- Do not write rendered prompt output back into source prompt files.
- PlanWeave Global Prompt, Project Prompt, Task Node Prompt, and Block Prompt are editable source prompts when prompt maintenance is part of the task.

## Execution Quality Gate

- Read the prompt and referenced files before editing.
- Search relevant producers, consumers, schemas, tests, fixtures, and docs before changing code.
- Keep changes scoped to the claimed block.
- Run relevant validation after the change.
- Reports must state changed files, behavior changed, behavior kept, validation run, and remaining risk.
- For review blocks, produce `review-result.json` with `passed` or `needs_changes`; do not encode blocked/diverged state as a review verdict.

## Review Policy

- Simple docs, config, low-risk copy edits, and small local fixes usually do not need review. If a plan adds meaningless review gates, report that they should be removed or skipped by user decision.
- Complex code, contract/schema/API changes, data migration, provider integration, security/privacy, architecture, or high-risk user-visible changes should have review.
- Review blocks are sequential gate work, not parallel implementation work.

## Multi-Canvas And Subagents

- For multiple canvases, run them in explicit dependency/phase order from the package or project prompt.
- Independent canvases may run in parallel only when dependencies and locks are clear.
- Controller duties: preview claims, assign refs to subagents, give each subagent prompt path and submit command, monitor reports, close completed agents, and reconcile state with `<pw> current` / `<pw> status --json`.
- Do not leave completed subagents running. After their report is submitted, release or close them.

## Recovery Commands

- Blocked: `<pw> mark-blocked <ref> --reason "<reason>"`, then later `<pw> unblock <block-ref> --reason "<reason>"`.
- Diverged: `<pw> mark-diverged <ref> --reason "<reason>"`, reconcile the package, then `<pw> resolve-divergence <block-ref> --reason "<reason>"`.
- Stale current/ref/index issues: run `<pw> doctor`, then `<pw> doctor --repair` if the reported repair is safe.
- Feedback resolved: run `<pw> claim-next` or explicit `<pw> claim <review-ref>` to continue re-review.
- Parallel mismatch: compare `status.nextParallelClaimable` and `status.nextSequentialClaimable`; review gates are sequential-only.

## Claim Result Contract

```ts
{ kind: "block"; ref: string; taskId: string; blockId: string; blockType: "implementation" | "check" | "review"; reason?: "claimed" | "current" | "feedback_resolved" }
{ kind: "feedback"; content: string }
{ kind: "batch"; refs: string[] }
{ kind: "none"; reason?: string; nextSequentialClaimable?: string[] }
{ kind: "blocked"; ref?: string; reason: string }
```

## Rules

- Do not edit `state.json` or `results/` directly unless using the Manual Fallback and reporting why CLI write-back is unavailable.
- Do not create feedback blocks in the Plan Package. Feedback is runtime state and is handled with `submit-feedback`.
- Do not mark tasks verified manually; task implementation is aggregated by the Task Manager.
- Do not implement a diverged block as normal work until the plan is reconciled.
