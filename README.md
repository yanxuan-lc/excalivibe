# ExcaliVibe

> 中文版: [README.zh-CN.md](./README.zh-CN.md)

One source tree, compiled to three ends. A capability is written once under `src/plugins/<name>/`, and `make build` emits a Claude plugin, a Codex plugin and the vendor-neutral `common/` layout together.

## Three plugins

| Plugin | What it is | Contents |
|---|---|---|
| `computer-use` | How to operate a computer — the capabilities that let an agent reach past its own text output and act on a real machine | `graceful-browser`, `mdx-artifact`, `notify-user`, `install-computer-use` (plus one turn-end hook, silent out of the box, on the Claude end) |
| `dev-toolkit` | Atomic development capabilities — each stands alone, triggers on its own subject, and assumes nothing about who invoked it | 19 (conventions 6 / methods 4 / process 1 / checks 5 / grounded research 3) |
| `genai-dev-flow` | A whole flow — requirements in, one release out, every step gated on something re-runnable | 4 skills (manual / install / requirements / driving) + 4 subagents + 7 fsx step definitions |

**One rule runs through the repository: a skill never names its caller.** A description answers *when should this be used* and never *who will use it*. A skill saying `invoked by name from the developer agent` has three problems at once — it fails to trigger when a person asks for the same thing directly (it describes a dispatch rather than a situation), it breaks the moment that agent is renamed, and it inverts the dependency so the reusable thing depends on the specific one. The arrow points one way: **an orchestrator names the skills it calls; a skill never names its orchestrator.**

## Three ends

| End | Artifacts | Installation | Platform constraints |
|---|---|---|---|
| claude | `claude/plugins/<name>/` | marketplace (`.claude-plugin/marketplace.json`) | the only end with `commands/` and `hooks/`; agents ship inside the plugin |
| codex | `codex/plugins/<name>/` + `codex/agents/*.toml` | Codex plugin marketplace (`.agents/plugins/marketplace.json`) | no commands concept; a plugin **cannot** bundle agents, so they are copied to `~/.codex/agents/` by hand; a `hooks` field in the manifest makes the validator exit 1 |
| common | `common/` | copied into a target project's `.agents/` by hand | no plugins, no manifest, no hooks; hosts such as opencode read `.agents/skills/<name>/SKILL.md` natively |

`claude/`, `codex/`, `common/` and both marketplace manifests are **build artifacts** — not one hand-written file among them. Change `src/`, then `make build`. They are committed because the Claude marketplace installs straight from the repository: what a user clones has to contain a finished `claude/plugins/<name>/`, not something that exists only after a build.

## Getting started

```bash
npm install          # typescript / @types/node only, for type checking
make build           # src/ → claude/ + codex/ + common/
make check           # the full pre-commit gate
make help            # every target
```

**No runtime dependency**: Node ≥22.18 strips types at load, so `node scripts/build.ts` runs as it is. `typescript` serves `make typecheck` and nothing else — which is also why `tsconfig.json` turns on `erasableSyntaxOnly`. That flag bans `enum`, `namespace` and the rest of the syntax Node cannot strip, so "type-checks but will not run" cannot happen.

## How a single-end difference is expressed

Sharing is the default; a difference has to be declared. Eight mechanisms:

| Mechanism | Declared in | What the compiler does |
|---|---|---|
| variant block | a `<!--@claude-->` … `<!--@end-->` comment pair in any `.md` | keeps the named end's slice and drops the rest; an end the block does not name gets nothing |
| per-end description | `description-claude:` / `description-codex:` in the frontmatter | overrides that end; `description` is the fallback, and is exactly what common takes (see [AGENTS.md](./AGENTS.md#the-three-description-slots)) |
| per-end filename | `probe.claude.sh` | only that end gets it, renamed to `probe.sh`. **No source file uses this today** |
| per-end data | `realization.json`, one key per end | each end takes only its own half. **No source file uses this today** |
| root path | `${PLUGIN_ROOT}` in prose | substituted with each end's real root variable |
| model tier | `tier: top\|standard\|light` in agent frontmatter, optionally overridden per end with `tier-<end>:` | resolved against the `TIER` table in `src/common.ts` — in order, opus / sonnet / haiku and gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna; the common end carries no model field at all |
| single-end directory tree | `hooks/**` | compiles to Claude by construction |
| command wrapper | `command: true` in skill frontmatter | Claude additionally gets a thin `commands/<name>.md` |

## Six gates, and what each one prevents

`make check` runs six steps, each runnable on its own:

- **`verify-build`** — do the artifacts match the source? Catches "forgot to compile", "hand-edited an artifact", and "an orphan in the artifacts that no source produces".
- **`typecheck`** — `tsc --noEmit` over `src/` and `scripts/`.
- **`verify-json`** — every JSON under `src/` parses, and a graph skeleton references only the nodes it declares itself.
- **`verify-skills`** — two things: the emitted SKILL.md and agent frontmatter are a valid YAML subset, and every rendered SKILL.md stays inside its 500-line context budget. Both run over the artifacts rather than the source, because a per-end description can break the frontmatter on **one end only**, and a source file holds all three ends' prose at once so its line count says nothing about what actually enters context.
- **`verify-variants`** — is a variant block boundary mis-nested? This is a failure the compiler **cannot see**: a misplaced boundary drops a whole section on some end while the artifact is still generated verbatim from the source, the round-trip is still byte-identical, and every check still passes. Its method is to render each end and look for **orphan headings with no counterpart**. A genuinely single-end section is registered in `src/variant-exceptions.json` with its reason.
- **`verify-no-cjk`** — everything a model reads stays English, comments included: all of `src/`, plus the three agent-facing root files (`AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`) named one by one in the script. Exceptions are registered in `src/cjk-exceptions.json` with a reason, keyed relative to the repository root; `evals/` is exempt as a directory, because trigger fixtures are Chinese on purpose and never ship. Human-facing documents are out of scope by design and **bilingual by rule** — `README.md` / `README.zh-CN.md`, and every level of `docs/` as `README.mdx` / `README.zh-CN.mdx` (see [AGENTS.md](./AGENTS.md#hard-rules)). Nothing checks that a pair still corresponds.

Two more defences live inside the compiler rather than in the gate: `lintVariants` refuses to emit any file with a surviving marker (a misspelled end name and a missing `<!--@end-->` share that signature), and `emit` refuses to compile two sources to one path (the common end has no plugin directory, so a skill name is repository-global there).

## Layout

```
src/
  common.ts              end definitions, TIER table, variant rendering, frontmatter parsing
  marketplace.json       the shared source of both marketplace manifests
  variant-exceptions.json  registered deliberate single-end differences
  cjk-exceptions.json    registered src files allowed to contain Chinese
  plugins/<name>/
    plugin.json          one manifest, compiled into each end's own shape
    README.md
    skills/<name>/
      SKILL.md           routing surface + trunk — the part that enters context
      references/**      depth, loaded on demand
      scripts/**         executables; permission bits are preserved from the source
      assets/**          data that ships with the skill and is consumed by its scripts
      evals/**           trigger fixtures; they stay in src and are never shipped
    agents/<name>.md     one body, three serializations
    hooks/**             Claude only
scripts/
  build.ts               the compiler
  check-skills.ts        frontmatter validity + the SKILL.md line budget
  verify-variants.ts     variant block boundary integrity
  verify-json.ts         JSON parseability + graph skeleton reference integrity
  verify-no-cjk.ts       the English constraint on src/
  bump.ts                the only entry point for versions
  eval-triggers.ts       building and scoring the trigger eval
  ui.ts                  the single visual language for terminal output; the Makefile uses it too
docs/
  tech/                  as-built reference: the compile contract, the toolchain, the flow contract
```

This file is orientation; `docs/tech/` is reference. Read the one area you are about to change —
[`docs/tech/artifact-contract/`](./docs/tech/artifact-contract/README.mdx) for the compile,
[`docs/tech/toolchain/`](./docs/tech/toolchain/README.mdx) for the gates and the release path,
[`docs/tech/flow-contract/`](./docs/tech/flow-contract/README.mdx) for what a project must supply to run
`genai-dev-flow`. They are MDX, previewed with `mdxv docs`.

## Known rough edges

- `.agents/` in this repository holds **Codex's marketplace manifest**, while `common/` is what a consumer copies into **their own** `.agents/skills/`. One name, two roles, and easy to misread. The compiler therefore owns **only `.agents/plugins`** — widening it to the whole of `.agents/` would make `make build` sweep away whatever other tools have installed under `.agents/skills/` as orphans.
- The common end's `${PLUGIN_ROOT}` resolves to the project-relative `.agents`, so the variable does not hold under a **user-level** install (`~/.agents/`). Prose that has to work on the common end should prefer paths relative to the skill's own directory.
