Write the e2e test code for this round's scenarios, and the manifest that says where each one went.

The scenarios are the numbered ones in the spec deltas under `openspec/changes/*/specs/` — `#### Scenario: S1 — …`. They are the contract, and they are your only source.

## Derive from the spec, never from the code

**Do not read the product code to learn what it does.** You are building the thing that judges it; a
suite that mirrors the implementation proves only that the code agrees with itself, and a green run
then means nothing. Nothing in your inputs points at the implementation — keep it that way.

The same rule in the other direction: **never edit product code.** Not to make a test pass, not to
add a test id, not "just a tiny fix". If the product has no stable seam to test against, say so in
the report as a finding and let the developer fix it.

## The test code

Drive the real thing through its real interface — a browser through Playwright, a device through
Detox or `flutter drive`, a desktop build through `tauri-driver`, or the API over HTTP. **Never import
product code and call a function**: an assertion bound to a function signature is bound to the
implementation, which is the independence you just gave up.

Follow the `e2e-test` skill for the platform in play, and read only the reference that matches this
project's stack. Beyond it, four conventions this flow depends on:

- **No model at run time.** Tests run as plain processes — DOM, network and database assertions. No
  screenshot handed to a model for judgement; visual regression, where it is wanted, is a pixel diff.
- **Deterministic.** Web-first assertions and event-based waiting, no bare sleeps. Test data
  namespaced per run and cleaned up. No test depending on another test's order.
- **One test per scenario, and stop.** No extra cases the spec never asked for, no page-object layer a
  single suite does not need. Test code you add is test code someone maintains and every acceptance
  run pays to execute.
- **The id goes in the test's own title** — `test('S1: a valid order is accepted', …)`. A gate opens
  the file and looks for it, which is what keeps the mapping from drifting when a test is renamed.

If the project already has an e2e setup, write into it and follow its conventions rather than
standing up a second one beside it.

**Where the files go matters, and a fresh project has nowhere established.** Before choosing, read what
the project's own test command actually collects — `make genai-metrics` is run by two later gates at
moments when **the application is not running**. An e2e test inside that command's scope fails there on
a connection error, and the gate reports it as a failing test with a message pointing at the code. So
put the suite somewhere the unit command does not reach (a dedicated `e2e/` directory is the usual
answer), confirm that by reading the command rather than assuming, and **say in your report where you
put it and why it is out of scope for that command.**

## The manifest

One per change. **Start from the template rather than retyping it** — it carries the field rules and
the literal shape:

```bash
cp .flow/genai/templates/e2e-manifest.md openspec/changes/<id>/genai/e2e-manifest.md
```

Fill it in, delete its instruction comment, and keep the prose around the json block for whatever a
reader needs — above all, why anything ended up agent-driven or waived.

What the template cannot decide for you:

- **Which bucket a scenario belongs in.** `agent-driven` is for a scenario with no scripted seam, and
  every step of it costs a model call at acceptance time — so it is a real choice, not a shortcut past
  a hard selector. `waived` is a stronger claim still: that no form of execution reaches this, not even
  by hand. **An unmapped scenario is not waivable.**
- **Whether to declare `db_assert: suite`.** It says your test code really asserts the database write.
  The acceptance run then re-verifies only a *sample* of those scenarios instead of each one, so a
  `suite` that does not actually check the write weakens the evidence for every other `suite` row too.
  When in doubt, `runner`.

A gate checks both directions of the mapping — a scenario you left out, and an id you named that the
spec does not have.

## Run your own tests before handing them over

A test that has never passed is not written. Finish by running the suite yourself.

One exception, and it is a legitimate handoff rather than a failure: **a test that stays red because
the product is wrong.** Hand back the red test with a product-bug finding and say so plainly. Never
bend an assertion to make it green, and never weaken what the scenario says to make it scriptable —
if S3 truly cannot be automated, that is what `waived` is for.

## When too much of it cannot be scripted

There is a ceiling on how much of a round may be `agent-driven` plus `waived`, and the project sets it.
If you cross it, **do not grind through**: it means the work needs a decision from a person about
whether this is testable at all. Say so in your report with the reasons from the manifest, and let the
gate stop the round. You cannot ask the user yourself.

A scenario too vague to script is a spec defect, not something to invent around: name it and report
`blocked`.

## If you are being sent back

The acceptance run delegates to this step when a **test** is the thing that failed, and what it found is
in `openspec/changes/*/genai/e2e-report.md`: which scenarios failed, and what the app did instead.
**Read it before touching anything** — the message you were handed says only which of three
classifications the failure landed in.

That report is also the one legitimate way this step learns anything about the running application. It
records behaviour, not implementation, so reading it does not cost you the independence the rest of this
brief is about. Fix the tests it names, and nothing else.
