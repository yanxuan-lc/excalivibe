---
name: genai-flow
description: Start and drive one round of development from requirements to release — build the execution graph, dispatch each step to its executor, gate the result, and route the rework. Use when the ask is to begin building an agreed batch of requirements, to continue or check on a round already running, or to decide what to do when a step has exhausted its patience and the graph is suspended.
---

# Run one round

One round is one release: several requirements, several changes, **one version bump**. Seven
steps, fixed at graph creation.

```
genai.spec ──▶ genai.implement ──▶ genai.code-review ──▶ genai.merge ──▶ genai.archive ──▶ genai.accept ──▶ genai.release
                     ▲                    │
                     └────── reject ──────┘
```

The order is not arbitrary and the gates are not negotiable — `genai-guideline` has what each
step produces, what its gate requires, and why the last two sit in that order. This skill is
only the driving: create, dispatch, gate, route.

## Before starting

- `fsx check` reports seven step definitions and raises nothing at `severity: error`. **When it
  does, start the round — this is not a question to put to anyone.** Only when it does not is the
  project uninstalled, and then ask whether to run `/genai-init`; a fresh clone is always in that
  state, because `.flow/` is not tracked in git. Never hand-write the missing pieces.
- At least one requirement is in `ready`. Items still in `draft` are not ready to build, and
  the first step refuses to start without one.
- No other round is running. **The set of `active` requirements is this round's roster** —
  two live rounds make that meaningless and break the close-out check.

## Create the graph

Pick a branch name for the round and create the branch off the integration branch first. One
branch per round, not per change.

```bash
fsx graph create --name <round-label> --var branch=<branch-name> --inline '{
  "workflow": "genai-sprint",
  "intent": "<what this round is for>",
  "nodes": [
    { "id": "genai.spec#1",        "node": "genai.spec" },
    { "id": "genai.implement#1",   "node": "genai.implement" },
    { "id": "genai.code-review#1", "node": "genai.code-review" },
    { "id": "genai.merge#1",       "node": "genai.merge" },
    { "id": "genai.archive#1",     "node": "genai.archive" },
    { "id": "genai.accept#1",      "node": "genai.accept" },
    { "id": "genai.release#1",     "node": "genai.release" }
  ],
  "edges": [
    { "from": "genai.spec#1",        "to": "genai.implement#1",   "on": "pass" },
    { "from": "genai.implement#1",   "to": "genai.code-review#1", "on": "pass" },
    { "from": "genai.code-review#1", "to": "genai.merge#1",       "on": "pass" },
    { "from": "genai.code-review#1", "to": "genai.implement#1",   "on": "reject" },
    { "from": "genai.merge#1",       "to": "genai.archive#1",     "on": "pass" },
    { "from": "genai.archive#1",     "to": "genai.accept#1",      "on": "pass" },
    { "from": "genai.accept#1",      "to": "genai.release#1",     "on": "pass" }
  ]
}'
```

**Keep the name — it is what every later command takes as `-g`.** The name is only an alias, so
it plays no part in the graph's identity; `-g` equally accepts the graph id the create call
returns. Re-sending an identical create is safe: the same name over the same topology hands back
the graph that already exists rather than starting a second run against the same artifacts.

`--var branch` must be a new value every round. Graph identity is workflow plus variables plus
nodes plus edges, so reusing a branch name collides with the previous round and its artifact
signatures interfere.

## The loop

```bash
fsx next -g <round>                     # what can start
fsx dispatch '<node>#1' -g <round>      # the instruction (quote it — # starts a shell comment)
# hand the instruction to the executor the node names
fsx gate '<node>#1' -g <round>          # re-runs the checks and returns a verdict
```

**Every command names its graph.** There is no current graph and no default, so a command
without `-g` fails with `graph_ref_required` rather than acting on the wrong round. Take the
commands the engine hands back instead of assembling your own — `dispatch` returns `submit_with`
for the report, and most commands return `next_steps[].command`; both already carry the `-g`.

**`fsx next` answers a topology question, not an entry question.** It lists a node whose
upstream edges are satisfied, and `graph create` and `fsx status` do the same. Only
`fsx dispatch` evaluates entry rules, so a node listed as dispatchable can still be refused.

`fsx next --check-ready` closes that gap: it evaluates the entry rules too, drops a node that
cannot start out of `next`, and reports it under `not_ready` with the rule that refused it and
why. Use it when you want to know whether the round can move at all, not just where it would go
next.

That refusal is safe: **nothing is consumed** — no verdict, no patience, no attempt. Read the
reason it gives, make the condition true, and dispatch again. Retrying by itself never helps,
because the condition is recomputed from the world every single time.

Deliver the work yourself: spawn the subagent, or do it in this context when the node says
`main`. The engine states who should do it and verifies what comes back; it never delivers.

Three nodes say `main` — `genai.merge`, `genai.archive` and `genai.release`. All three need the
whole round in view: two resolve conflicts between changes, the third decides a version.

**Between attempts, only the rejection message travels.** Say what failed and where, not that
it failed.

## When a step is rejected

`reject` sends the work back to the same node; no edge is needed for that. The one edge that
matters is `genai.code-review → genai.implement`, because that rework crosses nodes.

Rejection is normal. Patience is 5, shared across the whole batch — a round that reworks three
changes once each has spent three of it. Read it from `patience.remaining`; when `fsx next`
marks a node `last_chance`, one attempt is left, and **that belongs in the instruction you hand
over** — after the gate is too late to try harder.

## When the graph suspends

Patience ran out. **This is a handoff, not a failure**: a path that keeps not working is for a
person to decide about. Bring them the rejection history and the options.

- Grant more budget: `fsx resume -g <round> --by <who>`. **`--by` is required** — a suspension
  lifted by a person has to say which person.
- Abandon the round: `fsx graph abort -g <round> --reason <why>`, then return every `active`
  requirement to `ready` and append a log line to each. **The engine does not do this** — an
  abandoned graph is not an abandoned requirement, and nothing else will put them back.

## New work found mid-round

**Never add it to this round.** The graph is fixed and `genai.spec` has already passed; a
passed node cannot be reopened.

Record it as a requirement instead, with `origin: agent`, `priority: P3`, and a first log line
naming what surfaced it. Steps report these through `deferred` (produce) or `findings`
(judge) — collect them at the end of the round and write them up in one pass. Individual steps
do not write to the requirements directory; seven writers on one todo list will eventually make
a mess of it.

## Assembly rules

The graph above is the whole design, but if it is ever edited, these are the ways to get a
graph that **passes creation and deadlocks at run time**:

- **Never route on `delegate`.** A `delegate` verdict with no matching edge hard-locks: the
  gate errors, the verdict is not recorded, and the node sits forever at dispatched-but-ungated.
  Nothing in this flow produces one.
- **Never draw a `pass` edge backwards.** Pass edges are dependencies; one pointing back turns
  the downstream node into a root and inverts the graph.
- **`reject` self-rework needs no edge.** A redundant self-edge is harmless; a missing
  cross-node reject edge is not.
- **Never route `genai.accept` back with `reject`.** It judges the whole batch, so a return
  edge reopens all of it. Letting it suspend and handing to a person is the intended behaviour.
- **Gate commands get no variables.** Not graph variables, not instance suffixes, no injected
  environment. Anything a check needs, it derives from `$PWD` or from git.

## What this does not do

- Does not explain what a step is gated on, or why — that is `genai-guideline`
- Does not write or clarify requirements — that is `genai-backlog`
- Does not install step definitions — that is `genai-init`
- Does not decide the version number; `genai.release` does, and records its reasoning
- Does not touch `tools/genai/*-check.sh`. **A round may not widen the gate it is measured by** —
  that is a requirement for a later round, and `genai-guideline` says how it gets made
