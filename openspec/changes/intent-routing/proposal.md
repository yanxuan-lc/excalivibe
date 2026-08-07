## Why

Everything needed to run work through a graph now exists — two workflows, twenty-eight steps, a
queue, a setup command — and nothing decides which of them a request calls for. The engine's own
skill is explicit that it will not: *"This tells you how to drive, not where to go."* So the last
piece is the one that says where.

Left undecided, two failures follow and both are cheap to cause. Work that needs no graph gets one,
which taxes a two-line fix with a five-step process. And work that already has a graph gets a second
one — "继续做用户导出" reads as new work, a fresh graph is created, and two graphs then measure the
same change with gates that disagree.

## What Changes

- `dev-workflow` gains **`genai-flow`**: recognise which of four kinds of work a request is, and for
  the kinds that need a graph, decide which shape to build.
- Four skeleton graphs ship as assets — requirement, implementation, delivery, research — so the
  common shapes are a starting point rather than something re-derived each time.

## Capabilities

### New Capabilities

- `intent-routing`: deciding what kind of work a request is, and — where that work is graph-shaped —
  which graph, without re-deriving either from scratch.

### Modified Capabilities

None.

## Impact

| Affected | What |
|---|---|
| `src/plugins/dev-workflow/skills/genai-flow/` | new, with four skeleton graphs |

Nothing depends on it. Without it the graphs still work; someone decides by hand which to build,
which is what happens today.
