## ADDED Requirements

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
