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

## What the project owns is not yours to claim

`tools/genai/thresholds.json` and `tools/genai/e2e.json` belong to the project's owner: the coverage
floors and the ceiling this round is measured against, and the probe that identifies the running app.
**No change may claim them, and no task may say "write them"** — a round that supplies the file it is
judged by is not being judged. `e2e.json` in particular often cannot be written until the app exists,
and getting it is a person's one-line answer, not work to schedule.

What a spec **should** do with them is pin what they will contain: if this round decides the health
endpoint and the marker that identifies the service, those are contract, and they belong in a
scenario. The file that carries them is somebody else's.

## Number every scenario, and say what lands in the database

**Follow the `genai-openspec` skill for the scenario id convention and the header shape**, and read
it before writing the first delta rather than after a gate refuses one. It is the only description of
those conventions; nothing repeats them, here or anywhere else.

Two things about them are worth knowing before you start, because they are what a later step cannot
work around. The ids are what the e2e suite, its manifest and its acceptance report all key on, so a
scenario without one is a scenario nothing downstream can address — a gate here checks that every
one carries an id, and that no id repeats inside a change. And a scenario that writes has to say
**which table and column, and what value**: that expectation is verified against the real database
later, independently of what the screen showed, and "the data is saved" gives that check nothing to
compare against.

## Claim what you took

Set `status: active` in the frontmatter of every selected brief and append a line to its
`log.md`. Claiming and producing must agree: a gate re-checks that every active item is
referenced by some change.

## When a brief is not clear enough

Push it back to `draft` rather than designing around the gap. Append a log line saying what is
undecided. A guess written into a spec is far more expensive to undo than a round trip.

Report `partial` if anything selected was not covered.

## If you are being sent back

The design review's conditions are in `openspec/changes/*/spec-review.md`. **Read that file first** —
the message you were handed states a verdict, not what was wrong with the design, and nothing else in
this instruction carries the review's own words. Address the points it names; do not rewrite what it
approved.
