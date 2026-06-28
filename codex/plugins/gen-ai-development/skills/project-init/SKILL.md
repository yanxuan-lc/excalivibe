---
name: project-init
description: 初始化当前项目的 AGENTS.md，并登记可用的 Agent（researcher / planner / arch-reviewer / developer / qa-author / code-reviewer / e2e-runner / debugger / release-coordinator）与委派规则。当用户要"初始化项目"、"建项目文档"、"登记 subagent / agent"、"让 Codex / Cursor / Gemini 都能读项目约定"，或刚把本插件装进一个新仓库时使用。
---

# project-init — 项目初始化（Codex 版）

为当前工作目录初始化项目级文档与 Agent 协作规范。**所有产物落在当前工作目录**，不要写入 `~/.codex/`。

补充说明：以用户在本次请求中提供的补充说明（目标读者、特殊约束等）为准；没有就按默认行为。

---

## Step 1 — 扫描仓库生成初稿

扫描当前项目（读取仓库结构、构建脚本、测试命令、依赖清单等），生成 `AGENTS.md` 的基础初稿。

- 若已存在 `AGENTS.md`，**不要覆盖**：先 `Read` 既有内容，再以"增量补全 / 校对"方式更新。
- `AGENTS.md` 是各家 Agent（Codex / Cursor / Gemini / Aider 等）通用读取的项目事实文件——内容应与具体 Agent 工具无关。

## Step 2 — 组织 AGENTS.md 内容

`AGENTS.md`（所有 Agent 都该看的项目事实）应覆盖：

- 项目简介、技术栈、目录结构要点
- 构建 / 测试 / 运行 / lint / typecheck 命令
- 代码风格、命名约定、错误处理与日志规范
- 分支策略、提交约定、PR / Review 流程
- 环境变量、依赖管理、本地启动步骤
- 已知陷阱、领域术语表
- 可用 Agent 列表与委派规则（见 Step 3）

写文件前先列出大纲让用户确认；写入后用 `Read` 核对 frontmatter / 标题层级正确。

## Step 3 — 登记可用 Agent，并明确委派规则

**列出 Agent**（按以下顺序执行）：

1. 本插件随附的 Agent（定义见 `codex/agents/*.toml`，需安装时复制到 `~/.codex/agents/` 或项目 `.codex/agents/`）：`researcher` / `planner` / `arch-reviewer` / `developer` / `qa-author` / `code-reviewer` / `e2e-runner` / `debugger` / `release-coordinator`。
2. 个人级 Agent：执行 `ls ~/.codex/agents/ 2>/dev/null` 列出文件名，并对每个 `.toml` `Read` 取 `name` / `description`。
3. 项目级 Agent：执行 `ls .codex/agents/ 2>/dev/null`，同样读取定义。
4. 不要凭记忆补充不存在的 Agent。

**在 AGENTS.md 写入 "## Agents" 小节**，格式：

```markdown
## Agents

下表列出本项目可用的 Agent。**遇到匹配场景，优先显式请求 Codex spawn 对应 Agent**，而不是在主 Agent 里硬做。表中为能力摘要，具体行为以各 agent 定义为准。

| 名称 | 来源 | 触发场景 | 不要用于 |
|------|------|----------|----------|
| researcher | gen-ai-development | research-pipeline 派发的调研执行单元；快速 scoped 查证 | 直接面向用户的调研入口（用 research-pipeline）；广域 web 扫描（主 Agent 调 deep-research） |
| planner    | gen-ai-development | 走 OpenSpec 流程提案新功能 / 大重构（写四契约 spec） | 单文件修复；实现代码 |
| arch-reviewer | gen-ai-development | spec 含 DDL / 新接口 / 跨模块时，实施前设计审查 | 纯逻辑小 spec（跳过留痕）；审实现代码（那是 code-reviewer） |
| developer  | gen-ai-development | spec 已就绪的 TDD 实施（产品代码 + 单测） | 缺少 spec 时禁用；e2e 测试代码 |
| qa-author | gen-ai-development | spec 声明脚本化载体后写 e2e 测试代码（与 developer 并行） | 改产品代码；agent 驱动载体的变更 |
| code-reviewer | gen-ai-development | merge 进 dev 前的增量审查（门禁，两判定）；全量仅显式要求 | 一次性脚本；审设计（那是 arch-reviewer） |
| e2e-runner | gen-ai-development | 实施 + QA 交付后的 E2E 验收（先拉起应用） | 单测验证；写 / 改任何代码 |
| debugger | gen-ai-development | bug / 失败 / 栈回溯出现时的假设驱动调试 | spec 创建；无 bug 背景的功能实现（只诊断 + 写红回归测试，不改产品码） |
| release-coordinator | gen-ai-development | 发布准备（SemVer 决策、版本同步点核验、release notes 草稿） | 执行 merge/push/publish（不可逆动作由主 Agent 在用户同意下做） |
| <个人级 / 项目级…> | personal / project | … | … |
```

委派规则段落（也写入 AGENTS.md）需明确：

- **并行原则**：多个独立子任务一次性发起多个 spawn 请求。
- **理解不外包**：不要把"基于结果再修复"的判断完全交给被 spawn 的 Agent；主 Agent 必须读关键文件并做综合。
- **研发按 `gen-ai-development:autonomy-controller` skill 编排**：三信号分类、自治档位、轨道组装、按档位定门、按强度验证、`PIPELINE.md` 状态落盘均以该 skill 为准，AGENTS.md 里只写这条指针，不复制内容。
- **调研需求按 `gen-ai-development:research-pipeline` skill 编排**：澄清、确认、追问都在主 Agent；`researcher` 仅作为执行单元被 spawn。
- **改 skill / agent / command / prompt / 文档本身不算研发**，不走上面的编排（以 skill-creator 为权威轨道）。
- **场景匹配示例**（结合本项目，每条 1 行）：
  - 调研 / 对比 / 可行性 → `research-pipeline` skill（researcher 仅执行单元）
  - 提议新模块 / 大重构 → `planner` 走 OpenSpec
  - spec 含 DDL / 新接口 → 实施前 `arch-reviewer` 设计审查
  - 实施已通过 spec 的需求 → `developer`（TDD）∥ `qa-author`（e2e 测试代码）
  - bug / 失败 / 栈回溯 → `debugger` 假设驱动调试
  - merge 进 dev 前 → `code-reviewer`（增量）∥ `e2e-runner`（验收），同一请求并行
  - 发布准备 → `release-coordinator`（只准备，主 Agent 在用户同意下执行）

## Step 4 — 校对与收尾

1. `Read` 最终的 `AGENTS.md`，确认：
   - Agent 表中**没有凭记忆编造**的 agent
   - 命令、路径与当前项目实际一致（必要时 `Bash` 验证 `package.json` / `pyproject.toml` 等里的脚本名）
2. 若是 git 仓库，运行 `git status` 展示新增 / 修改的文件，**不要自动 commit**，让用户审阅后决定。
3. 输出一段简短总结（≤6 行）：写了什么、Agent 数量、是否复用了既有文件、需要用户后续手动确认的点。

---

## 注意事项

- 不要在 AGENTS.md 里写"何时调用 project-init"——它是初始化动作，不属于项目文档。
- 不创建多余文档（如 `CONTRIBUTING.md`、`ARCHITECTURE.md`）除非用户明确要求。
- 全程优先 `Read` / `Edit` / `Write`，仅在需要 shell 时用 `Bash`。
- 若当前目录不是项目根（无 `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` / `.git` 等任一信号），先警告用户并询问是否继续。
