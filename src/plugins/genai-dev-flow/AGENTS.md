# AGENTS.md — genai-dev-flow

Rules for this plugin alone. The repository-wide ones are in the root
[AGENTS.md](../../../AGENTS.md), and the reasoning behind this plugin's shape is in
[CONTEXT.md](../../../CONTEXT.md).

This file compiles to nothing. The plugin-root allowlist in `scripts/build.ts` is exactly
`README.md` and `.mcp.json`, so nothing here reaches a user's installation — it is for whoever edits
the step definitions next.

## No shell in a step definition

Every check a step makes is one atom behind a single entry point:

```
node .flow/genai/check.mjs <atom> [--flag value]
```

**Every `command:` line across the `node.yaml` files under `skills/genai-init/assets/flow/nodes/`
has that shape, and the next one has to as well.** Count them with
`grep -h '^[[:space:]]*command:' skills/genai-init/assets/flow/nodes/*/node.yaml | wc -l` rather
than trusting a number written here — the two previous numbers in this sentence had both gone stale.

A pipeline written into YAML is a line nobody can run on its own, review as code, or reuse. That is
not hypothetical here: the six commands that used to live inline held four separate copies of "find
the requirements directory" between them. There is one copy now — `backlogRoot()` in
`assets/flow/genai/lib/backlog.mjs`.

**Nothing in `make check` enforces this.** None of the six gates looks inside a `command:` value, and
inline shell is the path of least resistance. It holds because you keep it.

## An atom reports a fact; the node decides the verdict

An atom's label says what is **there**, never whether that is good. The verdict is the caller's, in
`on_result`.

That is what makes one implementation serve two nodes wanting opposite answers: `open-changes`
returns `absent`, and `genai.archive` reads it as `pass` while `genai.accept` reads the same label as
`ready`. There is no `--negate` flag anywhere, and there must not be one. Three consequences:

- **Name an atom after what it measures, not after the answer someone wants.** `open-changes`, not
  `no-open-changes`; `worktree`, not `assert-clean`. A name carrying the polarity is a name that
  breaks the moment a second caller wants the other one.
- **`unreadable` is a label of its own**, separate from the engine's `failed` and `unexecutable`. The
  first says the artifact could not be measured, the second that the evaluator broke. Different
  people fix them, so they never share a message.
- **Checkers always exit 0** (`lib/say.mjs`). A label is only read on a zero exit; a non-zero exit is
  reported by the engine as `failed` instead, and the label is lost.

## `on_result` covers `values` plus two

fsx resolves a rule's expected labels as `values + [failed, unexecutable]` and refuses the definition
if `on_result` does not cover exactly that set. So adding one label to an atom means editing every
node that names it. The `acceptance` rule in `nodes/genai.e2e/node.yaml` is the widest — nine values
plus the two — and the `metrics` rule in `nodes/genai.implement/node.yaml` is next at eight. Both
group their labels by who can fix what: the ones the round owns, the ones that are setup problems no
retry can help, and the evaluator's own. `acceptance` adds a third axis on top of that, because two
of its labels choose between two **destinations** rather than two messages.

## Where a rule is allowed to live

| Kind of rule | Lives in | Why |
|---|---|---|
| the judgment — what counts as good enough | `assets/flow/genai/`, shipped with the definitions | a round that can edit the arithmetic is not being measured by it |
| the facts — what this project's suite actually produced | the project's own `make genai-metrics` | which test framework a project uses is outside this flow's subject |
| the floors — how much coverage is enough here | the project's `tools/genai/thresholds.json`, which a round may not edit | one number for a greenfield project and a decade-old one is either meaningless or unreachable |

`skills/genai-guideline/SKILL.md` carries the protocol between the first two in full, and it is the
file to change when that protocol changes — it is what a person reads before wiring a project up.

## Two habits specific to the step definitions

**A record a gate parses is one fenced json block, and the contract lives in the brief.** Two records
work this way — `e2e-manifest.md` and `e2e-report.md` — with prose around the block for whoever reads
them later. The literal shape is written into `nodes/genai.e2e-author/brief.md` and
`nodes/genai.e2e/brief.md`, next to the gate that parses it, and nowhere else; the agent files carry
judgment, not formats. A markdown table would read better and would put a round at the mercy of column
alignment.

**An entry rule its own step invalidates must narrow its `when`.** The field defaults to `always`,
and on `always` a precondition the step destroys forbids that step's own rework — permanently and
silently, since a ready refusal writes no event, spends no patience and records no attempt. Two
definitions depend on this: `nodes/genai.spec/node.yaml` uses `first_attempt` because it is a root,
and `nodes/genai.archive/node.yaml` uses `upstream_reran` because it has an upstream that can re-run.
Leave `when` off wherever the rule survives its own step — that is every rule guarding an
irreversible act, and those are the ones worth asking every time.

**When you change a node, change its comment with it.** There is no separate design document for this
plugin: the reasoning lives in the node comments, in the evaluators, and in the root `CONTEXT.md`.
