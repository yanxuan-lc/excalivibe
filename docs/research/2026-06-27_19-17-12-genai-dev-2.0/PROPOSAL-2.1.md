# Proposal — gen-ai-development 2.1 (post-critique revision)

**Date:** 2026-06-27
**Supersedes:** `PROPOSAL.md` (the 2.0 baseline, kept as the pre-critique record).
**Driven by:** `CRITIQUE.md` (9-lens first-principles adversarial pass) + the owner's decision that **~half of delivered value is novel-core-intent work** (the rest conventional/reversible).
**Status:** design proposal for review; no implementation this round.

---

## 0. What changed, and why (read this first)

2.0 asked "how do we route work into the right node-graph, with one human gate." The critique reframed the goal to **fully-automated vibe coding** and produced one categorical result:

> **Full automation is reachable for *retrieved-intent* work and categorically impossible for *invented-intent* novel-core work.** Irreversibility is engineerable away; the un-verifiability of intent a human hasn't formed yet is a *category*, not a cost.

Given the owner's **half-half** reality, 2.1 is explicitly **dual-track**:

- **The reversible / retrieved-intent half** (visual, deterministic bug, covered refactor, generic CRUD) → drives toward **full automation** — *behind the infrastructure that makes de-gating safe* (§9, §12).
- **The novel-core / irreversible half** (core features, destructive schema) → keeps an **irreducible intent loop**: a human reacting to a *behaving artifact*, not signing a document.

The single structural change that delivers this: **the router is promoted from a node-graph selector to an Autonomy Controller** — it sets a per-task automation *ceiling* and composes the node-graph, the gate *shape*, and the verification *intensity* to match. Everything below follows from that.

**The seven concrete shifts from 2.0** (rationale in CRITIQUE §3–§4):
1. Router sets an **autonomy ceiling**, not just a node-set (was: uniform "one gate per flow").
2. **`release` is split** into auto-merge (reversible) + consent-publish (irreversible).
3. **Ceremony gates removed** on reversible lanes (visual / deterministic-bug / covered-refactor / generic).
4. The **core gate is relocated & reshaped** — from an abstract `REVIEW.md` text sign-off to an iterative *running-artifact* loop + an early executable anchor.
5. **Missing verification classes added** — in-flow security / a11y / perf gates; mutation/property oracles replace coverage-%.
6. **schema-migration split** on reversibility; **glossary** demoted from "anti-drift spine" to a machine-enforced naming aid with no trust credit; **tactical-DDD** dropped to the reactive sweep.
7. A **post-merge closed loop** (canary / telemetry / auto-revert) is added — the actuator that makes any "full-auto" lane actually safe.

**Update (round 5) — DDD dissolved into plain functions.** After the critique gutted tactical DDD and demoted the glossary, what remained of "DDD" was not a methodology worth a pillar — it was three ordinary things wearing a label. So the label is dropped. **The pipeline now has two paradigms: SDD (the spec contract) and TDD (the tests).** What was "DDD" is written plainly as:
- **a criticality / novelty signal** (core / supporting / generic) — already the router's depth dial (§1), renamed honestly; it sets how much design thinking and human framing a task gets;
- **a machine-enforced glossary** — a naming-consistency registry (glossary → spec → test → code identifiers), checked by a gate; a generic good practice, not DDD;
- **for genuinely novel core domains only, a "frame the domain before speccing" step folded into `grill`** (§2) — not a separate node.

Consequently the standalone **`domain-model` node and the `domain-modeler` agent are removed** (the roster's only new agent is now `release-coordinator`), and the front of the core track is **slimmed** (§3): the design-side steps that were fine-grained, human-legibility nodes are collapsed into fewer model-self-delegated passes; only the verification-isolation boundaries and the cheap safety anchor stay as hard nodes.

---

## 1. The Autonomy Controller (was: the Archetype Router)

The entry step still classifies on **three signals** (unchanged):

| Signal | Values | Governs |
|--------|--------|---------|
| **Change archetype** | feature · bug · visual · refactor · schema-migration · research · **docs · dependency-bump** | the spine shape |
| **Criticality / novelty** | core · supporting · generic | modeling depth + how much human framing a task gets (a dial; was "DDD depth") |
| **Reversibility / blast-radius** | reversible · irreversible (shared schema, published contract, destructive migration, outward publish) | **the autonomy ceiling** (promoted) |

It now emits **four** things into `PIPELINE.md`, not one: (a) the node-graph, (b) the **autonomy ceiling**, (c) the **gate shape**, (d) the **verification-intensity vector**. The autonomy ceiling is the new load-bearing output:

| Ceiling | Meaning | Lanes (default) |
|---------|---------|-----------------|
| **full-auto** | no human in the loop; machine oracle + reversible action | visual; deterministic low-blast bug; refactor with adequate characterization coverage |
| **auto + async spot-check** | ships automatically; a *budgeted* human sample reviews post-hoc | feature_generic; non-deterministic bug; thin-coverage refactor |
| **human-gated** | a human reacts before the irreversible act | feature_core; destructive schema-migration; any irreversible publish |

**Iron law (unchanged):** subdomain class is a depth dial, never a spine-switch — a core-domain bug is a `bug`, not a `feature`.
**New override:** an **irreversible surface escalates the ceiling upward regardless of archetype** (a generic CRUD touching a shared schema → human-gated on that slice).
**Binding mechanism (unchanged):** artifact-gates per node read `PIPELINE.md`; the composed track is enforced by gates, not by hope. Durability across compaction: `AGENTS.md` resume directive + `PIPELINE.md` state (symmetric both harnesses).

> **Honesty caveat (CRITIQUE §5).** The full-auto ceiling is only *safe* once the §9 infrastructure exists. Until then full-auto lanes run at **auto + spot-check**; the controller reads an "infra-readiness" flag and refuses to grant full-auto ahead of its enabling legs. De-gating is sequenced (§12), not switched on by preference.

---

## 2. Node superset (updated)

Tracks are compositions over this catalog. Changes from 2.0 marked **[new]** / **[changed]**.

| Node | Paradigm | Produces | Note |
|------|----------|----------|------|
| `grill` | — | `BRIEF.md` (+ for novel-core: domain framing + glossary terms) | **[changed]** interactive intent INPUT, scaled by ceiling: skipped (obvious) / light (generic) / deep+binding (novel-core); absorbs the old domain-framing job |
| `skeleton-anchor` | TDD | a walking-skeleton RED acceptance test from the BRIEF | **[new]** plants an executable anchor *before* the design chain |
| `design-spec` | SDD | `openspec/changes/<id>/` (4 contracts; module design uses glossary terms) | **[changed]** model-self-delegates the design front; the old `domain-model` node is gone |
| *(glossary)* | — | machine-enforced naming registry (spec/test/code identifiers must match `CONTEXT.md`) | **[changed]** a concern, not a node; was "the DDD glossary thread" |
| `arch-review` | SDD | `arch-review.md` | core / schema only |
| `intent-loop` | — | an iterative running-slice the human reacts to | **[new]** replaces abstract sign-off as the core oracle |
| `human-confirm` | SDD | `REVIEW.md` (schema + protocol slice) | **[changed]** narrowed to the irreversible contracts |
| `reproduce` | — | `HYPOTHESIS.md` | confirm only for flaky repros |
| `safety-net` | TDD | characterization suite + green baseline | refactor |
| `smell-scan` | — | `SMELL.md` / `CANDIDATES.md` | auto-pick above coverage threshold |
| `prototype` | — | live `docs/ued/<dt>/` | visual |
| `implement` | TDD | commits + unit tests | size-gated single-pass vs plan/task loop |
| `qa-author` | SDD | e2e tests + `e2e-manifest.md` | from spec only |
| `e2e-run` | — | `e2e-report.md` | read-only |
| `code-review` | — | `CHECKLIST.md` (two-verdict) | read-only |
| `security-gate` | — | SAST + dep-audit + secret-scan report | **[new]** every implementing track |
| `a11y-gate` | — | axe/Lighthouse report | **[new]** UI surfaces |
| `perf-gate` | — | latency / query-count / bundle-size budget check | **[new]** in-flow, not just the sweep |
| `merge` | — | merge to dev | **[changed]** auto on green machine gates |
| `publish` | — | npm/Nexus release | **[changed]** the single human consent gate |
| `canary` | — | staged rollout + telemetry watch | **[new]** post-merge |
| `auto-revert` | — | rollback on bad telemetry/sample | **[new]** the closing actuator |
| `archive` | — | OpenSpec archive + delta-spec sync + `.out-of-scope/` | — |
| `docs-sync` | — | `docs/tech/` as-built + staleness (sparse body) | tail node after archive (unchanged) |

---

## 2A. Skill architecture — three tiers (and the independence rule)

The toolkit is built from three tiers; the dividing principle is **a functional skill never knows the pipeline exists**.

- **Tier 1 — Functional skills (independent, cohesive, standalone-usable).** Each does *one* capability, triggers by description, and can be invoked **directly by a user** (`/tdd`, `/smell-scan`, `/security-scan`) **or by a subagent** inside its context. Examples (mostly carried forward from 1.x): `tdd`, `e2e-test`, `debug`, the guideline skills (`dba`/`develop`/`devops`/`middleware`), `research-source-code`/`-data-source`/`-api`, `vcs-workflow`, `docs-guideline`, `app-ux-design`, `spec-review`, `grill`; plus new ones — `glossary-conformance`, `security-scan`, `a11y-check`, `perf-budget`, `smell-scan`/deletion-test, characterization-test authoring.
  > **The independence rule (non-negotiable):** a Tier-1 skill must **not** import pipeline concepts — it never reads `PIPELINE.md`, never knows about archetypes, ceilings, or gates. It takes inputs, produces outputs. *That* is what makes it usable outside the pipeline. The new security/a11y/perf checks are authored as standalone skills the orchestrator *gates on*, not logic baked into the pipeline.
- **Tier 2 — Subagents (専人専事 = one responsibility per isolated context).** A subagent is a context boundary with a role; inside it, it **composes Tier-1 skills** (e.g. `developer` uses `tdd` + `develop`/`dba-guideline`; `e2e-runner` uses `e2e-test`; `debugger` uses `debug`). A subagent executes one role; it does **not** orchestrate the whole flow. This is what gives the verification triangle its independence (§4).
- **Tier 3 — The orchestration skill (the process; the old `dev-pipeline`'s seat).** The **Autonomy Controller** is the *only* component that knows the archetype tracks, ceilings, gates, `decompose`→unit-DAG, and the rollout. It **dispatches subagents** and reads/writes `PIPELINE.md`. It **implements no capability itself — it arranges.** Process skills may compose (the controller can invoke `research-pipeline` as a sub-flow). Per mattpocock's invocation rule, the orchestration skill may call the auto-triggered functional skills, **never the reverse** (no cycles).

**How this maps to "nodes":** a *node* in a track (§2/§3) is an **orchestration step**, realized one of two ways — an **inline functional-skill call** (cheap, no isolation needed) or a **subagent dispatch** (when 専人専事 / context isolation matters, e.g. anything in the verification triangle). The node is an orchestration concept; Tier-1 skills and Tier-2 subagents are its two implementation vehicles. This split is also what keeps the toolkit **portable** (Tier-1/2 in action vocabulary; only Tier-3's dispatch mechanism differs per harness) and **lean** (capabilities are shared across tracks, not duplicated per track).

---

## 3. The tracks (with ceilings)

```
visual            [full-auto*] prototype → machine perceptual-diff vs baseline → implement → code-review(scoped)
                                → merge → canary → (async sample; auto-revert on regression)
bug (determ.,low) [full-auto*] reproduce → regression-test-first → implement → e2e-run ∥ code-review(scoped)
                                → merge → canary
bug (flaky/high)  [gated/esc]  reproduce → ⟦hypothesis confirm⟧ … or escalate to feature track
refactor (cov.)   [full-auto*] safety-net(characterization) → smell-scan(auto-pick) → implement(no-new-behaviour)
                                → e2e-run ∥ code-review → merge → canary
refactor (thin)   [spot-check] … same, but async human sample before merge
feature_generic   [spot-check] grill → design-spec → security/a11y/perf gates → implement ∥ qa-author
                                → e2e-run ∥ code-review → ⟦async spot-check⟧ → merge → canary → docs-sync
feature_core      [human-gated] grill(deep,binding; frames domain + seeds glossary) → skeleton-anchor(RED)
                                → design-spec(incl. module design, model-self-delegated) → [arch-review only if DDL/cross-module]
                                → ⟦INTENT LOOP: human reacts to a running slice⟧ → human-confirm(schema+protocol)
                                → implement(plan/task) ∥ qa-author → e2e-run ∥ code-review
                                → security/a11y/perf gates → merge → canary → archive → docs-sync
schema (additive) [spot-check] design-spec(DDL) → arch-review(dba) → prod-shadow dry-run → implement(fwd+rollback)
                                → e2e-run(integrity) → ⟦async spot-check⟧ → merge → canary
schema (destruct.)[human-gated] … + ⟦human-confirm⟧ + ⟦publish-style consent before the irreversible op⟧
research-only     [n/a]        research-pipeline → REPORT.md + PROPOSAL.md → terminate
docs              [full-auto]   write/update doc → link + staleness check → merge   (no spec, no TDD, no e2e)
dependency-bump   [full-auto*]  bump → existing test suite + security/dep-audit → canary → merge
                  [→ gated]     escalate to human on MAJOR version (breaking) or a flagged audit finding
```
*`full-auto` is granted only when the §9 infra-readiness flag is set; otherwise the controller downgrades it to `spot-check` (§1 caveat, §12 rollout).*

The reshaped **core** track is the heart of the dual-track design: the human's oracle moment is the **intent loop** (reacting to a running slice), anchored by an executable **skeleton** test planted before the long design chain — not a text sign-off two steps downstream of intent. `human-confirm` survives but narrowed to the **irreversible contracts** (schema + external protocol).

---

## 4. Two paradigms (SDD + TDD) and how domain work is handled — plainly

There is no third "DDD" paradigm. The pipeline runs on two:

- **SDD (middle):** the OpenSpec change is the single contract; `design-spec` includes module design (model-self-delegated, using glossary terms); developer and qa-author derive from it independently.
- **TDD (edge + anchors):** red-green in `implement`; **regression-test-first** in bug; **characterization tests** in refactor; the **skeleton-anchor** RED test planted early on core so the front-half is not a zero-executable-anchor chain.

What used to be called "DDD" is now just three ordinary functions, named for what they do:

- **Criticality / novelty signal** (core / supporting / generic) — a *router dial* (§1) that sets how much design thinking and human framing a task gets. It is not a methodology; it is a routing input.
- **Glossary** — a machine-enforced naming registry: a gate checks that spec / test / code identifiers match `CONTEXT.md`. It is **anti-naming-drift only, not anti-logic-drift** ("passes tests but wrong domain logic" walks straight through it), so it carries **no trust credit** toward replacing human review. The mechanical registry spreads to all lanes; for novel-core, the *correctness of the terms themselves* is part of the intent loop.
- **Domain framing for novel-core** — a step inside `grill` (not a node): for a genuinely new core domain, the deep grill conversation establishes the domain shape and seeds the glossary *before* `design-spec`. This is the one genuinely-valuable thing the old DDD front carried; it lives where intent is captured, judged by the human at the intent loop. Tactical structure (aggregates/invariants) is **not** designed up front — it is checked reactively against real code in the `smell-scan` (§7), where violations are actually detectable.

---

## 5. The verification system (the part that *is* the trust)

The verification triangle (developer ≠ qa-author ≠ e2e-runner / code-reviewer, separate write authority, file-path handoffs, clean-slate verifiers) is preserved. Three critique-driven hardenings:

- **Close the intent-amplifier gap.** The triangle checks code-vs-spec, never spec-vs-intent — the more rigorous it is, the more confidently it can ship not-what-was-meant. Mitigation: (a) the **core intent loop** (§3) is the human oracle the triangle cannot replace; (b) **adversarial-verify is re-aimed** from code-review (where deterministic gates already work) at **intent→spec** — independent re-derivations of the spec from `BRIEF.md`, cross-checked for divergence (honest caveat: convergence catches variance, not shared error).
- **Add the missing classes (was fatal).** `security-gate`, `a11y-gate`, `perf-gate` run in-flow on every implementing track. **Replace line-coverage-% with mutation / property-based oracles** as the implement-node trust signal.
- **Counter model monoculture (blind spot).** developer and qa-author are the same model lineage and can share misreadings, so independent *context* ≠ independent *failure*. Mitigation is **graded by stakes** (recommended default, §13): (1) **mutation/property oracles everywhere** — deterministic, no second LLM, the best per-token defense (already in F5); (2) **a different model family for the verifier role on gated lanes and — non-negotiable — for the unbiased audit** (an audit run by the producer's own model is the monoculture auditing itself, not an audit); (3) **intent-level cross-check only on novel-core**, labelled a floor-raiser, not a guarantee; (4) **accept residual risk on cheap reversible lanes**, where the closed loop + auto-revert is the backstop.
- **Intensity routing (economics).** Adversarial-N, design-it-twice width, and sweep scope are now part of the controller's intensity vector: **N=1 / no fan-out / no sweep on light lanes; deterministic checks run first; escalate-on-disagreement**. The standing sweeps become **event/diff-scoped**, not Cron-default. `PIPELINE.md` carries a per-track token budget.

---

## 6. Human checkpoints — the dual-track gate model

2.0's "exactly one mandatory gate per flow" is replaced by **gate-shape as a function of the autonomy ceiling**:

| Ceiling | Human touchpoints |
|---------|-------------------|
| **full-auto** | **zero in-loop gates.** Optional async sample (budgeted, §13). The human's adjustment on the running app *is* the feedback. |
| **auto + spot-check** | **zero blocking gates;** a budgeted post-hoc sample queue; a confirmed bad sample triggers `auto-revert`. |
| **human-gated** | the **core intent loop** (react to a running slice) + narrowed `human-confirm` (schema+protocol); and the **publish consent** for the irreversible outward act. |

The false "one gate" claim is fixed: **`merge` (reversible) auto-proceeds on green; only `publish` (irreversible) needs consent** — so reversible lanes have *zero* human stops, and even core has at most the intent loop + publish consent.

---

## 6A. Composite prompts & the attention budget (two §13 questions, resolved)

These two were flagged as the questions that gate whether the dual-track is *economically* real. They are coupled: decomposition confines the human to the gated units; the attention budget governs how much the rest is sampled.

### Composite prompts → a unit-DAG; the human is confined to the gated units

A real utterance bundles intents ("add X, fix the bug in Y, restyle Z's button"). Routing the whole bundle at the strictest member's ceiling would gate a visual tweak like a core feature — destroying the dual-track gains. Instead:

- **`decompose` is a cheap router pre-step that no-ops on the common case.** Single-intent prompts return one unit; it fans out *only* when multi-intent is detected — no tax on the majority.
- It emits a **unit-DAG**: each unit carries `{archetype, ceiling, dependencies, shared-surface edges}`. Independent units run in parallel (separate worktrees); dependent units sequence.
- **Two kinds of coordination edge (not one):**
  - *shared irreversible surface* (two units touch the same schema / public contract) → **escalate the ceiling** (not independently safe);
  - *shared mutable file* (two units edit the same source, no schema) → **just sequence them** (never two agents on one file — the common case, fires far more often than the irreversible case).
- **The human is confined to the gated units.** Full-auto / spot-check units never reach the human, so a `[core-feature + bug + visual]` bundle costs the *same* human attention as the core-feature submitted alone — the bug and visual auto-flow. This is what makes decomposition worth doing.

**But the decomposition is itself an intent artifact that nothing per-unit verifies.** A wrong split — carving one coherent intent into pieces that each pass *locally* but collectively miss the point — is invisible to every per-unit gate. Confidence-thresholding cannot save it (convergence catches variance, not shared error — the oracle problem, one level up). So:

- **Any bundle containing a gated unit surfaces the *decomposition itself* at that unit's intent loop** — "I split this into A / B / C; is that the right shape?" The human is already there; it costs nothing and closes the laundering of the split.
- **An all-reversible bundle accepts a wrong split as reversible** — closed-loop territory (a bad split ships, the audit/telemetry catches systematic harm, auto-revert undoes it).

`grill` runs once at the bundle level; each unit inherits its slice of the BRIEF; the novel-core unit gets the deep grill.

### The attention budget → sampling targets systematic drift, not rare catastrophe

> **Terminology — two distinct things, don't conflate them.** The **verifiers** (the §4 triangle: `qa-author`, `e2e-run`, the **`code-review` node**) run *before merge*, on every change, as gates. The **audit** below is a *separate, post-merge* mechanism: it samples changes that have *already auto-shipped*, to catch systematic drift when no human was in the loop. `code-review` ≠ audit. Monoculture mitigation (§5) applies different-model independence to *both*, but the audit is the one place it is non-negotiable.

Async spot-check is not free: attention is finite, and a fixed sampling-% → 0 coverage as auto-volume rises, missing exactly the rare catastrophe. The fix reassigns jobs by what each mechanism is *actually* good at:

- **Acute per-change failures** → deterministic gates (security / a11y / perf / integrity) + the closed loop (canary / telemetry / auto-revert). **Not** human sampling.
- **Systematic / distributional drift** (the model started doing a class of thing wrong across many changes) → human sampling, which is what sampling is good at.
- Neither does the other's job — this dissolves "sampling can't catch the 1-in-1000" (never its job).

Human attention is an explicit **budget B** (review-units/day), allocated as:

1. **gated units** (core/schema intent loops) — unavoidable, bounded by your novel-core volume;
2. **anomaly / low-confidence escalations** the system surfaces;
3. **a small unbiased random audit** of auto-shipped changes.

**(3) is the keystone, not the rounding error — and the one thing never cut under budget pressure.** The obvious priority (cut the audit first) is exactly wrong: the failure this whole design centers on — *confidently-wrong-but-functional* output — does **not** self-flag (model-reported confidence is unreliable precisely where it is dangerous; the intent-amplifier finding). Telemetry catches *behavioral* regressions; "shipped a pile of subtly-wrong code that still functions" is invisible to telemetry and to the model's own confidence — caught **only** by the unbiased audit. Size the audit against the rate at which confidently-wrong drift accumulates damage; under pressure cut proactive (2)-style sampling first, never (3).

**Automation level is throttled by the anomaly rate against the budget, with hysteresis.** If escalations + required audit exceed B, the pipeline is degrading: the controller **auto-downgrades ceilings** (pulls lanes back toward spot-check/gated) until the anomaly rate falls. To avoid oscillation the loop is asymmetric — **downgrade fast, upgrade slow, measured over a window** (the same one-way instinct as the router's escalation).

**The honest capacity ceiling (the concrete Amdahl answer).** Human throughput is bounded by *novel-core volume + the required audit*, independent of how good the automation is. If that floor alone exceeds the daily budget, the system is over-capacity no matter how good the robots are. For your half-half mix the gating resource is **your novel-core review capacity**, not the pipeline's cleverness — so the highest-leverage scaling move is shrinking the novel-core fraction (reuse, templates, turning novel domains into supporting ones over time), not making the automation fancier.

---

## 7. Parallelism (unchanged, honest)

`implement` ∥ `qa-author` (Phase 1), `e2e-run` ∥ `code-review`, research / design-it-twice fan-out, per-bounded-context worktrees for multi-BC core builds. The QA boot-boundary remains a real main-agent-only seam (two-phase QA + SendMessage); statelessness does not remove it.

## 8. Knowledge persistence (unchanged)

`capture` (inline, sparse-gated, main-agent single writer) + `docs-sync` (in-pipeline tail node after `archive`, present-always / sparse body) + `/forge-tidy` (scheduled, proposes-never-deletes). See PROPOSAL.md §7B.

---

## 9. The post-merge closed loop (new — the missing actuator)

2.0 was end-to-end **pre-merge open-loop**: rich feed-forward verification, zero outcome feedback. For any lane to be *genuinely* full-auto, the loop must close after merge:

- **`canary`** — staged/percentage rollout watched against telemetry (error rate, latency, key business metrics).
- **`auto-revert`** — automated rollback when telemetry or a spot-check sample confirms a regression. This is the actuator that makes de-gating safe: a wrong auto-merge is *caught and undone* without a human in the loop.
- **`/forge-sweep` becomes outcome-driven too** — not only code-smell-driven; it consumes production signals so the system learns whether shipped software actually works.

This subsystem is **the leg that the reversible-lane de-gating (the crutch) depends on** — see rollout (§12).

---

## 10. Built-ins & portability (unchanged + intensity)

Symmetric main flow (router/controller, node superset, tracks, artifact-gates, verification triangle, the dual-track gate model, the glossary thread) in action vocabulary; per-harness only the acceleration substrate differs (Workflow vs same-message dispatch; `AGENTS.md`+`PIPELINE.md` durability symmetric; worktrees; browser). The controller's **intensity vector** is also symmetric; only its *execution* (Workflow fan-out vs batch dispatch) differs. Codex manifest carries no hooks field; the closed-loop `canary`/telemetry hooks into the host CI/CD on both sides.

---

## 11. The honest residue & what's reachable (dual-track)

- **Reachable (your ~half):** visual, deterministic bug, covered refactor → full-auto once §9 infra is live; generic feature, additive schema → auto + spot-check. For this half, "fully-automated vibe coding" is a real target.
- **Irreducible (your other ~half):** the **intent loop for a novel core domain** (a human reacting to a behaving artifact, saying "no, not that") and **consent for an irreversible outward act**. No oracle, budget, or engineering removes these — they are the category, not the cost. The goal here is honestly *maximal automation around them*, not their elimination.

---

## 12. Rollout in dependency order (crutch & leg)

The de-gating of reversible lanes is only *safe* behind infrastructure that doesn't exist yet. Build order is therefore forced:

- **Phase A — no-dependency, adopt now (robust regardless of any open question):**
  1. Promote the router to the Autonomy Controller (ceiling + gate-shape + intensity vector).
  2. Split `release` → `merge` (auto) + `publish` (consent).
  3. Add `security-gate` / `a11y-gate` / `perf-gate`; swap coverage-% → mutation/property oracles.
  4. Correct the glossary (no trust credit, machine-enforced, spread mechanically); drop tactical-DDD to the sweep.
  5. Route verification intensity by ceiling; event-scope the sweeps; surface token budget.
- **Phase B — build the legs:**
  6. Post-merge closed loop: `canary` + telemetry + `auto-revert` — **orchestrated into the project's existing CD/telemetry if present; if the project has none, the plugin can't build it and reversible lanes stay at `auto + spot-check`** (see Delivery boundary below).
  7. Multi-model / mutation verification to break monoculture; a real spot-check **attention budget** (so sampling coverage is honest, not "free").
  8. The core **intent loop** + `skeleton-anchor` (reshape the core gate).
- **Phase C — de-gate, paced by Phase B readiness:**
  9. Flip reversible lanes from spot-check → full-auto **at the rate the §9 actuator and the attention budget come online** — never ahead of them.

**A necessary distinction (so Phase A doesn't look like it de-gates early):** auto-**merge-to-dev** is safe in Phase A *because the merge is reversible* (it's a git operation on the integration branch, trivially revertible) — it needs no closed loop. What the Phase-B closed loop gates is the **deploy / publish** stage and the **full-auto lane through to production**, where the action becomes hard-to-reverse. So "auto-merge-to-dev" (Phase A) and "full-auto lane through deploy" (Phase C) are different things: the former is reversible-and-safe-now, the latter needs the §9 actuator. `publish` consent stays human throughout.

Pulling the crutch (gates) before the leg (closed loop + multi-model verification) trades a safe-but-slow pipeline for a fast-but-blind one — but only for the irreversible stages; reversible automation (dev merge) is free to ship in Phase A.

### Delivery boundary — what this plugin can actually author

gen-ai-development is a **markdown skills / agents / manifest plugin**. Not everything in 2.1 is authorable in that medium; being honest about the line is what keeps the skill-creator hand-off real. Three buckets:

- **Authorable in the plugin now (the real deliverable):** the router/controller-as-skill, the archetype tracks, gate shapes, `grill`, the verification triangle via subagents, paradigm handling, the glossary-conformance check, `decompose`→unit-DAG, the different-model audit (the subagent `model` override exists in-harness), and the security/a11y/perf gates *as "the agent runs SAST / axe / Lighthouse and gates on the output"* — the same shape as 1.x's e2e-runner driving tools and reading results.
- **Project / CI infrastructure the plugin can only ORCHESTRATE, not build:** the post-merge closed loop — `canary`, telemetry, `auto-revert`. Most projects adopting this plugin have no CD or telemetry; the plugin can *wire into* a project's existing canary/telemetry/rollback, but it cannot create that infrastructure.
- **Aspirational / discipline-dependent:** the attention-budget controller with hysteresis + anomaly-rate auto-downgrade needs reliable cross-session outcome logging and rate computation — fragile in an LLM-driven loop. Treat it as a goal the design *aims at*, not a Phase-B item you can simply "build."

**Consequence for the rollout:** Phase C de-gating rests on the Phase-B closed loop, which is the *least* plugin-authorable piece. So the honest Phase-B caveat is: **orchestrate the closed loop only if the project already has CD + telemetry + rollback; if it does not, the plugin cannot supply them, and the reversible lanes stay at `auto + spot-check` rather than `full-auto`.** Full-auto is earned by the *project's* infrastructure, not granted by the plugin alone.

---

## 13. Open questions that remain (the owner's calls)

All five original open questions are now settled. Two were resolved in **§6A**; the remaining three were genuine owner calls and were **confirmed by the owner (2026-06-27)** — the recommended defaults below were each chosen.

- ~~**Composite prompts**~~ → **resolved (§6A).**
- ~~**Spot-check attention budget**~~ → **resolved (§6A).**

**1. Cold-start → recommended default: no seeding ceremony for greenfield; a one-time `codebase-map` pass for brownfield.**
Seeding only helps when there is something to seed *from*. A truly empty repo has no code to map and no behavior to characterize, so there is nothing to seed — and that is fine: **the first chunk of any project (establishing the core domain + scaffolding) is genuinely novel-core and *should* be human-gated. The bootstrap being mostly gated is correct, not a failure.** The transition to steady-state is automatic and gradual — as `CONTEXT.md` (glossary), the bounded-context map, and test coverage accumulate, the controller's signals strengthen and lanes unlock on their own. A **brownfield** repo (existing code, no gen-ai-dev artifacts) is the case that *does* benefit from a one-time `codebase-map` seeding pass (real code to classify, real behavior to characterize), run once before routing. Discriminator: *is there existing code/behavior to learn from.*

**2. Archetype taxonomy → recommended default: add both `docs` and `dependency-bump` as thin archetypes; keep the taxonomy open.**
The test for "deserves its own archetype" is *does it need a materially different node-graph.* Both do, and adding them validates the grid rather than breaking it:
- **`docs`** (the deliverable *is* documentation): reversible, no test oracle needed, no domain intent, no security/perf surface → a thin **full-auto** graph (write → link + staleness check → merge). Distinct from `docs-sync` (which is the tail node of a *code* change). High-frequency, trivially cheap to add.
- **`dependency-bump`**: reversible in git, but its real risk is **supply-chain** (a security-gate concern, not a human-intent one) and its correctness oracle is the *existing* test suite + dep-audit → **full-auto for patch/minor** behind green existing tests + clean audit; **escalate to human for major** (breaking changes = possible behavior change needing judgment) or any flagged audit finding.
- General principle: a new archetype earns its place only when a genuinely different graph *recurs*; otherwise route to the nearest existing one. Keep the set extensible.

**3. Monoculture mitigation → recommended default: graded by stakes (see §5).**
(1) mutation/property oracles everywhere (deterministic, best per-token); (2) a different model family for the verifier role on gated lanes and — **non-negotiable** — for the unbiased audit (an audit by the producer's own model is monoculture auditing itself); (3) intent-level cross-check only on novel-core, as a floor-raiser; (4) accept residual risk on cheap reversible lanes (closed loop + auto-revert is the backstop). Not all-or-nothing — independence is bought where the stakes justify its cost, consistent with intensity routing (F8).

With these owner-confirmed decisions the design has **no open questions left**. The natural next step, if the design is accepted, is the skill-creator implementation in the Phase A→B→C dependency order (§12).
