# Stable scenario identifiers

Read this before writing the first acceptance scenario. The identifier convention is
load-bearing for anything that maps work to scenarios, and an identifier that exists is
**partly irreversible** — so the cheap moment to get it right is now.

## The shape of a scenario

The base format validates that scenarios exist and counts them; it does not validate the
scenario body, so bullets beyond WHEN/THEN are free, and the title may carry a prefix.

```markdown
## ADDED Requirements

### Requirement: A user can submit an order
The system SHALL accept the submission and create an order when stock is sufficient.

#### Scenario: S-ORDER-SUBMIT-OK — submission succeeds when stock is sufficient
- **WHEN** the user clicks "Submit order" and the SKU's available stock ≥ the ordered quantity
- **THEN** the page navigates to the order detail view, showing status "awaiting payment"
- **AND** `POST /orders` returns 201 with `orderId` in the body
- **AND** Database: `orders` +1 row (`status=created`), matching `stock` row's `available` −N
```

Four kinds of information, each in its own place:

| Information | Position | Why it is separate |
|---|---|---|
| stable identifier | `#### Scenario: <id> — …` | tests map to it; coverage is computed against it |
| user action sequence | `**WHEN**` | what the test drives |
| observable assertions | `**THEN**` | what the interface must show |
| **expected persisted effect** | `**AND** Database: …` | verified independently of the interface |

**That last row is the one most specs never land.** Requiring verification of database writes
without saying where the expectation is written down leaves the requirement unmeetable. A green
UI assertion sitting on top of a row that was never written is a false pass, and this bullet is
what makes catching it possible.

## The grammar

**The identifier is whatever precedes the em dash, taken verbatim.** `S-<AREA>-<SLUG>` is a
recommendation; the parser has no opinion about the shape. A project that has settled on
suffixed ordinals (`S1b`), semantic identifiers (`S-TI-PIN`), or a non-`S` prefix (`RRG1`) is
read correctly without renaming anything.

This matters more than it looks. The parsed set is the **denominator** of the coverage
equation, so an identifier shape the parser cannot read does not merely go unnamed — it drops
out of the total, and coverage then balances against a smaller denominator and reports a pass.
A header that does not parse must be reported as an error, never skipped.

Two hard rules, and only two:

- **`:` is reserved [MUST].** It is the cross-change namespace separator — a reference from
  another change is written `<change-id>:<id>`. An identifier carrying its own colon makes that
  unsplittable, an ambiguity with no recovery.
- **Identifiers must not repeat within one change [MUST].**

**Whitespace is allowed**, deliberately. Banning it was considered and withdrawn: real specs
contain identifiers with spaces — slash aliases where one scenario satisfies two identifiers
(`S-AL-OUT / RRG3`), middot qualifiers (`S1 · EMB-WIRED-SEMANTIC`), parentheticals
(`S-AL-1 (save-time half)`). The spacing variance this was meant to prevent is better absorbed
by matching loosely, so `S-AL-OUT / RRG3` and `S-AL-OUT/RRG3` are the same identifier.

## Consistency inside a repository beats the recommendation

Match the shape the project already uses. A spec mixing `S1` with `S-TI-PIN` makes a reader
wonder whether the shape carries meaning, and that doubt costs more than either convention does
on its own. Nothing can enforce this — no tool knows which identifiers are new — so it is on
whoever writes the spec.

Use `S-<AREA>-<SLUG>` when the project has no existing shape. `S-AUTHN-WS-GATED` survives being
read out of context; `S1` does not, and at the scale where coverage reports get skimmed, that is
the difference between a report someone reads and a report someone scrolls past.

## Why an existing identifier is immutable

An identifier does not live in the spec file. It **leaks** — measured on one real repository,
the same literals appeared in 1215 source files, 183 test names, 58 pipeline documents, and 456
commit messages.

That last carrier is the argument: **commit messages cannot be rewritten.** Any rule that forces
an identifier to change is therefore not merely expensive, it is partly irreversible — some
references would permanently point at something that no longer exists.

So the line is drawn there: **a rule that changes the identifier literal is out of bounds; a
rule about the syntax around it is fair game.** The separator is syntax and may be migrated;
the identifier is not and may not.

## Adopting this where specs already exist

Nothing is rewritten.

| Population | Treatment | Why |
|---|---|---|
| has an identifier, any shape | **leave it** | renaming is partly irreversible |
| no identifier, already archived | **leave it** | never re-verified; permanently out of scope |
| no identifier, in a change you are editing now | **add one** | adding ≠ renaming — nothing referenced an identifier that did not exist |
| wrong separator (`S1 - t`) | fix mechanically | separator is syntax, not identity |
| newly written | recommended shape | — |

**Adoption is incremental by construction.** Coverage only ever reads the delta specs of the
changes in current scope; it never reads the archived baseline. A repository with thousands of
identifier-less scenarios in its history therefore owes nothing up front.

You pay only when you **touch** an old requirement: restating it under `## MODIFIED
Requirements` copies its scenarios into your delta, which brings them into scope and they then
need identifiers. That cost is proportional to the change you are already making, on lines you
are already editing.

## Cross-change references

One release may span several changes, and verification runs against their union — so two
changes that each define `S1` collide.

- Any cross-change reference is written `<change-id>:<id>`.
- **At release scope, write the qualified form everywhere** — not only where a collision is
  known. A bare identifier that two changes both answer to counts for *neither*: guessing would
  let one mention close two scenarios, which is how a report naming one scenario once passed as
  full coverage of two changes.
