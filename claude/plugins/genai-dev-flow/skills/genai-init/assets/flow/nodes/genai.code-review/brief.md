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

**One exception, and it has to be claimed.** A broken metrics setup rejects until the round lands
in front of a person, and their repair is an edit to exactly those files. Such a commit carries a
trailer:

```
Genai-Setup-Fix: <what was broken, and which label the gate was returning>
```

Record that as `info` rather than a blocker — **but only after reading the diff.** A floor that
moved down, a test newly skipped, a command narrowed to run less: those are blockers whatever the
trailer claims, and the trailer being present is what makes checking mandatory rather than
optional. No trailer, no exception. Do not try to tell a person's commit from an agent's by the
author field; it is the same author.

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

{{rejection}}
