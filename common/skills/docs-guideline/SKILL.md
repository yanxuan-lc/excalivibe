---
name: docs-guideline
description: Decide where a piece of durable technical knowledge belongs once a change has shipped, and curate the as-built docs tree so it stays findable — one authoritative place per topic, the index that points at it, and earlier research or prototypes kept linked but plainly marked as history. Reach for it whenever finished work has to be written down or an existing document has to absorb it, on "write up the technical docs", "document what we just built", "set up a docs index", "where does this design note belong", or when a docs tree under `docs/tech/` needs reorganizing. It answers what the documentation should say and where it should live now that the work is done; narrating a change while it is still in flight is a different kind of writing.
---

# Documentation Curation Guidelines

How to turn a finished change into documentation that survives — knowledge a teammate (or you, six months later) can actually find and trust. The failure we're preventing is the common one: docs that are a pile of change-narratives nobody can navigate, where the "current truth" is buried in a proposal from three months ago and contradicted by two newer ones. Good docs answer "what *is* this now?" in two clicks, not "what did we decide back then?".

## The Core Idea

A repo accumulates two kinds of writing, and confusing them is the root of most doc rot:

- **Narrative** — *how we got here*: research reports, prototypes, change proposals, specs, decision records. Tied to a moment in time. Valuable as history, dangerous as reference because it goes stale the instant the next change lands.
- **As-built** — *what it is now*: the steady-state design of the shipped system. One authoritative place per topic, updated in place as the system changes.

This skill is mostly about producing the **as-built** layer (`docs/tech/`) from narrative inputs, and keeping the narrative layer (`research/`, `ued/`) clearly labelled as history so nobody mistakes it for truth.

When you finish curating, the test is: **conflicts resolve to one place, and that place is current.**

## When This Triggers

- **Right after a change ships** — the durable knowledge it produced needs to move out of wherever the change was recorded (an archived spec directory, a merged PR, a design doc) and into `docs/tech/`. This is the main event.
- **Manual requests** — "tidy up the docs", "write up the docs for what we just built", "give docs an index", "where should this design be recorded", or reorganizing an existing tree. Same rules apply; you just may not have an archived change to read from.

## How to Use This Skill

1. Read **The Taxonomy** and **README-as-Index** below — they hold for any `docs/` work.
2. Follow **The Ship-Time Workflow** as the procedure. When there is no written record of the change, skip step 1 and start from "classify the knowledge".
3. When you need exact README skeletons, read [references/readme-templates.md](references/readme-templates.md). For the finer placement rules (versioning, path stability, contract-vs-narrative), read [references/taxonomy.md](references/taxonomy.md). For an end-to-end worked example, read [references/worked-example.md](references/worked-example.md).

Don't load the reference files until you actually need them — the body here is enough to start.

## Severity

- **[MUST]** — breaking these makes docs untrustworthy or breaks the build. Don't ship output that violates one.
- **[SHOULD]** — strong default; deviate only with a concrete reason and say why.

---

## Carrier and Viewing — as-built docs are MDX [MUST]

The as-built docs under `docs/tech/` and every level's `README.mdx` index are written as **MDX** (a Markdown
superset plus components), and viewed through the **`mdx-artifact`** skill, which serves a themed,
clearly sectioned local preview: `mdxv docs/tech` starts a preview server rooted at that directory (with a
file drawer on the left once there is more than one doc) — **relative links in the body that point at a local
`.md`/`.mdx` file or a directory are routed automatically** (click and you jump inside the preview; a
directory link resolves through that directory's `README.mdx`), so the README-as-Index routing tables keep
working unchanged.

- **Prefer plain Markdown for the body** (tables and ` ```sql `/` ```jsonc ` work as-is); draw diagrams with
  a ` ```dot ` fence (module dependencies / architectural layering — graphviz, rendered statically at build
  time) or a ` ```mermaid ` fence (class / ER / state machine / sequence); reach for
  `<Section>`/`<Callout>`/`<Fields>` when a section, an aside, or a block of metadata needs more structure.
  For the exact syntax see the mdx-artifact SKILL and its `references/blocks.md`.
- **Markdown is already valid MDX** — rename a `.md` to `.mdx` and the content works unchanged, so migration
  is cheap. Always use **relative paths** for cross-document links (the preview routes them; never hard-code
  `?doc=`). The **authoritative source** still goes at the top of the file (blockquote or frontmatter).
- Note: GitHub does not render `.mdx` richly (it shows the source), so team browsing goes through the
  `mdx-artifact` preview server.

---

## The Taxonomy

`docs/` has three top-level homes. The dividing line is **authoritativeness**, not topic:

| Home | Holds | Authoritativeness |
|------|-------|-------------------|
| `docs/tech/` | **as-built** technical design: protocols, schema, per-module design | **Fact standard.** Updated as the system changes. On any conflict, this wins. |
| `docs/research/` | one-time investigation reports (`<date>-<topic>/`) | **History only.** Not maintained; superseded by `tech/` once a design ships. |
| `docs/ued/` | prototype / interaction designs | **History-ish.** The shipped UI is the truth; the prototype records intent. |

> Your curation effort lives almost entirely in `docs/tech/`. You *touch* `research/` and `ued/` only to **mark them stale and cross-link** them once their design has shipped — you do not restructure their internals (out of scope for this skill).

**The one exception, because otherwise it is a dead link:** `docs/research/README.mdx` and
`docs/ued/README.mdx` — the index at the *top* of those areas — are yours to create if missing.
"Restructuring their internals" means the report directories underneath (`<date>-<topic>/` and
what is inside them); it does not license leaving the area with no entry point, because a
directory link resolves through that directory's `README.mdx` and `docs/README.mdx` links to
both areas. Keep such an index to what it is: a dated list of what was investigated, plus which
entries are superseded. Do not summarise the reports — you are not maintaining their content,
only the door.

### Inside `docs/tech/`: two shapes [MUST]

This is the call you make for every piece of knowledge. Get it wrong and either the same fact gets duplicated in three module docs, or a shared contract has no home.

- **Top-level dir = an artifact with code/contract coupling, shared across modules.** It is not owned by any single module — it's the *contract between* them, or a mechanism with its own lifecycle.
- **Module subdir = narrative as-built design of one component.** It describes how that module works and **links out** to the shared artifacts rather than restating them.

The rule of thumb: **if two modules share it, or code/tests reference its path, it's top-level. If it's the story of one component, it's a module dir.** When unsure, read [references/taxonomy.md](references/taxonomy.md).

#### Naming: canonical shared dirs are fixed; module dirs are derived [MUST]

Three concerns show up in almost every backend project, so they get **fixed canonical names** — when the concern exists, use exactly these, don't invent synonyms (`schema/`, `api-contract/`, `config/`). Consistent names across projects are what let a reader land in an unfamiliar repo and still know where to look:

| Concern | Canonical dir | Holds |
|---------|---------------|-------|
| Protocol / API contract design | `protocol/` | the wire contract between client and server, versioned by API major (`v1.0/`, `v2.0/`) |
| Database / schema | `database/` | DDL / schema design (often hard-referenced by `Makefile`/tests — path-stable) |
| Config center / config delivery | `nacos/` | runtime config mechanism + examples (our config center is Nacos) |

Everything else is **derived from the actual project**:
- **Module subdir names = the project's real modules** (`daemon/`, `server/`, `web/`, `gateway/`, `worker/`…). Read the codebase; mirror the module names that already exist, don't invent a taxonomy.
- A genuinely new *shared* artifact that isn't one of the three above → name it for what it is, but prefer a section in an existing dir until a second consumer appears (premature top-level dirs fragment the index).

And **follow an existing tree's conventions over these defaults.** If a repo already keeps as-built docs under `services/` instead of `tech/`, or names its config dir differently, continue in its style rather than rebuilding to match these names — the canonical names are for greenfield trees and for the three concerns above when nothing exists yet.

### Never duplicate authoritative content [MUST]

A fact lives in exactly one place; everywhere else links to it. The daemon doc says "wire shape is in [`../protocol/v1.0/`](...)", it does not re-paste the JSON. Duplication is how docs start to contradict each other — the moment you copy, the copy begins to rot. If you catch yourself pasting a table you saw elsewhere, stop and link instead.

---

## README-as-Index

Every directory level carries a `README.mdx` that is an **index, not a dumping ground**. It exists so a reader can stand at the top of `docs/` and reach the one doc they need in about two clicks, reading only what's relevant — that's progressive disclosure, and it's the whole point.

Each README has the same three parts (exact skeletons in [references/readme-templates.md](references/readme-templates.md)):

### 1. Header blockquote — locate + authority [MUST]

A leading `>` block that says, in one or two lines: **what this directory is**, its **authoritative source (the code path this doc tracks)**, and **pointers to related docs**. The authoritative-source line is what lets a future reader (or you) know which code to trust when doc and code disagree, and what to update when the code changes.

```markdown
> ats-daemon technical design (as-built): a resident collector that parses jsonl and delivers it to the server.
> Authoritative source: `ats-daemon/crates/`. For the wire shape see [`../protocol/v1.0/`](../protocol/v1.0/).
```

### 2. The "load on demand" routing table [MUST]

A table that routes the reader by *intent*, so they load only the sub-doc they need:

```markdown
## How to use this (load on demand)
| I want to… | Read this |
|---|---|
| Change reported fields / endpoints / auth | [`protocol/v1.0/`](./protocol/v1.0/) |
| Change daemon collection / delivery | [`daemon/`](./daemon/) |
| Create or alter a table / read the schema | [`database/`](./database/) |
```

### 3. Organization + maintenance rules [SHOULD]

Briefly: why things live where (the top-level-vs-module split for this tree), plus the maintenance rules that apply here — **docs before code** for contracts/schema, **path-stability** warnings for code-referenced dirs, and how staleness is marked. These are what keep the next person from breaking the conventions.

---

## The Ship-Time Workflow

The procedure once a change has landed. Step 1 assumes the change left a written record somewhere; when it did not, start at step 2 with the code and the user's description as your inputs.

### 1. Read the change record — for facts, not prose

Find whatever the project keeps as the record of this change — an archived spec directory, a merged PR and its description, a design doc, or the commit range itself — and mine it:
- `proposal.md` — why this was built, the scope.
- `design.md` / `decisions.md` — the decisions and their *why* (this is the gold; the "why" is what as-built docs usually lack).
- `spec-*.md` — the contracts that were agreed (these often map directly to `protocol/` or `database/` content).
- `tasks.md` + `IMPLEMENTATION_NOTES.md` — what *actually* got built, and any deviations from the plan. **Trust this over the proposal** where they differ — the proposal is intent, the notes are reality.

Then glance at the as-built code at the authoritative paths to confirm the steady state. The change tells you what moved; the code tells you where it landed.

### 2. Classify the knowledge [MUST]

For each durable fact the change produced, decide its home using **The Taxonomy**: which top-level area, and within `tech/`, is it a shared artifact (top-level dir) or one module's story (module subdir)? A single change often touches several — a protocol bump *and* a schema change *and* a module's behavior. Split accordingly; don't cram a multi-area change into one file.

**Extract steady-state, don't transcribe the change.** [MUST] The change record is narrative ("we migrated from PG to MySQL because…"); the tech doc is as-built ("the engine is MySQL 8; DDL goes through Yearning"). Carry over the *durable why* (it's precious and the code can't tell you it), drop the change choreography. Never paste proposal prose into `tech/`.

### 3. Write or update the as-built doc(s)

For each target: create the file if the area is new, otherwise **edit the existing doc in place** — as-built docs are living, not append-only. Capture the current design and decisions. Put the **authoritative source (the code path)** in the header. Respect placement rules from [references/taxonomy.md](references/taxonomy.md): version contracts (`protocol/v1.1/` for compatible, `v2.0/` for breaking); treat code-referenced paths (like `database/`) as stable — moving them breaks `Makefile`/tests, so don't, or fix every reference if you must.

Small change that only tweaks an existing contract or behavior? A one-line edit to the right doc is the correct, complete answer — **don't manufacture a new file for ceremony.** [SHOULD]

### 4. Build or refresh the README index

For every directory you created or added a doc to, create/update its `README.mdx` per **README-as-Index** (header blockquote + routing table + conventions). A new sub-doc that isn't linked from its directory's README is effectively invisible — wiring it into the index is what makes recall work.

### 5. Cross-link [MUST]

- Module docs link *out* to the shared artifacts they depend on (daemon → `protocol/`), never restating them.
- The new `tech/` doc links *back* to the `research/`/`ued/` that informed it ("history: see …") so the reasoning trail survives.
- Use relative links and verify they resolve. **`mdxv --check` does not check links** — it
  compiles, and a dead link compiles perfectly. Nothing in the toolchain catches this for you, so
  check it yourself; a directory link additionally has to resolve through that directory's
  `README.mdx`, which is the case eyeballing misses most often:

  ```bash
  python3 - <<'EOF'
  import re, pathlib
  bad = []
  for f in pathlib.Path('docs').rglob('*.mdx'):
      for m in re.finditer(r'\[[^\]]*\]\(([^)\s]+)\)', f.read_text(encoding='utf-8')):
          t = m.group(1)
          if t.startswith(('http', '#', 'mailto:')): continue
          t = t.split('#')[0]
          if not t: continue
          p = (f.parent / t).resolve()
          if not (p.is_file() or (p / 'README.mdx').exists()):
              bad.append(f'{f} -> {m.group(1)}')
  print('\n'.join(bad) or 'all links resolve')
  EOF
  ```

### 6. Mark superseded narrative STALE [MUST]

If this change shipped a design that `research/` or `ued/` had proposed, that narrative is now history. Add a prominent banner at the **top** of the superseded file — don't delete it (the history has value):

```markdown
> ⚠️ **STALE — history only (as of «date»)**
>
> The design described here has been superseded by «implementation». «One line on what changed».
> The current truth is [`docs/tech/...`](...).
```

`«…»` is the **fill-me** marker and must be replaced with real content — the files you mark are usually
`.mdx`, and a leftover `<xxx>` gets parsed as a component and breaks the whole page's rendering. Be specific
about *what* changed and *where the truth now lives* — a bare "outdated" banner helps no one.

### 7. Walk up the tree

Update the parent indexes so the new knowledge is reachable from the top:
- The relevant `docs/tech/README.mdx` routing table (add the row for the new/changed area).
- `docs/README.mdx` — edit it if a whole new top-level area appeared, and **create it if it does
  not exist**. Step 8 has you stand at that file; "don't touch it unless a new area appeared"
  cannot also mean "leave the tree with no entry point".
- If the repo's root `AGENTS.md`/`README.md` keeps an architecture pointer into `docs/`, make sure it still points correctly.

### 8. Verify recall [SHOULD]

Stand at `docs/README.mdx` and trace the path a reader would take to the knowledge you just wrote. If it takes more than ~2 hops, or a routing table is missing the row, fix the index. Then scan for the duplication smell: is anything you wrote already authoritative elsewhere? If so, delete your copy and link.

---

## Output Format

When you finish a curation pass, give the user a short map of what changed — not prose. For each touched doc:

```
[NEW|UPDATED|STALE|SKIPPED] docs/tech/<path> — <one line: what knowledge it now holds>
```

**`SKIPPED` is a first-class row, not a footnote.** The judgement this skill most often gets
wrong is over-documenting — a new top-level directory for a fact with one consumer, a `v1.1/`
for a backward-compatible change — and restraint is invisible unless it leaves a trace. Give the
decision and the reason the same shape as the work:

```
[SKIPPED]  docs/tech/ratelimit/ — single consumer; lives as §5 of server/ until a second one appears
[SKIPPED]  protocol/v1.1/ — change is backward-compatible; edited v1 in place
```

A reader who disagrees can then reopen the call. Buried in a closing sentence, they never see it.

End with the recall path you verified ("docs/README.mdx → tech/ → <area>, reachable in two hops"). If a change was small enough that a one-line edit sufficed, say so plainly rather than inflating it.
