#!/bin/sh
# chrome-devtools MCP entry point: reuse a reachable Chrome, otherwise start one.
#
# - Probe the CDP endpoint on 127.0.0.1:$PORT (9222 by default, override with
#   GRACEFUL_BROWSER_CDP_PORT):
#   - reachable → connect via --browserUrl and reuse it; do not open another browser
#   - unreachable → let chrome-devtools-mcp launch Chrome itself (it carries the
#     cross-platform Chrome-location logic), pinning the profile to ~/.cdp and exposing the
#     same debugging port so later Claude sessions can connect straight to it
#
# Note: this script carries the MCP protocol over stdio, so every probe command must be
# completely silent.
set -eu

PORT="${GRACEFUL_BROWSER_CDP_PORT:-9222}"

# A first-time npx fetch can emit fund/audit/notice output; suppress that noise so it cannot
# reach the protocol stream
export npm_config_loglevel=error npm_config_fund=false npm_config_audit=false

if curl -sf --max-time 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  exec npx -y chrome-devtools-mcp@latest --browserUrl "http://127.0.0.1:${PORT}"
fi

mkdir -p "$HOME/.cdp"
exec npx -y chrome-devtools-mcp@latest \
  --userDataDir "$HOME/.cdp" \
  --chromeArg="--remote-debugging-port=${PORT}"
