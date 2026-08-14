---
name: tdd
description: Run the red-green-refactor loop properly — write the failing test first, confirm it fails for the reason you expect, make it pass with the least code that could work, then refactor under a green bar. Carries per-toolchain guides for wiring and running the test command so the loop is real rather than described. Use whenever implementing behavior that should be tested, on "write tests for this", "do this test-first", "TDD it", "add coverage", or when a bug needs a regression test that provably fails before the fix. It applies to behavior meant to survive the session — code you intend to keep.
---

# Test-Driven Development

Tests verify behavior through public interfaces, not implementation details. One test, one implementation, repeat — never write all tests first.

## How to Use This Skill

1. Follow the workflow below — it applies to every language.
2. Identify the language in play and read the corresponding toolchain guide for test runner, config, and idioms.
3. Read common references as needed for deeper guidance on test quality, mocking, and design.

## Language Toolchain Routing

| Language | Reference | Default stack |
|----------|-----------|---------------|
| TypeScript | [references/typescript/guide.md](references/typescript/guide.md) | Vitest, `npm test` |
| JavaScript (plain JS, no TS) | [references/typescript/guide.md](references/typescript/guide.md) | Vitest — same runner and idioms, minus the type-level advice |
| React | [references/react/guide.md](references/react/guide.md) | Vitest + React Testing Library |
| Python | [references/python/guide.md](references/python/guide.md) | pytest, `pytest --cov` |
| Go | [references/go/guide.md](references/go/guide.md) | `go test`, table-driven tests |
| Rust | [references/rust/guide.md](references/rust/guide.md) | `cargo test`, `#[cfg(test)]` |
| Swift | [references/swift/guide.md](references/swift/guide.md) | Swift Testing / XCTest |
| Flutter / Dart | [references/flutter/guide.md](references/flutter/guide.md) | `flutter test` (unit + widget) / `dart test`, mocktail |
| React Native | [references/react-native/guide.md](references/react-native/guide.md) | Jest (`react-native` preset) + React Native Testing Library |

## Common References

| Topic | File | When to read |
|-------|------|--------------|
| Good/bad test examples, naming | [references/common/tests.md](references/common/tests.md) | Writing any test |
| When and how to mock | [references/common/mocking.md](references/common/mocking.md) | Deciding what to mock |
| Design for testability, refactor checklist | [references/common/design.md](references/common/design.md) | During REFACTOR phase |

Read only what is relevant — do not load all reference files at once.

---

## Workflow

### 1. Planning

- Identify the language and read the corresponding toolchain guide.
- Confirm what interface changes are needed.
- List behaviors to test, ordered by priority.
- **Approval fork.** The question is not "is a human watching" but **"has this plan been
  approved"** — three run contexts, three answers:
  - *Standalone, interactive* (user asked for TDD directly in the main session): approval
    is available and has not happened yet. Pause and get it before writing code.
  - *Downstream of an approval that already happened* (a spec or plan the user has
    already confirmed, and this implementation is what they confirmed): do not pause and
    re-ask — proceed straight to the Tracer Bullet. Asking again for consent already given
    reads as not having been listening.
  - *Standalone, non-interactive* (CI, a batch job, a background agent with no one to ask):
    approval has not happened and **cannot** be obtained. Do not treat silence as consent
    and do not invent a checkpoint that nobody can answer. Write the plan out in full,
    state plainly that it is unapproved and why, and **return it as the deliverable** —
    the plan is what the next interactive turn approves. Write no production code.

### 2. Tracer Bullet

Write ONE test, make it pass, refactor if needed. This proves the path works end-to-end: test runner configured, imports resolve, assertions execute. If the project has no test infrastructure yet, set it up now using the toolchain guide.

**Create the module stub first.** The loop below forbids a RED that is an import error, but the very first test imports a module that does not exist yet — so obeying both rules requires a stub. Write the module with its exported symbols present and each body failing loudly (`throw new Error("not implemented")`, `panic("not implemented")`, `raise NotImplementedError`), then write the test. Now the first RED is a real assertion failure against a real symbol, which is what makes it evidence. An empty file is not enough: it produces the import error the rule rejects.

### 3. Red-Green-Refactor Loop (autonomous)

For each remaining behavior:

```
RED:      Write next test → run tests → it FAILS for the expected reason
          (behavior is missing — NOT a typo / import / compile error; if it errors
          instead of failing, fix the test first, then re-run until it fails cleanly)
GREEN:    Write minimal code to pass → run tests → all pass, output pristine
          (no new errors or warnings)
REFACTOR: Check candidates (see references/common/design.md) → run tests → all pass
```

**Rules:**
- One test at a time. Never batch-write tests.
- **Watch it fail for the right reason** — *inside this loop*, where the behavior under test
  is by construction not yet built. A test that passes immediately, or that fails with an
  error instead of the expected assertion, proves nothing here: if you didn't watch it fail
  for the expected reason, you don't know it tests the right thing. Fix the test until it
  fails cleanly before writing any production code. (Outside the loop — characterization
  tests over code that already works — first-run-green is the *expected* result, not a
  failure of the test. See "Retrofitting tests onto existing code" below.)
- **A case that is already green late in the loop is not a defect.** Once the
  implementation converges, further edge cases are often satisfied by code that is already
  there — that is "Write only the code needed to pass" working, not a test that failed to
  fail. Nothing needs fixing: keep the test, and note in the completion report that it
  passed on first run. What the rule above forbids is *starting* a behavior green, which
  means the behavior was already implemented and you are no longer driving it with tests.
- Write only the code needed to pass the current test — no speculative features.
- Never refactor while RED. Get to GREEN first, then improve.
- Each loop step runs the **scoped** suite for the module/package under work (the
  toolchain guide gives the filter syntax) — not just the new test, and not the whole
  project. Coverage runs once at the Coverage Gate, over the modules this task touched. The
  **whole-project** suite is not yours to run at all: it is paid once per iteration, on the
  integrated tree, by whatever gate the project runs there. Running it here just pays it N times.

### Verification Discipline (every loop step)

- **One verify command per step.** Run the toolchain's test command once; never chain
  redundant passes (typecheck → test → lint) over the same tree in the inner loop.
  What the test command does and does NOT subsume differs by toolchain (`cargo test`
  type-checks; Vitest/Jest do not — there `tsc --noEmit` is a separate task-boundary
  pass): the toolchain guide's **Verification Discipline** section is authoritative.
- **Scope the inner loop** to the file/module/package under work via the toolchain's
  filter syntax. Where the repo has a scoped gate target (`check-diff` — changed packages plus
  their reverse dependencies), that is the one command to run; see the `devops-guideline` skill.
- **Coverage runs once, at the Coverage Gate (Step 4)** — never in the inner loop.
- **Record the final verification** (exact command, real exit code, commit SHA) in the
  completion report — downstream roles (code review, merge gate) consume the record
  instead of re-running it.

### 4. Coverage Gate (mandatory)

Run the suite with coverage enabled (see your language's toolchain guide for the command), **scoped to the modules this task touched**. This is the task's **single** instrumented run — the inner loop never runs coverage, and downstream roles read this recorded result rather than re-running it. Scoping it is not a weakening: both targets below are about *this task's* code, and a whole-repo percentage answers a different question (one that belongs to the integration boundary, where the full suite runs once). Two targets, both mandatory:

- **Interface coverage: 100%.** Every public/exported interface — exported functions, public methods/classes, API endpoints, the module's outward contract — must be exercised by at least one test. No public surface ships untested. Coverage tools report line/function coverage, not interface coverage (function metrics also count private functions), so judge this directly: enumerate the module's exported symbols and confirm each has at least one test that calls it. Where the toolchain reports per-function coverage (e.g. Istanbul/Vitest `% Funcs`), use it as a proxy, but the gate is the exported surface, not the proxy number.
- **Line coverage: >= 90%.** If below, add tests for impactful uncovered paths — not trivial tests to inflate numbers.

### 5. Completion (pause to report)

- Coverage summary (line % per module touched, and across them; interface coverage). Say what the
  number covers — a figure for this task's modules read as a whole-repo figure is a false claim.
- List of new/modified tests
- Deferred behaviors (if any)
- Coverage gate: PASS/FAIL — interface coverage (must be 100%) and line coverage (actual %, must be >= 90%)
- Verification record: exact command(s), real exit code, commit SHA

---

## Retrofitting tests onto existing code

"Add tests to this module" / "get coverage up on code that already works" is a different job
from the loop above, and running the loop's rules against it produces nonsense — every
characterization test is green on the first run, and the loop reads that as proof of nothing.
It is the same work `smell-scan` calls **behaviour pinning**; use this section for both.

**It is not TDD, and saying so matters.** TDD's guarantee comes from the test having failed for
a reason you watched. A test written against working code has no such guarantee — it inherits
whatever the code does. What it buys instead is a *safety net*: a tripwire that fires when a
refactor changes behavior. Claim that, not TDD.

Three rules replace the red-green-refactor loop:

1. **Write the expected value before you run it.** This is the only surviving piece of the
   discipline, and it is the whole point. Read the code, decide what it *should* return, write
   that literal into the assertion, *then* run. Reading the output first and pasting it in
   produces a test that passes by construction and pins bugs as if they were requirements.
2. **First-run green is the expected outcome**, and it is the evidence you wanted: behavior
   matches intent. First-run red is the interesting case — see the next rule.
3. **When the test disagrees with the implementation, pin the current behavior and record a
   finding — do not fix the implementation.** You were asked for a safety net, and changing
   behavior while building one destroys the baseline it exists to protect. Write the test
   against what the code *does*, mark it clearly (a `NOT endorsed — see finding #N` comment on
   the assertion), and report the discrepancy separately for a human to rule on. A fix, if one
   is warranted, is its own change with its own RED test.

**Coverage Gate, adapted.** Line coverage ≥ 90% and 100% interface coverage still apply, but
existing code can contain genuinely unreachable branches — TDD-built code cannot, since every
line was forced into existence by a test. When you find one, do not write a contorted test to
reach it. Report it as a **deletion candidate** with the reason it is unreachable, and note the
gap in the completion report. Dead code you cannot reach is a finding, not a coverage problem.

## Integration

- **Directly**: someone asks for test-first work, or a bug needs a regression test.
- **As part of a larger implementation**: the behavior to build is already agreed, and this
  is the loop that builds it.
