---
name: plan-coordinator
description: Coordinate end-to-end PlanWeave execution as the main agent by inspecting status, assigning work to subagents, routing review and recovery, and keeping the plan loop moving. Use when orchestrating a full PlanWeave plan, managing multiple agents, continuing execution, or deciding what should run next.
---

# Plan Coordinator

Use this skill as the main agent/controller for a PlanWeave package. Do not implement block work yourself unless the task is small enough to run with `plan-runner` directly.

## Quick Start

1. Resolve the CLI entry. Use `<pw> help work`, `<pw> help submit`, and `<pw> help recovery` for command syntax.
2. Inspect current work, status, claim hints, warnings, and any active feedback.
3. Decide whether to assign implementation/check work, review work, feedback work, or recovery work.
4. Give each subagent exactly one work item, its rendered prompt path or content, expected artifact, submit command, and validation expectations.
5. Collect reports/results, submit or verify submission, then re-check status.
6. Continue until the plan is complete, genuinely blocked, or diverged and needs user/plan reconciliation.

## Routing

- Use `plan-runner` for one implementation/check block.
- Use `plan-reviewer` for one review gate.
- Use `plan-recovery` for doctor findings, stale current refs, orphan results, state/index drift, blocked/diverged work, or submit retry confusion.
- If no subagents are available and the work is small, run a single implementation/check block with `plan-runner`.
- Do not send review gates to implementation agents.
- Do not send recovery work to normal implementation agents.

## Coordinator Loop

1. Check current and status before claiming.
2. Prefer explicit claims when assigning known refs; use automatic claim only when PlanWeave should choose.
3. Preview parallel claims before dispatching a batch.
4. For each assigned item, record ref, task, block type, prompt source, submit command, and agent owner.
5. Keep only active subagents running; close completed agents after report submission.
6. After every submit, re-run status/current before assigning more work.
7. If `none`, compare parallel and sequential claimability before declaring the plan idle.
8. If `blocked`, `diverged`, stale, or inconsistent, stop dispatching dependent work and route to recovery.

## Subagent Packet

Every subagent handoff should include:

- block ref or feedback id.
- block type and expected skill: `plan-runner`, `plan-reviewer`, or `plan-recovery`.
- rendered prompt path/content and source prompt paths when relevant.
- exact report/result artifact expected.
- submit command or instruction to return the artifact to the coordinator.
- validation commands or observable completion criteria.
- scope boundaries and files not to touch.

## Review And Feedback

- Review gates are sequential control points.
- A `needs_changes` review creates runtime feedback work; route feedback handling deliberately and then return to review.
- Do not mark review as passed from implementation confidence alone.
- Do not resubmit resolved feedback as current work.
- If review cycles are exhausted or contradictory, route to `plan-recovery` before continuing.

## Recovery Boundary

- Use `plan-recovery` before running repair commands or editing package/state files.
- Keep plan defects separate from PlanWeave toolchain defects.
- Do not hide partial success, duplicate runs, stale current refs, or orphan artifacts.
- If package changes are needed to resolve divergence, pause dependent execution until the package is reconciled.

## Completion Report

When stopping, report:

- completed refs and submitted artifacts.
- open refs, blockers, or divergence.
- validation run.
- recovery actions taken.
- whether the next action is claim, review, recovery, import/update plan, or user decision.
