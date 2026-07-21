# gen-ai-development 2.0

**生成式 AI 开发套件（Generative AI Development）2.0**（Codex plugin）。

定位：把基于生成式 AI 的研发工作流沉淀成可复用的 Codex 能力。相比 1.x 的「一张相位图 + 一个人工门」，2.0 的核心是一个**自治控制器（autonomy-controller）**——它对每个任务先判断「这件事能放手到什么程度」，再据此组装**轨道（哪些节点）**、**门禁形状（几个人工触点）**与**验证强度**。范式收敛为 **SDD（spec 契约）+ TDD（测试）**两条，架构是**三层 + 专人专事的 agent + 独立内聚的功能 skill**。

> **状态：2.0，已替代并移除 1.x。** 插件名 `gen-ai-development`，版本 `2.0.1`，skill 命名空间为 `gen-ai-development:*`。Claude 与 Codex 两端均已切到 2.0，走同一主流程；仅 harness primitives 各自最优（见下文 Agents / 兜底安全网两节）。

## 快速开始（每个项目一次性 onboarding）

1. **安装并启用插件**（marketplace）。规约 / 功能 skill 按 description 自动触发。（Codex 侧**无 hook**——不可逆动作的兜底依赖 Codex 运行时的 trust / 审批机制，见下文「兜底安全网」。）
2. **安装 subagent**：9 个 agent 以 `codex/agents/*.toml` 分发、**不随插件打包**，需复制到 Codex agents 目录（详见 [../../agents/README.md](../../agents/README.md)）：`cp codex/agents/*.toml ~/.codex/agents/`（或项目级 `.codex/agents/`）。
3. **`project-init`** skill —— 给当前项目写 `AGENTS.md`：编排指针（按 `autonomy-controller` 走）+ 登记 9 个 agent。
4. **`setup-gen-ai`** skill —— 合并子代理写盘的 allow 规则，让 autonomy-controller 无人值守派发的子代理也能稳定落盘门禁产物。⚠️ 权限在会话启动时加载，跑完**重开会话**才完全生效。

> 两个 setup 命令以 skill 形式提供，**幂等**，可安全重跑。

## 核心架构

### 三层（划分原则：功能 skill 永远不知道流水线存在）

| 层 | 是什么 | 关键约束 |
|----|--------|----------|
| **Tier 1 — 功能 skill** | 单一能力、可独立使用，按 description 自动触发，用户可直接触发 `tdd`，agent 也可在自己上下文里 consult | **独立性规则（不可破）**：不读 `PIPELINE.md`、不知道 archetype / ceiling / gate——只有输入输出。这才使它能脱离流水线被复用 |
| **Tier 2 — agent** | 一个隔离上下文一个职责（専人専事），**组合** Tier-1 skill 干活 | 不编排全流程；验证三角的独立性来源于此 |
| **Tier 3 — 编排 skill** | `autonomy-controller`（替代 1.x 的 `dev-pipeline`）：唯一感知流水线的组件 | 派发 agent、读写 `PIPELINE.md`；**自己不实现任何能力，只是安排** |

一个**节点**是编排步骤，有两种落地：**内联功能 skill 调用**（廉价、无需隔离）或 **agent 派发**（需専人専事 / 上下文隔离，验证三角全在此）。

### 自治控制器：三信号 → 档位 → 轨道

| 信号 | 取值 | 决定 |
|------|------|------|
| **变更原型** | feature · bug · visual · refactor · schema-migration · research · docs · dependency-bump | **走哪条轨道**（spine） |
| **关键度 / 新颖度** | core · supporting · generic | **深度档**——设计思考与人工定型给多少 |
| **可逆性 / 影响面** | reversible · irreversible（共享 schema / 已发布契约 / 破坏性迁移 / 对外发布） | **自治档位** |

三档自治 ceiling：**full-auto**（无人在环，仅限可逆动作 + 机器 oracle，且须项目具备 canary/遥测/auto-revert 闭环才授予）/ **auto + 抽检**（自动发布，预算内事后抽样）/ **human-gated**（不可逆动作前人介入）。

- **铁律**：关键度只是深度档，**永不切换 spine**——core 域的 bug 仍是 `bug`，不升级成 `feature`。
- **不可逆面升档（单向）**：碰到共享 schema / 已发布契约，无论原型一律就那一片升到 human-gated。
- **门禁＝档位的函数**：full-auto 0 门、抽检 0 阻塞门 + 事后抽样、human-gated ＝ 意图循环（人对运行切片反应）+ 收窄的 human-confirm（仅 schema+协议）+ publish 同意。`merge`（可逆）见绿自动，只有 `publish`（不可逆对外）必须人同意。

完整轨道、节点目录、门禁与注意力预算见 `autonomy-controller` skill 的 `references/{tracks,gates,pipeline-schema}.md`。

## Skills

### 编排（Tier-3）

| Skill | 触发场景 | 内容 |
|-------|----------|------|
| `autonomy-controller` | 任何要建 / 改可运行产品代码的开发任务起步、续作在途 `openspec/changes/<id>/`、复合意图一句话、从 idea backlog 取活（「把 backlog 里的 X 做了」「把队列里的都做了」）、或判断「能否无人发布」 | **主 Agent 的研发编排规约**：三信号分类 → 设自治档位 → `decompose` 拆复合意图为 unit-DAG → 组装轨道并向 `PIPELINE.md` 写四件输出（节点图 / 档位 / 门形 / 验证强度）→ 派发 agent → 按档位定门 → 按强度路由验证；含 Phase A→B→C rollout 与交付边界 |
| `research-pipeline` | 任何调研 / 对比 / 可行性（「调研一下 X」「A 和 B 怎么选」「这方案可行吗」），或 autonomy-controller 的 research 轨道展开 | **主 Agent 的调研编排规约**：路由 → 苏格拉底澄清（向用户提问）→ 结论确认 → 计划（按子任务路由 deep-research / researcher / inline，模型按任务选）→ 并行派发 → 汇总追问循环 → synthesize 落盘 REPORT.mdx + PROPOSAL.md。**所有用户交互在主 Agent**，researcher 是纯执行单元 |

### 功能 skill（Tier-1，独立可用；入口型自动触发，内部型按名调用）

意图 / 设计 / 验收：

| Skill | 触发场景 | 内容 |
|-------|----------|------|
| `grill` | 需求含糊、只给结果不给行为、「做个 X」「加个能做 Y 的东西」、无验收标准的特性想法 | 交互式意图输入：一次一问 + **带推荐答案**的苏格拉底澄清，产出行为化 `BRIEF.md`（现状 / 期望 / 验收 / out-of-scope）。两档深度；deep+binding 模式额外定型领域、播种 glossary，并**主动盘问**冲突 / 重载术语、用边界场景压测、拿现有代码交叉核对。**能查代码就先查，别耗用户回合** |
| `backlog` | 想法只记录、先不开工（「先记下来」「记到 backlog」「回头再做」）、想法连发排队、问「backlog 里有什么」 | **想法队列（入队侧）**：读索引定调（新想法与在队条目相关时先问「改旧条还是新开」）→ grill 澄清出 BRIEF → 收尾**定点整合**（覆盖即改写旧条 / 克制合并 / 关系标注；有发现攒一条确认消息，无发现静默落盘）→ `openspec/BACKLOG.md`（只含活跃条目 queued/in-progress）+ `backlog/<id>/BRIEF.md`；条目进入终态（done/dropped）随该次写入搬迁到 `backlog/archive/`（索引 + `<date>-<id>/` 目录），让入队开头的索引读取恒定小。只动相关条目、只由事件触发、绝不全队列重整；出队（保鲜检查 + 全队列合批 / 依赖 / 并行）在 autonomy-controller 的 backlog intake |
| `review-doc` | spec 走到 human-confirm 人审、生成人审文档、「四件套确认」「查看 REVIEW」 | **四件套人审文档规约**：`REVIEW.mdx` 由 spec **单向派生**（模块 → 协议 → 库表 → 用例；表格 / Mermaid / DDL 优先于散文）；spec-hash 新鲜度戳供 human-confirm 门机检；用户直接以 markdown 查看；下游 agent 禁读——spec 才是实施输入 |
| `app-ux-design` | UI / 视觉设计、原型、视觉轨道的 prototype 节点 | 设计产出落 `docs/ued/<dt>/`（依赖 `ui-ux-pro-max`） |

实施 / 测试 / 调试：

| Skill | 触发场景 | 内容 |
|-------|----------|------|
| `tdd` | TDD / red-green-refactor / 先写测试 / 单元、回归测试，或 `developer` 实施阶段 | 红绿重构循环 + 各语言工具链（TS/JS/React/RN/Python/Go/Rust/Swift/Flutter）+ 覆盖率门；RED 必须**因预期原因失败**、GREEN 输出洁净 |
| `e2e-test` | 跑端到端 / 冒烟、验证功能经 UI 或接口生效**且确实写库**、合并前验证运行中的构建 | 三模式：GUI 脚本套件（Web=Playwright / Flutter=integration_test / RN=Detox / Tauri=tauri-driver+WDIO）+ API 模式 + **agent 驱动模式**（无套件覆盖的场景经 graceful-browser 实时驱动）；均做 MySQL/PG 写入校验。假定应用已运行 |
| `debug` | bug / 崩溃 / 非零退出 / 异常行为，需结构化调查 | **Phase 0 先建复现信号**（8 级阶梯 + shrink 收敛 + flaky 提升复现率 + 3-5 排序假设）→ 三循环（A 日志循环 / B 退出码收敛 / C CLI 调试器）+ 强制清理（`[debug:]` 标记 + grep 自检）；浏览器症状转 graceful-browser |

验证门（新，2.0 加，纯检测不决策）：

| Skill | 触发场景 | 内容 |
|-------|----------|------|
| `security-scan` | 任何动到安全面的代码、依赖变更、显式安全检查 | SAST + 依赖 / 漏洞审计 + 密钥扫描，按严重度报告，供调用方决定是否卡门 |
| `a11y-check` | UI / 视觉变更或显式无障碍检查 | axe-core / Lighthouse 级无障碍检查，报 WCAG 相关发现 |
| `perf-budget` | 改动热路径 / 查询 / 包体，或显式性能检查 | 对照性能预算（时延、查询数 / N+1、包体）报回归 |
| `smell-scan` | 重构 / 优化请求、架构健康审视、「找坏味道」 | 删除测试 + 浅模块 / 渗漏接缝 / 超大上下文 / 贫血模型检测，出带推荐强度（影响×置信）的排序报告；行为保持感知（配特征化测试） |
| `glossary-conformance` | 命名新模块 / spec / 测试，或审命名一致性 | 机检 spec / 测试 / 代码标识符是否匹配 `CONTEXT.md` 词表（按 bounded context）。**仅防命名漂移，不验逻辑，不带信任额度** |

规约类：

| Skill | 触发场景 | 内容 |
|-------|----------|------|
| `coding-guideline` | 写新代码 / 改文件 / 加组件函数 / 实现特性 / 修 bug / 评审代码 | 多语言编码规约（TS/JS/React/RN/Python/Go/Rust/Swift/Dart/Flutter）+ 命名 / 错误处理 / 组织 / 注释通用篇 |
| `dba-guideline` | 任何数据库工作：建表 / 改表 / 迁移 / ORM / 非平凡查询 / review SQL | MySQL、PostgreSQL 的 DDL/DML/DQL 规约（含 SQL 审核红线，强制 / 推荐分级） |
| `devops-guideline` | 写 / 改任务运行器、统一多语言或 monorepo 命令入口、本地中间件 compose、服务 Dockerfile、「怎么跑 X」 | 单一命令入口、委托原生工具、聚合动词→分域目标、自文档化 help；compose 只编排本地中间件；Dockerfile 多阶段 + 非 root + 国内源 |
| `middleware-guideline` | 接平台中间件与监控：Nacos / 配置中心、运行时配置、PROFILE、热更、健康检查 / `/metrics`、新起服务骨架 | bootstrap 与业务配置两层分离、`<APP>_PROFILE` 单开关、必选中间件 fast-fail、辅助降级；**服务必备监控面** `/healthz` + `/readyz` + Prometheus `/metrics`（含 Go/Python/Rust/Node.js 接线） |
| `docs-guideline` | `openspec archive` 之后沉淀文档、「整理技术文档」「建 docs 索引」「这块设计记到哪」 | as-built 策展：`docs/tech`（事实标准）/ `research` / `ued` 三分类、README-as-Index 两跳可达、权威内容只链接不复制、过期叙事打 STALE |
| `vcs-workflow` | 起新分支 / worktree、合并进 dev、发版 / 发布 npm·Nexus、bump 版本、submodule | 分支模型 `feat→dev→main`、worktree 并行、SemVer 发布流程、版本同步点、submodule 协调；含 footgun 主动拦截清单 |

### 方法类 Skills（调研时按需触发，`researcher` 的下沉工具）

| Skill | 用途 |
|-------|------|
| `research-source-code` | clone 并锁定精确版本（tag / SHA）读真实源码，结论带 repo + SHA + 文件指针 |
| `research-data-source` | 只读连接真实数据源看 schema / 采样 / 分布 / 体量；不装客户端，复用环境已有通道 |
| `research-api` | 发现 OpenAPI / Swagger 并真实调用验证接口行为与鉴权；read-only 优先，样本脱敏 |

### 初始化类 Skills（命令转 skill）

Codex 无 `commands/`，两个 Claude 命令在 Codex 端落为命令式 skill：

| Skill | 用途 |
|-------|------|
| `project-init` | 扫描仓库生成 `AGENTS.md` 初稿，并登记可用 Agent（`codex/agents/*.toml`）与委派规则 |
| `setup-gen-ai` | 准备管线产物目录（`docs/research`、`docs/code-review`、`docs/e2e`、`openspec/changes`），约定写盘约束、检查可写工作区沙箱并纳入 git |

## Agents（按场景委派，以 `codex/agents/*.toml` 分发）

> Codex plugin **不能**捆绑 agent；本套件的 9 个 agent 以独立 TOML 文件分发于 `codex/agents/<name>.toml`，安装时单独复制到 `~/.codex/agents/`（personal）或项目 `.codex/agents/`（见 `codex/agents/README.md`）。下表是**能力摘要**，便于路由选型；具体行为以各 TOML 定义为准，冲突时定义文件赢。委派方式为显式请求 Codex spawn 对应 Agent。验证三角（developer ≠ e2e-author ≠ e2e-runner / code-reviewer，写权分离、文件路径交接、干净上下文复核）是 2.0 信任的根基，原样保留。

| Agent | 触发场景 | 备注 |
|-------|----------|------|
| `researcher` | 调研的**纯执行单元**，由 `research-pipeline` spawn（快速 scoped 查证也可直接 spawn） | investigate（一个 spawn 答一个 scoped 子问题，结论带出处、fact/inference 强制标注，待拍板事项以 `open_questions` 带回）/ synthesize（汇总落盘 REPORT.mdx + PROPOSAL.md）。**不与用户交互**；广域 web 扫描归主 Agent 调 deep-research |
| `planner` | 复杂 / 新特性 / 架构变更的设计提案（propose 阶段） | 写 OpenSpec 四契约（模块设计 / 外部协议 / 库表 / 场景级 e2e 用例，稳定 ID `S1/S2/…` + 执行载体声明）；模块设计用 glossary 术语；随 spec 派生 `REVIEW.mdx`（按 `review-doc`，spec 每改重生）；不实现；open_questions 不直接问用户 |
| `arch-reviewer` | spec 含 DDL / 新改接口面 / 跨模块时，**实施前**设计审查（裁量触发） | 审 schema / 接口契约 / 模块边界 / 验收可测性；产出 `arch-review.md`，闭环走 planner 改 spec；**只审设计、不审实现代码**（那是 code-reviewer 的活） |
| `developer` | spec 已就绪的实施阶段 | 严格 TDD（产品代码 + 单测）；**不写 e2e 测试**；输入是 spec 不是 REVIEW.mdx；组合 `tdd` + `coding-guideline` +（涉库）`dba-guideline` + `glossary-conformance`；信任信号用 mutation/property oracle |
| `e2e-author` | spec 确认且声明脚本化载体后，与 developer **并行 spawn** | 黑盒 SDET：按 spec 场景（**非实现**）写 Playwright / 接口 / DB 校验测试，交付 `e2e-manifest.md`（场景→用例映射 + 有意留空清单）；两阶段（spec-only 草稿 ∥ developer，应用起来后定型选择器）；**绝不改产品代码** |
| `code-reviewer` | **merge 进 dev 的门禁**：增量审 diff（与 e2e-runner 同一请求并行 spawn）；全量仅显式要求 | 两判定（spec 合规 ≠ 代码质量）、干净上下文、只读；**「不信报告，从 diff 重推」**；门禁车道用异模型族；全量模式 consult `smell-scan`；产出 `CHECKLIST.md`（P0/P1 全 Resolved 才合并） |
| `e2e-runner` | 实施 + QA 交付后跑端到端验收（主 agent 先拉起应用） | 按 manifest 查表路由：有映射跑脚本（**零 LLM**），无映射经 graceful-browser 驱动；写库校验（manifest 声明 `db-assert: suite` 的场景抽样复核，其余 runner 亲验）；只读、不改判（product/test/infra 分类）；报告落盘 `e2e-report.md` 含覆盖 N/M——merge 门禁消费它 |
| `debugger` | bug / 失败 / 栈回溯出现时的假设驱动调试 | 组合 `debug` skill；bug 轨道与 fix-loop 的一等节点；产出 `HYPOTHESIS.md`（复现 + 排序根因），**只诊断 + 写红回归测试、不改产品码**（实现归 developer）；3+ 次修复失败升级为架构性问题 |
| `release-coordinator` | 发布**准备**（SemVer 决策、多模块版本同步点核验、release notes 草稿、证据摘要） | 组合 `vcs-workflow`；**硬边界：只准备，不执行**——merge/push/publish 由主 Agent 在用户明确同意下做，agent 绝不执行不可逆对外动作 |

## 不可逆动作的兜底安全网

「不可逆动作必须有人」这条边界，**两端都由 `autonomy-controller` 主流程承载**——把这类动作路由到 human-gated / publish-consent。两端的**机械兜底**实现各自最优：

- **Claude 侧**有一个 `PreToolUse` 守卫 hook 作确定性兜底（控制器被绕过 / agent 跑偏时的第二道防线）。
- **Codex 侧不存在该 hook**：Codex 的 `.codex-plugin/plugin.json` 禁 `hooks` 字段（校验器拒绝），本插件也不带 `hooks/` 目录。同等的「防误伤脚枪」靠 **Codex 运行时自带的 trust / approval 审批机制**——不可逆对外动作（publish / push 受保护分支 / force-push / `reset --hard`）由运行时在执行前提示或拦截。

主流程不依赖任何一端的兜底层；缺它照常工作，门禁仍由 autonomy-controller 落实。

## 编排原则（推荐写入使用方项目的 AGENTS.md）

完整编排规约——三信号分类、自治档位、轨道、门禁、`PIPELINE.md` 状态——**以本插件的 `autonomy-controller` / `research-pipeline` 两个 skill 分发**，随插件版本更新，无需在使用方项目里复制内容。使用方 AGENTS.md 只需一段很短的路由指针（`project-init` skill 会代写）：

```markdown
## 研发编排原则（gen-ai-development 2.0）

- 任何要建 / 改可运行产品代码的开发任务 → 按 `gen-ai-development:autonomy-controller` skill 编排：
  三信号分类 → 设自治档位 → 组装轨道 → 派发 agent → 按档位定门、按强度验证；
  状态落 `openspec/changes/<id>/PIPELINE.md`，续作先读它再继续。
- 调研 / 对比 / 可行性需求 → 按 `gen-ai-development:research-pipeline` skill 编排：
  澄清与追问在主 Agent，researcher 仅作执行单元 spawn。
- 改 skill / agent / command / prompt / 文档本身**不算研发**，不走此编排（以 skill-creator 为权威轨道）。
- 入口型 Skill（coding-guideline / dba-guideline / grill / vcs-workflow 等）按描述自动触发；内部型 Skill（tdd / e2e-test / smell-scan / review-doc 等）由管线角色按名调用，描述压缩为一行、仅保留显式请求触发。
```

> 续作纪律：一旦建了 `openspec/changes/<id>/`，承诺走完轨道或显式废弃，不允许中途静默降级。`PIPELINE.md` 是续作的事实源，**先读它，它压过会话记忆**。

## 运行前置（e2e-test）

`e2e-test` 执行端到端测试，对运行环境有要求——它**不**负责拉起被测应用：

- 被测应用 / 服务已在运行且可达。
- GUI 模式需对应目标：Playwright 浏览器（Web）、已连接设备 / 模拟器（Flutter，`adb devices`）、已构建 debug 产物 + 模拟器/真机（RN，Detox）、已构建 debug 产物 + 运行中 `tauri-driver`（Tauri）。
- **Tauri GUI 端到端在 macOS 不可用**（WKWebView 无 WebDriver）——macOS 上改走 Linux/Windows/CI，或退用 API 模式。
- 数据库校验：MySQL/PostgreSQL 连接信息放环境变量（`DATABASE_URL` 或 `MYSQL_*`/`PG*`），且指向**测试/预发库，绝不是生产**。

## 外部依赖（非本插件分发的能力）

编排链路引用了下列能力，缺席时各有降级路径，不会让流程卡死：

| 能力 | 来源 | 用在哪 | 缺席时的降级 |
|------|------|--------|--------------|
| `graceful-browser` | `plugin-infra` 插件 | e2e agent 驱动模式的浏览器框架选择（优先序权威源） | 按同一优先序（Codex 原生浏览器 @Chrome / @Browser → chrome-devtools MCP → Playwright MCP）直接探测工具族，报告注明降级 |
| `deep-research` | 用户 / 平台级 skill | research-pipeline 的广域多源扫描 | 拆成多个窄题并行 spawn researcher（各自 web search / context7），REPORT.mdx 注明降级 |
| `ui-ux-pro-max` | 外部 skill | `app-ux-design`（visual 轨道 prototype 节点）依赖 | 手工设计文档，或 `[-]` 跳过留痕 |
| 项目级 CD / 遥测 / 回滚 | 使用方项目 | Phase B 后置闭环（`canary` / `auto-revert`）只能**编排进**已有 CD | 无 CD 时可逆车道停在 `auto + 抽检`，不升 `full-auto`（交付边界） |

另：管线产物的子 Agent 写盘（`docs/research/**`、`docs/code-review/**`、`docs/e2e/**`、`openspec/changes/**`）依赖会话运行在**可写工作区沙箱**——`setup-gen-ai` skill 会预先约定这些产物目录、检查沙箱模式并纳入 git。未跑过时各 agent 走「写失败则全文内联返回」兜底，建议初始化时跑一遍。

## 目录结构

```
gen-ai-development/
├── .codex-plugin/plugin.json
├── README.md
└── skills/
    ├── autonomy-controller/     # Tier-3 编排脊柱：三信号 → 档位 → 轨道 → 门禁 → 强度（references: tracks / gates / pipeline-schema）
    ├── research-pipeline/       # Tier-3 调研编排：澄清 → 确认 → 计划 → 并行 spawn → 汇总循环 → synthesize 落盘
    ├── grill/                   # 意图输入：苏格拉底澄清 → BRIEF.md（深档定型领域 + 播种 glossary）
    ├── backlog/                 # 想法队列入队侧：索引定调 → grill → 定点整合 → 活跃索引 BACKLOG.md + backlog/<id>/BRIEF.md（终态条目搬迁至 backlog/archive/）
    ├── review-doc/              # 四件套人审文档：REVIEW.mdx + spec-hash 新鲜度戳
    ├── app-ux-design/           # UI / 视觉设计原型（依赖 ui-ux-pro-max）
    ├── tdd/                     # 红绿重构 + 各语言测试工具链
    ├── e2e-test/                # 端到端执行：GUI(Web/Flutter/RN/Tauri) + API + agent 驱动，写库校验
    ├── debug/                   # 假设驱动调试：Phase 0 复现信号 + 三循环 + 强制清理
    ├── security-scan/           # SAST + 依赖审计 + 密钥扫描（验证门）
    ├── a11y-check/              # axe / Lighthouse 无障碍检查（验证门）
    ├── perf-budget/             # 性能预算对照（验证门）
    ├── smell-scan/              # 架构 / 代码坏味道检测（删除测试 + 推荐强度）
    ├── glossary-conformance/    # 命名一致性机检（防漂移，不带信任额度）
    ├── coding-guideline/        # 多语言编码规约
    ├── dba-guideline/           # MySQL / PostgreSQL 规约
    ├── devops-guideline/        # 任务运行器 / docker-compose 本地中间件 / Dockerfile
    ├── middleware-guideline/    # 中间件接入 Nacos + 监控面
    ├── docs-guideline/          # as-built 文档策展：docs/tech 三分类 + README 索引
    ├── vcs-workflow/            # 分支模型 feat→dev→main + worktree + SemVer 发布 + submodule
    ├── research-source-code/    # 调研方法：锁版本读真源码
    ├── research-data-source/    # 调研方法：只读探查真实数据源
    ├── research-api/            # 调研方法：发现 spec + 真实调用验证
    ├── project-init/            # 命令转 skill：扫描仓库生成 AGENTS.md 并登记 Agent
    └── setup-gen-ai/            # 命令转 skill：准备管线产物目录与可写沙箱

# 配套 Agent（不随 plugin 安装，单独分发）：codex/agents/{researcher,planner,arch-reviewer,developer,e2e-author,code-reviewer,e2e-runner,debugger,release-coordinator}.toml
```
