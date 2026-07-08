# PIPELINE.md — the durable-state format

`openspec/changes/<id>/PIPELINE.md` is the controller's single source of truth. The
controller is the **writer**; the artifact-gates are the **readers**. It survives
compaction: paired with the `AGENTS.md` resume directive (re-read this file and resume the
controller before doing anything else), any session resumes from it without trusting
conversation memory. **On resume, read this file first — it outranks memory.**

Create it when the change dir is created; backfill phases that happened before activation.
Update it at every phase transition.

## The header — the controller's four outputs + run state

The controller emits **four** things, plus the run-level state the budget/audit machinery
needs:

```markdown
# Pipeline — <change-id>

archetype:        feature            # the spine (Step 1)
criticality:      core               # core | supporting | generic — the depth dial
reversibility:    irreversible       # reversible | irreversible (escalates the ceiling)
ceiling:          human-gated        # full-auto | auto+spot-check | human-gated  ← OUTPUT
gate-shape:       intent-loop + human-confirm(architecture review) + publish-consent  ← OUTPUT
intensity:        adversarial-N=2; design-it-twice=on; verifier-tier=top; verifier-model=alt-family; \
                  oracles=mutation+property; sweep=diff-scoped; token-budget=<n>   ← OUTPUT
infra-readiness:  off                # off ⇒ any full-auto lane is downgraded to spot-check
escalations:      []                 # surfaces that forced the ceiling up (one-way)
anomaly-rate:     n/a                # n/a until actually measured — never invent a number
budget-B:         n/a                # human review-units/day; n/a until the project sets one
downgrade-state:  none               # none | <ceiling>→<lower> (window=<n>d, since=<date>)
started:          2026-07-08T14:02:11Z   # UTC, stamped via `date -u` when the change dir is created — never from memory
completed:        n/a                    # UTC, stamped when the archive row is flipped; n/a until the run finishes
```

The fourth controller output, **the node-graph itself**, is the phase checklist below
(the composed track from references/tracks.md). The `intensity` line is the verification-
intensity vector (SKILL.md Step 7); `ceiling` / `gate-shape` set what the gates enforce.
The three budget fields (`anomaly-rate`, `budget-B`, `downgrade-state`) stay `n/a` until
the project has a real measurement mechanism — never invent values; with
`anomaly-rate: n/a` the anomaly auto-downgrade loop is inert.

## The phase checklist — the composed track

One row per node in the composed track (so the row set differs by archetype — a `docs`
track has three rows, a `feature_core` track has many). Each carries an artifact pointer.
Any gate-consumed node the composed track *omits* (e.g. `e2e-run` on the small lane) still
gets a `[-]`-with-reason row, so the merge gate has a deterministic row to read.

```markdown
- [x] grill         → BRIEF.md (deep, binding; glossary seeded in CONTEXT.md)   @ 2026-07-08T14:00:10Z → 2026-07-08T14:05:33Z
- [x] prototype     → docs/ued/<dt>/ or a thin stub  (disposable; drives the intent loop)   @ 2026-07-08T14:06:00Z → 2026-07-08T14:31:09Z
- [ ] intent-loop   human reacts to the running slice until intent confirmed; incl. decomposition confirm (if composite)
- [x] design-spec   → openspec/changes/<id>/  (domain model + 4 contracts)   @ 2026-07-08T14:35:00Z → 2026-07-08T15:12:44Z
- [-] arch-review   (skipped: no DDL / no cross-module)  or  → arch-review.md   @ 2026-07-08T15:13:02Z
- [ ] human-confirm REVIEW.md (architecture review — domain model + 4 contracts + decisions + cross-cutting; spec fingerprint matches)
- [~] implement     developer: unit tests ✅ mutation/property oracles ✅ lint ✅   @ 2026-07-08T15:30:00Z → …
- [ ] e2e-author    → e2e-manifest.md (Phase 1 draft / Phase 2 final)
- [ ] e2e-run       → e2e-report.md (all green; executed + manually-verified + waived = M)
- [ ] code-review   → CHECKLIST.md (two verdicts; P0/P1 all Resolved)
- [ ] security-gate → report (SAST + dep-audit + secret-scan; no blocking findings)
- [ ] a11y-gate     → report (axe/Lighthouse, UI surfaces)  or  [-] no UI
- [ ] perf-gate     → report (latency / query-count / bundle-size budget)
- [ ] merge → dev   auto on green machine gates; irreversible surface excepted
- [ ] publish       ⟦human consent⟧ — outward irreversible act only  or  [-] no publish
- [ ] canary        orchestrate into project CD (if present)
- [ ] archive + docs-sync
```

Conventions:
- `[x]` done (with artifact pointer) · `[~]` in-progress · `[-]` skipped **with reason** · `[ ]` pending. To a reader-gate `[~]` counts as not-yet-done (same as `[ ]`); it exists so an **interrupted** node is visible on resume — distinct from one that never started.
- Use the node names from references/tracks.md verbatim so cross-file references resolve.
- **Start & completion stamps.** Flip a node to `[~]` and record its start the moment you begin (or dispatch) it; flip it to `[x]` and record its end the moment it completes. A worked node therefore ends as a **range** — `@ <start UTC ISO 8601> → <end>` (e.g. `@ 2026-07-08T14:35:00Z → 2026-07-08T15:12:44Z`); while in-progress the end is `…` (`@ 2026-07-08T15:30:00Z → …`). A `[-]` skip — and any instantaneous node with no real work window — carries a single stamp `@ <UTC ISO 8601>` instead. Get every time from `date -u +%Y-%m-%dT%H:%M:%SZ` at the moment of the flip — **never from memory** (a fabricated stamp corrupts the very duration analysis it exists for — same discipline as `anomaly-rate`). Backfilled phases use `@ unknown`.
- **Reading durations.** A ranged row's duration is `end − start`, independent per node — so **parallel** nodes (implement ∥ e2e-author, code-review ∥ e2e-run) each report their own true duration, with no approximation. `completed: − started:` gives the whole-run wall-clock.

## Manual / waived rows (e2e coverage)

```markdown
manual: (none; or S3 — user manually verified: after checkout, orders table +1 row, stock -1)
waived: (none; or S5 — depends on a third-party scan callback; user-approved waiver)
```
A `manual` row with no stated evidence does **not** count toward coverage. A merely
unmapped scenario is **not** waivable — it is agent-driven or escalated.

## Composite prompts — the unit-DAG

When `decompose` fans out (multi-intent only — single intent is a no-op), the bundle gets
**one `PIPELINE.md` per unit** plus a top-level DAG manifest recording the split and its
coordination edges:

```markdown
# Bundle — <bundle-id>

brief: BRIEF.md   # grill ran once at bundle level; each unit inherits its slice

units:
  - id: A  archetype: feature   criticality: core     ceiling: human-gated
  - id: B  archetype: bug        criticality: generic  ceiling: full-auto*
  - id: C  archetype: visual     criticality: generic  ceiling: full-auto*

edges:
  - kind: shared-mutable-file     from: B  to: A   action: sequence   # never 2 agents/file
  - kind: shared-irreversible     units: [A, C]    action: escalate   # → both human-gated

decomposition-surfaced-at: A.intent-loop   # the split is confirmed at the gated unit
```

- **shared-irreversible-surface** edges → **escalate** the ceiling (units not
  independently safe). **shared-mutable-file** edges → **sequence** (the common case).
- The split itself is surfaced for human confirmation at the gated unit's intent loop;
  an all-reversible bundle accepts a wrong split as reversible (closed-loop backstop).
- Independent units carry their own change dir + `PIPELINE.md` and may run in parallel
  worktrees; the gated unit's file records `decomposition-surfaced-at`.

## Freshness stamps

Two stamps make staleness machine-checkable (the merge gate, references/gates.md):
- `REVIEW.md` header carries the spec fingerprint; the gate re-derives it and compares.
- `e2e-report.md` and `CHECKLIST.md` each name the `Commit` they were produced against;
  the merge gate requires **both == merge-candidate HEAD**. A green report from an earlier
  commit is stale evidence.
