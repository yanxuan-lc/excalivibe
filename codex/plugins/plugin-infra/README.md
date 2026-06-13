# plugin-infra（Codex 版）

**通用基础设施 plugin**。与 Claude 侧主流程一致，仅在浏览器框架的第 1 优先级上改用 Codex 原生浏览器栈（求同存异）。

定位：为上层业务 plugin 提供**跨场景复用**的基础能力（Skill + MCP），不绑定具体业务领域、也不绑定数据源。

当前覆盖：

| 能力 | 类型 | 名称 | 说明 |
|------|------|------|------|
| 浏览器框架选择与降级 | Skill | `graceful-browser` | 在 Codex 原生浏览器（`@Chrome` / `@Browser`）/ chrome-devtools MCP / Playwright 间自动选出当前环境最合适的浏览器操控框架 |
| Chrome DevTools（浏览器导航 / 截图 / DOM 检查） | MCP（stdio） | `chrome-devtools` | 零配置开箱即用，自动复用已有调试 Chrome 或自启 |

## graceful-browser Skill

凡是任务需要操控浏览器，skill 按以下优先级选择框架，高优先级不可用时自动降级：

1. **Codex 原生浏览器**（仅桌面 App / macOS）：`@Chrome` 驱动登录态真实浏览器；内置 `@Browser` 为受控浏览器。`@openai/codex` CLI 无原生浏览器，自动降级到第 2 级。
2. **chrome-devtools MCP**（本插件自带）：独立受控 Chrome 实例，连接 / 自启逻辑见下节，无需任何配置。
3. **Playwright**（兜底）：未安装时在 `~/.codex/config.toml` 的 `[mcp_servers]` 注册，新开 thread 生效。

降级发生时 skill 会向用户说明原因，不会静默切换。

## Chrome DevTools MCP

Google 官方的 [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)。本插件以 `skills/graceful-browser/scripts/start-chrome-devtools.sh` 作为启动入口，实现「**有则连、无则启**」：

- 本机已有可调试 Chrome（探测 `127.0.0.1:9222` 的 CDP 端点）→ `--browserUrl` 直连复用，不新开浏览器；
- 没有 → 由 chrome-devtools-mcp 自启 Chrome：profile 固定在 `~/.cdp`，并开放同一调试端口，后续会话可直连复用同一实例。

配置项：

- **CDP 端口**：默认 `9222`，可用环境变量 `GRACEFUL_BROWSER_CDP_PORT` 覆盖（需 export 在启动 `codex` 的那个 shell 中，MCP 子进程继承自 CLI 环境）。
- **前置依赖**：本机需装有 Node.js LTS、Chrome 与 `curl`。
- **插件根变量**：`.mcp.json` 通过 `${CLAUDE_PLUGIN_ROOT}` 定位 wrapper 脚本；Codex 为兼容既有插件 hook 同样注入该变量，故可直接复用。

## 目录结构

```
plugin-infra/
├── .codex-plugin/
│   └── plugin.json                  # 插件清单（含 interface）
├── .mcp.json                        # MCP 配置（chrome-devtools，经 wrapper 启动）
├── skills/
│   └── graceful-browser/
│       ├── SKILL.md                 # 浏览器框架选择 skill（Codex 版）
│       └── scripts/
│           └── start-chrome-devtools.sh  # chrome-devtools 启动入口（有则连、无则启）
└── README.md
```
