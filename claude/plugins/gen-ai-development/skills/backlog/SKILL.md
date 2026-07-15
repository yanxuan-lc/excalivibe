---
name: backlog
description: Use when the user wants to RECORD an idea instead of building it now — "先记下来", "记到 backlog", "我有个想法，先别开工", "这个回头再做", several ideas arriving in a stream while other work is still running, or asking what ideas are already queued ("backlog 里有什么", "待办的想法"). Sharpens the idea through grill and files it into the durable idea queue (openspec/BACKLOG.md + per-entry BRIEF.md) with targeted consolidation against existing entries. NOT for executing queued work ("把 backlog 里的 X 做了" — that is autonomy-controller's backlog intake) and NOT for a build request the user wants started immediately.
---

# Backlog — capture ideas now, build them later

The development pipeline runs for hours per change; ideas arrive in minutes, in whatever
order the user thinks of them. Without a queue, proposing one idea locks the conversation
into that idea's full design-and-build cycle, and every other idea waits. The backlog is
the decoupling point: **enqueue costs the user a short grill conversation; execution
happens whenever the user later says go.** The user's blocked-time drops to the grill
sessions themselves — they can keep ideating while pipelines run.

This skill owns the **enqueue side only**: the queue's structure, the recording flow, and
the consolidation that keeps the queue internally consistent. The **dequeue side** —
freshness-checking a brief against the moved codebase, batching, dependency ordering,
parallel/sequence decisions — belongs to `autonomy-controller` (its "Backlog intake"
path). Do not duplicate that logic here; hand over and let the controller consume.

## Queue structure

A **live** half and an **archived** half, all under `openspec/`:

- **`openspec/BACKLOG.md`** — the live index. One table row per *active* entry
  (`queued` / `in-progress`): id, title, status, footprint tags, relations. Kept to one
  line per entry *on purpose*, and kept to the active working set *on purpose*: the index
  is read at the start of every enqueue session, and that read must stay near-free no
  matter how many ideas the project ships over its life.
- **`openspec/backlog/<id>/BRIEF.md`** — one directory per active entry holding the
  grill-format brief (current behavior / desired behavior / acceptance criteria /
  out-of-scope). The index points at it; nothing else lives in the entry dir at enqueue
  time.
- **`openspec/backlog/archive/`** — history out of the hot path. When an entry reaches a
  terminal status (`done` / `dropped`), its row moves to the append-only archived index
  `archive/BACKLOG-ARCHIVE.md` and its directory moves to `archive/<date>-<id>/`. This is
  never a sweep — it is part of the same write that sets the terminal status (see schema).
  History is preserved, just off the session-start read path.

Exact formats, status values, relation kinds, archive layout, and lifecycle ownership:
[references/backlog-schema.md](references/backlog-schema.md). Read it before your first
write to the queue.

## The enqueue flow — two hooks around a grill session

Consolidation is not a separate phase and never a background job. It hangs on two hooks
built into the recording session itself: a coarse check at the start, a precise one at
the end.

### 1. Session start — read the live index, always (coarse, free)

Before the first question, read `BACKLOG.md` — the live index only. It is one line per
active entry; reading it costs nothing, so there is no "should I check" judgment call —
just read it every time. Do **not** read the archive here: that is what keeps this read
free as the project ships more and more ideas.

The purpose is to **aim the conversation**, not to consolidate. If the raw idea plainly
relates to an existing entry, the *first* question becomes: "this sounds related to
queued entry `<id>` (<title>) — amend that entry, or record a new one?" Catching this at
the start matters because the alternative is discovering the overlap after a full grill
run: the questions were asked without the old brief's context, possibly contradicting
answers the user already gave, and the whole exchange has to be reconciled after the
fact. If the user says amend, run grill incrementally against the existing BRIEF instead
of from scratch.

### 2. Grill the idea

Run the `grill` skill as-is — one question at a time, each with a recommended answer,
light or deep by how novel and central the idea is. Point its output at the entry
directory (`openspec/backlog/<id>/BRIEF.md`). If a load-bearing unknown needs real
investigation (a library capability, an existing data shape), that is the normal
grill/research boundary — resolve it now, at enqueue time, so the queued brief is a
brief the pipeline can trust later.

While grilling, note the entry's likely **footprint** — the modules/directories, tables,
external contracts, and UI areas the change would plausibly touch. Grill's own
resolve-by-exploration reads usually surface this for free; only run a dedicated
read-only scan (e.g. dispatch an `Explore` agent) if nothing was read. Footprint tags are
deliberately coarse — they exist for adjacency matching, not for design.

### 3. Session end — targeted consolidation (precise, silent-first)

After the BRIEF converges and *before* writing it into the queue, compare it against the
**candidates**: live-index entries flagged at session start or whose footprint tags
overlap the new entry's, **plus a targeted grep of the archived index
(`archive/BACKLOG-ARCHIVE.md`) by the same footprint tags**. The archive grep is what
catches "this idea already shipped as X" or "we already dropped this, for reason Y" —
history the free session-start read deliberately skipped. Grep by tag, not a full read, so
its cost tracks matches, not archive size. Now the comparison has a full brief with
acceptance criteria to work with — far sharper than the raw utterance the start-hook saw.
Findings, in order of value:

| Finding | Action |
|---------|--------|
| The new entry **supersedes or invalidates** an old one — extends it wholesale, or breaks one of its premises | Propose rewriting or deleting the old entry. This is the highest-value case: left alone, the queue carries a brief that is already doomed, and nobody notices until dequeue. |
| **Heavy overlap** — same modules, same domain concept; plausibly one change | Propose merging into one entry — but be restrained. A merge is a commitment made on incomplete information, and an over-merged entry grows large and vague. When unsure, keep them separate and tag `same-batch?` instead; the real merge decision belongs to dequeue, where the controller sees the whole picture. |
| **Dependency or plain relatedness** | Add `depends-on:` / `related:` tags to the index rows. Tags are hints, re-validated at dequeue — adding them silently is fine. |
| **Archive match** — the new idea is what an archived `done`/`dropped` entry already covered | Surface it, don't act on it: "we already shipped/dropped `<id>` for this — record anyway, or is this the same thing?" Never rewrite or resurrect an archived entry; if the user still wants it, record a fresh `queued` entry (add `related:<archived-id>` so the history is one hop away). |

### 4. Confirm — at most one message, often zero

- **Nothing found** → write the entry, refresh the index, say it's recorded. Zero
  questions. This is the common case and it must stay frictionless — a slow enqueue
  kills the habit of recording ideas at all.
- **Something found** → batch *all* findings into **one** confirmation message
  ("记录前有两处要确认：① … ② …"), get one answer, then write everything.

The line between silent and confirmed: **relation tags may be added silently; content
changes to existing entries (rewrite, delete, merge) always get confirmation.** Old
briefs were confirmed by the user at their time — silently rewriting them substitutes
your judgment for a confirmation the user already gave.

### 5. Write

New entry dir + BRIEF, edits to affected entries (post-confirmation), live index
refreshed — new row, updated tags/relations on touched rows. A new entry's status is
always `queued`. The only other status this skill sets is `dropped`, on an entry it
supersedes or merges away (post-confirmation) — and `dropped` is terminal, so the same
write relocates that entry (row + dir) into the archive (paths in schema). Everything else
in the lifecycle belongs to the controller.

## Hard rules

- **Targeted, never global.** Consolidation touches only entries related to the *new*
  one. Never reorganize the whole queue as a side effect of recording — full-queue
  grooming costs grow with queue length, disturb entries the user wasn't thinking about,
  and turn "jot this down" into a maintenance session. There is no
  standalone "groom the backlog" mode; if the user explicitly asks for one, treat each
  proposed change with the same confirm-before-edit rule.
- **Event-triggered only.** The queue changes only when an enqueue session (or the
  controller's dequeue) touches it — never on a schedule, never in the background. The
  user must be able to trust that the queue is exactly as they left it.
- **Capture speed is the point.** The user chose to *record* instead of *build* to get
  back to ideating quickly. Anything that stretches the session — extra questions, eager
  merging, unprompted queue hygiene — works against the skill's reason to exist.

## What enqueue-time consolidation does not buy

Consolidation keeps the queue **internally** consistent — entries don't contradict,
duplicate, or silently invalidate each other. It cannot keep entries consistent **with
the codebase**: code moves on its own timeline, so a brief that was fresh at enqueue
decays regardless of how clean the queue is. That is why the dequeue side
(autonomy-controller's backlog intake) re-checks each brief's "current behavior" against
the code *at the moment work starts*, and why no amount of write-time diligence removes
that check.
