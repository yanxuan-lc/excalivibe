# project-setup Specification

## Purpose
Brings a project to the state where the flow can run — every dependency present, every convention in
place — and does it repeatably, so that upgrading is the same command as installing and neither one
overwrites something the project owns.
## Requirements
### Requirement: Every item is created, refreshed or preserved, and says which

A setup step that runs twice must not be a gamble. Each item it touches SHALL fall into exactly one
disposition, and the run SHALL report the disposition it applied:

- **created** — absent, so it is made
- **refreshed** — shipped by the toolkit, so it is overwritten with the current version
- **preserved** — authored by the project, so it is left alone

An item the project authored SHALL never be refreshed, and an item the toolkit ships SHALL never be
preserved into staleness.

#### Scenario: S-SETUP-IDEMPOTENT — a second run changes nothing it should not
- **WHEN** setup is run twice against the same project with no edits between
- **THEN** the second run succeeds
- **AND** every item authored by the project is reported preserved

#### Scenario: S-SETUP-REFRESHES-OURS — an upgrade replaces the shipped definitions
- **WHEN** a step definition changes in the toolkit and setup is run again
- **THEN** the installed definition matches the new one
- **AND** it is reported refreshed rather than preserved

#### Scenario: S-SETUP-PRESERVES-THEIRS — a hand-edited glossary survives
- **WHEN** the project's glossary already has entries and setup is run again
- **THEN** its contents are unchanged
- **AND** it is reported preserved

### Requirement: Sections written into files the project owns are delimited

`AGENTS.md` and `CLAUDE.md` belong to the project and usually already exist. Content this setup adds
to them SHALL be bounded by literal markers, and a re-run SHALL replace only what lies between them.

#### Scenario: S-SETUP-MARKERS — surrounding content is untouched
- **WHEN** the file already has content before and after the marked block, and setup runs again
- **THEN** the text outside the markers is byte-identical
- **AND** the text between them is the current version

#### Scenario: S-SETUP-MARKERS-ABSENT — a file without the block gains one
- **WHEN** the file exists but has no marked block
- **THEN** the block is appended
- **AND** nothing already in the file is rewritten

### Requirement: The project's own check commands are collected, not guessed

A gate that runs the project's tests needs to know what that command is, and the toolkit cannot
know. Setup SHALL take each command as an input and bake it into the definitions that need it.

A command the project does not have SHALL be declarable as absent, which removes the gate that would
have run it. Setup SHALL NOT substitute a command that trivially succeeds.

Re-running setup SHALL preserve the commands already installed rather than requiring them again.

#### Scenario: S-SETUP-CMD-BAKED — the gate runs the project's own command
- **WHEN** setup is given the project's test command
- **THEN** the installed step's gate carries that command verbatim
- **AND** running the gate executes it

#### Scenario: S-SETUP-CMD-ABSENT — a missing command removes its gate, not its honesty
- **WHEN** a command is declared absent
- **THEN** the installed step has no gate for it
- **AND** the run reports which check is consequently unguarded

#### Scenario: S-SETUP-CMD-PRESERVED — an upgrade does not lose them
- **WHEN** setup has run with commands, definitions change in the toolkit, and setup runs again without being given them
- **THEN** the installed gates still carry the original commands

### Requirement: The specification templates a project scaffolds match what its checks demand

The design template this flow expects carries sections beyond the stock one, and the completeness
check requires them. Setup SHALL install the template set alongside the tooling, so that a scaffolded
document already has the sections it will be checked for.

#### Scenario: S-SETUP-SCHEMA — a scaffolded design already has the sections
- **WHEN** setup has run, and a change is scaffolded
- **THEN** the design document contains every section the completeness check requires
- **AND** the check reports those sections as unwritten rather than as absent — so what remains is writing content, not adding headings

### Requirement: Read-only inspection does not require a permission decision

Reading the repository changes nothing, and being asked about it trains people to approve without
reading. Setup SHALL record the read-only inspection commands as allowed, in the host's own
configuration.

#### Scenario: S-SETUP-ALLOW-READS — history commands stop prompting
- **WHEN** setup has run on a host with a permission configuration
- **THEN** the read-only git commands are listed as allowed
- **AND** commands that mutate are not

