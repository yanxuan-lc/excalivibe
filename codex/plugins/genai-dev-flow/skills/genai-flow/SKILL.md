---
name: genai-flow
description: Start and drive one round of development from requirements to release — build the execution graph, dispatch each step to its executor, gate the result, and route the rework. Use when the ask is to begin building an agreed batch of requirements, to continue or check on a round already running, or to decide what to do when a step has exhausted its patience and the graph is suspended.
---

# Run one round

One round is one release: several requirements, several changes, **one version bump**. The graph is
fixed once created — but *which* steps it contains is decided before that, and the list to decide
from is `fsx nodes -w genai-sprint`. That listing is the only authority on what steps exist, and it
carries a `description` on every step whose inclusion is a real choice: which ones a lighter round
may leave out, and which ones look droppable and are not. Read it before assembling; do not work
from a count written down anywhere, including here.

```
                                                                    ┌──▶ genai.implement ──┬──▶ genai.code-review ──┐
genai.spec ──▶ genai.spec-review ──▶ genai.write-arch-docs ──▶ genai.arch-decision         │                        ├──▶ genai.merge ──▶ …
                                                                    └──▶ genai.e2e-author ─┴──▶ genai.e2e ──────────┘

… ──▶ genai.merge ──▶ genai.archive ──▶ genai.update-project-docs ──▶ genai.accept ──▶ genai.release
```

`genai.update-project-docs` runs last of everything that changes the repository, and that is the
whole of why it is there rather than earlier. Every step before it can still be reworked — the
implementation goes back on a review or a failed scenario, and the merge itself can change the
result — so documentation written any earlier describes a state that has not settled, and gets
rewritten each time one does. Here nothing upstream can move under it: the code is merged, the
specs are folded, and what it writes is true of the release.

**Nothing reviews it, and that is the accepted cost.** Placing it before the code review would put
it inside a diff someone reads, but only by pinning it to a state still being reworked — and the
review's own subject is code, so what it would add is closer to a signature than to a reading.

`genai.arch-decision` is the round's **only human step**, and everything before it exists to make
that one ruling cheap: a person settles the structure while changing it is still an edit to a
document nobody has built against. It suspends and waits when nobody is there — an unattended run
that moved past it would have removed the step rather than passed it.

**Removing the step and passing it unattended are different things, and only one of them is
available.** A round that settles no structure — a fix, a wording change, a field on an interface
that is already agreed — has nothing to put in front of a person, and it says so by leaving both
this step and `genai.write-arch-docs` out of the graph. `genai.implement` then reads its premise on
the ruling as `absent`: no step in this graph concluded anything, so there is no conclusion to keep
fresh. That is the one shape where the premise protects nothing, it is chosen once and in the open
when the graph is submitted, and `fsx graph create` prints a notice for every premise that will fall
that way. What stays impossible is the thing the suspension exists to prevent: a graph that contains
the ruling and gets past it without one.

The fork after it is the design: **the tests and the code are built in parallel from the same
approved spec**, and `genai.e2e-author` is wired to `genai.spec` rather than to the commits so that
its instruction has no path to the implementation in it. A suite derived from the code passes by
construction. Then two independent judgements — a review and an acceptance run — meet at the merge.

**The wiring is the whole of the separation, and the working tree is shared.** Both steps run in it
at once, so the implementation is on disk while the suite is being written; `genai-guideline` has what
was measured about that and what the author is asked to record instead. If a round needs the
separation to be mechanical rather than instructed, dispatch `genai.e2e-author` in a worktree checked
out at the integration branch and copy the suite back before `genai.e2e` runs.

Five rework edges, and they are where the routing lives:

| From | On | To | Why there |
|---|---|---|---|
| `genai.spec-review` | reject | `genai.spec` | a design goes back while changing it is still one edit |
| `genai.arch-decision` | reject | `genai.spec` | the same destination, for the same reason. A condition attached to an approval is a change to the design, so `conditional` routes here too rather than counting as a pass |
| `genai.code-review` | reject | `genai.implement` | that edit has become a rewrite, and this is what it costs |
| `genai.e2e` | reject | `genai.implement` | the product failed a scenario. Also every case where the acceptance run itself did not deliver |
| `genai.e2e` | delegate | `genai.e2e-author` | a **test** failed, not the product. `delegate` spends no patience and leaves the step `delegated` rather than `rejected` — the work moved, the graph is not stalled |

The asymmetry between the first two is the reason the design is reviewed at all. The asymmetry
between the last two is the verification triangle: the developer never repairs a test and the author
never touches product code, so a failure has to be classified before it can be routed.

The order is not arbitrary and the gates are not negotiable — `genai-guideline` has what each
step produces, what its gate requires, and why the last two sit in that order. This skill is
only the driving: create, dispatch, gate, route.

## Before starting

- `fsx nodes -w genai-sprint` returns the step definitions, and `fsx check` raises nothing at
  `severity: error`. **When both hold, start the round — this is not a question to put to anyone.**
  Only when they do not is the project uninstalled, and then ask whether to run `/genai-init`; a
  fresh clone is always in that state, because `.flow/` is not tracked in git. Never hand-write the
  missing pieces. Read `fsx check`'s `problems[]`, never its counts: it counts every definition on
  disk, including the `nodes/task/` template `fsx init` scaffolds, so its totals always exceed what
  this workflow admits. Scoping the question is what `-w genai-sprint` is for.
- The application under test can be started, and `tools/genai/e2e.json` says how to recognise it.
  Nothing needs it until `genai.e2e`, and that step refuses to start rather than testing whatever
  else happens to be listening — so this is worth confirming at the top of a round instead of an
  hour into one. **If the file is missing, that is a question for the user** — a URL and a marker only
  this app returns — and not something to fill in on their behalf: a round may not write the file it is
  measured against. Ask now if the answer is not obvious; the round can proceed either way until that
  step.
- At least one requirement is in `ready`. Items still in `draft` are not ready to build, and
  the first step refuses to start without one.
- No other round is running. **The set of `active` requirements is this round's roster** —
  two live rounds make that meaningless and break the close-out check.

## Create the graph

Pick a branch name for the round and create the branch off the integration branch first. One
branch per round, not per change.

**The call below is the full round, and it is a worked example rather than a form to submit
unchanged.** A lighter round leaves steps out — the ones `fsx nodes` marks optional, and only those.
Optional there is a mechanical property rather than a preference: either nothing downstream premises
on that step, or the premise that does routes `absent` to ready, and `fsx graph create` answers with
one notice per premise that will fall that way — so what a shape gives up is on the record at the
moment it is chosen. The steps with no such line are load-bearing in a way the graph cannot express.
`genai.archive` is the sharp one: leave it out with `genai.accept` still in, and the acceptance step
is refused entry forever by a check that writes no event and spends no patience. So decide what to
include from the listing's `description` lines, and read the assembly rules at the end of this skill
before changing any edge.

```bash
fsx graph create --name <round-label> --var branch=<branch-name> --inline '{
  "workflow": "genai-sprint",
  "intent": "<what this round is for>",
  "nodes": [
    { "id": "genai.spec#1",            "node": "genai.spec" },
    { "id": "genai.spec-review#1",     "node": "genai.spec-review" },
    { "id": "genai.write-arch-docs#1", "node": "genai.write-arch-docs" },
    { "id": "genai.arch-decision#1",   "node": "genai.arch-decision" },
    { "id": "genai.implement#1",       "node": "genai.implement" },
    { "id": "genai.e2e-author#1",      "node": "genai.e2e-author" },
    { "id": "genai.code-review#1",     "node": "genai.code-review" },
    { "id": "genai.e2e#1",             "node": "genai.e2e" },
    { "id": "genai.merge#1",           "node": "genai.merge" },
    { "id": "genai.archive#1",         "node": "genai.archive" },
    { "id": "genai.update-project-docs#1", "node": "genai.update-project-docs" },
    { "id": "genai.accept#1",          "node": "genai.accept" },
    { "id": "genai.release#1",         "node": "genai.release" }
  ],
  "edges": [
    { "from": "genai.spec#1",            "to": "genai.spec-review#1",     "on": "pass" },
    { "from": "genai.spec-review#1",     "to": "genai.write-arch-docs#1", "on": "pass" },
    { "from": "genai.spec-review#1",     "to": "genai.spec#1",            "on": "reject" },
    { "from": "genai.write-arch-docs#1", "to": "genai.arch-decision#1",   "on": "pass" },
    { "from": "genai.arch-decision#1",   "to": "genai.implement#1",       "on": "pass" },
    { "from": "genai.arch-decision#1",   "to": "genai.e2e-author#1",      "on": "pass" },
    { "from": "genai.arch-decision#1",   "to": "genai.spec#1",            "on": "reject" },
    { "from": "genai.implement#1",       "to": "genai.code-review#1",     "on": "pass" },
    { "from": "genai.implement#1",       "to": "genai.e2e#1",             "on": "pass" },
    { "from": "genai.e2e-author#1",      "to": "genai.e2e#1",             "on": "pass" },
    { "from": "genai.code-review#1",     "to": "genai.merge#1",           "on": "pass" },
    { "from": "genai.code-review#1",     "to": "genai.implement#1",       "on": "reject" },
    { "from": "genai.e2e#1",             "to": "genai.merge#1",           "on": "pass" },
    { "from": "genai.e2e#1",             "to": "genai.implement#1",       "on": "reject" },
    { "from": "genai.e2e#1",             "to": "genai.e2e-author#1",      "on": "delegate" },
    { "from": "genai.merge#1",           "to": "genai.archive#1",         "on": "pass" },
    { "from": "genai.archive#1",         "to": "genai.update-project-docs#1", "on": "pass" },
    { "from": "genai.update-project-docs#1", "to": "genai.accept#1",      "on": "pass" },
    { "from": "genai.accept#1",          "to": "genai.release#1",         "on": "pass" }
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

### A lighter round

Two rules cover every shape between the full round and the smallest one:

- **Bridge what the removal disconnects**, and the reason is the opposite of the obvious one. A step
  takes its edges with it, and a step left with no incoming edge is not stalled — it is a **root**,
  dispatchable from the moment the graph exists. Drop the design review without reconnecting and
  `genai.write-arch-docs` can be dispatched before `genai.spec` has produced anything, reading
  whatever happens to be under `openspec/changes/`: the previous round's spec, or nothing.
  `genai.spec → genai.spec-review → genai.write-arch-docs` has to become
  `genai.spec → genai.write-arch-docs`. **Read `next` on the create response to check it**: any step
  other than `genai.spec` listed there is a step whose dependency left with an edge. Rework edges go
  too — dropping `genai.code-review` drops `code-review → implement` on `reject` with it.
- **Pairs leave together, and nothing enforces it.** `genai.write-arch-docs` with
  `genai.arch-decision`, `genai.e2e-author` with `genai.e2e`. Each pair is one step that produces
  something and one step that is its only reader, and half a pair creates, dispatches and passes:
  the ruling kept alone asks a person to approve documents nobody wrote, and the acceptance run kept
  alone rejects on a manifest it cannot read — a setup problem, charged to the round's patience.
  Neither is a deadlock, which is exactly why they have to be a habit rather than a check.

The smallest round that still ships — a fix with no structural choice in it, no interface moved,
nothing about how the thing is used changed:

```
nodes  genai.spec · genai.implement · genai.merge · genai.archive · genai.accept · genai.release
edges  spec→implement · implement→merge · merge→archive · archive→accept · accept→release
```

Four premises fall to `absent` in that shape and the create call says so four times. Read those
lines as the round's own account of what it is not doing: nobody ruled on the structure, no reading
independent of the developer saw the diff, and nothing beyond the project's own suite ran.
`genai.implement` and `genai.merge` still gate on the build and the coverage floors, twice over on
two different trees, and that is the whole of what stands between this work and the integration
branch. It is the right shape for a fix whose correctness fits in a diff one person can read, and
the wrong shape for everything else — the listing's `description` lines say which is which per step.

## The loop

```bash
fsx next -g <round>                     # what can start
fsx dispatch '<node>#1' -g <round>      # the instruction (quote it — # starts a shell comment)
# hand the instruction to the executor the node names
fsx gate '<node>#1' -g <round>          # re-runs the checks and returns a verdict
```

**The instruction is kept for you.** Every dispatch writes the rendered text under the run
directory and returns `instruction_path` beside `draft_path`; read that file rather than saving the
`prompt` field by hand. It is never re-rendered, so it is what that attempt was actually told, and it
survives the working tree moving on. It disappears only if `.flow/runs/` is cleaned, which costs a
record and no state — the event log is the scheduling truth.

**`fsx preview` is still not a way to read a dispatched instruction.** Preview renders the **next**
attempt, so after `genai.spec#1` has been dispatched once it renders attempt 2 — and its `draft_path`
points into attempt 2's directory. Relay that and the executor writes its report where nothing will
look for it; `fsx report submit` then says `report_missing` about attempt 1, and the error names a path
that gives no hint the fault was in the relaying. Preview answers "what would this attempt be told if
dispatched now"; `instruction_path` answers "what was it told".

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
because an applicable condition is recomputed from the world every single time.

**Not every entry rule applies to every dispatch, and a skipped one is not a passed one.** A rule
declares a `when`, and rework skips the rules a step's own execution invalidates — `genai.spec`
stops asking for a `ready` backlog item once it has claimed them all, `genai.archive` stops asking
for an unfolded change once it has folded them. Read that as "not asked this time", never as
"satisfied": the fact it tests may well be false, and on this dispatch that is the intended answer.

**Both commands tell you which rules were skipped, and they agree.** `fsx dispatch` returns
`ready_skipped`, and `fsx next --check-ready` carries the same list on each node in `next[]` — rule id
plus the `when` that excluded it. So a node reported as able to start still says how much of its entry
condition was not asked, which is what makes `--check-ready` usable as "can this round move at all".
(Inside `not_ready[]` the field is named `skipped`; the two names never appear on one object.)

Deliver the work yourself: spawn the subagent, or do it in this context when the node says
`main`. The engine states who should do it and verifies what comes back; it never delivers.

The nodes that say `main` are `genai.merge`, `genai.archive` and `genai.release` — check the
listing rather than this line. All of them need the whole round in view: two resolve conflicts
between changes, the third decides a version.

**Between attempts, only the rejection message travels.** Say what failed and where, not that
it failed.

## When a step is rejected

`reject` sends the work back to the same node; no edge is needed for that. The ones that matter are
the four in the table above, because that rework crosses nodes.

**A cross-node reject activates both ends.** `genai.e2e` rejecting makes `genai.implement`
dispatchable as well as itself, and for a product failure that is exactly right. For the cases where
the acceptance run is the thing at fault — a missing report, a scenario nobody ran, no database
evidence behind a pass — there is nothing for the developer to do, and the rejection message says so.
Dispatch what the message names; `fsx next` answers a topology question, not an assignment.

Rejection is normal. **Patience is a number the project sets, not a constant** — declared in
`.flow/config.yaml` and in the workflow's `defaults`, shipped at 5 and meant to be tuned against real
runs. Read this round's from the response rather than from memory: `patience.initial` is what this
project set, `patience.remaining` is what is left. **It belongs to the step, not to the round, and it
resets when that step passes** — the number bounds how many times one step may be rejected *in a row*,
so a round that reworks three different steps once each has spent nothing that adds up, and a step
rejected four times and then passing is back at full. Plan the risk per step; there is no batch
budget to run down.

**That arithmetic holds only while every rejection is an ordinary one.** `patience.consumed_now` says
what *this* gate call took: `0` for a pass, a waiver, a delegation or a replay; `1` for an ordinary
rejection; and **the whole remaining budget at once** when the engine finds the attempt stalled or a
cache hit, because it has judged that looking again cannot produce a different result. So one attempt
can take a round from four left to suspended, and "one rework costs one" is a planning assumption, not
a rule. When `fsx next` marks a node `last_chance`, one attempt is left, and **that belongs in the
instruction you hand over** — after the gate is too late to try harder.

## When the graph suspends

Patience ran out. **This is a handoff, not a failure**: a path that keeps not working is for a
person to decide about. Bring them the rejection history and the options.

**Read `consumed_now` on the rejection that suspended it before you offer those options.** Equal to
the whole remaining budget means the engine stopped because a repeat was pointless — a stalled attempt
or a cache hit — and more patience buys nothing until something about the attempt changes. Drained one
at a time means the work really was moving and simply did not arrive; more budget is a reasonable ask.
Say which of the two it was. (The same distinction is in the gate diagnostics as `no_progress` /
`cache_hit`; `consumed_now` is the one number that does not need them parsed.)

- Grant more budget: `fsx resume -g <round> --by <who>`. **`--by` is required** — a suspension
  lifted by a person has to say which person.
- Abandon the round: `fsx graph abort -g <round> --reason <why>`, then return every `active`
  requirement to `ready` and append a log line to each. **The engine does not do this** — an
  abandoned graph is not an abandoned requirement, and nothing else will put them back.

## New work found mid-round

**Never add it to this round.** The graph is fixed and `genai.spec` has already passed; a
passed node cannot be reopened.

Record it as a requirement instead, with `origin: agent`, `priority: P3`, and a first log line
naming what surfaced it. **Only a `produce` step has a `deferred` field**; `judge`, `verify` and
`effect` reports do not, so those steps register a to-do under `findings` instead — the report contract
refuses a field its kind does not declare, and `genai.merge`, `genai.e2e` and `genai.release` are the
three that would otherwise reach for it. Collect them at the end of the round and write them up in one
pass. Individual steps
do not write to the requirements directory; eight writers on one todo list will eventually make
a mess of it.

## Assembly rules

The graph above is the whole design, but if it is ever edited, these are the ways to get a
graph that **passes creation and deadlocks at run time**:

- **The `delegate` edge is not optional wherever `genai.e2e` is.** That gate is the one that
  produces a `delegate` verdict, and a `delegate` with no matching edge hard-locks: the gate errors,
  the verdict is not recorded, and the node sits forever at dispatched-but-ungated. Drop
  `genai.e2e → genai.e2e-author` and the first test bug of the round ends the round. Leaving the
  acceptance pair out entirely is a different thing and is fine — no step remains that can return
  that verdict.
- **One destination per verdict, so a node has at most two.** Edges route on the verdict and nothing
  else — not on a report field, not on a gate label. That is why a failure has to be classified into
  the two buckets the graph can act on before it can be routed anywhere, and why a third
  destination would need a third verdict rather than a cleverer message.
- **Never draw a `pass` edge backwards.** Pass edges are dependencies; one pointing back turns
  the downstream node into a root and inverts the graph.
- **`reject` self-rework needs no edge.** A redundant self-edge is harmless; a missing
  cross-node reject edge is not.
- **`genai.accept` rejecting stops the round hard, and it does not suspend.** A judge cannot rework
  itself — it judged; re-reading the same artifacts would only repeat — so its `reject` needs a
  destination, and the graph above deliberately gives it none. Measured, not assumed: the gate then
  errors with `no_matching_edge`, the verdict is **not** recorded, and the node stays
  dispatched-but-ungated. The finding is not lost — the report is submitted and stored before the
  gate runs, and it is what says which requirement went missing in the fold. What to do is a
  person's call and it is not "add the edge and rerun": the batch is merged and archived by then, so
  the finding is next round's work, entered as a backlog item. Only if a rework of *this* round is
  genuinely wanted does an edge get added, with `fsx graph patch -g <round> -i
  '{"ops":[{"op":"add_edge","edge":{"from":"genai.accept#1","to":"genai.spec#1","on":"reject"}}]}'`
  — and then the whole batch reopens, which is the cost the missing edge is there to make you weigh.
- **Never route `genai.archive` back with `reject` either**, and here the reason is mechanical:
  its two entry rules are `upstream_reran`, so re-activating it through a dependency edge asks
  again for an unfolded change and a clean tree — both false by then, and the refusal is silent.
- **Gate commands get no variables.** Not graph variables, not instance suffixes, no injected
  environment. Anything a check needs, it derives from `$PWD` or from git.

## What this does not do

- Does not explain what a step is gated on, or why — that is `genai-guideline`
- Does not write or clarify requirements — that is `genai-backlog`
- Does not install step definitions — that is `genai-init`
- Does not decide the version number; `genai.release` does, and records its reasoning
- Does not touch what the project supplies its own gates from — the `genai-metrics` target,
  `tools/genai/thresholds.json`, `tools/genai/e2e.json`. **A round may not widen the gate it is
  measured by**; that is a requirement for a later round, and `genai-guideline` says how it gets made
