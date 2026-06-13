#!/bin/sh
# chrome-devtools MCP 启动入口：有可连接的 Chrome 就直连，没有就自启。
#
# - 探测 127.0.0.1:$PORT 上的 CDP 端点（默认 9222，可用 GRACEFUL_BROWSER_CDP_PORT 覆盖）：
#   - 可达 → --browserUrl 直连复用，不新开浏览器；
#   - 不可达 → 交给 chrome-devtools-mcp 自启 Chrome（它内置跨平台的 Chrome 定位逻辑），
#     profile 固定在 ~/.cdp，并开放同一调试端口，供后续 Claude 会话直连复用。
#
# 注意：本脚本经 stdio 承载 MCP 协议，探测命令的输出必须全部静默。
set -eu

PORT="${GRACEFUL_BROWSER_CDP_PORT:-9222}"

# npx 首次拉包可能产生 fund/audit/notice 输出，压制到 stderr 之外的噪音，保护协议流
export npm_config_loglevel=error npm_config_fund=false npm_config_audit=false

if curl -sf --max-time 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  exec npx -y chrome-devtools-mcp@latest --browserUrl "http://127.0.0.1:${PORT}"
fi

mkdir -p "$HOME/.cdp"
exec npx -y chrome-devtools-mcp@latest \
  --userDataDir "$HOME/.cdp" \
  --chromeArg="--remote-debugging-port=${PORT}"
