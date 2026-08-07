---
name: genai-init
description: "Set a project up to run this development flow, and keep it set up — every dependency, convention and step definition the flow needs, brought into place by one command that is safe to run again. Reach for it when a project should start following this flow, on \"set this project up\", \"install the dev workflow\", \"initialise genai here\", after upgrading the plugin, or when a step definition looks out of date. Every item it touches is created, refreshed or preserved and the run says which, so an upgrade never overwrites what the project authored. Designing the graph for a particular piece of work, and driving it afterwards, are separate."
---

# Set this project up for the development flow

One command brings a project from nothing to runnable, and the same command upgrades it. There is no
separate install step and no order to remember.

Twenty-three steps under the workflow **`genai-feature`**. Each file in `assets/workflows/` is one
workflow and **its filename is the workflow name**, so a second process is a file rather than a
change to the script.

## Ask for the project's four check commands first [MUST]

The gates that run the project's own checks need to know what those commands are, and nothing can
guess them. Ask, then pass what you are told:

| Flag | What it runs | Which step gates on it |
|---|---|---|
| `--cmd-check-diff` | scoped checks — the changed packages **plus their reverse dependencies** | `genai.implement` |
| `--cmd-test` | the whole test suite | `genai.full-check` |
| `--cmd-lint` | static checks over the whole tree | `genai.full-check` |
| `--cmd-build` | the build | `genai.integrate` |

A project that genuinely has no such command says so: `--cmd-lint none` removes that gate, and the
run names the check left unguarded. **Never pass a command that trivially succeeds.** `true` and
`echo ok` satisfy the gate and prove nothing, and a gate that always passes is worse than a missing
one — it reads as enforcement.

A re-run needs none of these. They are read back out of the installed definitions, which is where
the gate reads them from too.

## Run it

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/genai-init/scripts/init.mjs \
  --cmd-check-diff 'pnpm -r --filter "...[origin/main]" test' \
  --cmd-test 'pnpm -r test' --cmd-lint 'pnpm -r lint' --cmd-build 'pnpm -r build'
```

Options: `--host claude|codex` for which host's driving skill to install, `--check-spec <path>` if
the completeness checker cannot be located, `--dry-run` to see the command sequence without writing.

## Three dispositions, and the run says which applied

| Disposition | Means | Examples |
|---|---|---|
| **created** | it was absent, so it was made | `CONTEXT.md`, `.flow/`, `openspec/` |
| **refreshed** | the toolkit ships it, so it carries the current version | the step definitions, the OpenSpec schema fork, the marked blocks |
| **preserved** | the project authored it, so it was left alone | a `CONTEXT.md` with entries, `openspec/config.yaml`, everything outside the markers |

That table is the reason running it twice is safe rather than a gamble. **`preserved` is a promise**
— it means the content was read and not rewritten, not that the item was skipped.

`AGENTS.md` and `CLAUDE.md` are the project's, so what goes into them is bounded by
`<!-- genai:begin -->` and `<!-- genai:end -->` and only that is replaced. An opening marker with no
closing one stops the run: repairing it means guessing where the block ends, and a wrong guess eats
something somebody wrote.

## What else it sets up

- **The OpenSpec schema fork.** The design template this flow expects carries eight sections beyond
  the stock one, and the completeness checker requires them. Without the fork a scaffolded design is
  missing every one of them and each change starts by adding headings by hand.
- **`fsx init` and `fsx skill install`.** The engine's own driving skill, which this one deliberately
  does not duplicate.
- **A seeded `CONTEXT.md`.** The glossary the naming checks read. Seeded once, never touched again.
- **Read-only git in `permissions.allow`.** Inspecting the repository changes nothing, and being
  asked about it trains people to approve without reading. Mutating commands are deliberately not
  added.

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
