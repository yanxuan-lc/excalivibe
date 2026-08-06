# AGENTS.md — ExcaliVibe

面向所有在本仓库里干活的 Agent（Claude Code / Codex / Cursor / opencode 等）的事实与规范。
架构全貌看 [README.md](./README.md)，这里只写**动手之前必须知道、且改错了会静默出错**的那几条。

## 一句话事实

一份源码编译出三端产物。能力只写一次，落在 `src/plugins/<name>/`，`make build` 同时生成 Claude 插件、
Codex 插件和厂商中立的 `common/` 布局。三端分别是 `claude` / `codex` / `common`。

## 硬规则

**`claude/`、`codex/`、`common/` 以及两份 marketplace 清单全部是构建产物，一个手写文件都没有。**
改动一律走 `src/`，然后 `make build`。产物提交进 git 是因为 Claude marketplace 直接从仓库安装。
手改产物会被 `make check` 的第一道门禁抓出来。

**skill 不写调用者。** description 只回答「什么情况下该用我」，绝不回答「谁会调我」。写着
`invoked by name from the developer agent` 的 skill 有三重问题 —— 人直接提出同样需求时它不触发
（描述的是派发而非情境）、那个 agent 一改名它就得重写、可复用的东西反过来依赖了具体的东西。
箭头只能单向：**编排者点名它调用的 skill，skill 永不点名编排者。**

提交前跑 `make check`（四道门禁：`verify-build` / `typecheck` / `verify-skills` / `verify-variants`）。
运行时零依赖，Node ≥22.18 加载时擦类型，`node scripts/build.ts` 直接可跑。

## description 三槽制

description 是**触发面** —— 宿主靠它决定要不要把这个能力召回进上下文。不同模型的召回模型不同，
同一段措辞在一个模型上稳定触发，在另一个模型上可能完全不触发。所以这是唯一一个**预期要分端调优**
的字段，frontmatter 为此开三个槽：

| 槽位 | 谁用 | 说明 |
|---|---|---|
| `description:` | **common**，同时是全局兜底 | 中立措辞，不为任何单一宿主调优 |
| `description-claude:` | claude | 直接覆盖，专为 Claude 的召回调优 |
| `description-codex:` | codex | 直接覆盖，专为 Codex 的召回调优 |

解析规则在 `src/common.ts` 的 `descriptionFor()`：`description-<end>` 存在就用它，否则回落到
`description`。**没有 `description-common:` 这个槽** —— common 是厂商中立端，未调优的兜底本身
就是它的描述。写 `description-common:` 虽然也能解析（查找是通用的），但那意味着兜底已经不中立了，
正确做法是调优两个具名端、让 `description` 保持它们分岔出去的那个原点。

三个槽当前内容一致，是刻意的起点：先把槽位铺好，再逐端实测调优。**分端调优必须基于实测**，
不要凭感觉改一个端的措辞就当它更好了 —— 见下面「怎么写 description」。

写的时候注意两处：

- **agent 的 description 里 `\n` 要写成 `\\n`。** 双引号 YAML 标量里 `\n` 会被解析成真换行，
  而 Claude 的 agent frontmatter 约定是让字面量 `\n` 原样留在值里。现有 agent 的 `Examples:`
  块全部是这个写法，照抄即可。
- **Codex 端产物是 TOML，值由 `JSON.stringify` 生成。** 所以 `descriptionValueFor()` 读的是
  **解析后**的 map 而不是 raw —— 喂 raw 会把已带引号的字符串再包一层，产出
  `description = "\"Dispatch this agent…\""`。这个坑踩过一次，别改回去。

## 怎么写 description

以下三条在本仓库实测过（Codex 端，20 条 query × 5 次，前后同条件对照），不是审美偏好：

**开头写「这是哪一类判断」，不要写主题名词。** 以名词开场的描述会同时双向失效：任何蹭到这个名词
但不需要判断的请求都会误触发（`跑一下 linter`、`撤销我上一个 commit`），而这个 skill 真正存在的
理由 —— 那些绕开了名词的问题（`这两个该拆成两个模块还是一个`、`这算 minor 还是 major`）—— 反而
一次都不触发。改成以「决定某件事在这里该怎么做」开场、把主题名词降级成后文的召回词汇之后：
`vcs-workflow` 15/20 → 20/20，`middleware-guideline` 16/20 → 19/20，`coding-guideline` 11/20 → 16/20。

代价要说清楚：判断式开场会把相邻的**概念性**提问也拉进来（`讲讲服务发现是怎么回事` 从 0.0 涨到 0.8）。
净收益为正，但这是一笔交易而非白拿。

**边界写成「它是什么」，不要写成排除项清单。** 实测过一条具体的排除项 ——「不适用于实现一个已经
议定的 spec」—— 加上之后，`实现我们昨天议定的 auth spec` 这条 query 反而 5/5 全部触发。点名一个
场景不能可靠地阻止在该场景触发，反而可能让它更显眼。所以边界要写进身份里：
`It supplies the judgment about how code ought to look; carrying out a change whose shape is already decided is separate work.`
枚举「我覆盖什么」是安全的，枚举「我不覆盖什么」不是。

**分端调优前先确认量具。** 触发率测量内部没有 ground truth：「没触发」和「测量装置没看见它触发」
输出完全一样，所以坏掉的尺子读起来永远像好消息。本仓历史上找到的十来个缺陷几乎全在测量装置里
（被丢弃的 stderr、落在正常延迟区间内的超时截断、`--num-workers 10`、长得和「从未触发」一模一样的
配额错误）。跑批之前先单跑一条、把完整事件流打出来读一遍；**报错却零成本的那一次运行，根本没执行过**
（`is_error and not total_cost_usd`），按运行逐条审计，不要只看汇总行。

## 目录

```
src/
  common.ts              端定义、TIER 表、variant 渲染、frontmatter 解析、description 分端解析
  marketplace.json       两份 marketplace 清单的共同来源
  variant-exceptions.json 已登记的有意单端差异
  plugins/<name>/
    plugin.json          一份 manifest，编译成各端各自的形状
    skills/<name>/SKILL.md   触发面 + 主干
    agents/<name>.md         一份正文，三种序列化
    hooks/**                 Claude 独有
scripts/
  build.ts / check-skills.ts / verify-variants.ts
  ui.ts                  终端输出的统一视觉语言，Makefile 也走它
```

## 终端输出

所有 build / verify 脚本和 Makefile recipe 的输出都走 `scripts/ui.ts`，只有三种角色、三种形状，
不要混：

```
  ~ claude/…/SKILL.md          detail —— 缩进 2、暗色、带字形，是证据，可跳读可截断
                                         + 新增 · ~ 变更 · − 删除 · ? 无法解释
✓ compiled — 56 change(s)      result —— 顶格、带色，是结论，只有一行，上面留空行
→ `make build` 恢复它们        next   —— 顶格、暗色，是「接下来该做什么」，永远在最后
```

**`✓` / `✗` 只属于结论行。** 证据行曾经也用 `✗` 开头，和总结它的那行同缩进、同颜色、同字形 ——
结果最该先读的那一行反而最难挑出来。证据用「这是什么类型的东西」的字形，不用对错字形。

颜色自动降级：管道输出、CI 日志会自动去色，并遵守 `NO_COLOR`。**不要在这个模块之外写转义码**
（`make help` 是唯一的例外，它用 awk 排版一张表，自带布局）。
