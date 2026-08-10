# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The hard rules live in [AGENTS.md](./AGENTS.md), shared by every agent. This file adds only the two
things it leaves out: **commands** and **the big picture**. Current state and open gaps are in
[CONTEXT.md](./CONTEXT.md).

## Commands

```bash
make build          # src/ → claude/ + codex/ + common/. Run it after every source change
make check          # the full pre-commit gate, six of them
make rebuild        # clean → rebuild → byte-compare, proving the source is complete (no git state needed)
make help           # every target, grouped by domain
```

Each gate runs on its own, which localizes a failure far faster than the whole run:

```bash
make verify-build     # artifacts match the source
make typecheck        # tsc --noEmit over src/ and scripts/
make verify-json      # every JSON in src/ parses; graph skeletons reference only their own nodes
make verify-skills    # emitted frontmatter is valid; each rendered SKILL.md is within 500 lines
make verify-variants  # no variant block boundary is mis-nested
make verify-no-cjk    # src/ and the agent-facing root docs stay English
```

**There is no test suite and no test runner.** `package.json` has exactly two scripts — `build` and
`typecheck` — its `devDependencies` are `typescript` and `@types/node`, and there is not one
`*.test.*` file in the repository. Correctness rests on `typecheck` plus the other five verifies.
There is no `npm test`, and "run a single test" does not mean anything here.

Versions and publishing:

```bash
make bump PLUGIN=<name> LEVEL=<major|minor|patch|x.y.z>   # the only way to change a version
make pack            # npm pack --dry-run — exactly what would be published, no external effect
make release-check   # read-only pre-publish report
make publish         # irreversible; needs CONFIRM=<version>
make tag             # prints the tag commands for you to run — a push is an outward action
```

The trigger eval spends a real model call. Do not run it in passing:

```bash
make eval            # eval-build → answer in a fresh session → eval-score. One model call
```

## Architecture

**One source tree, three ends.** A capability is written once under `src/plugins/<name>/` and
`make build` emits three shapes. The ends are defined by `ENDS` in `src/common.ts`:

| End | Artifacts | `${PLUGIN_ROOT}` resolves to | Platform constraints |
|---|---|---|---|
| claude | `claude/plugins/<name>/` | `${CLAUDE_PLUGIN_ROOT}` | the only end with `commands/` and `hooks/`; agents ship inside the plugin |
| codex | `codex/plugins/<name>/` + `codex/agents/*.toml` | `${CODEX_PLUGIN_ROOT}` | no commands concept; plugins **cannot** bundle agents; a `hooks` field makes its validator exit 1 |
| common | `common/skills/<name>/` + `common/agents/*.md` | `.agents` (project-relative) | no plugins, no manifest, no hooks; a skill name is repository-global here |

Three plugins:

| Plugin | Version | Contents |
|---|---|---|
| `computer-use` | 3.0.0 | 4 skills + 2 hook files (Claude only) |
| `dev-toolkit` | 3.0.0 | 19 skills; no agents, no hooks |
| `genai-dev-flow` | 3.0.0 | 4 skills + 4 agents + 7 fsx step definitions |

`genai-dev-flow` differs from the other two by **having state**: its step definitions and gate code
install into a consuming project's `.flow/`, while that project's requirements live outside it in a
sibling `<project>_genai/`.

### The compiler

`scripts/build.ts` is the whole of it, and understanding it is most of understanding this
repository. Of the eight per-end mechanisms, three cannot be seen by reading a single file:

1. **Variant blocks ride on HTML comments** (`applyVariants` in `src/common.ts`), so the source
   stays valid, previewable markdown: `<!--@claude-->` … `<!--@end-->`. **An end a block does not
   name gets nothing** — that is how a paragraph is scoped to a subset of ends without a second
   mechanism. A mis-nested boundary is a failure the compiler cannot see: the artifact really was
   generated verbatim and the round-trip really is byte-identical, which is why `verify-variants`
   exists to hunt orphan headings.
2. **Three description slots**: `description` / `description-claude` / `description-codex`, resolved
   by `descriptionFor()`. There is no `description-common` slot — common is the neutral end, so the
   fallback is its description. A second function, `descriptionValueFor()`, reads the **parsed** map
   for TOML, whose values come from `JSON.stringify` (feeding it raw text double-quotes an
   already-quoted string).
3. **`scripts/ui.ts` is the only output channel** for every build and verify script and every
   Makefile recipe, with three roles. Do not write escape codes outside it.

The remaining five mechanisms:

- **`${PLUGIN_ROOT}` substitution** — see the table above.
- **`tier` / `tier-<end>` on agents** — resolved against the `TIER` table: top → opus /
  gpt-5.6-sol, standard → sonnet / gpt-5.6-terra, light → haiku / gpt-5.6-luna, and always null on
  common. All four agents currently use plain `tier`; none uses `tier-<end>`.
- **`hooks/**`** — compiles to Claude by construction. Only `computer-use` has any: two files.
- **`command: true`** — Claude additionally gets a thin `commands/<name>.md`. Three skills use it
  today: `install-computer-use`, `genai-flow`, `genai-init`.
- **Per-end filenames** (`probe.claude.sh` → `probe.sh`) and **per-end data** (`realization.json`,
  one key per end) — implemented in the compiler, but **no source file uses either today**. If you
  change that logic, no existing artifact will verify it; build a case yourself.

## Two external tools

`genai-dev-flow` is built around them, and its step definitions do not read sensibly without these
two facts:

- **`fsx` (flow-scratch)** — the graph orchestration engine. `ready` rules are entry conditions and
  **consume nothing** when they fail; `gates` judge the result. **A gate command receives no
  variables** — not graph variables, not instance suffixes, no injected environment — so every check
  derives its context from `$PWD` or from git. That is why `.flow/genai/check.mjs` is addressed by a
  fixed path relative to the project root.
- **`openspec`** — spec and change management. **Its exit code cannot be trusted**: `validate`
  reports failures and still exits 0, and `archive` carries warnings through and exits 0 as well. So
  every judgment built on it reads the output, never the exit code.
