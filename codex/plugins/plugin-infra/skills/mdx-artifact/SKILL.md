---
name: mdx-artifact
description: 将报告、方案、Markdown 或分析结论写成组件化 MDX，并用全局 CLI `mdxv` 起本地预览给人阅读。用于“美化文档”“整理成好看的文档”“做成可交付网页”；不用于实时 Web 应用。
---

# mdx-artifact — 面向 Agent，为人类输出富文档产物

Agent 产的 Markdown 省 token 但给人看太素。本 skill 让你写 **MDX**（Markdown + 组件标签），交给
**[mdx-viewer](https://github.com/yanxuan-lc/mdx-viewer)**（独立的全局 npm 包）渲染成配色统一、结构清晰、带轻交互的网页，人在浏览器里读。

## 核心心智模型

```
你（Agent）写 a.mdx        →   mdxv a.mdx   →   人在浏览器读（改 mdx 自动刷新）
Markdown + <组件>              全局 CLI          主题化 · 悬浮目录 · 图 · 公式
```

**你只交付 `.mdx`**——不写 CSS、不写 HTML 骨架、不写坐标，呈现由组件合成。渲染器不在本仓库：**本 skill 只负责「怎么写」与「怎么给人看」**。

## 工具就绪与预览

渲染器是全局命令 `mdxv`，与本仓库解耦，在任意目录都能用：

```bash
command -v mdxv >/dev/null || npm install -g mdx-viewer   # 仅首次；已装则跳过
mdxv path/to/doc.mdx        # 以该文件所在目录为根，打开这一篇（改 mdx 热更新）
mdxv path/to/docs/          # 以目录为根，打开首篇（优先 README/index）；多篇时左侧出文件抽屉
mdxv demo                   # 随包组件总览——想确认某组件长什么样，直接看这个
```

- **预览是常驻进程**：**后台启动**（`mdxv doc.mdx --no-open &`，或用运行时的后台执行能力），把它打印的
  `http://localhost:4321/?doc=…` 交给用户，别在前台等它退出。用完主动停掉。
- 常用参数：`--port <n>`（默认 4321）、`--host`、`--no-open`（不自动开浏览器）、`--lang zh-CN|en-US`。
- **不能全局装包时**（权限受限）用免装兜底：`npx -p mdx-viewer mdxv doc.mdx`。
- **多文档树导航**：以目录为根时，正文里指向本地 `.md`/`.mdx`/目录的**相对链接会自动路由**（点击即在预览内互跳；目录链接按 `README.mdx` 索引约定解析），外链/锚点不动——用自然的 Markdown 相对链接就能串起整棵树。注：Markdown 本就是合法 MDX，`.md` 文件也能直接预览。
- **语言变体**：同名兄弟文件加 locale 后缀（`guide.zh-CN.mdx` / `guide.en-US.mdx`）会被合并成一个导航项，按界面语言选中对应变体，缺失时回落无后缀版本。

> 组件与参数的**权威源是 mdx-viewer 本身**（本 skill 对齐 ≥ 0.1.0，`mdxv --version` 可查）。下面的写法约定与 `references/blocks.md` 是精简速查；两者对不上时以包为准，并顺手回修本 skill。

## 文档骨架（务必遵循）

**头部（标题/副标题）→ 导语 → 分节正文 → 页脚寄语 → 落款**。frontmatter 有 `title` 即自动生成 Hero 头部；最底部自动追加**落款**（作者 · 编辑时间 · 版权 + 渲染器署名）。

```mdx
---
title: 订单系统技术方案          # 头部大标题（有它才自动生成 Hero）
subtitle: 基于消息队列的异步解耦   # 副标题
author: Claude Opus 5           # 撰写此文档的 Agent —— 写你自己的模型名
datetime: 2026-07-25 14:30:52   # 你写文档的时刻，精确到秒（见下节，渲染器不会替你生成）
org: 平台架构组                  # 拼进 Hero 的日期行
copyright: 平台架构组            # 落款版权行 © {年} {copyright}
palette: lime                   # 主题色：indigo | teal | rose | amber | lime
mode: auto                      # 明暗：light | dark | auto（右上角可手动切换）
toc: true                       # 右侧悬浮目录（从 Section 收集）
footer: 反馈请联系平台架构组。      # 可选：页脚寄语（显示在落款之上）
---

本方案面向后端团队……                          <!-- 导语，紧跟自动 Hero -->

<Section number="01" eyebrow="背景" title="目标与约束" />
…（关键信息用组件承载：指标→Stat、流程→Steps、对比→Table/Columns、用例→Scenario）…
```

正文里**不要再手写 `<Hero>`**——`title` 已经生成了一个。确实想自己摆 Hero 时，frontmatter 设 `hero: false`（或不写 `title`）避免出现两个。

### 落款：`datetime` 必须你自己写

网页产物要能自证「谁、何时写的」。落款由 frontmatter 驱动，**提供才显示**：

- `author` + `datetime` → 「由 {author} 编辑于 {datetime}」；`copyright` → 「© {当年} {copyright}」。
- **`datetime` 没有任何自动兜底**——渲染器只读 frontmatter，不会捕获时间。所以写文档时**自己取当前时间**填进去，格式 `yyyy-MM-dd HH:mm:ss`。漏了就等于这份文档没有时间戳，读者无法判断新鲜度。
- 落款下方固定一行 mdx-viewer 的仓库 · 版本 · 许可证署名，属渲染器自带，frontmatter 无法配置——不用管它。
- `chrome: off` 会关掉自动头尾（连落款一起）；`<Footer>…</Footer>` 或 frontmatter `footer:` 是可选寄语带，显示在落款之上。

## MDX 写法约定（重要，避免踩坑）

- **能用 Markdown 就用 Markdown**：标题 `##`、列表、**任务清单 `- [ ]`**、**表格**（GFM 已启用）、引用、代码围栏、粗斜体行内码链接——直接写，自动上妆；代码围栏走 Shiki 双主题高亮，跟随明暗。
- **块组件内的散文要用空行分隔**，才会被当 markdown 段落渲染：
  ```mdx
  <Callout tone="warning" title="风险">

  支付回调存在**幂等性**问题。

  </Callout>
  ```
- **数组/对象属性用 `{}`**：`<Hero stats={[{v:"3",l:"服务"}]}>`。
- **公式**：官方语法 `$E=mc^2$` / `$$…$$` 直接可用；行内 `{`/`_` 容易被 MDX 当表达式吃掉时，改用属性传递：`<Math tex="\frac{a}{b}" />`。
- **代码用 markdown 围栏**（对 `<` `>` 安全）：<code>```ts</code>；需文件名栏时用 `<Code filename="x.ts">`，此时别在 children 里放裸 `<` 或 `{`（MDX 会当 JSX/表达式），要放字面量就用 `` {`…`} `` 模板字符串。
- **样式只用语义参数**（`tone` / `ratio` / `status`），不写颜色值。`tone`：`info｜success｜warning｜danger`（Card 另有 `primary`）。
- **行内状态**：散文里直接 `<Badge tone="success" dot>已上线</Badge>`。
- **兜底**：组件覆盖不到时可写原生 HTML（透传），但优先用组件保持一致。

### Block 速览

`Hero` `Footer` `Section` `Callout` `Card`(badge/badgeTone) `Columns` `Toggle` `Steps`/`Step` `Stats`/`Stat` `Fields`/`Field` `Scenario`/`When`/`And`/`Then` `Grid`/`Item`(filterable/facets/tags) `Math` `Code` `Badge` `Figure`(图注)；图用 `dot`/`mermaid`/`svg` 围栏（见「图」节）。

**完整属性与示例见 [`references/blocks.md`](references/blocks.md)；范例见 [`references/example.mdx`](references/example.mdx)；想看渲染效果直接 `mdxv demo`。**

## 图（Diagram）

图用 **fenced code block** 承载（对 `<` / `{}` 天然安全），按围栏语言分派到三条车道。选型只记一句话——**能上 Graphviz 就 Graphviz；它做不了的时序 / 状态机 / 甘特用 Mermaid；都不合适或要手工精确摆放时兜底 SVG**：

| 你要画的 | 围栏语言 | 怎么渲染 |
|---|---|---|
| 流程 / 管线 / 依赖 / 调用 / **类图** / **ER** / **架构分层** / 树·层级 | `dot` | 构建期 Graphviz(wasm) → 静态 SVG |
| **时序图** / 状态机 / 甘特 / 用户旅程 / git 图 | `mermaid` | 客户端渲染，主题跟随明暗 |
| 自定义 / 特型图形 / 需精确摆放（**兜底**） | `svg` | 原样内联 |

- **默认 Graphviz**：结构 / 关系图占绝大多数，且能用 `subgraph cluster` / `rank` 让「位置＝逻辑」（架构分层的边界、流程的并行）。
- **Mermaid 只补 Graphviz 的空白**（时序 / 状态机等专用记法）。
- **SVG 是兜底逃生舱**：引擎表达不了、或自动布局「就是不对」时手写 `svg` 围栏；上色用 `currentColor` / CSS 变量（如 `var(--accent)`）即可跟随明暗。
- **图注**：想加标题就包一层 `<Figure caption="…">`（图注在图下方居中）。每张图右上角自带全屏放大按钮（滚轮缩放、拖拽平移、Esc 关闭），三种车道都有，作者无需做任何事。
- **完整决策表 + 召回词 + tie-breaker（流程默认给谁、状态流转 vs 状态机、图表不在范围）见 [`references/blocks.md`](references/blocks.md)。**

````mdx
<Section number="03" title="部署架构" />

```dot
digraph { rankdir=TB
  subgraph cluster_edge { label="接入层"; CDN; 网关 }
  CDN -> 网关 -> 订单服务
}
```

<Figure caption="下单主链路时序">

```mermaid
sequenceDiagram
  用户->>网关: 下单
  网关->>订单服务: 创建
```

</Figure>
````

## 边界

- **产物是 `.mdx`，不是 HTML**：不要手写 HTML 骨架 / CSS / 坐标，也不要为了「给人看」另造一个页面——MDX 是唯一的源，`mdxv` 是查看方式。
- **组件不够用时先想能不能组合**现有 Block；真要加新组件，那是上游 mdx-viewer 的事（在它的 `src/app/components/blocks.tsx` 加组件 + `mdx-components.tsx` 映射表加一行，核心管线不动）——不要在本仓库重造渲染器。
- **双端同步**：`claude/` 与 `codex/` 两侧镜像一致（description 可各自适配）。
