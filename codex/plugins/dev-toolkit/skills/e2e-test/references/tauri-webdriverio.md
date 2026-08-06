# Tauri E2E — tauri-driver + WebdriverIO

For full-functional tests of a Tauri desktop app. Tauri's official e2e approach drives the app through **`tauri-driver`**, a cross-platform wrapper that proxies to the platform's native WebDriver, with **WebdriverIO** (or Selenium) as the test runner. Assert the UI, then verify the DB write (see `db-verification.md`).

> Version-sensitive: confirm the exact setup against the project's Tauri version and the current Tauri docs. The concepts below are stable; flags and capability names can shift between Tauri 1.x and 2.x.

## Platform support — check first

`tauri-driver` relies on the OS's WebView WebDriver:
- **Linux** — `WebKitWebDriver` (ship with `webkit2gtk-driver`).
- **Windows** — Microsoft Edge Driver (`msedgedriver.exe`), version-matched to the installed WebView2 runtime.
- **macOS** — no native WebDriver (Apple ships none for WKWebView). You cannot drive a macOS-built Tauri app with `tauri-driver` directly. This does **not** mean no e2e on a Mac — see [Running on macOS](#running-on-macos) for the verified Docker-on-Linux recipe and the other options.

If the dev machine is a Mac, decide the macOS strategy up front (Docker-Linux / CI / in-app driver) rather than failing mid-run.

## Discover before running

- `wdio.conf.{ts,js}` — WebdriverIO config: `specs`, `capabilities` (look for `tauri:options` with `application` pointing at the built binary), `services`, `reporters`.
- `package.json` scripts: `test:e2e`, `wdio`. Prefer these.
- Whether `tauri-driver` is installed (`cargo install tauri-driver` / a project dev-dep) and the native driver is present.

## Build the binary under test

WebDriver attaches to a built debug binary, not `tauri dev`. **Reuse before rebuilding**: if a debug binary already exists at the current commit (built by the developer role or a prior round — check `src-tauri/target/debug/<app>` mtime vs the last source change, or a recorded build in the pipeline evidence), attach to it. Build only when it's missing or stale:

```bash
npm run tauri build -- --debug      # or: cargo tauri build --debug
# binary lands under src-tauri/target/debug/<app>
```

Build once, then iterate on tests against the same binary — re-running specs must never trigger a Rust recompile. The `application` capability in `wdio.conf` should point at that path.

## Run

```bash
# tauri-driver brokers between WDIO and the native WebDriver.
# Many setups start it via a wdio onPrepare hook; otherwise start it yourself:
tauri-driver &        # listens on 4444 by default
# readiness: one bounded foreground check, e.g. `curl -s --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:4444/status`
# — not a shell while/sleep loop

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

## Running on macOS

Apple ships no WebDriver for WKWebView, so there is no native macOS path. The robust answer is **run the GUI e2e on Linux** — either hosted (CI) or locally in Docker. The Docker recipe below was **verified on Apple Silicon (arm64 macOS, Docker 29, Ubuntu 24.04)**: WDIO v9 → `tauri-driver` → `WebKitWebDriver` → the real `wry`/WebKitGTK webview, reading the actually-rendered DOM headless.

### Option A — Docker (Linux) on the Mac (verified)

A `Dockerfile` mirroring Tauri v2's official Linux dependency set:

```dockerfile
FROM ubuntu:24.04                     # use the arm64-native image on Apple Silicon — do NOT --platform linux/amd64 (x86 emulation is painfully slow)
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl git ca-certificates build-essential pkg-config libssl-dev \
      libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libgtk-3-dev \
      webkit2gtk-driver xvfb \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"
RUN cargo install tauri-driver --locked
WORKDIR /app
```

Build the binary and run the suite as **two steps**, so iterating tests doesn't recompile Rust:

```bash
docker build -t tauri-e2e -f Dockerfile.e2e .

# 1) compile the Linux debug binary — CARGO_TARGET_DIR on a named volume keeps Linux
#    artifacts out of the host's macOS target/, and caches them for fast re-runs.
docker run --rm -v "$PWD":/app -w /app \
  -e CARGO_TARGET_DIR=/build/target \
  -v probe_cargo:/root/.cargo/registry -v probe_target:/build/target \
  tauri-e2e bash -lc "npm install && npm run tauri build -- --debug --no-bundle"

# 2) run headless under xvfb (cheap to repeat)
docker run --rm -v "$PWD":/app -w /app \
  -e CARGO_TARGET_DIR=/build/target \
  -e TAURI_APP_BINARY=/build/target/debug/<app-name> \
  -e DATABASE_URL='mysql://...@host.docker.internal:3306/testdb' \
  -v probe_cargo:/root/.cargo/registry -v probe_target:/build/target \
  tauri-e2e bash -lc "xvfb-run -a npm run test:e2e"
```

`wdio.conf` points its `tauri:options.application`/`binary` at the `CARGO_TARGET_DIR` path (`/build/target/debug/<app-name>`). For a test DB, prefer composing the app + DB in one docker-compose network; `host.docker.internal` reaches a DB running on the Mac host.

Gotchas confirmed in the verified run:
- **WDIO v9 must be forced to classic WebDriver** — `tauri-driver`/`wry` don't speak WebDriver BiDi. Set `'wdio:enforceWebDriverClassic': true` in the capability, or v9's BiDi negotiation can hang the session.
- **`xvfb-run -a`** supplies the virtual display; without it the webview can't open headless.
- **`libEGL ... DRI3` warnings are benign** — no GPU in the container, software rendering; the run still passes.
- A static-frontend template (`frontendDist` a built dir) needs **no dev server**; a dev-server template needs it started first.

### Option B — CI on Linux/Windows runners

Same recipe, hosted: install `libwebkit2gtk-4.1-dev` + `libayatana-appindicator3-dev` + `webkit2gtk-driver` + `xvfb`, `cargo install tauri-driver --locked`, build `--debug --no-bundle`, and run the suite under `xvfb-run`. This is Tauri's documented CI path and the most trustworthy place for the acceptance run.

### Option C — true macOS WKWebView (when Mac-native rendering matters)

Linux WebKitGTK is **not** the same engine as macOS WKWebView, so Options A/B validate flows / logic / DB writes but **not** Mac-specific rendering. If shipping a macOS build whose native rendering must be checked, use a community in-app WebDriver plugin that embeds a W3C server inside the debug app and drives WKWebView directly (e.g. `Choochmeque/tauri-plugin-webdriver`, cross-platform). It is community-maintained (verify maturity), debug-build only, and may need the frontend dev server running. Don't substitute Playwright's bundled WebKit for this — it's a different engine from `wry`'s WKWebView and won't exercise real IPC.

> Fidelity rule: a green Linux/Docker e2e is acceptance for behavior and persistence; for a macOS release, add at least one macOS-native smoke (Option C or manual) before declaring the GUI verified on Mac.
