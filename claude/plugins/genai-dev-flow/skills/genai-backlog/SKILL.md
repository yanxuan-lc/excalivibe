---
name: genai-backlog
description: Decide where a stated intention belongs and what state it is in — capture it as a backlog item, clarify it until it is ready to build, order the candidates, or archive it once it ships. Reach for it when someone describes something they want built and nobody is building it right now, when the question is what is worth picking up next, when work turns up that should not be done in this pass, and when a finished piece of work needs closing out. Backlog items live one directory per item in a sibling `<project>_genai/`, outside the code repository, with the state written in the item's own file. It records goals and requirements only, never the design, the change or the branch that will realize them.
---

# Backlog

One item, one directory, outside the code repository.

```
<project>/                  the git repository — code, specs, docs
<project>_genai/            a sibling directory, NOT inside the repository
  backlogs/
    <item-id>/
      brief.md              the requirement
      log.md                state changes, append-only
      ...                   discussion notes, sketches — anything
  archive/
    <item-id>/              finished or dropped, same shape
```

Locate it as `../$(basename "$PWD")_genai` from the repository root. Create it on first use;
never create it inside the repository.

Requirements sit outside the repository because they span many versions and many branches and
correspond to no commit. Keeping one shared copy means every worktree reads the same live
content, and two sessions claiming different items never touch the same file.

## brief.md

```markdown
---
title: Unit alias resolution
status: ready
created: 2026-08-08
origin: human
priority: P2
---

## Goal

Let `kg`, `kilogram` and `kilo` all resolve to the same unit.

## Why

Exact matching only today, so one wrong character means "unknown unit", and the error
offers no candidates.

## Settled

- Cross-family ambiguity (`t` is both tonne and a scene unit) errors out and lists both
  candidates rather than guessing.
- The alias table ships built in; no user-defined aliases.

## Out of scope

- No fuzzy matching or edit distance.
- Conversion logic itself is untouched.

## Open questions

- Case sensitivity — should `KG` resolve?
```

| Field | Rule |
|---|---|
| `title` | One human-readable line. **The id is the directory name — never repeat it in frontmatter.** |
| `status` | `draft` / `ready` / `active` while live; `done` or `dropped` once archived. **A cache, not the truth** — the truth is the last line of `log.md`, and this always mirrors it. |
| `created` | Written once, never changes. |
| `origin` | `human` or `agent`. Who raised it. Written once, never changes. |
| `priority` | `P0`–`P3`. **The only frontmatter field that changes** — a deliberate exception, because it has to be grepped in bulk to order candidates. |

**Record goals and requirements only.** No branch, no change id, no design, no file list. One
item may end up spread across several changes and several branches; none of that fits here and
all of it drifts.

**Write the "Out of scope" section even when it feels obvious.** Whoever builds this reads the
file, not the conversation that produced it. A boundary that exists only in a vanished context
gets rediscovered by relitigating it.

**Keep authoritative frontmatter in `brief.md` alone.** Sibling files in the same directory may
hold anything, but the state lives in exactly one place.

## log.md

```markdown
- **2026-08-08** · `draft` — raised by genai-code-reviewer while reviewing unit-alias
- **2026-08-09** · `ready` — case sensitivity settled: `KG` resolves
- **2026-08-09** · `active`
- **2026-08-11** · `draft` — review found the alias table's source was never decided
- **2026-08-12** · `ready`
- **2026-08-15** · `done` · `add-unit-alias`, `unit-alias-cli`
```

```
- **<date>** · `<state>`[ · `<change ids>`][ — <one line>]
```

- **Date only, no time.** Order comes from line position; the file is append-only, so a later
  line is a later event.
- **The third segment appears only on `done`** and lists every change the item finally landed
  in. This is the only link between a requirement and its implementation.
- **A backward transition must carry a reason; a forward one need not.** Reaching `ready` is
  self-explanatory; being pushed back to `draft` is not, and in a month nobody remembers why it
  stalled.
- **Append only. Never edit or delete a line.** To correct a mistake, append a line that
  corrects it. This is the sole reason `status` can serve as a cache: when the two disagree,
  the log always wins.
- **An item raised by an agent records that on its first line**, naming what surfaced it.

## States

```
draft ──▶ ready ──▶ active ──▶ done
  ▲         ▲          │
  └─────────┴──────────┘   backward, with a reason
                                  └──▶ dropped
```

- **`draft` → `ready` is mechanical: the "Open questions" section is empty.** Do not judge
  readiness any other way. This gives clarification a definite finish line.
- **`active` means the item is in the current round.** Which branch it is being built on is
  answered by the changes, not by this file.
- **`done` and `dropped` appear once, as the last log line, at archive time.**

To clarify a `draft` toward `ready`, use the `grill` skill rather than improvising an
interrogation; the job here is only to keep "Open questions" honest and to move the resolved
answers into "Settled".

## Priority

Rank by **the cost of not doing it**, never by when it should be scheduled. Scheduling is a
feeling; cost is answerable — so each level is a yes/no question.

| Level | Question | Typical |
|---|---|---|
| `P0` | Is anyone unable to use it right now? | Broken feature, wrong data, blocked work |
| `P1` | Will every future round pay for this if it is not done? | Core abstractions, interface design, architecture that compounds. **The mark is that it gets more expensive the longer it waits.** |
| `P2` | Is a specific person waiting for this? | New features, experience improvements |
| `P3` | Do only we think it should be done? | Improvements, refactors, missing tests |

Three rules that carry the actual weight:

**"Breaks when combined with a feature outside this change" is still P0.** It does not get
demoted for having been introduced elsewhere. This is the class that always falls through,
because each change is individually correct and nobody owns the combination.

**P1's "more expensive the longer it waits" is a hard qualifier.** Without it P1 becomes the
holding pen for every refactor. A cleanup that costs the same next year is P3.

**P2 versus P3 turns on who is waiting, not on who raised it.** Agent-raised work lands in P3
by definition rather than by decree, which is what keeps a stream of self-generated
improvements from crowding out what people actually asked for.

**An agent that believes it found a P0 still writes `priority: P3`**, and states the case in
the body: "I believe this is P0 because…". Proposing and taking effect stay separate, and no
extra field is needed.

## Ordering candidates

Read the frontmatter of every `brief.md` under `backlogs/` — there is no summary file, and
building one would only be a second copy to drift.

Order by `priority` first, then put `origin: human` ahead of `origin: agent` within a level.
**Without this rule the two fields are decoration.**

## Archiving

Move the directory into `archive/<item-id>/`, add `outcome: done | dropped` and `change:` (a
list) to the frontmatter, set `status` to match the final log line, and append that line.

`change:` is a **frozen snapshot** taken at archive time — written once, never updated. It is
the one place a brief records anything from the implementation side, and it exists so that
"how was this actually built" stays answerable a year later. The authoritative direction runs
the other way: each change records which backlog items it came from.

**An item is done when every change it mapped to is done.** One short of that and it stays
`active`.

Splitting needs no special machinery: `dropped — split into unit-alias-table and
unit-alias-lookup`.

## Deliberately absent

Each of these was considered and rejected; the reasons are here so they do not grow back.

| Absent | Why |
|---|---|
| A `BACKLOG.md` summary list | Double-writes against the item files, and outside git it is the single shared write target — two sessions editing it means the later one silently wins. Globbing frontmatter is enough. |
| `branch` or `change` in a live brief | One item may land across several changes and branches. Both are "how", not "what". |
| Effort or size estimates | They rot, and real scheduling happens by looking at several items together, not by reading an old number. |
| A dependency field | Judge it by reading the briefs. As a field it ossifies, and adding a new item means remembering to update everyone else's. |
| Separate `ready_at` / `started_at` timestamps | **They cannot express going backward** — when `ready → draft → ready` happens, overwriting and keeping-the-first are both wrong, and that round trip is the normal shape of real work. |
| An `updated` field | The filesystem has mtime. |
