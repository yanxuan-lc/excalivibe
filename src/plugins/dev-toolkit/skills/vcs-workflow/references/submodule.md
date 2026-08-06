# Meta Repo + Submodule Workflow

A meta repo pins each submodule to a specific commit SHA. Changing code in a submodule doesn't change the meta repo until you explicitly update the pointer. This shape buys independent release cadence per component, at the cost of needing a deliberate workflow.

The branch model from SKILL.md applies **at every level**: each repo (meta and submodule) has its own `feat → dev → main` flow. "Canonical base" below means `origin/dev` where the repo has one, `origin/main` otherwise.

## The Four Principles

1. **Unified branch naming.** Use the *same* branch name (e.g. `feat/payment-v2`) on the meta repo and on every submodule you touch for that feature. Cross-repo traceability is the whole reason — without it, future-you cannot find which submodule branch goes with which meta commit.
2. **Never commit on a detached HEAD inside a submodule.** A fresh `git submodule update` leaves each submodule pointed at a SHA, not a branch. Commits made there are reachable only by SHA and silently get GC'd. Always `checkout` a branch first.
3. **Merge submodule MRs before the meta-repo MR.** The meta repo's pointer must reference a commit that exists on the submodule's integration branch *after* merging. Reversing the order leaves the meta repo pointing at an unmerged (and possibly soon-to-be-rebased) SHA.
4. **The meta repo's commit is the bump.** A meta-repo MR that touches submodules should consist of `git add <submodule-path>` to record the new SHA, plus optionally `.gitmodules` changes. Don't mix unrelated meta-repo logic into the same commit — review gets confusing.

## Starting a New Feature

```bash
# 1. Update the meta repo and submodule contents
cd meta-repo
git fetch origin
git checkout dev && git pull                 # or main if the meta repo has no dev
git submodule update --init --recursive      # bring submodules to the pinned SHAs

# 2. (Optional but recommended) create a worktree at the meta level
git worktree add -b feat/<name> ../meta-feat-<name> origin/dev
cd ../meta-feat-<name>
git submodule update --init --recursive      # worktrees need this again

# 3. For each submodule you'll modify, check out a real branch with the SAME name
cd path/to/submodule
git fetch origin
git checkout -b feat/<name> origin/dev       # or: git checkout feat/<name> if it already exists
```

For submodules you only *read*, leave them at the pinned SHA — no branch needed.

## The Detached-HEAD Footgun, in Detail

After `git submodule update`, `git status` inside a submodule shows `HEAD detached at <sha>`. If you edit and `git commit` here, the commit is created but is reachable only by its SHA. The next `git submodule update` moves HEAD away, and the commit becomes garbage (typically GC'd within ~90 days).

**Rule:** the first command you run inside a submodule, before any edit, is `git checkout <branch>` (creating one if needed). If you realize you already committed on a detached HEAD, *do not run `git submodule update`*. Instead:

```bash
git branch feat/<name> HEAD     # name the current SHA so it survives
git checkout feat/<name>
```

Then push immediately.

## Worktree + Submodule Compatibility

Modern git (≥ 2.38) handles `git worktree add` on a repo with submodules, but two quirks remain:

- Worktrees don't automatically populate submodules. After `git worktree add`, run `git submodule update --init --recursive` inside the new worktree.
- A submodule's own `.git` directory lives under the *main* checkout's `.git/modules/<path>`, not under the worktree. Submodules in worktrees still work — but a `rm -rf` of your main checkout breaks worktree submodules. Remove worktrees with `git worktree remove` first.

Two viable patterns:

- **Pattern A (default).** Worktree on the meta repo, submodules checked out fresh inside the worktree. Best when you actively switch between features.
- **Pattern B.** No worktree, just branch the main meta checkout. Best when there are many submodules and the per-worktree `submodule update` cost dominates, or when build tooling pins absolute paths.

## Syncing with Upstream

```bash
# Pull meta-repo changes and re-sync submodules in one go
git pull --recurse-submodules
git submodule update --init --recursive

# Update every submodule to its remote tip on its tracked branch
# (use sparingly — this advances pointers and you'll need to commit them in the meta repo)
git submodule update --remote --merge
```

## Wrapping Up — Merge Order Is the Critical Thing

1. In each modified submodule: finish on `feat/<name>` per the SKILL.md flow (local merge into its `dev`, push, MR into its `main` when releasing — or whatever level the meta repo pins against).
2. Back in the meta repo: ensure each submodule's branch is merged. Inside each submodule, `git checkout <merged-branch> && git pull` so HEAD points at the merged tip.
3. From the meta repo root: `git add <submodule-path>` for each updated submodule — this records the *new* pinned SHA.
4. Commit on the meta repo's `feat/<name>`, merge into its `dev` per the normal flow. The diff should be small: pointer bumps plus any meta-only changes.

Verify a pointer bump is safe with `git -C <submodule> branch --contains <sha>` — if the target branch isn't listed, the bump is premature. If timing forces the meta MR to open before submodule MRs are merged (e.g. for early review), explicitly mark it **blocked on** the submodule MRs and do not merge until every referenced SHA has landed.

## Batch Operations Across Submodules

```bash
git submodule foreach 'git status -s'                                  # any dirty submodule?
git submodule foreach 'git checkout feat/<name> 2>/dev/null || true'   # switch where the branch exists
git submodule foreach 'git push -u origin HEAD'                        # push current branch in each (on user request)
git submodule foreach --recursive 'git fetch'                          # fetch everywhere, nested too
```

`foreach` with `|| true` lets the loop continue past submodules that don't have the branch.

## Quick Reference

```bash
# start (from a fresh meta checkout on dev)
git worktree add -b feat/X ../meta-feat-X origin/dev
cd ../meta-feat-X
git submodule update --init --recursive
cd path/to/submodule && git checkout -b feat/X origin/dev

# during work
git -C path/to/submodule status              # confirm on branch, not detached
git submodule foreach 'git status -s'        # quick health check

# wrapping up
# 1. submodule: finish per SKILL.md flow, get it merged
# 2. meta:      git add path/to/submodule, commit on feat/X, merge into dev
```
