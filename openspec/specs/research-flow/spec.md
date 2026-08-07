# research-flow Specification

## Purpose
Takes a question nobody has made answerable yet through to a synthesis someone has ruled on — with
the sub-questions written down before the work starts, and the person who investigated separated
from the conclusion drawn.
## Requirements
### Requirement: The question is made answerable before anything is investigated

A research question as first asked is usually a topic, not a question. Investigating a topic returns
a survey nobody can act on. The flow SHALL settle, with the person asking, what would count as an
answer and what is out of scope, before any investigation starts.

#### Scenario: S-RSCH-BOUNDED — investigation waits for a bounded question
- **WHEN** the graph places the clarification before the planning step
- **AND** the clarification has not produced its artifact
- **THEN** the planning step is not dispatchable

#### Scenario: S-RSCH-ANSWER-SHAPE — what would count as an answer is written down
- **WHEN** the clarification completes
- **THEN** its artifact states what would count as an answer and what is out of scope
- **AND** it does not contain findings

### Requirement: The sub-questions are visible before they are investigated

A synthesis is only as good as the questions that produced it, and questions chosen silently during
investigation cannot be reviewed. The flow SHALL produce the list of sub-questions as its own
artifact, before probing.

#### Scenario: S-RSCH-PLAN-FIRST — the sub-questions exist as an artifact
- **WHEN** planning completes
- **THEN** the list of sub-questions is on disk
- **AND** each carries what would answer it

### Requirement: Findings are separated from the conclusion drawn from them

Whoever collected the evidence has already formed a view of it. The flow SHALL keep collection and
synthesis in separate steps, and the synthesis SHALL be traceable to the findings it rests on.

A finding SHALL carry where it came from, so a reader can check it rather than trust it.

#### Scenario: S-RSCH-PROVENANCE — every finding says where it came from
- **WHEN** probing completes
- **THEN** each finding records its source
- **AND** an inference is marked as one rather than presented as a finding

#### Scenario: S-RSCH-SYNTH-SEPARATE — synthesis is its own step
- **WHEN** the graph is inspected
- **THEN** the step that collects findings and the step that draws conclusions are different steps
- **AND** the synthesis declares the findings as an input

### Requirement: A synthesis is ruled on by a person before it is acted on

Research exists to change a decision, and a synthesis nobody ruled on changes nothing. The flow
SHALL end at a human decision, and that decision SHALL be recorded.

#### Scenario: S-RSCH-SIGNOFF — the flow ends at a person
- **WHEN** the synthesis completes
- **THEN** the next step is a human decision
- **AND** it cannot be satisfied without one being recorded

#### Scenario: S-RSCH-REJECT-RETURNS — a rejected synthesis goes back to the question
- **WHEN** the person judges the synthesis does not answer what was asked
- **THEN** the verdict routes back into the flow rather than ending it

### Requirement: A research run does not need a change

Research is not a change to the product and has no change directory. Its artifacts SHALL be located
by their own graph variable, and a research graph SHALL require no other.

#### Scenario: S-RSCH-OWN-VARIABLE — only the topic is supplied
- **WHEN** a research graph is created supplying only the topic
- **THEN** the graph is created
- **AND** no per-change variable is demanded

