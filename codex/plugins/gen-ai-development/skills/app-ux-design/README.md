# app-ux-design

一个面向 Codex 的**交互式 UI/UX 设计 skill**：把一句模糊的需求（"帮我设计一个
IM 首页"、"做个数据看板"、"调下这块的视觉"）变成一个**能跑、能实时迭代的组件化前端原型** ——
覆盖 App、桌面应用、网页、移动端等各种 GUI 形态。

底层不是 HTML mockup，而是真正的 **Vite + React 19 + TypeScript + Tailwind v4 +
shadcn/ui + Zustand + TanStack (Query / Router / Table)** 工程，技术栈与研发线上代码一致。

**设计判断**交给 `ui-ux-pro-max` skill（50+ 风格 / 161 配色 / 57 字体搭配 / 99 条 UX
规则），本 skill 负责在对话里驱动它、并把它的产出落成运行代码。
用户通过两种方式给反馈：直接和 Codex 对话，或在浏览器里用 DevTools 风格的 Inspect
面板点选元素、改文案 / 改样式 / 留批注。

## 工作流

| 步骤 | 做什么 | 由谁驱动 |
|------|--------|----------|
| 0 阶段识别 | 新任务 vs 恢复已有设计（扫 `docs/ued/` 下的目录） | Agent |
| 1 模式识别 + 需求对齐 | 全新设计 / 参考设计 / 延续设计；对齐用途·受众·平台·调性 | Agent ↔ 用户 |
| 2 设计方案 | 调 `ui-ux-pro-max` 出设计系统 → 对话敲定 → 落 `design-system/MASTER.md` + 写 `tokens.css` | Agent ↔ ui-ux-pro-max ↔ 用户 |
| 3 原型预览 | scaffold 到 `docs/ued/<datetime>-<topic>/` → `pnpm dev` 起 HTTP 服务 | Agent |
| 4 原型迭代 | (a) chat 对话改代码；(b) Inspect 面板点选元素改 | 用户 ↔ Agent |

完整规则见 [`SKILL.md`](./SKILL.md)，架构细节见 [`ARCHITECTURE.md`](./ARCHITECTURE.md)。

## 三种模式

- **全新设计** — 从零做，无参考无既有规约。ui-ux-pro-max 全新出方案。
- **参考设计** — 你给参考（截图 / 某产品 / 某网站）**并说明借鉴范围**（只借配色 / 只借布局 /
  只借交互）。被借鉴的维度覆盖 ui-ux-pro-max 的推荐，其余由它补全。
- **延续设计** — 你给既有设计规约（通常是上次的 `design-system/MASTER.md`）。视为权威，只为
  没覆盖到的新维度 / 新页面调用 ui-ux-pro-max，不擅自改已定的 token。

## 前置依赖

- **Node ≥ 20**、**pnpm ≥ 9**（`corepack enable` 或 `npm i -g pnpm`）
- **`ui-ux-pro-max` skill** 已安装（本 skill 依赖它做设计决策）
- **python3**（ui-ux-pro-max 的 search CLI 需要）
- 现代浏览器（用于打开预览 shell）

## 怎么用（人类视角）

你不用手动跑任何命令。在 Codex 里直接用自然语言提需求即可，常见触发说法：

- "帮我设计一个 X 的页面 / dashboard / 落地页 / 移动端"
- "一起做个 X 的设计 / mockup / 原型"
- "调下这块的样式 / 风格 / 视觉 / 交互"
- "照着这张截图的配色做"、"在原来的规约上加个设置页"

Codex 会：先和你对齐需求与模式 → 调 ui-ux-pro-max 敲定设计系统 → 在
`docs/ued/<datetime>-<topic>/` 下 scaffold 一个 Vite 工程并 `pnpm dev` → 把
`http://localhost:5173/__ued/shell` 发给你预览 → 你开 Inspect 点元素改，或直接对话让它改。

中途随时可以离开。下次说"继续做 …的设计"即可恢复——Agent 会从工作目录里读出 brief、
设计系统、已实现的 screens、未消化的 inspect 事件。

## 仓库结构

```
.
├── SKILL.md              # Codex 读取的工作流指令（先读这个）
├── ARCHITECTURE.md       # 各部分如何拼装
├── framework/            # Vite 插件 app-ux-framework：shell + inspect 桥 + state/devices/inspect 端点
│   ├── src/index.mjs     # 插件入口 — uedFramework({ stateDir })
│   ├── src/middleware/   # devices / state / inspect
│   ├── src/pages/shell.mjs
│   └── overlay/          # 注入到页面的 inspect-bridge.js + shell.js/css
├── template/             # Vite + TS + React 19 + Tailwind v4 + shadcn + Zustand + TanStack 起手模板
├── scripts/scaffold.mjs  # 复制 template → docs/ued/<datetime>-<topic>/ 并 pnpm install
└── data/devices.json     # shell 里的 手机 / 平板 / 桌面 / Web 设备规格
```

## 扩展

- **加设备型号** — 往 `data/devices.json` 里加（每条需要 `id` / `name` / `w` / `h`，
  可选 `shellRadius` / `notch` / `chrome`）。
- **加技术栈模板** — 复制一个 `template-<name>/` 并让 scaffold 按 flag 选用。
