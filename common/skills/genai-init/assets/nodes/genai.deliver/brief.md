# Release it, or hand it over

A person runs this step. Not because a program could not perform the commands, but because consent
to publish is not something a program can give on someone's behalf — and this is the point where
that consent is spent.

Two modes, and one step covers both because a release is often both:

- **To a registry** — the idempotency key is `<package>@<version>`. That is what makes "already
  published" answerable on a resumed run, and a version is the one part of a release that cannot be
  reused.
- **Handed to a person** — the key is the handover's own reference: the ticket, the PR, the request
  id. Something that already exists in the receiving system, not something invented here.

Record every target in `effects[]`, each with its own key, and mark them `reversible: false`. A
yanked package and an unsent handover are new acts, not undos.

If part of the release went out and part did not, say which. Somebody is about to retry, and the
difference between "nothing happened" and "half of it happened" decides whether that is safe.
