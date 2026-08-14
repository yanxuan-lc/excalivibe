# REFERENCE, not a file that gets copied. Whether the project still builds. The executor writes this
# target into the project's Makefile, with a real recipe rather than the placeholder at the bottom.
#
# Nothing installs it, for the reason spelled out further down: on a repository of several modules
# this recipe IS that project's module list, so a template cannot write it. Where the modules already
# have their own targets, name them as prerequisites — see `tools/genai/modules.json`, which records
# which those are.
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
#   genai-build: web-build service-build agent-build
#
# **A linter is not part of this, and `modules.json` keeps them apart on purpose** — `targets.build`
# and `targets.lint` are separate fields. What this target has to prove is that the code still
# compiles or type-checks; style and lint rules are a different question with a different fix, and
# folding them in means a naming complaint fails the round's build gate. Adding a lint target as a
# prerequisite is a project's choice and nothing here objects to it; what should not happen is a
# module putting `lint` here *instead of* a compile step because that is the only target it has. A
# module with neither a compiler nor a type checker has nothing for this gate to measure, and saying
# so — `"build": null` in the map, with the reason — is better than substituting a linter for it.
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
	@echo 'GENAI-BUILD-PLACEHOLDER - genai-init leaves this recipe to the executor' >&2; exit 1
