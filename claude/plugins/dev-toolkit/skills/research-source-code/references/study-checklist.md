# Source-Code Study Checklist

A repeatable way to read an unfamiliar codebase at a pinned ref and come away with *findings*, not impressions. Work top to bottom; skip steps that obviously don't apply, but do them in order — orientation before depth saves you from misreading isolated snippets.

## 1. Orient (before reading any feature code)

- **README / docs/** — what the project claims to be and do. Note the stated scope and any "non-goals".
- **Architecture** — look for `ARCHITECTURE.md`, `docs/`, or a top-level module map. If none, infer from the directory layout.
- **Entry points** — `main`, `index`, `lib.rs`, `__init__.py`, exported package surface, CLI definitions. This is where control flow starts.
- **Build/manifest** — `package.json` / `Cargo.toml` / `go.mod` / `pyproject.toml`: declared deps, feature flags, supported versions, public API surface (`exports`, `files`).
- **CHANGELOG / release notes** — for "what changed between versions" questions, this is the fastest signal of where to look.

## 2. Locate the feature under study

Use symbol-aware navigation first; fall back to text search.

- **serena MCP** (preferred when available):
  - `get_symbols_overview` on a file/dir to see what's defined where.
  - `find_symbol` to jump straight to a function/class/method definition.
  - `find_referencing_symbols` to find all call sites — this traces how a feature is actually used and reached.
  - `find_implementations` for interface/trait implementors.
- **ripgrep** (fallback): `rg -n "<term>"`, `rg -t py "<term>"`, `rg --files-with-matches "<term>"`.

Anchor on a concrete name (a public function, a config key, an error message string) rather than a vague concept — concrete strings are findable, concepts are not.

## 3. Read the implementation

- Read the **whole function/module**, not just the matching line — behavior lives in the surrounding control flow, guards, and early returns.
- Trace the **happy path** end to end, then the **error/edge paths**.
- Note **key abstractions**: the central types/interfaces everything else hangs off. Understanding these 3-5 things usually unlocks the rest.
- Watch for **indirection**: dynamic dispatch, plugins, codegen, macros, reflection — these hide behavior that grep won't reveal. Follow them.

## 4. Check the tests — the honest spec

Tests encode what the maintainers *intend* to be true, with concrete inputs/outputs.

- Find the tests covering the feature (`test/`, `tests/`, `*_test.go`, `*.spec.ts`, `#[cfg(test)]`).
- Read assertions for exact expected behavior, supported cases, and explicitly-handled edge cases.
- A feature with no test is a yellow flag about how load-bearing/stable it is — worth noting in the report.

## 5. Dependencies & trade-offs

- What does this feature pull in (heavy deps, native bindings, optional features)?
- Integration points / extension hooks — how is it meant to be customized?
- Known limitations: `TODO`/`FIXME`/`HACK` comments near the code, open issues referenced in comments, deprecation markers.

## 6. Write it up with provenance

For each claim that goes into the research report's References section, record:

- Repo URL + ref + **commit SHA** (from `clone-ref.sh`'s last line)
- `path/to/file.ext:symbol` for each thing you read
- A short quote or tight paraphrase of the code that backs the claim

If you can't point to a file + SHA, mark the statement as inference, not fact.
