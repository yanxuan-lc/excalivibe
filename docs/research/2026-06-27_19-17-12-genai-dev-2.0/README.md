# gen-ai-development 2.0 → 2.1 — research & design dossier

Dated 2026-06-27. Produced by: heavy parallel research → first design → adversarial critique → revised design. Read in this order.

| # | File | What it is | Status |
|---|------|------------|--------|
| 1 | [`REPORT.md`](REPORT.md) | Four-source research (current 1.x · Superpowers 6.0.3 · mattpocock/skills · DDD theory + market), organized by 8 design axes, with provenance. | research record |
| 2 | [`PROPOSAL.md`](PROPOSAL.md) | The **2.0** design (Archetype Router, paradigm-per-node, verification triangle, one human gate, knowledge-persistence). | superseded baseline |
| 3 | [`CRITIQUE.md`](CRITIQUE.md) | 9-lens first-principles adversarial critique of 2.0 vs a *fully-automated vibe-coding* north star + meta-critic blind spots. | critique record |
| 4 | [`PROPOSAL-2.1.md`](PROPOSAL-2.1.md) | The **current** design — 2.0 revised to absorb the critique. Dual-track; router → Autonomy Controller; split release; reshaped core gate; added security/a11y/perf gates + post-merge closed loop; dependency-ordered rollout. **Round-5 refinement (see §0): DDD dissolved — only SDD + TDD remain; the old `domain-model` node + `domain-modeler` agent removed; `grill` clarified as the interactive intent input; the core track's design front slimmed.** | **CURRENT** |
| — | `2.0-design-overview.html` | Visual overview (published Artifact). Top **★ 2.1** section is current; the rest is the 2.0 baseline it amends. | visual |

**If you read one thing:** `PROPOSAL-2.1.md` (current design) + its §0 (what changed and why) and §13 (open questions for the owner).

**Decisions locked so far:** clean-slate redesign · Claude-first/Codex-portable · ~half of delivered value is novel-core-intent work ⇒ **dual-track** (reversible lanes → full-auto behind infra; novel-core → an irreducible intent loop).

**Open questions:** all five (PROPOSAL-2.1 §6A + §13) now carry a resolution or a recommended overridable default — the design has **no blocking open questions**, only owner overrides if a default doesn't fit.

**Not yet done:** 2.1 is a paper revision that *absorbed* the 2.0 critique — it has **not** itself been adversarially re-tested. If the design is accepted, the next step is the skill-creator implementation in the Phase A→B→C dependency order (PROPOSAL-2.1 §12).
