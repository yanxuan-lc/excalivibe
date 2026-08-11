// Validation, read from the output rather than the exit code.
//
// **openspec's exit code cannot be trusted here.** `openspec validate --changes --strict` reports
// failures and still exits 0; a bare `openspec validate` prints a hint and exits 0 as well. A gate
// built on that exit code is a gate that always passes, which is worse than no gate because it
// reads as evidence. So the verdict comes from the totals line.
//
// "No items found to validate" is deliberately NOT a pass. Nothing validated is not the same as
// nothing wrong, and the steps that use this always have their own outputs gate ahead of it — by
// the time this runs, there is supposed to be something there.

import { execFileSync } from "node:child_process";

const SCOPES = { changes: "--changes", specs: "--specs" };

export function validate(scope) {
  if (!Object.hasOwn(SCOPES, scope)) {
    return { label: "totals_unreadable", facts: { reason: "scope must be `changes` or `specs`", found: scope ?? null } };
  }

  let output;
  try {
    output = execFileSync("openspec", ["validate", SCOPES[scope], "--strict"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (cause) {
    // Not installed versus broke: neither is a problem with the artifact under validation.
    if (cause?.status === undefined) {
      return { label: "openspec_unavailable", facts: { reason: String(cause?.message ?? cause) } };
    }
    output = `${cause?.stdout ?? ""}\n${cause?.stderr ?? ""}`;
  }

  // The line reads like "3 passed, 1 failed" — the count after "failed" is the whole verdict.
  const totals = [...String(output).matchAll(/(\d+)\s+failed/g)];
  if (totals.length === 0) {
    return {
      label: "totals_unreadable",
      facts: { reason: "no totals line in the output, so nothing was actually validated", output_tail: tail(output) },
    };
  }

  const failed = Number(totals[totals.length - 1][1]);
  return failed > 0
    ? { label: "validation_failed", facts: { scope, failed, output_tail: tail(output, 1200) } }
    : { label: "satisfied", facts: { scope, failed: 0 } };
}

/**
 * How many scenarios openspec itself sees in each of these changes, or null when it cannot say.
 *
 * Asked for because openspec's count is the authority and ours is not: it masks fenced blocks and
 * treats every level-4 header inside a requirement as a scenario, and both of those are easy to get
 * a line apart from. What it will **not** hand over is the scenario headers — a scenario object in
 * `--json` carries `rawText` and no name — so the ids still have to be read out of the markdown.
 * Comparing the two counts is what keeps that local reader honest: a disagreement is reported
 * instead of silently costing a scenario.
 *
 * `null` rather than a label, because a missing openspec is already reported by the validation rule
 * on the same step. Here it means the cross-check does not apply, not that the spec is wrong.
 */
export function scenarioCounts(changes) {
  const out = {};
  for (const change of changes) {
    let output;
    try {
      output = execFileSync("openspec", ["show", change, "--json", "--type", "change", "--deltas-only", "--no-interactive"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch {
      return null;
    }
    try {
      const parsed = JSON.parse(output);
      out[change] = (parsed?.deltas ?? []).reduce(
        (total, delta) => total + (delta?.requirements ?? []).reduce((n, requirement) => n + (requirement?.scenarios?.length ?? 0), 0),
        0,
      );
    } catch {
      return null;
    }
  }
  return out;
}

function tail(text, n = 400) {
  return String(text).slice(-n);
}
