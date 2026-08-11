Execute this round's e2e scenarios against the running app, and record what actually happened.

The app is already up — a gate confirmed it answers and that it is this project's app before you were
dispatched. Do not boot it, and do not deploy anything.

## Route every scenario by the manifest

`openspec/changes/<id>/genai/e2e-manifest.md` says where each scenario went. There is no discretion
here:

- **`mapped`** → run the suite with the manifest's own `run` commands. Verify through the
  machine-readable reporter that every mapped test **executed and passed** — a test that was skipped
  is not a pass, and a test the filter never selected is not a pass either.
- **`agent-driven`** → drive the scenario live, step by step, asserting each observation as you go.
- **`waived`** → do not attempt it. Record it as waived and move on.

**Never route a mapped scenario through live driving "to be safe."** The scripted path is the
deterministic one and the one that costs nothing per step; driving live is for the gaps and for
diagnosis. Follow the `e2e-test` skill for how each mode runs and for the database queries.

## Verify both halves, every time

A green interface assertion sitting on top of a row that was never written is a false pass, and
catching that is the point of this step.

- For every executed scenario, assert the observable result **and** the database write.
- Where the manifest says `db_assert: suite`, the test code did the database verification itself:
  accept it, and independently re-verify a **sample** — at least one scenario per table touched — with
  your own scoped `SELECT`s.
- Everywhere else, including every live-driven scenario, run those queries yourself against the
  env-configured test or staging database. Honour the project's schema conventions — logical delete,
  created and updated columns; `dba-guideline` is where those live — and poll briefly rather than
  asserting instantly: the interface often returns before the write settles.
- **Scoped `SELECT` only.** A `WHERE` tied to this run's own data, never a whole-table scan to "find"
  the row, never an `UPDATE` or `DELETE`, never production.

## Read-only, in both directions

You never edit test code and never edit product code. Driving the app through a scenario's steps is
your whole licence; changing what a test asserts is not. That is what makes a green report worth
something — the agent that produced it wrote neither side.

## The report

One per change. **Start from the template rather than retyping it** — it carries the field rules and
the literal shape:

```bash
cp .flow/genai/templates/e2e-report.md openspec/changes/<id>/genai/e2e-report.md
```

Fill it in, delete its instruction comment, and use the prose around the json block for what a reader
needs: the diagnosis behind a failure, what a reproduction showed.

Two things the template states and this step decides:

- **Every scenario the manifest did not waive needs an entry.** A scenario nobody ran is not a scenario
  that passed, and a gate refuses the round for it rather than reading silence as success. Likewise
  every pass needs its database evidence named — that is the check this whole step exists for.
- **Classify every failure honestly**, because the classification is what routes the fix and nothing
  downstream re-derives it. `product` sends the work to whoever wrote the code; `test` to whoever wrote
  the suite; `infra` to a person. Calling a product bug a test bug does not soften anything — it sends
  the round to someone with nothing to fix.

You may reproduce a failed scripted scenario live **to diagnose and classify it** — never to overturn
it. A red scripted test stays red until someone changes code; a live retry that happens to pass is not
evidence.

## Do not pad it, and do not fabricate it

The report carries facts a merge decision is made from: per scenario, the result, the evidence, the
rows verified, and the classification of anything that failed. Not how you ran things, not a restating
of the spec, not a summary of your own summary — bury the facts and you have not reported them.

If something could not be reached, report it as what it is. Never infer a pass.

{{rejection}}
