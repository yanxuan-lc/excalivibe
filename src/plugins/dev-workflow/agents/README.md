# Codex subagents — installing by hand

A Codex plugin **cannot bundle agents**. That is a platform constraint, not a choice, so the agents
compiled from `src/plugins/dev-workflow/agents/*.md` land here at the repo level instead of inside
`codex/plugins/dev-workflow/`.

## Install

```bash
cp codex/agents/*.toml ~/.codex/agents/      # personal, all projects
cp codex/agents/*.toml .codex/agents/        # or project-local
```

They become spawnable in a new thread. There is no update mechanism — re-run the copy after pulling.

## What each TOML carries

- `name` and `description` — the identity and the "when to use", which is what routing reads.
- `developer_instructions` — the full system prompt.
- `model` and `model_reasoning_effort` — a pinned model id and a role-sized effort.

The model ids are pinned deliberately, and they are **deliberately a different family from the
Claude side**. That difference is the entire carrier of a cross-family audit: a review by the same
lineage that produced the code shares its blind spots, so a same-family audit does not discharge the
requirement. Do not "align" the two sides.

Claude-only fields — `color`, `memory`, `tools` — are not carried over.

Roles described as read-only must not edit product or test code, but they still get a
workspace-writable sandbox, because they write reports.

## The nine roles

| Agent | Write scope | Role |
|---|---|---|
| `planner` | read-write | Author and refine the spec — the four contracts everything downstream builds against. |
| `arch-reviewer` | report only | Review the design *before* implementation, when the spec has a design surface worth reviewing. |
| `developer` | read-write | Implement a confirmed spec test-first. Never writes e2e tests, never reviews itself. |
| `e2e-author` | read-write | Author e2e test code from the spec's scenarios, plus the coverage manifest. Never touches product code. |
| `e2e-runner` | report only | Execute the suite, verify both the visible result and the database writes, write the acceptance report. |
| `code-reviewer` | report only | Review the diff before merge, two independent verdicts. Read-only toward code and tests alike. |
| `debugger` | read-write | Hypothesis-driven diagnosis; produces a diagnosis and a failing regression test. Does not apply the fix. |
| `release-coordinator` | read-write | Prepare a release — SemVer, sync points, notes, evidence. Never merges, pushes or publishes. |
| `researcher` | report only | Execution unit for research: investigate one sub-question, or synthesize collected findings. |

## The separations are the design

Several of these look like they could be merged, and every merge would cost something specific:

- Whoever **implements** does not **review**, because a producer grading their own work produces a
  grade rather than evidence.
- Whoever **authors tests** does not **write product code**, and whoever **runs** them edits
  neither. A suite that mirrors the implementation proves only that the code agrees with itself.
- Whoever **diagnoses** a bug does not **fix** it, so the test that proves the bug is not written by
  whoever needs it to pass.
- Whoever **prepares** a release does not **perform** it, because publishing needs consent and a
  subagent structurally cannot obtain it.

This file is generated from `src/plugins/dev-workflow/agents/README.md`. Do not edit it here.
