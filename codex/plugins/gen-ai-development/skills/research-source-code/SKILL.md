---
name: research-source-code
description: >-
  Research an open-source library or framework by cloning its repository, checking out the exact version (tag/branch/commit), and studying the real source — not just docs or memory. Use this skill whenever a research task hinges on how something is actually implemented: "how does library X do Y", "compare the internals of A vs B", "what changed between v2 and v3", "is this feature really supported", or when you're about to claim something about a dependency's behavior. Trigger it even when the user doesn't say "clone" — if answering well requires reading the source at a specific version, clone it and read it. The companion data/API research skills are research-data-source and research-api; for a multi-subtask or comparative study spanning several sources, research-pipeline orchestrates this skill.
---

# Source-Code Research

Reading the real source at a pinned version is the difference between a guess and a finding. Docs lag, blog posts generalize, and your training data may be stale or version-blurred. When a conclusion depends on *how something is actually implemented*, clone the repo, lock it to the exact ref the user cares about, and read it.

The output of this skill is a **traceable claim**: every statement about behavior should point back to a file, a symbol, and the **commit SHA** you read it at. That SHA is what makes the finding reproducible six months later when `main` has moved on.

## When this applies

- The question is about a specific library/framework's internals, not a concept you can answer from first principles.
- Version matters ("in v3 they switched to…") — you need the source at *that* ref, not whatever is current.
- You're comparing two implementations and need apples-to-apples evidence.
- You're about to assert a dependency does/doesn't support something and want to be sure.

If the answer is genuinely covered by current official docs, prefer the `context7` MCP for docs lookup and skip the clone. This skill is for when you need the code itself.

## Workflow

### 1. Pin the target

Before cloning, nail down two things:

- **Repo URL** — the canonical upstream (GitHub/GitLab/etc.), not a fork unless the fork *is* the subject.
- **Exact ref** — a release tag (`v3.2.1`), a branch, or a commit SHA. If the user gave a version number, map it to the matching tag. If they didn't specify, default to the latest stable release tag (not `main` — `main` is a moving target and makes your finding unreproducible). State which ref you chose and why.

### 2. Clone to a scratch dir outside this repo

Use the bundled script — it shallow-clones, checks out the ref, and prints the locked SHA. It lives in **this skill's directory** (`scripts/clone-ref.sh` relative to the skill's base directory, not the project CWD):

```bash
bash <skill-base-dir>/scripts/clone-ref.sh <repo-url> <ref> [dest-name]
```

It clones into `${TMPDIR:-/tmp}/agi-research-sources/<repo>` by default. **Never clone into the current git repository** — it would pollute the working tree and risk being committed. The script handles the common cases (tag/branch shallow clone, with a full-clone fallback when the ref is a bare commit SHA) and ends by echoing `HEAD` — **capture that SHA**, it's your provenance.

### 3. Read the source systematically

Don't grep randomly. Work the checklist in [references/study-checklist.md](references/study-checklist.md): orient (README/architecture/entry points) → locate the feature → read the implementation → check the tests (tests are the most honest spec of intended behavior) → note dependencies and trade-offs.

For navigation, prefer symbol-aware tools over plain text search when available:

- **serena MCP** — `find_symbol`, `find_referencing_symbols`, `get_symbols_overview` to jump to definitions and trace call sites precisely.
- **ripgrep** (`rg`) — fast fallback for textual search across the tree.

### 4. Record findings with provenance

Write conclusions back into the active research report (the researcher agent's `docs/research/<...>/` directory). In the report's 参考资料 / References section, for each source-backed claim record:

- Repo URL + ref (tag/branch) + **commit SHA**
- The file path(s) and symbol(s) you read — e.g. `src/core/scheduler.ts:loop()`
- A short quote or paraphrase of the relevant code, not just "I read it"

A claim without a SHA + file pointer is an opinion. With them, it's a finding someone else can verify.

## Safety & hygiene

- **Read-only.** You're studying code, not running it. Do not execute build scripts, install hooks, or run arbitrary `postinstall`/`Makefile` targets from an untrusted repo just to "look around" — reading the source doesn't require running it.
- **Scratch is disposable.** The clone lives outside the repo; you don't need to clean it up mid-task, but never copy it into the project tree.
- **Big repos:** keep the clone shallow (`--depth 1`); if you need history for a "what changed" question, fetch only the range you need rather than the full history.
