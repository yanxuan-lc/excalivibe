## 1. The skill

- [x] 1.1 Add `skills/genai-flow/SKILL.md`: four kinds of work, the order of operations, the stage table
- [x] 1.2 Description positive-only — no exclusion list, and say in the design that it is untested
- [x] 1.3 State the three conditions bounding fix-in-place, as facts someone can check
- [x] 1.4 Do not restate the engine's driving loop; point at its skill

## 2. Skeletons

- [x] 2.1 Four graph assets: requirement, implementation, delivery, research
- [x] 2.2 Say that a step is dropped for a fact about the diff, never for effort

## 3. Acceptance

- [x] 3.1 `make build` then `make check` — green, 539 artifacts
- [x] 3.2 S-ROUTE-SKELETON-VALID: each skeleton submitted unedited is accepted by the engine
- [x] 3.3 S-ROUTE-STAGE-FROM-DISK: the two disk states select different stages by file test alone
- [x] 3.4 Confirm the skill names no caller and duplicates no part of the engine's driving skill
- [x] 3.5 `openspec validate --strict` and `check-spec.mjs` both exit 0
