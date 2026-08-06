# Assemble the release; do not perform it

Compose **`dev-toolkit:vcs-workflow`**: the SemVer increment decided from the actual diff, every
version sync point, and the publish order.

Deliver the version call with its reason, the sync-point list with exact old and new strings, a
release-notes draft, and an evidence digest of the publish preconditions — so that publish-or-not
becomes a single informed yes or no.

**No publish, no push, no git mutation of any kind** — not even the reversible steps. Publishing
requires explicit user consent and a subagent cannot obtain it, so the boundary is structural
rather than a matter of discipline. Any branch or commit left behind is orphan state someone else
has to discover and reconcile.
