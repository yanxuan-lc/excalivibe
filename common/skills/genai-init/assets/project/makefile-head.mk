# REFERENCE, not a file that gets copied. Nothing installs this — the executor writes the project's
# Makefile and reads this for the shape.
#
# Use it ONLY when the project has no Makefile at all. It exists so that the bare command shows help
# instead of running whatever target happens to come first, and so the `## ` description each target
# carries has something that renders it.
#
# A project that already has a Makefile keeps its own head and its own default goal. Do not retrofit
# either — devops-guideline wants help as the default goal, but that file belongs to the project;
# raise it with them rather than changing it during an install.
.DEFAULT_GOAL := help

# Capture this makefile's path BEFORE any `-include`, so `help` greps only it: an include appends
# its file to MAKEFILE_LIST, and grepping two files makes grep prefix every match with `Makefile:`.
MK := $(firstword $(MAKEFILE_LIST))

.PHONY: help
help:                          ## list every target
	@printf "\n\033[1m%s — make targets\033[0m\n\n" "$(notdir $(CURDIR))"
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MK) \
		| awk '{ name=$$0; sub(/:.*/,"",name); desc=$$0; sub(/^.*## /,"",desc); \
		         printf "  \033[36m%-22s\033[0m %s\n", name, desc }'
	@printf "\n"

# `sub()` twice rather than `FS=":.*?## "`: BSD/macOS awk has neither the lazy quantifier nor a
# 3-argument match(), so the shorter idiom silently prints nothing on half the machines that run it.
