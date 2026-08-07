# Author the four contracts every downstream role builds against

Compose **`dev-toolkit:spec-guideline`** — it defines the four contracts, where each one lands, how
much of each is enough, and the stable-identifier rules for acceptance scenarios. Do not re-derive
any of it here.

Consult **`dev-toolkit:dba-guideline`** for the data model, **`dev-toolkit:coding-guideline`** for
module structure, **`dev-toolkit:middleware-guideline`** for how a service integrates with the
platform it runs on.

A section that does not apply gets one written line saying so. An omitted section is
indistinguishable from an overlooked one, and a reader cannot tell a scope decision from a gap.

The gate runs a completeness check. It separates written from unwritten and nothing else — passing
it does not mean the design is right.
