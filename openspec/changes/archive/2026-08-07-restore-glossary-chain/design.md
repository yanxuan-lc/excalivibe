## Context

See proposal.md — Why. Two facts about the previous implementation shape what can be carried over.

**The check used to be a script and now cannot be.** The old toolkit shipped an engine with a
`lint glossary` command, and the skill's opening blockquote pointed at it: *"the verdict comes from
the script, not from good intentions"*. That engine is gone. The replacement engine (`fsx`) runs
gate commands, but a glossary comparison is a semantic judgement — deciding whether `clientId` names
the concept the glossary calls `customer` is not something a regex settles. So the migrated skill is
a procedure a model follows, and the honest framing of that difference is part of the change.

**The seeding side lost its owner.** The old `grill` wrote canonical terms into `CONTEXT.md`; the
migrated `grill` does not, and nothing else does either.

## Goals / Non-Goals

**Goals:**

- A conformance procedure that scopes to one bounded context, classifies findings into two kinds,
  and states its own limits
- A write side, so the glossary is not permanently empty
- The migrated text says only true things about how it is enforced

**Non-Goals:**

- No script, no gate, no node. The check is composed by whoever is naming or auditing terms, not
  inserted as a stage everyone must pass
- Not changing `grill`. It owns the interrogation method; where the artifact lands is the calling
  step's business, the same split already used for `BRIEF.md`
- Not authoring any project's glossary content

## Module Design

One skill directory added under `dev-toolkit`, no references or scripts:

```
src/plugins/dev-toolkit/skills/glossary-conformance/SKILL.md
```

One line of instruction added to `dev-workflow`'s `genai.brief` brief.

The dependency the skill declares runs one way and stays inside `dev-toolkit`: it points at
`coding-guideline` for casing and structural naming, to keep "is this the agreed word" separate from
"is this spelled the way this project spells things". It names no caller.

**Why the write side is instruction and not a declared output.** `genai.brief` could declare
`CONTEXT.md` as a second artifact and have a gate measure it. It must not:

- The file accumulates across changes. Two concurrent graphs both declaring it would each measure a
  file the other edits, and the freshness gates would reject work that never changed — the same
  interference the per-change `{{vars.change}}` locators exist to avoid.
- Most changes coin no new term. A gate demanding the file be present-and-changed would fail the
  common case, and a gate demanding only presence proves nothing.

## External Protocol

This change exposes no external interface. It adds prose a model reads.

The one interface-shaped thing is the report the check emits, and that is specified in
`specs/glossary-conformance/spec.md` rather than here — it is observable behaviour, so it belongs
where it survives archive.

## Database Design

This change does not touch a database.

`CONTEXT.md` is a flat text glossary in the repository, not a store: term, one-line meaning, and
optionally declared aliases and forbidden forms. No schema, no migration, no index.

## Non-functional Budgets

| Dimension | Budget | Where the number comes from |
|---|---|---|
| Compiled artifact count | 411 → 414 | one new SKILL.md, compiled to three ends |
| `genai.brief` brief length | +2 lines | one instruction; the brief stays under the length the frontmatter check enforces |
| Check runtime | not budgeted | it is model work whose cost scales with the change's diff, not a command with a measurable wall clock |

The last row is a deliberate absence rather than an oversight: putting a second number there would
invite comparing against it, and nothing produces one.

## Security & Permissions

No authentication, permission, or sensitive-data surface changes.

One property worth naming: the check reads source and writes a report. It never edits an identifier
to make itself pass — resolving a finding is the caller's decision, and a checker that also repairs
is measuring its own work next time.

## Observability

The check's only observable is its report, and the requirement that a clean report restates its own
limit is what keeps it readable later. There is no log, metric, or health check — nothing runs
unattended.

**What stays invisible, stated so it is not assumed otherwise:** nothing records whether the check
was ever run for a given change. It is composed on request. If a later change wants that guarantee,
it needs a node and a gate, which this change deliberately does not add.

## Rollback & Migration

**Forward:** add the skill, add the brief instruction, `make build`, commit.

**Rollback:** delete both, rebuild. Nothing depends on them — no node references the skill, no gate
measures `CONTEXT.md`. A project that already grew a `CONTEXT.md` keeps it; it is an ordinary file
in their repository and the tooling's absence does not invalidate it.

No back-fill. Existing projects start with an empty or missing glossary, and the skill's own
"no glossary found, stop" path is the correct behaviour there rather than an error state.

## Verification Carrier

`agent-driven`.

The scenarios describe judgements — whether an identifier names a domain concept, whether two words
denote the same thing — and no assertion library settles those. Writing test code for them would
produce a suite that tests a mock of the judgement rather than the judgement.

Concretely: acceptance walks the eight scenarios against a scratch fixture holding a small
`CONTEXT.md` and a handful of identifiers chosen to hit each classification, plus the two-context
and no-glossary cases.

## Decisions

**D1 — The skill is composed, not staged.** Alternative: a `genai.glossary` node with a gate. Naming
consistency is something you do while writing the spec and while reviewing the code, not a separate
checkpoint everyone queues for. A node would turn a habit into a toll booth, and the gate could only
check that a report file exists — which proves nothing about whether the words line up.

**D2 — `grill` is left alone; the instruction goes in the calling step's brief.** Alternative:
restore the seeding section into `grill`, as the previous toolkit had it. That arrangement existed
because there was no node layer to hold the artifact. There is one now, and the split is already
settled for `BRIEF.md`: the skill owns the method, the step owns where output lands. The cost is
that invoking `grill` outside a flow no longer seeds the glossary — acceptable, since the check is
scoped to a change's specs, tests and code, which only exist inside one.

**D3 — The "machine-enforced" claim is removed rather than softened.** The old text opened by
asserting the verdict came from a script. Keeping any version of that sentence would misdescribe
what now happens, and this is precisely the failure the old blockquote itself complained about —
three documents calling something machine-enforced while no script existed.

## Risks / Trade-offs

**The glossary stays empty in practice** → the write side is one instruction inside one step's
brief, and a model that skips it produces no error. The check's own "no glossary found, stop" path
keeps that from becoming a false pass, but it does mean the capability can sit unused without
anything noticing. Accepted: the alternative is a gate, rejected in D1.

**Two people disagree about whether a word names a domain concept** → the classification boundary is
judgement, and the skill draws it with examples rather than a rule. A finding wrongly excluded is
invisible. Mitigated only by the report naming the surfaces it searched, so a reader can tell
"not found" from "not looked for".
