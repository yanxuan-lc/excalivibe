---
description: "Turn a finished design into the document a person actually signs off on — decisions first, background compressed to what those decisions need, the full design demoted to an appendix. Reach for it whenever a design is ready and someone has to approve it before implementation starts, on \"write this up for review\", \"I need sign-off on this design\", \"turn the spec into something a human can read\", \"prepare the architecture review\", or when a design document is technically complete and nobody can tell what they are being asked to rule on. Attention is the scarce resource in a review, and a document organised for understanding spends all of it before reaching the two things only this reader can decide. It shapes and produces the review document; judging whether the design itself is sound is separate work, and so is writing up what already shipped."
description-claude: "Turn a finished design into the document a person actually signs off on — decisions first, background compressed to what those decisions need, the full design demoted to an appendix. Reach for it whenever a design is ready and someone has to approve it before implementation starts, on \"write this up for review\", \"I need sign-off on this design\", \"turn the spec into something a human can read\", \"prepare the architecture review\", or when a design document is technically complete and nobody can tell what they are being asked to rule on. Attention is the scarce resource in a review, and a document organised for understanding spends all of it before reaching the two things only this reader can decide. It shapes and produces the review document; judging whether the design itself is sound is separate work, and so is writing up what already shipped."
description-codex: "Turn a finished design into the document a person actually signs off on — decisions first, background compressed to what those decisions need, the full design demoted to an appendix. Reach for it whenever a design is ready and someone has to approve it before implementation starts, on \"write this up for review\", \"I need sign-off on this design\", \"turn the spec into something a human can read\", \"prepare the architecture review\", or when a design document is technically complete and nobody can tell what they are being asked to rule on. Attention is the scarce resource in a review, and a document organised for understanding spends all of it before reaching the two things only this reader can decide. It shapes and produces the review document; judging whether the design itself is sound is separate work, and so is writing up what already shipped."
name: review-doc
---

# Review Doc — the document a person signs

A design is written to execution-level precision so that machines and implementers can consume
it. A person can barely read that, let alone judge from it whether the architecture is sound.
This skill produces the review-facing document instead: the carrier for a human decision made
**before any code is written**, when a correction costs one design edit rather than a rewrite.

## The goal is not "make the design understood" — it is "get N decisions made"

This is the load-bearing idea, and everything below follows from it.

The obvious way to organise a review document is frame → structure → deliberation →
cross-cutting concerns: read it and you know what the design looks like. It is optimised for
understanding, and it fails, because **a reviewer does not want understanding, they want to
sign something.** A document that is complete everywhere is exactly the document that buries
the two things only this reader can rule on. So they spend a long time, answer "looks fine to
me", and the review was theatre.

**Attention is the scarcest resource in this process, and every human review spends one unit of
it.** So invert the order: decisions first, background compressed to whatever those decisions
need, the full design in an appendix. The reader is doing something from the first line instead
of meeting the first thing that needs their judgement four layers in.

## Three sections, fixed order

| Anchor | Content |
|---|---|
| `genai:review.decisions` | One `### D«n» — «the question»` per item: **≥2 real options**, an explicit **`recommend=`** on the item's anchor, the reasoning, and the **cost of the wrong choice** under `genai:cost` |
| `genai:review.background` | The minimum background those decisions need. **Forty lines maximum** |
| `genai:review.appendix` | Domain model, the four contracts, cross-cutting quality views. **Carries no decision** |

**If there is nothing to decide, do not produce this document [MUST].** A change with genuinely
nothing for a person to rule on should not have a human review at all. Say so and move on,
rather than manufacturing a "please confirm" formality.

## Written for the reader, structured for a machine — which is why anchors exist

The document is written in the language the project configured: `output-language` in
`genai/config.json`, falling back to the system locale. Everything a model reads — this skill,
the design, the specs — stays in English. This one artifact does not, because its reader is a
person.

That collides with being checkable: **a predicate cannot grep `## What you need to decide` in a
document that might be written in Japanese.** So the checked structure is carried by
**language-independent anchors** on their own line above the free-text heading. The checker
reads the anchor, the reader reads the heading, and neither constrains the other.

```mdx
{/* genai:review.decisions */}
## «heading, in the reader's language»

{/* genai:decision recommend=A */}
### D1 — «state the question as a question»

A. «option»
B. «option»

**«Why A»**: …

{/* genai:cost */}
**«Cost of getting it wrong»**: …
```

Anchors are literals — never translate, reword, or drop one. MDX rejects HTML comments, so they
are written `{/* … */}`; the same slugs appear as `<!-- … -->` in plain-Markdown artifacts,
because a checker greps the slug rather than the comment syntax.

> **Nothing enforces these anchors yet.** Write them anyway. They cost nothing now, and
> retrofitting them into documents already approved costs a great deal — the shape has to be
> settled before there is a corpus, not after.

## Three hard requirements

### 1. Carried as MDX, previewed locally [MUST]

Produce MDX and preview it through the `mdx-artifact` skill. Content form ranks
**diagram (mermaid / graphviz) > table > DSL (e.g. DDL) > prose**. For each point ask "can a
diagram say this" and fall back a step at a time; prose is reserved for what cannot be
diagrammed at all — the reasoning and trade-off behind a decision — and stays inside one
paragraph.

**MDX is the single source.** The preview is a regenerable rendering: never hand-write HTML,
never build a page outside the MDX.

**Serve it from a directory holding nothing else.** A preview rooted at a file's directory lists
every sibling document in its drawer — so pointing it at the change directory hands the reader
the internal evidence files two clicks away. Those are written in English for a model and are
self-contained for nobody, and they quietly undo everything on this page. Copy the one file out
first:

```bash
d=$(mktemp -d) && cp «path to review.mdx» "$d"/ && mdxv "$d"
```

The document is self-contained by contract, so it has no local links to break in the move.

### 2. Self-contained [MUST]

**The reader has not read the proposal, the specs, or any intermediate artifact.** Naming one of
those paths is a defect, and so are the prose forms of it — "as described in the design
document" fails for the same reason. Every domain noun and system name gets a one-line
explanation where it first appears.

### 3. Explain each term at first use [SHOULD]

Follow the first appearance of a technical or domain term with a parenthetical. When the
document is written in a language other than English, put the English term in there too, so the
reader can cross-reference and search. Either order works — `term (gloss)` or
`中文词（term，gloss）`.

## Criticality scales the number of decisions, not the length

| Criticality | Decisions | Appendix |
|---|---|---|
| **core** | Every genuinely irreversible trade-off — domain boundaries, schema shape, external contracts. Usually 2–5 | Full: domain model, the four contracts, cross-cutting views |
| **supporting** | Only trade-offs this change introduces. Usually 1–2 | The contracts actually touched; drop the domain model when no new concept appears |
| **generic** | Often none — **then there is no review to hold** | Only the contracts touched, a paragraph or two |

**Never manufacture decisions to hit a number [MUST].** A fake choice of the "A. do it /
B. don't (not recommended)" kind is worse than none: it spends a person's attention and makes
the review look effective. A contract this change does not touch gets a one-line "not affected"
in the appendix.

## What belongs here, and what is a different question

This document judges **structural soundness** — is the domain model right, is the split into
modules, interfaces, tables and use cases reasonable for the domain, are the key trade-offs the
right ones. A person signs it before code is written.

**Behavioural intent is not settled here.** Things like "hard block or headroom when they go
over?" — where you only know the answer once you have seen it working — must **not** be written
as `### D«n»` decisions. Writing them there forces a ruling from someone who cannot see the
thing yet, and the ruling will be wrong. Put them in the background section with a line saying
they are parked until there is a working slice to react to.

## Derived one-way, always [MUST]

The design artifacts are the only source of truth. This document is derived from them and never
the reverse.

- **Never edit it directly.** Feedback on it flows back into the design, and the document is
  regenerated. Editing it means two sources of truth, and the mechanism is then dead.
- **Regenerate it after every design revision.** A stale review document is worse than none,
  because it looks current: someone approves what they read, and what they read is not what
  will be built.
- **Nobody implements from it.** Whoever builds, tests, or reviews the code works from the
  design and the specs. This document has been trimmed for a human — diagrammed, execution-level
  detail dropped — so using it as implementation input silently loses information.

> Detecting staleness automatically needs a content fingerprint of the design recorded in this
> document's header and re-checked at approval time. That is not built yet. Until it is, the
> regeneration discipline above is the only thing holding, and it holds only if followed.

## What this skill does not do

- **Judge whether the design is sound.** It shapes the document that lets a person judge. The
  judgement is theirs, and reviewing the design on its merits is separate work.
- **Decide completeness of the design itself.** Whether the design settled everything it had to
  is a different bar; see `dev-toolkit:spec-guideline`.
- **Document what already shipped.** This is written before the work exists. Turning finished
  work into durable documentation has a different shape entirely; see
  `dev-toolkit:docs-guideline`.
