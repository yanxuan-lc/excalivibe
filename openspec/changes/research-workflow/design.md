## Context

See proposal.md — Why. Two facts shape it.

**A workflow is a whitelist plus defaults, and the installer reads a directory of them.** Adding one
is a file. Node definitions are global, so `genai-research` is a second list over the same pool.

**Two instances of a step share one artifact locator.** Measured: `#1` and `#2` of the same step
resolve to the same path and overwrite each other, and the instance declaration is a `strictObject`
accepting only `id`, `node` and `join` — there is nowhere to vary anything per instance. So the
obvious shape for research, N parallel probes each with its own artifact, is not expressible.

## Goals / Non-Goals

**Goals:**

- A question is made answerable before anything is investigated
- The sub-questions are reviewable before the answers arrive
- Collection and conclusion are different steps, and findings carry provenance
- The run ends at a person

**Non-Goals:**

- Not N gateable parallel probes. Not expressible; see Decisions
- Not a literature process. The `researcher` agent owns method — what to probe, how to establish
  provenance — and this does not restate it
- Not producing a change. Research may motivate one; turning it into one is the queue's job

## Module Design

```
assets/workflows/genai-research.yaml      the second workflow
assets/nodes/
  genai.research-brief/    produce · main      · clarify with the person
  genai.research-plan/     produce · researcher · the sub-questions
  genai.research-probe/    produce · researcher · the findings
  genai.research-synth/    produce · researcher · REPORT.mdx + PROPOSAL.md
  genai.research-review/   judge   · human      · the ruling
```

```
brief ──> plan ──> probe ──> synth ──> review
  ▲                                      │
  └──────────────── on reject ───────────┘
```

Two shapes are load-bearing:

- **`probe` and `synth` are separate steps** even though the same agent runs both. Whoever collected
  the evidence has already formed a view of it, and a single step would let that view select what
  gets collected. Separating them makes the findings an artifact the synthesis is measured against.
- **The reject edge goes to `brief`, not to `synth`.** A synthesis that does not answer the question
  is usually evidence the question was wrong, not that the writing was. Routing to `synth` would
  produce a better-written answer to the same wrong question.

`genai.research-brief` runs as `main` for the same structural reason `genai.brief` does: it is a
conversation with a person and a subagent cannot have one.

## External Protocol

No external interface. The gate shapes, which are what the steps mean:

| Step | Gate | Why |
|---|---|---|
| `research-brief` | `outputs_present` | the bounded question has to be an artifact, not a memory |
| `research-plan` | `outputs_present` | the sub-questions are reviewable only if they exist before the answers |
| `research-probe` | `outputs_present` · `report outcome` | `partial` is a real outcome here — some sub-questions can be unanswerable, and saying so beats a confident silence |
| `research-synth` | `outputs_present` · `signature_match` on findings | a synthesis written before the last findings arrived describes a different body of evidence |
| `research-review` | `outputs_present` · `report verdict` | `conditional` is a reject: conditions unaddressed are conditions unmet |

Artifacts land under `docs/research/{{vars.topic}}/`: `QUESTION.md`, `PLAN.md`, `FINDINGS.md`,
`REPORT.mdx`, `PROPOSAL.md`, `DECISION.md`.

## Database Design

This change does not touch a database.

## Non-functional Budgets

| Dimension | Budget | Where the number comes from |
|---|---|---|
| Compiled artifact count | 491 → 524 | five steps × two files × three ends, plus the workflow asset |
| Workflows installed | 1 → 2 | the installer reads the directory; no code change |
| Probes per run | not bounded by the flow | the probe step fans out internally; the number is the plan's judgement, not a configured limit |

The last row is where the missing capability shows. A bound would be meaningful if each probe were a
step; inside one step it is the agent's own decision and nothing here can enforce a number.

## Security & Permissions

No authentication or permission surface changes. Research reads; it does not modify the product.

One property worth naming: probing may reach the network, and the `researcher` agent's dispatch is
the only thing that scopes it. This flow does not add a constraint the agent does not already carry,
and does not weaken one.

## Observability

Each step's artifact is the record, and the chain from question to ruling is readable by following
them in order.

**What stays invisible: the individual probes.** Because they run inside one step, the engine sees
one dispatch, one report, one verdict. A sub-question that was skipped, or answered badly, is
visible only by reading `FINDINGS.md` against `PLAN.md`. Nothing compares them. That is the direct
cost of the limitation in Decisions, and it is the thing to fix first when the engine allows it.

## Rollback & Migration

**Forward:** add five definitions and one workflow file, rebuild, re-run setup. The installer picks
up the new workflow because it reads the directory.

**Rollback:** remove them and re-run setup. The workflow stays behind in `.flow/workflows/` — the
installer does not delete workflows, deliberately, since a graph may reference one. Delete it by
hand after checking `fsx graph list`.

Artifacts under `docs/research/` are the project's and stay.

## Verification Carrier

`agent-driven`.

The scenarios are about graph shape and gate behaviour — what is dispatchable, where a reject routes,
which variable is demanded. Checking them means building the graph and reading the engine's answers.

Concretely: a research graph created with only the topic, planning left undispatchable before the
question exists, and a rejected review checked for where it routes.

## Decisions

**D1 — One probe step with internal fan-out, not N steps.** Three options existed:

| Option | Why not |
|---|---|
| N instances of one step | they share a locator and overwrite each other — measured, not assumed |
| N fixed step definitions (`probe-1`…`probe-4`) | the arity is written into the toolkit, and four definitions differing by one character is the duplication this repo keeps removing |
| internal fan-out | chosen — loses per-probe gating, keeps the arity with the plan where it belongs |

The right fix is instance-level values in the engine, which is already on the list to ask for. Until
then this is the least-bad of three, and the cost is written down in Observability rather than left
to be discovered.

**D2 — `partial` is a legitimate probe outcome.** A sub-question that cannot be answered from
available sources is a result. Treating it as failure pushes toward answering it badly, which is the
one thing the `researcher` agent is built not to do.

**D3 — Synthesis holds `signature_match` against the findings.** Findings can arrive after a
synthesis is drafted — a re-probe, a correction. Without the check the report silently describes an
older body of evidence, which is the same freshness failure the other stages guard against.

**D4 — The reject edge returns to `brief`.** See Module Design. A synthesis that misses the question
is evidence about the question.

## Risks / Trade-offs

**A skipped sub-question is invisible to the engine** → the probe step reports on itself, and
`PLAN.md` versus `FINDINGS.md` is a comparison only a reader makes. This is the cost of D1 and it is
the first thing to revisit when instance-level values exist.

**`main` clarifying means the flow stalls without a person** → correct, and the same as every other
conversation step. It stops rather than proceeding on a guess.

**Research can produce a proposal nobody turns into work** → the flow ends at a ruling, not at a
change. Deliberate: pulling it into work is the queue's decision, and coupling them would make every
piece of research owe a change.
