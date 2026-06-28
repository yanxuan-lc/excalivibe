# BRIEF.md — skeleton and a worked example

The `BRIEF.md` is the sole output of a grill conversation. It is a behavioral contract:
everything in it is phrased as observable behavior, so a person or a test can decide
whether the change is done. Implementation choices (modules, data structures, libraries,
APIs) do not belong here.

## Skeleton

```markdown
# BRIEF: <short title of the change>

## Current behavior
<What happens today. For a brand-new capability, say "no such capability exists" and
describe the closest current path the user takes instead.>

## Desired behavior
<What should happen instead, in concrete user-visible terms. Describe the experience, not
the mechanism.>

## Acceptance criteria
- [ ] <A testable condition that must hold for "done". Each line decides pass/fail on its
      own.>
- [ ] <Cover the edge cases the conversation surfaced — empty input, the unauthorized
      user, the duplicate, the failure path — not just the happy path.>
- [ ] <…>

## Out-of-scope
- <What this change deliberately does NOT do. This is the fence around the work.>
- <…>
```

### Deep mode adds a domain-framing section

For a new, central domain concept, add this section *above* the four behavioral sections,
and seed the same terms into the project glossary (`CONTEXT.md`). It states what the domain
*is* in the user's language — not how it will be modeled.

```markdown
## Domain shape (deep mode only)
- **<Core concept>**: <one-line meaning in the user's terms.>
- **States / lifecycle**: <the states a core concept moves through, if any.>
- **Invariants**: <rules that must always hold — "a paid order can never be deleted".>
- **Glossary seeds** (mirrored into CONTEXT.md): `<Term>` = <one-line definition>.
```

## A worked vague→sharp exchange (light mode)

This shows the signature mechanic: **one question, carrying grill's own recommended
answer**, so the user confirms or corrects instead of authoring from blank.

> **User:** Let's add a way for people to export their data.

> **Grill:** A few things to pin down so "export" is unambiguous — one at a time.
>
> First: **which data, and in what format?** I'd recommend *the user's own records only*
> (not other users' data), exported as **CSV**, because CSV opens everywhere and the data
> here is tabular. Agree, or did you mean a different scope/format (e.g. JSON, or a full
> account archive)?

> **User:** Their own records, but JSON — it has nested fields.

> **Grill:** Got it, JSON. Next: **what happens to a large export — block the user while
> it generates, or run it in the background and notify when ready?** For the data sizes
> here I'd recommend **synchronous download** (simpler, and exports are small); we add
> background jobs only if they get big. Sound right?

> **User:** Synchronous is fine.

> **Grill:** Last one: **what should an unauthenticated or unauthorized request get?** I'd
> recommend **reject with a clear 'not allowed' message**, never a partial or empty file,
> so a failure is never mistaken for "you have no data." OK?

> **User:** Yes.

> **Grill:** Here's the brief — confirm and I'll write it.
>
> - **Current behavior:** no export exists; users would have to copy records by hand.
> - **Desired behavior:** a signed-in user can download their own records as a JSON file,
>   on demand, in one click.
> - **Acceptance criteria:** (1) export contains only the requesting user's records; (2)
>   format is valid JSON preserving nested fields; (3) download is synchronous; (4) an
>   unauthorized request is rejected with a clear message and no file.
> - **Out-of-scope:** other users' data; CSV/other formats; scheduled or background
>   exports; re-import.

The whole exchange is three questions because the request was conventional. A deep-mode
exchange on a novel core concept runs longer and additionally fills the domain-shape
section and seeds the glossary.
