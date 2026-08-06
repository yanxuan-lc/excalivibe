# README Skeletons

Copy-paste starting points for each kind of README in the `docs/` tree. They are scaffolds, not fill-in-the-blank forms — keep the three structural parts (header blockquote, routing table, conventions), adapt the wording to the actual content, and delete rows that don't apply. Write in the language the rest of the repo's docs use (these examples are in English; mirror your repo).

> **Every skeleton produces a `README.mdx` (MDX)**, viewed through `mdx-artifact` (see the SKILL's
> "Carrier and Viewing" section).
> The skeletons below are the **body**; when you land one, add a frontmatter block at the top of the file:
> ```yaml
> ---
> title: docs/tech — Technical Design (as-built)   # this README's main heading (Hero)
> palette: teal
> mode: auto
> toc: true                                        # with `Section`, renders a floating ToC on the right (only visible above 1700px)
> ---
> ```
> The `«…»` in the skeletons are **fill-me markers** and must all be replaced with real content when you
> land the file. **Do not switch to `<…>`-shaped placeholders** — `README.mdx` is parsed as MDX, and a
> leftover `<xxx>` in the body is treated as a component and breaks the whole page's rendering (wrap literal
> angle brackets in backticks when you need them).
> **Directory links** in the skeletons (e.g. `./tech/`, `./protocol/v1.0/`) are routed automatically to that
> directory's `README.mdx` in the preview; write file links as relative `.mdx` paths.
> Use `<Section>`/`<Callout>` when you need stronger sectioning or callouts (optional — plain `##` is fine
> for a short index page).

## Table of contents
- [docs/ root index](#docs-root-index)
- [docs/tech/ index](#docstech-index)
- [tech module subdir (narrative)](#tech-module-subdir-narrative) — e.g. `daemon/`, `server/`
- [tech contract/artifact subdir](#tech-contractartifact-subdir) — e.g. `protocol/`, `database/`
- [research report index](#research-report-index)
- [STALE banner](#stale-banner)

---

## docs/ root index

The top of the tree. Its job is to explain the three-home split and the authoritativeness rule, then route one level down. Keep it short — it should not describe content, only point.

```markdown
# docs — Documentation Overview

| Subdir / file | Role | Authoritativeness |
|---|---|---|
| [`tech/`](./tech/) | **as-built technical design**: protocol, persistence, per-module design | **Fact standard**, updated as the implementation changes; on any conflict, this wins |
| [`research/`](./research/) | **one-time investigation reports** | **Not a long-term reference**, kept as history only; superseded by `tech/` |
| [`ued/`](./ued/) | **prototype / interaction design** | The shipped UI is the truth; the prototype records design intent |

## Where to look
- **Changing the implementation / checking the current design** → [`tech/`](./tech/) (entry point: [`tech/README.mdx`](./tech/README.mdx))
- **Understanding where a decision came from / its history** → [`research/`](./research/) (may disagree with the current state)
- **Looking at the prototype / interaction intent** → [`ued/`](./ued/)

> The relationship in one line: `research/` and `ued/` are the starting point (how we thought about it),
> `tech/` is the end point (what it is now). **On any conflict, `tech/` wins.**
> For the high-level architecture, see [`AGENTS.md`](../AGENTS.md) at the repo root.
```

---

## docs/tech/ index

Routes by *intent* into the module/artifact subdirs, and states the organization + maintenance rules for the whole `tech/` tree.

```markdown
# docs/tech — Technical Design (as-built)

> This directory is the authoritative technical documentation for the **current implementation**. For how it
> relates to `research/` and `ued/`, see [`docs/README.mdx`](../README.mdx).

## How to use this (load on demand)
Don't read it end to end. Read the subdir for the part you're about to touch:

| I want to… | Read this |
|---|---|
| Change «the contract: fields / endpoints / auth» | [`protocol/v1.0/`](./protocol/v1.0/) |
| Change «module A's behavior» | [`«moduleA»/`](./«moduleA»/) |
| Change «module B's behavior» | [`«moduleB»/`](./«moduleB»/) |
| Create or alter a table / write a migration / read the schema | [`database/`](./database/) |
| Change runtime config / «the config delivery mechanism» | [`«config»/`](./«config»/) |

## Organization conventions
- **Top level = shared artifacts with code/contract coupling**: `protocol/` (the cross-module wire contract,
  one subdir per API version), `database/` (DDL review units + schema, hard-referenced by the build and the
  tests — do not move the path casually), `«config»/` (the runtime config mechanism).
- **Module subdirs = narrative technical design**: `«moduleA»/`, `«moduleB»/`, which link out to the shared
  artifacts above instead of re-pasting them.

## Maintenance rules
- **Docs before code**: when changing the protocol / schema / field extraction, update the corresponding tech
  doc (and its version) first, then change the implementation.
- Every `README.mdx` states its **authoritative source** (the corresponding code path) at the top; keep it in
  sync when you change the implementation.
- Path stability: `database/` is referenced from code — moving it means updating every reference.
```

---

## tech module subdir (narrative)

For a component's as-built design (`daemon/`, `server/`). It tells the component's story and links out to shared artifacts.

```markdown
# «module» Technical Design (as-built)

> «One line: what this module is and what it does».
> Authoritative source: `«code/path/»`.
> This file covers «the scope this module owns»; for «the cross-module contract / shape» see
> [`../protocol/v1.0/`](../protocol/v1.0/).

## 1. «Structural overview»
«What the module is made of, which way its dependencies point, the key constraints»

## 2. «Core mechanism A»
...

## N. «Config / lifecycle / boundaries»
...

---
> History: the research behind this design is at [`../../research/«date»-«topic»/`](...) (a one-time report;
> this file is the authority).
```

---

## tech contract/artifact subdir

For shared, code-coupled artifacts (`protocol/v1.0/`, `database/`). The header must nail down the authoritative code path and the versioning/path rules, because these are the docs other modules and the build depend on.

```markdown
# «artifact» «version / scope» (as-built)

> «One line: what contract or artifact this is, and which code surface it corresponds to».
> Authoritative source: `«code/path»`.
> **Versioning convention**: the `v1.0/` directory corresponds to «API major /v1»; a breaking change starts a
> new `v2.0/`, a compatible revision bumps the minor to `v1.1/`.
> When changing the contract, **update this file before you change the code**.

## 1. «Endpoints / tables / overview»
| ... | ... |

## 2. «Item-by-item definitions»
...

> The **semantic authority** for how each field is extracted and classified from its source lives in
> [`../../«module»/README.mdx`](...); this file only defines the shape.
```

> For `database/`: also note the DDL-review-unit convention (one file = one DDL = one review unit) and that the path is hard-referenced by `Makefile`/tests — see the reference project's `tech/database/README.mdx`.

---

## research report index

You generally don't *write* these (the `researcher` agent does), but you add the STALE banner on top when the design ships. Shape for reference:

```markdown
# «topic» Research

- **Date**: «date»
- **Scope**: «scope»
- **Status**: draft / in implementation / archived

## Overview
| Sub-topic | Document | Conclusion in one line |
|---|---|---|
| ... | [01-xxx.md](./01-xxx.md) | ... |
```

---

## STALE banner

Goes at the very top of a `research/`/`ued/` file whose design has now shipped. Be specific — name what changed and where the truth lives now.

```markdown
> ⚠️ **STALE — history only (as of «date»)**
>
> The «approach / stack» described here has been superseded by «the implementation / change»:
> - «What changed, 1»
> - «What changed, 2»
> The file is kept so the decisions and comparisons of the time remain traceable, but **the current truth is
> [`docs/tech/«path»`](...)**.
```
