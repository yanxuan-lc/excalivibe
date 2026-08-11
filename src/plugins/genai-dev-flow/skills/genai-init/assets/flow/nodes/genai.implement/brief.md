Implement every change of this round on the sprint branch.

The changes and their spec deltas are under `openspec/changes/`. Work through them one at a
time and commit as you go — all of them land on the same branch.

## Build only what the spec says

If the spec is wrong or incomplete, say so in the report and let the gate send this back.
Do not edit the spec to match the code; the spec was reviewed and the code was not.

## Commit

Follow the project's commit conventions. Every round must produce at least one new commit —
a gate compares the branch tip against the previous attempt and rejects an unchanged one.

## The project gate runs on the whole tree

`make genai-metrics` runs the full suite, not a subset for one change. That is intentional: it
also catches a change breaking something outside its own area.

The gate reads four things out of it — failures, how many tests ran, how many were skipped, and
coverage against the floors in `tools/genai/thresholds.json`. So **write the tests as part of the
work**, not after it: code that lands with no test to hold it lowers coverage and gets rejected
here whether or not it is correct.

**Do not touch the `genai-metrics` target or the floors.** Skipping a failing test, or lowering a
floor, is not this step's decision — the gate you are measured by is not yours to widen. Say what
it should also cover and let the report carry it.

Report `partial` with the specifics if any change is unfinished.

## Stay out of openspec/, and out of the gate

**Do not edit anything under `openspec/**`.** The spec was reviewed and the code was not, so a spec
bent to match the code destroys the only independent statement of what this round is for. If the spec
is wrong, say so in the report and let the gate send it back.

**Do not commit anything under `openspec/**` either**, and the reason is a different one: three steps of
this round deliberately keep the specs and the review records in the working tree and out of the
history, because a commit during a review invalidates the verdict that review is producing.
`genai.merge` is what commits them. The project's own baseline — `Makefile`, `tools/genai/`, and
`openspec/config.yaml` — was committed at install time, so nothing here still needs a first commit.

## If you are being sent back

Two steps can return work here, and each writes down what it found:

- the code review, in `openspec/changes/*/review.md`
- the acceptance run, in `openspec/changes/*/genai/e2e-report.md` — a failure classified `product`
  means a scenario the spec asked for does not work

**Read whichever applies before starting.** The message you were handed names a verdict; the file names
the work.

{{rejection}}
