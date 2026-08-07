## Context

See proposal.md — Why.

The script is carried over from the previous toolkit rather than rewritten. It was already correct
about the thing that is easy to get wrong: **it was measured against read-only commands and does not
fire on them.** Around thirty shapes were tried — history searches whose patterns contain
`npm publish` and `force push to main`, `gh pr view --json mergeable`, diffs against `main` — with
zero hits. The quote-excluding matchers in it exist for that reason and are load-bearing.

That measurement matters because the complaint it answers ("viewing git history gets intercepted")
turns out to come from somewhere else entirely: the host's own Bash permission prompt, which is
configuration rather than this hook. Rewriting the guard would not have fixed it and would have
risked the property it already has.

## Goals / Non-Goals

**Goals:**

- The `release-coordinator` boundary stops being only a sentence in a prompt
- Read-only inspection is never interrupted
- A failure in the guard cannot stop someone working
- The single-end reality follows from the compile rule, with nothing to remember

**Non-Goals:**

- Not changing any judgement: the same three verdicts on the same command shapes
- Not the host's permission configuration. Making read-only git commands pass without a prompt is
  `permissions.allow`, which belongs to the setup step, not here
- Not a replacement for the flow's gates. This is the second line; the first is that the acts live
  on `human` and `effect` steps

## Module Design

```
src/plugins/dev-workflow/hooks/
  hooks.json      PreToolUse · matcher Bash · one command
  guardrail.py    the decision
```

`hooks/**` compiles to the Claude end only — the same rule `computer-use` already relies on. Nothing
imports the script and nothing calls it but the host.

**No variant-registry entry.** That registry exists for a markdown *section* present on one end and
missing on another, which is usually a mis-nested variant block. It is scanned over `.md` files
only, so an entry naming a `.py` file is never visited: it would be counted neither as registered
nor as stale, and would sit in the registry claiming an enforcement that does not happen. The
single-end shape here comes from the compile rule for `hooks/**`, which needs no registration.

Its interface is stdin/stdout, not a module boundary: it reads the `PreToolUse` JSON
(`tool_name`, `tool_input.command`, `agent_id`, `cwd`) and writes a `hookSpecificOutput` decision.
`agent_id` being present is what distinguishes a subagent from the main agent, and it is the only
input that decides between `deny` and `ask`.

## External Protocol

The host's hook contract, consumed not defined. Three decisions:

| Decision | When | Effect |
|---|---|---|
| `deny` | subagent **and** irreversible outward act | the command does not run |
| `ask` | any other dangerous act | the person decides; in a headless run this blocks, by design |
| *(no output)* | everything else, and every internal error | the host's ordinary permission flow |

The five act shapes it recognises: package publish · force-push to a shared branch · push to
protected `main` · `gh pr merge` onto a protected base · destructive local (`git reset --hard`,
`git clean -f`). Plus commit-on-`main`, which is `ask` and never `deny`.

**Commit-on-`main` is reversible and still asked about.** It is there for a different reason than
the rest: the branch protection convention, not irreversibility. Both are worth an interruption,
and the guard does not need them to share a justification.

## Database Design

This change does not touch a database.

## Non-functional Budgets

| Dimension | Budget | Where the number comes from |
|---|---|---|
| Compiled artifact count | 468 → 470 | two files, one end |
| Per-command latency | ≤ 10s, hook timeout | declared in `hooks.json`; typical cost is one `git rev-parse` when the command mentions a branch |
| Registered variant divergences | unchanged at 1 | the variant registry covers markdown *sections*; a file that exists on one end by compile rule is not an orphan section and gets no entry |

The timeout is the budget that matters: the guard runs before every Bash call, so a slow one taxes
everything. The only external call it makes is resolving the current branch, and only for commands
that could target one.

## Security & Permissions

This *is* the security surface, so the properties are the point rather than a side note.

- **Refusal is narrow on purpose.** Widening `deny` to the main agent would make the guard something
  people disable, and a disabled guard protects nothing. `ask` covers that case, and in a headless
  run `ask` blocks anyway.
- **`ask` blocking unattended runs is deliberate.** No human, no publish.
- **A found credential is not the guard's business.** It matches command shapes, not content.
- **It fails open.** That is a security trade taken knowingly: a guard that fails closed halts the
  session on its own bug, and the failure mode of failing open is bounded by the first line of
  defence still being in place.

## Observability

The decision text is the only output, and it is what the person reads at the moment they are
interrupted, so it says what boundary was hit and who may perform the act instead.

**What stays invisible:** how often it fires. Nothing counts denials or asks, so "is this guard
tuned right" is not answerable from data — only from someone noticing they are being asked too
often. Accepted; adding telemetry to a permission hook is a larger decision than this change.

## Rollback & Migration

**Forward:** add the two files and rebuild. It takes effect when the plugin is
next loaded by the host; nothing needs installing into a project.

**Rollback:** delete them and rebuild. No state, no migration, nothing depends on it.

## Verification Carrier

`agent-driven`.

The scenarios are decisions the script makes about command strings, and checking them means feeding
it those strings. That is exactly how the read-only property was established already: construct the
`PreToolUse` payload, run the script, read what comes back.

Concretely: publish as subagent and as main, an ordinary feature-branch commit, a batch of read-only
commands including ones whose arguments contain the matched words, and malformed input.

## Decisions

**D1 — Carry the script over unchanged.** Alternative: rewrite it against the current codebase's
style. Rejected. Its correctness lives in matchers that are subtle for a reason — the quote and
command-position exclusions are what keep read-only commands out — and a rewrite would put that
property back at risk to gain consistency of style in a file nobody reads.

**D2 — Keep `ask` for commit-on-`main`, though it is reversible.** The stated principle is that
irreversible acts are worth interrupting. This one is not irreversible; it violates a branch
protection convention instead. Both are worth an interruption, so the guard's rule is the union of
two justifications rather than one.

**D3 — The read-only complaint is answered elsewhere, and this change says so.** It would have been
easy to "fix" it here by adding allowances the guard does not need. The measurement said the guard
never fired on those commands, so the fix belongs to `permissions.allow` in the setup step. Writing
that down is what stops the same non-fix being attempted again.

## Risks / Trade-offs

**A subagent can still do damage the guard does not model** → it recognises five shapes. A creative
equivalent (a script that pushes, an alias) is not matched. Accepted: the guard is a backstop, and
the first line is that these acts live on steps a subagent never executes.

**Failing open means a bug in the guard silently removes it** → nothing reports that the guard
errored. Accepted for the reason in Security, but it means "the guard is working" is never something
anyone verifies after the initial check.

**Claude-end-only leaves the other ends unguarded** → Codex relies on its own trust mechanism, and
the vendor-neutral layout has no hook concept. The flow's gates are the same on all three ends; only
the backstop differs, and that is recorded rather than assumed.
