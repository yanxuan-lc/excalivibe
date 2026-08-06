.DEFAULT_GOAL := help

# Capture the main makefile before any -include, so help greps only itself
MK      := $(firstword $(MAKEFILE_LIST))
PLUGINS := $(notdir $(wildcard src/plugins/*))

# Node ≥22.18 strips TypeScript at load time, so the build has no runtime dependency.
# `typescript` is a devDependency used by `make typecheck` and nothing else.
NODE := node

# Recipes print through scripts/ui.ts, so the terminal sees one visual language whether a line came
# from a recipe or from a build script — and one implementation of the "is this a terminal, and does
# the user want colour" test, which `printf` cannot make. `help` is the deliberate exception: it
# formats a table in awk and owns its own layout.
UI := $(NODE) scripts/ui.ts

.PHONY: help build rebuild clean check check-banner typecheck \
        verify-build verify-skills verify-variants \
        install-claude install-codex install-common

# ───────────────────────────── general ─────────────────────────────

build: ## compile src/ → claude/ + codex/ + common/ (all three are artifacts, never hand-edit them)
	@$(NODE) scripts/build.ts

# check-banner comes first so the four verdicts below it read as a list under a subject rather than
# as four unrelated lines. Prerequisites run left to right, which is why the banner lands on top.
check: check-banner verify-build typecheck verify-skills verify-variants ## the full pre-commit gate
	@$(UI) result "all checks passed"

check-banner:
	@$(UI) heading "excalivibe — pre-commit gate"

clean: ## delete all build artifacts (**they are committed** — git will show mass deletions)
	@$(NODE) scripts/build.ts --clean

rebuild: ## clean → rebuild → byte-compare, proving the source is complete (no git state needed)
	@$(NODE) scripts/build.ts --verify-roundtrip

# ───────────────────────────── verify ──────────────────────────────

verify-build: ## artifacts match the source? catches "forgot to compile" and "hand-edited an artifact"
	@$(NODE) scripts/build.ts --check

typecheck: ## tsc over src/ and scripts/ — emits nothing, Node does the stripping at run time
	@npx --no-install tsc --noEmit && $(UI) step "types check out"

verify-skills: ## emitted skills — frontmatter is valid YAML, SKILL.md within its context budget
	@$(NODE) scripts/check-skills.ts

verify-variants: ## no variant block ate one end's whole section (the compile cannot see this)
	@$(NODE) scripts/verify-variants.ts

# ───────────────────────────── install ─────────────────────────────

install-claude: build ## install locally into Claude (the marketplace points at the repo root)
	@claude plugin marketplace add . 2>/dev/null || claude plugin marketplace update excalivibe
	@$(UI) result "marketplace refreshed"
	@$(UI) next "claude plugin install <plugin>@excalivibe" "available: $(PLUGINS)"

install-codex: build ## install locally into Codex (agents are copied separately; plugins can't bundle them)
	@codex plugin marketplace add . 2>/dev/null || true
	@$(UI) result "marketplace registered"
	@$(UI) next \
		"codex plugin add <plugin>@excalivibe — skills take effect in a new thread" \
		"cp codex/agents/*.toml ~/.codex/agents/ — a Codex plugin cannot bundle agents"

install-common: build ## show how to install the vendor-neutral artifact into a target project
	@$(UI) heading "common — a directory layout, not an installer"
	@$(UI) detail "per project:  mkdir -p <target>/.agents && cp -R common/. <target>/.agents/"
	@$(UI) detail "per user:     mkdir -p ~/.agents && cp -R common/. ~/.agents/"
	@$(UI) next \
		"hosts such as opencode discover .agents/skills/<name>/SKILL.md natively" \
		"\$${PLUGIN_ROOT} resolves to the project-relative .agents here, so a per-user install cannot rely on it (see src/common.ts)"

# ────────────────────────────── help ───────────────────────────────

help: ## list every target, grouped by domain
	@printf "\n\033[1mexcalivibe — make targets\033[0m\n"
	@printf "\033[2mclaude/, codex/ and common/ are build artifacts — edit src/, then make build\033[0m\n"
	@for group in general verify install; do \
		case "$$group" in \
			general) title="general — day-to-day entry points"; \
			         pat="^(help|build|rebuild|clean|check):" ;; \
			verify)  title="verify  — the parts of check, each runnable on its own"; \
			         pat="^(verify-[a-zA-Z-]*|typecheck):" ;; \
			install) title="install — local install for debugging"; \
			         pat="^install-[a-zA-Z-]*:" ;; \
		esac; \
		printf "\n  \033[1;33m%s\033[0m\n" "$$title"; \
		grep -E "$$pat.*## " $(MK) \
			| awk '{ name=$$0; sub(/:.*/,"",name); desc=$$0; sub(/^.*## /,"",desc); \
			         printf "    \033[36m%-16s\033[0m \033[2m%s\033[0m\n", name, desc }'; \
	done; \
	printf "\n"
