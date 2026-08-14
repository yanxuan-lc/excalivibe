---
name: graceful-browser
description: Settle which browser automation stack to use before touching a web page, and degrade transparently when the preferred one is not available. Use this whenever a task has to drive a browser — opening a page, taking a screenshot, filling a form, clicking through a flow, checking something behind a login, verifying a deployed page, watching console errors, or inspecting network traffic. Read it first even when the word "browser" never appears; "check what this page shows", "grab a screenshot of the dashboard", "does the sign-up flow still work" and "why is this request failing in the app" all need the framework settled before the first tool call. It applies wherever the answer depends on a page actually rendering and responding in a web browser — what it displays, how it behaves when driven, what it logs — while a URL whose content is the whole answer is a plain HTTP request.
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
| 1 | whatever browser tooling the host already exposes in this session | Closest to the current surface, and may reuse real login state |
| 2 | a `chrome-devtools` MCP server, if the host has one configured | An independent controlled Chrome that reuses a debuggable Chrome if one is running |
| 3 | a Playwright MCP server, if the host has one configured | Fallback for when neither of the above is present |

This end assumes nothing about what is installed. Levels 2 and 3 are only reachable if the host's
own configuration provides them — read the session's tool list rather than trusting this table.

## Step 1 — the session's own browser

Read the tool list this session actually exposes and look for browser control among it. Hosts vary
widely here, and the names vary with them, so match on what the tools *do* rather than on an
expected prefix.

- **A browser tool family is present** → use it, and prefer the one whose own description claims it
  can reuse the user's real session when login state matters.
- **Nothing browser-shaped is exposed** → go to Step 2. Do not infer a capability from the host's
  marketing name.

## Step 2 — a Chrome DevTools MCP

There is no plugin mechanism on this end, so a `chrome-devtools` MCP exists only if the host was
configured with one. Look for a `chrome-devtools` tool family in the session — `new_page`,
`navigate_page`, `take_screenshot`, `take_snapshot`, `list_pages`.

- **Available** → call it directly. Connection details are already handled: the entry point at
  `.agents/skills/graceful-browser/scripts/start-chrome-devtools.sh` probes
  `127.0.0.1:9222` (override with `GRACEFUL_BROWSER_CDP_PORT`) and connects to a debuggable Chrome
  if one is there, otherwise launches one with its profile pinned to `~/.cdp` and the same port
  exposed so later sessions can reuse it.
- **Present but the call errors** — no Chrome installed, Chrome failed to start, the connection
  dropped. A first call can land while Chrome is still coming up, so on a connection-class error
  wait 3–5 seconds and retry once. Only then go to Step 3, and pass the error to the user verbatim
  rather than paraphrasing it.
- **Not present** → go to Step 3.

## Step 3 — Playwright fallback

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

## When all three fail

Say so plainly and stop, rather than substituting something that looks like progress. Reading a
page's HTML over HTTP is not browser automation — it cannot click, cannot see rendered layout,
cannot carry a session — and presenting it as though it were leaves the user believing a check
happened that did not. Name what you tried, name the error, and ask how they want to proceed.

## Notes

- **Long-running commands never block the main flow.** Installs and cache warm-ups belong in the
  background.
- **Do not trigger native dialogs.** `alert`, `confirm`, `prompt` and modal file pickers block the
  automation channel, and recovering means asking the user to dismiss it by hand. If a flow
  unavoidably raises one, warn them before you click.
- **Screenshots are evidence, not decoration.** Take one at the moment a claim is made — "the form
  submitted", "the error is gone" — so the claim is checkable rather than asserted.
