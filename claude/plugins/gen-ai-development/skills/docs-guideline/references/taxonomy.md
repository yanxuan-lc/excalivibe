# Placement Rules — Detailed

The finer judgment calls behind "where does this knowledge go". Read this when the top-level-vs-module decision isn't obvious, or when you're versioning a contract or moving a code-referenced path.

## Canonical names vs derived names

Before deciding placement, know which names are fixed and which you derive:

- **Fixed canonical top-level dirs** — use these exact names when the concern exists, don't invent synonyms: `protocol/` (协议 / API 契约), `database/` (数据库 / schema / DDL), `nacos/` (配置中心 / 配置下发). They recur in almost every backend project; consistent names let a reader navigate an unfamiliar repo. A `database/` is always `database/`, never `schema/` or `db/`.
- **Derived names** — everything else. Module subdirs mirror the project's *real* module names (read the codebase: `daemon/`, `server/`, `web/`, `gateway/`, `worker/`…). A new shared artifact that isn't one of the three canonical ones gets a name describing what it is — but prefer a section in an existing dir until a second consumer appears.
- **Existing tree wins.** If the repo already has a layout (e.g. as-built under `services/`, or a differently-named config dir), follow it. The canonical names are for greenfield trees and for the three concerns when nothing exists yet — not a mandate to rename what's already there.

## Top-level dir vs module subdir

The split inside `docs/tech/` is **ownership + coupling**, not topic size.

Put it at the **top level** when *any* of these is true:
- **Two or more modules share it.** A wire protocol belongs to neither the client nor the server; it's the contract *between* them. A database schema is shared by everything that reads/writes it. Giving a shared thing to one module makes the other module's doc lie by omission or duplicate it.
- **Code, build, or tests reference its path.** If `Makefile`'s `db-init` globs `docs/tech/database/**/*.sql`, that directory is part of the build surface — it has to be top-level and stable, not buried in a module dir that might get renamed.
- **It's a standalone mechanism with its own lifecycle.** Config delivery (`nacos/`), a message-format registry, a shared error-code catalog — these evolve independently of any one module.

Put it in a **module subdir** when:
- It's the *narrative* of how one component works — its internal structure, algorithms, lifecycle, configuration. `daemon/` explaining the scan→queue→deliver pipeline; `server/` explaining its middleware chain and stores.
- It naturally *links out* to the shared artifacts rather than defining them. A module doc that finds itself redefining the wire shape is a signal that content belongs in `protocol/` and the module should link to it.

### Borderline calls
- **A field's wire shape vs its extraction semantics.** The *shape* (the JSON, the types, the limits) is a shared contract → `protocol/`. *How a module derives that field from its source data* (which file, what mapping, what's skipped) is that module's story → its subdir. The reference project splits exactly this way: `protocol/v1.0/` owns the request body; `daemon/README.md §3` owns the jsonl→field mapping. Each links to the other.
- **A decision that spans modules.** Record the *decision and its why* once, in the most-owning location, and link from the others. Don't fork it.
- **New top-level area or a module subdir?** If you're about to create a top-level dir for something only one module touches, prefer a section in that module's doc until a second consumer appears. Premature top-level dirs fragment the index.

## Versioning contracts

Contracts (`protocol/`, public API surfaces, message formats) are versioned by **directory**, keyed to the API major:

- `v1.0/` corresponds to `/v1`. A **backward-compatible** revision (new optional field, new endpoint) bumps the minor: `v1.1/`. A **breaking** change (removed/renamed field, changed semantics, auth change) starts a new major dir: `v2.0/`, and both can coexist during a migration window.
- **先文档后代码**: the version dir and its README update *before or with* the code, never after. The contract doc is the agreement; code implements it. Shipping code first means the doc describes a past that no longer exists.
- Keep old version dirs as long as any client speaks that version; mark them with their support window if one exists.

## Path stability

Some `docs/` paths are part of the build/test surface, not just reading material. Treat them as **stable interfaces**:

- Before moving or renaming such a dir, grep the repo for its path (`Makefile`, CI, integration tests, ORM config, `db-init`-style scripts). The reference project's `database/` is hard-referenced by `make db-init` and testcontainers setup — moving it silently breaks the build.
- If you genuinely must move it, update *every* reference in the same change, and note the move in the dir's README so the next person understands the coupling.
- Prefer **adding** a new seq dir / version dir over restructuring an existing referenced one. Append-friendly layouts (`database/<seq>-<date>-<topic>/`) avoid touching what code already points at.

## DDL / review-unit directories (`database/`)

When the schema docs double as the actual migration source (as in the reference project):
- One file = one DDL statement = one review unit (matches review-platform constraints like `DDLMultiToCommit=OFF`). Don't merge multiple `ALTER`s into one file.
- New change set → **new seq dir** (`<seq>-<date>-<topic>/`), files numbered `NN-<action>.sql`. This keeps each change independently reviewable/rollback-able and append-only.
- The `README.md` here documents the engine, the DDL *process* (who applies, how, what's forbidden), and key schema decisions — not a copy of the SQL. Link to the `.sql` files; they are the authoritative DDL.

## What not to over-document

Documentation is a liability as well as an asset — every doc is a thing that can go stale. Resist:
- **Restating the code.** If a reader can get it faster by reading the (well-named) code, the doc should capture the *why* and the *cross-module contract*, not narrate every function.
- **One file per tiny change.** A change that only adjusts an existing field belongs as an edit to the existing doc, not a new file.
- **Copying the proposal.** The archived OpenSpec change is already the narrative record. `tech/` is the steady-state distillation, not a second copy of the proposal.
