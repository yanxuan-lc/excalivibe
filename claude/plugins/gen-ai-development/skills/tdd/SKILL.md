---
name: tdd
description: Test-driven development with a red-green-refactor loop. The workflow is language-agnostic, with toolchain guides for TypeScript, JavaScript, React, React Native, Python, Go, Rust, Swift, and Flutter/Dart. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", asks for unit or regression tests around a change, or says "write tests first". Also triggered when the developer agent enters the implementation phase via opsx:apply. This is development-time unit/widget testing — running e2e suites against an already-running app is the e2e-test skill.
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
- **Approval fork** — two run contexts, two rules:
  - *Standalone* (user asked for TDD directly in the main session): pause and get
    user approval before writing code.
  - *Within OpenSpec apply* (developer agent, spec already user-confirmed at the
    human-confirm checkpoint): the approval has already happened — do NOT pause; proceed
    straight to the Tracer Bullet.

### 2. Tracer Bullet

Write ONE test, make it pass, refactor if needed. This proves the path works end-to-end: test runner configured, imports resolve, assertions execute. If the project has no test infrastructure yet, set it up now using the toolchain guide.

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
- **Watch it fail for the right reason.** A test that passes immediately, or that fails
  with an error instead of the expected assertion, proves nothing. If you didn't watch it
  fail for the expected reason, you don't know it tests the right thing — fix the test
  until it fails cleanly before writing any production code.
- Write only the code needed to pass the current test — no speculative features.
- Never refactor while RED. Get to GREEN first, then improve.
- Run the full test suite after every change, not just the new test.

### 4. Coverage Gate (mandatory)

Run the test suite with coverage enabled (see your language's toolchain guide for the command). Two targets, both mandatory:

- **Interface coverage: 100%.** Every public/exported interface — exported functions, public methods/classes, API endpoints, the module's outward contract — must be exercised by at least one test. No public surface ships untested. Coverage tools report line/function coverage, not interface coverage (function metrics also count private functions), so judge this directly: enumerate the module's exported symbols and confirm each has at least one test that calls it. Where the toolchain reports per-function coverage (e.g. Istanbul/Vitest `% Funcs`), use it as a proxy, but the gate is the exported surface, not the proxy number.
- **Line coverage: >= 90%.** If below, add tests for impactful uncovered paths — not trivial tests to inflate numbers.

### 5. Completion (pause to report)

- Coverage summary (overall line % and per-module; interface coverage)
- List of new/modified tests
- Deferred behaviors (if any)
- Coverage gate: PASS/FAIL — interface coverage (must be 100%) and line coverage (actual %, must be >= 90%)

## Integration

- **Standalone**: User triggers directly for TDD workflow.
- **Within OpenSpec**: Referenced by developer agent / `opsx:apply` during implementation phase.
