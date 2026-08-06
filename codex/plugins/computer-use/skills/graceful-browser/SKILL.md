---
name: graceful-browser
description: Settle which browser automation stack to use before touching a web page, and degrade transparently when the preferred one is not available. Use this whenever a task has to drive a browser — opening a page, taking a screenshot, filling a form, clicking through a flow, checking something behind a login, verifying a deployed page, watching console errors, or inspecting network traffic. Read it first even when the word "browser" never appears; "check what this page shows", "grab a screenshot of the dashboard", "does the sign-up flow still work" and "why is this request failing in the app" all need the framework settled before the first tool call. Not for fetching a URL's content (a plain HTTP request is cheaper) or for driving a native desktop or mobile app.
---

# Graceful Browser — settle the framework before touching a page

Driving a browser is not one capability, it is several with very different reach, and which ones
exist depends on the session you happen to be in. Guessing wrong is expensive in a specific way —
you discover it mid-task, after state has accumulated in a browser you then have to abandon.

So this skill runs **once, up front**, and answers one question: which stack am I driving this page
with. Everything after that is ordinary tool use.

Two rules make the rest of it work, and they matter more than the detection details below:

- **Choose once.** Walk the order at the start of the task, then stay on what you picked. Each
  framework manages its own browser instance, and login state, cookies and open tabs do not carry
  across — switching mid-task silently discards everything the earlier steps established.
- **Degrade out loud.** When you drop a level, tell the user in one sentence which level you left,
  which you landed on, and why. A silent downgrade leaves them wondering why their own browser
  never opened, and that question surfaces long after the cheap moment to answer it.

## The priority order

| priority | stack | why it ranks here | where it works |
|---|---|---|---|
| 1 | a browser app / connector / built-in already exposed in this session | Closest to the current surface, and may reuse real login state | Whatever the actual tool list says |
| 2 | the `chrome-devtools` MCP this plugin ships | An independent controlled Chrome, zero config; reuses a debuggable Chrome if one is running, launches one if not | CLI and desktop app alike |
| 3 | Playwright MCP | Fallback for when neither of the above works | CLI and desktop app alike |

## Step 1 — the session's own browser

Read the tool list and the installed apps or connectors this session actually exposes. Choose a
capability only once it appears there — a product name in the docs is not evidence that this
session has it.

- **Needs login state, cookies, extensions, or an already-signed-in page** → use `@Chrome`, which
  drives the user's real browser.
- **A localhost or public page with no login involved** → the built-in `@Browser` is enough
  (navigate, click, type, screenshot, read-only JS).
- **Neither is exposed** → go to Step 2. Do not infer a tool from a product name.

## Step 2 — a Chrome DevTools MCP

This plugin ships a `chrome-devtools` MCP server through `.mcp.json`, exposing tools as
`mcp__chrome-devtools__*` — `new_page`, `navigate_page`, `take_screenshot`, `take_snapshot`,
`list_pages` and the rest.

- **Available** → call it directly. Connection details are already handled: the entry point at
  `${CODEX_PLUGIN_ROOT}/skills/graceful-browser/scripts/start-chrome-devtools.sh` probes
  `127.0.0.1:9222` (override with `GRACEFUL_BROWSER_CDP_PORT`) and connects to a debuggable Chrome
  if one is there, otherwise launches one with its profile pinned to `~/.cdp` and the same port
  exposed so later sessions can reuse it.
- **Present but the call errors** — no Chrome installed, Chrome failed to start, the connection
  dropped. A first call can land while Chrome is still coming up, so on a connection-class error
  wait 3–5 seconds and retry once. Only then go to Step 3, and pass the error to the user verbatim
  rather than paraphrasing it.
- **Not present** → go to Step 3.

## Step 3 — Playwright fallback

1. Check whether the session already exposes `mcp__playwright__*`. If it does, use it.
2. **It does not** → show the config, get the user's agreement, and only then edit the personal
   `config.toml` or run `codex mcp add`. Editing someone's config without asking is not a decision
   this skill gets to make:

   ```toml
   [mcp_servers.playwright]
   command = "npx"
   args = ["-y", "@playwright/mcp@latest"]
   ```

   A first `npx` fetch of `@playwright/mcp` can take tens of seconds, so warm the cache with
   `npx -y @playwright/mcp@latest --version` first. This is a deterministic command — do not hand
   it to a subagent, there is nothing to gain and overhead to pay.
3. After adding it, **tell the user to open a new thread**. An MCP server cannot hot-load into a
   running session. Once they are back, return to point 1.

## When all three fail

Say so plainly and stop, rather than substituting something that looks like progress. Reading a
page's HTML over HTTP is not browser automation — it cannot click, cannot see rendered layout,
cannot carry a session — and presenting it as though it were leaves the user believing a check
happened that did not. Name what you tried, name the error, and ask how they want to proceed.

## Notes

- **Long-running commands never block the main flow.** Installs and cache warm-ups belong in the
  background.
  Use an execution session you can keep polling — hold the session id and collect output and the
  real exit code as it goes. Do not start orphan background processes you cannot manage.
- **Do not trigger native dialogs.** `alert`, `confirm`, `prompt` and modal file pickers block the
  automation channel, and recovering means asking the user to dismiss it by hand. If a flow
  unavoidably raises one, warn them before you click.
- **Screenshots are evidence, not decoration.** Take one at the moment a claim is made — "the form
  submitted", "the error is gone" — so the claim is checkable rather than asserted.
