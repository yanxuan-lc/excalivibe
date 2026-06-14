# React Native E2E — Detox on device/simulator

For full-functional tests of a React Native app driving the real native UI on an Android emulator or iOS simulator. Detox is a **gray-box** framework: it monitors the app's async work (the RN bridge, timers, network, animations) and auto-waits for the app to be idle before acting — which is what makes it far less flaky than black-box drivers. Assert the UI, then verify the DB write (see `db-verification.md`).

> Version-sensitive: confirm the exact setup against the project's Detox version and the current Detox docs. The concepts below are stable; config keys and flags shift between Detox 19.x and 20.x. Detox uses **Jest** as its test runner by default.

## Discover before running

- `.detoxrc.js` / `.detoxrc.json` / `detox.config.js` — the Detox config: `apps` (build + binary path per platform), `devices` (simulator/emulator type), `configurations` (the named `ios.sim.debug` / `android.emu.debug` combos you pass to `-c`).
- `e2e/` dir — `e2e/jest.config.js` and the specs (`e2e/*.test.{js,ts}`). `detox init` scaffolds these.
- `package.json` scripts: `e2e:build`, `e2e:test`, `detox` — **prefer these** over hand-built commands.
- Whether `detox` is a dev-dependency and the platform toolchain is present (Xcode + `applesimutils` for iOS; Android SDK + an AVD for Android).

## Pick a target device

A simulator/emulator must be available; the named configuration in `.detoxrc` selects which:

```bash
# iOS — list installed simulators
xcrun simctl list devices available
applesimutils --list                 # what Detox uses to match iOS devices

# Android — list AVDs / running emulators
emulator -list-avds
adb devices                          # emulator-5554, or a serial
emulator -avd <avd-name> &           # boot one if none is running
```

The device `type`/`avdName` in `.detoxrc` must match an available device. If nothing matches, report it as a precondition failure — don't proceed.

## Build the binary under test

Detox attaches to a **built debug binary**, not `react-native start` alone (Metro must also be running for a debug build):

```bash
detox build -c ios.sim.debug         # or android.emu.debug
# delegates to the build command in .detoxrc; binary path is recorded there
```

Match the `-c <configuration>` to one defined in `.detoxrc`. Use a `.release` configuration for a self-contained binary that doesn't need Metro (closer to what CI runs).

## Run

```bash
detox test -c ios.sim.debug                          # whole suite
detox test -c android.emu.debug e2e/login.test.ts    # one spec
detox test -c ios.sim.debug --headless --record-logs all   # CI-style
```

A Detox spec uses Jest syntax with Detox's element API:

```javascript
describe('Login flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('S1: should login successfully', async () => {
    await element(by.id('email')).typeText('john@example.com');
    await element(by.id('password')).typeText('123456');
    await element(by.text('Login')).tap();

    await expect(element(by.text('Login'))).not.toExist();
    await expect(element(by.label('Welcome'))).toBeVisible();
  });
});
```

- Match by **`by.id(testID)`** first (set `testID` on the RN component — the gray-box equivalent of a test-id); `by.text` / `by.label` are fallbacks.
- Detox auto-waits on synchronized async work; only reach for explicit `waitFor(...).withTimeout(...)` when synchronization genuinely can't see the work (e.g. an infinite animation or a non-instrumented timer).
- Embed the scenario ID in the `it(...)` title (`it('S1: …')`) so the manifest mapping stays greppable.

## Preconditions

- The target simulator/emulator is available and (for Android) `adb devices` shows `device`, not `unauthorized`/`offline`.
- The debug binary is built (`detox build` ran) and Metro is running for a `.debug` configuration.
- iOS: `applesimutils` installed (`brew tap wix/brew && brew install applesimutils`).
- The app's backend is running and reachable from the device — on an Android emulator, host `localhost` is `10.0.2.2` from inside the emulator; an iOS simulator shares the host's `localhost`. Confirm the app's base URL accounts for this.

## Reading results

- Detox runs through Jest — exit code 0 = pass; failures print the failing `it` with the Detox matcher error and a synchronization/timeout trace.
- For machine-readable output, configure a Jest reporter (`jest-junit`, or `--json`) in `e2e/jest.config.js` and parse that.
- A device/build/session error (can't boot simulator, binary missing, Metro down) is an **infra** issue, not a product bug — classify accordingly.

## Then verify the DB

After the in-app flow, the write usually goes through the backend, not the device — query the server's MySQL/PostgreSQL per `db-verification.md`. Mind async latency between the UI action and the persisted row.

## Alternatives (when Detox doesn't fit)

Detox is the default; note the constraint in the report and fall back only with reason:

- **Maestro** — black-box, YAML-described flows; simplest to author and lowest setup, but weaker synchronization (more explicit waits). Good when the app isn't a Detox-instrumented build or for quick smoke flows.
- **Appium + WebdriverIO** — most general (cross-platform, hybrid/native), and the same WDIO runner the Tauri reference uses. Heaviest setup and slowest; reach for it when you need real-device farms or non-RN surfaces in the same suite.
