---
name: install-dev-workflow
description: "Install this development flow — its step definitions and their gates — into a project that already runs the flow-scratch engine, so the pipeline is driven by a graph the script schedules rather than by prose the model interprets. Reach for it when someone wants the orchestrated flow set up here, on \"install the dev workflow\", \"set up the pipeline\", \"add the flow steps to this project\", \"wire up the agents into a workflow\", or right after `fsx init` on a project that should follow this flow. It installs and refreshes definitions; designing the graph for a particular piece of work, and driving it afterwards, are separate — the engine's own skill covers those."
---

# Install the development flow

This installs the flow's step definitions and their gates into a project's `.flow/`. After it, the
project can be driven by a graph the engine schedules instead of by a description of a process that
a model has to interpret.

Twenty-three steps under the workflow **`genai-feature`**. Each file in the installer's
`assets/workflows/` directory is one workflow and **its filename is the workflow name**, so a second
process is a file rather than a change to the installer.

## Prerequisites, in order

1. **The engine is installed** — `fsx --version` answers. It is a separate package; this skill
   ships definitions, not the runtime.
2. **The project has been initialised** — `fsx init` has been run, so `.flow/` exists. This skill
   never creates that skeleton; conflating "the engine is set up" with "our flow is installed"
   makes a failure in one look like a failure in the other.
3. **The driving instructions are installed** — `fsx skill install --target <your host>`. That is
   the engine's own skill and teaches how to drive the loop. This skill does not duplicate it: one
   copy of that knowledge, owned by the engine that has to stay in step with it.

## Run it

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/install-dev-workflow/scripts/install-flow.mjs
```

Idempotent — run it again after an upgrade to refresh the definitions. Options: `--check-spec
<path>` if the completeness checker cannot be located automatically, `--dry-run` to see the command
sequence without writing.

**Upgrading from an install that predates the `genai-feature` name** leaves a stale `genai` workflow
in `.flow/workflows/`. The installer does not delete it: removing a workflow a graph might still
reference is not a call an installer should make silently. Check `fsx graph list` for anything
running against it, then delete the file.

## Everything goes through the engine's command surface

The installer never copies YAML into `.flow/` directly. It runs `fsx workflows new`, `fsx nodes
new`, `fsx nodes edit --file`, `fsx nodes brief --file`, `fsx workflows set`.

That is not ceremony. The constraints on a definition file live in the engine's loader, so writing
the file directly means relying on a contract nothing enforces. Going through the commands buys
three things a copy cannot: **validation before the write, atomicity** (a rejected definition
leaves the old file untouched), and **in-flight protection** — editing a definition that a running
graph references is refused, with the graphs named.

That refusal is correct and the installer does not override it. A graph mid-run has already
dispatched work against the definition as it was; swapping it underneath produces a run whose
history describes steps that no longer exist. Finish or abort the graph, then install.

## What gets installed

Twenty-three steps. An executor declares a **protocol** — how the instruction gets handed over — and
whatever that protocol needs to identify the recipient. Twelve steps do not go to a subagent, each for
a structural reason:

| Step | Executor | Why |
|---|---|---|
| `genai.brief` | `protocol: main` | it is a conversation with the user, and a subagent cannot talk to one |
| `genai.existing-suite` | `protocol: main` | running the command the project's README names carries no method of its own; a subagent here is a context switch that buys nothing |
| `genai.intent-slice` | `protocol: human`, `channel: stdout` | a person commits to the slice before design work is spent against it |
| `genai.arch-gate` | `protocol: human`, `channel: stdout` | a person signs; the engine records the decision and signs it into a compliant report |
| `genai.deliver` | `protocol: human`, `channel: stdout` | consent to publish is not something a program gives on someone's behalf |
| `genai.changes` · `genai.integrate` · `genai.full-check` · `genai.cross-family-audit` · `genai.merge` · `genai.archive` | `protocol: main` | a subagent must not push to a shared branch; main can obtain consent, a subagent cannot |
| the remaining eleven | `protocol: subagent`, `name: …` | one role each, with its own boundaries |

`channel: stdout` is the only channel the engine defines, and it means the driving agent's ordinary
output to the user *is* the notification — not a slot waiting to be filled.

The gates are the load-bearing part. Three patterns recur, and they are worth recognising when
reading a definition:

- **`outputs_present`** — the declared artifact is on disk. Cheapest check, so it goes first.
- **`signature_changed`** — this round's submission differs from last round's. Identical means the
  feedback was never acted on, and re-reading it will not produce a new result.
- **`signature_match`** — what a judging step recorded as "the version I approved" still equals
  what exists now. This is what makes "reviewed, then the code changed" a caught condition instead
  of a silent one. It passes on first evaluation, when there is nothing recorded yet.

## Every graph names what it is for — a change, or a batch

```bash
fsx graph create --file graph.json --var change=add-user-export   # one change
fsx graph create --file graph.json --var sprint=2026-w32          # a batch of them
```

Two graph variables, and **a graph supplies only the one its steps need** — the requirement and
implementation steps locate artifacts under `openspec/changes/{{vars.change}}/`, the delivery steps
under `genai/sprints/{{vars.sprint}}/`. Supplying a variable nothing references is refused
(`graph_var_unused`), which is almost always a sign the graph mixed stages that do not belong
together.

**A delivery step never declares an input from a per-change step.** A batch covers several changes
and the variable holds one value, so which changes are in the batch is data — the roster
`genai.changes` produces — not a variable. The engine substitutes it before anything is dispatched or measured:
the executor is handed `openspec/changes/add-user-export/genai/a11y-report.md`, a path rather than a
pattern.

Leaving it out is refused at `graph create` — `graph_var_missing`, naming each artifact that wanted
it. That refusal is the whole enforcement and it is sufficient, because nothing downstream can run
against a locator that never bound.

**Two changes may be in flight at once.** Each graph binds its own value, so a freshness gate in one
measures only that change's artifacts and does not move when the other is edited.

An `--intent` is still worth passing — it renders above the artifact list and says what the run is
for — but it is now context for a reader, not the thing that tells an executor where to write.

## Verify

```bash
fsx check                    # every definition loads and the whitelist is consistent
fsx nodes -w genai-feature   # the twenty-three steps, from the engine rather than from this page
```

The installer prints the executor each step requires. **Nothing validates those names** — the
engine does not own subagent definitions and cannot resolve them, so a renamed or uninstalled agent
surfaces only when a dispatch fails. Check the list against what is actually installed, and note
that on hosts where agents are not bundled with plugins they need copying into place separately.

## What this skill does not do

- **Design the graph.** Which steps a particular piece of work needs, and how they connect, is
  decided per piece of work — that is the judgement the engine deliberately leaves to a model.
- **Drive the loop.** Dispatching, submitting reports, evaluating gates: the engine's own skill.
- **Set up the engine.** `fsx init` and `fsx skill install` are prerequisites, not steps here.
