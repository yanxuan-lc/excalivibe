## Why

Nothing in this repository produces or reads a domain glossary. `CONTEXT.md` — the file that says
which word is the agreed word for which concept — is never written by any skill, and no check ever
compares an identifier against it. Grep the whole tree for `CONTEXT.md`: zero hits.

The 3.0 migration is where it went. The previous toolkit had a `glossary-conformance` skill, and its
`grill` skill seeded canonical terms into `CONTEXT.md` as they were coined. `grill` came across;
that section of it did not, and the conformance skill was never migrated at all.

The cost shows up in the four-contract spec work that now exists. A spec names domain concepts, code
implements them, tests describe them — three surfaces, and nothing keeps them using the same word.
Naming drift is cheap to prevent at the moment a term is coined and expensive to unwind once three
surfaces disagree.

## What Changes

- `glossary-conformance` is added to `dev-toolkit`: what to check, how to scope it to one bounded
  context, and how to classify each finding.
- `genai.brief`'s brief gains one instruction — record newly coined canonical terms in `CONTEXT.md`.
  That is the write side of the chain, and without it the check has nothing to check against.
- The migrated skill drops two claims that are no longer true: that it is implemented as an engine
  `lint glossary` script (that engine does not exist here), and that `grill` performs the seeding.

## Capabilities

### New Capabilities

- `glossary-conformance`: checking that the domain vocabulary in a change's specs, tests and code
  matches the bounded context's registered glossary, and reporting drift separately from concepts
  the glossary never registered.

### Modified Capabilities

None.

## Impact

| Affected | What |
|---|---|
| `src/plugins/dev-toolkit/skills/glossary-conformance/` | new skill |
| `src/plugins/dev-workflow/.../assets/nodes/genai.brief/brief.md` | one instruction added |
| `claude/` · `codex/` · `common/` | regenerated |

`CONTEXT.md` is **not** declared as a node output. It accumulates across changes and is shared, so
signing it per-change would make two concurrent changes interfere through it.
