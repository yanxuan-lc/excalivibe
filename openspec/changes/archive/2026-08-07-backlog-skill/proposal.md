## Why

The delivery stage reads a roster of the changes a batch covers, and nothing produces the batch. Its
own design says so: `genai.changes` establishes the roster from a frozen batch that "lives outside
the graph", and the risk it records is that nothing reconciles the two — a change omitted from the
roster is untested, unaudited and unflagged, because every gate measures only what the roster names.

There is also nowhere for an idea to sit. Work either becomes a change immediately or is forgotten,
which pushes people to start graphs for things that are not ready and to keep the rest in their head.

The previous toolkit had both, and deliberately not as a graph: its `align` intent started no flow
and ran queue commands instead. That call still holds — graph variables are frozen at creation, so a
long-lived graph cannot pick a different change each round.

## What Changes

- `dev-workflow` gains a **`backlog`** skill over `genai/BACKLOG.md`: capture an idea, review the
  queue, order it, pull an item into a change, and compose a batch from finished ones.
- Freezing a batch is part of it: the frozen list is what `genai.changes` reconciles its roster
  against, which closes the gap that stage recorded and could not close itself.

## Capabilities

### New Capabilities

- `work-queue`: holding work that is not yet a change, and composing the batches that finished
  changes are delivered in — both outside any graph.

### Modified Capabilities

None. The delivery stage already requires the roster to be reconciled against a frozen batch; this
supplies the thing to reconcile against without changing what that stage does.

## Impact

| Affected | What |
|---|---|
| `src/plugins/dev-workflow/skills/backlog/` | new |
| `genai/BACKLOG.md` in a project | new file, created on first capture |

No node, no gate, no graph. Nothing in the flow depends on the skill existing; a project without it
composes batches by hand, which is what happens today.
