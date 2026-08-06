# Rust Debug Guide

## 1. Tagged Probe Injection

Use `dbg!`, `eprintln!`, or `tracing` macros with the `[debug:<id>]` tag.

```rust
// dbg! — prints expression and its value to stderr, returns the value
let x = dbg!(some_value); // [debug:my-session]

// eprintln! — explicit stderr probe
eprintln!("[debug:my-session] state: {:?}", state); // [debug:my-session]

// tracing — for async code or structured logging (preferred for production codebases)
tracing::debug!("[debug:my-session] request: {:?}", req); // [debug:my-session]
```

> `dbg!` emits to stderr and returns its argument unchanged, so it can be inserted inline without changing the surrounding logic. It includes file:line automatically.

See `../common/cleanup.md` for the full tag convention and removal procedure.

## 2. Reproduce / Run Command

```bash
# Run all tests
cargo test

# Run tests in a specific package (workspace)
cargo test -p my-crate

# Run a single test by name (substring match)
cargo test login_handler

# With output shown (normally captured)
cargo test -- --nocapture

# Build only
cargo build

# With release optimizations
cargo build --release
```

Exit code 0 = all tests pass (or build succeeds). Exit code 1 = test failure or compilation error.

## 3. Error-Driven Exit-Code Convention (Loop B)

| Exit code | Meaning |
|---|---|
| 0 | All tests pass or build succeeds |
| 1 | Test failure, compilation error, or panic — read stderr |
| Non-zero (other) | Linker error, missing toolchain component |

When a test panics, Rust prints the panic message, the file:line of the `panic!` / `unwrap()`, and a note to set `RUST_BACKTRACE=1` for the full backtrace. For diagnostics:

```bash
RUST_BACKTRACE=1 cargo test -- --nocapture
RUST_BACKTRACE=full cargo test -- --nocapture   # full symbol expansion
```

Compilation errors include the exact file:line and a `note:` explaining the problem — read them directly.

## 4. CLI Debugger for Loop C — `rust-lldb` / `rust-gdb`

Both ship with the Rust toolchain (`rustup component add lldb`).

**`rust-lldb` (macOS / cross-platform):**

```bash
# Debug a test binary
cargo test --no-run 2>&1 | grep "Running" | head -1
# The output shows the test binary path, e.g.:
# Running unittests src/lib.rs (target/debug/deps/my_crate-abc123)
rust-lldb target/debug/deps/my_crate-abc123

# Inside rust-lldb:
(lldb) b src/auth.rs:45         # breakpoint at file:line
(lldb) b my_crate::auth::login  # breakpoint at function
(lldb) run                      # start execution
(lldb) p variable               # print variable
(lldb) bt                       # backtrace
(lldb) n                        # next (step over)
(lldb) s                        # step into
(lldb) q                        # quit
```

**`rust-gdb` (Linux):**

```bash
rust-gdb target/debug/deps/my_crate-abc123
# GDB commands: break, run, print, backtrace, next, step, quit
```

> Loop C requires an interactive terminal (TTY). In headless / CI contexts, fall back to Loop A (tagged `eprintln!` / `dbg!` probes with `-- --nocapture`).

## 5. Browser Handoff

Rust is a backend / systems language; browser debugging is **n/a** for server-side Rust code. If the project includes a webview (e.g., Tauri), see `../tauri/guide.md` which routes webview symptoms to the `graceful-browser` skill.
