---
description: "Decide whether the words a change uses are the words this project agreed on — comparing the domain terms in its spec, its test names and its code identifiers against the registered glossary for one bounded context, and separating a concept written the wrong way from a concept nobody registered. Reach for it when naming something the project has not named before, when the same idea seems to be going by two names, when a review asks whether the vocabulary holds together, or before a spec is built against. It reports and classifies; whether to rename the identifier or register the term is not its call, and a clean report says the words line up, never that the change is correct."
description-claude: "Decide whether the words a change uses are the words this project agreed on — comparing the domain terms in its spec, its test names and its code identifiers against the registered glossary for one bounded context, and separating a concept written the wrong way from a concept nobody registered. Reach for it when naming something the project has not named before, when the same idea seems to be going by two names, when a review asks whether the vocabulary holds together, or before a spec is built against. It reports and classifies; whether to rename the identifier or register the term is not its call, and a clean report says the words line up, never that the change is correct."
description-codex: "Decide whether the words a change uses are the words this project agreed on — comparing the domain terms in its spec, its test names and its code identifiers against the registered glossary for one bounded context, and separating a concept written the wrong way from a concept nobody registered. Reach for it when naming something the project has not named before, when the same idea seems to be going by two names, when a review asks whether the vocabulary holds together, or before a spec is built against. It reports and classifies; whether to rename the identifier or register the term is not its call, and a clean report says the words line up, never that the change is correct."
name: glossary-conformance
---

# Glossary conformance — one concept, one word, everywhere

A spec names a concept, code implements it, tests describe it. Three surfaces, written at three
different moments, and nothing holds them to the same word. So `customer` becomes `client` becomes
`user`, and six months later nobody can tell whether those are three things or one.

This check compares the domain vocabulary a change actually used against the vocabulary the project
registered, and reports where they have come apart.

## What a clean report proves, and what it does not [MUST read this way]

**It proves the words line up. Nothing else.** An implementation with perfectly conformant names can
do entirely the wrong thing. Reading a pass as evidence of correctness is the one way this check can
make things worse than not running it, because it spends a reviewer's confidence on a question it
never asked.

**Nothing enforces that it ran.** This is a procedure someone follows, not a command with an exit
code. The steps below are mechanical and repeatable, but no gate measures them and no file records
that the check happened. Treat the absence of a report as "not checked", never as "nothing found" —
those look identical from the outside and only one of them is good news.

It also does not author the glossary. New canonical terms are coined upstream, where the domain is
first framed with the person asking for the work. When this check meets a term the glossary has
never registered, it **flags** it and stops there.

Casing conventions, language idioms and structural naming rules are **`coding-guideline`'s**. This
skill asks only "is this the agreed *word* for this *concept*".

## Scope to one bounded context, always [MUST]

A glossary belongs to one bounded context, and **the same word can legitimately differ between two
of them** — `account` in billing is not `account` in auth. A check run across a multi-context
repository against a single glossary manufactures findings that are not defects.

So, before comparing anything:

1. **Resolve the bounded context** — the module, package or service this change belongs to. If the
   change spans several, check each separately against its own glossary.
2. **Locate that context's glossary** — the context-local `CONTEXT.md` if there is one, otherwise
   the project-root file.
3. **If neither exists, stop.** Report that no glossary was found. Do not fall back to inventing
   terms from the code you are reading — that produces a glossary describing the drift.

## The procedure

**1. Parse the glossary.** Extract the canonical terms. Honour any declared **aliases** (accepted
alternate spellings) and any **forbidden or deprecated forms** listed against a term — those are
what turn a vague "looks different" into a definite finding.

**2. Extract candidate domain identifiers from three surfaces.**

| Surface | What to take |
|---|---|
| spec | the domain nouns and verbs in the contracts — module design, protocol, schema, scenarios |
| tests | describe/it strings and test function names |
| code | module, type, function, field, endpoint and column names that name a domain concept |

Use ordinary search tooling — `rg` for prose and names, an AST grep such as `ast-grep` where you
need real identifiers rather than substrings. **Split compound identifiers first**
(camelCase / snake_case / kebab-case), so `orderLineItem` is tested against `order`, `line`, `item`.

**3. Classify every domain term you found.** Three outcomes, and the first two are not the same
problem:

- **Drift** — the glossary registers this concept, but the identifier writes it another way: a known
  synonym, a forbidden form, a misspelling. The canonical term exists and this is not it.
  → **violation**, and the fix is to rename.
- **Unregistered** — the concept appears in the change and is absent from the glossary. Either the
  glossary is incomplete or the name was invented. → **flag**. Do not decide which; renaming and
  registering are both legitimate and the choice is not yours.
- **Conformant** — matches a canonical term or a declared alias. → pass.

Identifiers that do not name a domain concept — loop counters, framework callbacks, generic
utilities — are out of scope. Excluding them is judgement, so say which surfaces you searched, and
a reader can tell "not found" from "not looked for".

## The report

- **Verdict** — `pass` when there is no drift and nothing unregistered; otherwise `fail`.
- **Per finding** — the identifier, which surface it came from with file and line, and either the
  canonical term it should have used (drift) or "absent from the glossary" (unregistered).
- **The context checked**, named. For a multi-context change, one group per context, each naming its
  own glossary.
- **A closing line restating the limit** — this report attests that the domain vocabulary is or is
  not consistent with the glossary, and says nothing about whether the change is correct.

That last line is not boilerplate. Without it the verdict travels alone, and `pass` reads as
approval to whoever sees it next.

## The glossary file

`CONTEXT.md` maps each canonical domain term to a one-line meaning, and may list aliases and
forbidden forms against a term. It is an ordinary file in the repository, per bounded context, and
it accumulates — a term registered by one piece of work is there for the next.

It is deliberately **not** a gated artifact of any step. It is shared across concurrent work, so
measuring it per change would make two pieces of work interfere through a file neither of them is
really changing.
