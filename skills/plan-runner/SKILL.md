---
name: plan-runner
description: Execute one already-authored PlanWeave implementation or check block with scoped engineering changes and a completion report. Use when assigned a single implementation/check block or when a simple task can be completed by one agent without coordinator/reviewer/recovery separation.
---

# Plan Runner

Use this skill to execute one implementation/check block from an existing PlanWeave Plan Package. For full-plan orchestration use `plan-coordinator`; for review gates use `plan-reviewer`; for state anomalies use `plan-recovery`.

## Command Entry

Resolve the command before claiming work. Use examples as `<pw> ...`.

1. Use a user-provided command if given.
2. Else try global `planweave`.
3. In the PlanWeave repo, prefer `pnpm --filter @planweave/cli planweave`.

For command syntax and topic help, run `<pw> help work` and `<pw> help submit`. Do not duplicate the CLI manual in this skill.

## Block Loop

1. Accept a specific implementation/check ref from the coordinator, or claim one only when explicitly told to.
2. Render the prompt for that ref.
3. Read the prompt, referenced files, related producers/consumers, schemas, tests, fixtures, and docs.
4. Make scoped changes for the assigned block only.
5. Run relevant validation.
6. Write a Markdown report with changes, validation, and risks.
7. Submit through the CLI or return the report path to the coordinator.

## Manual Fallback

The CLI is preferred but not assumed perfect.

- If CLI status/claim fails or contradicts visible files, read `package/manifest.json`, source prompts, and `state.json` directly.
- Manually assign only block refs that are dependency-ready, in scope, and not already claimed.
- Execute from rendered prompt when available; if prompt rendering fails, assemble context from global/project/task/block prompt sources and report the fallback.
- Try to write back through CLI submit commands. If write-back fails, preserve reports/results and tell the user exactly what could not be reconciled.
- Do not repair state/results drift here; hand off to `plan-recovery`.

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
- Do not treat a mock, dry-run, fixture-only test, or uncalled API as a completed live path unless the prompt explicitly scoped it that way.

## Boundaries

- Do not execute review blocks; use `plan-reviewer`.
- Do not coordinate multiple subagents or canvases; use `plan-coordinator`.
- Do not run doctor repair, unblock, or resolve divergence; use `plan-recovery`.
- Do not create feedback blocks in the package; feedback is runtime state.
- If assigned work is actually review, feedback, blocked, diverged, or state repair, return it to the coordinator.

## Rules

- Do not edit `state.json` or `results/` directly unless using the Manual Fallback and reporting why CLI write-back is unavailable.
- Do not mark tasks verified manually; task implementation is aggregated by the Task Manager.
- Do not implement a diverged block as normal work until the plan is reconciled.
