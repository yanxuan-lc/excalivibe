---
name: smell-scan
description: Bad-smell sweep producing SMELL.md / CANDIDATES.md for refactor picking — invoked by name from code-reviewer full mode and the refactor track, or on explicit bad-smell / refactor-candidate sweep requests.
---

# Smell Scan

Detect architecture and code bad smells across a codebase or a target slice, and emit a
**ranked report of refactoring candidates**, each with a verdict and a **recommendation
strength**. This skill *analyses and recommends* — it never edits code and never performs
the refactor. The output is a report someone (or something) else acts on.

## What this skill does and does not do

- **Does:** read code, apply the smell catalog below, rank candidates, write a report.
- **Does NOT:** modify source, rename, restructure, or apply any fix. Detection only —
  mirror the no-incidental-refactoring discipline. Acting on a candidate is a separate
  step (the `tdd` skill / a developer).
- **Does NOT:** decide *which* candidates get applied or under what coverage bar — it
  only reports strength. Whoever consumes the report applies its own threshold. Keeping
  that decision out of this skill is what lets it run standalone.

## Behaviour-preservation: a capability cross-reference

Every candidate in this report describes a structural change to *existing, working* code.
A structural change is only safe if it preserves observable behaviour. So before acting
on any candidate:

- **Pin current behaviour with characterization tests first** — capture what the code
  does now (not what it should do) so the refactor can be proven behaviour-preserving.
  Use the `tdd` skill to author them.
- If a candidate's current behaviour cannot be pinned (no seam to test against), say so
  in the report and lower its recommendation strength — an un-pinnable refactor is riskier
  regardless of how strong the smell is.

This skill produces the *what to change and why*; behaviour pinning + the change itself
are downstream capabilities, not part of this scan.

## The deletion test (the signature capability)

For any module, layer, wrapper, or abstraction, ask the counterfactual:

> **If this were deleted and its callers inlined the work, would total complexity
> concentrate, or merely move?**

- **Merely moves → smell candidate.** A shallow pass-through, an indirection that adds a
  call hop without encapsulating anything, a "manager/helper/util" that forwards to one
  real implementation. Removing it *reduces* surface area; the complexity it "held" was
  illusory. Flag it.
- **Concentrates / scatters back into callers → healthy, keep.** A deep module: a small
  interface hiding substantial, real work that callers would otherwise each reimplement.
  Deleting it would duplicate complexity across the call sites. Do **not** flag — this is
  the abstraction earning its keep.

Polarity is the whole point: the candidate fires on *merely moves*, never on *concentrates*.
A module that looks small but absorbs real complexity behind a narrow interface is the
goal, not a smell.

## The smell catalog

For each smell: the detection heuristic, and what a positive verdict means.

| Smell | Detection heuristic | Verdict means |
|-------|---------------------|---------------|
| **Shallow module** | Interface surface is large relative to the behaviour it hides; method/param count ≈ the work done; mostly forwards to one collaborator. | The interface costs more to learn than the implementation it hides — deepen it (absorb the collaborator's complexity) or inline it. |
| **Pass-through / leaking seam** | A layer re-exposes its dependency's types or just relays calls; callers must understand both sides of the seam to use it. | The boundary leaks; it isn't encapsulating. Collapse the seam or give it a real, narrower contract. |
| **Oversized context** | A module/package/bounded-context that "seems too large" — many unrelated responsibilities, a god-object, a file every change touches. Question any context that seems too large. | The context is doing several jobs; split along the responsibility lines that actually vary independently. |
| **Anemic model** | Data holders with no behaviour; the logic that operates on a type lives entirely in other modules (services manipulating bare structs/DTOs). | Behaviour and the data it governs are separated; consider co-locating invariants with the data they protect. |
| **Cross-boundary transaction** | A single transaction (or atomic unit of change) mutates state across two independent aggregates/contexts that should each own their consistency. | The transactional boundary crosses an ownership boundary; an inconsistency or coupling risk. Re-draw so each unit's invariants are enforced within its own boundary. |
| **Duplicated logic** | The same non-trivial decision/algorithm appears in multiple places; changes must be made in lockstep. | A single concept is scattered; extract it to one home (a *deep* module — re-run the deletion test on the proposed extraction so you don't trade duplication for a shallow wrapper). |

Aggregate hygiene (anemic model, cross-boundary transaction, oversized context) is checked
**reactively against real code here** — it is verifiable against what was actually built,
not asserted up front against a design.

## Procedure

1. **Scope the scan.** Identify the target — the whole codebase, a package, a changed
   slice, or a named module. Note the scope in the report so the result is reproducible.
2. **Map the modules.** List the modules/layers/contexts in scope and, for each, its
   public interface and what it actually does. This is the raw material for the deletion
   test and the catalog.
3. **Apply the deletion test** to every non-trivial abstraction (Step above).
4. **Sweep the catalog** over the same set; record each positive with its evidence
   (file:line or module name + the heuristic that fired).
5. **Rank and score.** For every candidate assign a **recommendation strength** (below)
   and order the report strongest-first.
6. **Write the report** (next section). Do not modify any source.

## Recommendation strength (the interface)

Each candidate carries a strength so a consumer can threshold without re-deriving the
analysis. Strength = **impact × confidence**, reported as one of:

- **strong** — clear smell, high-impact (large surface reduction or a real correctness/
  coupling risk), and behaviour is pinnable. Safe, high-value candidate.
- **moderate** — a real smell but lower impact, OR high-impact but behaviour is only
  partially pinnable. Worth doing with care.
- **weak** — a borderline/stylistic smell, low impact, or behaviour that cannot be
  reliably pinned. Report it; flag the risk; do not lead with it.

Always state *why* a candidate got its strength (the impact and the pinnability), so the
consumer's threshold decision is auditable. The strength field — not any track or coverage
rule — is this skill's entire contract with whatever acts on the report.

## Output — the report

Write a ranked markdown report named **`SMELL.md`** (or `CANDIDATES.md` when the caller
asks for the candidates-only view). One section per candidate, strongest first:

```markdown
# Smell scan — <scope>

## 1. <short title>  — strength: strong
- **Smell:** <which catalog smell / deletion-test verdict>
- **Where:** <file:line or module>
- **Evidence:** <the heuristic that fired; the deletion-test counterfactual outcome>
- **Recommendation:** <the structural change to make>
- **Behaviour pinning:** <pinnable? which characterization tests to write first>
- **Why this strength:** <impact × confidence reasoning>

## 2. … (next strongest)
```

If the scan finds nothing above `weak`, say so plainly — a clean report is a valid result,
not a failure to look harder.

## Guardrails

- **Detection only — never edit code.** Producing the report is the end of this skill's
  job. No refactor, no rename, no restructure.
- **No threshold logic.** Emit strength; never decide what gets auto-applied. That
  decision belongs to the caller.
- **Evidence, not vibes.** Every candidate cites the file/module and the specific
  heuristic that fired. "Feels messy" is not a finding.
- **Respect the deletion-test polarity.** Do not flag a deep module (one that concentrates
  real complexity behind a narrow interface) — that is the design goal, not a smell.
- **Behaviour-preservation is a precondition for acting, surfaced in the report** — this
  skill names it; it does not perform it.
