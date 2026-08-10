// The test and coverage verdict for genai.implement.
//
// The project reports; this file judges. That split is what makes the gate a gate: a project that
// decides its own verdict has none, and this code ships with the step definitions, so a round
// cannot loosen what it is measured by. Only the coverage floors belong to the project, and they
// live in a file the round may not edit either.
//
// The protocol, in full:
//
//   `make genai-metrics` prints a line beginning `genai-metrics: ` followed by one JSON object.
//   Anything else on stdout is ignored, and the exit code is ignored — a failing suite is data,
//   not an error, so no project has to remember to swallow it, and none has to redirect its test
//   output to keep stdout clean. Both are mistakes that would otherwise break the gate silently.
//
//   genai-metrics: {"tests":{"passed":131,"skipped":0,"failed":2},
//                   "coverage":{"lines":0.93,"branches":0.91,"functions":1.0}}
//
// Counts are non-negative integers; the total is computed here rather than read, so there is one
// less number that can disagree with itself. Coverage is a fraction in [0,1] — 93 for 93% is the
// easy mistake, and guessing which was meant would build a gate that passes on a typo.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TARGET = "genai-metrics";
const MARKER = "genai-metrics: ";
const THRESHOLDS = join("tools", "genai", "thresholds.json");

// An absent floor — or a null one — opts that dimension out. That is the only way out, and it is
// visible in the project's own file.
const DIMENSIONS = ["lines", "branches", "functions"];

// Skipped tests are how a suite goes green without getting better, so this ceiling is fixed here
// rather than left to the project.
const MAX_SKIPPED_RATIO = 0.1;

export function judge() {
  const payload = marked();
  if (payload === null) {
    return { label: "metrics_missing", facts: { target: TARGET, marker: MARKER.trim() } };
  }

  let raw;
  try {
    raw = JSON.parse(payload);
  } catch {
    return { label: "metrics_unreadable", facts: { reason: "the marked line is not valid JSON", found: payload.slice(0, 200) } };
  }

  const count = (value) => (Number.isInteger(value) && value >= 0 ? value : null);
  const tests = {
    passed: count(raw?.tests?.passed),
    skipped: count(raw?.tests?.skipped),
    failed: count(raw?.tests?.failed),
  };
  if (Object.values(tests).some((value) => value === null)) {
    return {
      label: "metrics_unreadable",
      facts: { reason: "tests.passed, tests.skipped and tests.failed must all be non-negative integers", found: raw?.tests ?? null },
    };
  }
  tests.total = tests.passed + tests.skipped + tests.failed;

  const coverage = {};
  for (const dimension of DIMENSIONS) {
    const value = raw?.coverage?.[dimension];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !(value >= 0 && value <= 1)) {
      return {
        label: "metrics_unreadable",
        facts: { reason: `coverage.${dimension} must be a fraction between 0 and 1`, found: value },
      };
    }
    coverage[dimension] = value;
  }

  if (!existsSync(THRESHOLDS)) return { label: "thresholds_missing", facts: { file: THRESHOLDS, tests, coverage } };
  let floors;
  try {
    floors = JSON.parse(readFileSync(THRESHOLDS, "utf8")).coverage ?? {};
  } catch {
    return { label: "thresholds_missing", facts: { file: THRESHOLDS, reason: "not valid JSON", tests, coverage } };
  }

  // A dimension with a floor and no measurement behind it counts as below it: declaring a floor is
  // a claim that the number gets measured.
  const below = DIMENSIONS.filter(
    (d) => typeof floors[d] === "number" && !(typeof coverage[d] === "number" && coverage[d] >= floors[d]),
  );

  const facts = { tests, coverage, floors, below };
  if (tests.total < 1) return { label: "no_tests", facts };
  if (tests.failed > 0) return { label: "tests_failing", facts };
  if (tests.skipped / tests.total > MAX_SKIPPED_RATIO) return { label: "too_many_skipped", facts };
  if (below.length > 0) return { label: "coverage_below_floor", facts };
  return { label: "satisfied", facts };
}

function marked() {
  let out = "";
  let err = "";
  try {
    out = execFileSync("make", [TARGET, "--no-print-directory"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (cause) {
    out = cause?.stdout ?? "";
    err = cause?.stderr ?? "";
  }
  // stdout is where the line belongs; stderr is accepted too, because a project that piped its
  // whole recipe to stderr has still told us everything we need.
  return pick(out) ?? pick(err);
}

function pick(text) {
  const lines = String(text ?? "").split("\n").filter((line) => line.includes(MARKER));
  if (lines.length === 0) return null;
  const last = lines[lines.length - 1];
  return last.slice(last.indexOf(MARKER) + MARKER.length).trim();
}
