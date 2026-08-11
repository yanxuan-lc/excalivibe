Check this round's requirements against what was actually built, then archive them.

Read the `brief.md` of every backlog item whose status is `active`. Those are this round.

## Check each requirement, not each spec

Ask of every item: **was this requirement satisfied?** Point the evidence at a specific change
or at specific code. Record one criterion per item, with `met` and that evidence.

This is not a review of whether the specs are good — that already happened. It exists because
of a specific failure mode: when two requirements fold into the same capability's spec, the
fold can silently drop one, and no mechanical gate can see it. Reading the original
requirements is the only thing that catches it.

**That fold has already happened by the time this runs**, which is why this step sits after the
archive rather than before it. Check against the main specs under `openspec/specs/`, not
against the change deltas — the deltas are what was intended, the main specs are what shipped.

## Archive what passed

Move the item's directory to `../<project>_genai/archive/<item-id>/`, add `outcome: done` and
`change:` listing every change it landed in, and append the final log line. That change list is
a frozen snapshot and the only link back from a requirement to its implementation.

An item is done only when **every** change it mapped to is done.

## When something is left over

Return the verdict `conditional` and say what is missing. An item that will not be finished
this round goes back to `ready` — leaving it `active` blocks the release, which is the
intended behaviour.

{{rejection}}
