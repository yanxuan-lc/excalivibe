Turn a batch of ready backlog items into specs and openspec changes.

The backlog lives in `../<project>_genai/backlogs/`, one directory per item. Read the
`brief.md` of every item whose `status` is `ready`.

## Select

Order candidates by `priority` (P0 first), and within one level put `origin: human` ahead of
`origin: agent`. Without this ordering a stream of agent-raised improvements crowds out what
people actually asked for.

Take as many as form a coherent release. Fewer is fine.

## Design the batch as a batch

Read every selected brief before designing any of them. Two items that touch the same
capability may belong in one spec; deciding that is impossible one item at a time, and it is
the only reason this step handles the whole batch at once.

For each change produce `openspec/changes/<change-id>/proposal.md` and the spec deltas under
`specs/`. **Record in the change which backlog items it came from** — that direction is
authoritative; the briefs do not maintain a reverse pointer.

## Claim what you took

Set `status: active` in the frontmatter of every selected brief and append a line to its
`log.md`. Claiming and producing must agree: a gate re-checks that every active item is
referenced by some change.

## When a brief is not clear enough

Push it back to `draft` rather than designing around the gap. Append a log line saying what is
undecided. A guess written into a spec is far more expensive to undo than a round trip.

Report `partial` if anything selected was not covered.

{{rejection}}
