Merge the sprint branch into the integration branch.

Resolve conflicts by hand. A conflict is a question about intent, which is why this step is not
delegated: whoever resolves it needs the whole round in view.

Never commit conflict markers. The project gate catches them downstream, but only after a
wasted round.

Commit the review records along with the merge. The review step deliberately leaves them
uncommitted — committing during a review invalidates the verdict that review is producing.

Record the merge in the report's `effects`, including whether it is reversible.

{{inputs}}

{{rejection}}
