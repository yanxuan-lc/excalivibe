## Purpose

Refuses the handful of shell commands that cannot be undone when a subagent is the one asking, and
puts the rest of the dangerous ones in front of a person — so that the boundary survives a run that
did not follow the flow.

## ADDED Requirements

### Requirement: Only a subagent's irreversible outward act is refused outright

Refusal must be provably safe, or it becomes something people work around. An act is refused only
when both hold: it reaches outside this working copy irreversibly, **and** a subagent is asking.
Both together make refusal free — the main agent can always perform the act instead, with consent.

Every other dangerous act SHALL be put to a person rather than refused, and everything else SHALL
pass without comment.

#### Scenario: S-GUARD-DENY-SUBAGENT — a subagent cannot publish
- **WHEN** a subagent runs a package-publish command
- **THEN** the act is refused
- **AND** the reason says the main agent performs it with explicit consent

#### Scenario: S-GUARD-ASK-MAIN — the same act from the main agent is a question, not a refusal
- **WHEN** the main agent runs the same publish command
- **THEN** the act is put to the person rather than refused

#### Scenario: S-GUARD-PASS-ORDINARY — reversible work is not interrupted
- **WHEN** a commit is made on a feature branch, or a push goes to a non-protected branch
- **THEN** nothing is asked and nothing is refused

### Requirement: Reading history is never interrupted

Inspecting the repository changes nothing. Commands that only read — history, diffs, status, blame —
SHALL pass untouched, including when their arguments contain the words the guard matches on.

#### Scenario: S-GUARD-READ-QUOTED — a search string is not an act
- **WHEN** a history search runs whose pattern contains the words of a publish or force-push command
- **THEN** nothing is asked and nothing is refused

### Requirement: The guard never breaks the session

A backstop that can halt work is worse than none: it gets removed. Any internal failure — bad input,
a missing tool, an unexpected shape — SHALL result in the command proceeding to the normal
permission flow, with no output.

#### Scenario: S-GUARD-FAILS-OPEN — malformed input defers instead of erroring
- **WHEN** the guard receives input it cannot parse
- **THEN** it produces no decision and exits successfully
- **AND** the command is left to the host's ordinary permission handling

### Requirement: The guard ships only where the host supports it

The ends this project compiles to do not all have a hook mechanism, and one of them rejects the
manifest field outright. The guard SHALL be present only on the end that supports it, and its
absence from the others SHALL follow from the compile rule for hook files rather than from anything
anyone has to remember.

#### Scenario: S-GUARD-ONE-END — the other ends compile without it
- **WHEN** the artifacts are compiled
- **THEN** the hook files appear only under the end whose host supports hooks
- **AND** the compile reports no orphaned artifact for the ends that lack them
