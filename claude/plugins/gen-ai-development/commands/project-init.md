---
description: 初始化当前项目的 AGENTS.md 与 CLAUDE.md，并登记可用的 Subagent
argument-hint: "[可选：补充说明，例如目标读者、特殊约束]"
allowed-tools: Bash, Read, Write, Edit, Skill, Agent
---

# gen-ai-development:project-init — 项目初始化

请按照以下步骤为当前工作目录初始化项目级文档与 Agent 协作规范。**所有产物落在当前工作目录**，不要写入 `~/.claude/`。

补充说明（来自用户）：$ARGUMENTS

---

## Step 1 — 调用内置 /init 生成初稿

调用内置 skill `init` 让 Claude Code 扫描当前项目并生成基础的 `CLAUDE.md`。这一步会读取仓库结构、构建脚本、测试命令等基础信息。

- 使用 `Skill` 工具调用 `init`（若用户未在系统提示中显式列出该 skill，则按其常规约定行为：扫描仓库、提议 `CLAUDE.md` 草稿）。
- 若已存在 `CLAUDE.md`，**不要覆盖**，先 `Read` 既有内容，再以"增量补全 / 校对"方式更新。
- 若已存在 `AGENTS.md`，同样以增量更新方式处理。

## Step 2 — 拆分内容：AGENTS.md vs CLAUDE.md

`/init` 产物是 Claude Code 专属的，需要按受众重新拆分，使其他 Agent（Cursor / Codex / Gemini / Aider 等）也能直接读取 `AGENTS.md`。

**AGENTS.md（与 Agent 工具无关、所有 Agent 都该看的项目事实）**
- 项目简介、技术栈、目录结构要点
- 构建 / 测试 / 运行 / lint / typecheck 命令
- 代码风格、命名约定、错误处理与日志规范
- 分支策略、提交约定、PR / Review 流程
- 环境变量、依赖管理、本地启动步骤
- 已知陷阱、领域术语表

**CLAUDE.md（仅 Claude Code 相关的偏好与机制）**
- 顶部加 `See [AGENTS.md](./AGENTS.md) for project facts shared across agents.` 让 CLAUDE.md 引用 AGENTS.md，**避免重复内容**
- Claude Code 专属设置：`/` 命令偏好、hooks 行为、MCP 使用偏好、permission/skill 偏好
- 当前项目下可用的 Subagent 列表与触发条件（见 Step 3）
- Claude Code 在该项目中应避免/必须做的事（如"禁止 amend 已推送的 commit"等）

写文件前先列出大纲让我确认；写入后用 `Read` 核对 frontmatter / 标题层级正确。

## Step 3 — 登记可用 Subagent，并明确委派规则

**列出 Subagent**（按以下顺序执行）：

1. Plugin 级 Subagent：以当前会话系统提示中列出的为准（本插件自带 `researcher` / `planner` / `arch-reviewer` / `developer` / `qa-author` / `code-reviewer` / `e2e-runner` / `debugger` / `release-coordinator`，安装后即可用）。
2. 用户级 Subagent：`Bash` 执行 `ls ~/.claude/agents/ 2>/dev/null` 列出文件名，并对每个文件 `Read` 取 frontmatter 中的 `name` / `description`。
3. 项目级 Subagent：`Bash` 执行 `ls .claude/agents/ 2>/dev/null`，同样读取 frontmatter。
4. 内置 Subagent（如 `general-purpose`、`Explore`、`Plan` 等）按当前会话系统提示中列出的为准；不要凭记忆补充。

**写入 CLAUDE.md 的 "## Subagents" 小节**，格式：

```markdown
## Subagents

下表列出本项目可用的 Subagent。**遇到匹配场景，必须优先通过 `Agent` 工具委派**，而不是在主 Agent 里硬做。表中为能力摘要，具体行为以各 agent 定义为准。

| 名称 | 来源 | 触发场景 | 不要用于 |
|------|------|----------|----------|
| researcher | plugin (gen-ai-development) | research-pipeline 派发的调研执行单元；快速 scoped 查证 | 直接面向用户的调研入口（用 research-pipeline）；广域 web 扫描（主 Agent 调 deep-research） |
| planner    | plugin (gen-ai-development) | 走 OpenSpec 流程提案新功能 / 大重构（写四契约 spec） | 单文件修复；实现代码 |
| arch-reviewer | plugin (gen-ai-development) | spec 含 DDL / 新接口 / 跨模块时，实施前设计审查 | 纯逻辑小 spec（跳过留痕）；审实现代码（那是 code-reviewer） |
| developer  | plugin (gen-ai-development) | spec 已就绪的 TDD 实施（产品代码 + 单测） | 缺少 spec 时禁用；e2e 测试代码 |
| qa-author | plugin (gen-ai-development) | spec 声明脚本化载体后写 e2e 测试代码（与 developer 并行） | 改产品代码；agent 驱动载体的变更 |
| code-reviewer | plugin (gen-ai-development) | merge 进 dev 前的增量审查（门禁，两判定）；全量仅显式要求 | 一次性脚本；审设计（那是 arch-reviewer） |
| e2e-runner | plugin (gen-ai-development) | 实施 + QA 交付后的 E2E 验收（先拉起应用） | 单测验证；写 / 改任何代码 |
| debugger | plugin (gen-ai-development) | bug / 失败 / 栈回溯出现时的假设驱动调试 | spec 创建；无 bug 背景的功能实现（只诊断 + 写红回归测试，不改产品码） |
| release-coordinator | plugin (gen-ai-development) | 发布准备（SemVer 决策、版本同步点核验、release notes 草稿） | 执行 merge/push/publish（不可逆动作由主 Agent 在用户同意下做） |
| Explore    | built-in | 跨多文件的代码定位与"在哪定义" | 已知路径直接 Read |
| Plan       | built-in | 设计实施方案 | 单行修改 |
| general-purpose | built-in | 多步开放式搜索/调研 | 单次明确查找 |
| <用户级 / 项目级…> | user / project | … | … |
```

委派规则段落（也写入 CLAUDE.md）需明确：

- **并行原则**：多个独立子任务一次性发起多个 `Agent` 调用。
- **理解不外包**：不要把"基于结果再修复"的判断完全交给 Subagent；主 Agent 必须读关键文件并做综合。
- **研发按 `gen-ai-development:autonomy-controller` skill 编排**：三信号分类、自治档位、轨道组装、按档位定门、按强度验证、`PIPELINE.md` 状态落盘均以该 skill 为准，CLAUDE.md 里只写这条指针，不复制内容。
- **调研需求按 `gen-ai-development:research-pipeline` skill 编排**：澄清、确认、追问都在主 Agent；`researcher` 仅作为执行单元被派发。
- **改 skill / agent / command / prompt / 文档本身不算研发**，不走上面的编排（以 skill-creator 为权威轨道）。
- **场景匹配示例**（结合本项目，每条 1 行）：
  - 改动跨 ≥3 文件且不确定影响面 → 先 `Explore`
  - 调研 / 对比 / 可行性 → `research-pipeline` skill（researcher 仅执行单元）
  - 提议新模块 / 大重构 → `planner` 走 OpenSpec
  - spec 含 DDL / 新接口 → 实施前 `arch-reviewer` 设计审查
  - 实施已通过 spec 的需求 → `developer`（TDD）∥ `qa-author`（e2e 测试代码）
  - bug / 失败 / 栈回溯 → `debugger` 假设驱动调试
  - merge 进 dev 前 → `code-reviewer`（增量）∥ `e2e-runner`（验收），同消息并行
  - 发布准备 → `release-coordinator`（只准备，主 Agent 在用户同意下执行）

## Step 4 — 校对与收尾

1. `Read` 最终的 `AGENTS.md` 与 `CLAUDE.md`，确认：
   - 没有重复内容（CLAUDE.md 只引用 AGENTS.md 中的项目事实）
   - Subagent 表中**没有凭记忆编造**的 agent
   - 命令、路径与当前项目实际一致（必要时 `Bash` 验证 `package.json` / `pyproject.toml` 等里的脚本名）
2. 若是 git 仓库，运行 `git status` 展示新增 / 修改的文件，**不要自动 commit**，让用户审阅后决定。
3. 输出一段简短总结（≤6 行）：写了什么、Subagent 数量、是否复用了既有文件、需要用户后续手动确认的点。

---

## 注意事项

- 不要在 AGENTS.md / CLAUDE.md 里写"何时调用 project-init"——它是初始化命令，不属于项目文档。
- 不创建多余文档（如 `CONTRIBUTING.md`、`ARCHITECTURE.md`）除非用户在 `$ARGUMENTS` 中明确要求。
- 全程优先 `Read` / `Edit` / `Write`，仅在需要 shell 时用 `Bash`。
- 若当前目录不是项目根（无 `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` / `.git` 等任一信号），先警告用户并询问是否继续。
