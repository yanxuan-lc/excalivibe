## 1. The skill

- [x] 1.1 Add `src/plugins/dev-workflow/skills/backlog/SKILL.md` covering capture, review, decline, pull, compose, freeze
- [x] 1.2 Description in three slots, decision-first, naming no caller
- [x] 1.3 State the four item states and what each points at
- [x] 1.4 Say plainly that pulling creates a graph and never patches one, and why

## 2. Acceptance

- [x] 2.1 `make build` then `make check` — green, 491 artifacts
- [x] 2.2 S-QUEUE-CAPTURE / DECLINED: an item captured without a design; a declined one keeps its reason
- [x] 2.3 S-QUEUE-PULL: the entry points at the change and carries no second copy of the requirement
- [x] 2.4 S-QUEUE-BATCH-FINISHED-ONLY / FREEZE-SHRINKS-ONLY: unfinished refused; frozen batch refuses growth, allows recorded removal
- [x] 2.5 S-QUEUE-RECONCILABLE: a roster omitting a frozen member is detectable by comparing the two
- [x] 2.6 `openspec validate --strict` and `check-spec.mjs` both exit 0
