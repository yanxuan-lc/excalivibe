---
name: docs-guideline
description: How to curate as-built technical docs under `docs/tech/` — where each piece of knowledge lives, the docs/tech/ README indexes that make it findable, and keeping `research/`/`ued/` linked and marked stale once shipped. Use when a feature lands and needs writing down (right after `openspec archive` — the primary moment), on "整理/梳理技术文档", "把这次实现的文档补上", "建个 docs 索引", "这块设计记到哪", or when reorganizing a docs/ tree. Trigger whenever the task is turning a finished change into durable docs or placing a design note — not general README editing or meeting-note organizing.
---

# Documentation Curation Guidelines

How to turn a finished change into documentation that survives — knowledge a teammate (or you, six months later) can actually find and trust. The failure we're preventing is the common one: docs that are a pile of change-narratives nobody can navigate, where the "current truth" is buried in a proposal from three months ago and contradicted by two newer ones. Good docs answer "what *is* this now?" in two clicks, not "what did we decide back then?".

## The Core Idea

A repo accumulates two kinds of writing, and confusing them is the root of most doc rot:

- **Narrative** — *how we got here*: research reports, prototypes, OpenSpec proposals/specs/decisions. Tied to a moment in time. Valuable as history, dangerous as reference because it goes stale the instant the next change lands.
- **As-built** — *what it is now*: the steady-state design of the shipped system. One authoritative place per topic, updated in place as the system changes.

This skill is mostly about producing the **as-built** layer (`docs/tech/`) from narrative inputs, and keeping the narrative layer (`research/`, `ued/`) clearly labelled as history so nobody mistakes it for truth.

When you finish curating, the test is: **conflicts resolve to one place, and that place is current.**

## When This Triggers

- **Right after `openspec archive`** — a change just shipped; its durable knowledge needs to move from `openspec/archive/<change>/` into `docs/tech/`. This is the main event.
- **Manual requests** — "整理下文档", "这次实现的文档补一下", "给 docs 建索引", "这个设计该记哪", or reorganizing an existing tree. Same rules apply; you just may not have an archived change to read from.

## How to Use This Skill

1. Read **The Taxonomy** and **README-as-Index** below — they hold for any `docs/` work.
2. Follow **The Archive-Time Workflow** as the procedure. For manual requests, skip the steps about reading an archived change and start from "classify the knowledge".
3. When you need exact README skeletons, read [references/readme-templates.md](references/readme-templates.md). For the finer placement rules (versioning, path stability, contract-vs-narrative), read [references/taxonomy.md](references/taxonomy.md). For an end-to-end worked example, read [references/worked-example.md](references/worked-example.md).

Don't load the reference files until you actually need them — the body here is enough to start.

## Severity

- **【强制 / MUST】** — breaking these makes docs untrustworthy or breaks the build. Don't ship output that violates one.
- **【推荐 / SHOULD】** — strong default; deviate only with a concrete reason and say why.

---

## The Taxonomy

`docs/` has three top-level homes. The dividing line is **authoritativeness**, not topic:

| Home | Holds | Authoritativeness |
|------|-------|-------------------|
| `docs/tech/` | **as-built** technical design: protocols, schema, per-module design | **Fact standard.** Updated as the system changes. On any conflict, this wins. |
| `docs/research/` | one-time investigation reports (`<date>-<topic>/`) | **History only.** Not maintained; superseded by `tech/` once a design ships. |
| `docs/ued/` | prototype / interaction designs | **History-ish.** The shipped UI is the truth; the prototype records intent. |

> Your curation effort lives almost entirely in `docs/tech/`. You *touch* `research/` and `ued/` only to **mark them stale and cross-link** them once their design has shipped — you do not restructure their internals (out of scope for this skill).

### Inside `docs/tech/`: two shapes 【强制】

This is the call you make for every piece of knowledge. Get it wrong and either the same fact gets duplicated in three module docs, or a shared contract has no home.

- **Top-level dir = an artifact with code/contract coupling, shared across modules.** It is not owned by any single module — it's the *contract between* them, or a mechanism with its own lifecycle.
- **Module subdir = narrative as-built design of one component.** It describes how that module works and **links out** to the shared artifacts rather than restating them.

The rule of thumb: **if two modules share it, or code/tests reference its path, it's top-level. If it's the story of one component, it's a module dir.** When unsure, read [references/taxonomy.md](references/taxonomy.md).

#### Naming: canonical shared dirs are fixed; module dirs are derived 【强制】

Three concerns show up in almost every backend project, so they get **fixed canonical names** — when the concern exists, use exactly these, don't invent synonyms (`schema/`, `api-contract/`, `config/`). Consistent names across projects are what let a reader land in an unfamiliar repo and still know where to look:

| Concern | Canonical dir | Holds |
|---------|---------------|-------|
| 协议 / API 契约设计 | `protocol/` | the wire contract between client and server, versioned by API major (`v1.0/`, `v2.0/`) |
| 数据库 / schema | `database/` | DDL / schema design (often hard-referenced by `Makefile`/tests — path-stable) |
| 配置中心 / 配置下发 | `nacos/` | runtime config mechanism + examples (our config center is Nacos) |

Everything else is **derived from the actual project**:
- **Module subdir names = the project's real modules** (`daemon/`, `server/`, `web/`, `gateway/`, `worker/`…). Read the codebase; mirror the module names that already exist, don't invent a taxonomy.
- A genuinely new *shared* artifact that isn't one of the three above → name it for what it is, but prefer a section in an existing dir until a second consumer appears (premature top-level dirs fragment the index).

And **follow an existing tree's conventions over these defaults.** If a repo already keeps as-built docs under `services/` instead of `tech/`, or names its config dir differently, continue in its style rather than rebuilding to match these names — the canonical names are for greenfield trees and for the three concerns above when nothing exists yet.

### Never duplicate authoritative content 【强制】

A fact lives in exactly one place; everywhere else links to it. The daemon doc says "wire shape is in [`../protocol/v1.0/`](...)", it does not re-paste the JSON. Duplication is how docs start to contradict each other — the moment you copy, the copy begins to rot. If you catch yourself pasting a table you saw elsewhere, stop and link instead.

---

## README-as-Index

Every directory level carries a `README.md` that is an **index, not a dumping ground**. It exists so a reader can stand at the top of `docs/` and reach the one doc they need in about two clicks, reading only what's relevant — that's progressive disclosure, and it's the whole point.

Each README has the same three parts (exact skeletons in [references/readme-templates.md](references/readme-templates.md)):

### 1. Header blockquote — locate + authority 【强制】

A leading `>` block that says, in one or two lines: **what this directory is**, its **权威源 (authoritative source — the code path this doc tracks)**, and **pointers to related docs**. The authoritative-source line is what lets a future reader (or you) know which code to trust when doc and code disagree, and what to update when the code changes.

```markdown
> ats-daemon 技术方案（as-built）：常驻采集器，解析 jsonl 投递到 server。
> 权威源：`ats-daemon/crates/`。线缆形状见 [`../protocol/v1.0/`](../protocol/v1.0/)。
```

### 2. "按需加载" routing table 【强制】

A table that routes the reader by *intent*, so they load only the sub-doc they need:

```markdown
## 怎么用（按需加载）
| 我要做… | 读这里 |
|---|---|
| 改上报字段 / 端点 / 认证 | [`protocol/v1.0/`](./protocol/v1.0/) |
| 改 daemon 采集 / 投递 | [`daemon/`](./daemon/) |
| 建表 / 改表 / 看 schema | [`database/`](./database/) |
```

### 3. Organization + maintenance rules 【推荐】

Briefly: why things live where (the top-level-vs-module split for this tree), plus the maintenance rules that apply here — **先文档后代码** for contracts/schema, **路径稳定性** warnings for code-referenced dirs, and how staleness is marked. These are what keep the next person from breaking the conventions.

---

## The Archive-Time Workflow

The procedure when an OpenSpec change has just been archived. (For a manual request with no archived change, start at step 2 using the code + the user's description as your inputs.)

### 1. Read the archived change — for facts, not prose

Open `openspec/archive/<date>-<topic>/` and mine it:
- `proposal.md` — why this was built, the scope.
- `design.md` / `decisions.md` — the decisions and their *why* (this is the gold; the "why" is what as-built docs usually lack).
- `spec-*.md` — the contracts that were agreed (these often map directly to `protocol/` or `database/` content).
- `tasks.md` + `IMPLEMENTATION_NOTES.md` — what *actually* got built, and any deviations from the plan. **Trust this over the proposal** where they differ — the proposal is intent, the notes are reality.

Then glance at the as-built code at the authoritative paths to confirm the steady state. The change tells you what moved; the code tells you where it landed.

### 2. Classify the knowledge 【强制】

For each durable fact the change produced, decide its home using **The Taxonomy**: which top-level area, and within `tech/`, is it a shared artifact (top-level dir) or one module's story (module subdir)? A single change often touches several — a protocol bump *and* a schema change *and* a module's behavior. Split accordingly; don't cram a multi-area change into one file.

**Extract steady-state, don't transcribe the change.** 【强制】 The archived change is narrative ("we migrated from PG to MySQL because…"); the tech doc is as-built ("the engine is MySQL 8; DDL goes through Yearning"). Carry over the *durable why* (it's precious and the code can't tell you it), drop the change choreography. Never paste proposal prose into `tech/`.

### 3. Write or update the as-built doc(s)

For each target: create the file if the area is new, otherwise **edit the existing doc in place** — as-built docs are living, not append-only. Capture the current design and decisions. Put the **权威源 (code path)** in the header. Respect placement rules from [references/taxonomy.md](references/taxonomy.md): version contracts (`protocol/v1.1/` for compatible, `v2.0/` for breaking); treat code-referenced paths (like `database/`) as stable — moving them breaks `Makefile`/tests, so don't, or fix every reference if you must.

Small change that only tweaks an existing contract or behavior? A one-line edit to the right doc is the correct, complete answer — **don't manufacture a new file for ceremony.** 【推荐】

### 4. Build or refresh the README index

For every directory you created or added a doc to, create/update its `README.md` per **README-as-Index** (header blockquote + routing table + conventions). A new sub-doc that isn't linked from its directory's README is effectively invisible — wiring it into the index is what makes recall work.

### 5. Cross-link 【强制】

- Module docs link *out* to the shared artifacts they depend on (daemon → `protocol/`), never restating them.
- The new `tech/` doc links *back* to the `research/`/`ued/` that informed it ("history: see …") so the reasoning trail survives.
- Use relative links and verify they resolve.

### 6. Mark superseded narrative STALE 【强制】

If this change shipped a design that `research/` or `ued/` had proposed, that narrative is now history. Add a prominent banner at the **top** of the superseded file — don't delete it (the history has value):

```markdown
> ⚠️ **STALE — 仅作历史参考（<date> 起）**
>
> 本文所述方案已由 <实现> 取代。<一句话说明变了什么>。
> 现状以 [`docs/tech/...`](...) 为准。
```

Be specific about *what* changed and *where the truth now lives* — a bare "outdated" banner helps no one.

### 7. Walk up the tree

Update the parent indexes so the new knowledge is reachable from the top:
- The relevant `docs/tech/README.md` routing table (add the row for the new/changed area).
- `docs/README.md` only if a whole new top-level area appeared.
- If the repo's root `AGENTS.md`/`README.md` keeps an architecture pointer into `docs/`, make sure it still points correctly.

### 8. Verify recall 【推荐】

Stand at `docs/README.md` and trace the path a reader would take to the knowledge you just wrote. If it takes more than ~2 hops, or a routing table is missing the row, fix the index. Then scan for the duplication smell: is anything you wrote already authoritative elsewhere? If so, delete your copy and link.

---

## Output Format

When you finish a curation pass, give the user a short map of what changed — not prose. For each touched doc:

```
[新建|更新|STALE] docs/tech/<path> — <one line: what knowledge it now holds>
```

End with the recall path you verified ("从 docs/README.md → tech/ → <area> 两跳可达") and call out anything you deliberately left alone (e.g. "research/<x> 未改，已加 STALE 横幅指向新文档"). If a change was small enough that a one-line edit sufficed, say so plainly rather than inflating it.
