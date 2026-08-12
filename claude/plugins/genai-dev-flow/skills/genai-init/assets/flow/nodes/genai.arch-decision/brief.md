A person rules on the structure of this round's changes, before anyone writes code against it.

The documents are at `openspec/changes/*/genai/DECISION.mdx`, one per change that has something to
settle. Each carries numbered items, each item a question with at least two options, a
recommendation, and what the wrong choice costs.

## Put it in front of them properly

These are written for a human, so hand them over rendered, not as a path to a source file. The
`mdx-artifact` skill serves a local preview; background it and give the reader the URL.

**Serve one document from a directory that holds nothing else.** Pointing the preview at
`openspec/changes/<id>/genai/DECISION.mdx` roots it at that file's *directory*, and every sibling
lands in the reader's drawer — `e2e-manifest.md`, `e2e-report.md`, records written in English for a
model and self-contained for nobody. The whole design of this document assumes the reader sees
exactly one thing:

```bash
d=$(mktemp -d) && cp openspec/changes/*/genai/DECISION.mdx "$d"/ && mdxv "$d"
```

Copying is safe because the document has no local links to break. If `mdxv` is not available, say
so and give the file path rather than pretending the preview is there.

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
kill $(lsof -ti tcp:4321) 2>/dev/null || true
```
