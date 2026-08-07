## Context

See proposal.md — Why. Four things constrain the design.

**The script has no YAML parser.** It imports node built-ins only, and adding a dependency to a file
that ships inside a plugin is a distribution problem, not just a package one. So every edit it makes
to a definition is line-oriented, and the definitions have to be written to make that safe.

**A command declared absent must remove a gate, not neutralise one.** `on_result` has to cover every
label a checker can produce, so a `command` gate cannot be turned off by editing a value — the whole
rule has to go. That is a structural edit, which is the hard case for a line-oriented tool.

**The previous rule is worth keeping.** The toolkit this replaces refused to invent a command:
*"If the project has not declared `commands.test`, `implement` fails its gate — we do not invent a
tautological command to fake it."* With commands baked into definitions rather than read from a
config, the failure shape changes from "not configured" to "somebody wrote `true`", and only the
run's own output can make that visible.

**Two files belong to the project.** `AGENTS.md` and `CLAUDE.md` usually exist and are hand-written.
Anything written into them has to be replaceable without touching the rest.

## Goals / Non-Goals

**Goals:**

- One command brings a project from nothing to runnable, and the same command upgrades it
- Nothing the project authored is ever overwritten
- The gates that run the project's checks actually run them
- What was created, refreshed and preserved is visible in the output, not inferred

**Non-Goals:**

- Not a package manager. Dependencies are checked and, with consent, installed by their own
  installers; nothing is vendored
- Not sprint or backlog state. Setup prepares the machinery; what work exists is separate
- Not validating subagent names. Decided earlier and unchanged: the engine cannot resolve them and
  neither can this

## Module Design

```
skills/genai-init/
  SKILL.md                       command: true
  scripts/init.mjs               was install-flow.mjs
  assets/
    workflows/genai-feature.yaml unchanged
    nodes/…                      unchanged, plus removable command-gate blocks
    openspec-schema/             the fork, shipped for installation
```

The script grows a phase before the definitions:

```
deps → openspec init → schema fork → fsx init → fsx skill install
     → CONTEXT.md → AGENTS.md / CLAUDE.md blocks → permissions.allow
     → definitions (with commands baked in)
```

Each item declares its own disposition rule rather than the script having a global policy, because
the rules genuinely differ: the schema fork is ours and refreshes; `CONTEXT.md` is theirs the moment
it has a line in it; the marked blocks are ours inside a file that is theirs.

### Removable gate blocks

A command gate is wrapped in literal markers so a line-oriented tool can delete it whole:

```yaml
  # {{CMD_TEST_BEGIN}}
  - rule_id: test_suite
    checker: { type: command, command: "{{CMD_TEST}}" }
    …
  # {{CMD_TEST_END}}
```

Given a command, the script substitutes and strips the marker lines. Given `none`, it deletes
everything between and including them. The alternative — parsing the YAML — needs a dependency; the
other alternative — a value that means "skip" — cannot exist, because `on_result` must cover every
label the checker can produce.

### Where the commands are remembered

In the installed definition, read back before it is overwritten. Not in a state file beside it: two
places holding the same fact disagree eventually, and the definition is the one the gate actually
uses. The read is the same marker-aware extraction, run against `.flow/nodes/<id>/node.yaml`.

## External Protocol

This change exposes no network interface. It consumes three external command surfaces and writes two
configuration formats.

| Surface | Used for | Failure handling |
|---|---|---|
| `openspec init`, `openspec/schemas/` | scaffolding and the template fork | absent binary → stop before writing anything |
| `fsx init`, `fsx skill install`, `fsx nodes/workflows` | the engine and the definitions | absent binary → stop; a running graph → refuse to edit, name the graph |
| `mdxv` | previewing the review document | absent → warn, continue; only one step needs it |

The two configuration writes:

- **`AGENTS.md` / `CLAUDE.md`** — a block between `<!-- genai:begin -->` and `<!-- genai:end -->`.
- **`permissions.allow`** — read-only git commands appended to the host's list. Mutating commands
  are deliberately not added: the point is to stop training people to approve without reading, and
  adding `git push` to an allowlist does the opposite.

## Database Design

This change does not touch a database.

## Non-functional Budgets

| Dimension | Budget | Where the number comes from |
|---|---|---|
| Compiled artifact count | 470 → 488 | the schema fork's six files, on three ends |
| Commands a person runs to set up | 6 → 1 | the five prerequisites plus the definition install |
| Subprocess count, first run | ~80 | ~3 per step × 23, plus one per external tool |
| Re-run cost | same | every step re-executes; idempotence is in what they do, not in skipping them |

The last row is deliberate. A run that skips work it thinks it already did is a run whose output
stops describing the current state, and that is the failure this whole design is arranged against.

## Security & Permissions

- **Dependencies are installed only with consent, one at a time, named.** A setup step that installs
  software silently is a supply-chain decision taken on someone's behalf.
- **`permissions.allow` gains read-only commands only.** Adding a mutating command would remove the
  interruption at exactly the point where it earns its cost.
- **Nothing here stores a credential.** `fsx skill install` and `openspec init` write files; the
  publish step's authentication is the project's own and this never reads it.
- **The baked commands are executed by the gate, with the project's shell.** Whoever supplies them
  is supplying something that will run — which is the same trust already given to the project's own
  test command, and the reason the run prints back exactly what it baked in.

## Observability

The run's report is the whole observability surface, and its shape is the requirement: every item
with its disposition, then the executors, then what is unguarded.

**What must be visible and is easy to lose:** a check with no gate. When a command is declared
absent, the run says which check is consequently not enforced. Without that line the project looks
fully gated and is not — and this is the exact shape of the failure the "no tautological command"
rule was written against.

**What stays invisible:** whether a baked command is honest. `echo ok` satisfies the schema, runs
clean, and proves nothing. The run prints each command back, which makes it visible to a reader and
to nobody else.

## Rollback & Migration

**Forward:** run it. On a project set up by the previous skill, it refreshes the definitions and
creates the items that skill never handled.

**Migration from `install-dev-workflow`:** the command name changes. Nothing is released, so the
cost is muscle memory. The old skill directory is removed rather than left as an alias — an alias
that silently does more than its name says is worse than a missing command.

**Rollback:** revert the plugin. What setup wrote into the project stays: the schema fork, the
marked blocks, the glossary. That is correct — they are the project's files now, and deleting them
on a plugin downgrade would be the setup step reaching back into work it does not own.

## Verification Carrier

`agent-driven`.

The scenarios are about what a script does to a filesystem under repetition, and the way to check
them is to run it twice against a project with hand-authored content and compare. There is no
assertion library for "the text outside the markers is byte-identical" that beats a checksum taken
before and after.

Concretely: a scratch project seeded with a hand-written `AGENTS.md` and a non-empty `CONTEXT.md`,
setup run twice, checksums compared; then a run with a command declared absent, checking the gate is
gone and the unguarded check is named; then a definition changed in the toolkit and setup re-run
without commands, checking they survived.

## Decisions

**D1 — One command, not two.** The skill this replaces argued that separating setup from install
kept diagnosis clear. Per-item disposition output buys the same clarity more cheaply, and the two-
command version costs an ordering a person has to remember and will eventually get wrong.

**D2 — Commands live in the definitions, not in a config file.** Alternative: a `genai/config.json`
the gates read, as the previous toolkit had. The gate cannot read it — `command` is a literal in the
definition and the engine executes it verbatim. A config file would be a second place holding the
fact, with only one of them load-bearing.

**D3 — Absent is declarable; missing is an error.** Three states, not two: given, declared absent,
not mentioned. The third stops the run. Silently skipping a gate because nobody said anything is how
a project ends up unguarded without a decision having been made.

**D4 — Marker blocks over a generated file.** Alternative: write `AGENTS.genai.md` and ask people to
include it. Rejected: nothing includes files in these formats, so it would be a file nobody reads.
Markers put the content where the reader already is, at the cost of an edit to a file we do not own
— which is what the byte-identical requirement is there to bound.

## Risks / Trade-offs

**A baked command can be a lie** → `echo ok` passes everything. The run prints each command back,
which is the only enforcement available to a tool that cannot judge whether a command is a real
test. Named here rather than left to be discovered.

**Marker blocks can be mangled by a hand edit** → someone deletes the closing marker, and the next
run's replacement has no end to find. Mitigated by treating an unclosed block as an error that stops
rather than a case to repair by guessing.

**The schema fork can drift from the checker** → the fork ships the template and the checker reads
its section list from that template, so within one installed version they agree. Across versions a
project that upgrades the plugin without re-running setup has an old template and a new checker.
Mitigated only by the refresh being part of the same command people already run.
