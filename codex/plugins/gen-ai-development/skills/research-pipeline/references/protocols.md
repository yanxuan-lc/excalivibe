# Researcher Spawn & Result Protocols

The contract between the research-pipeline (main agent) and the `researcher`
agent (`codex/agents/researcher.toml`). Both sides follow it so spawns are
reproducible and results merge cleanly.

## Task Spawn Protocol (main agent → researcher)

Every spawn prompt carries these fields (markdown or YAML, field names verbatim):

```yaml
mode: investigate            # investigate（默认）| synthesize
question: >                  # 一句话 scoped 子问题——一个 spawn 只回答一个问题
  库 X 的连接池在 v2.3 里是否支持自动重连？
context: >                   # Step b 的对齐纪要：目标 / 约束 / 已排除方向。
  …                          # researcher 只知道你告诉它的——别省这段
methods:                     # 建议的方法 skill（researcher 可在作用域内自行加选）
  - research-source-code
depth: thorough              # quick-probe | thorough
output_notes: >              # 对 findings 结构的额外期望（可选）
  需要精确到 file:symbol
```

`mode: synthesize` spawns replace `question`/`methods` with:

```yaml
mode: synthesize
topic_slug: event-driven-arch          # 输出目录的 <topic> 部分
inputs: |                              # 各 investigate 结果原文 + Step b 纪要 +
  …                                    # 用户追问的问答记录，全文粘贴
output_dir: docs/research/<YYYY-MM-DD_HH-mm-ss>-<topic>/   # 主 agent 用 date 命令生成后传入
```

Spawn discipline:

- One scoped question per investigate spawn; independent spawns go in one request
  (parallel).
- Pick the model per spawn when you request the agent: the stronger model for
  judgment-heavy subtopics, a lighter one for mechanical probing.
- Never spawn an agent for what you can answer inline, and never send a researcher
  to do deep-research's job (broad web fan-out belongs to the main agent via the
  deep-research skill).

## Result Protocol (researcher → main agent)

An **investigate** spawn returns exactly these sections (markdown headings):

```markdown
## findings
- <结论一句话> — **fact** | **inference**
  - 出处: <repo URL + ref + commit SHA + path/to/file:symbol>
          | <引擎 + 库/表 + 查询口径/计数 + 查询时刻>
          | <环境 + 端点(method+path) + 脱敏请求/响应样例 + 调用时刻>
          | <文档/网页 URL + 关键段落>
- …

## open_questions          # 需要用户拍板的事项——代替"中断提问"
- <问题> — 为什么需要用户回答、备选项是什么

## dead_ends               # 排除了什么、为什么（防止重复调研）
- <方向> — <排除原因>

## suggested_next          # 建议的追加调研（供下一轮计划参考）
- <子问题> — <为什么值得查>
```

Rules:

- Every `findings` entry is tagged **fact** (grounded in a probe or source, with
  provenance) or **inference** (reasoned but unverified). No third state, no
  untagged claims.
- Empty sections are written as `（无）` — an absent section is indistinguishable
  from a forgotten one.
- Results come back **inline in the final message**. Investigate spawns do NOT
  write to `docs/research/` — only the synthesize spawn writes files.

A **synthesize** spawn returns: the artifact paths it wrote (REPORT.mdx +
PROPOSAL.md), plus a ≤10-line key-point digest. If file writes genuinely fail
(attempt first, capture the verbatim error), it returns both files **in full** in
fenced blocks labeled with their intended paths, for the main agent to persist.
