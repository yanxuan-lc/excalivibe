# gen-ai-development

**生成式 AI 开发套件（Generative AI Development）**。

定位：把基于生成式 AI 的研发工作流沉淀成可复用的 Claude Code 能力——开发规约 Skills（自动触发）+ 一组贯穿「研究 → 规划 → 实施 → 评审 → 验证」的专职 Subagent，配套类 OpenSpec 的开发方法。

## Skills（自动触发的开发规约）

这些 Skill 的 `description` 已写成「只要在做对应工作就触发」，无需显式点名：

| Skill | 触发场景 | 内容 |
|-------|----------|------|
| `develop-guideline` | 写新代码 / 改文件 / 加组件函数 / 实现特性 / 修 bug / 评审代码 | 多语言编码规约：TS、JS、React、React Native、Python、Go、Rust、Swift、Dart、Flutter；含命名 / 错误处理 / 代码组织 / 注释通用篇 |
| `dba-guideline` | 任何数据库相关工作：建表 / 改表 / 迁移 / ORM 模型 / 非平凡查询 / review SQL | MySQL、PostgreSQL 的 DDL/DML/DQL 规约（含内部 SQL 审核红线，强制 / 推荐分级） |
| `devops-guideline` | 写 / 改项目任务运行器（Makefile / justfile / npm 脚本）、统一多语言或 monorepo 命令入口、加 build/test/lint/fmt 入口、写本地中间件 docker-compose、写服务镜像 Dockerfile、问「怎么跑 X」 | DevOps 规约：单一命令入口、委托原生工具不重写、聚合动词→分域目标、自文档化分组 help、跨工具依赖显式化；docker-compose 只编排本地中间件（非服务、随机端口防冲突）；Dockerfile 多阶段 + 非 root + 国内镜像源。含 Makefile / docker-compose / Dockerfile 实现参考 |
| `middleware-guideline` | 服务接入平台中间件与监控：接 Nacos / 配置中心、启动读运行时配置、PROFILE 环境选择、配置热更、加健康检查 / `/metrics`、新起服务端骨架 | 中间件接入规约：bootstrap 与业务配置两层分离、`<APP>_PROFILE` 单开关驱动环境隔离、必选中间件 fast-fail 不静默兜底、辅助中间件降级不拖垮服务、密钥只在 bootstrap 层；**服务端必备监控面**：`/healthz` + `/readyz` + Prometheus `/metrics`（业务端口、存活/就绪分离、RED 指标、标签基数纪律，含 Go / Python / Rust / Node.js 接线）。现含 Nacos + 监控参考；OpenObserve 日志规约后续落库 |
| `docs-guideline` | `openspec archive` 之后沉淀文档，或「整理 / 梳理技术文档」「建 docs 索引」「这块设计记到哪」 | as-built 文档策展：`docs/tech`（事实标准）/ `research` / `ued` 三分类、README-as-Index 两跳可达、权威内容不重复只链接、过期叙事打 STALE 横幅 |
| `tdd` | TDD / red-green-refactor / 先写测试 / 单元、回归测试，或 `opsx:apply` 实施阶段 | 红绿重构循环 + 各语言测试工具链（TS / React / React Native / Python / Go / Rust / Swift / Flutter）+ 覆盖率门槛 |
| `e2e-test` | 跑端到端 / 冒烟测试，验证功能经 UI 或接口生效、且**确实写库**，合并前验证运行中的构建 | 三种模式：GUI 脚本套件（Web=Playwright / Flutter=integration_test / RN=Detox / Tauri=tauri-driver+WDIO）+ API 模式 + **agent 驱动模式**（无套件覆盖的场景经 graceful-browser 实时驱动浏览器执行）；均做 MySQL/PG 写入校验。假定应用已运行。是端到端**执行**，区别于 `tdd` 的单元/红绿 |
| `dev-pipeline` | 接到跨模块 / 需调研设计 / 影响面大的开发任务、续作在途的 `openspec/changes/<id>/`、或显式提「走流程」 | **主 Agent 的研发编排规约**：简单 vs 复杂分流决策（单向承诺）、相位图（research → ux → propose → arch-review → spec-confirm → apply ∥ QA → e2e ∥ code-review → merge → archive/docs）、人工检查点（四件套，基于 spec-review 的 REVIEW.md 呈现）、产物门禁表（含产物时效性）、PIPELINE.md 状态落盘（跳步留痕）；含 e2e manifest 契约参考 |
| `spec-review` | spec 走到 spec-confirm 人审、生成人审文档、用户提「四件套确认」「查看 REVIEW」 | **四件套人审文档规约**：`REVIEW.md` 由 spec **单向派生**（固定顺序：模块 → 协议 → 库表 → 用例；表格 / Mermaid / DDL 优先于散文）；spec-hash 新鲜度戳供 Gate 1 机检；用户直接以 markdown 查看 REVIEW.md（不生成 HTML）；下游 agent 禁读——spec 才是实施输入 |
| `research-pipeline` | 任何调研 / 对比 / 可行性需求（「调研一下 X」「A 和 B 怎么选」「这方案可行吗」），或 dev-pipeline 的 research 相位展开 | **主 Agent 的调研编排规约**：路由分流 → 苏格拉底澄清（AskUserQuestion）→ 结论确认 → 调研计划（按子任务路由 deep-research / researcher / inline，模型按任务选）→ 并行派发 → 汇总追问与循环 → synthesize 派发落盘 REPORT.md + PROPOSAL.md；含派发 / 结果协议参考。**所有用户交互都在主 Agent**，researcher 是纯执行单元 |

### 方法类 Skills（调研时按需触发，`researcher` 的下沉工具）

| Skill | 用途 |
|-------|------|
| `research-source-code` | clone 并锁定到精确版本（tag / SHA）读真实源码，结论带 repo + SHA + 文件指针 |
| `research-data-source` | 只读连接真实数据源看 schema / 采样 / 分布 / 体量；不装客户端，复用环境已有通道 |
| `research-api` | 发现 OpenAPI / Swagger 并真实调用验证接口行为与鉴权；read-only 优先，样本脱敏 |

## Subagents（按场景委派）

> 下表是**能力摘要**，便于路由选型；具体行为以 `agents/` 下各 agent 定义为准，两者冲突时定义文件赢。

| Agent | 触发场景 | 备注 |
|-------|----------|------|
| `researcher` | 调研的**纯执行单元**，由 `research-pipeline` 派发（快速 scoped 查证也可直接派） | 两种模式：investigate（一个 dispatch 答一个 scoped 子问题，方法 skill 实操探查，结论带出处、fact/inference 强制标注，待用户拍板的事项以 `open_questions` 带回而非中断提问）；synthesize（汇总各发现落盘 REPORT.md + PROPOSAL.md）。**不与用户交互**；广域 web 扫描归主 Agent 直接调 deep-research |
| `planner` | 复杂 / 新特性 / 架构变更的设计提案（`opsx:propose`） | 验收标准含**场景级 e2e 用例**（稳定 ID `S1/S2/…`、操作/断言/落库三段式）并声明执行载体（Playwright 脚本化 vs agent 驱动）；随 spec 派生人审文档 `REVIEW.md`（按 `spec-review` skill 模板，spec 每次修订后重生成）；存在 `docs/research/<…>/PROPOSAL.md`、`docs/ued/<…>/` 时必读；涉数据模型或接口时 consult `dba-guideline` / `middleware-guideline` |
| `arch-reviewer` | spec 含 DDL / 新增改动接口面 / 跨模块边界时，**apply 之前**做设计审查（裁量触发） | 审 schema / 接口契约 / 模块边界 / 验收标准可测性（含 e2e 场景完备性）；轻量产出 `arch-review.md`，闭环走 planner 改 spec；在设计阶段拦截「实施后才发现」的最贵缺陷 |
| `developer` | OpenSpec `opsx:apply` 实施阶段（前置 spec 已存在） | 严格 TDD（业务逻辑 + 单测）；**不写 e2e 测试代码**；统一 consult `tdd` + `develop-guideline` +（涉库时）`dba-guideline` |
| `quality-assurance` | spec 确认且声明脚本化载体后，与 developer **并行派发** | 黑盒 SDET：按 spec 场景（非实现）写 Playwright / 接口 / DB 校验测试代码，交付 `e2e-manifest.md`（场景→用例映射 + 运行命令 + 有意留空清单）；**绝不改产品代码**（与 e2e-runner「绝不改测试」镜像）；登录态走 storageState / connectOverCDP |
| `code-reviewer` | **merge 进 dev 的门禁**：增量审查变更 diff（与 e2e-runner 同消息并行派发）；全量审查仅显式要求时 | P0/P1 全部 Resolved 才可合并；mode 由派发方显式传入（缺省 incremental，不询问）；审查以 `develop-guideline` + `dba-guideline` + `tdd` 为准绳，不重审 arch-reviewer 已定的设计 |
| `e2e-runner` | 实施 + QA 交付后跑端到端验收（主 agent 先拉起应用与依赖） | 按 manifest 查表路由：有映射的场景跑脚本（**零 LLM**），无映射的经 graceful-browser agent 驱动；两路统一写库校验；失败只用 agent 复现诊断（product/test/infra 分类）、不改判；报告**落盘** `e2e-report.md` 含场景覆盖 N/M——merge 门禁消费的就是这个文件 |

## 编排原则（推荐写入使用方项目的 CLAUDE.md / AGENTS.md）

完整的编排规约——分流决策、相位图、产物门禁、PIPELINE.md 状态落盘——**以本插件的 `dev-pipeline` / `research-pipeline` 两个 skill 分发**，随插件版本更新，无需在使用方项目里复制内容。使用方 CLAUDE.md 只需要一段很短的路由指针（`project-init` 命令会代写）：

```markdown
## 研发编排原则（gen-ai-development）

- 复杂研发（跨模块、需调研/设计、影响面大）→ 按 `gen-ai-development:dev-pipeline` skill 编排：
  分流决策、subagent 相位、人工检查点（四件套）、merge 门禁、状态落盘均以该 skill 为准。
- 调研 / 对比 / 可行性需求 → 按 `gen-ai-development:research-pipeline` skill 编排：
  澄清与追问在主 Agent，researcher 仅作执行单元派发。
- 简单修改（单文件、改配置、小 bugfix、纯文案）→ 主 Agent 直接处理，不走管线。
- 规约类 Skill（develop-guideline / dba-guideline / tdd 等）按描述自动触发，无需点名。
```

> 判断「简单 / 复杂」靠工程判断，不强行卡阈值；拿不准时读一遍 `dev-pipeline` skill 的分流规则再定。一旦建了 `openspec/changes/<id>/`，承诺走完管线或显式废弃，不允许中途静默降级。

## 运行前置（e2e-test）

`e2e-test` 执行端到端测试，对运行环境有要求——它**不**负责拉起被测应用：

- 被测应用 / 服务已在运行且可达。
- GUI 模式需对应目标：Playwright 的浏览器（Web）、已连接的设备 / 模拟器（Flutter，`adb devices`）、已构建的 debug 产物 + 已启动的模拟器/真机（React Native，Detox）、已构建的 debug 产物 + 运行中的 `tauri-driver`（Tauri）。
- **Tauri GUI 端到端在 macOS 不可用**（WKWebView 无 WebDriver）——在 macOS 上需改走 Linux/Windows/CI，或退而用 API 模式。
- 数据库校验：MySQL/PostgreSQL 的连接信息放环境变量（`DATABASE_URL` 或 `MYSQL_*`/`PG*`），且应指向**测试/预发库，绝不是生产**。

## 外部依赖（非本插件分发的能力）

编排链路引用了下列能力，缺席时各有降级路径，不会让管线卡死：

| 能力 | 来源 | 用在哪 | 缺席时的降级 |
|------|------|--------|--------------|
| `graceful-browser` | `plugin-infra` 插件 | e2e agent 驱动模式的浏览器框架选择（优先序的权威源） | 按同一优先序（claude --chrome → chrome-devtools MCP → Playwright MCP）直接探测工具族，报告中注明降级 |
| `deep-research` | 用户 / 平台级 skill | research-pipeline Step c 的广域多源扫描 | 拆成多个窄题并行派发 researcher（各自用 web search / context7），REPORT.md 注明降级 |
| `app-ux-design` | 本插件 skill（依赖 `ui-ux-pro-max`） | dev-pipeline 的 ux 相位 | 手工设计文档，或 `[-]` 跳过留痕 |

另：管线产物的子 Agent 写盘权限（`docs/research/**`、`docs/code-review/**`、`docs/e2e/**`、`openspec/changes/**`）由 `setup-gen-ai` 命令一次性合并进使用方项目的 `.claude/settings.json`——未执行时各 agent 走「写失败则全文内联返回」兜底，但建议初始化时就跑一遍。

## 目录结构

```
gen-ai-development/
├── .claude-plugin/plugin.json
├── agents/                      # researcher / planner / arch-reviewer / developer / quality-assurance / code-reviewer / e2e-runner
├── commands/                    # setup-gen-ai：初始化调研写权限；project-init：初始化 AGENTS.md / CLAUDE.md 并登记 Subagent
├── skills/
│   ├── develop-guideline/       # 多语言编码规约
│   ├── dba-guideline/           # MySQL / PostgreSQL 规约
│   ├── devops-guideline/        # 任务运行器 / docker-compose 本地中间件 / Dockerfile
│   ├── middleware-guideline/    # 中间件接入：Nacos（Prometheus / OpenObserve 待落库）
│   ├── docs-guideline/          # as-built 文档策展：docs/tech 三分类 + README 索引
│   ├── vcs-workflow/            # 分支模型 feat→dev→main + worktree 并行 + SemVer 发布流程（npmjs/Nexus）+ submodule
│   ├── dev-pipeline/            # 主 Agent 研发编排：分流决策 + 相位图 + 四件套人工检查点 + 产物门禁 + PIPELINE.md 状态（含 e2e manifest 契约）
│   ├── spec-review/             # 四件套人审文档：REVIEW.md 模板 + spec-hash 新鲜度戳（用户直接查看 markdown）
│   ├── research-pipeline/       # 主 Agent 调研编排：澄清 → 确认 → 计划 → 并行派发 → 汇总循环 → synthesize 落盘（含派发/结果协议）
│   ├── tdd/                     # 红绿重构 + 各语言测试工具链
│   ├── e2e-test/                # 端到端执行：GUI(Web/Flutter/RN/Tauri) + API 模式 + 写库校验
│   ├── research-source-code/    # 调研方法：锁版本读真源码
│   ├── research-data-source/    # 调研方法：只读探查真实数据源
│   └── research-api/            # 调研方法：发现 spec + 真实调用验证
└── README.md
```
