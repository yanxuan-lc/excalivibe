# dev-workflow:意图驱动的流程设计

**状态**:设计已对齐,待开工
**日期**:2026-08-07
**依赖**:flow-scratch `d64d37b`(`executor` 新契约已稳定)

---

## 1. 这份文档要解决什么

`dev-workflow` 现在有 14 个节点、一个工作流,只覆盖「单个 change 从需求走到发布准备」。缺三样:

- 意图识别 —— 用户说什么才该起流程,起哪一套
- 交付层 —— 做完的东西怎么落地(backup 的 sprint 层 10 个节点,现在 0 个)
- 调研流程 —— backup 的 `research-pipeline` 是散文式编排,不是图

本文档定这三样的形态。**不含实现**。

---

## 2. 意图集

意图是**用户想要什么**,从话里判断。阶段是**仓库的事实**,`test -f` 能查。二者分开是这套设计的核心判断 —— 早先的方案把「写 spec 还是写代码」做成意图,那是在逼模型猜一个不用猜的东西。

| 意图 | 起图 | 承载 | 说明 |
|---|---|---|---|
| `act` | — | **不在 skill 内** | 解释代码、找文件、跑命令。它是 skill 未被触发的补集,不是一条路由分支 |
| `backlog` | 否 | skill + `genai/BACKLOG.md` | 想法沉淀;**兼管 sprint 编排与冻结**(哪些 change 进这一批) |
| `debug` | 否 | 直接派 `debugger` | 见 §2.2 的升级判据 |
| `feature` | 是 | `genai-feature` | 覆盖需求 / 实现 / 交付三段,走哪一段由图规划按仓库状态决定 |
| `research` | 是 | `genai-research` | 调研,产出 `docs/research/<topic>/` |

UI/UX 原型(backup 的 `app-ux-design`)本轮不迁。

### 2.1 `act` 不写进 description

skill 的 description 决定它加不加载,所以 `act` 轮不到我们路由。

backup 的 flow skill 在 description 里列了排除项("NOT for explaining code, finding files…")。**本仓库有实测结论:列举排除场景反而可能提高在这些场景上的触发率**(那次 5/5 全触发)。因此 `act` 的边界靠正面描述收窄,不靠否定式列举,写完实测。

### 2.2 `debug` 的升级判据

`debug` 是这套里唯一允许**不经门控改产品代码**的口子,必须有可核对的边界,否则会变成绕过流程的默认通道。

**就地修完**,当且仅当三条同时成立:

1. 改动落在一处
2. 有可复现的失败用例
3. 不动契约(接口、schema、跨模块边界)

**任一条不成立**,就不在 debug 里修 —— 起 `feature` 图,诊断结论作为它的输入材料。

**这与 `genai.diagnose` 节点不是一回事。** `debug` 意图处理**图外**的用户报障;那个节点处理**图内**
某个环节反复被打回、原因不明的情况(见 §3.5)。两者共用 `debugger` agent,仅此而已。

### 2.3 图规划先问「有没有」

意图判成 `feature` 之后,**第一步是 `fsx graph list`,不是决定起哪种图**。

漏掉这一步的后果很具体:用户说「继续做用户导出」,模型起一张新图,同一个 change 有两张图在跑,两边门控各测各的。

有在跑的图 → 接着跑;没有 → 按仓库状态选形态:

| 仓库状态 | 起什么 |
|---|---|
| `openspec/changes/<id>/design.md` 不存在 | 需求段的图 |
| 存在且 `arch-gate` 已签 | 实现段的图 |
| 若干 change 齐活且 backlog 已冻结范围 | 交付段的图 |

---

## 3. 工作流与节点

两个工作流。工作流在 fsx 里只是**节点白名单 + 默认值**,节点定义是全局的(`.flow/nodes/<id>/`),`fsx nodes new <已存在的 id> -w <另一个工作流>` 幂等地加白名单。

`executor` 用新契约(裸字符串已废弃):

```yaml
executor: { protocol: subagent, params: { name: planner } }
executor: { protocol: main }
executor: { protocol: human, params: { channel: stdout } }
```

### 3.1 `genai-feature`

一个工作流,三段。**同一个工作流里可以混装用不同图变量的节点** —— 变量需求按图里实例化的节点算,不按整份白名单(已实测)。

#### 需求段 — `vars: change`

| 节点 | kind | executor | |
|---|---|---|---|
| `genai.brief` | produce | main | 已有 |
| `genai.intent-slice` | judge | human | **新** |
| `genai.spec` | produce | subagent `planner` | 已有 |
| `genai.spec-review` | judge | subagent `arch-reviewer` | 已有 |
| `genai.review-doc` | produce | subagent `planner` | 已有 |
| `genai.arch-gate` | judge | human | 已有 |

#### 实现段 — `vars: change`

| 节点 | kind | executor | |
|---|---|---|---|
| `genai.implement` | produce | subagent `developer` | 已有 |
| `genai.existing-suite` | verify | main | **新** |
| `genai.code-review` | judge | subagent `code-reviewer` | 已有 |
| `genai.e2e-script` | produce | subagent `e2e-author` | 已有 |
| `genai.a11y` | verify | subagent `a11y-runner` | 已有 |
| `genai.security` | verify | subagent `security-runner` | 已有 |
| `genai.perf` | verify | subagent `perf-runner` | 已有 |
| `genai.diagnose` | produce | subagent `debugger` | 已有 |

#### 交付段 — `vars: sprint`

| 节点 | kind | executor | |
|---|---|---|---|
| `genai.changes` | produce | main | **新**,列出这批齐活的 change |
| `genai.integrate` | effect | main | **新**,并到集成分支 |
| `genai.full-check` | verify | main | **新**,集成后的树上跑全量 |
| `genai.cross-family-audit` | verify | main | **新**,跨端一致性 |
| `genai.e2e-run` | verify | subagent `e2e-runner` | **从实现段移来**,门控要改,见 §3.3 |
| `genai.release-prep` | produce | subagent `release-coordinator` | 已有,从实现段移来 |
| `genai.merge` | effect | main | **新**,并进 dev |
| `genai.deliver` | effect | human | **新**,见 §3.4 |
| `genai.archive` | effect | main | **新**,归档合并 |

`genai.scope-freeze` **不做成节点** —— 冻结在 backlog 完成,是起交付图的前提。图一旦建起来范围就是图里那些,再加一次人工确认是重复签字。

交付段是本仓库**第一批 `kind: effect` 节点**。fsx 的 `EffectReportSchema` 强制 `idempotency_key`,解决「续跑时怎么判断已经并过了」。backup 那 7 个 `realized-as: script` 节点没有这个保障。

`command` executor protocol **不适用于这一段** —— 它是把派发指令交给注册过的 CLI adapter(另一个 AI CLI),不是跑脚本。落地动作用 `effect` + 门控里的 `command` 检查器。

### 3.2 `genai-research` — `vars: topic`

| 节点 | kind | executor | |
|---|---|---|---|
| `genai.research-brief` | produce | main | **新**,和用户澄清边界 |
| `genai.research-plan` | produce | subagent `researcher` | **新**,拆子问题 |
| `genai.research-probe` | produce | subagent `researcher` | **新**,受约束 §4.2 限制 |
| `genai.research-synth` | produce | subagent `researcher` | **新**,汇总 |
| `genai.research-review` | judge | human | **新** |

### 3.3 e2e 的层级与门控改动

e2e **在交付段跑,不在每个 change 里跑**,与 backup 一致(它把这条称为结构性决定)。`genai.e2e-script` 留在实现段 —— 测试代码跟着 spec 走,只有执行等到集成。

前提:实现段必须有别的东西真正执行产物,就是 `genai.existing-suite`。否则 implement→code-review 之间没有任何一步跑过代码。

**门控要改。** `genai.e2e-run` 现在是 `signature_match against code`,而交付段节点不能声明实现段的 inputs(§4.1)。挪过去之后新鲜度只能对**集成后的树**判断:`kind: git_commit` + `signature: commit_sha`。

### 3.4 `genai.deliver` 合一

`EffectReportSchema.effects[]` 是数组,每项自带 `system` / `identifier` / `idempotency_key` / `reversible`。一次交付本就可能既发 registry 又交接给人,拆成两个节点反而表达不了。

brief 里说明两种模式各用什么当幂等键:registry 用 `包名@版本`,handoff 用交接单号或 PR 号。

### 3.5 `genai.diagnose` 是救援节点,不在主路径上

它由主 agent 在**运行中**用 `fsx graph patch` 插入 —— 某个环节反复被打回、原因不明时。产出
`diagnosis.md`,并要求写一个**当前会失败的测试**钉住 bug;明确不修产品代码(证明 bug 的测试不能
由要满足它的人来写,否则只证明了修复和自己一致)。

**它不声明 `inputs`,这是设计使然。** 它可能被插在任何一个失败节点之后,而 `inputs[].from` 写在
节点定义里、不在边上,没法在 patch 那一刻才决定。上游不固定的节点只能不声明上游。

**但消费侧要补。** `genai.implement` 的上游是固定的,应当可选地消费诊断,否则 debugger 钉出来的
结论和那个失败测试,developer 在派发指令里根本看不到:

```yaml
# genai.implement
inputs:
  - name: spec
    from: genai.spec
  - name: diagnosis
    from: genai.diagnose
    required: false      # 多数 change 不是 bug
```

`required: false` 的语义正是「缺失时可派发,但 prompt 中标注为空」。

### 3.6 `genai.brief` 的定位

**需求阅读 + 澄清 + 结构转写**,不是内容改写。组合 `dev-toolkit:grill`(现有实现已经是这样)。

可核对的不变量:

> BRIEF.md 里的每一条,要么来自原话,要么来自用户对某个澄清问题的回答。没有第三来源。

落地靠两样:**原话逐字保留**一节,**澄清问答记录**一节。grill 本来就是一问一答,记录几乎免费。这句话精确等价于「不改意图」,而且扫一眼能判 —— `genai.arch-gate` 的人正好看这一节。

深度由 brief 读输入决定(grill 有 light/deep),**不假设 backlog 已经细化过** —— backlog 可能只是讨论想法。

---

## 4. 硬约束(全部实测确认)

### 4.1 白名单必须包含 `inputs[].from` 的上游

上游**不需要在图里有实例**,但**必须在同一工作流的白名单里**。

- 不在白名单:`graph create` **通过**,`preview`/`dispatch` 才报 `input 'design' is not among the declared outputs of step 'genai.spec'`,且 `available:` 为空
- 在白名单、无实例:正常解析出真实路径与 checksum

**推论:交付段节点不得声明来自实现段节点的 `inputs`。** 一个 sprint 装多个 change,而 `vars` 是单值字符串,给不出唯一的 `change`。交付段读 change 产物只能靠 `genai.changes` 产出的清单自己去找目录。

### 4.2 同一节点的多个实例共用同一个落点

实测 `#1` 和 `#2` 产物落点完全相同,互相覆盖。节点实例声明是 `strictObject`,只认 `id` / `node` / `join` —— 传 `vars` 或 `outputs` 都报 `unrecognized_keys`。

因此「把一件工作拆成 N 份并行做」无法表达。`genai.research-probe` **先按单节点内部派发实现**(执行者自己派 N 个 researcher,落点写成目录 glob),代价是 N 个子问题对引擎不可见,不能各自门控、各自返工。等 flow-scratch 支持实例级取值再优化。

### 4.3 图变量在建图时冻结

`graph patch` 加进需要新变量的节点会被 `graph_var_frozen` 拒。因此 **backlog 不做成图** —— 它每轮挑一个不同的 change,产物目录每轮都变,一张长命的图没法让 `vars.change` 跟着轮次走。

### 4.4 门控命令由 fsx 自己执行

`gating/checkers.ts` 里 `run(checker.command, { cwd, shell: true })`,原样执行,不做变量替换。命令是**节点定义里的字面量**。

`.flow/nodes/` 本来就是项目本地的,所以命令直接写在节点定义里,不引入项目级间接层。**代价由 installer 承担**:重装刷新定义时必须保留项目改过的 command 字段,或改用 `fsx nodes set` 逐字段更新而非 `edit` 整份替换。

---

## 5. 配置

`genai/config.json` 取消。逐项去向:

| 原键 | 去向 |
|---|---|
| `version` | 去掉 —— fsx 配置走 `strictObject`,写错的键当场被拒 |
| `output-language` | `.flow/config.yaml` 的 `instruction_language`,读法见下 |
| `delivery-mode` | 去掉 —— applies-when 写进 brief,由图规划判断 |
| `loop-budget` | fsx 的 `patience`,system / workflow / node 三层覆盖 |
| `commands.*` | 直接写进节点定义,内容见 §5.1 |

### 5.1 四个项目命令,以及各归谁跑

backup 的 `commands` 是一层**项目级间接**:节点声明「跑项目的 `test`」,项目填这到底是什么。我们不保留这层间接(§4.4),但**归属与语义必须保留**,否则新节点不知道自己该跑什么。

| 命令 | 语义 | 归谁 | 门控形态 |
|---|---|---|---|
| `check-diff` | 范围化检查:变更的包 **加上它们的反向依赖** | `genai.implement` | `command` 检查器,退出码 |
| `test` | 全量单元测试 | `genai.full-check` | 同上,每个被检对象只跑一次 |
| `lint` | 全树静态检查 | `genai.full-check` | 同上,每个被检对象只跑一次 |
| `build` | 构建 | `genai.integrate` | 同上 |

「加上反向依赖」这一句是 `check-diff` 的全部价值,而这个展开**是项目自己任务运行器里的逻辑,框架验不了**。所以它是项目要答的问题,不是我们能替它写的默认值。

**`genai.existing-suite` 不用配置命令。** backup 里它跑「项目 README 说的那个测试命令」,由执行者判断;门控只查两件事:报告存在、且带 `Commit: <HEAD>` 戳。戳是重点 —— 修完必须重跑重戳,旧报告放行新代码正是这条链要堵的洞。我们这边对应 `outputs_present` + 提交签名。

**要保留的一条硬规则**(backup README):

> 项目没声明 `commands.test`,`implement` 的门控就失败 —— 我们不发明一条恒真的命令来假装通过。

命令改成写进节点定义之后,这条的失败形态变了:不再是「没配置」,而是「有人把命令写成 `true` 或 `echo ok`」。installer 装完要打印每个节点实际会跑的命令,让这件事看得见。

**语言的错位要说清楚。** `instruction_language` 只有 `en-US` / `zh-CN`,而且它管的是**脚手架语言** —— 实测切换只翻译框架文案,不翻译 brief 正文,也**不告诉执行者产物该用什么语言写**。

我们的取法:

- **brief 与 agent 定义保持英文**(仓库约定)
- **REVIEW.mdx 等面向人的产物**,由 `review-doc` 自己读 `fsx config --json` 的 `instruction_language` 决定语言
- 用 `fsx config --json` 而不是直接解析 YAML —— 覆盖链由 fsx 算,我们自己算就是第二份真相
- `.flow/` 不存在时回落到与用户对话所用的语言,并在文档里写明这是回落

---

## 6. 初始化:`genai-init`

一个 skill(带 command 包装),取代现有的 `install-dev-workflow` —— 后者整个删掉,它的
`scripts/install-flow.mjs` 挪进来当其中一步。

`install-dev-workflow` 原先明确「不做 init」,理由是诊断清晰:`fsx init` 失败不该看起来像流程装
失败了。这条**不再成立** —— 逐步打印各自的结果能更便宜地买到同样的清晰度,而拆成两个命令的代价
是用户要记住先后顺序,并且会记错。

### 6.1 三种处置

每次运行,每一项按其中一种处理,并在输出里标明是哪一种。

| 处置 | 对象 |
|---|---|
| **创建** | 外部依赖(`openspec` / `fsx` / `mdxv`,经同意安装)、`openspec init`、openspec schema fork、`fsx init`、`fsx skill install --target <host>`、`CONTEXT.md`、`permissions.allow`(§6.5) |
| **刷新** | 14 个节点定义 —— 这是插件发的东西,升级就靠它 |
| **保留** | 节点定义里的项目命令(§5.1)—— 覆盖前读出来,写回去 |

升级路径因此就是「再跑一次」,没有第二个命令要记。

**openspec schema fork 这一项之前没人提过。** 用户项目不装 fork,`openspec new change` 生成的是
原版 `design.md`(缺我们那 8 个附加章节),而 `check-spec.mjs` 的内建兜底章节表照样要求它们 ——
于是每个 change 都要手工补 8 个标题。

### 6.2 `AGENTS.md` / `CLAUDE.md` 用标记块

这两个多半已存在且是用户写的,既不能整份创建也不能整份覆盖。用标记包一段,重跑只替换标记之间:

```markdown
<!-- genai:begin -->
本项目通过 flow-scratch 驱动开发流程。`fsx nodes -w genai` 是权威的步骤清单。
<!-- genai:end -->
```

**不写 routing block** —— `fsx nodes` 就是权威路由表,再写一份是第二份真相。这段只负责让主 agent
知道「这个项目有流程可走」。

### 6.3 `CONTEXT.md` 只种一次

缺失时种一份空词表,**之后永不触碰** —— 它会累积真实词条,重跑覆盖等于抹掉领域知识。

注意这只解决「文件存在」。**往里写词条由 `genai.brief` 负责** —— 它的 brief.md 要求把新命名的
核心概念记进 `CONTEXT.md`。不写的话词表永远是空的,而 `glossary-conformance` 对着空词表会把所有
领域词都报成「未注册」—— 那是噪音,不是信号。

**不改 `grill`。** backup 里 grill 兼管「问出术语」和「写进 CONTEXT.md」,是因为那时没有节点层
可以承载产物。我们有,而且 §3.5 已经定了这条分工:grill 拥有方法,节点拥有产物。BRIEF.md 就是
这么分的,CONTEXT.md 没理由例外。

**也不要把 `CONTEXT.md` 声明成 output。** 它是跨 change 累积的共享文件,而声明产物是给门控测量
用的 —— 两个并发的 change 都把它当产物,签名会互相干扰(§4.2 同类问题)。写进指令,不进产物清单。

### 6.4 不做的事

- **不校验 subagent 存在** —— 已定
- `delivery-mode`、`genai/config.json` —— 已取消
- cross-family 授权 —— 旧仓库的事

### 6.5 guardrail hook 与 `permissions.allow`

**hook 原样迁移**,不改判决逻辑。它是 `PreToolUse` 上只匹配 `Bash` 的 232 行脚本,三档:

- `deny` —— **只给** subagent 的不可逆对外动作(`npm publish`、push 到 main、强推共享分支、`gh pr merge`)。只拦 subagent 是因为主 agent 永远可以自己做,拦掉零成本
- `ask` —— 其余:主 agent 的对外动作、`git reset --hard` / `git clean -f`、在 main 上直接 commit
- 放行 —— 其他一切。任何内部异常也一律静默放行,守卫绝不能卡死工作流

它是**第二道防线**。主防线是交付段那批 `human` / `effect` 节点;它兜的是流程被绕过、agent 跑偏、无人值守这三种情况。

**拦截判据是两条并列:不可逆,或违反受保护分支约定。** 「在 main 上直接 commit」是可逆的,仍然拦 —— 分支约定本身值得守,这一条不靠不可逆性成立。

**只有 Claude 侧。** Codex 的插件清单禁止 `hooks` 字段。这是本仓库第一个单端产物。

#### git 读命令的误伤不在这个 hook

实测约 30 种只读形状,包括 `git log --grep="npm publish"`、`git log --all --grep "force push to main"`、
`gh pr view --json mergeable` 这类故意带敏感词的,**零命中**;两个历史版本的正则也完全一致。

误伤来自**另一个机制:宿主自己的 Bash 权限询问**。因此 `genai-init` 要配 `permissions.allow`,把只读
git 命令(`log` / `show` / `diff` / `status` / `blame` / `branch` / `reflog`)连同产物写入路径一起放进去。
backup 的 project-init 有对应的一步(验收表 3.6)。

### 6.6 幂等要写进设计,不是事后补

backup 的 project-init 每一步都带一条「已经做过的判据」,重跑逐条查、跳过已完成的,并明确
「**不要重写带时间戳的记录**」。

我们这边对应的三条:节点里的项目命令不能被刷新冲掉;`CONTEXT.md` 只种一次;标记块外的用户内容
一个字都不动。

---

## 7. 待决问题

无。

先前的四条都已收口:`glossary-conformance` 的词表由 `genai-init` 种、`genai.brief` 写(§6.3);
`project-init` 变成了 `genai-init`(§6);guardrail hook 原样迁移(§6.5);flow-scratch 的
`executor` 契约变更已在上游提交并稳定(`d64d37b`),14 个现有定义按 §3 的新写法迁移即可。

`genai.diagnose` 无输入不是缺口,是救援节点的正确形态(§3.5);要补的是 `genai.implement` 的可选
消费边。

## 8. 给 flow-scratch 的需求

1. **节点实例级取值**,使同一节点的 N 个实例产物落点不同(§4.2)
2. **派发指令里补一句「产物用什么语言写」** —— `instruction_language` 的注释声称它管这件事,实现里没有任何一句这么说
3. *(缺陷)* `unrecognized_keys` 的提示语里 `{allowed}` 是未替换的占位符,原样打给了使用者

---

## 9. 落地顺序

1. 14 个定义迁到新 `executor` 契约(等 flow-scratch 稳定)
2. `grill` 补 seed + 搬 `glossary-conformance`
3. 拆 `genai-feature` 的三段 + installer 改成按工作流分组安装
4. 新 flow skill 的意图路由(先认 `feature` / `backlog` / `debug`)
5. 交付段 9 个节点(含第一批 effect)
6. backlog skill
7. `genai-research`
