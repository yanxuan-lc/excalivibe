## Context

See proposal.md — Why. Three things decide the shape.

**Intent is what the person wants; stage is a fact about the repository.** An earlier version of
this design made `spec`, `change` and `sprint` separate intents, which forced a judgement from the
wording of a request when `test -f openspec/changes/<id>/design.md` answers it. Separating the two
moves the decision from the model to the disk.

**The skill's description is the recognition mechanism.** It decides whether the skill loads at all.
So the fourth category — ordinary work that starts nothing — is not a branch this handles; it is the
complement of triggering, and the description's job is to not fire on it.

**This repository has measured that listing exclusions can backfire.** A description naming the
scenarios it should not fire on triggered on them 5 times out of 5. So the boundary is drawn by
positive description, and the result is tested rather than assumed.

## Goals / Non-Goals

**Goals:**

- A request reaches the right kind of handling without anyone re-deriving the map
- Work in flight is continued, not duplicated
- The stage comes from the artifacts
- The common shapes exist as something to edit

**Non-Goals:**

- Not driving. Dispatching, submitting, gating: the engine's own skill owns that and this does not
  restate a word of it
- Not composing every graph. The skeletons cover the common shapes; unusual work is composed, which
  is the judgement the engine deliberately leaves to a model
- Not setup. `genai-init` is a prerequisite and this says so rather than doing it

## Module Design

```
skills/genai-flow/
  SKILL.md
  assets/graphs/
    requirement.json   brief → intent-slice → spec → {spec-review, review-doc} → arch-gate
    implementation.json implement → existing-suite → code-review, with the optional checks
    delivery.json      changes → integrate → three checks → merge → deliver, archive
    research.json      brief → plan → probe → synth → review
```

The order of operations is the design:

```
1. what kind of work is this?          from the request
2. is there a graph for it already?    fsx graph list          ← before anything else
3. which stage?                        what exists on disk
4. which shape?                        a skeleton, edited
```

Step 2 before step 3 is the load-bearing bit. Deciding the stage first and *then* discovering a
graph exists means the stage was decided against a repository state the running graph is already
changing.

## External Protocol

No interface of its own. It consumes `fsx graph list`, `fsx nodes -w <workflow>`, and the filesystem
under `openspec/changes/`.

The stage decision, which is the part worth writing down because it must be mechanical:

| On disk | Stage |
|---|---|
| no `openspec/changes/<id>/design.md` | requirement |
| a design, no approval recorded | the requirement graph is still running — step 1 finds it |
| a design, and `genai/arch-gate.md` recording approval | implementation |
| finished changes and a frozen batch in the queue | delivery |

The middle row is not a stage. It is the state where step 1 matters most, and leaving it out of the
table would let a reader fall through it into building a second graph — the failure this whole
ordering exists to prevent.

Each row is a file test. None of them is a judgement about the request.

## Database Design

This change does not touch a database.

## Non-functional Budgets

| Dimension | Budget | Where the number comes from |
|---|---|---|
| Compiled artifact count | 524 → 539 | one SKILL.md and four graph assets, three ends |
| Commands before a graph is created | 2 | `fsx graph list`, then `fsx nodes -w <workflow>` |
| Description trigger accuracy | not yet measured | it is measurable, and the repo has the harness; this change ships the description and the measurement is the follow-up |

The last row is an admission rather than a budget. The repository's own finding about exclusions
came from measurement, and this description has not had the same treatment.

## Security & Permissions

No authentication or permission surface. One property inherited rather than introduced: diagnosis is
the only path here that changes product code without a gate, and the three conditions bounding it —
one place, reproducible, no contract touched — are what keep it from becoming the route people take
to avoid the flow.

## Observability

Nothing is recorded by this skill. The graph it creates is the record, and `fsx graph list` is where
the answer to "what is in flight" lives.

**What stays invisible:** a request that should have started a graph and did not. Choosing to fix in
place leaves no trace beyond the commit, so the boundary between diagnosis and change work is
enforced only by whoever is applying it. The three conditions are written to be checkable by the
person applying them, which is the most that is available without a gate.

## Rollback & Migration

**Forward:** add the skill and its assets, rebuild.

**Rollback:** remove them. Graphs already created are unaffected — they are the engine's, not this
skill's. Nothing in the flow references it.

No migration. Work already in flight continues under whatever graph it has.

## Verification Carrier

`agent-driven`.

Most scenarios are about a decision procedure, and the two that are not — that the skeletons are
accepted by the engine, and that the stage follows the artifacts — are checked by submitting them
and by constructing the two disk states.

Concretely: each skeleton submitted unedited against a scratch project, and a change directory built
first without a design and then with an approved one, checking the stage rule reads the same both
times.

## Decisions

**D1 — Four kinds, not seven.** The earlier version had `act`, `backlog`, `debug`, `spec`, `change`,
`sprint`, `research`. Three of those are stages of one kind of work, and making them intents forced
the model to infer from phrasing something the filesystem states. Collapsing them removes a
judgement rather than hiding one.

**D2 — No exclusion list in the description.** The natural way to keep this from firing on ordinary
work is to say what it is not for. This repository measured that doing so can *increase* triggering
on the named scenarios. So the boundary is positive-only, and the description is a hypothesis to
test rather than a decision to trust.

**D3 — Skeletons as assets, not prose.** Alternative: describe the shapes in the skill and have the
graph composed each time. Prose drifts from what the steps actually declare, and the drift is
invisible until a graph is rejected. A JSON asset is submitted to the engine, so it is checkable —
and it is checked, by the acceptance that submits each one unedited.

**D4 — Diagnosis stays graph-free, with three conditions.** The alternative is that every fault
starts a graph, as the previous toolkit had it. That taxes the common case heavily. The conditions
are what keep the exception from swallowing the rule, and they are stated as facts someone can check
rather than as a judgement about size.

## Risks / Trade-offs

**The description is untested** → the one thing this repository has actually measured about
descriptions is that intuitions about them are wrong. This ships an unmeasured one, which is a known
gap rather than a claim; the harness exists and the measurement is a follow-up.

**"Fix in place" is enforced by the person applying it** → see Observability. The three conditions
are checkable, but nothing checks them.

**A skeleton can be submitted unread** → shipping a shape invites using it as-is, and a graph with
steps that do not apply spends effort and dilutes the meaning of a passing run. Mitigated only by
the skill requiring the reason for keeping or dropping a step to be a fact about the diff.
