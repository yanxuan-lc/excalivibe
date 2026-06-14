# React Native Debug Guide

## 1. Tagged Probe Injection

Use `console.*` or `LogBox` with the `[debug:<id>]` tag on the same line.

```tsx
// Standard console probe
console.log('[debug:my-session] props:', props); // [debug:my-session]
console.warn('[debug:my-session] unexpected state:', state); // [debug:my-session]

// LogBox.ignoreLogs can be used to suppress noise from other sources during session
// — do NOT tag suppressions; tag only the probes you add

// In async / callback context
const onPress = () => {
  console.log('[debug:my-session] onPress fired, data:', data); // [debug:my-session]
};
```

See `../common/cleanup.md` for the full tag convention and removal procedure.

## 2. Reproduce / Run Command

Run the Jest suite (React Native projects use Jest with the `react-native` preset):

```bash
# All tests
npx jest --no-coverage

# Single file
npx jest src/screens/HomeScreen.test.tsx --no-coverage

# With verbose output
npx jest --verbose --no-coverage
```

Exit code 0 = all tests pass. Exit code 1 = test failure — read stderr for assertion diff.

For a device/emulator-visible symptom, start Metro and run on a simulator:

```bash
npx react-native start          # Metro bundler
npx react-native run-ios        # iOS simulator
npx react-native run-android    # Android emulator
```

## 3. Error-Driven Exit-Code Convention (Loop B)

| Exit code | Meaning |
|---|---|
| 0 | All tests green |
| 1 | Test failure — read stderr for failing assertion and stack trace |
| Non-zero (other) | Runner crash, transform error, or Metro config issue |

Read the full stderr output directly; do not ask the user to paste it.

## 4. CLI Debugger for Loop C

**Primary path — Hermes inspector (RN 0.69+):**

1. Start the app in debug mode: `npx react-native start --reset-cache`
2. Shake the device / press `d` in the terminal → "Open Debugger" → opens React Native DevTools in the browser.
3. The Hermes inspector panel provides breakpoints, call stack inspection, and variable watch.

**Alternative — `node --inspect` for logic running in Node (Metro, scripts):**

```bash
node --inspect-brk ./node_modules/.bin/jest --no-coverage --runInBand
```

Open `chrome://inspect` to attach.

> **Note on Flipper:** Flipper was the standard debugger in older RN projects but was removed as the default in RN 0.73+. For RN 0.73+, use Hermes inspector / React Native DevTools as the primary path above.

> Loop C requires an interactive session (device or emulator connected). In CI contexts, fall back to Loop A (tagged console probes reviewed in Metro log output).

## 5. Front-End / Browser Handoff

For symptoms visible in the app's WebView layer or if you need browser-level devtools inspection, invoke the `graceful-browser` skill. The skill routes to the appropriate browser tool to inspect rendering without duplicating that logic here.
