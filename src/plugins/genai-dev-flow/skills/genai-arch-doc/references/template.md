# Structure, and the guidance the structure cannot carry

Everything in `«…»` is yours to write. Headings go in the reader's language; anchors never change.

## The skeleton

````mdx
---
title: «what this change is, in a phrase a stranger understands»
subtitle: «the one sentence that says why it exists»
author: «your model name»
datetime: «yyyy-MM-dd HH:mm:ss — take the current time yourself; nothing generates it»
palette: indigo
mode: auto
---

«One paragraph: what changes for whoever uses this product, and what this reader is being
asked to settle. No jargon that has not been explained yet.»

{/* genai:arch.decisions */}
## «What I need you to decide»

{/* genai:decision recommend=A */}
### D1 — «the question, as a question»

A. «option, one line»
B. «option, one line»

**«Why A»**: «the reasoning, one paragraph. Numbers where there are numbers.»

{/* genai:cost */}
**«What it costs to get this wrong»**: «what has to be undone, and when it would be noticed»

{/* genai:decision recommend=B */}
### D2 — «the second question»

«same shape»

{/* genai:arch.background */}
## «What you need to know first»

«Only what D1 and D2 cannot be answered without. 40 lines is the ceiling, and a document that
reaches it is usually one that has not decided what the decisions are.»

«Anything parked for later goes here as one line: "«question» — you will see this working before
it is settled."»

{/* genai:arch.appendix */}
## «Appendix — the full design»

«For the reader who wants depth. Carries no decision.»

### §0 Domain model
«The nouns and how they relate — an erDiagram or a classDiagram, plus one line per term.»

### §1 Modules
«A `dot` graph of the split and its dependencies. What each module owns, in a table.»

### §2 Interfaces
«The calls this change adds or changes: name, input, output, who calls it.»

### §3 Data
«Tables and columns as DDL, or "not affected".»

### §4 Use cases
«The main paths end to end — a sequence diagram each. Exceptions only where one changes a
boundary.»
````

## Per-section notes

**The lede.** The reader arrives knowing nothing. One paragraph, no acronym unexplained, and it
says what changes for a user of the product — not what changes in the codebase.

**Decision items.** The heading is a **question**, not a topic: "Where do quota counts live: never
lose one, or never slow a request?" and not "Quota storage". A topic makes the reader work out what
is being asked before they can answer it, and some of them answer the wrong question.

Options are genuine alternatives. If B exists only so A has something to beat, there is one option
and no decision — delete the item.

The recommendation is not a hedge. You have read the whole spec and the reader has not; withholding
a view hands the design work to the person with less context. Say which one and why, and let them
overrule it.

The cost line is what makes the item weighable. "Hard to change later" is not a cost — name what
has to be undone and when someone would notice: "the column type is in three services' read paths;
changing it after launch is a migration with downtime."

**Background.** Only what the decisions need. The test: delete a paragraph and ask whether any
decision became unanswerable. If not, it belongs in the appendix or nowhere.

**Appendix.** Depth for whoever wants it, and it is where everything demoted from the front ends
up. One rule: no decision may hide in it. If while writing §3 you find a trade-off nobody has
ruled on, it belongs in the decisions section, not in a paragraph the reader may never reach.

A contract this change does not touch gets one line — "§3 Data: not affected" — rather than an
empty section or a copy of what is already there.

## Diagrams

| what it is | fence | why |
|---|---|---|
| structure, dependencies, layers, class diagram, ER | `dot` | graphviz renders at build time; `subgraph cluster` and `rank` let position carry meaning |
| sequence, state machine, journey | `mermaid` | the notations graphviz has no shape for |
| anything neither can express | `svg` | the escape hatch; colour with `currentColor` so it follows the theme |

Wrap one in `<Figure caption="…">` when it needs a caption. Every diagram gets a zoom control on
its own, with no work from you.

## Before handing it over

- `mdxv --check <file>` exits 0. A preview that starts is not proof the document compiles —
  compilation is lazy, and a broken document still prints a URL that then returns 500.
- `grep -nE '^<[^A-Z/]' <file>` finds nothing unintended.
- Every anchor is present and unmodified: `arch.decisions`, one `decision recommend=` per item,
  one `cost` per item, `arch.background`, `arch.appendix`.
- No `proposal.md`, `design.md`, `tasks.md`, `specs/…`, or any review or e2e record is named
  anywhere in the body.
