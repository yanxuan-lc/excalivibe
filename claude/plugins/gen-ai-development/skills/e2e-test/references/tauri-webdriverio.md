# Tauri E2E — tauri-driver + WebdriverIO

For full-functional tests of a Tauri desktop app. Tauri's official e2e approach drives the app through **`tauri-driver`**, a cross-platform wrapper that proxies to the platform's native WebDriver, with **WebdriverIO** (or Selenium) as the test runner. Assert the UI, then verify the DB write (see `db-verification.md`).

> Version-sensitive: confirm the exact setup against the project's Tauri version and the current Tauri docs. The concepts below are stable; flags and capability names can shift between Tauri 1.x and 2.x.

## Platform support — check first

`tauri-driver` relies on the OS's WebView WebDriver:
- **Linux** — `WebKitWebDriver` (ship with `webkit2gtk-driver`).
- **Windows** — Microsoft Edge Driver (`msedgedriver.exe`), version-matched to the installed WebView2 runtime.
- **macOS** — **not supported** (WKWebView exposes no WebDriver). On macOS, e2e via tauri-driver is not an option; fall back to API-mode e2e, or run the GUI suite on Linux/Windows (or CI).

If you're on macOS and the request needs Tauri GUI e2e, report this constraint up front rather than failing mid-run.

## Discover before running

- `wdio.conf.{ts,js}` — WebdriverIO config: `specs`, `capabilities` (look for `tauri:options` with `application` pointing at the built binary), `services`, `reporters`.
- `package.json` scripts: `test:e2e`, `wdio`. Prefer these.
- Whether `tauri-driver` is installed (`cargo install tauri-driver` / a project dev-dep) and the native driver is present.

## Build the binary under test

WebDriver attaches to a built debug binary, not `tauri dev`:

```bash
npm run tauri build -- --debug      # or: cargo tauri build --debug
# binary lands under src-tauri/target/debug/<app>
```

The `application` capability in `wdio.conf` should point at that path.

## Run

```bash
# tauri-driver brokers between WDIO and the native WebDriver.
# Many setups start it via a wdio onPrepare hook; otherwise start it yourself:
tauri-driver &        # listens on 4444 by default

npx wdio run wdio.conf.js          # whole suite
npx wdio run wdio.conf.js --spec ./test/specs/login.e2e.js   # one spec
```

If the project's `wdio.conf` already spawns `tauri-driver` (onPrepare/onComplete hooks), just run `wdio` — don't start a second instance.

## Preconditions

- Correct native WebDriver installed and on PATH (`WebKitWebDriver` / `msedgedriver`), version-matched on Windows.
- The debug binary is built and the `application` capability path is valid.
- Backend the app talks to is running and reachable.

## Reading results

- WDIO exit code 0 = pass; the spec reporter lists per-test status. Add a JSON/JUnit reporter for machine-readable parsing.
- A WebDriver session error (can't find/launch the app) is an infra issue, not a product bug — classify accordingly.

## Then verify the DB

After the UI flow, query the backend's MySQL/PostgreSQL per `db-verification.md`.
