# Error Handling

Cross-language error handling principles. Language-specific mechanics are in each language's guide.

## Principles

### Fail Fast, Fail Loud

Detect problems as close to the source as possible. Do not silently swallow errors or convert them to default values unless there is a clear reason. A crash with a stack trace is more helpful than a silent wrong answer.

### Validate at System Boundaries

Trust code you control. Validate data entering your system:

- User input (forms, CLI args, API request bodies)
- External API responses
- File system reads
- Database query results when schema is uncertain

Inside the system, types and contracts carry the trust. Re-validating internal data is noise.

### Errors Are Data, Not Strings

Structure errors so callers can handle them programmatically:

- Include an error **kind/code** the caller can `switch` on
- Include a human-readable **message** for logs
- Preserve the **cause chain** so the original error is not lost

### Handle or Propagate — Never Ignore

Every error is either:
1. **Handled** — the code recovers and continues normally
2. **Propagated** — the code returns/throws/wraps the error for the caller to deal with
3. **Logged and re-raised** — for adding context before propagation

Catching an error and doing nothing is a bug.

### Domain Errors vs Infrastructure Errors

- **Domain errors** (invalid input, business rule violation) are expected — model them explicitly in your type system.
- **Infrastructure errors** (network timeout, disk full) are unexpected — propagate them with context, let a top-level handler decide the response.

## Language Patterns at a Glance

| Language | Mechanism | Idiomatic pattern |
|----------|-----------|-------------------|
| TypeScript | `throw` / `try-catch` | Domain errors extend `Error` with a `name` and `{ cause }` |
| JavaScript | `throw` / `try-catch` | Same as TypeScript; in JS `name` must be set explicitly in the constructor |
| Python | `raise` / `try-except` | Custom exception classes in a module-level hierarchy |
| Go | `error` return value | `fmt.Errorf("context: %w", err)` for wrapping |
| Rust | `Result<T, E>` / `?` operator | Custom error enums implementing `std::error::Error` |
| Swift | `throws` / `do-catch` | Error enums conforming to `Error` protocol |
| Dart | `throw` / `try-on-catch` | Implement `Exception` (not `Error` — reserved for programmer mistakes); `try { ... } on FooException catch (e) { ... }` |
