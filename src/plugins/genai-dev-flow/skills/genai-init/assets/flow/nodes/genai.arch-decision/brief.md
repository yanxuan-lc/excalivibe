A person rules on the structure of this round's changes, before anyone writes code against it.

The documents are at `openspec/changes/*/genai/DECISION.mdx`, one per change that has something to
settle. Each carries numbered items, each item a question with at least two options, a
recommendation, and what the wrong choice costs.

## Put it in front of them properly

These are written for a human, so hand them over rendered, not as a path to a source file. The
`mdx-artifact` skill serves a local preview; background it and give the reader the URL.

**Serve this round's decision documents from a directory that holds nothing else.** Pointing the
preview at `openspec/changes/<id>/genai/DECISION.mdx` roots it at that file's *directory*, and every
sibling lands in the reader's drawer — `e2e-manifest.md`, `e2e-report.md`, records written in English
for a model and self-contained for nobody. What the reader gets handed is this round's rulings and
nothing beside them:

```bash
d=$(mktemp -d)
for f in openspec/changes/*/genai/DECISION.mdx; do
  id=$(basename "$(dirname "$(dirname "$f")")")
  cp "$f" "$d/$id.mdx"
done
ls "$d"          # one file per change — check the count against the changes in this round
mdxv "$d"
```

**Renaming to the change id is the point of the loop, not tidiness.** Every change names its document
`DECISION.mdx`, so copying them into one directory under their own names leaves one file: the last
one wins, `cp` exits 0, and nothing says a document went missing. Measured on a two-change round —
the reader was shown one document and would have approved both. A ruling on a document nobody saw is
the one failure this step exists to prevent.

Copying is safe because the document has no local links to break. If `mdxv` is not available, say
so and give the file paths rather than pretending the preview is there.

Then restate the decision items in the conversation — the reader should be able to answer without
scrolling back. Do not summarise the recommendation as though it were settled.

## Record the ruling

```bash
fsx human <instance> -g <graph> --decision approve --by <who> --note "D1=A, D2=B"
```

`--note` is where the answers go, item by item. A bare `approve` with no note records that someone
clicked past it, which is the outcome this step exists to prevent.

Rejecting or approving with conditions both send the round back to the spec. That is the cheap
direction: a condition on the architecture is a change to the architecture, and making it now costs
one edit to a document nobody has built against yet.

## What comes back does not get edited here

A reader's comment changes the **spec**, and the document is written again from the changed spec.
Editing the document to match what was said leaves the spec describing one design and the document
describing another, with nothing to say which is real.

## Stop the preview

End the turn that started it by ending it — a preview left running holds a port, and one started in
the foreground holds a shell that never returns:

```bash
kill $(lsof -ti tcp:<the port in the URL mdxv printed>) 2>/dev/null || true
```

**Take that port from the URL, and do not assume 4321.** `mdxv` starts looking there and moves to
the next free port, so anything else already previewing on this machine — another round, or the
reader's own work — pushes this one to 4322 or 4323. Killing 4321 regardless is how an unattended
round stops a stranger's process and leaves its own running; this step runs on someone's real
machine, and it was about to do exactly that.
