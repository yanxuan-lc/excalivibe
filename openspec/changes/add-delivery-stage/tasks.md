## 1. The batch entry point

- [x] 1.1 `genai.changes` — produce, main, no inputs, roster at `genai/sprints/{{vars.sprint}}/changes.md`
- [x] 1.2 Its brief states that a change missing from the roster is untested and unflagged by every later gate

## 2. Integration and the three checks

- [x] 2.1 `genai.integrate` — effect, main, input `roster`, outputs the integration `tree` as `git_commit` plus a record file
- [x] 2.2 `genai.full-check` — verify, main, input `tree`, `signature_match` against it
- [x] 2.3 `genai.cross-family-audit` — verify, main, input `tree`, `signature_match` against it
- [x] 2.4 Rewire `genai.e2e-run` — input `tree` instead of the change's code, artifact under the sprint directory
- [x] 2.5 Each check's gate order puts `signature_match` first

## 3. Landing and release

- [x] 3.1 `genai.merge` — effect, main, inputs from the three checks, `join: all` is the graph's job but the inputs must be declared
- [x] 3.2 `genai.deliver` — effect, human/stdout, `patience: null`, `unattended: suspend`
- [x] 3.3 `genai.archive` — effect, main, input from merge
- [x] 3.4 Rewire `genai.release-prep` — sprint locator, inputs added
- [x] 3.5 Every effect brief states the idempotency-key rule with an example of the wrong shape

## 4. Wiring and docs

- [x] 4.1 Add the seven to `assets/workflows/genai-feature.yaml`
- [x] 4.2 `SKILL.md`: step count, both graph variables, the effect steps and what they mutate

## 5. Acceptance

- [x] 5.1 `make build` then `make check` — green, 468 artifacts
- [x] 5.2 Install into a fresh project, `fsx check` exits 0 with 23 steps
- [x] 5.3 S-STAGE-BATCH-NO-CHANGE-INPUT: create a batch-only graph supplying only `sprint` — accepted, no `change` demanded
- [x] 5.4 S-STAGE-ACCEPT-ON-TREE: acceptance passes, the integration branch gains a commit, re-evaluation reports it stale
- [x] 5.5 S-STAGE-AUDIT-BEFORE-MERGE / CHECK-FAILS-RETURNS: merge undispatchable while a check is outstanding, and a failing check routes back
- [x] 5.6 S-STAGE-EFFECT-KEY: submit an effect report and confirm the engine requires the key; confirm a change-stage graph still works unchanged
- [x] 5.7 `openspec validate --strict` and `check-spec.mjs` both exit 0
