---
name: graceful-browser
description: Settle which browser automation stack to use before touching a web page, and degrade transparently when the preferred one is not available. Use this whenever a task has to drive a browser — opening a page, taking a screenshot, filling a form, clicking through a flow, checking something behind a login, verifying a deployed page, watching console errors, or inspecting network traffic. Read it first even when the word "browser" never appears; "check what this page shows", "grab a screenshot of the dashboard", "does the sign-up flow still work" and "why is this request failing in the app" all need the framework settled before the first tool call. Not for fetching a URL's content (a plain HTTP request is cheaper) or for driving a native desktop or mobile app.
description-claude: Settle which browser automation stack to use before touching a web page, and degrade transparently when the preferred one is not available. Use this whenever a task has to drive a browser — opening a page, taking a screenshot, filling a form, clicking through a flow, checking something behind a login, verifying a deployed page, watching console errors, or inspecting network traffic. Read it first even when the word "browser" never appears; "check what this page shows", "grab a screenshot of the dashboard", "does the sign-up flow still work" and "why is this request failing in the app" all need the framework settled before the first tool call. Not for fetching a URL's content (a plain HTTP request is cheaper) or for driving a native desktop or mobile app.
description-codex: Settle which browser automation stack to use before touching a web page, and degrade transparently when the preferred one is not available. Use this whenever a task has to drive a browser — opening a page, taking a screenshot, filling a form, clicking through a flow, checking something behind a login, verifying a deployed page, watching console errors, or inspecting network traffic. Read it first even when the word "browser" never appears; "check what this page shows", "grab a screenshot of the dashboard", "does the sign-up flow still work" and "why is this request failing in the app" all need the framework settled before the first tool call. Not for fetching a URL's content (a plain HTTP request is cheaper) or for driving a native desktop or mobile app.
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

<!--@claude-->
| priority | stack | why it ranks here |
|---|---|---|
| 1 | `claude --chrome` (Claude in Chrome) | Drives the user's real browser — their login state, cookies, extensions. What you see is what they see |
| 2 | the `chrome-devtools` MCP this plugin ships | An independent controlled Chrome, zero config; reuses a debuggable Chrome if one is running, launches one if not |
| 3 | the Playwright plugin | Fallback for when neither of the above works |
<!--@codex-->
| priority | stack | why it ranks here | where it works |
|---|---|---|---|
| 1 | a browser app / connector / built-in already exposed in this session | Closest to the current surface, and may reuse real login state | Whatever the actual tool list says |
| 2 | the `chrome-devtools` MCP this plugin ships | An independent controlled Chrome, zero config; reuses a debuggable Chrome if one is running, launches one if not | CLI and desktop app alike |
| 3 | Playwright MCP | Fallback for when neither of the above works | CLI and desktop app alike |
<!--@common-->
| priority | stack | why it ranks here |
|---|---|---|
| 1 | whatever browser tooling the host already exposes in this session | Closest to the current surface, and may reuse real login state |
| 2 | a `chrome-devtools` MCP server, if the host has one configured | An independent controlled Chrome that reuses a debuggable Chrome if one is running |
| 3 | a Playwright MCP server, if the host has one configured | Fallback for when neither of the above is present |

This end assumes nothing about what is installed. Levels 2 and 3 are only reachable if the host's
own configuration provides them — read the session's tool list rather than trusting this table.
<!--@end-->

## Step 1 — the session's own browser

<!--@claude-->
Probe for it, loading the core tools in one call so a hit does not cost a second round-trip:

```
ToolSearch query: "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp"
```

- **Found** → selection done. Call `tabs_context_mcp` first to see what the user already has open,
  then decide whether to reuse a tab or create one. Never reuse a tab id from an earlier session.
- **Not found** → `--chrome` is a launch flag and cannot be turned on mid-session, so go to Step 2.
  Do not ask the user to restart for it; Step 2 is good enough that the interruption is not worth
  it.
<!--@codex-->
Read the tool list and the installed apps or connectors this session actually exposes. Choose a
capability only once it appears there — a product name in the docs is not evidence that this
session has it.

- **Needs login state, cookies, extensions, or an already-signed-in page** → use `@Chrome`, which
  drives the user's real browser.
- **A localhost or public page with no login involved** → the built-in `@Browser` is enough
  (navigate, click, type, screenshot, read-only JS).
- **Neither is exposed** → go to Step 2. Do not infer a tool from a product name.
<!--@common-->
Read the tool list this session actually exposes and look for browser control among it. Hosts vary
widely here, and the names vary with them, so match on what the tools *do* rather than on an
expected prefix.

- **A browser tool family is present** → use it, and prefer the one whose own description claims it
  can reuse the user's real session when login state matters.
- **Nothing browser-shaped is exposed** → go to Step 2. Do not infer a capability from the host's
  marketing name.
<!--@end-->

## Step 2 — a Chrome DevTools MCP

<!--@claude-->
Probe the tool family this plugin bundles:

```
ToolSearch query: "select:mcp__plugin_computer-use_chrome-devtools__list_pages,mcp__plugin_computer-use_chrome-devtools__new_page,mcp__plugin_computer-use_chrome-devtools__navigate_page,mcp__plugin_computer-use_chrome-devtools__take_screenshot,mcp__plugin_computer-use_chrome-devtools__take_snapshot"
```
<!--@codex-->
This plugin ships a `chrome-devtools` MCP server through `.mcp.json`, exposing tools as
`mcp__chrome-devtools__*` — `new_page`, `navigate_page`, `take_screenshot`, `take_snapshot`,
`list_pages` and the rest.
<!--@common-->
There is no plugin mechanism on this end, so a `chrome-devtools` MCP exists only if the host was
configured with one. Look for a `chrome-devtools` tool family in the session — `new_page`,
`navigate_page`, `take_screenshot`, `take_snapshot`, `list_pages`.
<!--@end-->

- **Available** → call it directly. Connection details are already handled: the entry point at
  `${PLUGIN_ROOT}/skills/graceful-browser/scripts/start-chrome-devtools.sh` probes
  `127.0.0.1:9222` (override with `GRACEFUL_BROWSER_CDP_PORT`) and connects to a debuggable Chrome
  if one is there, otherwise launches one with its profile pinned to `~/.cdp` and the same port
  exposed so later sessions can reuse it.
- **Present but the call errors** — no Chrome installed, Chrome failed to start, the connection
  dropped. A first call can land while Chrome is still coming up, so on a connection-class error
  wait 3–5 seconds and retry once. Only then go to Step 3, and pass the error to the user verbatim
  rather than paraphrasing it.
- **Not present** → go to Step 3.

## Step 3 — Playwright fallback

<!--@claude-->
1. Check whether it is already installed:

   ```bash
   claude plugin list | grep -i playwright
   ```

2. **Installed** → probe this session for its tools (`ToolSearch` query `+playwright`). Present →
   use them. Absent → it was installed after this session started, so skip to point 4.
3. **Not installed** → install it. The install itself is seconds, but `npx` fetching
   `@playwright/mcp` for the first time can take tens of seconds, so run it in the background and
   keep working on the parts of the task that do not need a browser. Do not hand this to a
   subagent — it is a deterministic command, and a subagent pays context overhead to buy nothing:

   ```bash
   claude plugin install playwright@claude-plugins-official && \
     npx -y @playwright/mcp@latest --version   # warm the cache so the first connect is fast
   ```

4. Once installed, **tell the user to restart**. A new plugin's MCP server cannot hot-load into a
   running session — `claude plugin` says so itself. Ask them to exit and run `claude -c` to resume
   this conversation, then come back to point 2.
<!--@codex-->
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
<!--@common-->
1. Check whether the session already exposes a Playwright tool family. If it does, use it.
2. **It does not** → this end cannot install anything on the user's behalf, because there is no
   agreed configuration surface to write to. Show them the standard MCP server entry and let them
   add it wherever their host keeps that config:

   ```json
   { "command": "npx", "args": ["-y", "@playwright/mcp@latest"] }
   ```

   Warming the cache first with `npx -y @playwright/mcp@latest --version` avoids a slow first
   connect, since the initial fetch can take tens of seconds.
3. An MCP server generally cannot hot-load into a running session, so expect to continue in a new
   one.
<!--@end-->

## When all three fail

Say so plainly and stop, rather than substituting something that looks like progress. Reading a
page's HTML over HTTP is not browser automation — it cannot click, cannot see rendered layout,
cannot carry a session — and presenting it as though it were leaves the user believing a check
happened that did not. Name what you tried, name the error, and ask how they want to proceed.

## Notes

- **Long-running commands never block the main flow.** Installs and cache warm-ups belong in the
  background.
<!--@claude-->
  In Claude Code that is Bash with `run_in_background`; poll it while doing other work.
<!--@codex-->
  Use an execution session you can keep polling — hold the session id and collect output and the
  real exit code as it goes. Do not start orphan background processes you cannot manage.
<!--@end-->
- **Do not trigger native dialogs.** `alert`, `confirm`, `prompt` and modal file pickers block the
  automation channel, and recovering means asking the user to dismiss it by hand. If a flow
  unavoidably raises one, warn them before you click.
- **Screenshots are evidence, not decoration.** Take one at the moment a claim is made — "the form
  submitted", "the error is gone" — so the claim is checkable rather than asserted.
