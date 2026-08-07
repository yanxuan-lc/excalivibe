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

### Requirement: An irreversible act carries a key that identifies what it already did

A run can be resumed, retried, or picked up by someone else. For a step whose act cannot be undone —
publishing, merging into a shared branch, archiving — repeating it because nobody could tell it had
already happened is the expensive failure. Every such step SHALL record, for each act it performed,
an identifier under which that act can be recognised again.

The identifier SHALL name the act's effect in the outside system, not the attempt that produced it.

#### Scenario: S-STAGE-EFFECT-KEY — a published release is recognisable afterwards
- **WHEN** a step publishes a release
- **THEN** its report records the target system, the identity of what was published, and a key derived from that identity
- **AND** the key does not include the attempt number or a timestamp

#### Scenario: S-STAGE-EFFECT-RESUME — a resumed run can tell the act already happened
- **WHEN** the step is reached a second time and the recorded key matches an act already performed
- **THEN** the step reports the existing act rather than performing it again
- **AND** the report says the effect was already in place

### Requirement: A batch stage cannot depend on an individual change's artifacts

A stage that covers several changes at once has no single change to name. Steps in such a stage
SHALL NOT declare inputs produced by per-change steps: the graph variable that locates a change's
artifacts holds one value, and a batch has many.

Which changes are in the batch SHALL therefore be established by a step of the batch stage itself,
and read from that step's artifact by the steps that follow.

#### Scenario: S-STAGE-BATCH-NO-CHANGE-INPUT — a batch graph needs only its own variable
- **WHEN** a graph is created containing only batch-stage steps, supplying only the batch variable
- **THEN** the graph is created
- **AND** no error asks for the per-change variable

#### Scenario: S-STAGE-BATCH-ROSTER — the batch's contents come from an artifact, not from a variable
- **WHEN** a batch-stage step needs to know which changes it covers
- **THEN** it reads them from the roster artifact produced by the batch stage
- **AND** the roster names each change directory it covers

### Requirement: Acceptance runs once against the integrated result

Acceptance testing that passes on a change in isolation says nothing about the same change after
integration. The flow SHALL run acceptance once, against the integrated tree, and SHALL tie the
result to the exact commit it ran on.

A change's own stage SHALL still author its acceptance material, so that test code follows the spec
that motivated it rather than being written later against code.

#### Scenario: S-STAGE-ACCEPT-ON-TREE — the acceptance result is tied to the integration commit
- **WHEN** acceptance has run and passed
- **AND** the integration branch then gains another commit
- **THEN** re-evaluating acceptance reports the recorded result as describing a different commit
- **AND** the stage does not pass on the strength of the earlier result

#### Scenario: S-STAGE-ACCEPT-AUTHORED-EARLY — authoring stays with the change
- **WHEN** the implementation stage's steps are listed
- **THEN** the step that authors acceptance material is among them
- **AND** the step that executes acceptance is not

### Requirement: Nothing is merged before the integrated tree has been checked

Merging into a shared branch is the point after which a defect is everyone's. The flow SHALL run the
project's full checks and the cross-end consistency audit against the integrated tree, and SHALL
place both before the merge rather than after it.

#### Scenario: S-STAGE-AUDIT-BEFORE-MERGE — auditing precedes the irreversible step
- **WHEN** the batch graph is inspected
- **THEN** the full-check step and the cross-end audit both lie upstream of the merge
- **AND** neither is reachable only after it

#### Scenario: S-STAGE-CHECK-FAILS-RETURNS — a failing check sends the batch back, not onward
- **WHEN** the full check on the integrated tree fails
- **THEN** the verdict routes back into the batch stage
- **AND** the merge step remains undispatched

