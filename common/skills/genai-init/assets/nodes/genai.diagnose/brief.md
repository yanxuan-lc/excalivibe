# Find the cause, and pin it with a test that fails now

Not on the main path. This gets inserted with `fsx graph patch` when something is stuck failing and
the cause is not obvious.

Compose **`dev-toolkit:debug`**: pick the investigation loop the symptom calls for and run it to
falsification, rather than reading code until something looks wrong.

**Do not fix the product code while you are here.** The test that proves the bug must not be
written by whoever will satisfy it — otherwise it proves only that the fix matches itself.

{{rejection}}
