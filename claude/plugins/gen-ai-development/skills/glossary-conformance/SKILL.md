---
name: glossary-conformance
description: Use when naming things in a domain that has a project glossary (a CONTEXT.md / ubiquitous-language registry) — introducing or renaming a module, a spec term, a type, an endpoint, a database column, or a test name — and you want to confirm the new names match the canonical terms. Also use to audit naming consistency across an existing change: checking that the words used in spec vocabulary, test names, and code identifiers all agree with the glossary for their bounded context. Triggers on "does this name match our glossary", "check naming consistency", "ubiquitous language drift", "are these identifiers aligned with CONTEXT.md". Not for verifying logic or correctness, and not for inventing glossary terms.
---

# Glossary Conformance

Machine-check that the domain vocabulary used in a change — spec wording, test names, and
code identifiers — matches the project's canonical glossary, so the *same word means the
same thing* everywhere. This is a deterministic naming check: it finds where an identifier
has drifted from the agreed term, or where a domain concept appears that the glossary has
never registered.

## What this skill is and is not

- It verifies that **identifiers match the glossary**. It does **not** verify that the
  code is correct. An implementation with perfectly conformant names can still do entirely
  the wrong thing — passing this check is **not evidence of correctness**, only evidence of
  naming consistency. Treat a clean report as "the words line up," nothing more.
- It **checks** vocabulary; it does **not author** the glossary. New canonical terms are
  coined upstream when the domain is first framed (the `grill` skill seeds them into
  `CONTEXT.md`). When this check finds an unregistered domain term, it **flags** it — it
  does not decide whether the fix is to rename the identifier or to add the term to the
  glossary. That resolution is the caller's call.
- It owns **domain-term consistency**, not general code style. Casing conventions,
  language idioms, and structural naming rules belong to the `develop-guideline` skill;
  this skill only asks "is this the agreed *word* for this *concept*."

## The glossary: `CONTEXT.md`, per bounded context

The canonical terms live in `CONTEXT.md` — a glossary mapping each canonical domain term
to a one-line meaning. **Crucially, a glossary is scoped to one bounded context.** A
repository with several bounded contexts has several glossaries, and the *same word can
legitimately differ* between them ("account" in billing ≠ "account" in auth). So a
conformance check is **always scoped to one bounded context** — never run globally across a
multi-context repo.

Before checking anything:

1. **Determine the bounded context in scope** — the module / package / service the change
   belongs to. If the change spans more than one, check each context against its own
   glossary separately.
2. **Locate that context's `CONTEXT.md`** — the context-local one if present, otherwise the
   project-root glossary. If no glossary exists at all, there is nothing to conform to:
   report that the registry is missing and stop (do not invent terms).

## The check — a deterministic procedure

Run these steps; they are mechanical and repeatable, not a judgment call.

1. **Parse the glossary.** From the in-scope `CONTEXT.md`, extract the set of canonical
   terms. Honor any declared **aliases** (accepted alternate spellings) and any
   **forbidden / deprecated forms** the glossary lists for a term.
2. **Extract candidate domain identifiers from the three surfaces:**
   - **spec vocabulary** — the domain nouns/verbs used in the change's spec contracts
     (module design, protocol, schema, scenarios);
   - **test names** — describe/it strings and test function names;
   - **code identifiers** — module, type, function, field, endpoint, and column names that
     name a domain concept.
   Use ordinary text/code search tooling for this (e.g. `grep` / `rg` for prose and names,
   an AST grep such as `ast-grep` where you need real identifiers rather than substrings).
   Split compound identifiers (camelCase / snake_case / kebab-case) into their component
   words before matching, so `orderLineItem` is tested against `order`, `line`, `item`.
3. **Diff against the glossary** and classify every domain term you found:
   - **Drift** — a concept the glossary *does* register, but written in a non-canonical
     surface form (a known synonym, a forbidden/deprecated form, a misspelling). The
     canonical term exists; this identifier doesn't use it. → **violation.**
   - **Unregistered** — a domain concept that appears in spec/test/code but is **absent**
     from the glossary. The glossary may be incomplete, or the name may be invented. →
     **flag** (see scope note above — this skill does not resolve it).
   - **Conformant** — matches a canonical term or a declared alias. → pass.
   Ignore non-domain identifiers (loop counters, framework boilerplate, generic utility
   names) — only words that name a *domain concept* are in scope.

## The report

Emit a conformance report the caller can act on:

- **Verdict:** `pass` (no drift, no unregistered domain terms) or `fail` (one or more
  drift violations or unregistered flags).
- **Per finding:** the offending identifier, where it appears (which surface + file/line),
  the canonical term it should be (for drift), or "absent from glossary" (for
  unregistered), and the bounded context checked.
- **For multi-context changes:** group findings by bounded context, each against its own
  glossary.

Close by restating the scope limit in one line so the verdict is never over-read: *this
report attests only that the domain vocabulary is (or isn't) consistent with the glossary —
it says nothing about whether the change is correct.*
