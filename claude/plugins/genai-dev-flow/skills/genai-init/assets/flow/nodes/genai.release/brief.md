Cut one release for this whole round.

**This is the only step that changes the version.** One round, one version number, bumped once
— however many changes it carried.

## Decide the bump

Read the commits since the last tag and decide the level from what actually changed. Convention
gives a starting point (`feat` to minor, `fix` to patch, a breaking change to major), but it is
a starting point, not a rule: judge from the change itself.

**Write the reasoning into the report.** The bump is not gated by a script, so the report is
where the decision becomes reviewable.

Update every version-bearing file the project declares, write the changelog from the same
commits, commit, and tag.

**Where they are declared**: `version_files` on each module in `tools/genai/modules.json`. This is the
one project file a round may update, and version numbers scattered across a manifest, a lockfile and a
constant in source are exactly what it is for.

**Search anyway, every round** — `git grep` the version you are bumping *from*, whatever `version_files`
declares — and **add what you find to `modules.json` in this same commit**. Not only when a module
declares none: a project whose declarations look complete is exactly where an undeclared one hides, and
this was measured — a round found five files carrying the version against three declared, and the two
extra pulled in opposite directions.

What counts as a version-bearing file is **whether a person or a program reads that number**. A version
in a README's sample health payload does: leave it and the documentation is wrong from release day.
A version in the e2e harness's own `package.json` does not — nothing publishes it and nothing consumes
it, so rewriting it every round is churn. Where a hit is deliberately left alone, **say which and why in
the report**, so the next round finds a decision rather than an unexplained hit.

Say in the report which files you updated: no gate checks them, and a missed constant leaves the running
app reporting the previous release while every gate stays green.

Record the tag and the release in `effects`, with `reversible: false`.

## What the round's evidence does and does not cover

**Nothing runs the app after this step, and the acceptance run happened before the merge.** So the
tree that was proven is not the tree being tagged: between them sit the merge, the archive, the
documentation commit, and this step's own version bump. `make genai-build` still has to pass here,
which is why a broken bump cannot ship — but building is not running, and no probe confirms the tagged
build still answers as itself.

The consequence is worth saying plainly in the report rather than leaving a reader to infer it: a round
that reports "36 of 36 scenarios passed, released v0.2.0" is describing scenarios that passed on the
pre-merge tree. Keep the bump to version-bearing files for that reason. Anything else changed here is
outside every piece of evidence the round produced.
