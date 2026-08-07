# Run acceptance once, against the tree that will ship

The scenarios were authored per change, alongside the spec that motivated them. They are executed
here, together, on the integrated tree — because a change that passes alone can fail integrated, and
that is the failure this stage exists to find.

Collect the acceptance material from the change directories the roster names. The roster is the only
place that list exists; there is no variable holding it.

Record the commit you ran against. The gate compares it, so a result from before the last commit is
rejected even though the report is present and says it passed — it describes a tree that will not
ship.

An application that would not start is `blocked`, not `failed`. The first is an environment problem
and the batch cannot fix it; the second is the batch's problem and it can.
