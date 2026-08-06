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

| priority | stack | why it ranks here |
|---|---|---|
| 1 | `claude --chrome` (Claude in Chrome) | Drives the user's real browser — their login state, cookies, extensions. What you see is what they see |
| 2 | the `chrome-devtools` MCP this plugin ships | An independent controlled Chrome, zero config; reuses a debuggable Chrome if one is running, launches one if not |
| 3 | the Playwright plugin | Fallback for when neither of the above works |

## Step 1 — the session's own browser

Probe for it, loading the core tools in one call so a hit does not cost a second round-trip:

```
ToolSearch query: "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp"
```

- **Found** → selection done. Call `tabs_context_mcp` first to see what the user already has open,
  then decide whether to reuse a tab or create one. Never reuse a tab id from an earlier session.
- **Not found** → `--chrome` is a launch flag and cannot be turned on mid-session, so go to Step 2.
  Do not ask the user to restart for it; Step 2 is good enough that the interruption is not worth
  it.

## Step 2 — a Chrome DevTools MCP

Probe the tool family this plugin bundles:

```
ToolSearch query: "select:mcp__plugin_computer-use_chrome-devtools__list_pages,mcp__plugin_computer-use_chrome-devtools__new_page,mcp__plugin_computer-use_chrome-devtools__navigate_page,mcp__plugin_computer-use_chrome-devtools__take_screenshot,mcp__plugin_computer-use_chrome-devtools__take_snapshot"
```

- **Available** → call it directly. Connection details are already handled: the entry point at
  `${CLAUDE_PLUGIN_ROOT}/skills/graceful-browser/scripts/start-chrome-devtools.sh` probes
  `127.0.0.1:9222` (override with `GRACEFUL_BROWSER_CDP_PORT`) and connects to a debuggable Chrome
  if one is there, otherwise launches one with its profile pinned to `~/.cdp` and the same port
  exposed so later sessions can reuse it.
- **Present but the call errors** — no Chrome installed, Chrome failed to start, the connection
  dropped. A first call can land while Chrome is still coming up, so on a connection-class error
  wait 3–5 seconds and retry once. Only then go to Step 3, and pass the error to the user verbatim
  rather than paraphrasing it.
- **Not present** → go to Step 3.

## Step 3 — Playwright fallback

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

## When all three fail

Say so plainly and stop, rather than substituting something that looks like progress. Reading a
page's HTML over HTTP is not browser automation — it cannot click, cannot see rendered layout,
cannot carry a session — and presenting it as though it were leaves the user believing a check
happened that did not. Name what you tried, name the error, and ask how they want to proceed.

## Notes

- **Long-running commands never block the main flow.** Installs and cache warm-ups belong in the
  background.
  In Claude Code that is Bash with `run_in_background`; poll it while doing other work.
- **Do not trigger native dialogs.** `alert`, `confirm`, `prompt` and modal file pickers block the
  automation channel, and recovering means asking the user to dismiss it by hand. If a flow
  unavoidably raises one, warn them before you click.
- **Screenshots are evidence, not decoration.** Take one at the moment a claim is made — "the form
  submitted", "the error is gone" — so the claim is checkable rather than asserted.
