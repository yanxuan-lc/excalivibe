# ExcaliVibe ⚔️

**English** · [中文](./README.zh-CN.md)

> Excalibur + Vibe — a **Vibe Working** relic, like King Arthur's legendary sword.

ExcaliVibe is a **Vibe Working** capability suite. The idea grows out of Vibe Coding, but it isn't limited to coding — it targets a broader range of business scenarios, turning the Agent into a more capable all-rounder.

The project **supports both the Claude Code and Codex agents**, with every capability carried by each agent's own **marketplace + plugin** mechanism. A given capability solves the same problem and follows the same main flow on both sides — it's just implemented with whatever primitives fit each agent best (command / skill / subagent / hooks / MCP). That is the "seek common ground while preserving differences" principle described below.

## Plugins at a glance

| Plugin | What it does | Detailed usage |
|---|---|---|
| `gen-ai-development` | Generative-AI development workflow suite. Its core is an **autonomy controller** that sets an autonomy ceiling per task from `change archetype × criticality × reversibility`, then assembles the track and the human gates; two paradigms — SDD (spec contracts) + TDD — over a three-tier architecture (orchestration skill + single-responsibility subagents + independent capability skills). | [Claude](./claude/plugins/gen-ai-development/README.md) · [Codex](./codex/plugins/gen-ai-development/README.md) |
| `plugin-infra` | Shared infrastructure: browser automation (Chrome DevTools / Playwright MCP; the Claude side adds the graceful-browser decision layer). | [Claude](./claude/plugins/plugin-infra/README.md) · [Codex](./codex/plugins/plugin-infra/README.md) |
| `opc-workflow` | One-Person-Company workflow: a capability slot for non-development scenarios such as content / operations (no skills yet). | [Claude](./claude/plugins/opc-workflow/README.md) · [Codex](./codex/plugins/opc-workflow/README.md) |

> Each plugin's commands, skills, subagents, and concrete usage are authoritative in its own README; the main flow is identical on both sides, while implementation details are each optimized under "seek common ground while preserving differences".

## Install from GitHub

This is a public repository, and both marketplace manifests live at the **repo root**.
Plugins can therefore be installed directly from GitHub without cloning the repository
first. Codex subagents are standalone TOML files and have a separate installation step.

**Prerequisites**

- **Claude Code**: a recent version (with `plugin marketplace` support).
- **Codex CLI**: v0.117.0+ (project-tested minimum; the commands below were most recently verified on v0.145.0).

### Claude Code

```bash
# 1. Add the marketplace (pulled straight from GitHub; pin a branch/tag with @main, @v1.0)
claude plugin marketplace add yanxuan-lc/excalivibe

# 2. Install plugins as needed
claude plugin install gen-ai-development@excalivibe
claude plugin install plugin-infra@excalivibe
claude plugin install opc-workflow@excalivibe

# Pull repo updates later
claude plugin marketplace update excalivibe
```

### Codex (CLI v0.117.0+)

#### First install

```bash
# Add the marketplace once. owner/repo, HTTPS Git, and SSH Git sources are supported.
codex plugin marketplace add yanxuan-lc/excalivibe

# Install only the plugins you need.
codex plugin add gen-ai-development@excalivibe
codex plugin add plugin-infra@excalivibe
codex plugin add opc-workflow@excalivibe
```

Start a new chat or CLI session after installation so bundled skills and MCP servers are
loaded.

`gen-ai-development`'s **9 subagents** ship as standalone TOML files because plugins do
not auto-register custom-agent TOMLs. Clone the repository once and copy them into the
personal or project-scoped agents directory:

```bash
git clone https://github.com/yanxuan-lc/excalivibe.git
mkdir -p ~/.codex/agents
cp excalivibe/codex/agents/*.toml ~/.codex/agents/

# Project-scoped alternative, run from the target project:
# mkdir -p .codex/agents
# cp /path/to/excalivibe/codex/agents/*.toml .codex/agents/
```

Start a new chat or CLI session after copying the agents.

#### Update an existing GitHub installation

Do not repeat `marketplace add`. Refresh the configured Git marketplace, reinstall the
plugins you use, and then start a new chat or CLI session:

```bash
codex plugin marketplace upgrade excalivibe
codex plugin add gen-ai-development@excalivibe
codex plugin add plugin-infra@excalivibe
codex plugin add opc-workflow@excalivibe
```

Released plugin updates should change the plugin's SemVer. Reinstalling the same version
may reuse cached content; local iteration uses the cachebuster flow below.

Update separately installed subagents from the cloned repository:

```bash
git -C excalivibe pull --ff-only
mkdir -p ~/.codex/agents
cp excalivibe/codex/agents/*.toml ~/.codex/agents/
```

## Local development install

When editing plugins and iterating, install from a **local directory** (the marketplace manifests are at the repo root, so SOURCE is `.`).

**Claude**

```bash
claude plugin marketplace add .                     # register the local marketplace (repo root)
claude plugin install gen-ai-development@excalivibe # install as needed
claude plugin marketplace update excalivibe         # refresh after edits
```

**Codex**

```bash
# Run once from the ExcaliVibe repository root.
codex plugin marketplace add .

# Install a plugin and the standalone subagents.
codex plugin add gen-ai-development@excalivibe
mkdir -p ~/.codex/agents
cp codex/agents/*.toml ~/.codex/agents/
```

For each local plugin iteration, generate a development-only version suffix, reinstall,
and open a new chat or CLI session:

```bash
python3 ~/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py \
  codex/plugins/gen-ai-development
codex plugin add gen-ai-development@excalivibe
```

Do not commit the temporary `+codex.<cachebuster>` version suffix. Repeat the same flow
with the corresponding plugin directory and plugin name for `plugin-infra` or
`opc-workflow`.

To test the GitHub `dev` branch instead of a local checkout, configure that ref explicitly.
If `excalivibe` is already registered, remove the existing source first:

```bash
codex plugin marketplace remove excalivibe
codex plugin marketplace add yanxuan-lc/excalivibe --ref dev
codex plugin add gen-ai-development@excalivibe
```

## Design principle: seek common ground while preserving differences

**The architecture and main flow are identical on both sides; implementation details are each optimized, never compromised for compatibility.** For example:

| Scenario | Claude side | Codex side | Shared fallback |
|---|---|---|---|
| Research | `deep-research` + dynamic workflow | ordinary subagent | — |
| Browser | `claude --chrome` | discover available app / connector / built-in | chrome-devtools MCP / Playwright |

## Directory layout

```
excalivibe/
├── .claude-plugin/marketplace.json       # Claude marketplace manifest (repo root, name: excalivibe)
├── .agents/plugins/marketplace.json      # Codex marketplace manifest (repo root, name: excalivibe)
├── claude/                               # Claude-side plugins (commands / agents / skills / hooks / .mcp.json)
│   └── plugins/{plugin-infra, gen-ai-development, opc-workflow}/
├── codex/                                # Codex-side plugins (skills / .mcp.json / .app.json)
│   ├── plugins/{plugin-infra, gen-ai-development, opc-workflow}/
│   ├── agents/*.toml                     # 9 Codex subagents (installed separately)
│   └── ADAPTING-FROM-CLAUDE.md           # Claude→Codex adaptation handbook
├── docs/                                 # project docs as an MDX tree (tech = source of truth, research = historical)
├── openspec/                             # OpenSpec workflow artifacts
├── AGENTS.md                             # cross-agent project facts and collaboration norms
├── CLAUDE.md                             # Claude Code-specific preferences and collaboration rules
└── README.md
```

> Both marketplaces are named `excalivibe`; each plugin's `source` resolves relative to the **repo root**, pointing at `./claude/plugins/<name>` and `./codex/plugins/<name>` respectively.

## Docs (MDX)

Project docs live under [`docs/`](./docs/) as an **MDX tree** (`.mdx`), partitioned by authority: [`docs/tech/`](./docs/tech/) is the as-built source of truth, [`docs/research/`](./docs/research/) is historical. They are authored for the rich reader shipped by `plugin-infra`'s **mdx-artifact** skill — GitHub renders `.mdx` as raw source, so use the preview below for the intended experience.

**View the whole tree (recommended):**

```bash
SKILL=claude/plugins/plugin-infra/skills/mdx-artifact
npm --prefix $SKILL install                  # one-time: install build deps
node $SKILL/scripts/serve.mjs --root docs    # opens a browsable index of docs/
```

The preview lists every `.mdx` under `docs/`; open any of them and relative links between docs route inside the preview (edit a file → it hot-reloads). To export a single doc as a **self-contained, offline HTML** file instead:

```bash
node claude/plugins/plugin-infra/skills/mdx-artifact/scripts/render.mjs docs/tech/README.mdx docs-tech.html
```

> The renderer is offline and self-contained (zero external requests). Authoring conventions live in the skill's [SKILL.md](./claude/plugins/plugin-infra/skills/mdx-artifact/SKILL.md); the Codex side mirrors the same skill.

## More docs

- [docs/](./docs/) — project docs as an MDX tree (`tech/` = source of truth, `research/` = historical); view via the preview above.
- [AGENTS.md](./AGENTS.md) — cross-agent project facts, marketplace / plugin structure norms, validation, and the flow for adding a capability.
- [CLAUDE.md](./CLAUDE.md) — Claude Code-specific primitives, subagent collaboration, and delegation rules.
- [codex/ADAPTING-FROM-CLAUDE.md](./codex/ADAPTING-FROM-CLAUDE.md) — the Claude→Codex adaptation rules.
