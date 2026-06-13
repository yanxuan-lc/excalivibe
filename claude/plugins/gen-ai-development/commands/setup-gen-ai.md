---
description: 初始化本项目以顺畅使用 gen-ai-development 的管线能力——把各子 Agent 落盘管线产物（研究报告 / code-review 报告 / openspec 变更产物 / e2e 报告）所需的权限规则合并进项目 .claude/settings.json（保留你已有配置，不覆盖）。
argument-hint: (无需参数)
allowed-tools: Bash(python3 *), Read
---

# gen-ai-development:setup-gen-ai — 初始化管线落盘权限

你的任务：把 gen-ai-development 各子 Agent 落盘**管线产物**所需的**最小权限规则**，安全地合并进**当前项目**的共享设置 `.claude/settings.json`，使其能被 git 提交、随仓库分发给团队。

## 背景（为什么需要这一步）

管线的多个子 Agent 需要写盘，且它们的产物是 merge 门禁的检查对象：`researcher`(synthesize) 写 `docs/research/<datetime>-<topic>/`；`code-reviewer` 写 `docs/code-review/<datetime>/`（其 CHECKLIST 是门禁要件）；`planner`/`arch-reviewer`/`quality-assurance`/`e2e-runner` 写 `openspec/changes/<id>/` 下的 spec、arch-review、manifest 与 e2e 报告（同为门禁要件）。当它们作为**嵌套子 Agent**在 headless/后台模式运行时，需要交互授权的 `Write`/`Edit` 会被**自动拒绝**——而子 Agent 无法弹框。Claude Code 文档明确：**被 `permissions.allow` 预批准的工具，即便子 Agent 在后台运行也照常放行**。所以预批准这些目录的写入，门禁产物才能在任何权限模式下稳定落盘。

> 注意：这是插件能做到的、唯一对所有使用者都通用的方式。插件子 Agent 的 `permissionMode`/`hooks` 字段会被安全策略忽略，agent frontmatter 也没有 `permissions` 字段——只有**项目设置里的 allow 规则**能跨模式生效。

## 要合并的规则（最小授权，仅管线产物目录）

```
Write(/docs/research/**)      Edit(/docs/research/**)       # researcher synthesize
Write(/docs/code-review/**)   Edit(/docs/code-review/**)    # code-reviewer 四件套 → 门禁要件
Write(/docs/e2e/**)           Edit(/docs/e2e/**)            # e2e-runner 无 change dir 时的报告位
Write(/openspec/changes/**)   Edit(/openspec/changes/**)    # spec / arch-review / manifest / e2e-report / PIPELINE.md
```

均为 gitignore 风格、**以项目根为锚**的路径，只覆盖管线产物目录，不波及源码与其他文件。

## 执行步骤

用一段 `python3` 做**幂等、保留式**合并——绝不能覆盖用户已有的任何设置：

1. 定位项目根：优先 `git rev-parse --show-toplevel`，失败则用当前工作目录。
2. 读取 `<root>/.claude/settings.json`；不存在按 `{}` 处理；存在则原样载入（保留全部既有键）。
3. 确保 `permissions.allow` 为数组，把上面两条规则**去重**追加进去；其余内容一字不动。
4. 以 2 空格缩进写回，结尾留换行。
5. 向用户汇报：实际新增了哪几条（已存在的标注"已存在，跳过"）、写入的文件路径。

推荐直接运行下面的脚本（已实现上述逻辑，安全幂等）：

```bash
python3 - <<'PY'
import json, os, subprocess, sys

try:
    root = subprocess.check_output(
        ["git", "rev-parse", "--show-toplevel"],
        stderr=subprocess.DEVNULL).decode().strip()
except Exception:
    root = os.getcwd()

cfg_dir = os.path.join(root, ".claude")
cfg_path = os.path.join(cfg_dir, "settings.json")
os.makedirs(cfg_dir, exist_ok=True)

data = {}
if os.path.exists(cfg_path):
    with open(cfg_path, "r", encoding="utf-8") as f:
        text = f.read().strip()
    if text:
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            print(f"!! 现有 settings.json 不是合法 JSON，已中止以免破坏：{e}", file=sys.stderr)
            sys.exit(1)

perms = data.setdefault("permissions", {})
allow = perms.setdefault("allow", [])
if not isinstance(allow, list):
    print("!! permissions.allow 不是数组，已中止以免破坏现有结构", file=sys.stderr)
    sys.exit(1)

wanted = [
    "Write(/docs/research/**)",    "Edit(/docs/research/**)",
    "Write(/docs/code-review/**)", "Edit(/docs/code-review/**)",
    "Write(/docs/e2e/**)",         "Edit(/docs/e2e/**)",
    "Write(/openspec/changes/**)", "Edit(/openspec/changes/**)",
]
added, skipped = [], []
for rule in wanted:
    if rule in allow:
        skipped.append(rule)
    else:
        allow.append(rule)
        added.append(rule)

with open(cfg_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"settings 文件: {cfg_path}")
print(f"新增规则: {added or '（无，均已存在）'}")
print(f"已存在跳过: {skipped or '（无）'}")
PY
```

## 收尾说明

- 合并后**提醒用户**：权限设置在会话启动时加载，**本次会话可能需重启 Claude Code（或重开会话）后才完全生效**；新起的 researcher 运行将直接享有写权限。
- 若用户更想要个人、不提交的配置，告诉他可把这两条规则改放到 `.claude/settings.local.json`（优先级更高、通常 gitignore）。
- 不要扩大授权范围（不要顺手加 `Bash`/其他写路径）——本命令刻意保持最小授权；源码/数据/接口 method skill 的 bash 仍按正常权限提示走。
