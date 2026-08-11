---
name: genai-openspec
description: Decide how a spec, a change delta or a scenario has to be written so that openspec accepts it and this flow's gates can measure it — the scenario id convention, the header shape, where the database expectation goes, and which of openspec's own outputs can be believed. Use when writing or fixing a change delta, when a validation or archive step reports something that reads like a formatting complaint, when a scenario has to be added to work that is already specified, and when deciding what openspec should be asked for rather than reimplemented.
---

# Writing openspec so the flow can read it

openspec owns change management here: what a change is, what a delta looks like, when a change may
be archived. This file adds the conventions **on top of** it that the flow's gates depend on — the
ones openspec itself does not care about and will happily accept the absence of.

That gap is the reason this exists. A spec can pass `openspec validate --strict` and still be
unusable here, because openspec checks that a requirement *has* scenarios while three later steps
need to *address one scenario in particular*.

## The scenario id

**One form, no alternatives: `S` followed by a decimal number.** `S1`, `S2`, `S17`. Numbered from 1
within a change, and the number means nothing beyond identity.

```markdown
#### Scenario: S1 — a valid order is accepted
```

Three rules carry the weight:

- **Never renumber, never reuse.** A new scenario is appended after the highest number in that
  change, even when it belongs conceptually between S1 and S2. The file's order carries the
  sequence; the id carries identity, and an id that shifts is not one. A reused id is worse — it
  makes two different assertions read as the same one across the manifest, the test title and the
  report.
- **Unique within the change, not across the round.** Every record keyed on an id lives inside one
  change directory, so two changes both using `S1` cannot confuse anything. Demanding more would
  let two independent changes break each other.
- **Matched verbatim, everywhere.** `s1`, `S01` and `S-1` are three different ids, and none of them
  is `S1`. The id appears in the spec header, in the test's own title, and as a key in two records;
  a re-cased or re-punctuated copy reads as an id nobody declared.

Semantic ids (`S-CHK-ACCEPT`) were considered and rejected: the id would restate the title, and two
places describing the same thing drift. The title says what the scenario is. The id says which one
it is.

## The scenario header

```markdown
#### Scenario: S1 — a valid order is accepted
- **WHEN** a valid order is submitted with two items
- **THEN** the confirmation page shows the order number
- **AND** Database: `orders` gains one row with `status=accepted` and the two `order_items` rows
```

- **Level four exactly.** openspec treats *any* level-4 header inside a requirement as a scenario,
  which is looser than it looks: a `#### Notes` heading is a scenario to openspec, and will be
  counted as one that carries no id.
- **The id comes first, right after `Scenario:`.** It is read as the first word of the header.
- **A fenced example is not a scenario.** openspec masks fenced blocks, so a `####` header inside
  triple backticks is invisible to it — write examples that way on purpose.
- **State the database expectation** on any scenario that writes. It is the half a green interface
  assertion cannot see, and it is verified independently later; a scenario that only says what the
  screen shows leaves that verification with nothing to check against. Say which table, which
  columns, and what value — not "the data is saved".

## The whole header is openspec's identity for the scenario

This is the interaction to know before retitling anything. openspec compares scenarios **by their
header text**: a MODIFIED requirement whose block omits a scenario the main spec still has is a
validation error, and `openspec archive` refuses to drop one. So **editing the prose after the id
changes the scenario's identity as far as openspec is concerned** — the old title reads as removed
and the new one as added.

Retitle deliberately, then, and keep the id and its separator untouched while doing it. Putting the
id at the front is what keeps the flow's own records pointing at the same scenario across a retitle.

## What to ask openspec for, and what it cannot tell you

**Drive openspec's own commands; never reimplement one of its rules.** A local copy of a rule drifts
silently the day openspec changes it. Three facts shape how that is done here:

- **Its exit code cannot be believed.** `openspec validate --changes --strict` reports failures and
  exits 0 anyway; `openspec archive` carries warnings through and exits 0 as well. Every judgment
  built on openspec reads its **output** — the totals line, the `warnings[]` — and never `$?`.
- **`openspec show --json` drops the scenario header.** A scenario object carries `rawText` — the
  WHEN/THEN bullets — and no name. So the ids cannot be read out of openspec's own output; they are
  read from the markdown. What openspec *can* be asked for is **how many** scenarios there are, and
  that number is worth having: it is fence-aware and level-4-accurate by construction, so comparing
  it against the ids found in the markdown turns a parser disagreement into something that reports
  itself instead of quietly losing a scenario.
- **"Nothing found to validate" is not a pass.** Nothing validated and nothing wrong produce the
  same cheerful output.

## Deltas

A change carries the delta against the current spec, under the operation headers openspec defines
(`## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`). Two consequences
that cost a round when missed:

- **A MODIFIED block must carry every scenario the requirement already has**, plus the change.
  Listing only the new one reads as deleting the rest, and both `validate` and `archive` say so.
- **Do not restate the parts of the capability that are not changing.** The existing spec is still
  there, and a delta that repeats it makes the next MODIFIED block ambiguous about which copy is
  authoritative.

## What this does not do

- Does not explain what each step of the flow is gated on — that is `genai-guideline`
- Does not decide which requirements belong in one spec, or write the design rationale
- Does not run the flow, and does not install it
- Does not replace `openspec --help`: the commands, their flags and the directory layout are
  openspec's own documentation, and this file deliberately does not copy them
