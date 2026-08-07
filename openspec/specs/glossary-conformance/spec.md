# glossary-conformance Specification

## Purpose
Keeps the words a change uses in step with the words the project has agreed on, so that a spec, its
tests and its code all name the same concept the same way — and so that a concept nobody has
registered yet is noticed rather than silently invented.
## Requirements
### Requirement: A conformance check is scoped to exactly one bounded context

A glossary belongs to one bounded context, and the same word may legitimately mean different things
in two of them. The check SHALL therefore resolve a single bounded context before comparing
anything, and SHALL NOT compare identifiers against a glossary belonging to another context.

When a change spans several bounded contexts, the check SHALL be performed once per context, each
against that context's own glossary.

#### Scenario: S-GLOSS-SCOPE-LOCAL — a context-local glossary wins over the project one
- **WHEN** the change touches a module that has its own `CONTEXT.md`, and the project root also has one
- **THEN** the report names the module's glossary as the one it compared against
- **AND** no term is reported as drift solely because it differs from the project-root glossary

#### Scenario: S-GLOSS-SCOPE-SPLIT — a change spanning two contexts is reported per context
- **WHEN** the change touches two modules that each carry their own `CONTEXT.md`
- **THEN** the report contains one findings group per bounded context, each naming its glossary
- **AND** a word registered in one context is not reported against the other's glossary

#### Scenario: S-GLOSS-SCOPE-ABSENT — no glossary means no verdict
- **WHEN** neither the module nor the project root has a `CONTEXT.md`
- **THEN** the report states that no glossary was found and stops
- **AND** no term is invented, and no `pass` verdict is issued

### Requirement: Findings are classified as drift or unregistered, never merged

The two failure shapes have different resolutions and SHALL be reported separately. **Drift** is a
concept the glossary registers, written in a non-canonical form — the fix is to rename the
identifier. **Unregistered** is a domain concept absent from the glossary — the fix may be to
rename *or* to register the term, and the check SHALL NOT decide which.

Identifiers that do not name a domain concept SHALL be excluded rather than reported.

#### Scenario: S-GLOSS-DRIFT — a registered concept written the wrong way is drift
- **WHEN** the glossary registers `customer` and lists `client` as a forbidden form, and the code declares `clientId`
- **THEN** the finding is classified as drift, naming `customer` as the canonical term
- **AND** the finding carries the identifier, the surface it appeared on, and its file and line

#### Scenario: S-GLOSS-UNREGISTERED — an unknown domain concept is flagged, not resolved
- **WHEN** an identifier names a domain concept the glossary does not register in any form
- **THEN** the finding is classified as unregistered
- **AND** the report does not state whether to rename the identifier or register the term

#### Scenario: S-GLOSS-NONDOMAIN — non-domain identifiers are out of scope
- **WHEN** the change adds a loop counter, a framework callback name, or a generic utility name
- **THEN** none of them appears in the findings

### Requirement: The report states what a clean run does and does not prove

A clean conformance report attests that the vocabulary lines up. It is not evidence that the change
is correct, and it SHALL say so, so that a downstream reader cannot over-read the verdict.

#### Scenario: S-GLOSS-LIMIT — a passing report restates its own limit
- **WHEN** the check finds no drift and no unregistered concepts
- **THEN** the verdict is `pass`
- **AND** the report closes by stating that it attests to vocabulary consistency only, and says nothing about whether the change is correct

### Requirement: Canonical terms are recorded where the domain is first framed

A check against an empty glossary reports every domain word as unregistered, which is noise rather
than signal. The step that first frames the domain with the user SHALL record each newly coined
canonical term, with its one-line meaning, in the bounded context's `CONTEXT.md`, creating the file
if it is absent.

`CONTEXT.md` SHALL NOT be declared as a gated artifact of that step: it accumulates across changes,
so measuring it per change would make two concurrent changes interfere through it.

#### Scenario: S-GLOSS-SEED — a newly named concept lands in the glossary
- **WHEN** the requirement conversation settles on a name for a concept the project has not had before
- **AND** that concept is central to what is being built
- **THEN** the term and a one-line meaning are appended to the bounded context's `CONTEXT.md`
- **AND** the file is created first if it does not exist

#### Scenario: S-GLOSS-SEED-NOT-GATED — the glossary is not measured as an artifact
- **WHEN** the requirement step's declared outputs are inspected
- **THEN** `CONTEXT.md` is not among them
- **AND** the step's gates do not fail when `CONTEXT.md` is unchanged

