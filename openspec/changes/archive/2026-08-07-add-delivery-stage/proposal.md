## Why

Work that finishes has nowhere to go. The flow takes a change from a brief to a release dossier and
stops — `genai.release-prep` explicitly performs no git mutation, and nothing downstream of it
exists. Whatever the flow produces is left for someone to land by hand, outside any gate.

That is the largest remaining gap against the process this flow replaced, which had ten steps for
it: freeze the batch, establish which changes are ready, integrate, run the full suite on the
integrated tree, audit across ends, run acceptance once, merge, publish, archive.

It is also where the engine's `effect` kind finally gets used. Every step this plugin ships so far
is `produce`, `judge` or `verify` — all reversible. The acts that are not reversible have simply
been absent, and with them the `idempotency_key` that answers "has this already been published" on
a resumed run.

## What Changes

- Seven steps are added, under graph variable `sprint`, with artifacts under
  `genai/sprints/{{vars.sprint}}/`: `genai.changes`, `genai.integrate`, `genai.full-check`,
  `genai.cross-family-audit`, `genai.merge`, `genai.deliver`, `genai.archive`.
- Four of them are **BREAKING** in kind rather than in interface: `integrate`, `merge`, `deliver`
  and `archive` are `effect` steps, the first in this plugin. They mutate things outside the
  working tree and their reports carry idempotency keys.
- `genai.e2e-run` moves from the implementation stage to this one. Acceptance runs once, on the
  integrated tree, not per change. Its freshness gate changes from the change's code to the
  integration commit.
- `genai.release-prep` moves too, and gains the inputs it always needed.

## Capabilities

### Modified Capabilities

- `dev-flow-stages`: adds what a flow must establish before work is landed and released, and the
  rule that a stage covering a batch cannot reference an individual change's artifacts.

### New Capabilities

None — this extends the stage contract rather than introducing a separate one.

## Impact

| Affected | What |
|---|---|
| `assets/nodes/genai.{changes,integrate,full-check,cross-family-audit,merge,deliver,archive}/` | new |
| `assets/nodes/genai.e2e-run/node.yaml` + brief | rewired to the integration commit, artifact moves to the sprint directory |
| `assets/nodes/genai.release-prep/node.yaml` + brief | artifact moves to the sprint directory, inputs added |
| `assets/workflows/genai-feature.yaml` | seven entries |
| `SKILL.md` | step count, the two graph variables, the effect steps |

**Not in this change:** the `command` gates that run the project's own check commands.
`genai.full-check` is where they belong, and they need the commands, which nothing collects until
`genai-init`. The step ships report-based and gains its command gates there.
