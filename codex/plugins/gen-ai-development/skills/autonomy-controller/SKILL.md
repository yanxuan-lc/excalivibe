---
name: autonomy-controller
description: Use this at the START of any development task that builds or changes runnable product code — a feature, a bug, a visual/UI change, a refactor, a schema migration, a docs change, a dependency bump ("做个新功能", "改个 bug", "走流程", "按 openspec 来") — to decide how much of it can run unattended and to route it through the right track. Also use when RESUMING an in-flight change (an `openspec/changes/<id>/PIPELINE.md` exists, or the user says "继续 xxx"), when a task bundles several intents in one utterance, or whenever deciding whether a change is safe to ship without a human in the loop. It is NOT for non-coding work — authoring skills/agents/commands/prompts (skill-creator owns that), or research-only exploration.
---

# Autonomy Controller — Orchestration for the Main Agent

This skill is for the **main agent**. It is the *only* pipeline-aware component in the
toolkit: it classifies a task, sets how much autonomy that task is allowed, composes the
track, spawns the agents that do the work, and reads/writes the durable state.
**It implements no capability itself — it arranges.** Every capability lives in a
functional skill (`tdd`, `grill`, `security-scan`, …) or an agent (`developer`,
`qa-author`, `e2e-runner`, `code-reviewer`, `planner`, `arch-reviewer`, `debugger`,
`release-coordinator`, `researcher`). The controller calls them; they never call it.

Design philosophy: **autonomy is set, not assumed.** The old pipeline asked only "which
nodes." This one asks first "how far can this run without a human," then composes the
node-graph, the gate *shape*, and the verification *intensity* to match that answer.

## Step 1 — Classify on three signals

Make this classification once, out loud, at task start. The three signals are
independent and each governs a different thing — keep their roles distinct:

| Signal | Values | Governs |
|--------|--------|---------|
| **Change archetype** | feature · bug · visual · refactor · schema-migration · research · docs · dependency-bump | the **spine** (which track) |
| **Criticality / novelty** | core · supporting · generic | the **depth dial** — how much design thinking and human framing the task gets |
| **Reversibility / blast-radius** | reversible · irreversible (shared schema, published contract, destructive migration, outward publish) | the **autonomy ceiling** |

**Iron law (non-negotiable):** the criticality/novelty signal is a *depth dial, never a
spine-switch*. A core-domain bug is a `bug` track run deeper — it is **not** promoted to
a `feature`. The archetype alone picks the spine; criticality only turns the design/
framing depth up or down within it.

## Step 2 — Set the autonomy ceiling

The reversibility signal sets a per-task **ceiling** — the most autonomy this task may
have. The controller emits it into `PIPELINE.md` alongside the track.

| Ceiling | Meaning | Default lanes |
|---------|---------|---------------|
| **full-auto** | no human in the loop; machine oracle + reversible action only | visual; deterministic low-blast bug; refactor with adequate characterization coverage |
| **auto + spot-check** | ships automatically; a *budgeted* human sample reviews post-hoc | generic feature; non-deterministic bug; thin-coverage refactor; additive schema; dependency-bump |
| **human-gated** | a human reacts before the irreversible act | core feature; destructive schema-migration; any irreversible publish |

Two overrides move the ceiling — and they move it in **opposite directions**, so do not
collapse them:

- **Irreversible-surface escalation (one-way, UP).** An irreversible surface escalates
  the ceiling *regardless of archetype*. A generic CRUD that touches a shared schema or a
  published contract is human-gated **on that slice** — even though "generic CRUD" would
  default to spot-check. Escalation is one-way; nothing demotes a task below the ceiling
  an irreversible surface forces.
- **Anomaly auto-downgrade (UP toward gated, with hysteresis).** When the running
  anomaly rate against the attention budget says the pipeline is degrading, the
  controller pulls lanes back toward spot-check/gated until it recovers. This is a
  *runtime* throttle, asymmetric by design — downgrade fast, upgrade slow, measured over
  a window. See [references/gates.md](references/gates.md).

The iron law ("never spine-switch") is about the archetype. The ceiling, by contrast, is
**not** fixed — it escalates up on irreversible surfaces and auto-downgrades on anomaly.
Keep these separate.

### Infra-readiness gates full-auto

`full-auto` is *granted* only when an **infra-readiness flag** is set — i.e. the project
has the post-merge closed loop (canary + telemetry + auto-revert) that makes de-gating
safe. **Until that infra exists, the controller refuses full-auto and downgrades every
full-auto lane to `auto + spot-check`.** Full-auto is earned by the *project's*
infrastructure, not granted by the plugin. Read the flag from `PIPELINE.md`
(`infra-readiness:`); when unset, treat every `[full-auto*]` lane as `[spot-check]`.

## Step 3 — Decompose composite prompts into a unit-DAG

A real utterance often bundles intents ("add X, fix the bug in Y, restyle Z's button").
Run **`decompose`** as a cheap router pre-step *before* setting per-task ceilings:

- **No-op on the common case.** A single-intent prompt returns one unit — no tax on the
  majority. It fans out *only* when multi-intent is detected.
- **Emit a unit-DAG.** Each unit carries `{archetype, ceiling, dependencies,
  shared-surface edges}`. Independent units run in parallel (separate worktrees);
  dependent units sequence.
- **Two kinds of coordination edge — do not conflate:**
  - *shared irreversible surface* (two units touch the same schema / public contract) →
    **escalate the ceiling** (the units are not independently safe);
  - *shared mutable file* (two units edit the same source, no schema) → **just sequence
    them** (never two agents on one file — the common case, fires far more often).
- **Confine the human to the gated units.** Full-auto / spot-check units never reach the
  human, so a `[core-feature + bug + visual]` bundle costs the *same* human attention as
  the core-feature alone — the bug and visual auto-flow. That is what makes decomposition
  worth doing.
- **The split itself is an unverified intent artifact.** A wrong split — carving one
  coherent intent into locally-passing pieces that collectively miss the point — is
  invisible to every per-unit gate, and confidence-thresholding cannot catch it. So:
  **any bundle containing a gated unit surfaces the decomposition itself at that unit's
  intent loop** ("I split this into A / B / C — is that the right shape?"). The human is
  already there; it costs nothing. An all-reversible bundle accepts a wrong split as
  reversible — the closed loop is the backstop.

`grill` runs once at the bundle level; each unit inherits its slice of the `BRIEF.md`,
and the novel-core unit gets the deep grill.

## Step 4 — Compose the track and emit four outputs

For each unit, the archetype + criticality + ceiling select a **track** — a composition
over the node catalog. The controller emits **four** things into `PIPELINE.md`, not one:

1. **the node-graph** (the track),
2. **the autonomy ceiling** (Step 2),
3. **the gate shape** (a function of the ceiling — see Step 6),
4. **the verification-intensity vector** (Step 7).

The full per-archetype tracks, with their ceilings, are in
[references/tracks.md](references/tracks.md). The node catalog is shared across tracks —
capabilities are not duplicated per track.

### A node is realized two ways

A *node* in a track is an **orchestration step**, not a skill. The controller realizes
each node one of two ways:

- **inline functional-skill call** — cheap, no context isolation needed (e.g. a
  staleness check, a `grill` pass, a guideline consult);
- **agent dispatch** — when 専人専事 / context isolation matters (everything in the
  verification triangle: `developer`, `qa-author`, `e2e-runner`, `code-reviewer`; also
  `planner`, `arch-reviewer`, `debugger`, `release-coordinator`).

The node is the orchestration concept; Tier-1 skills and Tier-2 agents are its two
implementation vehicles. This split is what keeps the toolkit portable and lean.

## Step 5 — Spawn the agents

- **Parallel-first**: independent dispatches go in one message. `implement` ∥
  `qa-author` start from the same confirmed spec; `e2e-run` ∥ `code-review` are both
  read-only and always dispatched together. The harness's parallel-dispatch substrate
  may fan out deterministic, no-human segments; the *track, gates, and artifacts are
  identical* whether or not it does.
- **The QA boot-boundary is a real main-agent seam.** `qa-author` works two-phase: a
  spec-only draft (parallel with `developer`), then — after `developer` delivers and the
  main agent boots the app — a continuation that finalizes against the real DOM. An
  agent runs once and returns; it cannot wait for another.
- **Judgment stays home.** Agent outputs are inputs to the controller's decision, not
  verdicts to forward blindly. Read the key artifacts (the spec, the diff, the reports)
  yourself before acting on them.
- **Agents can't talk to the user.** If one returns parked questions (open_questions)
  instead of results, relay them to the user verbatim and continue the same agent with
  the answers — never answer on the user's behalf.

The controller may also invoke another process skill as a sub-flow — e.g. dispatch the
**`research-pipeline`** for the `research` archetype. Process skills compose; the
auto-triggered functional skills never call back up into the controller (no cycles).

## Step 6 — Gate by ceiling shape

The number and kind of human touchpoints is a **function of the ceiling**, not a fixed
"one gate per flow":

- **full-auto** → zero in-loop gates; the only human signal is an optional async sample.
- **auto + spot-check** → zero *blocking* gates; a budgeted post-hoc sample; a confirmed
  bad sample triggers `auto-revert`.
- **human-gated** → two pre-merge human gates that judge different things and do not
  substitute — the **架构门 / architecture gate** (`human-confirm`: the human reviews the
  four-layer `REVIEW.md` for structural soundness, pre-code) and the **意图门 / intent
  gate** (`intent-loop`: the human reacts to a running slice for behavioral intent, via a
  disposable prototype, iterated to confirmation) — plus the **publish consent** for the
  irreversible outward act.

The release step is split: **`merge` (reversible, to the integration branch)
auto-proceeds on green machine gates; only `publish` (irreversible, outward) needs human
consent.** So reversible lanes have *zero* human stops, and even core has at most the
intent loop + publish consent. Exact gate definitions, freshness checks, and the
attention budget: [references/gates.md](references/gates.md).

## Step 7 — Route verification intensity

Verification cost is matched to stakes via the **intensity vector** the controller emits:

- **Light lanes**: adversarial-N = 1, no design-it-twice fan-out, no standing sweep;
  deterministic checks (security / a11y / perf / integrity) run *first*; escalate to a
  second pass only on disagreement.
- **Gated lanes**: a **different model family** for the verifier role (independent
  *context* is not independent *failure* — same lineage shares misreadings).
- **Mutation / property-based oracles everywhere** as the `implement`-node trust signal —
  not line-coverage-%. Deterministic, no second LLM, best per-token defense.
- **Intent-level cross-check only on novel-core**, labelled a floor-raiser, not a
  guarantee (convergence catches variance, not shared error).
- Standing sweeps are **event/diff-scoped**, never schedule-default. `PIPELINE.md`
  carries a per-track token budget.

The post-merge **unbiased audit** (different model family, non-negotiable) is a separate,
budget-protected mechanism — see [references/gates.md](references/gates.md). It is not a
verifier; it samples already-shipped changes to catch systematic drift.

## State & durability — PIPELINE.md

All routing decisions and phase status live in `openspec/changes/<id>/PIPELINE.md` so any
session resumes without relying on conversation memory. Create it when the change dir is
created; backfill phases that happened before activation. The controller is the writer;
artifact-gates are the readers.

- **The binding mechanism:** every gate reads `PIPELINE.md` and the artifacts on disk —
  the composed track is enforced by gates, **not by hope or memory**. A gate "holds" only
  when its checks pass against files on disk; report which check failed when blocking.
- **On resume, read `PIPELINE.md` first — it outranks memory.** The presence of the
  change dir is the activation marker; the file's rows are the source of truth for what
  is done, skipped (with reason), or pending.
- **Compaction durability.** The controller's working context can be compacted away
  mid-flight. Two things make a resume reliable and symmetric across harnesses: the
  **`AGENTS.md` resume directive** (a standing instruction to re-read `PIPELINE.md` and
  resume the controller before doing anything else) + the **`PIPELINE.md` durable state**
  itself. Neither depends on what the model still remembers.

The exact `PIPELINE.md` format — the four controller outputs, the per-node rows, the
unit-DAG for composite prompts, the budget/anomaly fields — is in
[references/pipeline-schema.md](references/pipeline-schema.md).

## Rollout & the delivery boundary

This toolkit ships in dependency order — de-gating a reversible lane is only *safe*
behind infrastructure that may not exist yet.

- **Phase A (adopt now, no dependencies):** the controller (ceiling + gate-shape +
  intensity vector); split `release` → auto-`merge` + consent-`publish`; the in-flow
  `security` / `a11y` / `perf` gates and mutation/property oracles; machine-enforced
  glossary with no trust credit; intensity routing + event-scoped sweeps + token budget.
  Auto-**merge-to-dev** is safe here because the merge is reversible (a git operation on
  the integration branch); it needs no closed loop.
- **Phase B (build the legs):** the post-merge closed loop (`canary` + telemetry +
  `auto-revert`); multi-model / mutation verification; a real attention budget; the core
  **intent gate** (disposable-prototype intent loop).
- **Phase C (de-gate, paced by B):** flip reversible lanes from spot-check → full-auto
  *at the rate the closed loop and the attention budget come online* — never ahead of
  them.

**The delivery boundary (be honest about it):** this is a markdown skills/agents/manifest
plugin. The post-merge closed loop is **orchestrate-if-the-project-has-CD, not
plugin-built** — the controller can *wire into* a project's existing
canary/telemetry/rollback, but it cannot create that infrastructure. **If the project has
no CD + telemetry + rollback, the reversible lanes stay at `auto + spot-check`, never
`full-auto`.** That is exactly what the infra-readiness flag (Step 2) encodes.
