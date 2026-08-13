# Whether the project still builds. Append this target to the project's Makefile, then replace the
# placeholder line below.
#
# The gate runs `make genai-build` and reads its EXIT CODE, and nothing else. That is the opposite
# of `genai-metrics`, where the exit code is ignored because a failing suite is data and the numbers
# still have to come through. Here there are no numbers — a build either completed or it did not.
#
# So this recipe takes NO `-` prefix on any line. make stopping at the line that failed is exactly
# the wanted behaviour: carrying on past a broken compile would report a build that never happened.
#
# One target for the whole repository, however many modules it has. Narrowing belongs here, inside
# the recipe, and not in the gate: `go test` already skips packages nothing touched, tsc has
# `--incremental`, and a project whose build is genuinely slow knows how to narrow it safely. A gate
# that narrowed would have to be right about the module map, the dependency graph and the fork point
# all at once, and being wrong about any of them means silently building less — which looks exactly
# like passing.
#
# "Builds" means whatever proves this module's code is still coherent. For a compiled language that
# is the compiler; for a language without one it is the type checker. A multi-module repository
# names each module's own target, and `tools/genai/modules.json` records which those are:
#
#   genai-build: web-lint service-build agent-lint
#
# Prerequisites rather than recipe lines when the targets already exist — make stops at the first
# failing one either way, and the project keeps one definition of how each module is built.
#
# The placeholder below exits 1 on purpose — an unwritten build must never report a green one — and
# it prints a sentinel the gate recognises, so it comes back as a setup problem to hand to a person
# rather than as a compile error for the round to chase. Delete the whole line when writing the real
# recipe; leaving the sentinel in anything the recipe prints would keep reporting a missing target.
.PHONY: genai-build
genai-build:                   ## prove every module still compiles
	@echo 'GENAI-BUILD-PLACEHOLDER - genai-init phase 4 writes this recipe' >&2; exit 1
