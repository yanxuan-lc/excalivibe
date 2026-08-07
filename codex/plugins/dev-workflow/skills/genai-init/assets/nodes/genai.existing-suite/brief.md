# Run the project's own test suite against this change

This is the only point between writing the code and reviewing it where the product actually runs.
Acceptance testing happens once, later, on the integrated tree — so if this step is skipped, the
reviewer is reading a diff whose tests nobody executed.

Run the suite the project's README names. Do not invent a command, and do not substitute a narrower
one because the full run is slow: a scoped run answers a different question than the one this step
asks.

Record the result with the commit it ran against. The stamp is the whole point — after any fix the
suite has to be re-run and re-recorded, and an old result waving new code through is exactly the
hole this step exists to close.

**Report the outcome for what it was.** A run that could not start is `blocked`, not `failed` — the
first is an environment problem and the second is a code problem, and they are fixed by different
people. A run that ended early is `partial`, and it says nothing about the cases it never reached;
reporting it as `completed` because the cases it did reach passed is the one failure mode here that
nothing downstream can catch.

## Upstream artifacts

{{inputs}}
{{rejection}}
