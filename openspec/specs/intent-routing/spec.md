# intent-routing Specification

## Purpose
Decides what kind of work a request is, and for the kinds that run through a graph, which graph to
build — so that a two-line fix does not pay for a five-step process, and a piece of work in flight
does not acquire a second graph measuring it.
## Requirements
### Requirement: Work already in flight is continued, never restarted

Before any graph is designed, the flow SHALL establish whether one already exists for this work. A
second graph over the same work produces two sets of gates measuring the same artifacts, reaching
different conclusions, with neither aware of the other.

#### Scenario: S-ROUTE-RESUME — a request to carry on finds the existing graph
- **WHEN** someone asks to continue work that already has a graph
- **THEN** the existing graph is identified and driven onward
- **AND** no new graph is created for it

#### Scenario: S-ROUTE-CHECK-FIRST — the check happens before the shape is chosen
- **WHEN** a request is judged to need a graph
- **THEN** the running graphs are consulted before any shape is decided

### Requirement: Which stage to build is read from the repository, not inferred from the request

What a piece of work needs next is a fact about its artifacts, not something to be guessed from how
the request was phrased. The stage SHALL be determined by what exists on disk.

#### Scenario: S-ROUTE-STAGE-FROM-DISK — the stage follows the artifacts
- **WHEN** a change has no design document
- **THEN** the requirement stage is built
- **AND** the same request with an approved design builds the implementation stage instead

#### Scenario: S-ROUTE-NO-STAGE-GUESS — phrasing does not decide the stage
- **WHEN** two differently-phrased requests concern the same change in the same state
- **THEN** the same stage is chosen for both

### Requirement: Work that does not need a graph does not get one

A graph costs steps, gates and artifacts. Two kinds of work SHALL NOT start one: settling ideas into
the queue, and diagnosing a fault. Both are conversations or short investigations whose output is a
decision or a small fix.

Diagnosis SHALL fix in place only when the change is confined to one place, has a reproducible
failing case, and touches no contract. Failing any of those, the diagnosis SHALL become the input to
a graph instead of the fix being made under it.

#### Scenario: S-ROUTE-NO-GRAPH — queue work and diagnosis start nothing
- **WHEN** a request is to record, review or rule on queued work, or to diagnose a fault
- **THEN** no graph is created

#### Scenario: S-ROUTE-ESCALATE — a fix that touches a contract stops being a fix
- **WHEN** a diagnosis concludes the repair changes an interface, a schema, or spans modules
- **THEN** the repair is not made under the diagnosis
- **AND** the diagnosis becomes the input to a graph

#### Scenario: S-ROUTE-FIX-IN-PLACE — a confined fix with a failing case is finished on the spot
- **WHEN** the repair is one place, reproducible, and touches no contract
- **THEN** it is completed without a graph

### Requirement: A skeleton is a starting point, not a template to submit unread

The common shapes ship so that they are not re-derived each time. They are edited for the work in
hand: steps that do not apply are removed, and the reasoning for removing one SHALL be a fact about
the change rather than a preference about effort.

#### Scenario: S-ROUTE-SKELETON-EDITED — a step that cannot apply is removed with a reason
- **WHEN** a change touches nothing that renders to a user
- **THEN** the accessibility step is not in the graph
- **AND** the reason recorded is that fact about the diff, not that the step is slow

#### Scenario: S-ROUTE-SKELETON-VALID — the shipped shapes are accepted as they are
- **WHEN** a skeleton is submitted unedited with its variable supplied
- **THEN** the graph is created

