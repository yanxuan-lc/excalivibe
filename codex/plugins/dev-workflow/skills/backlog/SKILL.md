---
name: backlog
description: "Decide what happens to a piece of work that is not a change yet — record it, rule on it, order it against what else is waiting, or pull it into one — and decide which finished changes go out together. Reach for it on \"记到 backlog\"、\"backlog 里有什么\"、\"这个债该还了\"、\"下一步做什么\"、\"这批发哪几个\"、\"冻结这个批次\", and whenever someone raises an idea that is not what they are working on right now. It holds work before it becomes a change and composes the batches finished ones ship in; sharpening a requirement and running the work itself are separate."
---

# The queue — work before it is a change, and batches of finished ones

Two things live in `genai/BACKLOG.md`: ideas that are not yet work, and the batches that finished
work goes out in. Both are outside any graph, deliberately — see the last section for why that is
not an omission.

## An item says what and why. Never how.

```markdown
- **exp-csv** — let people take their data out as CSV.
  Support answers this three times a month by hand. `open`
```

An id, one line of want, one line of why it matters, a state. That is the whole entry.

**No design.** No schema, no endpoint, no implementation note. A design written now is written
against assumptions nobody has checked, by someone who was not thinking hard because the work was
not scheduled — and it will be read later as though it had been decided.

Four states, and each of the last three points somewhere:

| State | Means | Points at |
|---|---|---|
| `open` | nobody has ruled on it | — |
| `pulled <change-id>` | it became a change | that change |
| `declined <reason>` | ruled against | the reason, inline |
| `done <batch-id>` | shipped | the batch it went out in |

## A ruling against something stays in the file [MUST]

Deleting a declined item loses the reason, and the same idea comes back — often from the same
person, months later — with nothing to meet it. Keep the entry, keep the reason, and the second
conversation starts from the first one instead of from nothing.

The cost is a file that only grows. That is acceptable for something read by eye, and cheaper than
re-litigating.

One caution: the reason ships with the repository. If it would not be appropriate there, that is
your judgement to make before writing it, not the file's to make afterwards.

## Pulling an item is a state change, not a copy

When an item becomes a change, the entry records which change and stops being a candidate. **Do not
copy its text into the change.** The change's own brief is where the requirement gets sharpened, and
two texts saying nearly the same thing will disagree — at which point nobody knows which one was
agreed to.

The queue's job after a pull is to point, and get out of the way.

## Composing a batch

```markdown
## Batches

### 2026-w32 — frozen
- add-user-export
- fix-login-race
```

**Only finished changes.** A change still in flight cannot be a member: integration starts against
the list, and a member that is not done makes the batch wait for it while every check runs against
a tree it is not in. Refuse it and name what is outstanding.

**Freezing stops growth, not shrinkage.** After a freeze:

- a new member is refused — integration has already been planned against this list
- a member can be removed, and the removal is written down. A batch that cannot lose a member makes
  the whole batch wait for one broken change; an unrecorded removal is a silent scope change

**The frozen list is what the delivery stage checks its roster against.** That stage produces a
roster of what it is covering, and every gate after it measures only what the roster names — so a
change missing from the roster is untested, unaudited, and reported by nothing. The frozen batch is
the only thing that can catch that, by being compared against it. Nothing performs that comparison
automatically; whoever runs the delivery stage does.

## Why none of this is a graph

Each round picks a different change, and each change's artifacts live in its own directory. A graph
fixes its variables when it is created — the engine refuses to add a step needing a variable the
graph does not have — so one long-lived queue graph cannot follow a different change each round.

So: **pulling an item creates a graph. It never patches an existing one.** If you find yourself
adding a step to a running graph to make room for a new item, that is the shape telling you the item
belongs to its own run.
