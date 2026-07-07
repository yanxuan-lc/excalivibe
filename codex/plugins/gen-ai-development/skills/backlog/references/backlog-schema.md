# Backlog schema — index format, entry layout, lifecycle

## The index — `openspec/BACKLOG.md`

One table row per entry. The row is the *whole* index record — anything longer belongs
in the entry's own directory. Keep titles in the user's language; keep field syntax in
the forms below so rows stay machine-matchable.

```markdown
# Backlog — idea queue

| id | title | status | footprint | relations |
|----|-------|--------|-----------|-----------|
| report-export | 报表导出为 JSON | queued | reporting, orders-table | depends-on:report-page |
| report-page | 报表页改版 | in-progress(update-report-page) | reporting, report-ui | — |
| smart-notify | 通知降噪 | queued | notification | related:digest-mail, same-batch?:digest-mail |
| legacy-import | 旧数据导入 | dropped(superseded by report-export) | orders-table | — |
```

### Fields

- **id** — kebab-case slug, unique, doubles as the entry directory name
  (`openspec/backlog/<id>/`). Stable once created; a rename is a delete + re-add.
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
record symmetric relations on **both** rows so either entry's dequeue sees them.

## The entry — `openspec/backlog/<id>/BRIEF.md`

The grill-format brief (current behavior / desired behavior / acceptance criteria /
out-of-scope; deep mode adds the domain-shape section). Same skeleton as
`../../grill/references/brief-template.md` — the backlog adds no fields to it. At
enqueue time the entry directory contains BRIEF.md and nothing else; at intake the
dequeue path may add a one-line `change.md` naming the change dir
(`openspec/changes/<change-id>/`).

## Lifecycle — who writes which status

```
queued ──(controller intake)──▶ in-progress(<change-id>) ──(change archived)──▶ done(<change-id>)
   │
   └─(enqueue consolidation or user)──▶ dropped(<reason>)
```

- **`queued`** — written by the `backlog` skill at enqueue. The only status this skill
  ever sets on a new entry.
- **`in-progress(<change-id>)`** — written by autonomy-controller when its backlog
  intake turns the entry into an OpenSpec change. The change-id links the queue row to
  `openspec/changes/<change-id>/`.
- **`done(<change-id>)`** — written by the controller when the change archives. Done
  rows stay in the table: they are the history that lets a future consolidation say
  "this idea already shipped as X".
- **`dropped(<reason>)`** — superseded at consolidation (with user confirmation) or
  withdrawn by the user. Keep the reason; a dropped row with a reason prevents the same
  idea from being re-groomed from scratch.

Merging entries (a confirmed `same-batch?` or a consolidation merge) = one surviving
entry absorbs the acceptance criteria, the others become
`dropped(merged into <survivor-id>)`.

## Division of labour (single-writer per transition)

| Actor | May write |
|-------|-----------|
| `backlog` skill (enqueue) | new rows (`queued`), footprint/relation tags, confirmed rewrites/deletes/merges of existing entries, `dropped` |
| `autonomy-controller` (dequeue) | `queued → in-progress`, `in-progress → done`, the entry dir's one-line `change.md` pointer |
| anyone else | nothing — the queue has exactly two writers |
