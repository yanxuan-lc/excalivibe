# Release & Publish Flow

The release pipeline, end to end:

```
dev (all features merged) → bump version → MR into main → pull main → build → publish
```

Every step before "publish" is reversible; publish is not. The whole flow exists to make sure what reaches the registry is exactly one reviewed, reproducible commit on `main`.

## Step 1 — Preconditions

- Everything that should ship is merged into `dev` and pushed; tests / CI / validation green.
- Working tree clean (`git status`), no half-done feature work about to leak into the release.

## Step 2 — Bump the Version Locally

### Versions MUST follow SemVer

Every version is `MAJOR.MINOR.PATCH` (optionally `-prerelease`, e.g. `1.4.0-rc.1`) per [semver.org](https://semver.org). A version that doesn't parse as SemVer breaks npm/Nexus range resolution and tooling — this is a hard rule, not a style preference.

Choose the increment from the **actual diff between `dev` and `main`**, not gut feel:

| Change in the release | Increment | Example |
|---|---|---|
| Breaking: removed/renamed API, changed config/schema semantics, dropped support | **MAJOR** | `1.4.2 → 2.0.0` |
| Backward-compatible new capability (new command/skill/endpoint/option) | **MINOR** | `1.4.2 → 1.5.0` |
| Backward-compatible fix, docs, internal refactor | **PATCH** | `1.4.2 → 1.4.3` |

Additional rules:

- **Pre-releases** use `-alpha.N` / `-beta.N` / `-rc.N` and rank *below* the release version. On npm, publish them with `npm publish --tag next` (or similar) — a pre-release must never become `latest`.
- **`0.x` caveat:** SemVer allows breaking changes in MINOR while major is 0. Once anything external depends on the package, prefer graduating to `1.0.0` over staying in 0.x ambiguity.
- **Never:** reuse or decrease a version, use 4-segment versions (`1.2.3.4`), or put a leading `v` in manifests — `v` belongs to git tags only (`v1.5.0`), not to `package.json`/registry versions.

### Mechanics

- **Use the repo's task-runner target if one exists** (`make bump-version`, `npm version`, …) — never hand-edit versions when a target encodes the sync logic. `npm version major|minor|patch` enforces SemVer for you.
- **Move every version sync point together.** A version often lives in more than one file (e.g. `package.json` + a plugin manifest + a marketplace/registry entry + a lockfile). Before committing, `grep -rn "<old-version>"` to catch stragglers — validators typically do *not* cross-check version consistency, and a missed spot means users can't install.
- One bump commit, message like `chore(<component>): bump to <version>` — don't mix code changes into it.

## Step 3 — Get It onto main (two MR forms)

`main` is protected; both forms end in a merge request. Choose by scenario:

### Form A — Release branch (default for monorepos / per-component releases)

Use when releasing **one component out of several**, or when `dev` carries unrelated in-flight work that must not ship yet.

```bash
git checkout dev && git pull origin dev
git checkout -b release/<component>-<version>
# bump here (Step 2), commit
git push -u origin release/<component>-<version>
# open MR: release/<component>-<version> → main
```

The release branch freezes exactly what ships while `dev` keeps moving. Name it after the component and version (e.g. `release/gen-ai-development-1.2.0`) so history reads itself.

### Form B — dev → main directly

Use for small single-component repos where everything on `dev` is exactly what ships.

```bash
git checkout dev && git pull origin dev
# bump here (Step 2), commit
git push origin dev
# open MR: dev → main
```

### After the MR merges — back-merge

In Form A the bump commit now exists on `main` but not on `dev`; sync it back or the next bump will conflict or regress:

```bash
git checkout dev && git pull origin dev
git merge origin/main          # or merge the release branch into dev
git push origin dev
```

(Form B needs nothing — `dev` already contains the bump.)

## Step 4 — Pull main and Build

Build **only from a fresh-pulled `main`** — never from a local branch that "should be identical":

```bash
git checkout main && git pull origin main
git status                     # must be clean and on the merged SHA
# build via the repo's task runner (make build / npm pack / …)
```

This guarantees the published artifact corresponds to a commit anyone can check out.

## Step 5 — Publish

**Publishing is outward-visible and effectively irreversible — always get explicit user confirmation before running it.** Never auto-run a publish target, even when every prior step succeeded.

### npmjs

- Verify identity first: `npm whoami` (and the registry: `npm config get registry`).
- Scoped public packages need `npm publish --access public` on first publish.
- **Versions are immutable.** A bad publish is fixed by bumping and publishing again (`npm deprecate` the bad one if needed) — never `npm unpublish` something others may already depend on.
- Check what ships before it ships: `npm pack --dry-run` shows the file list.

### Nexus (private registry)

- Registry and credentials come from `.npmrc` / environment variables — **never committed**. If credentials leak into a commit or manifest, rotate them in Nexus immediately.
- Raw-hosted uploads may silently overwrite an existing path. Treat them as immutable anyway: bump and re-publish rather than overwriting, because consumers cache and there is no rollback.
- **Publish order matters when artifacts cross-reference**: if a manifest/index references a package at a specific version (e.g. a marketplace manifest pointing at an npm package), publish the package **first**, the manifest **second** — the reverse leaves a window where consumers resolve a version that doesn't exist.

### Optionally: tag

If the project tags releases, tag the merged commit on `main` (`git tag <component>-v<version> && git push origin <tag>`) right after publishing, so registry artifacts map to git history.

## Footguns

- **Publishing from `dev` / `feat` / a dirty tree.** Only fresh-pulled `main` (Step 4).
- **Partial version sync.** Grep the old version string; don't trust the validator to catch it.
- **Skipping the back-merge after Form A.** `dev` drifts behind `main`'s version and the next release fights conflicts.
- **Re-publishing the same version** after a fix. Registries cache; consumers pin. Bump, always.
- **Wrong SemVer increment.** A breaking change shipped as a PATCH silently breaks every consumer on `^`/`~` ranges — when in doubt between two increments, pick the larger one.
- **Credentials in `.npmrc`, manifests, or task-runner files that get committed.** Env vars + gitignored files only; rotate on any leak.
