# work-queue Specification

## Purpose
Holds work that is not yet a change, and composes the batches that finished changes are delivered
in — so that starting a change is a decision someone made rather than the only way to record an
idea, and so that a batch has a definition to be checked against.
## Requirements
### Requirement: An item records why it is worth doing, not how

The queue is read months later by someone deciding what to work on. An item SHALL record what is
wanted and what makes it worth doing. It SHALL NOT record a design, because a design written before
the work is scheduled is a design written against assumptions nobody has checked.

An item SHALL carry a state, and the states SHALL distinguish "not decided" from "decided against".

#### Scenario: S-QUEUE-CAPTURE — an idea is recorded without being designed
- **WHEN** an idea is captured
- **THEN** the entry states what is wanted and why it matters
- **AND** it contains no schema, no interface and no implementation plan

#### Scenario: S-QUEUE-DECLINED — a rejected item stays, with its reason
- **WHEN** an item is decided against
- **THEN** it remains in the file with a state saying so and the reason recorded
- **AND** it is not deleted, so the same idea arriving again meets the earlier decision

### Requirement: Pulling an item into a change is a state change, not a copy

An item that has become a change exists in two places, and the queue must not be one of them. When
an item is pulled, the queue entry SHALL record which change it became and SHALL stop being a
candidate. Its content SHALL NOT be duplicated into the change: the change's own brief supersedes it.

#### Scenario: S-QUEUE-PULL — the queue points at the change and steps back
- **WHEN** an item is pulled into a change
- **THEN** its entry records the change id and a state that excludes it from future candidates
- **AND** the queue does not carry a second copy of the requirement text

### Requirement: A batch is composed only from finished changes, and freezing it stops growth

A batch is delivered together, so what is in it must stop moving before integration starts.
Composing a batch SHALL take only changes that are finished, and freezing it SHALL allow the list to
shrink afterwards but never to grow.

The frozen list SHALL be recorded where the delivery stage can read it, so that the roster the stage
produces has something to be reconciled against.

#### Scenario: S-QUEUE-BATCH-FINISHED-ONLY — unfinished work cannot be batched
- **WHEN** a batch is composed and a candidate change is not finished
- **THEN** it is refused as a member
- **AND** the refusal names what is outstanding

#### Scenario: S-QUEUE-FREEZE-SHRINKS-ONLY — a frozen batch does not grow
- **WHEN** a batch is frozen and a change is proposed for it afterwards
- **THEN** it is refused
- **AND** removing a member remains possible, with the removal recorded

#### Scenario: S-QUEUE-RECONCILABLE — the roster has something to check itself against
- **WHEN** a batch is frozen
- **THEN** its membership is recorded in a location the delivery stage reads
- **AND** a roster that omits a frozen member is detectable by comparing the two

### Requirement: The queue is not a graph

An item is picked, worked, and the next round picks a different one, each with its own artifact
directory. A single long-lived graph cannot express that: its variables are fixed when it is
created. Queue operations SHALL therefore be performed directly on the file, and pulling an item
SHALL result in a new graph rather than a step inside an existing one.

#### Scenario: S-QUEUE-NO-GRAPH — pulling starts a graph rather than advancing one
- **WHEN** an item is pulled into a change
- **THEN** a graph is created for that change with its own variable value
- **AND** no pre-existing graph is patched to include it

