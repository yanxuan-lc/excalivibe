# ExcaliVibe

> English: [README.md](./README.md)

一份源码，编译出三端产物。能力只写一次，落在 `src/plugins/<name>/`，`make build` 同时生成 Claude 插件、Codex 插件和厂商中立的 `common/` 布局。

## 三个插件

| 插件 | 定位 | 内容 |
|---|---|---|
| `computer-use` | 如何使用电脑 —— 让 agent 越过自身文本输出、作用于真实机器的能力 | `graceful-browser`、`mdx-artifact`、`notify-user`、`install-computer-use`（Claude 端另带一份出厂静默的 turn-end hook） |
| `dev-toolkit` | 原子开发能力 —— 每个独立成立、按自身主题触发、不假设谁来调 | 19 个（规约 6 / 方法 4 / 流程约定 1 / 检查器 5 / 实地调研 3） |
| `genai-dev-flow` | 一整套流程 —— 需求进、一个版本出，每步门控在可复测的东西上 | 4 个 skill（手册 / 安装 / 需求 / 调度）+ 4 个 subagent + 7 个 fsx 环节定义 |

**一条贯穿全仓的规则：skill 不写调用者。** description 只回答「什么情况下该用我」，绝不回答「谁会调我」。写着 `invoked by name from the developer agent` 的 skill 有三重问题 —— 人直接提出同样需求时它不触发（描述的是派发而非情境）、那个 agent 一改名它就得重写、以及可复用的东西反过来依赖了具体的东西。箭头只能单向：**编排者点名它调用的 skill，skill 永不点名编排者。**

## 三端

| 端 | 产物 | 安装方式 | 平台约束 |
|---|---|---|---|
| claude | `claude/plugins/<name>/` | marketplace（`.claude-plugin/marketplace.json`） | 独有 `commands/`、`hooks/`，agent 可随插件打包 |
| codex | `codex/plugins/<name>/` + `codex/agents/*.toml` | Codex 插件市场（`.agents/plugins/marketplace.json`） | 无 commands 概念；插件**不能**打包 agent，需手工 `cp` 到 `~/.codex/agents/`；manifest 里写 `hooks` 字段会让校验器 exit 1 |
| common | `common/` | 手工拷进目标项目的 `.agents/` | 无插件、无 manifest、无 hook；opencode 等宿主原生识别 `.agents/skills/<name>/SKILL.md` |

`claude/`、`codex/`、`common/` 以及两份 marketplace 清单**全部是构建产物**，一个手写文件都没有。改动一律走 `src/`，然后 `make build`。产物提交进 git 是因为 Claude marketplace 直接从仓库安装——用户 clone 到的必须是现成的 `claude/plugins/<name>/`，不能是「构建后才存在」的东西。

## 上手

```bash
npm install          # 只装 typescript / @types/node，供类型检查用
make build           # src/ → claude/ + codex/ + common/
make check           # 提交前的完整门禁
make help            # 全部 target
```

运行时**零依赖**：Node ≥22.18 在加载时擦除类型，所以 `node scripts/build.ts` 直接可跑。`typescript` 只服务于 `make typecheck`——这也是 `tsconfig.json` 打开 `erasableSyntaxOnly` 的原因：它禁掉 `enum`、`namespace` 这类 Node 擦不掉的语法，避免出现「类型检查通过但跑不起来」。

## 单端差异怎么表达

共享是默认，差异必须显式声明。八种机制：

| 机制 | 声明位置 | 编译器行为 |
|---|---|---|
| variant 块 | 任意 `.md` 里的 `<!--@claude-->` … `<!--@end-->` 注释对 | 保留指名端的片段，其余丢弃；未被指名的端什么都拿不到 |
| 分端描述 | frontmatter 的 `description-claude:` / `description-codex:` | 覆盖该端；`description` 是兜底，也正是 common 取到的值（详见 [AGENTS.md](./AGENTS.md#the-three-description-slots)） |
| 分端文件名 | `probe.claude.sh` | 只有该端拿到，并重命名为 `probe.sh`。**源码里当前无用例** |
| 分端数据 | `realization.json`，每端一个 key | 每端只拿自己那半。**源码里当前无用例** |
| 根路径 | 正文里的 `${PLUGIN_ROOT}` | 替换为各端真实的根变量 |
| 模型档位 | agent frontmatter 的 `tier: top\|standard\|light`，可加 `tier-<end>:` 覆盖单端 | 查 `src/common.ts` 的 `TIER` 表 —— 依次对应 opus / sonnet / haiku 与 gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna；common 端一律无模型字段 |
| 单端目录树 | `hooks/**` | 天然只编到 Claude |
| 命令包装 | skill frontmatter 的 `command: true` | Claude 额外得到一个薄的 `commands/<name>.md` |

## 六道门禁，各自防什么

`make check` 由六步组成，每步都可单独跑：

- **`verify-build`** —— 产物与源码是否一致。抓「忘了编译」「手改了产物」「产物里有源码不产生的孤儿文件」三类。
- **`typecheck`** —— `tsc --noEmit` 扫 `src/` 和 `scripts/`。
- **`verify-json`** —— `src/` 里每份 JSON 能否解析，以及图骨架只引用它自己声明过的节点。
- **`verify-skills`** —— 两件事：产出的 SKILL.md / agent frontmatter 是合法 YAML 子集，以及每份渲染后的 SKILL.md 不超过 500 行的上下文预算。都跑产物而非源码，因为分端描述可能只在**一个端**上把 frontmatter 弄坏，而源码文件同时装着三端的正文、行数根本不代表实际入上下文的量。
- **`verify-variants`** —— variant 块边界是否嵌错。这是编译器**看不见**的一类失败：边界错位会让某个端整段丢失，而产物依然是源码逐字生成的、round-trip 依然字节一致、所有测试依然绿。它的办法是渲染每个端，找**没有对应物的孤儿标题**；确属有意的单端章节，逐条登记进 `src/variant-exceptions.json` 并写明理由。
- **`verify-no-cjk`** —— 凡是模型要读的都保持英文，连注释也算:整个 `src/`，外加根目录三份面向 agent 的文件(`AGENTS.md` / `CLAUDE.md` / `CONTEXT.md`，在脚本里逐个列名)。要例外必须登记进 `src/cjk-exceptions.json` 并写明理由，键是相对仓库根的路径；`evals/` 按目录豁免，因为触发 fixture 故意是中文、且从不随产物发出。面向人的文档按设计不在范围内，并且**按规定双语** —— `README.md` / `README.zh-CN.md`，以及 `docs/` 每一级的 `README.mdx` / `README.zh-CN.mdx`（见 [AGENTS.md](./AGENTS.md#hard-rules)）。两份是否还对得上，没有任何检查在看。

另外两道防线在编译器内部，不在门禁里：`lintVariants` 拒绝输出任何残留 marker 的文件（端名拼错、漏了 `@end` 都是这个signature），`emit` 拒绝两个源码编到同一路径（common 端没有插件目录，skill 名在那里是仓库全局的）。

## 目录

```
src/
  common.ts              端定义、TIER 表、variant 渲染、frontmatter 解析
  marketplace.json       两份 marketplace 清单的共同来源
  variant-exceptions.json 已登记的有意单端差异
  cjk-exceptions.json    已登记的、允许出现中文的 src 文件
  plugins/<name>/
    plugin.json          一份 manifest,编译成各端各自的形状
    README.md
    skills/<name>/
      SKILL.md           触发面 + 主干,进上下文的部分
      references/**      按需加载的深度内容
      scripts/**         可执行件,权限位随源码保留
      assets/**          随 skill 发出去、由它的脚本消费的数据
      evals/**           触发率 fixture,留在 src 不发给用户
    agents/<name>.md     一份正文,三种序列化
    hooks/**             Claude 独有
scripts/
  build.ts               编译器
  check-skills.ts        frontmatter 合法性 + SKILL.md 行数预算
  verify-variants.ts     variant 块边界完整性
  verify-json.ts         JSON 可解析性 + 图骨架的引用完整性
  verify-no-cjk.ts       src/ 的英文约束
  bump.ts                版本号的唯一入口
  eval-triggers.ts       触发率评测的构建与打分
  ui.ts                  终端输出的统一视觉语言，Makefile 也走它
docs/
  tech/                  as-built 参考：编译契约、工具链、流程契约
```

这份 README 是导览，`docs/tech/` 是参考手册。动哪块读哪块 ——
[`docs/tech/artifact-contract/`](./docs/tech/artifact-contract/README.mdx) 是编译，
[`docs/tech/toolchain/`](./docs/tech/toolchain/README.mdx) 是门禁与发版，
[`docs/tech/flow-contract/`](./docs/tech/flow-contract/README.mdx) 是跑 `genai-dev-flow` 时项目自己要提供的东西。
它们是 MDX，用 `mdxv docs` 预览。**内容是英文的** —— 那棵树面向的是要改代码的人和 agent，与 `src/` 同属一个语料。

两份 README 内容一一对应。改了一份就改另一份 —— 没有机械门禁在看这件事。

## 已知的粗糙处

- `.agents/` 在本仓库里放的是 **Codex 的 marketplace 清单**，而 `common/` 才是给消费者拷进**他们自己**的 `.agents/skills/` 的东西。同一个名字两种角色，容易看岔。编译器因此**只拥有 `.agents/plugins`**——扩大到整个 `.agents/` 会让 `make build` 把别的工具装在 `.agents/skills/` 下的东西当孤儿扫掉。
- common 端的 `${PLUGIN_ROOT}` 解析成项目相对的 `.agents`，因此**用户级安装**（`~/.agents/`）下这个变量不成立。需要在 common 端工作的正文，优先用相对 skill 自身目录的路径。
