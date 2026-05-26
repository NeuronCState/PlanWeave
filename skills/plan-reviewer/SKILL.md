---
name: plan-reviewer
description: Execute a single PlanWeave review gate and produce a structured pass or needs_changes review result. Use when assigned a review block, asked to review implementation output, or asked to create review-result.json for PlanWeave.
---

# Plan Reviewer

Use this skill for one review block. Do not implement fixes, coordinate the whole plan, or repair runtime state.

## Quick Start

1. Resolve the CLI entry and use `<pw> help submit` for exact submit syntax.
2. Claim or accept the assigned review ref; render the review prompt.
3. Read the review prompt, implementation reports, changed files, referenced source files, tests, and acceptance criteria.
4. Decide `passed` or `needs_changes`.
5. Write `review-result.json` and submit it, or return it to the coordinator.

## Review Scope

- Review only the assigned gate and its upstream implementation/check blocks.
- Verify the work against task acceptance, prompt instructions, contract changes, and validation evidence.
- Search producers and consumers when reviewing schema, API, CLI, events, prompt I/O, file formats, storage, or state semantics.
- Treat missing runtime use, missing caller, mock-only behavior, dry-run-only paths, and fixture-only tests as real findings.
- Do not require review for unrelated cleanup outside the assigned scope.

## Verdict Rules

- Use `passed` only when acceptance is met and validation evidence is adequate for the block risk.
- Use `needs_changes` when implementation is incomplete, unsafe, unverifiable, out of scope, or contract-breaking.
- Do not encode blocked, diverged, or tool failure as a review verdict; send those to `plan-recovery`.
- Do not make code changes in a review block unless the prompt explicitly asks for review+fix.

## Result Shape

```json
{
  "reviewBlockRef": "T-001#R-001",
  "taskId": "T-001",
  "verdict": "needs_changes",
  "content": "Concrete feedback for the implementation agent."
}
```

For `passed`, explain the evidence. For `needs_changes`, make feedback actionable and scoped to the implementation/check blocks that must change.

## Review Checklist

- Goal and acceptance covered.
- Core object lifecycle complete.
- Producer/consumer contracts consistent.
- Failure paths handled when relevant.
- Prompt requirements respected.
- Validation commands or observable evidence exist.
- No mock, dry-run, fixture-only, or uncalled path is presented as live completion.

## Report To Coordinator

Return:

- review ref and verdict.
- review-result path or submitted result.
- key evidence checked.
- findings or pass rationale.
- any recovery issue that should stop the loop.
