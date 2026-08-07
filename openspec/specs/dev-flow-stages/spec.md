# dev-flow-stages Specification

## Purpose
Defines what a development flow must establish about a change, and in what order, before anyone
reviews it — so that the expensive work is not started against an unconfirmed slice and the review
is not read against code nobody ran.
## Requirements
### Requirement: A core change confirms its slice with a person before design work starts

Design work is the expensive part, and it is spent against whatever slice the brief settled on. For
a change the project treats as core, the flow SHALL put a human decision between the brief and the
design work, carrying the slice being committed to.

The decision SHALL be recorded as an artifact, so that what was confirmed is legible later rather
than living only in a conversation. A non-core change SHALL NOT be required to pass this stage.

#### Scenario: S-STAGE-SLICE-BLOCKS — design does not start on an unconfirmed slice
- **WHEN** the graph for a core change places the slice confirmation between the brief and the design step
- **AND** the confirmation has not been given
- **THEN** the design step is not dispatchable
- **AND** the reason reported names the unsatisfied upstream rather than an internal state

#### Scenario: S-STAGE-SLICE-REJECTED — a rejected slice returns to the brief, not onward
- **WHEN** the person rejects the slice
- **THEN** the verdict routes back to the step that produced the brief
- **AND** the design step remains undispatched

#### Scenario: S-STAGE-SLICE-RECORDED — the confirmation leaves an artifact
- **WHEN** the person approves the slice
- **THEN** a decision artifact exists on disk under the change's own directory
- **AND** the gate that measures it reports it present

### Requirement: Implementation is not reviewed until the project's own suite has run against it

Acceptance testing runs once, later, on the integrated tree. Between implementation and code review
there is therefore no other point at which the product is executed. The flow SHALL run the
project's existing test suite against the change and record the result before the review stage may
start.

The result SHALL be tied to the code it was produced from, so that a result describing an earlier
version of the code cannot satisfy the stage.

#### Scenario: S-STAGE-SUITE-FRESH — a suite result from earlier code does not count
- **WHEN** the suite has run and recorded a result
- **AND** the implementation is then changed
- **THEN** re-evaluating the suite stage reports the recorded result as no longer describing the current code
- **AND** the stage does not pass on the strength of the earlier result

#### Scenario: S-STAGE-SUITE-MISSING — no result on disk is not a pass
- **WHEN** the suite stage is evaluated and no result artifact exists
- **THEN** the stage is rejected
- **AND** the message says the result is absent rather than that the suite failed

#### Scenario: S-STAGE-SUITE-FAILED — a failing suite is distinguished from an absent one
- **WHEN** the suite ran and reported that it did not complete successfully
- **THEN** the stage is rejected with a message describing the outcome the run reported
- **AND** that message is distinguishable from the one given when the result is merely absent

### Requirement: A rescue diagnosis reaches the implementer through the dispatch contract

A diagnosis produced to unstick a failing stage is only useful if whoever implements the fix is
handed it. The implementation stage SHALL declare the diagnosis as an input so that its path and
signature appear in the dispatch, and SHALL remain dispatchable when no diagnosis exists — most
changes are not bug fixes.

#### Scenario: S-STAGE-DIAG-CARRIED — a diagnosis is handed over, not searched for
- **WHEN** a diagnosis artifact exists for the change
- **AND** the implementation stage is dispatched
- **THEN** the dispatch names the diagnosis path among the upstream artifacts
- **AND** it carries the signature of the diagnosis as it stands

#### Scenario: S-STAGE-DIAG-ABSENT — no diagnosis does not block implementation
- **WHEN** no diagnosis artifact exists
- **AND** the implementation stage is dispatched
- **THEN** the dispatch succeeds
- **AND** the diagnosis is shown as absent rather than omitted silently

### Requirement: Workflows are named for the kind of work they carry

A project runs more than one kind of work through the engine, and a graph names the workflow it
belongs to. Workflow names SHALL identify the kind of work, so that reading a graph tells you which
process it is following.

Adding a workflow SHALL be a configuration change — a new declaration file — and SHALL NOT require
changing the installer.

#### Scenario: S-STAGE-WF-NAMED — the development flow is named for what it carries
- **WHEN** the installed workflows are listed
- **THEN** the development flow appears under a name identifying it as such
- **AND** no installed workflow carries a name that only identifies the toolkit

#### Scenario: S-STAGE-WF-ADDITIVE — a second workflow needs no installer change
- **WHEN** a workflow declaration file is added alongside the existing one
- **AND** the installer runs
- **THEN** both workflows are installed with their declared steps
- **AND** the installer source is unchanged

