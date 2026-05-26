---
name: plan-runner
description: Execute already-authored PlanWeave work items with scoped engineering changes, review handling, feedback handling, and state-aware fallback. Use when an agent is asked to run PlanWeave work, coordinate subagents, process feedback, or continue a Plan Package.
---

# Plan Runner

Use this skill to execute work from an existing PlanWeave Plan Package. This is an execution protocol, not a CLI reference.

## Command Entry

Resolve the command before claiming work. Use examples as `<pw> ...`.

1. Use a user-provided command if given.
2. Else try global `planweave`.
3. In the PlanWeave repo, prefer `pnpm --filter @planweave/cli planweave`.

For command syntax and topic help, run `<pw> help`, `<pw> help work`, `<pw> help submit`, `<pw> help explain`, `<pw> help recovery`, or `<pw> help autorun`. Do not duplicate the CLI manual in this skill.

## Controller Loop

1. Inspect current work and status before claiming new work.
2. Prefer explicit refs when a controller assigns work; use automatic claim only when selection is intentionally delegated to PlanWeave.
3. Preview scheduling before parallel or ambiguous claims.
4. Explain blocked or skipped work before changing state.
5. Treat claim results by kind: block work, feedback work, batch work, no work, or blocked work.
6. Render the prompt for the claimed item and read referenced files before editing.
7. Submit through the CLI after producing the required report/result artifact.
8. Re-check current work after submit; continue only when the next item is clear.

## Manual Fallback

The CLI is preferred but not assumed perfect.

- If CLI status/claim fails or contradicts visible files, read `package/manifest.json`, source prompts, and `state.json` directly.
- Manually assign only block refs that are dependency-ready, in scope, and not already claimed.
- Execute from rendered prompt when available; if prompt rendering fails, assemble context from global/project/task/block prompt sources and report the fallback.
- Try to write back through CLI submit commands. If write-back fails, preserve reports/results and tell the user exactly what could not be reconciled.
- Use CLI help recovery guidance before repair; only run repair for recoverable state/results drift.

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
- Do not treat a mock, dry-run, fixture-only test, or uncalled API as a completed live path unless the prompt explicitly scoped it that way.

## Review Policy

- Simple docs, config, low-risk copy edits, and small local fixes usually do not need review. If a plan adds meaningless review gates, report that they should be removed or skipped by user decision.
- Complex code, contract/schema/API changes, data migration, provider integration, security/privacy, architecture, or high-risk user-visible changes should have review.
- Review blocks are sequential gate work, not parallel implementation work.

## Multi-Canvas And Subagents

- For multiple canvases, run them in explicit dependency/phase order from the package or project prompt.
- Independent canvases may run in parallel only when dependencies and locks are clear.
- Controller duties: preview claims, assign refs to subagents, give each subagent prompt path and submit command, monitor reports, close completed agents, and reconcile state.
- Do not leave completed subagents running. After their report is submitted, release or close them.

## Recovery Protocol

- Use `<pw> help recovery` for exact commands.
- Blocked work needs an explicit reason and an unblock reason later.
- Diverged work must be reconciled in the Plan Package before normal execution resumes.
- Stale current refs, orphan results, and index/state drift require diagnosis before repair.
- Resolved feedback usually returns to review; do not resubmit resolved feedback as current work.
- Parallel mismatch should be explained through status/explain output before assuming no work exists.

## Rules

- Do not edit `state.json` or `results/` directly unless using the Manual Fallback and reporting why CLI write-back is unavailable.
- Do not create feedback blocks in the Plan Package. Feedback is runtime state and is handled with `submit-feedback`.
- Do not mark tasks verified manually; task implementation is aggregated by the Task Manager.
- Do not implement a diverged block as normal work until the plan is reconciled.
