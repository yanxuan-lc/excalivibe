# Node.js Debug Guide

## 1. Tagged Probe Injection

Use `console.*` or the `debug` package with the `[debug:<id>]` tag on the same line.

```js
// console probe (always available)
console.log('[debug:my-session] value:', value); // [debug:my-session]
console.error('[debug:my-session] unexpected:', err); // [debug:my-session]

// debug package (conditional output via DEBUG env var — useful for library authors)
const debug = require('debug')('app:session'); // [debug:my-session]
debug('value: %O', value); // [debug:my-session]
// Run with: DEBUG=app:session node server.js
```

See `../common/cleanup.md` for the full tag convention and removal procedure.

## 2. Reproduce / Run Command

```bash
# Node.js built-in test runner (Node 18+)
node --test

# Single test file
node --test test/auth.test.js

# Jest
npx jest --no-coverage

# Vitest (for Node-targeted code)
npx vitest run

# Run the script directly
node src/index.js
```

Exit code 0 = all tests pass (or script exits cleanly). Exit code 1 = test failure or unhandled exception.

## 3. Error-Driven Exit-Code Convention (Loop B)

| Exit code | Meaning |
|---|---|
| 0 | Success — all tests pass or script exited cleanly |
| 1 | Test failure, assertion error, or unhandled exception |
| Non-zero (other) | Signal, OOM, or explicit `process.exit(N)` |

When a test fails, the runner prints the failing test name, the assertion diff, and the stack trace to stderr. Read this output directly; do not ask the user to paste it.

For unhandled promise rejections (Node 15+), the process exits with code 1 and prints the rejection reason and stack trace.

## 4. CLI Debugger for Loop C — `node --inspect` / `node --inspect-brk`

```bash
# Attach debugger and pause at start of script
node --inspect-brk src/index.js

# Attach debugger and pause at start of test suite (Jest)
node --inspect-brk ./node_modules/.bin/jest --no-coverage --runInBand

# Attach debugger and pause at start of test suite (Node built-in)
node --inspect-brk --test test/auth.test.js
```

Then open `chrome://inspect` in Chrome → "Open dedicated DevTools for Node". The DevTools Sources panel allows:
- Setting breakpoints by file:line
- Stepping (F10 step over, F11 step into)
- Inspecting local variables in the Scope panel
- Evaluating expressions in the Console panel

**VS Code alternative:** Add a launch config in `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Node",
  "port": 9229
}
```

> `--inspect` starts listening immediately (process runs); `--inspect-brk` pauses at the first line — use `--inspect-brk` when you need to set breakpoints before any code runs.

> Loop C requires an interactive terminal and a GUI debugger client. In headless / CI contexts, fall back to Loop A (tagged `console.*` probes).

## 5. Browser Handoff

Node.js is a server-side runtime; browser debugging is **n/a** for server-side Node code. If the Node process serves a web front-end and the symptom is in the browser layer, invoke the `graceful-browser` skill for browser-side inspection.
