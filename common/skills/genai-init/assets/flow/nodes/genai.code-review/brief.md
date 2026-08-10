Review every change of this round, in a context independent of the one that wrote the code.

Write one `review.md` into each change's directory under `openspec/changes/`, so the review
travels and is archived with the change it belongs to.

## Criteria

Judge each change against its own spec delta, and record every criterion in the report with
`met` and the evidence for it. At minimum:

- **Correctness** — does it do what the spec says, including the cases the spec calls out
- **Maintainability** — will the next change to this area be harder or easier
- **Scope** — **do the edits stay inside what this change is about**
- **Gate coverage** — does `make genai-metrics` actually run something that would fail if this
  requirement regressed. It has passed on a requirement that was never implemented, because the
  test came from the same context as the code

An edit to that target, or to the floors in `tools/genai/thresholds.json`, is itself a scope
finding: **a change may not widen the gate it is measured by.** Say what the gate should also
cover and leave both alone.

The scope criterion is the one that is easy to skip and expensive to lose. An edit that has
nothing to do with the change — a bumped version string, an unrelated refactor, a touched
config — is a finding, not a bonus.

## Do not commit the review records

Write them and leave them. **A verdict is recorded against the exact commit that was handed
over, so any commit made during this step invalidates the verdict being given** — and a passed
step cannot be re-run, so the whole round has to be rebuilt. There is no ordering that avoids
this: the premise is fixed when the work is handed over, before anything can be written.

Leaving the files uncommitted is safe. They are picked up by the merge, and an uncommitted file
does not make the tree dirty for the checks downstream.

## Verdict

`approve`, `conditional` or `reject`. Note that `conditional` sends the work back; use it when
the conditions are real work rather than as a softer approval.

{{inputs}}

{{rejection}}
