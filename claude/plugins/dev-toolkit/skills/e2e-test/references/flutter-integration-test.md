# Flutter E2E — integration_test on device/emulator

For full-functional tests of a Flutter app driving the real widget tree on an Android/iOS device or emulator. Assert UI/behavior, then verify the DB write (see `db-verification.md`).

Flutter's first-party e2e framework is the `integration_test` package (it supersedes the old `flutter_driver`-only setup). Tests usually live in `integration_test/` and use `IntegrationTestWidgetsFlutterBinding`.

## Discover before running

- `pubspec.yaml` → `dev_dependencies`: `integration_test` (sdk: flutter), and optionally `patrol` (adds native-UI interaction — permissions dialogs, notifications). If the project uses Patrol, run via `patrol test` instead.
- Test dir: `integration_test/*_test.dart`. A `test_driver/integration_test.dart` driver file indicates the `flutter drive` path.
- Any project script / Makefile target wrapping the run.

## Pick a target device

A device or emulator must be connected — the skill does not assume which:

```bash
flutter devices                 # what Flutter sees (id column)
adb devices                     # Android specifically (emulator-5554, or a serial)
flutter emulators               # list configured AVDs
flutter emulators --launch <avd-id>   # boot one if none is running
# Android readiness: adb-visible is NOT booted — wait for sys.boot_completed, bounded,
# as ONE foreground command (the retry lives inside it, not in your shell):
timeout 120 adb wait-for-device shell 'while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 1; done'
```

If nothing is connected, report it as a precondition failure — don't proceed.

## Run

Two supported paths; use whichever the project is set up for:

```bash
# Path A — run as a test (simplest; works for most assertions)
flutter test integration_test                         # all integration tests
flutter test integration_test/app_test.dart           # one file
flutter test integration_test -d emulator-5554        # pin the device

# Path B — flutter drive (needed when a driver/extended reporting is used)
flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/app_test.dart \
  -d <device-id>
```

`-d <device-id>` selects the target from `flutter devices`. Add `--flavor`/`--dart-define` if the project uses build flavors or compile-time config (often where the API base URL / env points).

## Preconditions

- Device/emulator online (`adb devices` shows `device`, not `unauthorized`/`offline`).
- The app's backend is running and reachable from the device — on an Android emulator, `localhost` on the host is `10.0.2.2` from inside the emulator; confirm the app's base URL accounts for this.

## Reading results

- Exit code 0 = pass. Failures print the failing `testWidgets`/expectation with a stack.
- For richer machine-readable output use `flutter test integration_test --reporter=json` (or `--machine`) and parse the event stream.

## Then verify the DB

After the in-app flow completes, the write usually goes through the backend, not the device — query the server's MySQL/PostgreSQL per `db-verification.md`. Mind async latency between the UI action and the persisted row.
