## Why

The delivery stage just gained steps that push to shared branches and publish releases. The
boundary that keeps a subagent from doing those things is currently a sentence in a prompt:
`release-coordinator` says "no publish, no push, no git mutation of any kind", and nothing enforces
it. A tool allowlist cannot — those steps need a shell, and a shell can push.

The previous toolkit had a second line of defence for exactly this, and it was not migrated: a
`PreToolUse` hook that reads the command about to run and refuses the irreversible outward ones when
a subagent is asking.

The flow's own gates are the first line: the acts live on `human` and `effect` steps that cannot
pass without a decision. The hook covers what those cannot — a run that goes off-script, a graph
that was bypassed, an unattended lane.

## What Changes

- `dev-workflow` gains `hooks/guardrail.py` and `hooks/hooks.json`, carried over unchanged in
  judgement: `deny` only for a subagent's irreversible outward act, `ask` for every other dangerous
  one, silent pass for everything else, and silent pass on any internal error.
- **Claude end only.** Codex's plugin manifest rejects a `hooks` field, so this compiles to one end
  and needs an entry in the variant registry.

## Capabilities

### New Capabilities

- `irreversible-act-guard`: a mechanical backstop that refuses irreversible outward acts from a
  subagent and puts every other dangerous act in front of a person, independently of whether the
  flow was followed.

### Modified Capabilities

None.

## Impact

| Affected | What |
|---|---|
| `src/plugins/dev-workflow/hooks/` | new — `guardrail.py`, `hooks.json` |
| `src/variant-exceptions.json` | one entry: the hook exists only on the Claude end |
| `claude/plugins/dev-workflow/hooks/` | compiled |

Nothing in the flow depends on it. A project without it keeps working; it loses a backstop, not a
step.
