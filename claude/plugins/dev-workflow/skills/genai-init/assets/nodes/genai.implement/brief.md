# Build the confirmed design, test-first

Product code and its unit tests, red-green-refactor. Compose **`dev-toolkit:tdd`**.

**Where the design does not say, do not guess.** Park the gap in the report's open questions and
return. A guess propagates downstream, where it is read as something the design settled.

You do not write e2e tests and you do not review your own work. Those separations are what make
the downstream verdicts worth anything.

The `code` output signs the current commit — that is how later steps tell whether what they judged
is still what exists. So commit your work: an uncommitted change leaves that signature unmoved, and
a reviewer will be told nothing has changed.

## Upstream artifacts

`diagnosis` is optional and is absent on most changes — it exists only where a rescue diagnosis was
run for this one. Listed as missing, it is not a problem to solve; a missing `design` is.

{{inputs}}
{{rejection}}
