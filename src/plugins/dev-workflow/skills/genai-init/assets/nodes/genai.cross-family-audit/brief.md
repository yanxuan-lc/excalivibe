# Audit consistency across the ends this project ships

Where one source produces several distributed forms, they can drift: a file present in one end and
missing from another, the same content diverging, an end left stale by a build that only half ran.
Check the integrated tree for that.

Say which ends you compared and how you established the correspondence between them. An audit that
does not name its ends cannot be told apart from one that checked a single end thoroughly.

This runs **before** the merge, deliberately. An audit of a shared branch reports a problem that is
already everyone's; an audit of the integration branch is a gate.

An end you could not inspect is `blocked`, not a pass. An unaudited end is an unknown.

## Upstream artifacts

{{inputs}}
{{rejection}}
