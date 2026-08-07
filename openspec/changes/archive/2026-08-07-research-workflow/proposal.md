## Why

Research is the one kind of work this toolkit has an agent for and no process around. The
`researcher` subagent exists and is good at what it does — probe the real thing, report with
provenance — but who decides what to probe, how many probes there are, and whether the synthesis is
worth acting on is left to whoever happens to be driving. The previous toolkit routed research to a
prose pipeline: a description of a process a model had to interpret, which is the thing this whole
migration exists to replace.

The concrete cost is that nothing gates it. A synthesis can be written from two probes that both
missed the question, and there is no point at which someone is asked whether it answers what was
asked.

## What Changes

- A second workflow, **`genai-research`**, with five steps under graph variable `topic` and
  artifacts under `docs/research/{{vars.topic}}/`: clarify, plan, probe, synthesise, sign off.
- The installer picks it up with no change — workflows are files in `assets/workflows/`, which the
  change before last made true.

## Capabilities

### New Capabilities

- `research-flow`: taking a question that has not been made answerable yet through to a synthesis
  someone has ruled on, with the sub-questions visible and the probing separated from the conclusion.

### Modified Capabilities

None.

## Impact

| Affected | What |
|---|---|
| `skills/genai-init/assets/nodes/genai.research-*/` | five new steps |
| `skills/genai-init/assets/workflows/genai-research.yaml` | new workflow |
| `SKILL.md` | a second workflow and its variable |

**Known limitation, carried deliberately:** the probing step is one step, not N parallel ones. Two
instances of a step share one artifact locator, so N parallel probes would overwrite each other.
The step dispatches its own sub-probes internally, which costs the engine's visibility into each
one — they cannot be gated or reworked individually. Recorded rather than worked around.
