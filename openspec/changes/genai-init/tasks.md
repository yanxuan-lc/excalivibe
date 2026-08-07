## 1. Rename and restructure

- [x] 1.1 `skills/install-dev-workflow/` → `skills/genai-init/`, `install-flow.mjs` → `init.mjs`
- [x] 1.2 Rewrite SKILL.md around the three dispositions; drop the prerequisites list it no longer has
- [x] 1.3 Ship the OpenSpec schema fork under `assets/openspec-schema/`

## 2. Setup steps

- [x] 2.1 Dependency check for `openspec`, `fsx`, `mdxv` — stop on the first two, warn on the third
- [x] 2.2 `openspec init` when absent; install the schema fork and point `openspec/config.yaml` at it
- [x] 2.3 `fsx init` when absent; `fsx skill install` for the host
- [x] 2.4 Seed `CONTEXT.md` when absent; never touch it when present
- [x] 2.5 Marked block in `AGENTS.md` and `CLAUDE.md`; unclosed marker is an error, not a repair
- [x] 2.6 Read-only git commands into `permissions.allow`

## 3. Project commands

- [x] 3.1 Wrap each command gate in `{{CMD_*_BEGIN}}` / `{{CMD_*_END}}` markers in the three definitions
- [x] 3.2 `--cmd-<name> <command>` bakes it in; `--cmd-<name> none` deletes the block; absent stops the run
- [x] 3.3 Read installed commands back from `.flow/nodes/*/node.yaml` before overwriting, so a re-run needs no flags
- [x] 3.4 Report each baked command, and name every check left unguarded

## 4. Wiring

- [x] 4.1 Update the plugin manifests and marketplace entry for the renamed command
- [x] 4.2 Confirm nothing else in the repo still names `install-dev-workflow`

## 5. Acceptance

- [x] 5.1 `make build` then `make check` — green, 488 artifacts
- [x] 5.2 S-SETUP-IDEMPOTENT / MARKERS / PRESERVES-THEIRS: seed a hand-written `AGENTS.md` and a non-empty `CONTEXT.md`, run twice, compare checksums
- [x] 5.3 S-SETUP-MARKERS-ABSENT: a file with no block gains one, the rest untouched
- [x] 5.4 S-SETUP-CMD-BAKED: the installed gate carries the command verbatim and the gate executes it
- [x] 5.5 S-SETUP-CMD-ABSENT: `none` removes the gate and the run names the unguarded check
- [x] 5.6 S-SETUP-CMD-PRESERVED: change a definition, re-run without flags, commands survive
- [x] 5.7 S-SETUP-SCHEMA: scaffold a change after setup, its design has the required sections
- [x] 5.8 S-SETUP-ALLOW-READS: read-only commands allowed, mutating ones not
- [x] 5.9 S-SETUP-REFRESHES-OURS: a changed definition is refreshed, reported as such
- [x] 5.10 `openspec validate --strict` and `check-spec.mjs` both exit 0
