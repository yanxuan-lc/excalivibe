---
name: vcs-workflow
description: Branch, merge, and release by convention — feat branches developed in worktrees, locally merged into dev, merge requests into a protected main, and the release pipeline (SemVer-compliant version bump → MR into main → pull main → build → publish to npmjs / Nexus). Use this skill whenever starting a new feature/task/bugfix and setting up a branch or worktree, merging finished work into dev, preparing a merge request, cutting or publishing a release ("发版", "发布到 npm/nexus", "bump version", choosing major/minor/patch), or working in a meta repo with submodules (detached HEAD, pointer bumps, merge order). Also use it proactively when you notice work about to be committed directly on main or dev, a publish about to run from a non-main checkout, or a submodule commit on a detached HEAD — these are irreversible-footgun moments worth interrupting for.
---

# Git Development & Release Workflow

How code travels in our repos, end to end:

```
feat/<name> ──(local merge)──▶ dev ──(push + MR)──▶ main ──(pull, build)──▶ npmjs / Nexus
```

- **`main`** is the release branch. Protected: it only advances via merge request, never by direct commit or push. What's on `main` is what's published.
- **`dev`** is the integration branch. Finished feature branches are merged into it **locally**, then pushed.
- **`feat/<name>`** (or `fix/`, `chore/`) is where development happens — branched off `dev`, one branch per task, developed in a worktree when work is parallel.

## Reference Routing

| Topic | Reference | When to read |
|-------|-----------|--------------|
| Release & publish | [references/release.md](references/release.md) | Bumping a version, cutting a release MR, publishing to npmjs or Nexus |
| Meta repo + submodules | [references/submodule.md](references/submodule.md) | `.gitmodules` exists — branch coordination, detached-HEAD footgun, pointer-bump merge order |

## Step 0 — Identify the Repo Shape

```bash
git rev-parse --show-toplevel          # confirms we're inside a git repo
test -f .gitmodules && cat .gitmodules # present ⇒ meta repo with submodules
```

Single repo → continue below. Meta repo + submodules → the same branch model applies at every level, but read [references/submodule.md](references/submodule.md) first for the coordination rules.

## Starting a Task

**Default: develop in a `git worktree`, not on the main checkout.** Worktrees share the same `.git` storage but give each task its own directory — no stash-switch-pop dance, no build/IDE state leaking between tasks, and reviewing someone else's branch never disturbs your own.

```bash
git fetch origin
git worktree add -b feat/<short-name> ../<proj>-feat-<short-name> origin/dev
cd ../<proj>-feat-<short-name>
```

Conventions:

- **Branch off `origin/dev`**, not your possibly-stale local `dev`, and not `main`.
- **Sibling directory, suffix = branch name.** `../proj-feat-payment-v2` is findable later via `git worktree list`.
- Skip the worktree only for sub-minute fixes or throwaway experiments — if you do the stash-switch dance more than once a week, worktrees should be your default.

## Finishing a Task — Local Merge into dev

When the task is done (scope complete, tests/lints/validation passing):

```bash
git checkout dev && git pull origin dev   # in the main checkout
git merge --no-ff feat/<name>             # keep the feature boundary visible in history
# re-run the repo's test/validate target on the merged result
git push origin dev                       # only on explicit user request — see Commit & Push Policy below
```

Then clean up:

```bash
git worktree remove ../<proj>-feat-<name>
git branch -d feat/<name>
git fetch --prune
```

`--no-ff` keeps a merge commit per feature, which is what makes `dev`'s history auditable. If the merge conflicts, resolve on `dev` locally — that's exactly why integration happens here and not in an MR queue.

## Getting into main

`main` only moves via merge request. There are two MR shapes — pick by scenario; details, including the version bump that precedes them, are in [references/release.md](references/release.md):

- **Release branch** (`release/<component>-<version>` cut from `dev`) — default for a monorepo releasing one component, or when `dev` carries unrelated in-flight work that must not ship yet.
- **`dev` → `main` directly** — for small repos or when everything on `dev` is exactly what ships.

## Commit & Push Policy

- When a logical unit of work is finished on a `feat/` branch — **commit locally without asking**. A dirty tree makes context switches expensive; a commit makes the state recoverable.
- **Never `git push` unless the user explicitly asks.** Push is outward-visible (CI fires, teammates see it). This includes the `git push origin dev` in the wrap-up flow above — the local merge is fine to do as part of finishing, the push waits for the user.
- **Never commit directly on `main`**, and don't make non-merge commits on `dev` — `dev` receives feature work only through merges (the release-bump commit in [references/release.md](references/release.md) Form B is the one exception).
- Multiple unrelated concerns in one change → propose splitting into separate commits first.
- Commit message format → follow project convention or the `commit-commands` skills; this skill stays out of message styling.

## Common Misuses to Catch Proactively

Interrupt and fix before continuing if you observe:

- **Editing files directly on `main` or `dev`.** Even "one-line" fixes. Move the work to a `feat/` branch (`git stash` → worktree → `stash pop` if edits already exist).
- **Merging a pipeline-tracked change into `dev` with its gates open.** If the work belongs to an in-flight `openspec/changes/<id>/`, the merge gate must hold first: the review CHECKLIST's P0/P1 items all Resolved, and the e2e report on disk, all green, scenario coverage complete (see the `autonomy-controller` skill's gate details). A merge that skips these ships unverified state into the integration branch — stop and complete the gates.
- **A publish about to run from anything other than a fresh-pulled `main`.** See [references/release.md](references/release.md) — publishing from `dev`/`feat`/a dirty tree ships unreviewed state irreversibly.
- **A version bump that doesn't move all of the repo's version sync points together** (manifest + package.json + lockfile + marketplace entry…). Grep the old version string before committing the bump.
- **A version that isn't valid SemVer, or the wrong increment for the change** (breaking change shipped as a patch, version reused or decreased). Increment rules in [references/release.md](references/release.md).
- **`git push --force` to a shared branch.** Suggest `--force-with-lease` and confirm with the user first; on `main`/`dev` it's almost never right.
- **Committing inside a submodule that shows `HEAD detached at …`.** Stop — name a branch first; see [references/submodule.md](references/submodule.md).

## Quick Reference

```bash
# start
git worktree add -b feat/X ../proj-feat-X origin/dev
cd ../proj-feat-X                          # ... develop, commit ...

# finish
git checkout dev && git pull origin dev && git merge --no-ff feat/X
git push origin dev                        # only on explicit user request
git worktree remove ../proj-feat-X && git branch -d feat/X

# release → references/release.md
# submodules → references/submodule.md
```
