## Context

See proposal.md — Why. Three facts shape the approach.

**The engine's canonical form is block style.** `fsx init`'s scaffold writes:

```yaml
executor:
  protocol: main
```

We match it rather than the equivalent flow style, so a reader comparing our definitions against a
freshly scaffolded one sees the same shape.

**The installer extracts the executor with a line-oriented regex** — `install-flow.mjs:142`,
`/^executor:\s*(\S+)$/m`. Against the new form it captures nothing useful. The script has no YAML
parser: it imports only `node:fs`, `node:os`, `node:path`, `node:child_process`, `node:url`.

**`make check` cannot see this class of breakage.** It verifies our compile is in sync with the
source and that frontmatter is well-formed. The engine's contract is not something it models, so
the artifacts read as healthy while being unloadable. That gap outlives this change — see Decisions.

## Goals / Non-Goals

**Goals:**

- Fourteen shipped definitions load under the current engine contract — `fsx check` exits 0 against
  a fresh install
- The installer's executor summary survives, still reading as a list of names a human must verify
- `install-dev-workflow/SKILL.md`'s executor table describes what the files now say

**Non-Goals:**

- No node added, removed, split, or re-scoped; no gate rule, locator, input or output touched. The
  diff is one field per file
- Not the three-segment workflow split, the delivery segment, `genai-init`, or intent routing —
  each is its own change (`docs/design/dev-workflow-intent-flows.md` §9)
- Not teaching `make check` about the engine's contract. Considered and rejected; see Decisions D3

## Module Design

This change adds no module and moves no boundary. It changes one field in fourteen data files, one
extraction site in one script, and one table in one document.

One responsibility does move, and it is the only judgment in the change: **who parses the executor
declaration**. Today the installer parses its own asset. After this change it asks the engine.

```
before   assets/nodes/*/node.yaml ──regex──> installer ──> summary
after    assets/nodes/*/node.yaml ──> fsx nodes new/edit ──> .flow/
                                                 │
                                      fsx nodes --json ──> installer ──> summary
```

The rewritten summary reports what actually landed rather than what was about to be sent, which is
what its accompanying warning has always been about.

## External Protocol

This change exposes no interface of its own. It *consumes* one — the engine's node-declaration
contract — and the mapping below is the whole of the change's payload.

Three protocol variants are in play. `main` takes no `params` (the schema is strict, so declaring
any is an error); the other two require theirs:

```yaml
executor:                    executor:                    executor:
  protocol: main               protocol: subagent           protocol: human
                               params:                      params:
                                 name: planner                channel: stdout
```

| Step | Before | After |
|---|---|---|
| `genai.brief` | `main` | `protocol: main` |
| `genai.arch-gate` | `human` | `protocol: human`, `channel: stdout` |
| `genai.spec` | `planner` | `protocol: subagent`, `name: planner` |
| `genai.review-doc` | `planner` | `protocol: subagent`, `name: planner` |
| `genai.spec-review` | `arch-reviewer` | `protocol: subagent`, `name: arch-reviewer` |
| `genai.implement` | `developer` | `protocol: subagent`, `name: developer` |
| `genai.code-review` | `code-reviewer` | `protocol: subagent`, `name: code-reviewer` |
| `genai.e2e-script` | `e2e-author` | `protocol: subagent`, `name: e2e-author` |
| `genai.e2e-run` | `e2e-runner` | `protocol: subagent`, `name: e2e-runner` |
| `genai.a11y` | `a11y-runner` | `protocol: subagent`, `name: a11y-runner` |
| `genai.security` | `security-runner` | `protocol: subagent`, `name: security-runner` |
| `genai.perf` | `perf-runner` | `protocol: subagent`, `name: perf-runner` |
| `genai.diagnose` | `debugger` | `protocol: subagent`, `name: debugger` |
| `genai.release-prep` | `release-coordinator` | `protocol: subagent`, `name: release-coordinator` |

`channel: stdout` is the only legal value the engine defines. Its meaning is "the driving agent's
normal output to the user is the notification" — not an unimplemented slot.

The three protocols this change does not use — `command`, `acp`, `a2a` — all delegate to another
agent through a registered adapter. None of them runs a shell script, so none is a candidate for
the delivery-segment steps that a later change adds.

## Database Design

This change does not touch a database. The plugin ships files; it has no persistent store.

## Non-functional Budgets

| Dimension | Budget | Where the number comes from |
|---|---|---|
| Compiled artifact count | stays 411 | no file added or removed; only contents change |
| `make check` runtime | unchanged | same file count, same passes |
| Installer subprocess count | +1 | one `fsx nodes --json` after the install loop, replacing an in-process regex |

The installer already spawns roughly three `fsx` calls per step. One more call in total is inside
the noise, and it is the price of not keeping our own parser for someone else's format.

## Security & Permissions

No authentication point, permission model, or sensitive-data path changes.

Two properties worth stating because they are easy to assume were fixed here and were not:

- **Nothing validates that the named subagents exist.** The engine does not own subagent definitions
  and cannot resolve them; a renamed or uninstalled agent still surfaces only when a dispatch fails.
  The new contract makes the *protocol* checkable, not the *name*. The installer's warning to that
  effect stays, and stays accurate.
- **No new trust boundary.** Reading the summary from `fsx nodes --json` trusts the same binary the
  installer already hands every definition to.

## Observability

The installer's printed report is the only observable this change has, and it must keep saying three
things: which executor each step requires, that nothing validates those names, and how to check them
(`fsx check`, `fsx nodes -w genai`).

One behaviour changes and must be stated rather than discovered: **under `--dry-run` the executor
summary is no longer available**, because nothing was installed for `fsx nodes --json` to read. The
script prints that the summary was skipped and why. Silently printing an empty list would read as
"no executors required", which is the failure mode this whole change is about.

## Rollback & Migration

**Forward:** edit source → `make build` → commit. Anyone with an existing install re-runs the
installer, which refreshes definitions in place.

**Rollback:** reverting the commit alone restores definitions the current engine rejects, so a
coherent rollback also downgrades `fsx` below `d64d37b`.

That asymmetry is not worth designing around here. **Neither this plugin nor `fsx` has been
released**, so there are no installs in the wild to strand — the only affected working copy is a
developer's own, and the fix there is to move forward rather than back. There is no data to
back-fill; the definitions are the whole payload.

## Verification Carrier

`existing-suite`.

This change adds no acceptance scenarios (`skip_specs: true`), so there is nothing to script and
nothing for an agent to walk. Acceptance is two existing commands:

- `make check` — the compile is in sync across all three ends
- `fsx check` in a throwaway project after running the installer — the engine accepts all fourteen

The second is not part of `make check` today. See Decisions.

## Decisions

**D1 — The executor summary comes from `fsx nodes --json`, not from a stricter regex.**
Alternatives: (a) widen the regex to match the block form; (b) list the executors in
`assets/workflow.yaml`. (a) keeps a parser for a format we do not own, and the next contract change
breaks it the same silent way. (b) is a second copy of a fact that already exists in the definitions,
and two copies disagree eventually. Asking the engine costs one subprocess and cannot drift.

**D2 — Block style, matching the scaffold.** Flow style (`executor: {protocol: main}`) is equivalent
YAML. The scaffold `fsx init` writes uses block style, and a reader comparing our definitions to a
freshly scaffolded one should not have to notice that the difference is cosmetic.

**D3 — `make check` is deliberately *not* taught the engine's contract.** A `make check-flow` that
installs into a temporary project and runs `fsx check` was considered and rejected. Engine-contract
drift has two sources and a pre-commit gate is the wrong instrument for both:

- *We author a bad definition.* Already caught — the installer writes through `fsx nodes edit`,
  which validates before the write, and every change touching definitions carries install-then-
  `fsx check` in its acceptance (tasks 4.2 here).
- *`fsx` changes its contract.* Not triggered by our commit. It happens between commits, so the gate
  fires at a time unrelated to the cause and fails a change that has nothing to do with it. This
  very breakage was found the right way instead: the engine was upgraded, and the next command run
  against it failed loudly.

What the gap actually requires is that any change touching node definitions keeps install-then-
`fsx check` as an acceptance step. That is a habit enforced per change, not a gate — and making
`fsx` a hard dependency of the pre-commit gate would buy nothing for it.

## Risks / Trade-offs

**The same class of breakage can recur** → `make check` does not see engine-contract drift, by
decision (D3). The detection point is the next install — during a change's acceptance, or the first
command run after an `fsx` upgrade. Naming it here so the next contract change is understood as
expected cost rather than a surprise.

**A local `.flow/` is stale until re-run** → the installer is idempotent and refreshing is the
documented upgrade path, but nothing notifies a project that its `.flow/nodes/` is behind. Accepted:
the cost is one `fsx check` that names the offending file, and with nothing released the blast
radius is a developer's own checkout.

**`--dry-run` loses information** → the executor summary is unavailable there. Accepted over the
alternative of keeping a regex solely to serve the dry run, which reintroduces exactly the fragility
D1 removes.
