Turn each change's spec into a document a person can rule on, at `openspec/changes/<id>/genai/DECISION.mdx`.

**Follow the `genai-arch-doc` skill.** It carries the anchors, the section order, the template and a
worked example, and it is the only description of them — read it before writing the first line
rather than after a gate refuses one.

## What this document is for

Not to make the design understood. To get N decisions made.

A person is about to spend one unit of attention on this round, and it is the most expensive
resource in the whole flow. A document that is complete everywhere is exactly the document that
buries the two things only they can rule on: they read for a long time, answer "looks fine to me",
and the step was theatre. So the decisions come first, the background is cut to what those
decisions need, and the full design goes behind them in an appendix.

The reader has not opened the spec, the proposal, or any other artifact, and will not. The document
stands alone or it does not work — naming a file the reader has never seen is refused by a gate,
and the phrasings a gate cannot catch ("as described in the design") are just as wrong.

## Which changes get one

The ones with something irreversible to settle: domain boundaries, the shape of a schema, a
contract someone else will build against. Usually two to five items for a change at the centre of
the product, one or two for a supporting one.

**A change with nothing to rule on gets no document.** A fake choice of the "A. do it / B. don't
(not recommended)" kind is worse than none — it spends the attention and makes the step look
effective. Say so in the report and move on; the gate asks you to account for the change, not to
produce a file for it.

## What does not belong in it

Behavioural intent — "when they go over the limit, hard block or leave headroom?" — is the kind of
question nobody can answer until they have seen the thing working. Written as a decision item it
forces a ruling from someone who cannot yet see what they are ruling on. Put it in the background
with a line saying it is parked until there is something to react to.

## Language

This is the one artifact here written for a person rather than for a model, so it goes in the
language that person reads. The structure a gate checks rides on `genai:*` anchors above the
headings, not on the headings themselves — the gate reads the anchor, the reader reads the
heading. **Never translate, reword or drop an anchor.**

## The document is derived, never edited

It comes one way from the spec. When a reader's comment changes something, the change goes into the
spec and the document is regenerated from it. Editing the document directly makes it a second
source of truth, and then neither of them is one.

That is also why nothing downstream reads it: it has been diagrammed and trimmed for a person, and
the execution-level detail an implementer needs was dropped on the way.

## If you are being sent back

The gate facts name every problem found, not just the first. Fix them together — a document that
comes back four times over four separate objections has spent four dispatches on one rewrite.
