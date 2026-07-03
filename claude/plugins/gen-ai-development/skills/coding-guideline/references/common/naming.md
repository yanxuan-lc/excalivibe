# Naming Conventions

Cross-language naming principles. Each language section below maps these to its idiomatic casing.

## Core Principles

- **Names reveal intent.** A reader should understand what a variable holds or what a function does without reading its implementation. `remainingRetries` beats `r`; `fetchUserProfile` beats `doStuff`.
- **Scope determines length.** Short names (`i`, `n`, `err`) are fine for tiny scopes (loop counters, inline lambdas). Longer scopes need longer names.
- **Domain language wins.** Use terms from the problem domain, not the solution domain. `invoice` not `dataObject`; `publishEvent` not `callHandler`.
- **Boolean names state the condition.** `isVisible`, `hasPermission`, `canRetry` — the name reads as a yes/no question.
- **Avoid meaningless prefixes/suffixes.** `userData` → `user`; `resultList` → `results`; `strName` → `name`.

## Casing Quick Reference

| Concept | TypeScript / React | Python | Go | Rust | Swift |
|---------|-------------------|--------|----|------|-------|
| Type / Class | `PascalCase` | `PascalCase` | `PascalCase` | `PascalCase` | `PascalCase` |
| Function / Method | `camelCase` | `snake_case` | `PascalCase` (exported) / `camelCase` (unexported) | `snake_case` | `camelCase` |
| Variable / Parameter | `camelCase` | `snake_case` | `camelCase` | `snake_case` | `camelCase` |
| Constant | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` | `PascalCase` (exported) / `camelCase` (unexported) | `UPPER_SNAKE_CASE` | `camelCase` / `PascalCase` |
| Enum member | `PascalCase` | `UPPER_SNAKE_CASE` | `PascalCase` | `PascalCase` | `camelCase` |
| File name | `kebab-case.ts` | `snake_case.py` | `snake_case.go` | `snake_case.rs` | `PascalCase.swift` |

| Concept | Dart / Flutter | JavaScript |
|---------|---------------|------------|
| Type / Class | `UpperCamelCase` | `PascalCase` |
| Function / Method | `lowerCamelCase` | `camelCase` |
| Variable / Parameter | `lowerCamelCase` | `camelCase` |
| Constant | `lowerCamelCase` (not `SCREAMING_SNAKE`) | `SCREAMING_SNAKE_CASE` for module-level primitives; `camelCase` otherwise |
| Enum member | `lowerCamelCase` | `PascalCase` |
| File name | `lower_snake_case.dart` | `kebab-case.mjs` (preferred in Node ecosystem) |

**Privacy convention**: Dart uses a leading `_` for library-private members (no `private` keyword). JavaScript uses a leading `_` as a convention for module-private members, or real `#private` fields inside classes for hard enforcement. Other languages express privacy through capitalization (Go) or explicit modifiers (TypeScript / Swift / Rust / Python's `_`-prefix convention).

## Test File Naming

| Language | Convention | Example |
|----------|-----------|---------|
| TypeScript / React | `<module>.test.ts(x)` | `auth.test.ts` |
| Python | `test_<module>.py` | `test_auth.py` |
| Go | `<module>_test.go` (same package) | `auth_test.go` |
| Rust | inline `#[cfg(test)] mod tests` or `tests/<module>.rs` | `tests/auth.rs` |
| Swift | `<Module>Tests.swift` | `AuthTests.swift` |
| Dart / Flutter | `<module>_test.dart` (under `test/`) | `test/auth_test.dart` |
| JavaScript | `<module>.test.mjs` (under `test/`) | `test/auth.test.mjs` |
