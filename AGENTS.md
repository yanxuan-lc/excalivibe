# AGENTS.md — ExcaliVibe

Facts and conventions for every agent working in this repository (Claude Code, Codex, Cursor,
opencode, …). The architecture is in [README.md](./README.md); this file carries only what you have
to know **before touching anything, and would get silently wrong otherwise**.

## The one-sentence fact

One source tree compiles to three ends. A capability is written once under
`src/plugins/<name>/`, and `make build` emits a Claude plugin, a Codex plugin and the
vendor-neutral `common/` layout together. The ends are `claude` / `codex` / `common`.

## Hard rules

**`claude/`, `codex/`, `common/` and both marketplace manifests are build artifacts — not one
hand-written file among them.** Change `src/`, then `make build`. They are committed because the
Claude marketplace installs straight from the repository, so a clone has to contain a finished
`claude/plugins/<name>/`. Hand-editing an artifact is caught by the first gate in `make check`.

**A skill never names its caller.** A description answers *when should this be used* and never
*who will use it*. A skill saying `invoked by name from the developer agent` fails three ways at
once: it does not trigger when a person asks for the same thing directly (it describes a dispatch,
not a situation), it needs a rewrite the moment that agent is renamed, and it inverts the
dependency so the reusable thing depends on the specific one. The arrow points one way —
**an orchestrator names the skills it calls; a skill never names its orchestrator.**

**Everything a model reads is English, and `verify-no-cjk` enforces it.** That is all of `src/`
plus the three agent-facing files at the root — `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`. A single CJK
character fails the gate, comments included. Human-facing docs are the other kind and stay out of
scope: `README.md` is English with `README.zh-CN.md` beside it, and the Chinese one is Chinese by
design.

**A human-facing document is bilingual, one pair of files per directory.** `<name>.md` in English and
`<name>.zh-CN.md` beside it — the root READMEs, and every level of `docs/` as `README.mdx` +
`README.zh-CN.mdx`. Three rules come with the pairing:

- **The two must correspond.** Change one, change the other in the same commit. Nothing checks this,
  and a pair that has drifted is worse than a single file, because a reader cannot tell which half is
  current.
- **The English file is the one links land on.** A directory link resolves through that directory's
  `README.mdx` in the `mdxv` preview, so a Chinese page must link the explicit `.zh-CN.mdx` path to
  keep a reader inside their language.
- **`verify-no-cjk` covers none of it.** Not `docs/`, not either README. The gate's corpus is `src/`
  plus the three agent-facing root files, so which language a human-facing file is written in is a
  decision this rule states and nothing enforces.

The root is listed file by file in `scripts/verify-no-cjk.ts` (`AGENT_FACING`), because both kinds of
document live there and no directory rule separates them. **A fourth agent-facing root file has to be
added to that list by hand** — deliberate friction, and cheaper than an exclusion list that grows
with every new doc.

Exceptions are registered in `src/cjk-exceptions.json`, keyed by path **relative to the repository
root**, with a reason. There are two today, both skill descriptions carrying Chinese trigger
phrases — **the description is the routing surface**, so a Chinese request reaches an English
description only if the phrasing it would arrive in is present in it. `evals/` is exempt as a
directory, because trigger fixtures are Chinese on purpose and never ship. **A stale exception fails
too**, so delete the entry when the Chinese goes away.

**`genai-dev-flow` has rules of its own, in `src/plugins/genai-dev-flow/AGENTS.md`.** Read it before
touching a step definition or a gate evaluator. The shortest of them, because it is the easiest to
break by accident and no gate catches it: **every check a step makes is one atom behind
`node .flow/genai/check.mjs <atom>`, and never shell inside a `node.yaml`.**

**There is exactly one way to change a version:**
`make bump PLUGIN=<name> LEVEL=<major|minor|patch|x.y.z>`. Editing `version` in `plugin.json` by
hand misses the places it has to stay in step with.

Run `make check` before committing — seven gates (`verify-build`, `typecheck`, `verify-json`,
`verify-skills`, `verify-variants`, `verify-no-cjk`, `verify-no-nul`), each runnable on its own.
There is no runtime dependency: Node ≥22.18 strips types at load, so `node scripts/build.ts` runs
as it is.

## The three description slots

A description is the **routing surface** — the host reads it to decide whether to pull the
capability into context at all. Recall differs between models, and wording that triggers reliably
on one may not trigger at all on another. So this is the one field **expected to be tuned per
end**, and the frontmatter opens three slots for it:

| Slot | Used by | Purpose |
|---|---|---|
| `description:` | **common**, and the global fallback | neutral wording, tuned for no single host |
| `description-claude:` | claude | overrides outright, tuned for Claude's recall |
| `description-codex:` | codex | overrides outright, tuned for Codex's recall |

The resolution lives in `descriptionFor()` in `src/common.ts`: use `description-<end>` if present,
otherwise fall back to `description`. **There is no `description-common:` slot** — common is the
vendor-neutral end, so the untuned fallback *is* its description. Writing one would still resolve
(the lookup is generic), but it would mean the fallback has stopped being neutral; tune the two
named ends and leave `description` as the thing they diverge from.

Of the 29 skills today, 23 carry all three slots with identical content — a deliberate starting
point: lay the slots down first, tune per end later. The other six (`genai-dev-flow`'s) carry only
`description:` and take the fallback. **Per-end tuning must be measured**, not felt — see the next
section.

Two things to get right while writing one:

- **In an agent description, write `\n` as `\\n`.** Inside a double-quoted YAML scalar `\n` parses
  as a real newline, while Claude's agent frontmatter convention wants the literal `\n` to survive
  in the value. Every existing agent's `Examples:` block is written this way; copy it.
- **The Codex artifact is TOML, and its values are produced by `JSON.stringify`.** That is why
  `descriptionValueFor()` reads the **parsed** map rather than the raw text — feeding it raw wraps
  an already-quoted string a second time and ships
  `description = "\"Dispatch this agent…\""`. The comment on `descriptionValueFor()` in
  `src/common.ts` spells the distinction out; do not swap the two functions.

## How to write a description

Every description in the repository follows the three rules below. Match their shape.

**Open with the kind of judgment it makes, not with the subject noun.** Every description here
starts with a verb — `Decide how to branch…` (`vcs-workflow`), `Answer "how should this be written
here"…` (`coding-guideline`), `Sweep a codebase…` (`smell-scan`). A noun-led opening fails in both
directions: any request that merely brushes past the noun without needing the judgment triggers it,
while the questions that genuinely need it often do not contain the noun at all ("should these be
two modules or one"). Demote the subject noun to recall vocabulary further down.

The cost, stated: a judgment-led opening also pulls in neighbouring **conceptual** questions. It is
a trade, not a free win.

**Write the boundary as what it is, not as a list of exclusions.** Look at how
`coding-guideline` ends: `It supplies the judgment about how code ought to look; carrying out a
change whose shape is already decided is separate work.` The boundary is folded into the identity
rather than listed as "not for X". **Enumerating what you cover is safe; enumerating what you do not
is not** — naming a scenario does not reliably stop it from triggering there, and may make it more
salient instead.

**Check the instrument before tuning against it.** Trigger measurement has no internal ground
truth: "did not trigger" and "the harness did not see it trigger" produce identical output, so
**a broken ruler always reads like good news**. The harness is `scripts/eval-triggers.ts` and the
fixtures live in seven skills' `evals/` directories (`make eval` spends a real model call). Before
a batch, run one case and read its full event stream; audit run by run rather than trusting the
summary line.

## Positive form

**Every instruction a skill gives says what to do.** The description rule above — write the boundary
as what it is — is this rule applied to the routing surface, and it holds for the body just as much:
`read the machine-readable reporter` rather than "do not scrape the printed output", `serve the
reader a directory holding this round's documents and nothing else` rather than "do not point the
preview at the change directory". A prohibition spends its most-read words on the behaviour you do
not want and leaves the reader to derive the one you do; it also puts the unwanted scenario in front
of a model that is deciding what to do, and on descriptions an exclusion naming a scenario went on
triggering there in every case measured.

**The failure that motivated the rule stays** — as the reason, after the instruction, where it says
what the wrong move costs rather than standing in for the ask.

**An exempted prohibition carries its reason in the text.** Where the prohibition *is* the content —
a hard boundary whose consequence is mechanical and irreversible, such as `a round may not widen the
gate it is measured by` or `never shell inside a node.yaml` — the negative carries the force and
keeping it is right, and the cost that makes it worth keeping goes on the page beside it. A
prohibition a reader has to take on authority is the one shape this rule exists to keep out, so an
exemption is exactly one whose cost you can state. Nothing checks any of this: it is a habit.

## Layout

```
src/
  common.ts              end definitions, TIER table, variant rendering, frontmatter and
                         per-end description resolution
  marketplace.json       the shared source of both marketplace manifests
  variant-exceptions.json  registered deliberate single-end differences
  cjk-exceptions.json    registered src files allowed to contain Chinese
  plugins/<name>/
    plugin.json          one manifest, compiled into each end's own shape
    skills/<name>/SKILL.md   routing surface + trunk
    agents/<name>.md         one body, three serializations
    hooks/**                 Claude only
scripts/
  build.ts               the compiler
  check-skills.ts / verify-variants.ts / verify-json.ts / verify-no-cjk.ts   the four gate scripts
  bump.ts                the only entry point for versions
  eval-triggers.ts       building and scoring the trigger eval
  ui.ts                  the single visual language for terminal output; the Makefile uses it too
docs/tech/               as-built reference, one area per thing you might change
```

**This file is what you must not get wrong; `docs/tech/` is how it works.** Before changing the
compiler read [`docs/tech/artifact-contract/`](./docs/tech/artifact-contract/README.mdx), before
touching a gate read [`docs/tech/toolchain/`](./docs/tech/toolchain/README.mdx), and before touching a
step definition read [`docs/tech/flow-contract/`](./docs/tech/flow-contract/README.mdx). **No gate
checks that tree** — not its links, not its language, not whether it still matches the code it names —
so update it in the same change as the code.

## Terminal output

Every build and verify script, and every Makefile recipe, writes through `scripts/ui.ts`. There
are three roles and three shapes. Do not mix them:

```
  ~ claude/…/SKILL.md          detail — indent 2, dim, glyph-marked. Evidence: skimmable, truncatable
                                        + added · ~ changed · − removed · ? unexplained
✓ compiled — 56 change(s)      result — flush left, coloured. The conclusion: one line, blank line above
→ `make build` restores them   next   — flush left, dim. What to do now; always last
```

**`✓` and `✗` belong to the conclusion line only.** An evidence line starting with `✗` would share
its indent, colour and glyph with the line that summarizes it, which makes the one line you should
read first the hardest to pick out. Evidence uses a glyph for *what kind of thing this is*, not for
right or wrong.

Colour degrades on its own: piped output and CI logs lose it, and `NO_COLOR` is honoured. **Do not
write escape codes outside that module** — `make help` is the sole exception, since it lays out a
table in awk and owns its own formatting.
