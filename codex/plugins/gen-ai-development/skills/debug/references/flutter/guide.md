# Flutter / Dart Debug Guide

## 1. Tagged Probe Injection

Use `debugPrint` or `dart:developer log` with the `[debug:<id>]` tag.

```dart
// debugPrint is throttled by Flutter to avoid log flooding
debugPrint('[debug:my-session] value: $value'); // [debug:my-session]

// dart:developer log — structured, can include name and error fields
import 'dart:developer' as dev;
dev.log('[debug:my-session] state: $state', name: 'debug'); // [debug:my-session]
```

Avoid plain `print()` in Flutter — it bypasses throttling and is stripped in release builds. Prefer `debugPrint` for widget-layer probes.

See `../common/cleanup.md` for the full tag convention and removal procedure.

## 2. Reproduce / Run Command

Run the Flutter or Dart test suite:

```bash
# Flutter project tests
flutter test

# Single test file
flutter test test/widget_test.dart

# Plain Dart package tests
dart test

# With verbose output
flutter test --reporter expanded
```

Exit code 0 = all tests pass. Exit code 1 = test failure — read stderr for the failing assertion.

For a device-visible symptom, run in debug mode:

```bash
flutter run                        # default connected device
flutter run -d emulator-5554       # specific emulator
```

## 3. Error-Driven Exit-Code Convention (Loop B)

| Exit code | Meaning |
|---|---|
| 0 | All tests pass |
| 1 | Test failure — read stderr for assertion and stack trace |
| Non-zero (other) | Compilation error, missing dependency, or device issue |

Read the full stderr output directly; do not ask the user to paste it. Flutter test output includes the failing widget path and the diff between expected and actual.

## 4. CLI Debugger for Loop C

**Dart DevTools / Observatory:**

1. Start the app in debug mode: `flutter run` (attach debugger via DevTools)
2. Flutter prints a URL like `http://127.0.0.1:9100/...` — open it in Chrome to connect Dart DevTools.
3. DevTools provides breakpoints, call stack inspection, variable watch, and widget inspector.

**VM Service Protocol (for headless Dart):**

```bash
dart --enable-vm-service test/my_test.dart
```

Connect `dart devtools` to the printed URI.

> Loop C requires a connected device or emulator and a running app process. In CI contexts (no display), fall back to Loop A (tagged `debugPrint` probes reviewed in `flutter test` output).

## 5. Browser Handoff

Flutter targets mobile and desktop platforms; browser debugging (WebAssembly / Flutter Web) is a distinct context. If the symptom is in a Flutter Web build, invoke the `graceful-browser` skill for browser-side inspection. For native mobile / desktop targets, browser handoff is **n/a**.
