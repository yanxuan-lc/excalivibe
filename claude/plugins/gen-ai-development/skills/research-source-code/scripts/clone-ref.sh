#!/usr/bin/env bash
# clone-ref.sh — shallow-clone an open-source repo at an exact ref into a
# scratch directory OUTSIDE the current project, then print the locked commit SHA.
#
# Usage:
#   bash clone-ref.sh <repo-url> <ref> [dest-name]
#
#   <repo-url>   canonical upstream URL (https or ssh)
#   <ref>        release tag, branch, or commit SHA to lock to
#   [dest-name]  optional dir name under the scratch root (default: derived from URL)
#
# Output (last line): the resolved HEAD commit SHA — capture it as provenance.

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: clone-ref.sh <repo-url> <ref> [dest-name]" >&2
  exit 2
fi

REPO_URL="$1"
REF="$2"
DEST_NAME="${3:-}"

# Scratch root lives outside the project tree so we never pollute the repo.
SCRATCH_ROOT="${AGI_RESEARCH_SRC_DIR:-${TMPDIR:-/tmp}/agi-research-sources}"

# Derive a directory name from the repo URL if not given (strip .git, take basename).
if [ -z "$DEST_NAME" ]; then
  DEST_NAME="$(basename "${REPO_URL%.git}")"
fi

DEST="${SCRATCH_ROOT}/${DEST_NAME}"

mkdir -p "$SCRATCH_ROOT"

# If the destination already holds a clone of this repo, reuse it; otherwise clone.
if [ -d "${DEST}/.git" ]; then
  echo ">> reusing existing clone at ${DEST}" >&2
else
  echo ">> cloning ${REPO_URL} (ref: ${REF}) -> ${DEST}" >&2
  # Fast path: shallow clone directly at a tag or branch.
  if git clone --depth 1 --branch "$REF" "$REPO_URL" "$DEST" 2>/dev/null; then
    :
  else
    # Fallback: ref is likely a bare commit SHA (can't --branch to it).
    # Full clone, then checkout the exact commit.
    echo ">> shallow clone at ref failed; falling back to full clone + checkout" >&2
    rm -rf "$DEST"
    git clone "$REPO_URL" "$DEST"
    git -C "$DEST" checkout --quiet "$REF"
  fi
fi

# Make sure we're actually on the requested ref (covers the reuse path).
git -C "$DEST" checkout --quiet "$REF" 2>/dev/null || true

SHA="$(git -C "$DEST" rev-parse HEAD)"

echo ">> checked out ${REF} at ${DEST}" >&2
echo ">> commit SHA (provenance): ${SHA}" >&2
# Last line on stdout = the SHA, for easy capture in a pipeline.
echo "$SHA"
