## 1. Carry the hook over

- [x] 1.1 Copy `hooks/guardrail.py` and `hooks/hooks.json` from the previous toolkit into `src/plugins/dev-workflow/hooks/`, unchanged in judgement
- [x] 1.2 Update the module docstring: it names the previous engine's node ids, which no longer exist — name this flow's `effect` and `human` steps instead
- [x] 1.3 Confirm the executable bit and the shebang survive the compile

## 2. Confirm the single-end shape needs no registration

- [x] 2.1 Establish whether the variant registry covers non-markdown files before adding an entry to it
- [x] 2.2 `make check` reports no orphans and its divergence count is unchanged

## 3. Acceptance

- [x] 3.1 `make build` then `make check` — green, 470 artifacts
- [x] 3.2 S-GUARD-DENY-SUBAGENT / ASK-MAIN: the same publish command with and without `agent_id`
- [x] 3.3 S-GUARD-PASS-ORDINARY: a feature-branch commit and a push to a non-protected branch
- [x] 3.4 S-GUARD-READ-QUOTED: a batch of read-only commands whose arguments contain the matched words
- [x] 3.5 S-GUARD-FAILS-OPEN: malformed stdin exits 0 with no output
- [x] 3.6 S-GUARD-ONE-END: hook files exist under `claude/` only
- [x] 3.7 `openspec validate --strict` and `check-spec.mjs` both exit 0
