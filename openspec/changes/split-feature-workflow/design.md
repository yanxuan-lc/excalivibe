## Context

See proposal.md — Why. Three facts from the engine constrain the shapes below.

**A workflow is a whitelist plus defaults, nothing more.** Node definitions live globally under
`.flow/nodes/<id>/` and a workflow only lists which of them it may use. Renaming a workflow
therefore touches no definition, and a second workflow is a second list over the same pool.

**A step's declared inputs must be whitelisted, even when the step is never instantiated.** Measured:
an input whose `from` names a step outside the workflow's list passes `graph create` and then fails
at `preview`/`dispatch` with an empty `available:` list. So adding `diagnosis` to the implementation
step obliges `genai.diagnose` to stay whitelisted — it already is.

**Freshness against code is expressed as `signature_match`, not as a timestamp.** The engine records
the signature a judging step saw and compares it to the current one. That is how "this result
describes earlier code" becomes a caught condition, and it is what the suite stage needs.

## Goals / Non-Goals

**Goals:**

- The workflow is named for the kind of work it carries, before any graph references the old name
- A person confirms the slice before design work is spent
- The product is executed once between implementation and review, with the result tied to the code
- A rescue diagnosis arrives through the contract instead of being found
- A second workflow is a file, not a code change

**Non-Goals:**

- No `command` gates. They need the project's own check commands, and nothing collects those until
  `genai-init`. Stubbing them here would ship a gate that runs a guessed command
- Not the delivery stage. `genai.e2e-run` and `genai.release-prep` stay where they are until the
  stage that receives them exists
- Not renaming step ids. They already carry a `genai.` prefix and every locator would churn

## Module Design

Two node directories added, one asset file moved, one script changed:

```
assets/
  workflow.yaml                    →  workflows/genai-feature.yaml
  nodes/
    genai.intent-slice/            +  node.yaml · brief.md
    genai.existing-suite/          +  node.yaml · brief.md
    genai.implement/node.yaml      ~  one optional input
scripts/install-flow.mjs           ~  iterate workflows/, drop --workflow
```

The dependency shape inside the requirement stage becomes:

```
genai.brief ──> genai.intent-slice ──> genai.spec ──> genai.spec-review
                    (human)                      └──> genai.review-doc ──> genai.arch-gate
```

and inside the implementation stage:

```
genai.spec ──> genai.implement ──> genai.existing-suite ──> genai.code-review
genai.diagnose ──(optional)──┘
```

Edges are graph-level, so the diagrams describe the intended shape rather than something a
definition encodes. What the definitions do encode is the input wiring, and that is what makes the
shape enforceable: `genai.existing-suite` declaring `code` from `genai.implement` is why a reviewer
cannot be handed a suite result belonging to different code.

### Why the installer iterates a directory

`--workflow <name>` existed to install the single list under a different name. With more than one
list that flag has no coherent meaning — it cannot rename two things at once, and the names now
have to match what graphs reference. Reading `assets/workflows/*.yaml` makes the file the source of
the name, which is the same rule the node directories already follow.

## External Protocol

This change exposes no external interface.

The two new definitions consume the engine's declaration contract, and the parts worth recording
are the gate shapes, because they are what the stage means:

| Step | Gate | Checker | Why this one |
|---|---|---|---|
| `genai.intent-slice` | `outputs` | `outputs_present` | the decision has to be an artifact, not a conversation |
| | `verdict` | `report` on `verdict` | a `judge` step's verdict is about the thing under review, and `conditional` is treated as reject — conditions unaddressed are conditions unmet |
| `genai.existing-suite` | `still_valid` | `signature_match` on `code` | evaluated first: a stale result must not be rescued by the outputs check passing |
| | `outputs` | `outputs_present` | absent result and failing result are different messages |
| | `outcome` | `report` on `outcome` | `completed` records the code signature; `blocked` delegates rather than burning patience |

Rule order is load-bearing. `signature_match` first means a result from earlier code is rejected as
stale even though the file is present and says `completed`.

## Database Design

This change does not touch a database.

## Non-functional Budgets

| Dimension | Budget | Where the number comes from |
|---|---|---|
| Compiled artifact count | 414 → 426 | two steps × two files × three ends, plus the workflow asset moving |
| Steps in `genai-feature` | 14 → 16 | the two added |
| Installer subprocess count per run | 3 per step + 2 per workflow + 1 | unchanged per step; the workflow loop adds one `workflows new` and one `workflows set` per file |

## Security & Permissions

No authentication, permission, or sensitive-data surface changes.

One property this change relies on and does not create: `genai.intent-slice` is `protocol: human`
with `unattended: suspend`, so an unattended run stops at it rather than proceeding. That is the
engine's behaviour, chosen per node, and it is the reason a slice confirmation cannot be
accidentally automated away.

## Observability

The installer's report gains two rows and a workflow heading; nothing else about it changes.

**What stays invisible:** whether a change *should* have had a slice confirmation. The requirement
says a core change gets one, and "core" is a judgement made when the graph is composed. Nothing
detects a core change whose graph omitted the step. That is inherent to the engine's design — the
graph is the plan, and it cannot be checked against an intent nobody wrote down.

## Rollback & Migration

**Forward:** edit source, `make build`, run the installer again. The rename means the engine gains a
`genai-feature` workflow; the old `genai` list stays behind in `.flow/workflows/genai.yaml` until it
is removed by hand.

That leftover is the one migration wrinkle, and the installer does not clean it up: deleting a
workflow a graph might reference is not a decision an installer should take silently. The skill
documents removing it.

**Rollback:** revert and reinstall. Nothing is released, so the only affected copy is a developer's.

## Verification Carrier

`agent-driven`.

The scenarios are about engine behaviour — what is dispatchable, what a gate reports, what a
dispatch names — and the way to check them is to build the graph and read what the engine says. Test
code of our own would have to reimplement those answers in order to assert against them.

Concretely: a scratch project, the installer run from the compiled artifacts, one graph exercising
the requirement stage and one the implementation stage, and the gates evaluated with artifacts
present, absent, and stale in turn.

## Decisions

**D1 — Rename the workflow, keep the step ids.** Alternative: rename both, so `genai.spec` becomes
`genai-feature.spec`. Rejected: step ids appear in every locator, every `inputs[].from`, and every
graph, and the prefix already distinguishes them from another toolkit's steps. The workflow name is
the thing that has to disambiguate, because that is what a graph names.

**D2 — `conditional` is a reject at the slice gate.** The engine's judge verdicts are
`approve | reject | conditional`. Treating `conditional` as a pass would let design work start
against conditions nobody has met yet, which is the exact expense the gate exists to protect. It
matches how `genai.arch-gate` already handles it.

**D3 — `genai.existing-suite` runs as `main`, not a subagent.** Alternative: a runner subagent, like
the a11y/security/perf checks. Those three each carry real method — which scanners, how findings map
to criteria, how to read noise. Running the project's own test command carries none: the command is
whatever the project's README names, and the judgement is "did it pass". A subagent here would be a
context switch that buys nothing, and one more executor name nothing validates.

**D4 — No `command` gate on the suite result.** Even once `genai-init` collects the project
commands, the suite stage stays report-based rather than gate-executed. Backup made the same call:
its `existing-suite` node checked a commit-stamped report, while `full-check` at the delivery stage
ran the commands under the gate. The split is deliberate — the inner loop trusts the runner and
verifies freshness, the sweep verifies by re-running.

## Risks / Trade-offs

**A core change can silently skip the slice gate** → nothing detects that its graph omitted the
step (see Observability). Accepted: the alternative is making the step mandatory in every graph,
which taxes the majority of changes that are not core.

**The old `genai` workflow lingers after a rename** → an installer that deleted it could orphan a
running graph. Accepted, documented, left to a person.

**`existing-suite` trusts the runner's own report** → a run that says `completed` without having
executed anything passes. Mitigated only by `signature_match` tying the claim to a specific code
state, so the lie has to be repeated after every edit. Fully closing it needs the delivery stage's
re-run under the gate, which is where it is closed.
