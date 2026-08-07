---
description: "Install this development flow — its step definitions and their gates — into a project that already runs the flow-scratch engine, so the pipeline is driven by a graph the script schedules rather than by prose the model interprets. Reach for it when someone wants the orchestrated flow set up here, on \"install the dev workflow\", \"set up the pipeline\", \"add the flow steps to this project\", \"wire up the agents into a workflow\", or right after `fsx init` on a project that should follow this flow. It installs and refreshes definitions; designing the graph for a particular piece of work, and driving it afterwards, are separate — the engine's own skill covers those."
description-claude: "Install this development flow — its step definitions and their gates — into a project that already runs the flow-scratch engine, so the pipeline is driven by a graph the script schedules rather than by prose the model interprets. Reach for it when someone wants the orchestrated flow set up here, on \"install the dev workflow\", \"set up the pipeline\", \"add the flow steps to this project\", \"wire up the agents into a workflow\", or right after `fsx init` on a project that should follow this flow. It installs and refreshes definitions; designing the graph for a particular piece of work, and driving it afterwards, are separate — the engine's own skill covers those."
description-codex: "Install this development flow — its step definitions and their gates — into a project that already runs the flow-scratch engine, so the pipeline is driven by a graph the script schedules rather than by prose the model interprets. Reach for it when someone wants the orchestrated flow set up here, on \"install the dev workflow\", \"set up the pipeline\", \"add the flow steps to this project\", \"wire up the agents into a workflow\", or right after `fsx init` on a project that should follow this flow. It installs and refreshes definitions; designing the graph for a particular piece of work, and driving it afterwards, are separate — the engine's own skill covers those."
name: install-dev-workflow
command: true
argument-hint: "[optional: --workflow <name>]"
allowed-tools: Bash, Read
---

# Install the development flow

This installs fourteen step definitions and their gates into a project's `.flow/`, under the
workflow name `genai`. After it, the project can be driven by a graph the engine schedules instead
of by a description of a process that a model has to interpret.

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
node ${PLUGIN_ROOT}/skills/install-dev-workflow/scripts/install-flow.mjs
```

Idempotent — run it again after an upgrade to refresh the definitions. Options: `--workflow <name>`
to install under a different name, `--check-spec <path>` if the completeness checker cannot be
located automatically, `--dry-run` to see the command sequence without writing.

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

Fourteen steps. Three executors are not subagents, and each for a structural reason:

| Step | Executor | Why |
|---|---|---|
| `genai.brief` | `main` | it is a conversation with the user, and a subagent cannot talk to one |
| `genai.arch-gate` | `human` | a person signs; the engine records the decision and signs it into a compliant report |
| the other twelve | a subagent | one role each, with its own boundaries |

The gates are the load-bearing part. Three patterns recur, and they are worth recognising when
reading a definition:

- **`outputs_present`** — the declared artifact is on disk. Cheapest check, so it goes first.
- **`signature_changed`** — this round's submission differs from last round's. Identical means the
  feedback was never acted on, and re-reading it will not produce a new result.
- **`signature_match`** — what a judging step recorded as "the version I approved" still equals
  what exists now. This is what makes "reviewed, then the code changed" a caught condition instead
  of a silent one. It passes on first evaluation, when there is nothing recorded yet.

## Every graph names the change it is for

```bash
fsx graph create --file graph.json --var change=add-user-export
```

Every artifact these steps declare sits under `openspec/changes/{{vars.change}}/`, so the value is
the change directory's name. The engine substitutes it before anything is dispatched or measured:
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
fsx nodes -w genai           # the fourteen steps, from the engine rather than from this page
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
