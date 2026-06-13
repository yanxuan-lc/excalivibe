# plugin-infra

**通用基础设施 plugin**。

定位：为上层业务 plugin 提供**跨场景复用**的基础能力（Skill + MCP），不绑定具体业务领域、也不绑定数据源（数据源接入见 `datasource-plugin`）。上层 plugin 通过声明依赖即可默认获得这些能力，无需各自重复声明。

当前覆盖：

| 能力 | 类型 | 名称 | 说明 |
|------|------|------|------|
| 浏览器框架选择与降级 | Skill | `graceful-browser` | 在 claude --chrome / chrome-devtools MCP / Playwright 间自动选出当前环境最合适的浏览器操控框架 |
| Chrome DevTools（浏览器导航 / 截图 / DOM 检查） | MCP（stdio） | `chrome-devtools` | 零配置开箱即用，自动复用已有调试 Chrome 或自启 |

## graceful-browser Skill

凡是任务需要操控浏览器（打开网页、截图、填表单、E2E 验证、看板检查……），skill 按以下优先级选择框架，高优先级不可用时自动降级：

1. **claude --chrome（Claude in Chrome）**：用户以 `claude --chrome` 启动会话时直接驱动其真实浏览器——共享登录态、Cookie、扩展，体验最好。
2. **chrome-devtools MCP**（本插件自带）：独立受控 Chrome 实例，连接/自启逻辑见下节，无需任何配置。
3. **Playwright**（兜底）：检测到未安装时，skill 会自动安装官方 `playwright@claude-plugins-official` 插件（安装放后台执行），完成后提示重启会话生效。

降级发生时 skill 会向用户说明原因，不会静默切换。

## Chrome DevTools MCP

Google 官方的 [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)。本插件以 `skills/graceful-browser/scripts/start-chrome-devtools.sh` 作为启动入口，实现「**有则连、无则启**」：

- 本机已有可调试 Chrome（探测 `127.0.0.1:9222` 的 CDP 端点）→ `--browserUrl` 直连复用，不新开浏览器；
- 没有 → 由 chrome-devtools-mcp 自启 Chrome：profile 固定在 `~/.cdp`，并开放同一调试端口，后续 Claude 会话可直连复用同一实例。

配置项：

- **CDP 端口**：默认 `9222`，可用环境变量 `GRACEFUL_BROWSER_CDP_PORT` 覆盖（需 export 在启动 `claude` 的那个 shell 中，MCP 子进程继承自 CLI 环境）。
- **前置依赖**：本机需装有 Node.js LTS、Chrome 与 `curl`（macOS / 主流 Linux 自带；缺 curl 时探测静默跳过，总是走自启分支）。
- **其他官方 flag**（`--headless`、`--isolated`、`--viewport` 等）：如有需要，在 `~/.claude.json` 的 `mcpServers.chrome-devtools` 里整条覆盖本插件的默认配置。注意整条覆盖即绕过 wrapper，会**失去「有则连、无则启」的探测复用**，退化为每次直启。

## 目录结构

```
plugin-infra/
├── .claude-plugin/
│   └── plugin.json                  # 插件清单
├── .mcp.json                        # MCP 配置（chrome-devtools，经 wrapper 启动）
├── skills/
│   └── graceful-browser/
│       ├── SKILL.md                 # 浏览器框架选择 skill
│       └── scripts/
│           └── start-chrome-devtools.sh  # chrome-devtools 启动入口（有则连、无则启）
└── README.md
```

## 设计要点

- **基础设施层，与 datasource-plugin 平行**：`datasource-plugin` 管"数据从哪来"（Doris 等数据源 MCP + 鉴权），`plugin-infra` 管"通用工具能力"（浏览器自动化等），两者都被上层业务 plugin 通过 `dependencies` 复用。
- **无凭据 / 无业务耦合**：这里只放不需要 token、不绑定具体业务的通用能力；需要鉴权的数据源仍归 `datasource-plugin`。
- **开箱即用优先**：chrome-devtools MCP 不依赖 graceful-browser skill 也能独立工作（上层 plugin 直接调工具时同样享受"有则连、无则启"），skill 只负责框架选择与降级编排。
- **后续扩展**：未来通用能力（如文件系统、截图 OCR、通用 HTTP 抓取等）可继续往这里加，保持"一处声明、多处复用"。
