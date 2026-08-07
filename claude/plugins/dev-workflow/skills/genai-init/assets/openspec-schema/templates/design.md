## Context

<!-- Current state and constraints that shape the approach. See proposal.md for motivation - don't restate it -->

## Goals / Non-Goals

**Goals:**
<!-- What this design aims to achieve -->

**Non-Goals:**
<!-- What is explicitly out of scope -->

## Module Design

<!-- CONTRACT 1. Directory increments, the module dependency graph, responsibility boundaries.
     Prefer a diagram over prose for the graph. Use the vocabulary the project already uses.
     Not applicable? Write "This change adds no module and moves no boundary." -->

## External Protocol

<!-- CONTRACT 2. REST / RPC / event contracts: endpoint attributes, request and response
     examples, the error-code table. A new endpoint buried in prose is a planning defect.
     Not applicable? Write "This change exposes no external interface." -->

## Database Design

<!-- CONTRACT 3. Entity relationships, full DDL, index budget, extensibility decisions.
     Not applicable? Write "This change does not touch the database." -->

## Non-functional Budgets

<!-- Concrete numbers for latency / query count / bundle size — whatever this change can move.
     A number is the only thing a later measurement can be compared against. -->

## Security & Permissions

<!-- Authentication points, permission model, sensitive-data handling. A scanner finds a
     hard-coded secret; it cannot find an endpoint that was never designed to authenticate. -->

## Observability

<!-- Health checks, metrics, key logs and alerts. What is not declared here does not get built,
     and no check downstream can notice the absence. -->

## Rollback & Migration

<!-- Forward steps, rollback strategy, data backfill. A schema change needs both directions. -->

## Verification Carrier

<!-- How this change's acceptance scenarios get executed. Exactly one of:
       scripted        test code is written for them, then runs at no model cost
       agent-driven    no test-code investment; the scenarios are walked live each time
       existing-suite  an existing suite already covers them
     This decides whether test authoring can be dispatched in parallel with implementation,
     so it has to be settled before implementation starts, not after. -->

## Decisions

<!-- Key design decisions with rationale and alternatives considered. Trade-offs only —
     full DDL and dependency graphs belong in their own sections above. -->

## Risks / Trade-offs

<!-- Known risks and trade-offs -->

## Open Questions

<!-- Genuinely deferrable unknowns. If it would change the specs, the approach, or the task
     breakdown, resolve it now instead. Omit this section if there are none. -->
