---
name: graceful-browser
description: 浏览器操控的框架选择与降级策略 —— 在 Codex 原生浏览器（@Chrome / @Browser）、chrome-devtools MCP、Playwright 三者间选出当前环境最合适的浏览器自动化框架。凡是任务需要和网页交互，先用本 skill 决定框架再动手：打开网页、截图、填表单、点击元素、登录后验证、E2E / 看板可视化检查、调试页面 DOM 或网络请求。即使用户没有明说"浏览器"三个字，只要要操作网页，先读本 skill。
---

# Graceful Browser — 浏览器框架选择（Codex 版）

操控浏览器有三条路，能力与体验差异很大。按下表优先级选择，高优先级不可用时降级到下一级；一次任务选定一个框架就用到底，不要中途混用（不同框架各管各的浏览器实例，状态不互通）。

> **求同存异**：本 skill 与 Claude 侧主流程一致（同样三级选择 + 降级 + 失败透明），仅把第 1 优先级换成 Codex 的原生浏览器栈；第 2、3 级（chrome-devtools MCP / Playwright）两侧共用兜底。

| 优先级 | 框架 | 为什么 | 可用环境 |
|--------|------|--------|----------|
| 1 | Codex 原生浏览器（`@Chrome` / 内置 `@Browser`） | `@Chrome` 直接驱动用户登录态的真实浏览器；内置 `@Browser` 是受控浏览器，可点击 / 输入 / 截图 / 检查 | **仅 Codex 桌面 App（macOS）** |
| 2 | chrome-devtools MCP（本插件自带） | 独立受控 Chrome，零配置开箱即用；自动复用已有调试浏览器或自启 | CLI / 桌面 App 均可 |
| 3 | Playwright MCP | 兜底：前两者都不可用时（如 chrome-devtools 异常，或 CLI 环境且无原生浏览器） | CLI / 桌面 App 均可 |

## 第 1 步：检测 Codex 原生浏览器

判断当前是否运行在 **Codex 桌面 App（macOS）** 且原生浏览器可用：

- **需要登录态 / Cookie / 扩展 / 已登录页面** → 用 `@Chrome`（驱动用户真实浏览器）。
- **localhost 或公开页面、无需登录** → 用内置 `@Browser`（受控浏览器：导航 / 点击 / 输入 / 截图 / 只读 JS）。
- **可用** → 直接使用对应原生浏览器，选择结束。
- **不可用**（当前是 `@openai/codex` **CLI**，仅有文本能力，无原生浏览器；或非 macOS 桌面环境）→ 进入第 2 步。不要尝试在 CLI 内启用原生浏览器：它是桌面 App 特性，CLI 会话内无法补开；第 2 步的体验已经足够好。

> 约束：内置 `@Browser` **不支持**鉴权流程、已登录页面、扩展或既有 Cookie——这些场景必须用 `@Chrome`。Computer Use（在任意 Mac App 内看 / 点 / 输入）能力更广但与网页设计类任务相关性低，本 skill 不优先走它。

## 第 2 步：chrome-devtools MCP

本插件通过 `.mcp.json` 提供 `chrome-devtools` MCP server，工具以 `mcp__chrome-devtools__*` 暴露（如 `mcp__chrome-devtools__new_page` / `navigate_page` / `take_screenshot` / `take_snapshot` / `list_pages`）。

- **工具可用** → 直接调用。连接细节不用操心：MCP 的启动入口（`scripts/start-chrome-devtools.sh`）已在会话启动时处理好——本机有可调试 Chrome（默认探测 `127.0.0.1:9222`，可用 `GRACEFUL_BROWSER_CDP_PORT` 覆盖）就直连复用，没有就自启一个（profile 在 `~/.cdp`，并开放同端口供后续会话复用）。
- **工具存在但调用报错**（本机没装 Chrome、Chrome 启动失败、连接断开）→ 注意首次调用可能恰逢 Chrome 正在启动，连接类报错先等 3–5 秒再重试一次；仍失败才进入第 3 步，并把报错原样告知用户。
- **工具不存在**（plugin 未安装 / MCP 未加载，例如 skill 被单独安装）→ 进入第 3 步。

## 第 3 步：Playwright 兜底

1. 检测会话内是否已有 playwright MCP 工具（`mcp__playwright__*`）。有就直接用。
2. **没有** → 在 `~/.codex/config.toml` 的 `[mcp_servers]` 增加一个 playwright server，或用 `codex mcp add` 注册：

   ```toml
   [mcp_servers.playwright]
   command = "npx"
   args = ["-y", "@playwright/mcp@latest"]
   ```

   首次 `npx` 拉取 `@playwright/mcp` 可能要几十秒，可先 `npx -y @playwright/mcp@latest --version` 预热包缓存。这是确定性命令，不要为此 spawn 子代理——没有收益只有开销。
3. 新增 MCP server 后**提示用户新开 thread / 重启 Codex** 生效：新的 MCP server 无法在当前会话热加载。重启回来后回到本步骤第 1 点，直接使用 playwright 工具。

## 注意事项

- **选择只做一次**：任务开始时走一遍流程，之后同一任务内沿用选定框架，除非它中途彻底不可用。
- **失败要透明**：发生降级时，用一句话告诉用户从哪级降到了哪级、原因是什么，避免用户疑惑为什么没用上自己的浏览器。
- **长耗时安装一律后台执行**：本 skill 涉及的安装 / 预热命令都放后台跑，不阻塞主流程，也不 spawn 子代理。
