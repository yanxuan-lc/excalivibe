// The test and coverage verdict, read by genai.implement on the sprint branch and again by
// genai.merge on the merged tree.
//
// The project reports; this file judges. That split is what makes the gate a gate: a project that
// decides its own verdict has none, and this code ships with the step definitions, so a round
// cannot loosen what it is measured by. Only the coverage floors belong to the project, and they
// live in a file the round may not edit either.
//
// **Per module, because coverage is not one number.** A repository is rarely uniform: a browser
// client covered by end-to-end tests rather than unit ones, a Go service whose tooling reports
// statements and nothing else, a Python package with branches but no function coverage. One
// repository-wide figure forces all of them onto the lowest common denominator — and worse, it makes
// an untested module drag every other module's number down, so the only way past the gate is to
// write tests nobody decided to want.
//
// The protocol, in full:
//
//   `make genai-metrics` prints ONE LINE PER MODULE, each beginning `genai-metrics: ` and followed
//   by one JSON object naming the module it is about. Anything else on stdout is ignored, and the
//   exit code is ignored — a failing suite is data, not an error, so no project has to remember to
//   swallow it, and none has to redirect its test output to keep stdout clean.
//
//   genai-metrics: {"module":"server","tests":{"passed":131,"skipped":0,"failed":0},
//                   "coverage":{"lines":0.93}}
//   genai-metrics: {"module":"web","tests":{"passed":12,"skipped":0,"failed":0}}
//
//   A project of one module may leave `module` out; with several declared it is required, because
//   there is no honest way to guess which one an unlabelled line is about.
//
// Counts are non-negative integers; totals are computed here rather than read, so there is one less
// number that can disagree with itself. Coverage is a fraction in [0,1] — 93 for 93% is the easy
// mistake, and guessing which was meant would build a gate that passes on a typo.
//
// What gets checked is what `tools/genai/thresholds.json` declares, per module:
//
//   { "coverage": { "server": { "lines": 0.8 },
//                   "core":   { "lines": 0.9, "branches": 0.85 } } }
//
// A module absent from that object is not coverage-checked at all — that is how a client covered by
// its e2e suite says so, and it is recorded in the one project file a round may not edit, so the
// exemption is a decision somebody made rather than one a round can award itself. A dimension absent
// from a module's entry is not checked for that module, which is how a toolchain that cannot report
// branches says so.
//
// Passing tests are judged everywhere regardless: a module that reports a failure has failed,
// whether or not anyone declared floors for it.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readMap } from "./modules.mjs";

const TARGET = "genai-metrics";
const MARKER = "genai-metrics: ";
const THRESHOLDS = join("tools", "genai", "thresholds.json");

const DIMENSIONS = ["lines", "branches", "functions"];

// Skipped tests are how a suite goes green without getting better, so this ceiling is fixed here
// rather than left to the project.
const MAX_SKIPPED_RATIO = 0.1;

export function judge() {
  const payloads = marked();
  if (payloads.length === 0) {
    return { label: "metrics_missing", facts: { target: TARGET, marker: MARKER.trim() } };
  }

  // The declared modules, so an unlabelled line can be attributed and a label can be checked against
  // something. A broken map is reported as such rather than folded into a metrics label — they are
  // different problems with different owners.
  const read = readMap();
  if (read.label !== "ok") {
    return { label: "metrics_unreadable", facts: { reason: `tools/genai/modules.json is ${read.label}, so the reported modules cannot be checked against anything`, detail: read.facts ?? null } };
  }
  const declared = Object.keys(read.map);

  const reports = {};
  for (const payload of payloads) {
    let raw;
    try {
      raw = JSON.parse(payload);
    } catch {
      return { label: "metrics_unreadable", facts: { reason: "a marked line is not valid JSON", found: payload.slice(0, 200) } };
    }

    const name = raw?.module ?? (declared.length === 1 ? declared[0] : null);
    if (name === null) {
      return {
        label: "metrics_unreadable",
        facts: { reason: "this line names no module, and the project declares more than one — add \"module\": \"<name>\"", declared, found: payload.slice(0, 200) },
      };
    }
    if (!declared.includes(name)) {
      return {
        label: "metrics_unreadable",
        facts: { reason: `the line reports module "${name}", which tools/genai/modules.json does not declare`, declared },
      };
    }
    if (Object.hasOwn(reports, name)) {
      return { label: "metrics_unreadable", facts: { reason: `module "${name}" is reported twice; the target should print one line per module`, module: name } };
    }

    const count = (value) => (Number.isInteger(value) && value >= 0 ? value : null);
    const tests = { passed: count(raw?.tests?.passed), skipped: count(raw?.tests?.skipped), failed: count(raw?.tests?.failed) };
    if (Object.values(tests).some((value) => value === null)) {
      return {
        label: "metrics_unreadable",
        facts: { reason: "tests.passed, tests.skipped and tests.failed must all be non-negative integers", module: name, found: raw?.tests ?? null },
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
          facts: { reason: `coverage.${dimension} must be a fraction between 0 and 1`, module: name, found: value },
        };
      }
      coverage[dimension] = value;
    }

    reports[name] = { tests, coverage };
  }

  if (!existsSync(THRESHOLDS)) return { label: "thresholds_missing", facts: { file: THRESHOLDS, reports } };
  let floors;
  try {
    floors = JSON.parse(readFileSync(THRESHOLDS, "utf8")).coverage ?? {};
  } catch {
    return { label: "thresholds_missing", facts: { file: THRESHOLDS, reason: "not valid JSON", reports } };
  }
  // The flat shape this replaced put dimensions at the top level. Left unsaid, every one of those
  // keys would read as a module nobody declared and the whole file would quietly check nothing.
  const flat = DIMENSIONS.filter((d) => typeof floors[d] === "number");
  if (flat.length) {
    return {
      label: "thresholds_missing",
      facts: { file: THRESHOLDS, reason: `coverage is keyed by module now, and this file still declares ${flat.join(", ")} at the top level. Move each dimension under the module it applies to`, reports },
    };
  }
  const undeclared = Object.keys(floors).filter((name) => !declared.includes(name));
  if (undeclared.length) {
    return {
      label: "thresholds_missing",
      facts: { file: THRESHOLDS, reason: `floors are declared for ${undeclared.join(", ")}, which tools/genai/modules.json does not list`, declared, reports },
    };
  }

  // Every module's verdict, gathered before any of them is allowed to conclude, so the facts carry
  // the whole picture rather than whichever module happened to fail first.
  const totals = Object.values(reports).reduce(
    (acc, r) => ({ passed: acc.passed + r.tests.passed, skipped: acc.skipped + r.tests.skipped, failed: acc.failed + r.tests.failed, total: acc.total + r.tests.total }),
    { passed: 0, skipped: 0, failed: 0, total: 0 },
  );

  const failing = Object.entries(reports).filter(([, r]) => r.tests.failed > 0).map(([name]) => name);
  const overskipped = Object.entries(reports)
    .filter(([, r]) => r.tests.total > 0 && r.tests.skipped / r.tests.total > MAX_SKIPPED_RATIO)
    .map(([name]) => name);

  // A module with floors and no tests behind them, and a dimension with a floor and no measurement:
  // declaring a floor is a claim that the number gets measured.
  const untested = Object.keys(floors).filter((name) => (reports[name]?.tests.total ?? 0) < 1);
  const below = [];
  for (const [name, wanted] of Object.entries(floors)) {
    const measured = reports[name]?.coverage ?? {};
    for (const dimension of DIMENSIONS) {
      if (typeof wanted?.[dimension] !== "number") continue;
      if (!(typeof measured[dimension] === "number" && measured[dimension] >= wanted[dimension])) {
        below.push({ module: name, dimension, floor: wanted[dimension], measured: measured[dimension] ?? null });
      }
    }
  }

  const exempt = declared.filter((name) => !Object.hasOwn(floors, name));
  const facts = { reports, totals, floors, exempt, below, failing, overskipped, untested };

  if (totals.total < 1) return { label: "no_tests", facts };
  if (failing.length) return { label: "tests_failing", facts };
  if (overskipped.length) return { label: "too_many_skipped", facts };
  if (untested.length) return { label: "no_tests", facts };
  if (below.length) return { label: "coverage_below_floor", facts };
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
  // stdout is where the lines belong; stderr is accepted too, because a project that piped its whole
  // recipe to stderr has still told us everything we need. Every match counts now rather than the
  // last one alone — one line per module is the protocol.
  return [...pick(out), ...pick(err)];
}

function pick(text) {
  return String(text ?? "")
    .split("\n")
    .filter((line) => line.includes(MARKER))
    .map((line) => line.slice(line.indexOf(MARKER) + MARKER.length).trim());
}
