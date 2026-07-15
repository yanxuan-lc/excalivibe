# Backlog schema — index format, entry layout, lifecycle, archive

The queue is split into a **live** half and an **archived** half. The split exists for one
reason: the live index is read at the start of every enqueue session, so it must stay
bounded by the *active working set* (`queued` + `in-progress`) no matter how many ideas
ship over the project's life. Terminal entries carry history value but no longer belong on
that hot path, so they are relocated — not deleted — to the archive.

## The live index — `openspec/BACKLOG.md`

One table row per **active** entry (`queued` or `in-progress` only). The row is the *whole*
index record — anything longer belongs in the entry's own directory. Keep titles in the
user's language; keep field syntax in the forms below so rows stay machine-matchable.

```markdown
# Backlog — idea queue

| id | title | status | footprint | relations |
|----|-------|--------|-----------|-----------|
| report-export | 报表导出为 JSON | queued | reporting, orders-table | depends-on:report-page |
| report-page | 报表页改版 | in-progress(update-report-page) | reporting, report-ui | — |
| smart-notify | 通知降噪 | queued | notification | related:digest-mail, same-batch?:digest-mail |
```

### Fields

- **id** — kebab-case slug, unique across live *and* archive, doubles as the entry
  directory name (`openspec/backlog/<id>/`). Stable once created; a rename is a delete +
  re-add.
- **title** — one short line in the user's terms.
- **status** — see lifecycle below.
- **footprint** — comma-separated coarse tags: modules/directories, table names,
  external contracts, UI areas the change would plausibly touch. Derived during grill's
  exploration; used for adjacency matching at consolidation and overlap checks at
  dequeue. Coarse by design — a footprint is a hint, not a design commitment.
- **relations** — comma-separated, `—` when empty:
  - `depends-on:<id>` — this entry needs `<id>` built first (semantic dependency, not
    file overlap).
  - `related:<id>` — same area, no ordering implied.
  - `same-batch?:<id>` — suspected candidates for merging into one change; the `?` is
    the point — the merge decision is deferred to dequeue, where the controller sees the
    whole queue and proposes it with full context.

Relations are directional where they read that way (`depends-on`), symmetric otherwise;
record symmetric relations on **both** rows so either entry's dequeue sees them. A
relation target may have moved to the archive (a `depends-on` prerequisite that already
shipped); the edge is not stale, it is *satisfied* — resolve relation targets against
**both** indexes at dequeue (see below).

## The archive — history out of the hot path

When an entry reaches a terminal status (`done` / `dropped`), the *same write* that sets
that status relocates it — never a separate sweep, never a scheduled job:

- **`openspec/backlog/archive/BACKLOG-ARCHIVE.md`** — the archived index. Same five
  columns as the live index; append-only, newest last. The terminal row moves here out of
  `BACKLOG.md`.
- **`openspec/backlog/archive/<date>-<id>/`** — the relocated entry directory (its
  `BRIEF.md`, plus any `change.md` pointer). `<date>` is the `YYYY-MM-DD` of the terminal
  transition, mirroring `openspec/changes/archive/<date>-<id>/`. Locate an archived entry
  by globbing `openspec/backlog/archive/*-<id>/` — the id is unique, so the match is
  unambiguous.

Why relocate instead of leaving terminal rows in place: the live-index read at every
enqueue session start must not grow with throughput. History is not lost — it is consulted
where it is actually needed (the "already shipped / already dropped" check at
consolidation) via a **targeted grep over the archived index by footprint**, whose cost
scales with matches, not with archive size. It is never part of the free session-start
read.

## The entry — `openspec/backlog/<id>/BRIEF.md`

The grill-format brief (current behavior / desired behavior / acceptance criteria /
out-of-scope; deep mode adds the domain-shape section). Same skeleton as
`../../grill/references/brief-template.md` — the backlog adds no fields to it. At
enqueue time the entry directory contains BRIEF.md and nothing else; at intake the
dequeue path may add a one-line `change.md` naming the change dir
(`openspec/changes/<change-id>/`). On the terminal transition the whole directory is moved
under `archive/<date>-<id>/`.

## Lifecycle — who writes which status

```
queued ──(controller intake)──▶ in-progress(<change-id>) ──(change archived)──▶ done(<change-id>)
   │
   └─(enqueue consolidation or user)──▶ dropped(<reason>)
```

Both terminal states (`done` / `dropped`) are relocated to the archive by the same write
that sets them: the row leaves `BACKLOG.md` for `archive/BACKLOG-ARCHIVE.md`, and the entry
dir moves to `archive/<date>-<id>/`.

- **`queued`** — written by the `backlog` skill at enqueue. The only status this skill
  ever sets on a *new* entry. Lives in the live index.
- **`in-progress(<change-id>)`** — written by autonomy-controller when its backlog
  intake turns the entry into an OpenSpec change. The change-id links the queue row to
  `openspec/changes/<change-id>/`. Lives in the live index.
- **`done(<change-id>)`** — written by the controller when the change archives. **Terminal:
  the row + entry dir are relocated into the archive in the same write.** Done rows are the
  history that lets a future consolidation say "this idea already shipped as X" — they live
  in the archived index, not the live one.
- **`dropped(<reason>)`** — superseded at consolidation (with user confirmation) or
  withdrawn by the user. **Terminal: relocated into the archive by whoever drops it.** Keep
  the reason; a dropped row with a reason prevents the same idea from being re-groomed from
  scratch.

Merging entries (a confirmed `same-batch?` or a consolidation merge) = one surviving
entry absorbs the acceptance criteria, the others become
`dropped(merged into <survivor-id>)` and are relocated to the archive.

## Division of labour (single-writer per transition)

| Actor | May write |
|-------|-----------|
| `backlog` skill (enqueue) | new rows (`queued`), footprint/relation tags, confirmed rewrites/deletes/merges of existing entries; sets `dropped` **and relocates that entry (row + dir) into the archive** |
| `autonomy-controller` (dequeue) | `queued → in-progress`, `in-progress → done` **and relocates the done entry (row + dir) into the archive**, the entry dir's one-line `change.md` pointer |
| anyone else | nothing — the queue has exactly two writers |

The relocation is not a third actor's job: it is part of the terminal write, done by the
same writer that sets the terminal status. This keeps the "event-triggered only, exactly
two writers" invariant intact — no background groomer ever touches the queue.
