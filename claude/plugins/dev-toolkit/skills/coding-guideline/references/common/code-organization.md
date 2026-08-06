# Code Organization

Cross-language principles for structuring files, modules, and projects.

## File-Level Structure

Every source file follows a consistent top-to-bottom order:

1. **Imports / dependencies** — grouped by origin (standard library, third-party, local)
2. **Constants** — module-level immutable values
3. **Types / interfaces** — data shape definitions
4. **Public API** — exported functions, classes, components
5. **Private helpers** — unexported implementation details

Blank lines separate each section. This ordering means a reader scanning top-down sees the contract before the implementation.

## Module / Package Boundaries

- **One concept per module.** A module named `auth` should contain authentication logic, not logging utilities.
- **Depend on abstractions at boundaries.** Between major modules, use interfaces/protocols/traits rather than concrete types. Within a module, concrete types are fine.
- **Keep the dependency graph acyclic.** If A imports B and B imports A, extract the shared concern into C.

## Import Organization

Three groups, separated by blank lines, in this order:

1. **Standard library** — built-in modules/packages
2. **Third-party** — external dependencies
3. **Local** — project-internal imports

Within each group, sort alphabetically or by convention (the language's formatter usually handles this).

## Directory Layout Principles

- **Feature-based over type-based.** Group by what the code does (`auth/`, `billing/`, `notifications/`) rather than by what it is (`controllers/`, `models/`, `services/`). Type-based grouping scatters related code across the tree.
- **Flat until it hurts.** Start flat. Introduce subdirectories when a folder has enough files that scanning becomes slow (roughly 10-15 files). Do not pre-create empty category folders.
- **Collocate tests.** Keep test files close to the code they test — either in the same directory or in a parallel `tests/` tree mirroring `src/`.

## Re-exports and Barrel Files

Use a single entry-point file (`index.ts`, `__init__.py`, `mod.rs`) to expose a module's public API. This keeps import paths short for consumers and lets you reorganize internals without breaking callers.

Do not re-export everything — be selective. If a type is internal, leave it out of the barrel.
