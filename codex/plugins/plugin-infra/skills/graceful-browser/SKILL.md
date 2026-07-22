---
name: graceful-browser
description: 为网页交互选择当前会话真实可用的浏览器能力并透明降级。用于打开网页、截图、填表、登录态验证、DOM/网络调试与浏览器 E2E。
---

# Graceful Browser — 浏览器框架选择（Codex 版）

先枚举当前会话实际暴露的 app / connector / built-in / MCP 工具，再按下表选择。
不要仅凭“CLI/桌面端”猜测能力。高优先级不可用时降级；一次任务选定一个框架
就用到底（不同框架的浏览器状态通常不互通）。

> **求同存异**：本 skill 与 Claude 侧主流程一致（同样三级选择 + 降级 + 失败透明），仅把第 1 优先级换成 Codex 的原生浏览器栈；第 2、3 级（chrome-devtools MCP / Playwright）两侧共用兜底。

| 优先级 | 框架 | 为什么 | 可用环境 |
|--------|------|--------|----------|
| 1 | 会话已暴露的专用浏览器 app / connector / built-in | 最贴近当前界面；可能复用登录态 | 以实际工具清单为准 |
| 2 | chrome-devtools MCP（本插件自带） | 独立受控 Chrome，零配置开箱即用；自动复用已有调试浏览器或自启 | CLI / 桌面 App 均可 |
| 3 | Playwright MCP | 兜底：前两者都不可用时（如 chrome-devtools 异常，或 CLI 环境且无原生浏览器） | CLI / 桌面 App 均可 |

## 第 1 步：能力发现

查看当前工具清单与已安装 app / connector。只有能力实际出现时才选择它：

- **需要登录态 / Cookie / 扩展 / 已登录页面** → 用 `@Chrome`（驱动用户真实浏览器）。
- **localhost 或公开页面、无需登录** → 用内置 `@Browser`（受控浏览器：导航 / 点击 / 输入 / 截图 / 只读 JS）。
- **可用** → 直接使用对应原生浏览器，选择结束。
- **未暴露** → 进入第 2 步；不要根据产品名臆造工具。

> 需要既有登录态时优先选择明确声明能复用用户浏览器会话的 connector；受控浏览器
> 是否支持 Cookie/鉴权以当前能力说明为准。

## 第 2 步：chrome-devtools MCP

本插件通过 `.mcp.json` 提供 `chrome-devtools` MCP server，工具以 `mcp__chrome-devtools__*` 暴露（如 `mcp__chrome-devtools__new_page` / `navigate_page` / `take_screenshot` / `take_snapshot` / `list_pages`）。

- **工具可用** → 直接调用。连接细节不用操心：MCP 的启动入口（`scripts/start-chrome-devtools.sh`）已在会话启动时处理好——本机有可调试 Chrome（默认探测 `127.0.0.1:9222`，可用 `GRACEFUL_BROWSER_CDP_PORT` 覆盖）就直连复用，没有就自启一个（profile 在 `~/.cdp`，并开放同端口供后续会话复用）。
- **工具存在但调用报错**（本机没装 Chrome、Chrome 启动失败、连接断开）→ 注意首次调用可能恰逢 Chrome 正在启动，连接类报错先等 3–5 秒再重试一次；仍失败才进入第 3 步，并把报错原样告知用户。
- **工具不存在**（plugin 未安装 / MCP 未加载，例如 skill 被单独安装）→ 进入第 3 步。

## 第 3 步：Playwright 兜底

1. 检测会话内是否已有 playwright MCP 工具（`mcp__playwright__*`）。有就直接用。
2. **没有** → 提供配置示例并征得用户同意后，再修改个人 `config.toml` 或运行 `codex mcp add`：

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
- **长耗时命令使用可持续轮询的执行会话**：保留 session id，定期回收输出和真实退出码；
  不启动无法管理的孤儿后台进程，也不为安装 spawn 子代理。
