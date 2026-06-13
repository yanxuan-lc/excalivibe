---
name: graceful-browser
description: 浏览器操控的框架选择与降级策略 —— 在 claude --chrome、chrome-devtools MCP、Playwright 三者间选出当前环境最合适的浏览器自动化框架。凡是任务需要和网页交互，先用本 skill 决定框架再动手：打开网页、截图、填表单、点击元素、登录后验证、E2E / 看板可视化检查、调试页面 DOM 或网络请求。即使用户没有明说"浏览器"三个字，只要要操作网页，先读本 skill。
---

# Graceful Browser — 浏览器框架选择

操控浏览器有三条路，能力与体验差异很大。按下表优先级选择，高优先级不可用时降级到下一级；一次任务选定一个框架就用到底，不要中途混用（不同框架各管各的浏览器实例，状态不互通）。

| 优先级 | 框架 | 为什么 |
|--------|------|--------|
| 1 | claude --chrome（Claude in Chrome） | 直接驱动用户真实浏览器：共享登录态、Cookie、扩展，所见即所得 |
| 2 | chrome-devtools MCP（本插件自带） | 独立受控 Chrome，零配置开箱即用；自动复用已有调试浏览器或自启 |
| 3 | Playwright 插件 | 兜底：前两者都不可用时（如 chrome-devtools 异常） |

## 第 1 步：检测 claude --chrome

用 ToolSearch 探测（顺手把核心工具一并加载，避免二次往返）：

```
ToolSearch query: "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp"
```

- **找到** → 用户已启用 claude --chrome，直接使用 `mcp__claude-in-chrome__*` 工具族，选择结束。先调 `tabs_context_mcp` 了解现有标签页，再决定复用还是新建。
- **找不到** → 未启用，进入第 2 步。不要尝试帮用户启用：`--chrome` 是 CLI 启动参数，会话内无法补开；也不必建议用户重启加上，第 2 步的体验已经足够好。

## 第 2 步：chrome-devtools MCP

探测本插件自带的工具族：

```
ToolSearch query: "select:mcp__plugin_plugin-infra_chrome-devtools__list_pages,mcp__plugin_plugin-infra_chrome-devtools__new_page,mcp__plugin_plugin-infra_chrome-devtools__navigate_page,mcp__plugin_plugin-infra_chrome-devtools__take_screenshot,mcp__plugin_plugin-infra_chrome-devtools__take_snapshot"
```

- **找到** → 直接调用。连接细节不用操心：MCP 的启动入口（`scripts/start-chrome-devtools.sh`）已在会话启动时处理好——本机有可调试 Chrome（默认探测 `127.0.0.1:9222`，可用 `GRACEFUL_BROWSER_CDP_PORT` 覆盖）就直连复用，没有就自启一个（profile 在 `~/.cdp`，并开放同端口供后续会话复用）。
- **工具存在但调用报错**（本机没装 Chrome、Chrome 启动失败、连接断开）→ 注意首次调用可能恰逢 Chrome 正在启动，连接类报错先等 3–5 秒再重试一次；仍失败才进入第 3 步，并把报错原样告知用户。
- **工具不存在**（skill 被单独安装、插件 MCP 未加载）→ 进入第 3 步。

## 第 3 步：Playwright 兜底

1. 检测是否已安装：

   ```bash
   claude plugin list | grep -i playwright
   ```

2. **已安装** → 探测会话内的 playwright MCP 工具（ToolSearch query `+playwright`）。有就直接用；没有说明插件是本会话启动后才装好的，跳到第 4 点提示重启。
3. **未安装** → 自动安装。安装本身几秒完成，但 `npx` 首次拉取 `@playwright/mcp` 可能要几十秒，所以放后台跑（Bash 的 `run_in_background`），期间继续处理任务中不依赖浏览器的部分；不要为此派子代理——这是确定性命令，子代理没有收益只有开销：

   ```bash
   claude plugin install playwright@claude-plugins-official && \
     npx -y @playwright/mcp@latest --version   # 预热包缓存，重启后首次连接更快
   ```

4. 安装完成后**提示用户重启会话**：新插件的 MCP server 无法在当前会话热加载（`claude plugin` 官方文案即 "restart required to apply"）。告诉用户——退出当前会话后执行 `claude -c` 恢复对话；重启回来后回到本步骤第 2 点，直接使用 playwright 工具。

## 注意事项

- **选择只做一次**：任务开始时走一遍流程，之后同一任务内沿用选定框架，除非它中途彻底不可用。
- **失败要透明**：发生降级时，用一句话告诉用户从哪级降到了哪级、原因是什么，避免用户疑惑为什么没用上自己的浏览器。
- **长耗时安装一律后台 Bash**：本 skill 涉及的安装/预热命令都用 `run_in_background`，不阻塞主流程，也不派子代理。
