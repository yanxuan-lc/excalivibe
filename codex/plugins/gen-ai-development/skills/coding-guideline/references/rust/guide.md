# Rust Guide

Rust-specific conventions. Assumes familiarity with the universal principles in SKILL.md.

## Formatting

`rustfmt` is non-negotiable. Configure via `rustfmt.toml` if needed, but never hand-format.

## Naming

Follow Rust API Guidelines (RFC 430):

- **Types, Traits, Enums**: `PascalCase` — `HttpClient`, `IntoIterator`
- **Functions, methods, variables**: `snake_case` — `fetch_user`, `retry_count`
- **Constants, statics**: `UPPER_SNAKE_CASE` — `MAX_RETRIES`, `DEFAULT_PORT`
- **Modules, crates**: `snake_case` — `auth_service`, `data_pipeline`
- **Type parameters**: single uppercase letter or short `PascalCase` — `T`, `K`, `V`, `Item`
- **Lifetimes**: short lowercase — `'a`, `'ctx`

## Error Handling

Use `Result<T, E>` for all fallible operations. The `?` operator propagates errors cleanly.

### Custom Error Types

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("user {id} not found")]
    NotFound { id: String },

    #[error("validation failed: {0}")]
    Validation(String),

    #[error(transparent)]
    Database(#[from] sqlx::Error),

    #[error(transparent)]
    Io(#[from] std::io::Error),
}
```

- Use `thiserror` for library error types (structured, typed).
- Use `anyhow` for application-level error handling when you don't need callers to match on error variants.
- Never `.unwrap()` in library code. In application code, `.unwrap()` is acceptable only when the invariant is proven (add a comment explaining why).
- `.expect("reason")` over `.unwrap()` — the message documents the assumption.

## Ownership and Borrowing

- **Prefer borrowing.** Take `&self`, `&str`, `&[T]` in function signatures unless ownership transfer is needed.
- **Use `Clone` sparingly.** If you're cloning to satisfy the borrow checker, reconsider the data flow.
- **Lifetime annotations** only when the compiler cannot infer them. Do not add lifetimes preemptively.

## Option Handling

Prefer combinators over match when the logic is simple:

```rust
// Good
let name = user.nickname.unwrap_or_else(|| user.username.clone());

// Good — chaining
let display = user
    .nickname
    .as_deref()
    .unwrap_or(&user.username);

// Avoid — verbose match for a simple default
let name = match user.nickname {
    Some(n) => n,
    None => user.username.clone(),
};
```

Use `match` when there is meaningful branching logic, not just defaulting.

## Module Structure

```
src/
├── main.rs (or lib.rs)
├── config.rs
├── error.rs
├── models/
│   ├── mod.rs
│   └── user.rs
├── services/
│   ├── mod.rs
│   └── auth.rs
└── handlers/
    ├── mod.rs
    └── api.rs
```

- `mod.rs` re-exports the public API of each directory module.
- Keep `main.rs` thin — setup and wiring only.
- `error.rs` at the crate root defines the unified error type.

## Doc-Comments (rustdoc)

Use `///` for item documentation and `//!` for module/crate documentation. rustdoc renders Markdown.

```rust
/// Fetch a user profile by ID.
///
/// Returns `Ok(User)` on success, or `Err(AppError::NotFound)` if
/// no user matches the given ID.
///
/// # Errors
///
/// - [`AppError::NotFound`] — no user with this ID exists
/// - [`AppError::Database`] — connection or query failure
///
/// # Examples
///
/// ```
/// let user = fetch_user("u_123").await?;
/// assert_eq!(user.name, "Alice");
/// ```
pub async fn fetch_user(id: &str) -> Result<User, AppError> {
    // ...
}

/// Maximum number of retry attempts for transient failures.
///
/// Tuned to balance reliability against latency — 3 retries with
/// exponential backoff covers most network blips.
pub const MAX_RETRIES: u32 = 3;

/// A service for managing user lifecycle operations.
///
/// Handles creation, retrieval, and deactivation. All methods are
/// async and require a database connection pool.
pub struct UserService {
    pool: PgPool,
}
```

- First line: concise summary sentence. This appears in the module index on docs.rs.
- `# Errors` section listing each error variant the function may return.
- `# Panics` section if the function can panic (ideally it should not).
- `# Examples` with runnable code blocks — rustdoc compiles and tests them.
- `# Safety` section for `unsafe fn` explaining the invariants the caller must uphold.
- Use `//!` at the top of `lib.rs` or `mod.rs` for crate/module-level overview documentation.
- Document all `pub` items. Skip `pub(crate)` and private items unless behavior is non-obvious.

## Conventions

- **`#[must_use]`** on functions whose return value should not be ignored.
- **`impl` blocks**: one for inherent methods, separate ones for each trait implementation.
- **`derive` order**: `Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize` — consistency aids readability.
- **Builder pattern** for structs with many optional fields instead of constructors with many parameters.
- **Unit tests** default to inline at the bottom of the source file: `#[cfg(test)] mod tests { ... }` with `use super::*;`. Co-locating tests with the code they exercise is the idiomatic Rust convention and keeps them visible when editing the implementation. When a test module grows large enough to crowd the file — roughly when the tests outweigh the production code or the file pushes past ~400 lines — split it into a sibling submodule file with `#[cfg(test)] mod tests;`, which resolves to `<module>/tests.rs` (or a `<module>/tests/` directory for further splitting). It stays the same `tests` submodule with `use super::*` access to private items; do **not** use `#[path]` or dot-named files like `foo.test.rs` — that is not a Rust convention and confuses tooling. Integration tests go in the crate's top-level `tests/`.
- **Avoid `String` in struct fields when `&str` or `Cow<str>` suffices** — but do not over-optimize at the cost of ergonomics.
