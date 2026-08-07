## 1. The check

- [x] 1.1 Add `src/plugins/dev-toolkit/skills/glossary-conformance/SKILL.md`, carrying the scoping rule, the two-way classification, and the report shape
- [x] 1.2 Write the description in the repo's three slots, decision-first, naming no caller
- [x] 1.3 Remove both stale claims: the engine `lint glossary` blockquote, and `grill` as the seeder
- [x] 1.4 State plainly that this is a procedure a model follows — nothing enforces that it ran

## 2. The write side

- [x] 2.1 Add the canonical-term instruction to `genai.brief`'s brief
- [x] 2.2 Confirm `CONTEXT.md` is not declared among `genai.brief`'s outputs

## 3. Acceptance

- [x] 3.1 `make build` then `make check` — green, 414 artifacts
- [x] 3.2 Walk the eight scenarios against a scratch fixture: local-vs-root glossary, two contexts, no glossary, drift, unregistered, non-domain, the limit restatement, and the not-gated check
- [x] 3.3 `openspec validate restore-glossary-chain --strict` and `check-spec.mjs` both exit 0
