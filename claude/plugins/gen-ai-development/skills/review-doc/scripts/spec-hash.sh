#!/usr/bin/env bash
# Stable content fingerprint of an OpenSpec change's spec inputs — the
# freshness stamp REVIEW.mdx records in its header and the human-confirm gate re-checks.
#
# Usage: spec-hash.sh <openspec/changes/<id>/>
#
# Contract for callers (planner / the human-confirm gate):
#   - exit 0  → stdout is exactly one 12-hex-char fingerprint
#   - exit ≠0 → FAILURE; stdout carries no fingerprint and must not be used
#   Always check the exit code before consuming stdout.
#
# The fingerprint covers both the CONTENT and the RELATIVE PATH of every spec
# input file — renaming/moving a spec file invalidates the stamp by design.
# Derived/processual artifacts are excluded so that regenerating REVIEW.mdx or
# ticking PIPELINE.md does not invalidate it; only real spec changes do.
# (REVIEW.mdx is a .mdx file and thus already outside the *.md glob; it is also
#  listed below explicitly to document intent and survive any glob change.)
set -euo pipefail

DIR="${1:?usage: spec-hash.sh <change-dir>}"
[ -d "$DIR" ] || { echo "error: not a directory: $DIR" >&2; exit 1; }
cd "$DIR"

if command -v sha256sum >/dev/null 2>&1; then
  SHA="sha256sum"
else
  SHA="shasum -a 256"
fi

# Exclusion list = the pipeline's derived/processual artifacts. It is mirrored
# prose-side in the skill's SKILL.md（「新鲜度戳」一节）— when the pipeline
# grows a new processual artifact, update BOTH places together, or its edits
# will spuriously invalidate stamps.
# NUL-separated throughout so paths with spaces cannot split into bogus args.
LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT
find . -type f -name '*.md' \
  ! -name 'REVIEW.mdx' \
  ! -name 'PIPELINE.md' \
  ! -name 'arch-review.md' \
  ! -name 'e2e-manifest.md' \
  ! -name 'e2e-report.md' \
  -print0 | LC_ALL=C sort -z > "$LIST"

# An empty spec set must FAIL, not hash to the empty-string digest — the human-confirm gate
# could not tell that apart from a legitimate fingerprint.
[ -s "$LIST" ] || { echo "error: no spec input files under $DIR" >&2; exit 2; }

# Capture first, print after: if hashing fails midway, set -e aborts here and
# nothing reaches stdout (a partial pipeline would still have printed a value).
hash_lines="$(xargs -0 $SHA < "$LIST")"
printf '%s\n' "$hash_lines" | $SHA | cut -c1-12
