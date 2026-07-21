# README Skeletons

Copy-paste starting points for each kind of README in the `docs/` tree. They are scaffolds, not fill-in-the-blank forms — keep the three structural parts (header blockquote, routing table, conventions), adapt the wording to the actual content, and delete rows that don't apply. Write in the language the rest of the repo's docs use (these examples are Chinese to match the reference project; mirror your repo).

> **每个骨架产出 `README.mdx`（MDX）**，由 `mdx-artifact` 预览查看（见 SKILL「承载与查看」一节）。
> 下面的骨架是**正文部分**——落地时在文件顶部加一段 frontmatter，例如：
> ```yaml
> ---
> title: docs/tech —— 技术方案（as-built）   # 该 README 的大标题（Hero）
> palette: teal
> mode: auto
> toc: true                                  # 用 <Section> 时右侧生成悬浮目录
> ---
> ```
> 骨架里的**目录链接**（如 `./tech/`、`./protocol/v1.0/`）预览时自动路由到该目录的 `README.mdx`；
> 文件链接写相对 `.mdx` 路径即可。需要更强的分节/提示时用 `<Section>`/`<Callout>`（可选，短索引页保留 `##` 亦可）。

## Table of contents
- [docs/ root index](#docs-root-index)
- [docs/tech/ index](#docstech-index)
- [tech module subdir (narrative)](#tech-module-subdir-narrative) — e.g. `daemon/`, `server/`
- [tech contract/artifact subdir](#tech-contractartifact-subdir) — e.g. `protocol/`, `database/`
- [research report index](#research-report-index)
- [STALE banner](#stale-banner)

---

## docs/ root index

The top of the tree. Its job is to explain the three-home split and the authoritativeness rule, then route one level down. Keep it short — it should not describe content, only point.

```markdown
# docs —— 文档总览

| 子目录 / 文件 | 定位 | 权威性 |
|---|---|---|
| [`tech/`](./tech/) | **as-built 技术方案**：协议、落库、各模块设计 | **事实标准**，随实现更新；冲突以此为准 |
| [`research/`](./research/) | **一次性方案调研报告** | **非长期参考**，仅留历史；已被 `tech/` 取代 |
| [`ued/`](./ued/) | **原型 / 交互设计** | 以上线 UI 为准；原型记录设计意图 |

## 该看哪
- **要改实现 / 查当前设计** → [`tech/`](./tech/)（入口 [`tech/README.mdx`](./tech/README.mdx)）
- **想了解某决策的由来 / 历史推导** → [`research/`](./research/)（可能与现状不一致）
- **看原型 / 交互意图** → [`ued/`](./ued/)

> 关系一句话：`research/`·`ued/` 是起点（怎么想的），`tech/` 是终点（现在是什么）。
> **冲突一律以 `tech/` 为准。** 高层架构见仓库根 [`AGENTS.md`](../AGENTS.md)。
```

---

## docs/tech/ index

Routes by *intent* into the module/artifact subdirs, and states the organization + maintenance rules for the whole `tech/` tree.

```markdown
# docs/tech —— 技术方案（as-built）

> 本目录是**当前实现**的权威技术文档。与 `research/`、`ued/` 的关系见 [`docs/README.mdx`](../README.mdx)。

## 怎么用（按需加载）
不要一次读完。按你要动的部分读对应子目录：

| 我要做… | 读这里 |
|---|---|
| 改 <契约：字段 / 端点 / 认证> | [`protocol/v1.0/`](./protocol/v1.0/) |
| 改 <模块 A 的行为> | [`<moduleA>/`](./<moduleA>/) |
| 改 <模块 B 的行为> | [`<moduleB>/`](./<moduleB>/) |
| 建表 / 改表 / 写迁移 / 看 schema | [`database/`](./database/) |
| 改运行配置 / <配置下发机制> | [`<config>/`](./<config>/) |

## 组织约定
- **顶层 = 有代码/契约耦合的共享产物**：`protocol/`（跨模块共享的线缆契约，按 API 版本分子目录）、
  `database/`（DDL 评审单 + schema，被构建/测试硬引用，路径不可随意挪）、`<config>/`（运行配置机制）。
- **模块子目录 = 叙述性技术方案**：`<moduleA>/`、`<moduleB>/`，向外链到上面的共享产物，不重复粘贴。

## 维护规则
- **先文档后代码**：改协议 / schema / 字段抽取时，先更新对应 tech 文档（及版本），再改实现。
- 每篇 `README.mdx` 顶部标注**权威源**（对应代码路径），改实现时同步更新。
- 路径稳定性：`database/` 被代码引用，移动需同步改引用方。
```

---

## tech module subdir (narrative)

For a component's as-built design (`daemon/`, `server/`). It tells the component's story and links out to shared artifacts.

```markdown
# <module> 技术方案（as-built）

> <一句话定位：这个模块是什么、干什么>。
> 权威源：`<code/path/>`。
> 本文件覆盖 <本模块负责的范围>；<跨模块的契约/形状> 见 [`../protocol/v1.0/`](../protocol/v1.0/)。

## 1. <结构总览>
<模块的组成、依赖方向、关键约束>

## 2. <核心机制 A>
...

## N. <配置 / 生命周期 / 边界>
...

---
> 历史：本设计的调研见 [`../../research/<date>-<topic>/`](...)（一次性报告，以本文件为准）。
```

---

## tech contract/artifact subdir

For shared, code-coupled artifacts (`protocol/v1.0/`, `database/`). The header must nail down the authoritative code path and the versioning/path rules, because these are the docs other modules and the build depend on.

```markdown
# <artifact> <版本/范围>（as-built）

> <一句话：这是什么契约/产物，对应哪段代码表面>。权威源：`<code/path>`。
> **版本约定**：目录 `v1.0/` 对应 <API major /v1>；破坏性变更新建 `v2.0/`，兼容小修订递增 `v1.1/`。
> 改契约时**先更新本文件再改代码**。

## 1. <端点 / 表 / 总览>
| ... | ... |

## 2. <逐项定义>
...

> 字段如何从源头抽取/分类的**语义权威**在 [`../../<module>/README.mdx`](...)；本文件只定义形状。
```

> For `database/`: also note the DDL-review-unit convention (one file = one DDL = one review unit) and that the path is hard-referenced by `Makefile`/tests — see the reference project's `tech/database/README.mdx`.

---

## research report index

You generally don't *write* these (the `researcher` agent does), but you add the STALE banner on top when the design ships. Shape for reference:

```markdown
# <topic> 调研

- **日期**：<date>
- **范围**：<scope>
- **状态**：调研稿 / 已进入实施 / 已归档

## 总览
| 子主题 | 文档 | 一句话结论 |
|---|---|---|
| ... | [01-xxx.md](./01-xxx.md) | ... |
```

---

## STALE banner

Goes at the very top of a `research/`/`ued/` file whose design has now shipped. Be specific — name what changed and where the truth lives now.

```markdown
> ⚠️ **STALE — 仅作历史参考（<date> 起）**
>
> 本文所述 <方案/栈> 已由 <实现/change> 取代：
> - <变化点 1>
> - <变化点 2>
> 文件保留是为追溯当时的决策与对比，**现状以 [`docs/tech/<path>`](...) 为准**。
```
