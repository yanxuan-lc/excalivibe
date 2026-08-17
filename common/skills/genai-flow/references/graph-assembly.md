# Assembly rules

Read this before changing an edge or dropping a step from the graph in `SKILL.md`. Everything here
answers one question — **which edits produce a graph that passes creation and deadlocks at run
time** — so it is worth nothing while you are driving a round that already exists, and worth the
whole round when you are editing one.

The two things `fsx graph create` says about the standard graph, and what to do when a step will not
re-enter, are in the skill body: those come up every round, whether or not anyone touches an edge.

## Routing

- **A `delegate` edge is not optional wherever a step can return that verdict**, and three steps can,
  over four rules between them: `genai.e2e` from its gate, `genai.implement` and `genai.merge` from
  their entry rules, `genai.merge` on two rules that go to two different places. An edge that is not
  there makes the delegation deliver nothing, and a delegation that delivers nothing is charged the
  whole remaining patience — the engine treats "the work moved to somebody" as a claim, and charges
  for it when it turns out false. Drop `genai.e2e → genai.e2e-author` and the round's first test bug
  ends the round; drop the two out of `genai.merge` and the round reaches the merge and cannot enter
  it. Leaving a pair out of the graph entirely is a different thing and is fine — no step remains
  that can return the verdict. `fsx graph create` reports the mistake as
  `graph_transfer_unroutable`, as a notice rather than a refusal, so it is on you to read it.
- **Two rules on one node delegating to different places need `rule_id` on their edges.** Edges match
  on the verdict, so an unnarrowed pair both catch either rule and the work goes to both
  destinations. `genai.merge` is the case in the standard graph: `review-still-valid` goes to the
  review and `e2e-still-valid` to the acceptance run. `fsx graph create` reports the unnarrowed form
  as `graph_transfer_ambiguous`. `genai.implement`'s two rules share one destination, so its edge
  needs no narrowing.
- **One destination per verdict per rule, so a node has few.** Edges route on the verdict and the
  optional `rule_id`, and on nothing else — not on a report field, not on a gate label. That is why
  a failure has to be classified into the buckets the graph can act on before it can be routed
  anywhere, and why a new destination needs a new verdict or a new rule rather than a cleverer
  message.
- **Never draw a `pass` edge backwards.** Pass edges are dependencies; one pointing back turns the
  downstream node into a root and inverts the graph.
- **A step premised on an upstream conclusion needs the edge that orders it after the producer.**
  `genai.merge` compares the review and the acceptance run against what `genai.implement` produced;
  `genai.implement` compares the decision against what `genai.spec` produced. Reachable ahead of its
  producer, the premise has nothing to measure and the refusal comes back as
  `label: __contract_violation__` with no `reason` — a shape complaint wearing the clothes of a
  verdict. Dropping a step therefore means checking what was premised on it, not only what was
  routed to it.
- **`reject` self-rework needs no edge.** A redundant self-edge is harmless; a missing cross-node
  reject edge is not.

## Two steps that must not be routed back

- **`genai.accept` is deliberately given no reject edge, and its rejection stops the round.** A judge
  cannot rework its own subject — it judged; re-reading the same artifacts would only repeat — so
  there is nowhere for the work to go, and the graph says so by leaving the edge out. The finding is
  not lost either way: the report is submitted and stored before the gate runs, and it is what says
  which requirement went missing in the fold. What to do is a person's call and it is not "add the
  edge and rerun": the batch is merged and archived by then, so the finding is next round's work,
  entered as a backlog item. Read what the engine reports at that moment rather than a remembered
  mechanism — the handling of a verdict with no matching edge is the engine's, and it has changed
  before. Only if a rework of *this* round is genuinely wanted does an edge get added, and then the
  whole batch reopens, which is the cost the missing edge exists to make you weigh.
- **Never route `genai.archive` back with `reject` either**, and here the reason is mechanical: its
  two entry rules are `upstream_reran`, so re-activating it through a dependency edge asks again for
  an unfolded change and a clean tree — both false by then, so it refuses, spends a patience point,
  and does it again on the next attempt until the round suspends on a condition its own success made
  permanently false.

## What a check can see

**Gate commands get no variables.** Not graph variables, not instance suffixes, no injected
environment. Anything a check needs, it derives from `$PWD` or from git. A rule that would need to
know the round's branch name, or which attempt this is, cannot be written as a gate command — which
is why the checks that exist are the ones a repository can answer about itself.
