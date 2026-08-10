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

Record the tag and the release in `effects`, with `reversible: false`.

{{inputs}}

{{rejection}}
