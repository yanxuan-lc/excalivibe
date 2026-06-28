# Research Report — Foundations for gen-ai-development 2.0

**Date:** 2026-06-27
**Goal:** Inform a clean-slate redesign (2.0) of the `gen-ai-development` workflow toolkit by studying four sources — the current 1.6.2 plugin, Superpowers 6.0.3, mattpocock/skills, and DDD theory + the market of agentic dev-workflow toolkits — organized against the eight design axes the redesign must satisfy.

**Method:** A heavy parallel Workflow ran 9 source-research agents (output schema keyed to the 8 axes), then 3 candidate 2.0 designs from different angles, then 3 adversarial critiques. The main agent read every result, verified claims, corrected a subagent-perspective error (see §6), and authored this report and the companion `PROPOSAL.md`. Provenance is preserved per finding; web claims carry their source URLs, source-claims carry file paths.

> **Honesty note.** Two classes of claim are weaker than the rest and are marked inline: (a) the TUM/FTAPI arxiv paper on LLM-driven DDD is a single empirical data point a subagent read; the 2.0 decision it supports does **not** rest on it alone (§5). (b) A few market mechanism claims (BMAD "parallel story development", Spec-Kit "production-metrics feed specs") are advertised but unverified — flagged where cited.

---

## 1. The eight design axes (the lens)

| Axis | Question |
|------|----------|
| **ax1** full workflow | Does it cover IDEA → design → implement → test → version → optimize, not just the dev step? |
| **ax2** DDD / SDD / TDD | Which paradigm owns which phase? |
| **ax3** dynamic orchestration | Does it route/compose *different* flow nodes per task type (big-feature vs bug-fix vs visual-tweak)? *(hardest)* |
| **ax4** subagent division | Is verification work in a *separate context* from implementation (anti-hallucination)? |
| **ax5** parallelism | How does it shorten delivery? |
| **ax6** human intervention | Few touchpoints, each producing an *explicit review artifact*? |
| **ax7** optimization side-flows | Find-bug / bad-smell sweeps beyond the main flow? |
| **ax8** built-in capabilities | Use of host primitives (Workflow / subagents / hooks / worktrees / skills)? |

---

## 2. Source A — current `gen-ai-development` 1.6.2 (what it gets right, and the gaps)

**Shape.** An SDD pipeline on OpenSpec: a binary triage (Simple / Complex / Not-a-dev-task), then one canonical phase graph — research → ux → propose → arch-review → **[spec-confirm human gate]** → developer ∥ QA → e2e ∥ code-review → merge → archive+docs. Philosophy: "flexible entry, rigid rails once entered." 16 skills, 8 subagents, 0 hooks.

### What 1.x got right (the rationale to re-derive in 2.0)
These are hard-won and must survive the clean slate as *deliberately re-derived* decisions, not casualties of a blank page:

- **Context-separation triangle = anti-hallucination architecture (ax4, the crown jewel).** developer writes product code; quality-assurance derives e2e tests *from the spec, never from the implementation*; e2e-runner executes read-only; code-reviewer reviews read-only. The four contexts never share write authority. The explicit rationale: "independence from both is what makes a green report trustworthy" (`agents/e2e-runner.md` L11-18; `agents/quality-assurance.md` L10-12, L98).
- **Artifact-gates over memory + freshness stamps.** Each phase transition is a file-existence/content check, not a memory check. `spec-hash.sh` (12-hex fingerprint) gates REVIEW.md freshness; commit-stamp gates require e2e-report.md and code-review CHECKLIST.md to match HEAD at merge — closing the "green on commit X, fix lands on Y, Y merges on X's stale report" leak (`skills/dev-pipeline/references/gates.md` L7-109; `skills/spec-review/SKILL.md` L53-65).
- **One mandatory human gate at maximum leverage = the four concrete contracts** (module design / external protocol / DB schema / use-cases+scenarios), placed after arch-review and before code, where a change costs a spec edit not a rewrite (`skills/dev-pipeline/SKILL.md` L122-163).
- **PIPELINE.md as durable cross-session state**, outranking conversation memory, with skip-with-rationale logging (`skills/dev-pipeline/SKILL.md` L165-193).
- **Subagent-cannot-ask-user discipline** — subagents park `open_questions` and return; the main agent batches and relays. Keeps all user interaction in one thread (`agents/planner.md` L19-30).
- **Fix-loop convergence**: batch fixes, re-dispatch e2e-runner + code-reviewer in one message, both artifacts re-stamped to HEAD before merge; any code change invalidates both verdicts.
- **Carrier-declaration in spec** (scripted vs agent-driven per scenario) makes the e2e strategy a first-class spec decision; the e2e-manifest is a zero-discretion handoff contract (`references/e2e-manifest.md`).
- **Two-tier research routing + task-calibrated model** (deep-research vs researcher vs inline; opus for judgment, sonnet for mechanical) (`skills/research-pipeline/SKILL.md` L62-76).

### The gaps 2.0 must close
- **ax3 — the central shortfall.** The pipeline is *subtraction-from-one-graph*: bug-fix, big-feature, and visual-tweak all enter the same canonical order with optional skips. There is no mechanism that composes a *different* node-graph per task archetype. The debugger is invoked ad-hoc, not as a composed bug-fix route; app-ux-design is an optional phase feeder, not a visual-tweak flow (`skills/dev-pipeline/SKILL.md` L18-34, L48-56).
- **ax1/ax7 — no standalone optimization or bad-smell phase.** Refactoring lives only inside TDD's refactor step; code-reviewer full-mode is user-triggered, not scheduled. No proactive architecture-health sweep (`agents/code-reviewer.md` L33-35).
- **ax2 — DDD entirely absent.** No event storming, bounded contexts, ubiquitous language, or aggregates. Planner does generic module decomposition, not domain modeling.
- **Version management owns no agent** — vcs-workflow is a main-agent skill; multi-module sync is a fragile manual check (`skills/vcs-workflow/SKILL.md` L88-96).
- **No idea-crystallization phase** before research/planner — the earliest entry presupposes a researchable request.
- **debugger not wired into the fix-loop**; **hooks primitive entirely unused** (no `hooks/` dir, no hooks field in `plugin.json`).
- **QA two-phase awkwardness**: QA must deliver in two disjoint runs (Phase 1 skeletons ∥ developer; Phase 2 finalize after app boot via SendMessage) because a subagent runs once and cannot wait; the boot between phases is a hard sequential boundary that even ultracode cannot wrap (`references/ultracode-mode.md` L41-64). *This is a real constraint, not a defect — see §6 ax5.*

*Provenance: full file reads of all 8 agents + dev-pipeline/research-pipeline/tdd/spec-review/vcs-workflow/e2e-test + references/{gates,e2e-manifest,ultracode-mode}.md + plugin.json (v1.6.2, no hooks).*

---

## 3. Source B — Superpowers 6.0.3 (discipline + portability)

**Shape.** A harness-agnostic, skills-based methodology installed via a single **SessionStart hook** that injects the `using-superpowers` meta-skill as `additionalContext` at session start *and on compaction*. Main chain: brainstorming (idea→spec, **HARD-GATE**: no implementation action until the user approves a design) → using-git-worktrees → writing-plans (spec→task plan with inline TDD checkboxes) → subagent-driven-development (one sequential implementer per task + two-verdict review + whole-branch review) → finishing-a-development-branch (4-option handoff). 14 skills.

### Transferable mechanisms
- **SessionStart hook as always-on bootstrap** — re-injects "which skill when" on every session *and compaction*, so skill-awareness survives context resets without user action (`hooks/session-start`, `hooks/hooks.json` matcher `startup|clear|compact`).
- **Action vocabulary as the portability primitive** — one SKILL.md body works across 8 harnesses by naming *actions*, not tool names; per-harness tool mapping lives in `references/<harness>-tools.md`. A single acceptance test ("'Let's make a react todo list' must trigger brainstorming") guards every port (`docs/porting-to-a-new-harness.md`). **Directly relevant to our Claude-first/Codex-portable goal.**
- **File-path handoffs between subagents** — task-brief and review-package scripts print *only a file path*; content never enters the controller's context, defeating the "42k chars of pasted history" anti-pattern (`subagent-driven-development/scripts/`).
- **Two-verdict review** — spec-compliance verdict *separate from* code-quality verdict, so "tests pass but requirement missing" can't slip through (`task-reviewer-prompt.md`).
- **"Do Not Trust the Report"** — the reviewer re-derives facts from the diff file, not the implementer's claims (prevents hallucination-laundering).
- **TDD evidence required in the subagent report** (RED cmd + failing output, GREEN cmd + passing output) makes test discipline auditable across context boundaries.
- **Progress ledger** at a durable path for compaction recovery; **model selection by task complexity** ("turn count beats token price").
- **SDO (Skill Discovery Optimization)**: a skill's `description` is triggering conditions *only*, never a workflow summary — it's the auto-suggestion surface (`writing-skills/SKILL.md`).

### What NOT to copy
- **No dynamic routing / no lightweight lane.** brainstorming's HARD-GATE forces *every* item — including a one-line config change — through the full spec→approval→plan→approval chain. This drives users to bypass the system for small tasks. (ax3 gap, same as 1.x but stricter.)
- **Implementation is strictly sequential** — parallel implementers are explicitly banned; independent tasks serialize.
- **No proactive bad-smell/architecture sweep** (only reactive: after 3+ failed fixes, or a code-review section).
- **Auto-trigger is purely LLM-judgment** ("if even a 1% chance a skill applies, invoke it") with no hard programmatic guard — an inherent fragility the Red Flags table tacitly admits.
- Spec/plan reviewer subagents exist as templates but are **not invoked in the main flow** — spec quality rests on the main agent's self-review.

*Provenance: full reads of all 14 skills + hooks/{session-start,hooks.json} + docs/porting-to-a-new-harness.md + both plugin.json manifests; grep confirmed no task-type routing construct exists.*

---

## 4. Source C — mattpocock/skills (lightweight DDD + composability ethos)

**Shape.** A deliberately small, composable, *human-controlled* set of skills, explicitly **anti-GSD/BMAD/Spec-Kit** ("they take away your control and make bugs in the process hard to resolve", `README.md` L17-19). Main flow: grill (align) → optional prototype → to-prd → to-issues (vertical slices) → implement (TDD) → commit; separate on-ramps for bugs (triage) and architecture upkeep (improve-codebase-architecture). 35 skills across engineering/productivity/misc/in-progress/deprecated.

### The DDD cluster — operationalized lightweight
- **CONTEXT.md as glossary-ONLY** (zero implementation detail) — the ubiquitous-language thread that feeds TDD naming, codebase naming, PRD language, and agent-brief language uniformly (`domain-modeling/SKILL.md` L64; `CONTEXT-FORMAT.md`).
- **Active vs passive domain modeling** — only *challenging terms / inventing edge cases / writing glossary as it crystallizes* is the domain-modeling skill; reading CONTEXT.md is not. Prevents glossary drift.
- **Sparse ADR gating (three-conditions rule)** — record a decision only when *hard-to-reverse AND surprising-without-context AND result-of-a-real-tradeoff* (`ADR-FORMAT.md` L29-48). Prevents ADR proliferation.
- **`ubiquitous-language` skill was DEPRECATED** — superseded by domain-modeling + CONTEXT.md in the 1.0.0 refactor. The old one wrote a separate `UBIQUITOUS_LANGUAGE.md` via one-shot extraction; the replacement is continuous + inline. *(The deprecation reason is inferred from CHANGELOG + invocation.md's "passive vs active" distinction; not stated explicitly — shallow clone.)*
- **codebase-design** introduces a distinct vocabulary (deep modules, seams, adapters) and *explicitly rejects* DDD's "boundary" term — a signal that even a DDD-friendly author finds parts of the jargon counterproductive.

### Other transferable mechanisms
- **Grilling-as-alignment** — one question at a time, the agent *provides a recommended answer*; the most popular skill in the repo. (Addresses misalignment, "failure mode #1".)
- **Behavioral agent-brief** as the handoff contract — current behavior / desired behavior / key interfaces *by type name not file path* / acceptance criteria / out-of-scope. Durability over precision (`triage/AGENT-BRIEF.md`).
- **Vertical-slice tracer bullets** as the unit for *both* to-issues and tdd — no impedance mismatch between "what we planned" and "what we can test".
- **Design-it-twice** — 3+ parallel sub-agents, each a different constraint (minimize interface / maximize flexibility / optimize common case / ports-and-adapters), aggregated on depth/locality/seam (`DESIGN-IT-TWICE.md`).
- **Deletion test** as a bad-smell detector — "imagine deleting the module; if complexity vanishes it was a pass-through, if it reappears across N callers it earned its keep" (`codebase-design/SKILL.md` L62-64).
- **Out-of-scope KB** — rejected scope stored one-file-per-concept to prevent re-litigation (`triage/OUT-OF-SCOPE.md`).
- **HTML architecture report** (Tailwind+Mermaid) as a human-review artifact (`improve-codebase-architecture/HTML-REPORT.md`).
- **user-invoked vs model-invoked skill taxonomy** with the invariant that user-invoked may call model-invoked but not vice-versa (prevents cycles) (`docs/invocation.md`).

### What NOT to copy
- **No automatic routing** — `ask-matt` is a *human-invoked* router (cognitive-load solution), not a classify-and-dispatch one. This is the sharpest gap vs our ax3 goal — Matt deliberately punts routing to the human.
- **No tactical DDD at all** (no aggregates/entities/value-objects/events) — vocabulary-level only.
- **No verification/QA separation** — the QA skill was deprecated; `/implement`'s verification runs in the *same* context (fresh-session-per-issue only partially mitigates).
- **No parallelism in the standard path**; **no hooks/worktrees/MCP** (intentionally host-agnostic — would be a downgrade for us to copy).
- Grilling is **intensive human-in-loop by design** — conflicts with "minimize human touchpoints" if applied to every task.

*Provenance: full reads of the engineering/ DDD + workflow cluster, productivity/grilling+handoff, in-progress/{review,decision-mapping}, deprecated/{ubiquitous-language,qa}, docs/invocation.md, CHANGELOG.md, README.md, both context files, plugin.json (17 registered skills).*

---

## 5. Source D — DDD theory + the market

### 5.1 DDD theory (the ax2 backbone)
- **The clean phase-ownership answer (ax2, strongest finding).** DDD / SDD / TDD are **layered, not competing**: DDD = *upstream*, "what to build" / business essence / domain model; SDD = *mid-stage*, component & inter-service contracts (OpenAPI/specs) / "is understanding aligned"; TDD = *downstream*, function correctness / "is the implementation correct". Recommended order: model with DDD first, then spec, then test. The slogan that captures it: *TDD answers is-the-implementation-correct; SDD answers is-the-team-aligned; DDD answers does-this-capture-the-business-essence.* (aduce.jp/en/lab/tdd-sdd-ddd-differences; planu.dev/en/blog/sdd-vs-tdd; SAP curated-resources core-concepts.)
- **DDD's native routing mechanism (ax3) is subdomain classification.** core (org differentiates → highest effort: full event-storming + deep tactical modeling + strict TDD) / supporting (lighter pass, still tested) / generic (bought/scaffolded, skip deep modeling). *Core-domain distillation* = deliberately concentrating effort on core and under-investing elsewhere. A second axis — context mapping — picks a *different integration pattern per boundary* (anti-corruption-layer / shared-kernel / customer-supplier / conformist / open-host-service). **Crucial caveat: DDD classifies by domain IMPORTANCE, not by CHANGE TYPE** — a bug in the core domain is still a bug-fix, not a big-feature. Change-type routing is an extension on top of DDD, not literal DDD. (SAP core-concepts; aduce.)
- **Ubiquitous language is the cross-layer contract** — the glossary should literally become the SDD spec vocabulary, the TDD test names, and the code identifiers, eliminating translation drift. **It is per-bounded-context** — the same word means different things in different contexts, so a naive global glossary creates false agreement.
- **Event Storming** is the idea→design discovery engine (Big Picture → Process → Software Design; grammar events/commands/policies/read-models/aggregates/hotspots; chain Event→Policy→Command→System→Event). **Hotspots (red stickies)** are a first-class bad-smell/risk surface during discovery. But its value is heavily collaborative-human; an AI running it solo invents guesses, not real organizational disagreements — keep a human in the loop for novel domains. (qlerify.com event-storming guide.)
- **The cautionary empirical data point** *(weaker source — one paper, read by a subagent)*: the TUM/FTAPI arxiv paper (2603.26244) ran a 5-step LLM DDD framework (ubiquitous language → event-storming sim → bounded contexts → aggregates → architecture) all in *one chat*; finding — **steps 1-3 produced usable artifacts but accumulated errors made steps 4-5 impractical**; LLM-DDD "excels as a collaborative sparring partner, not for full automation."
  - **Why the 2.0 decision does not rest on this paper:** the same conclusion (gate tactical DDD, keep it human-supervised, don't autopilot a long unverified modeling chain) is independently supported by (a) the market scan — *no* mainstream toolkit automates tactical DDD; (b) event storming being inherently human-collaborative; (c) the general principle that long unverified LLM chains accumulate error. The arxiv paper is corroboration, not the load-bearing pillar.

### 5.2 Market scan (six systems, validated patterns)
The market splits into **heavyweight role-rich pipelines** (BMAD, Spec-Kit) and **lean context-engineering pipelines** (GSD, Agent OS v3).

- **ax3 — BMAD v6 scale-adaptive router is the cleanest market answer.** A `workflow-init` step classifies the task into Level 0-4 across three tracks — **Quick Flow** (L0-1, bug-fix: tech-spec-only, 1-2 stories), **BMad Method** (L2-3: full PRD + Architecture + UX), **Enterprise** (L4: + Security + DevOps + Test Strategy). A `workflow-status` path file makes the chosen flow inspectable and resumable. This is genuine *compose-different-nodes-per-class* routing. (deepwiki BMAD Planning-Tracks; medium @hieutrantrung "From Token Hell to 90% Savings: BMAD v6".)
- **ax4 — GSD's Verifier-in-isolated-context** ("don't let your AI cheat") + **Anthropic's official guidance** that "a subagent provides a clean slate ... doesn't inherit assumptions/blind spots ... verify the implementation isn't overfitting to tests or missing edge cases." Strongest validation of our context-separation thesis. (codecentric GSD anatomy; claude.com/blog/subagents-in-claude-code.)
- **ax5 — GSD wave-based parallelism**: Wave 1 fans out 4 researchers (separate files), barrier, Wave 2 depends; tasks sized to ~50% of a fresh context. Spec-Kit marks independent tasks `[P]`, ordered models→services→endpoints. Codex parallelizes via cloud + git worktrees. Anthropic caution: never parallelize two subagents editing the same file.
- **ax6 — named review artifact at each irreversible gate**: Spec-Kit's plan-with-constitutional-compliance + `[NEEDS CLARIFICATION]` markers; BMAD's PRD/arch-doc + TEA gate decision (PASS/CONCERNS/FAIL/WAIVED) + traceability matrix. *This validates 1.x's existing REVIEW.md four-contract pattern.*
- **ax7 — BMAD Test Architect (TEA)** as a separate risk-scored quality side-flow (9 workflows; probability×impact P0-P3; coverage-gap gate, not just pass/fail). But a **standing, proactive architecture/bad-smell sweep (not change-triggered) is a market gap** — closest is Agent OS `/discover-standards`. ax7's proactive side is greenfield across the whole market.
- **ax2 — DDD is the market gap.** *No* scanned toolkit wires event storming / bounded contexts / ubiquitous language / aggregates into the flow. DDD-for-LLMs exists only as research (arxiv) + niche tools (Qlerify) + Rod Johnson's DICE (Domain-Integrated Context Engineering). **Sequencing DDD-front + SDD-middle + TDD-edge is the open opportunity for 2.0.**
- **ax8 — GSD is the deepest user of Claude primitives** (29 slash commands, 12 subagents via `Task()`, hooks, `@./` injection, `.planning/` persistence). gen-ai-development already mirrors this pattern.

**The consistent critique of heavyweight systems** (validated, must avoid): ceremony/token cost and control-stealing rigidity. BMAD ran PRD+architecture even for mid-size work ("token hell"); Spec-Kit forces constitution→spec→plan→tasks even for a typo. **Agent OS v3 deleted its own installed subagents** and now defers to host plan mode — the market admitting the heavyweight approach over-engineered. *Lesson: adopt the router, not the always-on ceremony; reserve a separate subagent context only where isolation pays.*

*Provenance: arxiv 2603.26244 (PDF read); aduce.jp, planu.dev, SAP curated-resources, qlerify.com (fetched); BMAD (github + deepwiki + medium), Spec-Kit (github/spec-kit/spec-driven.md), GSD (codecentric + lets-gsd.com), Agent OS v3 (buildermethods + discussion #310), Codex (developers.openai.com/codex), Anthropic subagents (claude.com/blog + code.claude.com/docs).*

---

## 6. Cross-cutting conclusions (the synthesis lens for the proposal)

**The convergent answer to the hardest axis (ax3).** Three independent sources point the same way: BMAD's Level/track router (market), DDD's subdomain classification (theory), and 1.x's own diagnosed failure (subtraction-from-one-graph). 2.0's router must do **selection-by-type** — compose a *distinct node subset* from a shared superset per task archetype, written to PIPELINE.md as a durable composition record — **not** optional-subtraction from one canonical order.

**Two routing axes, not conflated.** Change archetype (feature/bug/visual/refactor/schema-migration/research) decides the *spine shape*; subdomain class (core/supporting/generic) is a *depth dial* for how much DDD a node runs. They must never collapse: a core-domain bug is a bug-fix, not a big-feature (the DDD caveat, §5.1). Blast-radius is a *provisional* third signal — re-route on discovery, never claim it was "measured" up front.

**What makes a composed pipeline binding** (the contradiction to avoid — one candidate, "Compass", failed here). If skills auto-trigger by description while the composer only "annotates", the composer is cosmetic. The answer is already in 1.x's toolkit: **artifact-gates gate each composed node, and PIPELINE.md is the durable composition record the gates read.** The track is enforced by the gates, not by hope.

**Router durability is a closed gap, not a conceded one.** A subagent claimed "no Workflow primitive exists in this environment" — that is a *subagent-perspective artifact* (subagents cannot nest a Workflow); the main agent **does** have the Workflow tool. Separately, critique flagged that Superpowers' SessionStart re-injection (compaction-durable) is Claude-only while Codex `defaultPrompt` is one-shot. But our own artifact-over-memory principle closes this *symmetrically*: the durable composition record is **PIPELINE.md on disk**, and the instruction to re-read it after a reset lives in **AGENTS.md** (a short resume directive both harnesses keep in context natively — the mechanism 1.x resume already relies on). So the load-bearing pair is AGENTS.md (instruction) + PIPELINE.md (state), both symmetric; the Claude SessionStart hook becomes a *convenience*, explicitly **not load-bearing**.

**The crown jewel is portable and validated.** The context-separation triangle (ax4) is independently confirmed by GSD and Anthropic. It must be preserved exactly and only *extended* (adversarial verify), never weakened by clever parallelism tricks.

**Honest parallelism (ax5).** The QA two-phase boot-boundary is a *genuine* constraint (a subagent runs once and can't wait; the app boot between draft and finalize is main-agent-only). The "stateless QA fixes dev∥QA" idea (candidate "FlowForge") was refuted: statelessness removes only the SendMessage reason; the boot boundary alone still slices the segment. Keep two-phase QA; the honestly-wrappable unit is Phase-1-draft ∥ implement.

**Keep the roster lean.** The market punishes persona-theater (BMAD 19 agents; Agent OS deleted its subagents). 2.0 adds only where isolation genuinely pays.

These conclusions are carried into the companion **`PROPOSAL.md`** as one designed system.
