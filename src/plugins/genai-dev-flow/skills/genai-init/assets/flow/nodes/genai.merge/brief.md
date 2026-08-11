Merge the sprint branch into the integration branch.

Resolve conflicts by hand. A conflict is a question about intent, which is why this step is not
delegated: whoever resolves it needs the whole round in view.

Never commit conflict markers. The project gate catches them downstream, but only after a
wasted round.

Commit the review records along with the merge. The review step deliberately leaves them
uncommitted — committing during a review invalidates the verdict that review is producing.

Record the merge in the report's `effects`, including whether it is reversible.

## The suite runs again here, on the merged tree

`make genai-metrics` passed on the sprint branch before the review. The gate re-runs it after the
merge, and that is the only look this round gets at the integration branch. What it catches is the
merge itself: a conflict resolved wrong, or two changes that are each correct and wrong together.

**Fix it here, on this branch.** Going back to the sprint branch moves the tip that the review
approved, and this step's own entry rule then refuses to let it back in — the review has already
passed, so nothing re-approves it, and the round is stuck. Commit the fix before gating again;
the entry rule wants a clean tree either way.

Do not reach for the `genai-metrics` target or the floors in `tools/genai/thresholds.json`. If the
merge changed either of them, that is a conflict resolved wrong — restore them and say so.

{{inputs}}

{{rejection}}
