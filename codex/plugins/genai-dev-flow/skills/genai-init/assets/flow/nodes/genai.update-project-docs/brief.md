Fold what this round built into the project's documentation.

**Follow the `docs-guideline` skill** for where a document belongs, the README-as-Index convention,
and how the tree is written. It is the only description of them.

## Start from what shipped

Everything this round built is merged and its specs are folded into `openspec/specs/`. Read both:
the specs say what the capability now is, and the code says what was actually made. Where they
disagree the code is what happened — document that, and note the drift in your report.

You are the last step that changes anything, which is the point. Nothing upstream can move under
you now, so what you write here is true of the release rather than of a branch that was still
being reworked.

## Deciding whether there is anything to write

The question is not "did this round change code" but **"did it change something another person
builds against"**: an interface, a schema, a protocol, a configuration surface, a behaviour someone
would otherwise have to reconstruct by reading the implementation.

A refactor behind an unchanged contract, a dependency bump, a fix inside already-documented
behaviour — those legitimately need nothing. **Report that and write nothing.** No gate here judges
the documentation, precisely so that this answer stays available: a round that invents a paragraph
to look diligent leaves the next reader unable to tell it from a paragraph that matters.

When something does need writing, the usual omission is not the page — it is the **index**. A
document nothing links to is a document nobody finds, and the routing table of its directory plus
reachability from `docs/README.mdx` is what makes the rest of the work count.

## Fold in rather than append

Where this round changed something already documented, edit that passage instead of adding a new
one beside it. Where it removed something, remove its documentation too. Accretion is how a
documentation tree ends up describing four generations of a system at once, and it happens one
reasonable-looking addition at a time.

## Commit before reporting

Commit the documentation on its own. Left uncommitted it is swept into the release commit, where it
lands under a message about a version bump and becomes invisible to anyone reading the history for
when a document changed.

**Changing nothing is a legitimate outcome here**, unlike everywhere else in this flow. Nothing to
write means nothing to commit; say so in the report.
