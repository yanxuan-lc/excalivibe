## Why

The flow has fourteen steps and one workflow called `genai`. Two things about that are now wrong.

**The name says nothing.** A second workflow for research is designed and scheduled, and `genai` as
a name cannot tell you which of the two you are looking at. Renaming later, once graphs reference
it, is more expensive than renaming now, when nothing is released.

**Two steps from the previous toolkit were never migrated, and both close a hole that is open right
now.** A core change goes from a brief straight into full design work with nobody confirming the
slice is the right one. And between implementation and code review, *nothing executes the product* —
the reviewer reads a diff whose tests may never have been run, because acceptance testing lives at
the delivery stage by design.

## What Changes

- Workflow `genai` is renamed `genai-feature`. Step ids are unchanged — they already carry a
  `genai.` prefix, and renaming them would churn every locator for nothing.
- `genai.intent-slice` is added: a person confirms the thin slice before design work starts.
- `genai.existing-suite` is added: the project's own test suite runs against the change, and its
  result is proven fresh against the code it ran on.
- `genai.implement` gains an optional `diagnosis` input, so a rescue diagnosis reaches the developer
  through the dispatch contract rather than by being found.
- The installer reads `assets/workflows/*.yaml` instead of a single `assets/workflow.yaml`, so a
  second workflow is a file rather than a code change. `--workflow` is dropped: the names come from
  the files.

## Capabilities

### New Capabilities

- `dev-flow-stages`: which stages a development flow puts a change through before it is reviewed,
  and what each one must establish before the next may start.

### Modified Capabilities

None.

## Impact

| Affected | What |
|---|---|
| `assets/nodes/genai.intent-slice/`, `assets/nodes/genai.existing-suite/` | new |
| `assets/nodes/genai.implement/node.yaml` | one optional input |
| `assets/workflow.yaml` → `assets/workflows/genai-feature.yaml` | moved and renamed |
| `scripts/install-flow.mjs` | iterates workflows; `--workflow` removed |
| `SKILL.md` | step count, workflow name, the two new steps |

**Not in this change:** the `command` gates that run the project's own check commands. Those need
the commands, and nothing asks for them until `genai-init` exists. Deferred there deliberately
rather than stubbed here.
