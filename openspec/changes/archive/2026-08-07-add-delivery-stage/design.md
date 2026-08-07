## Context

See proposal.md — Why. Four engine facts fix the shapes below.

**`vars` values are single strings.** A batch covers several changes; there is no value of
`{{vars.change}}` that means "all of them". So batch artifacts live under `{{vars.sprint}}` and the
batch's contents are data, not a variable.

**A declared input drags its variable in.** Measured: the variables a graph must supply are computed
from the instantiated steps *and the steps their inputs name*. A batch step declaring an input from
a per-change step would make every batch graph demand a `change` value it cannot give.

**`effect` reports require `idempotency_key` per effect.** `EffectReportSchema.effects[]` is an
array of `{system, identifier, url?, idempotency_key, reversible}`. The schema enforces the key's
presence; what it cannot enforce is that the key identifies the *act* rather than the attempt.

**`git_commit` outputs sign a ref.** `resolveCommit` runs `git rev-parse <locator>`, so a commit
signature covers the whole tree at that commit — including `openspec/`. That is what lets acceptance
at this stage detect a spec edit as well as a code edit, which a per-file checksum would not.

## Goals / Non-Goals

**Goals:**

- Finished work reaches a shared branch and a release through gates, not by hand
- Acceptance runs once, on the thing that will actually ship, and goes stale when that thing moves
- The irreversible acts carry keys that survive a resumed run
- Every check that could catch a defect runs before the merge that makes it everyone's

**Non-Goals:**

- No `command` gates yet. `genai.full-check` is where they belong and they need the project's own
  commands, which nothing collects until `genai-init`
- No sprint bookkeeping. Which changes are in a batch, and freezing that list, happen before a graph
  exists — that is the backlog skill's job, and this stage reads the result
- Not automating the merge decision. `genai.deliver` is `human` on purpose

## Module Design

Seven directories added, two rewired:

```
assets/nodes/
  genai.changes/              +  the roster: which changes this batch covers
  genai.integrate/            +  effect · merge onto the integration branch
  genai.full-check/           +  verify · the project's own checks, on the integrated tree
  genai.cross-family-audit/   +  verify · consistency across the ends we ship
  genai.merge/                +  effect · into the shared branch
  genai.deliver/              +  effect · human · publish or hand over
  genai.archive/              +  effect · consolidate and file the batch away
  genai.e2e-run/              ~  moved here; freshness now against the integration commit
  genai.release-prep/         ~  moved here; gains its inputs
```

The input wiring, which is what the engine actually enforces:

```
genai.changes ──> genai.integrate ──┬──> genai.full-check ──┐
                                    ├──> genai.cross-family-audit ──┤
                                    └──> genai.e2e-run ─────────────┤
                                                                    ▼
                                                  genai.merge ──> genai.archive
                                                        │
                                        genai.release-prep ──> genai.deliver
```

Three properties of that shape are deliberate:

- **`genai.changes` has no inputs.** It is the stage's entry point and the only place the batch's
  contents enter. Everything downstream reads the roster it produces.
- **The three checks fan out from `integrate` and converge on `merge`.** They are independent and
  slow; running them in parallel is the point of the fan-out, and `join: all` on the merge is what
  makes "all three passed" a precondition rather than a hope.
- **`genai.deliver` depends on `merge`, not the reverse.** Publishing something that is not on the
  shared branch produces a release nobody can reproduce from source.

### Why the audit runs before the merge, unlike the process this replaces

The previous toolkit's cross-family audit required `merge` — it audited what had already landed. A
failure there has nowhere to go: the merge is done. Moving it upstream costs nothing (it reads the
integrated tree either way) and turns an after-the-fact report into a gate.

## External Protocol

This change exposes no external interface. It consumes two engine contracts worth recording.

**The effect report.** Each entry in `effects[]`:

| Step | `system` | `identifier` | `idempotency_key` | `reversible` |
|---|---|---|---|---|
| `genai.integrate` | `git` | the integration branch name | branch name + the roster's content hash | `true` |
| `genai.merge` | `git` | the shared branch name | the merge commit's tree hash | `false` |
| `genai.deliver` | `npm` / `handoff` / … | package or handover reference | `<package>@<version>`, or the handover's own reference | `false` |
| `genai.archive` | `openspec` | the batch id | the batch id | `true` |

The rule the schema cannot enforce, so the briefs state it: **the key names the effect, not the
attempt.** `add-user-export@1.4.0` is a key; `attempt-3` is a counter that guarantees a second
publish.

**Freshness at this stage is a commit, not a file.** `genai.integrate` declares
`kind: git_commit`, `signature: commit_sha`, and a locator of **`genai/sprint/{{vars.sprint}}`** —
a branch per batch. Not `HEAD`: the engine refuses two steps sharing a locator
(`output_locator_shared`), and `genai.implement` already owns `HEAD`. The refusal is right — a
presence check satisfied by someone else's write passes while doing nothing. A named branch is also
what integration actually produces; `HEAD` is wherever the last command left the worktree.

The three checks each hold `signature_match` against that branch, so any commit — code or spec —
invalidates a result recorded earlier.

**Every check's artifact is named for what it is**, not `report`. An input's name must equal the
upstream artifact's name, so three steps all producing `report` would give `genai.merge` three
inputs called `report`. They are `checks`, `audit` and `acceptance`.

## Database Design

This change does not touch a database.

## Non-functional Budgets

| Dimension | Budget | Where the number comes from |
|---|---|---|
| Compiled artifact count | 426 → 468 | seven steps × two files × three ends |
| Steps in `genai-feature` | 16 → 23 | the seven added |
| Checks between integrate and merge | 3, in parallel | fan-out; wall clock is the slowest of the three, not their sum |

## Security & Permissions

This is the first part of the plugin that changes anything outside the working tree, so the
boundaries matter more here than anywhere else.

- **`genai.deliver` is `protocol: human`.** Publishing needs consent that a program cannot give on
  someone's behalf, and `unattended: suspend` means an unattended run stops rather than proceeding.
- **`genai.merge` and `genai.integrate` run as `main`, not a subagent.** A subagent must not push to
  a shared branch — that is the release-coordinator boundary the guardrail hook also enforces. Main
  can obtain consent; a subagent cannot.
- **Nothing here holds credentials.** Publishing uses whatever the project's own tooling is already
  authenticated with. This plugin neither stores nor reads a token.

## Observability

Each effect step's report is the record of what it did, and the `idempotency_key` is the part a
later reader needs. The engine keeps the reports, so "was this published" is answerable from the run
log rather than from the registry.

**What stays invisible:** whether the roster is complete. `genai.changes` produces the list, and
every downstream check measures only what the list names. A change omitted from it is not tested,
not audited, and not flagged — every gate passes. The roster must be reconciled against the frozen
batch, and nothing in the graph can do that reconciliation, because the frozen batch lives outside
it. Recorded under Risks; the backlog skill is where it gets closed.

## Rollback & Migration

**Forward:** add the definitions, rebuild, reinstall. The two moved steps change their artifact
locations, so a batch already in flight under the old layout would not find them — there are none,
nothing is released.

**Rollback of the plugin** is a revert and a reinstall.

**Rollback of what these steps did** is a different question and mostly answered "no": a merge into
a shared branch and a publish are marked `reversible: false` precisely because reverting them is a
new act with its own consequences, not an undo. `integrate` and `archive` are marked reversible
because they are — an integration branch can be deleted, an archive can be moved back.

## Verification Carrier

`agent-driven`.

The scenarios are about graph shape, gate verdicts and report contents. Checking them means building
graphs and reading what the engine answers.

Concretely: a batch graph created with only the batch variable (proving no per-change variable is
demanded), the three checks evaluated against a moving integration commit, and a merge left
undispatched behind a failing check.

## Decisions

**D1 — The roster is an artifact, not a graph variable.** Alternative: a `changes` variable holding
a comma-separated list. Rejected: variable values are substituted into locators, so a list would
produce one nonsense path; and the roster needs more than ids — which directories, at which commit —
which is a document, not a string.

**D2 — Acceptance moves to this stage, matching the process this replaces.** The alternative, which
this plugin has been shipping, runs acceptance per change. It costs a full suite per change and
proves something weaker: a change can pass alone and fail integrated. The cost of moving it is that
rework crosses graphs — a failing acceptance rejects back to `genai.integrate`, and the actual fix
happens in a change graph before re-integrating. That re-entry point is what the reject edge is for.

**D3 — `reject`, not `delegate`, when a check fails.** `delegate` does not consume patience, on the
grounds that each round is new work. A failing check on the same batch is rework of that batch, and
should be bounded. Only `blocked` — the environment is unavailable — delegates.

**D4 — `genai.archive` is an effect, not a produce.** It moves the batch's material out of the
active tree. That is a mutation with a resumption question ("was this already filed?"), which is
exactly what the effect report's key answers, and a `produce` report has nowhere to put it.

## Risks / Trade-offs

**An incomplete roster passes every gate** → see Observability. The batch's contents are established
by a step that has nothing to check itself against. Closed only by reconciling against a frozen
batch that lives outside the graph. Named here so the backlog skill inherits it as a requirement
rather than discovering it.

**Acceptance rework crosses graphs** → a failing acceptance sends the batch back to `integrate`, but
the fix happens in a change graph the batch graph knows nothing about. The engine records "attempt
2 of acceptance" and not what changed in between. Accepted: the alternative is per-change
acceptance, which is weaker for the reason in D2.

**A key that names the attempt would defeat the whole mechanism** → the schema requires a key and
cannot check what it means. Mitigated by each brief stating the rule with an example of the wrong
shape, which is the only enforcement available.
