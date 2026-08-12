---
name: genai-arch-doc
description: Decide what a person actually has to rule on before code is written, and shape it into the document that goes in front of them — which trade-offs deserve a human ruling and which do not, the anchors a gate reads, the three sections and their fixed order, and what gets demoted to the appendix. Use when writing or repairing a decision document, when a shape check refuses one, when deciding whether a change warrants a human step at all, and when a reader's comment has to be folded back into the design.
---

# The decision document

A spec is written to execution-level precision for a machine to consume. A person can barely read
one, let alone judge from it whether the architecture is sound. `DECISION.mdx` is what they read
instead: the carrier for the one moment in a round when a human rules on structure, before any code
is written against it. At that moment a correction costs one edit to a document nobody has built
on yet.

## The goal is not "make the design understood" — it is "get N decisions made"

This is the whole of it, and it inverts what a design document normally does.

A document optimised for understanding is complete everywhere. That is exactly what buries the two
things only this reader can rule on. They read for a long time, arrive at no question, answer
"looks fine to me", and the human step was theatre. **Attention is the most expensive resource in
this flow and every human step spends one unit of it.**

So: decisions first, background cut to what those decisions need, the full design behind them in an
appendix. The reader is doing something from the first line rather than meeting the first thing
that needs their judgement four layers in.

## Written for a reader, checked by a machine — which is why anchors exist

This is the only artifact in the flow written for a person rather than a model, so it goes in the
language that person reads. Everything a model reads — this skill, the spec, the template — stays
in English.

It is also machine-checked, and those two facts collide: **a check cannot grep
`## What you need to decide` in a document that might be written in Japanese.** So the checked
structure rides on **language-independent anchors** placed on their own line above the free-text
heading. The check reads the anchor, the reader reads the heading, and neither constrains the other.

```mdx
{/* genai:arch.decisions */}
## «heading, in the reader's language»

{/* genai:decision recommend=A */}
### D1 — «the question, stated as a question»

A. «option»
B. «option»

**«Why A»**: …

{/* genai:cost */}
**«What the wrong choice costs»**: …
```

Anchors are literals. **Never translate, reword or drop one.** MDX rejects HTML comments, so they
are written `{/* … */}`; nothing depends on the comment syntax, only on the slug inside it.

## Three sections, in a fixed order

| Anchor | Content | What the check reads |
|---|---|---|
| `genai:arch.decisions` | one `### D«n» — «the question»` per item, each with **≥2 options** (`A.` / `B.` …), an explicit **`recommend=`** on its anchor, and the cost of the wrong choice under `genai:cost` | all four, per item; zero items is a refusal |
| `genai:arch.background` | the minimum those decisions need — **40 lines is the ceiling** | the ceiling only; the section itself is optional |
| `genai:arch.appendix` | domain model, the contracts, the cross-cutting views. For the reader who wants depth; **carries no decision** | nothing, but the self-containment rule covers it |

The appendix is usually most of the document by volume and none of it by purpose. That is not a
flaw to correct — it is the evidence base the decisions are answerable from. What it must never do
is carry a decision of its own.

## If there is nothing to decide, do not write one

A change with genuinely nothing irreversible in it should not reach a person at all. **A fake
choice of the "A. do it / B. don't (not recommended)" kind is worse than none**: it spends the
attention and makes the step look effective. Say so in the report and leave that change without a
document.

How many, when there are any:

| The change is | Decisions | Appendix |
|---|---|---|
| at the centre of the product | every genuinely irreversible trade-off — domain boundaries, schema shape, external contracts. Usually 2–5 | full: domain model, the contracts, the cross-cutting views |
| supporting | only the trade-offs this change introduces, usually 1–2 | the contracts actually touched; no domain model when no new concept appears |
| routine | often none, and then no document | the contracts touched, a paragraph or two |

**Never manufacture decisions to reach a number.** A contract this change does not touch gets a
one-line "not affected" in the appendix and nothing more.

## What is not settled here

Behavioural intent — "when they go over the limit, hard block or leave headroom?" — is the kind of
question nobody can answer until they have seen the thing working. Written as a `### D«n»` item it
forces a ruling from someone who cannot yet see what they are ruling on, and the answer you get
back is worth what it cost them. Put it in the background with a line saying it is parked until
there is something to react to.

This document judges **structure**: is the domain model right, is the split into modules,
interfaces, tables and use cases reasonable for the domain, are the key trade-offs the right ones.

## The reader has read nothing else

They have not opened the spec, the proposal, or any other artifact, and they will not. The document
stands alone or it does not work.

- **Naming an internal artifact is refused by a check** — `proposal.md`, `design.md`, `tasks.md`,
  `specs/…`, the review and e2e records. The prose forms a check cannot catch ("as described in the
  design") are just as wrong.
- **Every domain noun and system name gets a one-line explanation where it first appears.** When
  the document is in a language other than English, put the English term inside the brackets
  alongside the gloss — `«term»(quota, how many requests one customer may make in a window)` — so
  the reader can search for it in a codebase and an issue tracker that are both in English.

## Carrier and content form

MDX, previewed through the `mdx-artifact` skill. Within that, prefer in this order: **diagram
(graphviz `dot` / `mermaid`) > table > DSL (DDL, JSON) > prose.** For each point ask whether a
diagram can say it, and fall back one step at a time. Prose is for what cannot be diagrammed at
all — the reasoning and the trade-off behind a decision — and stays inside one paragraph.

**MDX is the single source.** Never hand-write HTML, never build a page beside the document.

Two traps worth knowing before you hit them:

- **Never let a body line start with `<`.** MDX reads a leading `<` as flow-level JSX, which
  outranks inline code left unclosed across a line break — so wrapping a line inside
  `` `--layer <a|b>` `` produces ``Unexpected character `|` `` with no hint that wrapping caused it.
  Move the wrap point ahead of the inline code. Check with `grep -nE '^<[^A-Z/]'`; plain `grep '^<'`
  matches every component line and tells you nothing.
- **Prose inside a block component needs blank lines around it** to render as a paragraph.

## Derived one way, and never edited

It comes from the spec, always in that direction. When a reader's comment changes something, the
comment goes into the **spec** and the document is written again from the changed spec. Editing the
document to match what was said leaves the spec describing one design and the document describing
another, with nothing to say which is real.

Two consequences worth stating outright:

- **Nothing downstream reads it.** The input for anyone implementing, testing or reviewing is the
  spec. This document has been diagrammed and trimmed for a person, and the execution-level detail
  went out in the trimming.
- **Freshness is the graph's job, not a stamp inside the document.** An approval covers the spec it
  was given and no other; the step that builds refuses to enter when the spec moved after the
  ruling. Do not write a fingerprint into the document to re-check by hand — there is nothing for it
  to catch that the graph does not already refuse.

Full structure and per-section guidance: [references/template.md](references/template.md).
A finished document to read once before starting:
[references/worked-example.mdx](references/worked-example.mdx) — it is in English because it is
reference material for a model; **your output goes in the reader's language.**
