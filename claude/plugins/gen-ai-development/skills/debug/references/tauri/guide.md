# Tauri 2.0 Debug Guide

Tauri apps span two processes: a **Rust core** (backend, IPC handler) and a **webview front-end** (React / Vue / Svelte / etc.). The first step is always triage — determine which side the symptom is on before choosing a debugger.

## Triage Checklist

| Symptom | Side | Go to |
|---|---|---|
| Rust `panic!` / `unwrap()` failure in terminal | Rust core | Section 2 (Rust side) |
| IPC command returns unexpected data or errors | Rust core | Section 2 (Rust side) |
| File I/O, OS, or system-level failure | Rust core | Section 2 (Rust side) |
| Tauri command handler logic wrong | Rust core | Section 2 (Rust side) |
| UI renders incorrectly or shows wrong data | Webview front-end | Section 3 (Webview side) |
| Network request fails in the webview | Webview front-end | Section 3 (Webview side) |
| Console error in devtools | Webview front-end | Section 3 (Webview side) |
| CSS / layout issue | Webview front-end | Section 3 (Webview side) |
| Intermittent crash — unclear which side | Both | Start with Rust logs, then check webview |

## 2. Rust Side Debugging

For Rust core symptoms, follow **`../rust/guide.md`** for:

- Tagged probe injection (`eprintln!`, `dbg!`, `tracing`) with the `[debug:<id>]` tag
- `cargo test` exit codes and panic output reading
- `rust-lldb` / `rust-gdb` CLI debugger setup and commands

**Tauri-specific notes for Rust side:**

Run the Tauri app in debug mode so that Rust `println!` / `eprintln!` output appears in the terminal:

```bash
cargo tauri dev
```

Tauri commands are defined with `#[tauri::command]`. Add tagged probes inside the command handler body:

```rust
#[tauri::command]
fn my_command(arg: String) -> Result<String, String> {
    eprintln!("[debug:my-session] arg received: {:?}", arg); // [debug:my-session]
    // ...
}
```

To debug the core binary with `rust-lldb`:

```bash
cargo build   # build the core binary
rust-lldb src-tauri/target/debug/<app-name>
```

See `../rust/guide.md` for full `rust-lldb` commands and `../common/cleanup.md` for the tag convention.

## 3. Webview Side Debugging

For webview / front-end symptoms, invoke the `graceful-browser` skill. The skill routes to the appropriate browser tool (`plugin-infra` chrome-devtools MCP or equivalent) to inspect the DOM, network, and console.

For probe injection in the JavaScript / TypeScript webview layer, follow **`../react/guide.md`** (or the guide for whichever framework the webview uses) for:

- Tagged `console.*` probe injection with the `[debug:<id>]` tag
- `vitest` / `jest` run commands and exit codes
- `node --inspect` for test-level debugging

**Tauri-specific notes for webview side:**

Enable the devtools panel in development mode by ensuring `devtools` feature is on in `Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }
```

Then right-click inside the Tauri window → "Inspect Element" to open devtools. Alternatively, invoke the `graceful-browser` skill for a guided inspection flow.

## 4. Running Tests

```bash
# Rust core unit tests
cargo test --manifest-path src-tauri/Cargo.toml

# Front-end unit tests (adjust for your test runner)
npx vitest run      # or: npx jest --no-coverage
```

## 5. Cleanup

After any debugging session, run the cleanup procedure from `../common/cleanup.md`:

```bash
grep -rn '\[debug:' .
```

Remove every tagged line, then verify with `git diff | grep '\[debug:'` — result must be empty.
