# Review the design before a line of code is written

At this moment a correction costs one design edit. After implementation it costs a rewrite.

Look hardest at data-model changes, new or changed external contracts, cross-module decomposition,
and any removal — a dropped table, a deleted module, a breaking contract change. A removal needs
its consumers enumerated and a rollback present before it can be called safe.

A small pure-logic change with no schema, no new interface and no removal is a legitimate approve.
Say so, and say there was no design surface worth reviewing. Manufacturing findings to look
thorough costs the next reader their trust in this report.

## Upstream artifacts

{{inputs}}
{{rejection}}
