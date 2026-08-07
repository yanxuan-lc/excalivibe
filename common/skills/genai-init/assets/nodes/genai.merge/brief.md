# Land the batch on the shared branch

Everything upstream exists so this step is safe. Do not run it while a check is outstanding — the
graph enforces that, and working around it discards the only thing that made the merge routine.

**This is not reversible.** Mark it `reversible: false`. A revert is a new commit with its own
consequences, not an undo — anyone who already pulled has the code.

**The idempotency key is the merge commit's tree**, not the attempt. A resumed run has to be able to
tell that this batch already landed; a key that changes every attempt guarantees it merges twice.

A partial merge is the worst outcome here and it is worth reporting as such rather than retrying
into: the shared branch is then in a state nobody designed, and the next person to pull inherits it.

## Upstream artifacts

{{inputs}}
{{rejection}}
