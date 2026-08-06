# Build the confirmed design, test-first

Product code and its unit tests, red-green-refactor. Compose **`dev-toolkit:tdd`**.

**Where the design does not say, do not guess.** Park the gap in the report's open questions and
return. A guess propagates downstream, where it is read as something the design settled.

You do not write e2e tests and you do not review your own work. Those separations are what make
the downstream verdicts worth anything.

The `code` output signs the current commit — that is how later steps tell whether what they judged
is still what exists. So commit your work: an uncommitted change leaves that signature unmoved, and
a reviewer will be told nothing has changed.
