Fold every change of this round into the main specs, and commit the result.

```bash
openspec archive <change-id> -y --json
```

Run it for each change. It moves the change directory under `openspec/changes/archive/` and
merges its spec deltas into `openspec/specs/<capability>/spec.md`.

## Read `archive.warnings[]`, and act on it

`openspec archive` reports problems it is carrying into the main specs, and **archives anyway,
exiting 0**. The findings are in its output, not in its exit code:

```json
"warnings": [
  "units - carried Purpose is under 50 characters; openspec validate --strict reports it as too brief."
]
```

**When there is nothing to report the key is absent, not empty.** openspec builds the payload by
spreading `warnings` in only when the list is non-empty, so `archive.warnings` on a clean run is
`undefined` and no amount of reading tells you apart from a run that reported an empty array. Treat
a missing key as "no warnings" and never index into it blind.

That one is the common case, because openspec applies the length rule to main specs but not to the
deltas they came from — so a Purpose that read fine three steps ago becomes a failure the moment
it is folded. **Nothing earlier can catch it**: `openspec validate --changes` does not apply the
main-spec rules, before the fold there is no main spec to validate, and `openspec archive` has no
dry run.

Fix it **in the main spec**, where the rule applies. Then confirm with the command the gate itself
will run:

```bash
openspec validate --specs --strict
```

Anything still reported there is a rejection you can spend an attempt on, or a fix you can just
make. Say in the report what you changed and why.

## Where a requirement gets silently lost

**When two changes of the same round touch one capability, their deltas fold into the same
main spec — and that is where a requirement disappears without anything failing.** The archive
succeeds, the specs validate, the tests pass, and one requirement is simply not there.

So after archiving, open each capability spec that received more than one change and check that
every requirement from every delta is present. Do this before reporting, not after.

## Conflicts are a judgement, not a merge

If two deltas state the same requirement differently, do not pick one at random and do not
concatenate both. Decide which wording is correct, and say in the report which one was dropped
and why.

## Commit

Commit the archive move and the updated main specs together. A round that ships code without
its specs folded leaves the repository describing a version that no longer exists.

Report `partial` and name the leftovers if any change could not be archived.

{{inputs}}

{{rejection}}
