# React Debug Guide

## 1. Tagged Probe Injection

Use `console.*` with the `[debug:<id>]` tag on the same line. In JSX expression context, use the comment form.

```tsx
// In component logic or event handlers
console.log('[debug:my-session] props:', props); // [debug:my-session]
console.log('[debug:my-session] state:', state); // [debug:my-session]

// In JSX render output (expression context — wrap in a comment node)
{/* [debug:my-session] */}
```

For useEffect / async:

```tsx
useEffect(() => {
  console.log('[debug:my-session] effect fired, dep:', dep); // [debug:my-session]
}, [dep]);
```

See `../common/cleanup.md` for the full tag convention and removal procedure.

## 2. Reproduce / Run Command

Run the Vitest or Jest suite:

```bash
# Vitest (preferred in modern React projects)
npx vitest run --reporter=verbose

# Jest (CRA / older projects)
npx jest --no-coverage

# Single test file
npx vitest run src/components/MyComponent.test.tsx
```

Exit code 0 = all tests pass. Exit code 1 = at least one test failed (stderr shows the failing assertion).

For a browser-visible symptom, start the dev server and reproduce manually:

```bash
npm run dev   # or: yarn dev / pnpm dev
```

## 3. Error-Driven Exit-Code Convention (Loop B)

| Exit code | Meaning |
|---|---|
| 0 | All tests green |
| 1 | Test failure — read stderr for assertion details |
| Non-zero (other) | Runner crash, config error, or import error |

Read the full stderr output; do not ask the user to paste it. The failing test name and assertion diff appear in the output.

## 4. CLI Debugger for Loop C

Use Node.js inspector to attach to the test runner:

```bash
# Vitest
node --inspect-brk ./node_modules/.bin/vitest run

# Jest
node --inspect-brk ./node_modules/.bin/jest --no-coverage --runInBand
```

Open `chrome://inspect` in Chrome (or use VS Code's "Attach to Node Process" launch config) to connect the debugger. Set breakpoints in the component source or test file before attaching.

> Loop C requires an interactive terminal and a GUI debugger client. In headless or CI contexts, fall back to Loop A (tagged console probes).

## 5. Front-End / Browser Handoff

For symptoms visible in the browser (rendering glitch, network request, layout issue, console error in the live app), invoke the `graceful-browser` skill. The skill will route to the appropriate browser tool (`plugin-infra` chrome-devtools MCP or equivalent) to inspect the DOM, network, and console without duplicating the logic here.
