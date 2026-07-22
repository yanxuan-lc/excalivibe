#!/usr/bin/env python3
"""Validate Codex agent and cross-skill contracts."""

from __future__ import annotations

import sys
import tomllib
from pathlib import Path


EXPECTED_MODELS = {
    "arch-reviewer": ("gpt-5.6-sol", "high"),
    "code-reviewer": ("gpt-5.6-sol", "high"),
    "debugger": ("gpt-5.6-sol", "high"),
    "developer": ("gpt-5.6-terra", "high"),
    "e2e-author": ("gpt-5.6-terra", "medium"),
    "e2e-runner": ("gpt-5.6-terra", "low"),
    "planner": ("gpt-5.6-sol", "high"),
    "release-coordinator": ("gpt-5.6-terra", "medium"),
    "researcher": ("gpt-5.6-terra", "medium"),
}


def validate(repo_root: Path) -> list[str]:
    """Return contract violations found below the repository root."""
    errors: list[str] = []
    agents_dir = repo_root / "codex" / "agents"

    for name, expected in EXPECTED_MODELS.items():
        path = agents_dir / f"{name}.toml"
        with path.open("rb") as handle:
            data = tomllib.load(handle)
        actual = (data.get("model"), data.get("model_reasoning_effort"))
        if actual != expected:
            errors.append(f"{path}: expected model/effort {expected}, got {actual}")

        text = path.read_text(encoding="utf-8")
        if "REVIEW.md`" in text or "`REPORT.md` + `PROPOSAL.md`" in text:
            errors.append(f"{path}: stale artifact extension")

    runner = (agents_dir / "e2e-runner.toml").read_text(encoding="utf-8")
    if "PIPELINE.md row tick" in runner:
        errors.append("e2e-runner must not update controller-owned PIPELINE.md")

    research = (
        repo_root
        / "codex/plugins/gen-ai-development/skills/research-pipeline/SKILL.md"
    ).read_text(encoding="utf-8")
    for stale_term in ("AskUserQuestion", "Agent tool", "opus", "sonnet"):
        if stale_term in research:
            errors.append(f"research-pipeline contains Claude-specific term: {stale_term}")

    return errors


def main() -> int:
    """Run validation from the checked-out repository."""
    repo_root = Path(__file__).resolve().parents[2]
    errors = validate(repo_root)
    if errors:
        print("Codex contract validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Codex contracts: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
