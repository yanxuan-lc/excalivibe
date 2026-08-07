---
description: "Decide what kind of work a request is and, when it is the kind that runs through a graph, which graph to build — checking first whether one is already in flight for it. Reach for it when someone wants a feature built, a change carried forward, a batch delivered, a question researched, or a fault diagnosed; on \"继续 xxx\"、\"这个需求做一下\"、\"这批发了吧\"、\"帮我查一下 X\"、\"这个报错看看\"; and whenever work is about to start and nobody has said how it will be run. It routes and shapes the graph; dispatching, submitting reports and evaluating gates afterwards belong to the engine's own skill."
description-claude: "Decide what kind of work a request is and, when it is the kind that runs through a graph, which graph to build — checking first whether one is already in flight for it. Reach for it when someone wants a feature built, a change carried forward, a batch delivered, a question researched, or a fault diagnosed; on \"继续 xxx\"、\"这个需求做一下\"、\"这批发了吧\"、\"帮我查一下 X\"、\"这个报错看看\"; and whenever work is about to start and nobody has said how it will be run. It routes and shapes the graph; dispatching, submitting reports and evaluating gates afterwards belong to the engine's own skill."
description-codex: "Decide what kind of work a request is and, when it is the kind that runs through a graph, which graph to build — checking first whether one is already in flight for it. Reach for it when someone wants a feature built, a change carried forward, a batch delivered, a question researched, or a fault diagnosed; on \"继续 xxx\"、\"这个需求做一下\"、\"这批发了吧\"、\"帮我查一下 X\"、\"这个报错看看\"; and whenever work is about to start and nobody has said how it will be run. It routes and shapes the graph; dispatching, submitting reports and evaluating gates afterwards belong to the engine's own skill."
name: genai-flow
---

# Where the work goes

Four kinds of work. Two of them run through a graph and two do not.

| Kind | Graph | Handled by |
|---|---|---|
| **feature** — build it, carry it forward, ship the batch | yes, `genai-feature` | see below |
| **research** — answer a question | yes, `genai-research` | see below |
| **queue** — record an idea, rule on one, compose a batch | no | the `backlog` skill |
| **diagnose** — something is broken | no | the `debugger` agent, bounded below |

Prerequisite: the project has been set up. If `.flow/` is absent, that is `genai-init`, not this.

## The order matters, and step 1 is not choosing a shape [MUST]

```bash
fsx graph list                    # 1. is there already one for this work?
fsx nodes -w <workflow>           # 2. what steps exist — the authority, not this page
```

**Ask what is in flight before deciding anything else.** "继续做用户导出" reads exactly like new
work, and creating a second graph for a change that already has one gives you two sets of gates
measuring the same artifacts and reaching different conclusions — neither aware of the other, both
consuming patience.

If a graph exists for this work: drive it. That is the engine's own skill, and it is not repeated
here.

## Which stage — read it off the disk, do not infer it

The request tells you the *kind* of work. It does not tell you the *stage*, and it should not be
asked to: the stage is a fact about what exists.

| On disk | Build |
|---|---|
| no `openspec/changes/<id>/design.md` | **requirement** — `assets/graphs/requirement.json` |
| a design, but no `genai/arch-gate.md` recording approval | the requirement graph is **still running** — step 1 finds it. Building a second one here is the exact duplicate this page exists to prevent |
| a design, and `openspec/changes/<id>/genai/arch-gate.md` recording approval | **implementation** — `assets/graphs/implementation.json` |
| finished changes and a frozen batch in `genai/BACKLOG.md` | **delivery** — `assets/graphs/delivery.json` |

Each row is a file test. Two people phrasing the same request differently must land on the same
stage, and that only holds if the phrasing is not what decides.

Research has one shape: `assets/graphs/research.json`.

```bash
fsx graph create --file <skeleton> --var change=<id>    # requirement, implementation
fsx graph create --file <skeleton> --var sprint=<id>    # delivery
fsx graph create --file <skeleton> --var topic=<id>     # research
```

Supply only the variable that shape's steps use. One that nothing references is refused, and that
refusal usually means the graph mixed stages that do not belong together.

## The skeletons are a starting point, not a submission

Edit them. Remove what does not apply — but **the reason for removing a step is a fact about the
diff, never how long the step takes.**

- a change that renders nothing to a user → no `genai.a11y`
- a change that cannot move a runtime cost → no `genai.perf`
- a change with no external surface and no new dependency → no `genai.security`

"It is slow" is not one of those reasons. A step dropped for effort is a check the run implies it
made and did not, and the passing verdict at the end then means less than it appears to.

`genai.diagnose` is not in any skeleton on purpose: it is inserted with `fsx graph patch` when a
step is stuck and the cause is not obvious.

## Diagnosing without a graph, and when to stop

Fault reports are the common case and a graph would tax every one of them. Dispatch the `debugger`
agent and **fix it in place only when all three hold**:

1. the change is confined to one place
2. there is a reproducible failing case
3. no contract moves — no interface, no schema, no cross-module boundary

**Any one of those failing means the fix is not a fix.** The diagnosis becomes the input to a
`feature` graph instead, and the repair happens under gates.

This is the only path here that changes product code without one. The three conditions are what
keep it from becoming the route people take to avoid the flow, and nothing enforces them but
whoever is reading them.

## What this skill does not do

- **Drive the loop.** Dispatching, submitting reports, evaluating gates — the engine's own skill,
  which stays in step with the engine in a way a copy here would not.
- **Set the project up.** `genai-init`.
- **Sharpen the requirement.** That is the first step *inside* the graph, not a precondition for
  building one.
