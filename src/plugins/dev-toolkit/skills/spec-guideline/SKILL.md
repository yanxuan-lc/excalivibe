---
description: "Decide what a change has to nail down before anyone starts building it, and check a written design against that bar rather than against a general sense of completeness — which module boundaries move, what the external interface is, what the schema and its indexes look like, what counts as accepted, and what number a later measurement gets compared against. Reach for it whenever a design is being written or reviewed, and whenever the question is only \"is this design ready to build against\", \"what am I missing here\", \"how detailed does this need to be\", \"where does the DDL go\", or \"what should the acceptance scenarios say\" — including when nobody says \"spec\". It answers what a design must settle and how much is enough; deciding whether a particular schema or module split is the right one is separate work, and so is pinning down a request that is still vague."
description-claude: "Decide what a change has to nail down before anyone starts building it, and check a written design against that bar rather than against a general sense of completeness — which module boundaries move, what the external interface is, what the schema and its indexes look like, what counts as accepted, and what number a later measurement gets compared against. Reach for it whenever a design is being written or reviewed, and whenever the question is only \"is this design ready to build against\", \"what am I missing here\", \"how detailed does this need to be\", \"where does the DDL go\", or \"what should the acceptance scenarios say\" — including when nobody says \"spec\". It answers what a design must settle and how much is enough; deciding whether a particular schema or module split is the right one is separate work, and so is pinning down a request that is still vague."
description-codex: "Decide what a change has to nail down before anyone starts building it, and check a written design against that bar rather than against a general sense of completeness — which module boundaries move, what the external interface is, what the schema and its indexes look like, what counts as accepted, and what number a later measurement gets compared against. Reach for it whenever a design is being written or reviewed, and whenever the question is only \"is this design ready to build against\", \"what am I missing here\", \"how detailed does this need to be\", \"where does the DDL go\", or \"what should the acceptance scenarios say\" — including when nobody says \"spec\". It answers what a design must settle and how much is enough; deciding whether a particular schema or module split is the right one is separate work, and so is pinning down a request that is still vague."
name: spec-guideline
---

# Spec Guidelines

What a change has to settle in writing before implementation starts, and how much of each thing
is enough. The failure this prevents is the expensive one: a design that reads as complete,
gets approved, and turns out mid-implementation to have never said what the error codes are, or
whether the endpoint authenticates, or what "fast enough" means — so the decision gets made by
whoever hits it first, alone, under time pressure.

A design is not a description of the change. It is **the set of decisions that must exist before
parallel work is safe**, written down so that everyone building against it inherits the same
answers instead of each rediscovering one.

## How to Use This Skill

1. Read **The four contracts** below — they are the spine, and three of the four live in the
   design document while the fourth deliberately does not.
2. Walk **the completeness bar** for each section that applies. A section that does not apply
   says so in writing.
3. For acceptance scenarios, read [references/stable-ids.md](references/stable-ids.md) before
   writing the first one — the identifier convention is load-bearing downstream and partly
   irreversible once written.
4. Consult the domain guidelines for the judgment this skill deliberately does not carry:
   `dba-guideline` for whether a schema is right, `coding-guideline` for module structure,
   `middleware-guideline` for what a service must expose.

## Severity

- **[MUST]** — a design missing this is not ready to build against. Say so rather than
  proceeding.
- **[SHOULD]** — strong default; note the deviation when you skip it.

## The four contracts

Four things a change may change, and each is a contract because somebody downstream builds
against it independently.

| # | Contract | Lands in | Why there |
|---|---|---|---|
| 1 | Project structure and module design | `design.md` | one-off design for this change |
| 2 | External protocol | `design.md` | one-off design for this change |
| 3 | Database design | `design.md` | one-off design for this change |
| 4 | **Use cases and acceptance scenarios** | **`specs/<capability>/spec.md`** | must accumulate and stay traceable across iterations |

**The split in that last column is not filing tidiness [MUST].** `archive` merges only the delta
specs into the long-lived baseline; the design document leaves with the change directory. A
scenario written into `design.md` therefore *disappears* the moment the change is archived, the
baseline decays into an incomplete record, and scenario coverage stops being computable across
iterations. WHAT the system does accumulates; HOW this particular change does it does not.

The same fact has a second consequence worth designing for: contracts 1–3 are **the only source
for the as-built technical documentation**, because nothing else carries them forward. Write
them to be read after the change ships, not only while it is being built — see `docs-guideline`
for where they land.

## The completeness bar, section by section

### Module Design [MUST when boundaries move]

Directory increments, the module dependency graph, responsibility boundaries. Prefer a diagram
for the graph — a dependency cycle is visible in a picture and invisible in a paragraph.

Enough when: a reader can say which module owns each new responsibility, and no arrow in the
graph surprises them.

### External Protocol [MUST when anything is exposed]

Endpoint attributes, request and response examples, the error-code table.

**A new endpoint buried inside prose is a planning defect**, not a formatting one — it surfaces
as a surprise during review, when the cost of moving it is highest. The error-code table is the
part most often skipped and most often needed: a caller cannot handle failures that were never
enumerated.

Enough when: someone could write a client against this section without reading the
implementation.

### Database Design [MUST when the schema moves]

Entity relationships, full DDL, index budget, extensibility decisions.

Full DDL, not a description of it. "Add a status column" leaves the type, the default, the
nullability and the comment to be invented later by whoever writes the migration. Consult
`dba-guideline` — this skill says the DDL must be here, that one says whether the DDL is right.

Enough when: the migration is mechanical to write from this section alone.

### Non-functional Budgets [MUST when the change can move a number]

Concrete numbers for whatever this change can affect — latency, query count, bundle size.

**A budget stated as a number is the only thing a later measurement can be compared against.**
Without one, "did this get slower" has no answer and the check degenerates into someone judging
whether it feels fast. State the number even when it is generous; a loose budget is
falsifiable, an absent one is not.

### Security & Permissions [MUST when there is a new surface]

Authentication points, permission model, sensitive-data handling.

This section exists because of a specific blind spot: a scanner finds a hard-coded secret, but
**nothing automated finds an endpoint that should have been authenticated and never had
authentication designed for it.** Absence of a finding is not evidence here — only the design is.

### Observability [SHOULD, MUST for a service]

Health checks, readiness, metrics, key logs and alerts.

What is not declared here does not get built, and no downstream check notices the omission —
a monitoring surface that was never specified fails silently by simply not existing. See
`middleware-guideline` for what a service must expose.

### Rollback & Migration [MUST when state changes shape]

Forward steps, rollback strategy, data backfill.

A schema change needs both directions. The forward path gets designed by default because it is
the work; the rollback gets designed only if something asks for it, and this is that something.

### Verification Carrier [MUST when there are acceptance scenarios]

Exactly one of:

| Carrier | Meaning | Consequence |
|---|---|---|
| `scripted` | test code gets written for these scenarios | someone implements it once, then it runs at no model cost thereafter |
| `agent-driven` | no test-code investment | the scenarios get walked live every time, at model cost every time |
| `existing-suite` | an existing suite already covers them | nothing new is built |

**This is settled at design time because of when it is needed, not because it is design-like.**
Test authoring derives from the scenarios — the contract — not from the implementation, so it
can run *in parallel* with implementation from the same confirmed design. Deciding the carrier
after the code exists throws that parallelism away, and worse, invites tests written by reading
the implementation they are supposed to judge.

Pick `scripted` when the project has test infrastructure or the flow will be re-verified often
enough to repay building it. Pick `agent-driven` when it will be verified once or twice and the
infrastructure does not exist. Say which, and say why in one line.

### Decisions, Risks, Open Questions

Trade-offs only. Full DDL and dependency graphs have their own sections — a Decisions section
carrying a schema is a section nobody will find it in later.

Open Questions are for genuinely deferrable unknowns. **If an answer would change the contracts,
the approach, or the work breakdown, it is not an open question — it is an unresolved
blocker [MUST].** Park the first kind; escalate the second rather than guessing and building on
the guess.

## Say "not applicable" out loud [MUST]

A section that does not apply gets one written line — "This change does not touch the database"
— rather than being dropped.

An omitted section is indistinguishable from an overlooked one. That ambiguity is the whole
cost: a reader cannot tell a deliberate scope decision from a gap, so either they re-derive it
themselves or they assume it was considered. One line removes the doubt permanently.

## What this skill does not decide

- **Whether the design is the right one.** This is a completeness bar, not a correctness
  review. A design can clear every item here and still be the wrong architecture — that
  judgment belongs to whoever reviews the design, and to the domain guidelines for their own
  areas.
- **Requests that are still vague.** If the intent has not been pinned down, no amount of
  structure helps — a design written against a fuzzy ask is precise about the wrong thing.
  Settle the intent first.
- **Documentation of what already shipped.** These contracts describe a change before it is
  built. Turning finished work into durable documentation is a different exercise with a
  different shape; see `docs-guideline`.
