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

This is a public repository, and both marketplace manifests live at the **repo root**, so you can **install directly from GitHub with a single command** — no manual clone first.

**Prerequisites**

- **Claude Code**: a recent version (with `plugin marketplace` support).
- **Codex CLI**: v0.117.0+ (the GitHub install steps here were verified on v0.137.0).

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

```bash
# 1. Add the marketplace (owner/repo shorthand, or an HTTPS/SSH Git URL; pin a ref with --ref main)
codex plugin marketplace add yanxuan-lc/excalivibe

# 2. Install plugins as needed; **open a new thread** afterwards so skills / MCP take effect
codex plugin add gen-ai-development@excalivibe
codex plugin add plugin-infra@excalivibe
codex plugin add opc-workflow@excalivibe
```

`gen-ai-development`'s **9 subagents** ship as standalone TOML files (Codex's plugin mechanism can't bundle subagents), so they go into the agents directory separately. A GitHub install has no local copy of the repo, so clone one to grab them:

```bash
git clone https://github.com/yanxuan-lc/excalivibe.git
cp excalivibe/codex/agents/*.toml ~/.codex/agents/      # or a project-level .codex/agents/
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
codex plugin marketplace add .                      # register the local marketplace (repo root)
codex plugin add gen-ai-development@excalivibe       # install; takes effect in a new thread
cp codex/agents/*.toml ~/.codex/agents/              # install the subagents
# Iterate: update_plugin_cachebuster.py <plugin> → codex plugin add <plugin>@excalivibe → new thread
```

## Design principle: seek common ground while preserving differences

**The architecture and main flow are identical on both sides; implementation details are each optimized, never compromised for compatibility.** For example:

| Scenario | Claude side | Codex side | Shared fallback |
|---|---|---|---|
| Research | `deep-research` + dynamic workflow | ordinary subagent | — |
| Browser | `claude --chrome` | computer-use / `@Chrome` | chrome-devtools MCP / Playwright |

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
├── openspec/                             # OpenSpec workflow artifacts
├── AGENTS.md                             # cross-agent project facts and collaboration norms
├── CLAUDE.md                             # Claude Code-specific preferences and collaboration rules
└── README.md
```

> Both marketplaces are named `excalivibe`; each plugin's `source` resolves relative to the **repo root**, pointing at `./claude/plugins/<name>` and `./codex/plugins/<name>` respectively.

## More docs

- [AGENTS.md](./AGENTS.md) — cross-agent project facts, marketplace / plugin structure norms, validation, and the flow for adding a capability.
- [CLAUDE.md](./CLAUDE.md) — Claude Code-specific primitives, subagent collaboration, and delegation rules.
- [codex/ADAPTING-FROM-CLAUDE.md](./codex/ADAPTING-FROM-CLAUDE.md) — the Claude→Codex adaptation rules.
