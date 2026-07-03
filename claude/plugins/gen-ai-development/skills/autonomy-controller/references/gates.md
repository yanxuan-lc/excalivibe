# Gates — the dual-track gate model, freshness, and the attention budget

Gates are how the composed track is *enforced* rather than merely *hoped for*. Every gate
reads `PIPELINE.md` + the artifacts on disk; a gate "holds" only when every listed check
passes against files on disk. Report which check failed when blocking. This is the
binding mechanism: artifact-gates read `PIPELINE.md`, so the controller's emitted track,
ceiling, and gate-shape are the law the run is held to.

## Part 1 — The gate shape is a function of the ceiling

The number and kind of human touchpoints is set by the autonomy ceiling, not fixed.

### full-auto → 0 gates
- **Zero in-loop gates.** No human blocks anything.
- The only human signal is an **optional async sample** (drawn from the attention budget,
  Part 3). The human's adjustment on the running app *is* the feedback.
- Safe **only** behind the post-merge closed loop (canary + telemetry + auto-revert). The
  controller refuses this shape unless the `infra-readiness` flag is set; otherwise it
  downgrades the lane to spot-check.

### auto + spot-check → async budgeted sample
- **Zero blocking gates.** The change ships on green machine gates.
- A **budgeted post-hoc sample** is queued for human review (Part 3 sizes it). A
  confirmed bad sample triggers `auto-revert`.
- Sampling targets *systematic drift*, not the rare per-change catastrophe (Part 3).

### human-gated → architecture gate + intent gate + publish consent
Three touchpoints, each placed where only a human can judge. **The two pre-merge gates
judge different things and do not substitute**: the architecture gate evaluates *structure*
(is it well-built), the intent gate evaluates *behavior* (is it the right thing).
- **架构门 / architecture gate (pre-code, structural soundness)** — the human reviews the
  architecture-review document `REVIEW.md` BEFORE implementation, to judge whether the
  design's boundaries are sound and extensible while a change still costs a spec edit, not
  a rewrite. `REVIEW.md` is the four-layer doc (framing → domain model + the four contracts
  module/interface/database/use-cases → key decisions with alternatives & trade-offs →
  cross-cutting quality), produced by the `review-doc` skill, scaled by the depth dial.
  Freshness: re-derive the spec fingerprint and compare with `REVIEW.md`'s stamp — stale
  means the user would review an old design; regenerate first. Feedback routes to `planner`
  as spec revisions; `REVIEW.md` is regenerated, never edited in place. (This is the
  `human-confirm` node in `PIPELINE.md`.)
- **意图门 / intent gate (behavioral intent, on a running slice)** — the human reacts to a
  *running slice* (a behaving artifact), saying "no, not that." This catches what the
  architecture gate and the verification triangle structurally cannot: spec-vs-intent
  (they only check code-vs-spec). Default realization: a **disposable prototype** the human
  iterates on until intent is confirmed, THEN the formal pipeline builds the real thing
  (architecture gate → TDD → verify) — the prototype is never silently promoted to
  production. Behavioral-intent decisions the architecture review parked ("→ intent gate")
  are resolved here. For a composite bundle, the **decomposition itself is surfaced here**
  ("I split this into A / B / C — right shape?"). (This is the `intent-loop` node.)
- **Publish consent** — the single human stop for the irreversible *outward* act
  (`publish`). Stays human throughout every phase of rollout.

Core/novel work gets both pre-merge gates; reversible/generic lanes get neither heavy gate
— the architecture review lightens via the depth dial (often to nothing on generic), and
there is no intent loop (the human's adjustment on the shipped app is the feedback).

**The release split is what removes the false "one gate per flow":** `merge` (reversible,
to the integration branch) auto-proceeds on green; only `publish` (irreversible, outward)
needs consent. Reversible lanes have *zero* human stops; even core has at most the
architecture gate + intent gate + publish consent.

## Part 2 — Mechanical gates (artifact + freshness checks)

These run on **every** implementing track regardless of ceiling — they are the
deterministic backstop that lets human gates be removed.

### Spec gate — before `implement` / `e2e-author`
- `openspec/changes/<id>/` exists with the 4 contracts and acceptance scenarios carrying
  stable IDs (`S1`, `S2`, …) and an execution-carrier declaration (scripted /
  agent-driven / `existing-suite` — the last legal only on the small lane).
- On a **human-gated** lane: the architecture-gate (`human-confirm`) and intent-gate
  (`intent-loop`) rows in `PIPELINE.md` are satisfied. On full-auto / spot-check lanes
  there is no human design sign-off to wait on.

### In-flow class gates — `security` / `a11y` / `perf`
- `security-gate`: SAST + dep-audit + secret-scan report present and clean (or findings
  triaged below the blocking threshold).
- `a11y-gate`: axe / Lighthouse report present and within budget (UI surfaces only).
- `perf-gate`: latency / query-count / bundle-size within the declared budget.
- The trust signal for `implement` is **mutation / property-based oracles**, not
  line-coverage-%.

### Merge gate — before `merge` → dev (the hard gate)
All checked against files on disk:
1. **Code review closed** — `code-review`'s `CHECKLIST.md`: every P0 and P1 item Resolved
   (two verdicts: spec-compliance separate from code-quality). P2/P3 may remain (tracked).
2. **E2E green** — `e2e-report.md`: all executed scenarios passed (user-visible result
   **and** DB writes — verified by the runner itself, or suite-asserted per the manifest's
   `db-assert` declarations and re-verified by sampling); scenario coverage **executed +
   manually-verified + waived = M**; the project's existing suite also green.
3. **Unit gate held** — `implement` reported tests green, mutation/property oracles
   satisfied, lint clean (re-verify only if the fix loop touched code after that report).
4. **Verdict freshness** — both artifacts name the commit they were produced against and
   **both match the merge candidate's HEAD**. A green report from an earlier commit is
   stale; any fix after it requires the corresponding re-run. This prevents the classic
   leak (e2e green on commit X, review fix lands Y, Y merges on X's report).
5. **`PIPELINE.md` current** — all phases above merge are `[x]` or `[-]`-with-reason; the
   ceiling and gate-shape rows are present.

Checks 1–4 bind to the nodes the composed track actually contains. A node the track
omits still gets a `[-]`-with-reason row in `PIPELINE.md` (per pipeline-schema.md), and
the gate reads that row; a node that IS in the track but unrun still blocks. Omitting e2e
nodes is legal **only on the small lane tracks.md defines** (feature_generic-small): there
check 2 is discharged by the `existing-suite` node instead — the project's suite green,
**commit-stamped == merge-candidate HEAD** (re-run after any fix round), with
`coverage: n/a (small lane; scenarios covered by unit tests named in tdd-evidence.md +
code-review Verdict A)` recorded. On every other track the e2e node is non-omittable.

`merge` auto-proceeds when this gate holds *and* the ceiling permits (full-auto /
spot-check: no further human stop; human-gated: the intent-loop / confirm rows are
already satisfied). If any check fails, do not merge — route the failure (product bug →
`developer`; test bug → `e2e-author`; review findings by code ownership), run a fix-loop
round, re-check including freshness.

### Publish gate — before `publish` (irreversible, outward)
- The merge gate held and the change is on the target branch.
- **Explicit user consent recorded.** Nothing publishes without it — this gate is never
  auto-satisfied, on any ceiling, in any phase.

## Part 3 — The attention budget

Async spot-check is **not free**: attention is finite, and a fixed sampling-% → 0
coverage as auto-volume rises, missing exactly the rare catastrophe. The fix reassigns
jobs by what each mechanism is actually good at — do not make any one mechanism do
another's job:

- **Acute per-change failures** → deterministic gates (security / a11y / perf /
  integrity) + the closed loop (canary / telemetry / auto-revert). **Not** human
  sampling.
- **Systematic / distributional drift** (the model started doing a class of thing wrong
  across many changes) → human sampling, which is what sampling *is* good at.

Human attention is an explicit **budget B** (review-units/day), allocated to three jobs:

1. **Gated units** — core/schema architecture gates + intent gates. Unavoidable; bounded
   by novel-core volume.
2. **Anomaly / low-confidence escalations** the system surfaces.
3. **A small unbiased random audit** of *already auto-shipped* changes.

While `budget-B: n/a` (no explicit budget set), use a fixed default so neither mechanism
silently vanishes: sample roughly one auto-shipped change per ten merges (user-adjustable)
and record in `PIPELINE.md` what was actually sampled.

### (3) is the protected keystone — never cut under budget pressure
The obvious priority (cut the audit first) is exactly wrong. The failure this whole design
centers on — **confidently-wrong-but-functional output** — does *not* self-flag
(model-reported confidence is unreliable precisely where it is dangerous). Telemetry
catches *behavioral* regressions; "shipped a pile of subtly-wrong code that still
functions" is invisible to telemetry and to the model's own confidence — caught **only**
by the unbiased audit. So:

- Size the audit against the rate at which confidently-wrong drift accumulates damage.
- Under pressure, cut proactive (2)-style sampling first, **never (3)**.
- **The audit is run by a different model family — non-negotiable.** An audit run by the
  producer's own model is the monoculture auditing itself, not an audit. (This is
  distinct from the verifiers — `e2e-author`, `e2e-run`, `code-review` — which run
  *before* merge as gates. The audit is post-merge and samples shipped changes. Different-
  model independence applies to both, but on the audit it is the one place it is
  non-negotiable.)
- **Realization (this harness):** the Claude Code `Agent` tool dispatches Anthropic-family
  models only, so a different-family audit cannot run in-harness. Realize it through the
  dual scaffold — run the audit as the **Codex-side** `code-reviewer` (GPT family) in
  post-merge-audit mode — or via an external different-family CLI. A same-family audit
  does **not** discharge this requirement: record the gap in `PIPELINE.md` rather than
  silently downgrading. The same applies to the *pre-merge* different-family verifier on
  gated lanes: use it where the harness permits, otherwise record the gap. Concrete
  invocation: drive the other scaffold's CLI non-interactively (`codex exec` from the
  Claude side / `claude -p` from the Codex side).

### Anomaly-rate auto-downgrade, with hysteresis
If escalations + required audit exceed B, the pipeline is degrading: the controller
**auto-downgrades ceilings** (pulls lanes back toward spot-check/gated) until the anomaly
rate falls. To avoid oscillation the loop is asymmetric — **downgrade fast, upgrade slow,
measured over a window** (the same one-way instinct as the irreversible-surface
escalation). The current anomaly rate, budget B, and ceiling-downgrade state are carried
in `PIPELINE.md` (see references/pipeline-schema.md). When `PIPELINE.md` carries
`anomaly-rate: n/a` — no real measurement mechanism exists yet — this loop is **inert**:
never fabricate a rate to activate it.

### The honest capacity ceiling
Human throughput is bounded by **novel-core volume + the required audit**, independent of
how good the automation is. If that floor alone exceeds B, the system is over-capacity no
matter how good the robots are — the highest-leverage scaling move is shrinking the
novel-core fraction (reuse, templates, turning novel domains into supporting ones), not
making the automation fancier.
