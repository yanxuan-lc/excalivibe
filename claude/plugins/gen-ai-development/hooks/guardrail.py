#!/usr/bin/env python3
"""
gen-ai-development — PreToolUse irreversible-action guardrail.

A deterministic backstop for the autonomy-controller's "an irreversible act needs a
human" boundary. It is NOT the main flow's enforcement (the controller routes those
acts to human-gated / publish-consent); this is a second, mechanical line of defense in
case the controller is bypassed, an agent goes off-script, or a lane runs unattended.

Scope principle (kept deliberately narrow to avoid false positives):
  - deny  ONLY for "subagent + irreversible outward act" — provably safe to block,
          because the main agent can always do it instead, and it enforces the
          release-coordinator's stated hard boundary (a subagent never publishes/pushes
          to main / rewrites shared history / merges a PR).
  - ask   for every other dangerous act (main-agent outward acts, destructive-local,
          commit-on-main). The human decides; in headless / non-interactive runs an
          "ask" is blocked by design — which is exactly right for an unattended lane.
  - allow / defer (silent) for everything else, including all reversible work:
          normal commits on feat branches, push to dev, push on a feature branch,
          force-push to your OWN feature branch, file edits, tests, etc.

Contract: reads the PreToolUse JSON on stdin (tool_name, tool_input.command, agent_id,
cwd); emits a hookSpecificOutput decision on stdout and exits 0. Any failure defers
silently — a guardrail must never break the user's workflow.

Claude-side only. Codex's plugin manifest forbids a hooks field; the Codex runtime
relies on its own trust mechanism. This guard is non-load-bearing: the toolkit works
without it.
"""

import json
import os
import re
import subprocess
import sys


def _defer():
    # No output + exit 0 = defer to the normal permission flow.
    sys.exit(0)


def _decide(decision, reason):
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": decision,
                "permissionDecisionReason": reason,
            }
        },
        sys.stdout,
    )
    sys.exit(0)


def _pr_base_branch(cmd, cwd):
    """Resolve the base branch of the PR a `gh pr merge` targets; None if unknown."""
    try:
        sel = []
        m = re.search(r"\bmerge\b\s+([^\s|;&\"']+)", cmd)
        if m and not m.group(1).startswith("-"):
            sel = [m.group(1)]
        out = subprocess.run(
            ["gh", "pr", "view", *sel, "--json", "baseRefName", "-q", ".baseRefName"],
            capture_output=True,
            text=True,
            timeout=3,
            cwd=cwd,
        )
        if out.returncode == 0:
            return out.stdout.strip() or None
    except Exception:
        pass
    return None


def _current_branch(cwd):
    try:
        out = subprocess.run(
            ["git", "-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if out.returncode == 0:
            return out.stdout.strip()
    except Exception:
        pass
    return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        _defer()

    if data.get("tool_name") != "Bash":
        _defer()

    cmd = (data.get("tool_input") or {}).get("command") or ""
    if not cmd.strip():
        _defer()

    in_subagent = bool(data.get("agent_id"))
    cwd = data.get("cwd") or os.getcwd()
    who = "A subagent" if in_subagent else "This"
    tag = "[gen-ai-development guardrail] "

    # ---- 1) Publish — the irreversible outward release act -------------------
    if re.search(
        r"\b(npm|pnpm|yarn)\b(\s+(-{1,2}[\w][\w-]*(=\S+)?|\.{0,2}/\S+))*\s+publish(\s|;|&|\||$)",
        cmd,
    ):
        if in_subagent:
            _decide(
                "deny",
                tag
                + "A subagent must not run an irreversible outward publish. Per the "
                "release-coordinator boundary, a subagent only PREPARES the release; the "
                "main agent executes `publish` with explicit user consent.",
            )
        _decide(
            "ask",
            tag
            + "`publish` is the irreversible outward release — confirm explicitly, and "
            "only from a clean `main`. (In a headless/unattended run this is blocked by "
            "design: no human, no publish.)",
        )

    is_push = re.search(r"\bgit\b[^|;&]*\bpush\b", cmd) is not None
    if is_push:
        force = re.search(
            r"(--force-with-lease|--force(=\S+)?|(?:^|\s)-f(?:\s|$)|(?:^|\s)\+\S+)", cmd
        ) is not None
        mentions_main = re.search(r"(^|[\s:+/])(?:refs/heads/)?main(\s|$|:)", cmd) is not None
        mentions_dev = re.search(r"(^|[\s:+/])(?:refs/heads/)?dev(\s|$|:)", cmd) is not None
        bare_push = re.search(r"\bpush\b\s*($|[|;&])", cmd) is not None
        branch = _current_branch(cwd)
        on_main = branch == "main"
        on_dev = branch == "dev"

        # ---- 2) Force-push that rewrites SHARED history (main/dev) -----------
        if force and (mentions_main or mentions_dev or ((on_main or on_dev) and bare_push)):
            if in_subagent:
                _decide(
                    "deny",
                    tag
                    + "A subagent must not force-push to a shared branch (main/dev) — it "
                    "rewrites shared history irreversibly.",
                )
            _decide(
                "ask",
                tag
                + "Force-push to a shared branch (main/dev) rewrites shared history. "
                "Prefer `--force-with-lease` and confirm. (Headless: blocked by design.)",
            )

        # ---- 3) Push to protected `main` (advances only via merge request) --
        targets_main = mentions_main or (on_main and bare_push)
        if targets_main:
            if in_subagent:
                _decide(
                    "deny",
                    tag
                    + "A subagent must not push to protected `main`. main advances only via "
                    "merge request, executed by the main agent with user consent.",
                )
            _decide(
                "ask",
                tag
                + "`main` is protected — it advances only via merge request. Confirm this "
                "push. (Headless: blocked by design.)",
            )

    # ---- 3b) gh pr merge — advances a protected base branch via the GitHub CLI -
    # Command-position + quote-excluding matcher: `echo "gh pr merge"`, `--body "ready
    # to merge"`, and greps whose pattern contains the words don't fire.
    if re.search(r"(?:^|[|;&])\s*gh\b[^|;&\"']*\bpr\b[^|;&\"']*\bmerge\b", cmd):
        if in_subagent:
            _decide(
                "deny",
                tag
                + "A subagent must not merge a pull request — the main agent performs "
                "PR merges (release-coordinator boundary: a subagent only prepares).",
            )
        base = _pr_base_branch(cmd, cwd)
        if base is not None and base != "main":
            _defer()  # PR into a non-protected base (e.g. dev): the reversible merge lane
        _decide(
            "ask",
            tag
            + "`gh pr merge` advances the PR's base branch"
            + (f" (`{base}`)" if base else " (base could not be resolved — treating as protected)")
            + " — `main` advances only via consented merge. Confirm. "
            "(Headless: blocked by design.)",
        )

    # ---- 4) Direct commit on protected `main` (reversible → ask, never deny) -
    if re.search(r"\bgit\b(\s+-C\s+\S+|\s+-{1,2}\S+)*\s+commit\b", cmd):
        if _current_branch(cwd) == "main":
            _decide(
                "ask",
                tag
                + who
                + " is committing directly on protected `main`. main receives changes only "
                "via merge request — move the work to a `feat/` branch. Confirm to override "
                "(e.g. an intentional trunk-based repo).",
            )

    # ---- 5) Destructive local ops (discard work irreversibly) ---------------
    if re.search(r"\bgit\s+reset\b[^|;&]*--hard", cmd) or re.search(
        r"\bgit\s+clean\b[^|;&]*-\w*f", cmd
    ):
        _decide(
            "ask",
            tag
            + "This discards uncommitted/untracked work irreversibly. Confirm it is "
            "intended. (Headless: blocked by design.)",
        )

    _defer()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # A guardrail must never break the workflow: on any internal error, defer.
        sys.exit(0)
