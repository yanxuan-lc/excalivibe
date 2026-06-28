# Proposal — gen-ai-development 2.0

**Date:** 2026-06-27
**Status:** Design proposal for review (no implementation in this round).
**Companion:** `REPORT.md` (the four-source + DDD research record this design is derived from).
**Scope decision (confirmed with user):** clean-slate redesign; Claude-first but Codex-portable; deliverable this round is this proposal, not code.

---

## 0. One-paragraph thesis

gen-ai-development 2.0 is a **lifecycle of composable nodes selected by an Archetype Router**. A task is classified once (and re-classified on discovery) into a *change archetype* that selects a **distinct node-graph** — a bug-fix, a visual tweak, and a big feature literally run different flows, not one pipeline with holes. Three paradigms own three regions of every flow: **DDD up front** (idea → domain → macro design, gated to the core subdomain), **SDD in the middle** (a spec contract the implementer obeys), **TDD at the edge** (red-green proving the code). A **ubiquitous-language glossary** threads through all three so the same word names the domain term, the spec, the test, and the code — the anti-drift spine. Verification always runs in a **separate context** from implementation (the one inviolable invariant). Everything machine-judgeable is gated on **artifacts on disk**, leaving exactly **one mandatory human checkpoint** per flow, each producing a **named review document**. Beyond the main flow, a **standing optimization sweep** hunts bugs and architecture smells. The whole thing runs Claude-first using the Workflow primitive and hooks as accelerators, and degrades to the identical flow on Codex.

---

## 1. The Archetype Router (ax3 — the make-or-break)

### 1.1 Three signals, never conflated

| Signal | Values | Governs |
|--------|--------|---------|
| **Change archetype** (primary) | `feature` · `bug` · `visual` · `refactor/optimize` · `schema-migration` · `research-only` | the **spine shape** — *which nodes run at all* |
| **Subdomain class** (depth dial) | `core` · `supporting` · `generic` | **modeling depth** — *how much DDD a design node runs* |
| **Blast radius** (provisional) | `low` · `high` (files/modules touched, reversibility, public-contract/schema impact) | gate strictness; **re-route on discovery, never asserted up front** |

**Iron law:** the subdomain class is a *dial*, never a spine-switch. A bug in the core domain is a `bug` archetype run with a deeper domain *consult*, **not** a `feature`. (This is the §5.1 DDD caveat made operational; it was the corner the "Lighthouse" candidate over-sold as a 2D router.)

### 1.2 How routing works, and what makes it BINDING

The router is a **model-driven classification step**, surfaced as a skill/command (`/forge` or auto-entry), **not a hook** — so the same activation path works on Claude and Codex. It:

1. Classifies the request on the three signals (asking at most one clarifying question — subdomain class only when archetype is `feature`/`refactor` and blast radius is non-trivial).
2. Composes the node subset for that archetype from the **shared node superset** (§2) and writes it to **`PIPELINE.md`** as a track header (signals + the composed, ordered node list + skip rationale). Skipped nodes are **physically absent** from the composed list, not marked `[-]`.
3. Hands control to the first node.

**Binding mechanism (the contradiction 2.0 must not inherit):** the composed track is enforced **not by hope but by artifact-gates**. Each node's entry gate reads `PIPELINE.md` for "is this node in my track, and are my predecessors' artifacts present and fresh?" PIPELINE.md is the durable composition record; the gates are the enforcement. A node cannot silently fire out of track because its predecessor's artifact won't exist.

**Re-routing is one-way escalation + recomposition.** Any node may emit a re-route signal (e.g. `implement` discovers a bug-fix crosses a schema boundary). Control returns to the router, which **recomposes** the track upward (inserts `design-spec` + the human gate) and re-stamps PIPELINE.md. It never silently downgrades.

**Durability across compaction (portable, not Claude-only):** after a context reset, *either* harness re-grounds by reading `PIPELINE.md` and re-invoking the router skill. The instruction to *do* that lives in **`AGENTS.md`** — a short resume directive ("if an in-flight `PIPELINE.md` track exists, read it and resume at the first open node before anything else"). Both harnesses keep `AGENTS.md` in context by their own native mechanism (this is how 1.x resume already works), so the instruction survives compaction without a hook. A Claude `SessionStart` hook may *additionally* re-inject the router card as a convenience, but it is **not** the load-bearing path — the load-bearing pair is `AGENTS.md` (the instruction) + `PIPELINE.md` (the state), both symmetric across harnesses (see §9).

### 1.3 The archetype tracks (concrete compositions)

```
feature / core      grill → domain-model → design-spec → arch-review → ⟦HUMAN GATE⟧
                      → (implement ∥ qa-author) → boot → (e2e-run ∥ code-review) → release → archive → docs-sync
feature / generic   grill → design-spec → ⟦HUMAN GATE⟧
                      → (implement ∥ qa-author) → boot → (e2e-run ∥ code-review) → release → archive → docs-sync
                      (NO domain-model, NO arch-review — generic subdomain is scaffolded)
bug                 reproduce(debugger) → ⟦hypothesis confirm⟧ → implement(regression-test-first, TDD)
                      → (e2e-run ∥ code-review, scoped) → release → docs-sync
                      (NO spec, NO domain-model, NO four-contract gate — the regression test is the contract)
bug / high-blast    ESCALATES to feature track: router inserts design-spec + HUMAN GATE
visual              prototype(app-ux-design) → ⟦visual-diff confirm⟧ → implement(apply) → code-review(scoped) → release → docs-sync
                      (NO spec ceremony, NO e2e suite unless it crosses a flow)
refactor/optimize   safety-net(characterization tests) → smell-scan → ⟦candidate confirm⟧
                      → implement(behaviour-preserving) → (e2e-run ∥ code-review under a no-new-behaviour gate) → release → docs-sync
schema-migration    design-spec(DDL-focused) → arch-review(dba-guideline mandatory) → ⟦HUMAN GATE⟧
                      → implement(forward+rollback) → e2e-run(data-integrity) → release → archive → docs-sync
research-only       research-pipeline fan-out → REPORT.md + PROPOSAL.md → terminates (no implement)
```

This is **graph-selection-by-type**: the node *set* differs per track, validated by BMAD's track router and DDD's subdomain routing (REPORT §5).

**Every implementing track ends in the same close-out tail** — `archive` (OpenSpec change bookkeeping; only where a spec/change exists) → `docs-sync` (as-built docs + staleness). `docs-sync` is a *first-class pipeline node*, not a floating concern: it appears in `PIPELINE.md`, is gated, and cannot be silently skipped. Its *body* is sparse-gated (it scales to the change; a visual tweak that touched no durable knowledge exits cheaply), but its *presence in the flow* is guaranteed — so docs never silently rot. (See §7B for the discipline; the placement is here, in the pipeline, right after `archive`.)

---

## 2. The node superset

A fixed catalog; tracks are compositions over it. Each node declares: its **paradigm** (§3), its **subagent(s)** (§5), whether it is **parallelizable**, its **entry gate** (artifact precondition), and its **output artifact**.

| Node | Paradigm | Produces | Human gate? |
|------|----------|----------|-------------|
| `grill` | — | `BRIEF.md` (behavioural: current/desired/acceptance/out-of-scope) | none (interactive) |
| `domain-model` | DDD | `CONTEXT.md` glossary + bounded-context map | folded into the gate |
| `design-spec` | SDD | `openspec/changes/<id>/` spec (4 contracts) | none (gate is next) |
| `arch-review` | SDD | `arch-review.md` | none (closes via planner) |
| `human-confirm` | SDD | `REVIEW.md` (four contracts, + glossary if core, + visual-diff if visual) | **MANDATORY** |
| `reproduce` | — | `HYPOTHESIS.md` (repro + ranked root causes) | confirm (bug track) |
| `safety-net` | TDD | characterization suite + green baseline | none (machine) |
| `smell-scan` | — | `SMELL.md` / `CANDIDATES.md` | candidate pick (refactor) |
| `prototype` | — | `docs/ued/<dt>/` live workspace | visual-diff confirm |
| `implement` | TDD | commits + unit tests + TDD evidence | none (machine: coverage/lint) |
| `qa-author` | SDD | e2e test code + `e2e-manifest.md` | none (machine) |
| `e2e-run` | — | `e2e-report.md` (commit-stamped) | coverage escalation only |
| `code-review` | — | `CHECKLIST.md` (P0/P1, commit-stamped) | none (machine) |
| `release` | — | version bump + MR + release notes (prepared) | merge/publish decision |
| `archive` | — | archived OpenSpec change + delta-spec sync + `.out-of-scope/` | none |
| `docs-sync` | — | `docs/tech/` as-built docs + mark `research/`/`ued/` stale (sparse-gated body) | none (conditional) |

---

## 3. Paradigm-per-node (ax2 — DDD / SDD / TDD layering)

The single cleanest finding in the research (REPORT §5.1): the three paradigms are **layered, not competing**, and 2.0 makes each *earn its place per node* rather than running always-on.

- **DDD owns the front — gated to the core subdomain only.** `domain-model` runs strategic DDD: a guided, lightweight event-storming pass → a bounded-context map → a **ubiquitous-language glossary**. It is composed *only* for `feature`/`refactor` × `core`. For `supporting`/`generic` it is skipped (scaffold instead). **Tactical DDD (aggregates/invariants) is deliberately restrained**: proposed only inside a genuine core domain, folded into `design-spec`, and never auto-finalized — it passes through the human gate. *(Rationale: DDD over-applies easily and LLM-driven tactical modeling degrades down an unverified chain — REPORT §5.1, supported convergently, not on one paper.)*
- **The ubiquitous-language glossary is the anti-drift spine.** `CONTEXT.md` is glossary-only (zero implementation detail), per-bounded-context (no naive global glossary). Its terms become the **spec vocabulary → the test names → the code identifiers**. This is the single highest-value DDD import — it attacks the translation-drift class of hallucination directly and is fully harness-portable.
- **SDD owns the middle.** The OpenSpec change is the single source of truth. developer and qa-author **independently derive** from it (never from each other) — the structural anti-contamination pattern.
- **TDD owns the edge.** Red-green-refactor inside `implement` (coverage gates: interface 100%, line ≥90%), plus two TDD specializations the tracks exploit: **regression-test-first** in the `bug` track (closes "fixed but no guard"), and **characterization tests** in the `refactor` track (a behaviour-preservation oracle written before any change).

Event storming is kept lightweight and human-in-the-loop for genuinely novel domains (an AI running it solo invents guesses, not real disagreements — REPORT §5.1).

### Execution model inside `implement` — OpenSpec contract + a plan/task loop

A natural question: keep OpenSpec's spec-driven model, or switch to the Superpowers plan→task model that claims faster delivery at quality? **They operate at different altitudes, and 2.0 uses both.**

- **OpenSpec is not the slow part.** Superpowers is faster precisely at the thing 1.x does *badly* — a single `developer` agent grinding an entire spec in one steadily-rotting context — *not* at the contract layer. Superpowers' "faster" is **autonomy + context hygiene**, not parallelism (it bans parallel implementers). And the four-contract human gate + `spec-hash` freshness is something Superpowers *lacks*. So OpenSpec stays as the contract layer; we import Superpowers' execution discipline below it.
- **The spec stays the single contract (the "what").** `openspec/changes/<id>/` remains the source of truth: module / protocol / schema + scenarios `S1…`.
- **A disposable task plan drives the "how".** For changes above a size threshold, the *confirmed* spec is decomposed into vertical-slice tasks with inline TDD steps (RED/GREEN commands + expected output), and `implement` becomes a **subagent-per-task loop**: a fresh implementer per task (TDD evidence in its report) → a fresh task-reviewer (two-verdict) → a progress ledger → next task. This imports Superpowers' real wins — the plan is detailed enough that the agent doesn't stall, and fresh context per task avoids the rot that slows and degrades long single-context runs.
- **The plan is a derivation, never a second source of truth.** It is regenerated from the spec whenever the spec changes (e.g. on a mid-flight re-route). The same `spec-hash` that gates `REVIEW.md` freshness also invalidates a stale plan — so the "what's binding?" contradiction that sank the "Compass" candidate is not recreated one level down.
- **Scenarios ⊥ tasks.** OpenSpec scenarios (`S1…`) are *accept-units* — QA's contract, derived independently from the spec. Plan tasks are *build-units* — the implementer's decomposition. They never merge into two competing checklists.
- **Size-gated, not a fourth router signal.** Single-pass (one `developer` TDD pass) vs the task-loop is an **internal branch of the `implement` node** on estimated task count — *not* a new routing dimension (the router still classifies on exactly three signals, §1.1). The task-loop costs more tokens (a fresh implementer + reviewer per task); the size-gate keeps that a conscious choice, not a default.

---

## 4. The verification triangle (ax4 — the inviolable invariant)

Preserved exactly from 1.x (independently validated by GSD + Anthropic, REPORT §5.2) and only extended:

- **`developer`** writes product code + unit tests. Never writes e2e code.
- **`qa-author`** derives e2e tests from the **spec scenarios only**, never from the implementation. Never modifies product code.
- **`e2e-run`** executes read-only toward both code *and* test code; verifies user-visible result **and** DB writes; produces a commit-stamped report.
- **`code-review`** reviews the diff read-only, in a fresh context, with a **two-verdict** split (spec-compliance verdict *separate from* code-quality verdict).

The four contexts never share write authority. Handoffs are **file-path-only** (brief, diff package, manifest) — content never enters the controller's context. Verification subagents are dispatched with a **clean slate**; they re-derive facts from the diff, never trust the implementer's claims.

**Extension — adversarial verify.** `code-review` and the optimization sweep (§7) layer N independent skeptics with majority-refute to suppress false positives, run as a Workflow fan-out on Claude.

**Roster discipline.** Per the market's anti-persona-theater lesson (REPORT §5.2), 2.0 adds only two new agents over 1.x — `domain-modeler` and `release-coordinator` — and implements the sweep's "hunters" as *roles within a sweep skill's fan-out*, not standing agents.

| Agent | Kind | Responsibility | New? |
|-------|------|----------------|------|
| `researcher` | research | scoped investigation execution unit; inline return; never talks to user | — |
| `domain-modeler` | design | strategic DDD (core only): event-storming, BC map, glossary; human-gated | **new** |
| `planner` | design | SDD four-contract spec + tactical/aggregate proposal (core) + REVIEW.md; cannot implement | — |
| `arch-reviewer` | verify | reviews the **spec** before code (DDL/interface/cross-module); stays in design lane | — |
| `developer` | implement | TDD product code + unit tests; UL terms = test names; never e2e | — |
| `quality-assurance` | verify | e2e from spec only, two-phase; never product code | — |
| `e2e-runner` | verify | execute read-only + DB verify; commit-stamped report | — |
| `code-reviewer` | verify | two-verdict incremental review (gate) **and** full-mode bad-smell sweep | — |
| `debugger` | implement | hypothesis-driven; now a **first-class node** in the `bug` track + fix-loop | — |
| `release-coordinator` | other | **prepares** release (SemVer decision, version sync-point check, evidence digest) | **new** |

> **smell-scan is owned by `code-reviewer` full-mode, not `arch-reviewer`.** arch-reviewer stays strictly in the design lane (reviews specs, never implementation code). This fixes the lane violation the "Compass" candidate introduced.

---

## 5. Human checkpoints (ax6 — few, concrete, durable)

**Exactly one mandatory gate per flow, archetype-appropriate, each a named durable document** — minimizing human cost to O(1) per task:

| Track | Mandatory gate | Review artifact |
|-------|----------------|-----------------|
| `feature` / `schema-migration` | `human-confirm` | **`REVIEW.md` — the four concrete contracts** (module design / external protocol / DB schema / use-cases+scenarios), spec-hash freshness machine-checked |
| `feature` × `core` | the *same* gate, augmented | REVIEW.md **+ glossary + context-map** (one gate, richer content — **not** a second touchpoint) |
| `bug` | `reproduce` confirm | `HYPOTHESIS.md` (reproduction + ranked root causes) |
| `visual` | `prototype` confirm | live visual-diff (the running prototype) **captured to a durable note** before merge |
| `refactor` | candidate confirm | `SMELL.md` / `CANDIDATES.md` (deletion-test verdicts, ranked) |
| any | `release` decision | 4-option evidence digest (merge / MR / publish / hold) |

**Critical correction baked in:** the mandatory gate stays on the **concrete four contracts** (esp. DB schema + external API — the artifacts only the human can judge). For `feature × core` the glossary + context-map are added to that *same* gate as additional content, **never replacing** the concrete sign-off. (This avoids the regression the "Lighthouse" candidate introduced by moving the sole gate to abstract strategic design.)

Everything else is **machine-judged** on artifacts. The `grill` phase is interactive but lightweight (one question at a time, agent supplies a recommended answer) and produces `BRIEF.md`; it is an alignment step, not a sign-off gate — kept deliberately light so big-feature flows don't creep back to multi-gate ceremony. Subagents never ask the user; they park `open_questions` for the main agent to batch.

---

## 6. Parallelism (ax5 — honest, not cosmetic)

Real, inherited-and-validated parallelism:
- **`implement` ∥ `qa-author` (Phase 1)** — both derive from the confirmed spec independently.
- **`e2e-run` ∥ `code-review`** — both read-only, no shared file.
- **research fan-out** and **design-it-twice** (3+ parallel design sub-agents, different constraints, aggregated on depth/locality/seam).
- **stabilize-then-fan-out** for genuinely multi-bounded-context big features: freeze strategic design at the human gate, then build per bounded context in **one worktree each**, the context-map as the only coordination contract. (Narrow but real; never two subagents editing the same file.)

**Honesty about the one segment that cannot be fully wrapped:** QA's UI tests need a running app, so QA delivers in two phases (Phase 1 skeletons ∥ implement; Phase 2 finalize after `boot`). The boot between phases is a **main-agent-only hard boundary** — and statelessness does **not** remove it (a refuted claim from the "FlowForge" candidate; REPORT §6). 2.0 keeps two-phase QA + SendMessage continuation; the honestly-wrappable unit is *Phase-1-draft ∥ implement*.

---

## 7. Optimization side-flows (ax7 — the market gap, filled)

A **standing** flow, not a post-merge byproduct — the proactive architecture/bad-smell sweep the whole market lacks (REPORT §5.2):

- **`/forge-sweep`** — on-demand **or** Cron-scheduled (Claude). A dimension fan-out runs `smell-hunter ∥ bug-sweeper ∥ perf-prober` (roles within the sweep skill, dispatched via Workflow), each with **adversarial majority-refute** to kill low-confidence findings.
  - **smell-hunter:** deletion-test (pass-through detection), shallow-module / leaking-seam, oversized-bounded-context ("question any context that seems too large"), anemic-aggregate, transactions crossing aggregate boundaries.
  - **bug-sweeper:** proactive latent-bug hunt across the diff/module surface, distinct from the reactive `debugger`.
  - **perf-prober:** ranked performance hotspots.
  - **DDD distillation pass** (core domains): re-confirm the core got disproportionate quality effort and generic subdomains weren't over-engineered with tactical patterns.
- **Output:** an HTML `CANDIDATES.md` report with recommendation strength → the human picks candidates, which **feed a `refactor` archetype run** (closing the loop back into the main router).
- **Reactive find-bug:** the `bug` track's `debugger` escalates to the sweep after 3+ failed fix attempts (the "question the architecture" trigger).

---

## 7B. Knowledge persistence — one subsystem, three timescales

Documentation upkeep and memory updates are not two bolt-ons; they are **one knowledge-persistence layer** running at three timescales, all governed by the *same* sparse gate and split by *audience*. **Two of the three live *inside* the pipeline** — `capture` woven into nodes, `docs-sync` as a close-out tail node after `archive` (§1.3); **only `/forge-tidy` is a standing, scheduled side-flow outside the pipeline** (the true sibling of the optimization sweep). "One subsystem" means one shared discipline, not "all outside the flow."

**The sparse gate — when to persist anything at all.** Capture only what is **durable AND non-obvious AND not already in code / git / an existing doc** (mattpocock's three-conditions ADR rule, generalized). This is what stops the layer from becoming the always-on tail ceremony 2.0 rejects everywhere else: a change that altered no durable knowledge pays nothing.

**Split by audience — where it goes.**

| Store | Audience | Holds |
|-------|----------|-------|
| `docs/tech/` | humans | as-built technical knowledge (how the system works *now*) |
| agent memory (`MEMORY.md` + `memory/`) | the agent, next session | non-obvious cross-session facts: goals, rationale, user prefs |
| ADR / `.out-of-scope/` | future deciders | hard-to-reverse decisions + rejected scope with reasoning |

**Three timescales — when it fires.**
- **`capture` — inline, at decision moments.** A micro-step folded into *specific* nodes (not after every node): at `human-confirm` (the decision + rationale → an ADR if it meets the three conditions), at the end of a `bug` track (a non-obvious root cause), at `archive` (rejected scope → `.out-of-scope/`). **Write authority:** subagents *emit capture-candidates in their structured return* (like `open_questions`); the **main agent applies the sparse gate and is the single writer** — N isolated subagents never race on `MEMORY.md` (the research-pipeline single-writer lesson).
- **`docs-sync` — a pipeline node at change completion, right after `archive`.** This is a *first-class node in every implementing track* (§1.3), not a floating concern — it appears in `PIPELINE.md` and is artifact-gated so docs cannot silently rot. It runs while the change context is still hot (the established 1.x `archive → docs` ordering). Its *body* is sparse-gated and scales to the change: a big feature updates the architecture doc and marks shipped `research/`/`ued/` stale; a bug-fix may only add a changelog line or run a doc-staleness check; a visual tweak that touched no durable knowledge exits cheaply. Presence is guaranteed; cost is proportional.
- **`/forge-tidy` — on a schedule (Cron), the standing tidy sweep.** Reconciles docs against code (staleness drift) and consolidates/dedups agent memory. **It PROPOSES, never auto-deletes** — pruning memory on a timer is a destructive footgun; it outputs candidates for human pick (exactly like the optimization sweep), and the stores are git-tracked so any accepted change is reversible.

---

## 8. Version management (ax1 tail — `release` node, main-agent-executes)

1.x has no agent owning version management. 2.0 makes `release` a first-class node — **but the outward boundary stays safe**: `release-coordinator` only **prepares** (SemVer decision, multi-module version sync-point verification, release-notes draft, evidence digest). **The main agent executes** merge / push / publish, and only on explicit user consent — a subagent can neither receive that consent nor be trusted with an irreversible outward action. (This fixes the "FlowForge" candidate's unsafe subagent-owned release.)

---

## 9. Built-in capabilities & the portability contract (ax8 + 求同存异)

### 9.1 Claude-side primitives (accelerators)
- **Workflow tool** (the main agent *does* have it — correcting a subagent-perspective error in the research, REPORT §6): an **opt-in** accelerator (ultracode-style, default OFF) wrapping *contiguous no-human, no-main-agent* fan-out segments — the optimization sweep, code-review dimension fan-out, research fan-out, the fix-loop (loop-until-dry). It **never** wraps the human gate, the QA boot boundary, or merge/publish.
- **Hooks** (1.x ships none): `SessionStart` may re-inject the router card (convenience only, **not load-bearing** — §1.2); `PostToolUse` auto-stamps PIPELINE.md phase rows + runs the lint gate; a pre-merge hook recomputes freshness stamps.
- **Worktrees** for per-track / per-bounded-context isolation.
- **Cron** for the standing sweep.
- **Skills auto-trigger** by description (SDO: description = trigger conditions only); **subagents** dispatched with task-calibrated model/effort.

### 9.2 The symmetric main flow (identical on Claude and Codex)
Written in **action vocabulary** (dispatch a subagent, read a file, stamp an artifact) with **no harness tool names in skill bodies** (the Superpowers portability primitive):
- the Archetype Router (classify → compose → PIPELINE.md);
- the node superset + the archetype tracks;
- the four artifact gates (spec-hash freshness, both-artifacts commit-stamp, P0/P1-resolved, coverage=M);
- the verification triangle;
- the ubiquitous-language thread;
- the single concrete human gate + per-archetype review artifacts.

### 9.3 Per-harness implementation detail (each side optimal — "存异")
Only the *acceleration substrate* differs, and it is marked **once** in the shared spec as "wrappable":

| Concern | Claude | Codex |
|---------|--------|-------|
| deterministic fan-out | Workflow tool | same-message subagent dispatch over worktrees |
| router durability after compaction | `AGENTS.md` resume directive + read PIPELINE.md *(SessionStart hook re-inject is an extra convenience)* | `AGENTS.md` resume directive + read PIPELINE.md *(defaultPrompt is one-shot and not relied on; the AGENTS.md+PIPELINE.md pair is the real, symmetric durability)* |
| per-context isolation | EnterWorktree | `git worktree` |
| browser-driven e2e/visual | `claude --chrome` (graceful-browser) | Codex native browser |
| PIPELINE.md stamping | PostToolUse hook | main-agent write |
| standing sweep cadence | Cron | Cron / CI |

No Workflow or hook surface leaks into the Codex manifest (`.codex-plugin/plugin.json` carries `interface.capabilities`/`defaultPrompt`, **no** `hooks` field). The Codex degradation is **feature-complete on the main flow**, only slower per fan-out. Neither side is dumbed down to match the other.

---

## 10. Axis coverage (self-check)

| Axis | How 2.0 satisfies it |
|------|----------------------|
| ax1 full workflow | `grill`(IDEA) → `domain-model`/`design-spec`(SOLUTION) → `implement`(CODE) → `qa-author`/`e2e-run`/`code-review`(TEST) → `release`(VERSION) → `/forge-sweep`+`refactor`(OPTIMIZE) → `archive`. The two 1.x tail gaps (version, optimization) are now first-class, plus a **knowledge-persistence layer** (capture / docs-sync / `/forge-tidy`, §7B) keeping docs + memory current across the lifecycle. |
| ax2 DDD/SDD/TDD | paradigm-per-node: DDD front (core-gated, glossary thread) · SDD middle (spec contract) · TDD edge (red-green + regression-first + characterization). `implement` runs OpenSpec-spec-as-contract **+ a size-gated plan/task subagent loop** importing Superpowers' autonomy + context hygiene (§3). |
| ax3 dynamic orchestration | Archetype Router composes distinct node-graphs per archetype from a shared superset; written to PIPELINE.md, enforced by artifact-gates; subdomain = depth dial, blast-radius = provisional; one-way escalation/recompose. |
| ax4 subagent division | verification triangle inviolate (developer ≠ qa-author ≠ e2e-runner/code-reviewer), file-path handoffs, clean-slate verifiers, + adversarial verify. |
| ax5 parallelism | implement ∥ qa-author, e2e-run ∥ code-review, research/design-it-twice fan-out, per-BC worktrees; honest about the QA boot boundary. |
| ax6 human intervention | one mandatory concrete gate per flow, each a named durable document; everything else machine-judged; subagents park open_questions. |
| ax7 optimization | standing `/forge-sweep` (smell ∥ bug ∥ perf, adversarial-verified) → CANDIDATES.md → refactor track; DDD distillation; debugger escalation. |
| ax8 built-ins | Workflow (opt-in) + hooks + worktrees + Cron + skills auto-trigger on Claude; symmetric main flow in action vocabulary; Codex degrades cleanly. |

---

## 11. Rejected alternatives (short)

Three candidate designs were generated and adversarially critiqued (full record in the workflow artifacts; summary here):
- **DDD-led, phase-gated ("Lighthouse").** Rejected as a whole because it moved the sole mandatory gate from the concrete four contracts to abstract strategic design (a regression) and over-sold a "2D router" where the second axis only dialed one node's depth. **Salvaged:** the ubiquitous-language thread, absent-not-subtracted PIPELINE.md, core-only tactical DDD, the standing sweep concept.
- **Intent-routed minimal-ceremony ("Compass").** Rejected as a whole because its composer was non-binding (skills auto-fire while the router only "annotated") and it dropped 1.x's two-phase QA. **Salvaged:** paradigm-per-node, per-archetype review artifacts, characterization safety-net, regression-test-first, router-as-skill-not-hook.
- **Workflow-native parallel-first ("FlowForge").** Rejected as a whole because its flagship "stateless QA fixes dev∥QA parallelism" was refuted by the boot boundary, and it put release in a subagent. **Salvaged:** selection-by-type router with track→PIPELINE.md, first-class track-specific nodes (debugger, app-ux-design), DDD-gated-to-core, the standing sweep + release node, hooks/Cron, adversarial verify.

2.0 is the synthesis of the salvaged ideas into one binding, honest, portable system.

---

## 12. Build approach (if approved) & open questions

**This is the structure for the *next* round, not part of this deliverable.** Because the artifacts are markdown skills + agents + JSON manifest (not runnable product code), the build runs through **skill-creator**, not the dev-pipeline, with the **dual-end sync** convention (every `claude/` change considered against `codex/`; marketplace `plugins[]` kept in step; validated with `validate_plugin.py` / `jq`). A sensible sequence: (1) router skill + node-superset + PIPELINE.md schema; (2) the verification triangle agents (mostly re-derived from 1.x); (3) `domain-model` + glossary thread; (4) the archetype tracks one at a time, starting with `bug` (smallest) and `feature` (largest); (5) `/forge-sweep` + `release`; (6) hooks + Workflow wrapping as the Claude accelerator layer; (7) Codex port + the portability acceptance test.

**Open questions for you:**
1. **Codename.** Keep "gen-ai-development 2.0", or give the methodology/router a name (the candidates used Lighthouse/Compass/FlowForge)?
2. **Archetype taxonomy.** Is the six-archetype set (feature/bug/visual/refactor/schema-migration/research) right for your real work, or do you want others (e.g. `docs`, `spike`, `dependency-bump`)?
3. **Greenfield vs legacy seed.** On a repo with no `CONTEXT.md`/context-map, should the router run a one-time codebase-map pass to seed subdomain classification before routing?
4. **Sweep cadence & cost.** Standing sweep default — on-demand only, or Cron (and at what cadence)? It is the most token-hungry side-flow.
5. **Build order priority.** Which archetype track do you want working end-to-end first as a vertical slice?
