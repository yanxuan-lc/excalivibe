# Merge the batch onto the integration branch

Bring every change the roster names onto one branch, so there is a single tree to check. The branch
is `genai/sprint/<batch id>` — one per batch, so two batches in flight do not integrate into each
other. This is the first step in this flow that mutates anything, and the record you write is what
the following steps measure.

**Report an idempotency key that names the effect, not the attempt.** For this step it is the
integration branch plus the roster's content — re-running with the same roster must be recognisable
as the same integration. `attempt-2` is a counter, not a key: it guarantees the act repeats.

Mark it `reversible: true` and mean it — an integration branch can be deleted. That is what makes
this the cheap place to discover a conflict, and the merge into the shared branch the expensive one.

A change that will not integrate is a `failed` outcome, not a `partial` one you route around. A tree
missing part of the batch is not a tree anyone can draw a conclusion from.
