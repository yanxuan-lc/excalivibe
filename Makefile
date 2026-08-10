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

# Where `make eval` leaves its prompt and answer. Outside the repo on purpose: they are one run's
# scratch, not a result — and a stray answer.json committed alongside the fixtures would read as a
# recorded baseline that nothing regenerates.
EVAL_TMP := $(if $(CLAUDE_JOB_DIR),$(CLAUDE_JOB_DIR)/tmp,$(TMPDIR))

.PHONY: help build rebuild clean check check-banner typecheck \
        verify-build verify-skills verify-variants verify-json verify-no-cjk \
        eval eval-build eval-score \
        bump pack release-check publish tag \
        install-claude install-codex install-common

# ───────────────────────────── general ─────────────────────────────

build: ## compile src/ → claude/ + codex/ + common/ (all three are artifacts, never hand-edit them)
	@$(NODE) scripts/build.ts

# check-banner comes first so the verdicts below it read as a list under a subject rather than as six
# unrelated lines. Prerequisites run left to right, which is why the banner lands on top.
check: check-banner verify-build typecheck verify-json verify-skills verify-variants verify-no-cjk ## the full pre-commit gate
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

verify-json: ## every JSON in src/ parses; graph skeletons refer only to nodes they declare
	@$(NODE) scripts/verify-json.ts

verify-no-cjk: ## src/ and the agent-facing root docs stay English; exceptions are registered with a reason
	@$(NODE) scripts/verify-no-cjk.ts

# ────────────────────────────── evals ──────────────────────────────
# Not part of `check`: it costs a model call, and a description is retuned deliberately, not on
# every commit. Two phases because the whole corpus then costs **one** call rather than one per
# query — and because the answer has to come from a context that has not just read the source.

eval-build: ## write the router prompt for every skill description + every trigger fixture
	@$(NODE) scripts/eval-triggers.ts build $(if $(END),--end=$(END),)

eval-score: ## score a router answer: accuracy overall, by language, and every miss
	@[ -n "$(ANSWER)" ] || { $(UI) fail "eval-score needs ANSWER"; $(UI) next "make eval-score ANSWER=<answer.json>"; exit 2; }
	@$(NODE) scripts/eval-triggers.ts score $(ANSWER) $(if $(END),--end=$(END),)

eval: ## the whole loop: build → answer in a fresh Claude → score. One model call.
	@$(NODE) scripts/eval-triggers.ts build $(if $(END),--end=$(END),) > $(EVAL_TMP)/prompt.md
	@$(UI) detail "prompt $(EVAL_TMP)/prompt.md — answering in a fresh context, this may take a minute"
	@cd $(EVAL_TMP) && claude -p --model opus < prompt.md > answer.json
	@$(NODE) scripts/eval-triggers.ts score $(EVAL_TMP)/answer.json $(if $(END),--end=$(END),)

# ───────────────────────────── release ─────────────────────────────
# bump on dev → MR into main → pull main → build → publish.
# Everything before publish is reversible. Publish is not: a version number cannot be reused,
# and a bad release can only be superseded by another one.

bump: ## the only way to change a version: make bump PLUGIN=<name> LEVEL=<major|minor|patch|x.y.z>
	@[ -n "$(PLUGIN)" ] || { $(UI) fail "bump needs PLUGIN"; $(UI) next "make bump PLUGIN=<name> LEVEL=<major|minor|patch|x.y.z>"; exit 2; }
	@[ -n "$(LEVEL)" ]  || { $(UI) fail "bump needs LEVEL"; $(UI) next "make bump PLUGIN=$(PLUGIN) LEVEL=<major|minor|patch|x.y.z>"; exit 2; }
	@$(NODE) scripts/bump.ts $(PLUGIN) $(LEVEL)
	@$(MAKE) --no-print-directory build

pack: ## exactly what would be published, with no external effect (npm pack --dry-run)
	@[ -n "$(PLUGIN)" ] || { $(UI) fail "pack needs PLUGIN"; $(UI) next "make pack PLUGIN=<name> — available: $(PLUGINS)"; exit 2; }
	@cd claude/plugins/$(PLUGIN) && npm pack --dry-run

release-check: ## read-only pre-publish report: branch, worktree, gate, npm identity, versions
	@$(UI) heading "excalivibe — pre-publish checks"
	@b=$$(git rev-parse --abbrev-ref HEAD); \
	 [ "$$b" = "main" ] && $(UI) step "on branch main" \
	                   || $(UI) detail "not on main (on $$b) — a release goes out from main, after the MR lands"
	@[ -z "$$(git status --porcelain)" ] && $(UI) step "worktree clean" \
	                                    || $(UI) detail "worktree dirty — what ships must be a commit somebody can return to"
	@$(MAKE) --no-print-directory check >/dev/null 2>&1 && $(UI) step "gate passed" \
	                                                  || $(UI) detail "gate failed — run make check to see which part"
	@npm whoami >/dev/null 2>&1 && $(UI) step "npm as $$(npm whoami) on $$(npm config get registry)" \
	                           || $(UI) detail "not logged in to npm — npm login first"
	@for p in $(PLUGINS); do \
		$(UI) detail "$$p  $$($(NODE) -e "console.log(require('./src/plugins/'+process.argv[1]+'/plugin.json').version)" $$p)"; \
	done
	@$(UI) next "make publish PLUGIN=<name> CONFIRM=<that version>"

publish: ## [IRREVERSIBLE] publish one plugin to npm. Needs CONFIRM=<version>; never runs on its own
	@[ -n "$(PLUGIN)" ] || { $(UI) fail "publish needs PLUGIN"; $(UI) next "make publish PLUGIN=<name> CONFIRM=<version>"; exit 2; }
	@v=$$($(NODE) -e "console.log(require('./src/plugins/$(PLUGIN)/plugin.json').version)"); \
	 if [ "$(CONFIRM)" != "$$v" ]; then \
		$(UI) fail "publish refused — CONFIRM=$$v required, the current version of $(PLUGIN)"; \
		$(UI) detail "publishing is publicly visible and cannot be undone; a version number is spent once"; \
		$(UI) next "make release-check" "make publish PLUGIN=$(PLUGIN) CONFIRM=$$v"; \
		exit 2; \
	 fi; \
	 b=$$(git rev-parse --abbrev-ref HEAD); \
	 [ "$$b" = "main" ] || { $(UI) fail "publish refused — on $$b, a release goes out from main"; exit 2; }; \
	 [ -z "$$(git status --porcelain)" ] || { $(UI) fail "publish refused — worktree is not clean"; exit 2; }; \
	 $(MAKE) --no-print-directory check || exit 1; \
	 $(UI) heading "publishing $(PLUGIN)@$$v to $$(npm config get registry)"; \
	 cd claude/plugins/$(PLUGIN) && npm publish --access public

tag: ## print the tag commands for a published version — run them yourself; a push is outward
	@[ -n "$(PLUGIN)" ] || { $(UI) fail "tag needs PLUGIN"; $(UI) next "make tag PLUGIN=<name>"; exit 2; }
	@v=$$($(NODE) -e "console.log(require('./src/plugins/$(PLUGIN)/plugin.json').version)"); \
	 $(UI) next "git tag $(PLUGIN)-v$$v" "git push origin $(PLUGIN)-v$$v"

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
	@for group in general verify eval release install; do \
		case "$$group" in \
			general) title="general — day-to-day entry points"; \
			         pat="^(help|build|rebuild|clean|check):" ;; \
			verify)  title="verify  — the parts of check, each runnable on its own"; \
			         pat="^(verify-[a-zA-Z-]*|typecheck):" ;; \
			eval)    title="eval    — measure the routing surface (costs one model call)"; \
			         pat="^eval[a-zA-Z-]*:" ;; \
			release) title="release — versions and publishing (publish cannot be undone)"; \
			         pat="^(bump|pack|release-check|publish|tag):" ;; \
			install) title="install — local install for debugging"; \
			         pat="^install-[a-zA-Z-]*:" ;; \
		esac; \
		printf "\n  \033[1;33m%s\033[0m\n" "$$title"; \
		grep -E "$$pat.*## " $(MK) \
			| awk '{ name=$$0; sub(/:.*/,"",name); desc=$$0; sub(/^.*## /,"",desc); \
			         printf "    \033[36m%-16s\033[0m \033[2m%s\033[0m\n", name, desc }'; \
	done; \
	printf "\n"
