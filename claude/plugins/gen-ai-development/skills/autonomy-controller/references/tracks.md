# Tracks — per-archetype compositions, with ceilings

Each track is a composition over the shared node catalog. The ceiling in brackets is the
**default**; an irreversible surface escalates it upward (one-way), and the
infra-readiness flag downgrades any `[full-auto*]` to `[spot-check]` until the project's
post-merge closed loop exists (see SKILL.md Step 2). `∥` = dispatched in one message
(parallel); `→` = sequenced; `⟦ … ⟧` = a human touchpoint.

`*` on a ceiling = **granted only when the infra-readiness flag is set**; otherwise the
controller runs the lane at `spot-check`.

## Node catalog (shared across tracks)

| Node | Produces | Realized as |
|------|----------|-------------|
| `decompose` | unit-DAG (no-op on single intent) | inline (controller pre-step) |
| `grill` | `BRIEF.md` (+ for novel-core: domain framing + glossary seeds) | inline (`grill` skill) |
| `design-spec` | `openspec/changes/<id>/` (4 contracts; module design via glossary terms) | subagent (`planner`) |
| `inline-spec` | minimal spec in `openspec/changes/<id>/` (small generic feature only; all 4 contracts, n/a ones explicitly marked; stable-ID scenarios) | inline (controller) |
| `existing-suite` | project's existing test suite run green, commit-stamped in `PIPELINE.md` (the small lane's e2e evidence) | inline (test runner) |
| `arch-review` | `arch-review.md` | subagent (`arch-reviewer`) — core / schema only |
| `intent-loop` | 意图门: a disposable running slice the human reacts to, iterated until intent is confirmed (then the formal pipeline builds the real thing) | prototype build + ⟦human⟧ |
| `human-confirm` | 架构门: `REVIEW.md` — architecture review (framing + domain model + the 4 contracts module/interface/db/use-cases + key decisions + cross-cutting), scaled by depth dial | inline + ⟦human⟧ (`review-doc` skill) |
| `reproduce` | `HYPOTHESIS.md` | subagent (`debugger`) — confirm only for flaky repros |
| `safety-net` | characterization suite + green baseline | subagent (`developer`) |
| `smell-scan` | `SMELL.md` / `CANDIDATES.md` | inline (`smell-scan` skill) |
| `prototype` | live `docs/ued/<dt>/` | inline (`app-ux-design` skill) |
| `implement` | commits + unit tests | subagent (`developer`, `tdd`) |
| `e2e-author` | e2e tests + `e2e-manifest.md` (from spec only) | subagent (`e2e-author`) |
| `e2e-run` | `e2e-report.md` (read-only) | subagent (`e2e-runner`, `e2e-test`) |
| `code-review` | `CHECKLIST.md` (two-verdict, read-only) | subagent (`code-reviewer`) |
| `security-gate` | SAST + dep-audit + secret-scan report | inline (`security-scan` skill) |
| `a11y-gate` | axe / Lighthouse report | inline (`a11y-check` skill) |
| `perf-gate` | latency / query-count / bundle-size budget check | inline (`perf-budget` skill) |
| `merge` | merge to dev (auto on green) | inline (`vcs-workflow` skill) |
| `publish` | npm / Nexus release (the single human consent gate) | subagent (`release-coordinator`) + ⟦consent⟧ |
| `canary` | staged rollout + telemetry watch | orchestrate into project CD (if present) |
| `auto-revert` | rollback on bad telemetry / sample | orchestrate into project CD (if present) |
| `archive` | OpenSpec archive + delta-spec sync + `.out-of-scope/` | inline |
| `docs-sync` | `docs/tech/` as-built + staleness | inline (`docs-guideline` skill) — **tail node on every implementing track** (visual/bug/refactor/schema/feature); body sparse-scaled to the change (a tiny bug ≈ a staleness check, a schema change writes real model docs) |

`glossary` is a **concern, not a node**: a machine-enforced naming registry checked by a
gate (`glossary-conformance` skill) that spec/test/code identifiers match `CONTEXT.md`. It
is anti-naming-drift only and carries **no trust credit** toward replacing human review.

## The tracks

### visual `[full-auto*]`
```
prototype → machine perceptual-diff vs baseline → implement → code-review(scoped)
          → merge → canary → docs-sync   (async sample; auto-revert on regression)
```

### bug — deterministic, low-blast `[full-auto*]`
```
reproduce → regression-test-first → implement → e2e-run ∥ code-review(scoped)
          → merge → canary → docs-sync
```

### bug — flaky / high-blast `[human-gated / escalate]`
```
reproduce → ⟦hypothesis confirm⟧ … or escalate to the feature track
```
A core-domain bug stays a `bug` (iron law) — criticality only deepens it; it is never
promoted to `feature`.

### refactor — adequate characterization coverage `[full-auto*]`
```
safety-net(characterization) → smell-scan(auto-pick) → implement(no-new-behaviour)
          → e2e-run ∥ code-review → merge → canary → docs-sync
```

### refactor — thin coverage `[spot-check]`
```
… same as covered refactor, but ⟦async human sample⟧ before merge
```

### feature_generic `[spot-check]`
```
grill → design-spec → implement ∥ e2e-author → security-gate ∥ a11y-gate ∥ perf-gate
      → e2e-run ∥ code-review → ⟦async spot-check⟧ → merge → canary → archive → docs-sync
```
The machine gates run after `implement` — they scan the produced diff; pre-code there is
nothing to scan — and, **on light lanes**, before the LLM verifiers (deterministic-first,
SKILL.md Step 7). Human-gated lanes keep the feature_core ordering below.

### feature_generic — small `[spot-check]`
Size signal: single module + no DDL + no new external contract + no new UI flow. Any
violated condition routes to the full feature_generic track above.
```
grill(light) → inline-spec → implement → security-gate ∥ perf-gate (∥ a11y-gate if UI)
      → code-review(scoped) ∥ existing-suite → ⟦async spot-check⟧ → merge → docs-sync
```
`inline-spec`: the controller authors the minimal spec itself in `openspec/changes/<id>/`
— **all 4 contracts, with non-applicable ones explicitly marked absent** (so the spec gate
and developer pre-flight hold unchanged) — plus stable-ID scenarios and execution-carrier
`existing-suite`, with **no planner dispatch**. Verification collapses to `code-review` +
`existing-suite`: the project's suite runs green, **commit-stamped in `PIPELINE.md` == the
merge candidate's HEAD** (re-run after any fix round). The coverage formula does not apply
— record `coverage: n/a (small lane)`; the inline scenarios are discharged by the unit
tests named in `tdd-evidence.md` plus code-review Verdict A. This collapse is legal on
this lane only; no other track may omit its e2e node.

### feature_core `[human-gated]`
```
grill(deep; frames domain + seeds glossary) → prototype(disposable)
      → ⟦意图门 INTENT GATE: human reacts to the running slice; iterate until intent confirmed⟧
      → design-spec(domain model + 4 contracts, model-self-delegated)
      → [arch-review (AI design pre-check) only if DDL / cross-module]
      → ⟦架构门 ARCH GATE: human reviews REVIEW.md — domain model + module/interface/db/use-cases + decisions + cross-cutting⟧
      → implement(plan/task) ∥ e2e-author → e2e-run ∥ code-review
      → security-gate ∥ a11y-gate ∥ perf-gate → merge → canary → ⟦publish consent⟧ → archive → docs-sync
```
The heart of the dual-track design: two human gates that judge different things and do NOT
substitute. The **意图门 (intent gate)** validates *behavior* ("is this the right thing?")
BEFORE architecture investment — a disposable prototype iterated to confirmation, after
which the formal pipeline builds the real thing (the prototype is never silently promoted).
The **架构门 (architecture gate)** validates *structure* ("are the boundaries sound &
extensible?") pre-code, via the four-layer `REVIEW.md` (scaled by the depth dial).
Behavioral-intent decisions the architecture review parks are resolved at the intent gate;
`publish` consent stays the only human stop after merge.

### schema-migration — additive `[spot-check]`
```
design-spec(DDL) → arch-review(dba) → prod-shadow dry-run → implement(fwd + rollback)
      → e2e-run(integrity) → ⟦async spot-check⟧ → merge → canary → archive → docs-sync
```

### schema-migration — destructive `[human-gated]`
```
… as additive, + ⟦human-confirm⟧ + ⟦publish-style consent before the irreversible op⟧
```

### research-only `[n/a]`
```
research-pipeline → REPORT.md + PROPOSAL.md → terminate
```
No ceiling applies — produces no shippable change. Dispatched as a sub-flow (the
controller invokes the `research-pipeline` skill).

### docs `[full-auto]`
```
write / update doc → link + staleness check → merge
```
The deliverable *is* documentation: reversible, no test oracle, no domain intent, no
security/perf surface — a thin full-auto graph. **No spec, no TDD, no e2e.** Distinct from
the `docs-sync` *node* (the tail node of a *code* change). This lane's full-auto does not
require the infra-readiness flag — the action is a reversible content edit, not a deploy.

### dependency-bump `[full-auto*]`
```
bump → existing test suite + security-gate(dep-audit) → canary → merge
```
Reversible in git; the real risk is **supply-chain** (a security concern, not a human-
intent one), and the correctness oracle is the *existing* test suite + dep-audit.
```
[→ escalate to human-gated] on a MAJOR version bump (breaking change = possible behavior
   change needing judgment) OR any flagged audit finding.
```
