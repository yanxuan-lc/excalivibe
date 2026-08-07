## Context

See proposal.md — Why.

The shape of this is decided by one engine fact and one earlier decision.

**Graph variables freeze at creation.** `graph patch` refuses a node needing a variable the graph
does not have (`graph_var_frozen`), and the artifact locators substitute one value. A queue picks a
different change each round, each with its own directory, so it cannot be a long-lived graph.

**The delivery stage already wrote down the gap this fills.** Its design records that
`genai.changes` produces a roster with nothing to check itself against, and that closing it needs a
frozen batch from outside the graph. This supplies that, and does not change the stage.

## Goals / Non-Goals

**Goals:**

- An idea has somewhere to sit that is not a graph and not someone's memory
- A decision against an item survives, so the same idea does not get re-litigated from scratch
- A batch has a definition, frozen, that the roster can be reconciled against

**Non-Goals:**

- Not scheduling. Which item is next is a judgement made when someone is ready to work, not a
  priority number maintained in a file
- Not estimating. No points, no dates
- Not a second home for requirements. An item says what and why; the change's brief is where it gets
  sharpened, and duplicating it means two texts that disagree

## Module Design

One skill, one file format, no scripts:

```
src/plugins/dev-workflow/skills/backlog/SKILL.md
genai/BACKLOG.md          in the project — items and batches, one document
```

Items and batches live in one file rather than two. They are read together — composing a batch means
looking at what is finished — and two files would need a convention keeping them in step.

The skill is prose over a markdown file, with no script, for the same reason `glossary-conformance`
has none: every operation here is a judgement (is this finished, does this belong in the batch) and
a script could only enforce the format, which is the part that does not go wrong.

## External Protocol

No interface. One file format, and the parts of it other things read:

| Section | Read by | Contract |
|---|---|---|
| `## Items` | people | id, one-line want, why it matters, state |
| `## Batches` | `genai.changes`, when composing its roster | batch id, frozen or not, and the change ids in it |

Item states: `open` · `pulled <change-id>` · `declined <reason>` · `done <batch-id>`.

`pulled` and `done` both point outward, which is the property that keeps the queue from becoming a
second copy of the work: once an item points at a change, the change is the truth.

## Database Design

This change does not touch a database. `genai/BACKLOG.md` is a flat markdown file in the repository —
no schema, no migration, no index. It is versioned with the project, which is the point: the reason
an item was declined is in the history alongside the code that made it moot.

## Non-functional Budgets

| Dimension | Budget | Where the number comes from |
|---|---|---|
| Compiled artifact count | 488 → 491 | one SKILL.md, three ends |
| Items before the file needs splitting | not budgeted | it is read by people; when it stops being readable, that is the signal, and no number predicts it |

The second row is a deliberate absence. A budget invites a threshold nobody would act on.

## Security & Permissions

No authentication or permission surface. One property worth stating: **a declined item keeps its
reason in a file that ships with the repository.** If a reason would be inappropriate in a public
repository, that is a judgement for whoever writes it, and the skill says so rather than assuming
the file is private.

## Observability

The file is the record. Reading it answers what is queued, what was declined and why, and what is in
each batch.

**What stays invisible:** whether the queue reflects reality. Nothing reconciles `pulled` items
against the changes they name, so an item can point at a change that was abandoned. Detectable by
reading, not by any check. Accepted: the alternative is a script that scans `openspec/changes/`, and
a stale pointer costs a moment's confusion rather than a wrong result.

## Rollback & Migration

**Forward:** add the skill. `genai/BACKLOG.md` is created on the first capture, not by setup — an
empty queue file is noise in a project that never uses one.

**Rollback:** delete the skill. The file stays; it is the project's, and it is readable without any
tooling because it is a markdown list.

No migration. A project with an existing informal list keeps it and adopts the format as it goes.

## Verification Carrier

`agent-driven`.

Every scenario is a judgement about a text file — whether an entry contains a design, whether a
frozen batch grew. Checking them means performing the operation and reading the result.

Concretely: a scratch `BACKLOG.md`, one item through capture → declined → re-raised, one through
capture → pulled, and a batch composed, frozen, then offered a new member and a removal.

## Decisions

**D1 — One file, not one per item.** Alternative: a directory of files, as some issue trackers do in
git. Rejected: the operation people actually perform is reading the whole queue, and a directory
makes that an aggregation. A single file is also diffable, which is how "what changed in the queue"
gets answered.

**D2 — Declined items stay.** Deleting them loses the reason, and the same idea arrives again — from
the same person, six months later — with nothing to meet it. The cost is a file that grows
monotonically, which is acceptable for something read by eye.

**D3 — No script.** Consistent with `glossary-conformance`. A script here could validate the format,
which is not where this goes wrong; the judgements — is this finished, does this belong — are not
scriptable, and shipping a script would suggest they had been checked.

**D4 — Freezing allows shrinking.** A batch that cannot lose a member forces the whole batch to wait
for one broken change. Growth is what must stop, because integration has already started against the
list. Recording the removal is what keeps that from being a silent scope change.

## Risks / Trade-offs

**The roster reconciliation is still manual** → this supplies the frozen list, and `genai.changes`
is instructed to reconcile against it, but nothing enforces that it did. Closing it fully needs a
check that reads both, which is a script over a file whose format is prose. Named rather than
claimed as solved.

**The queue can point at abandoned changes** → see Observability. Costs confusion, not correctness.

**A single growing file eventually stops being readable** → no threshold, no plan. Accepted: the
signal is a person finding it unreadable, and the response is theirs.
