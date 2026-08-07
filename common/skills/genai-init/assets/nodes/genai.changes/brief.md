# Establish which changes this batch covers

Write the roster: for each change in the batch, its id, its directory, and the state it is in.
Everything downstream reads this file — the integration, the checks, the release notes.

**A change missing from this list is invisible to every later gate.** It will not be integrated, not
checked, not audited, and nothing will report its absence: the gates measure what the roster names,
so an incomplete roster produces a clean run. Reconcile the list against the batch that was frozen
before this graph existed, and say in the file what you reconciled it against.

Say which changes you considered and left out, and why. "Not ready" is a finding; silence is not.

{{rejection}}
