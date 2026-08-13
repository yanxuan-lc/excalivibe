#!/usr/bin/env node
// The measure step of genai-init: run what the project reports its numbers with, read them, and
// propose coverage floors — per module, the way the gate judges them.
//
//   node <skill-dir>/assets/scripts/measure.mjs [--command "<shell command>"] [--step 0.05]
//
// It exists for one error, and that error has cost more rounds than any other thing this install can
// get wrong: **a floor above what the project measures**. `tools/genai/thresholds.json` is a file a
// round may not edit, so a floor above reality rejects every round with nothing able to fix it — and
// the number that would have caught it is one the setter had already been shown. Proposing the floors
// arithmetically from the measurement removes the whole class.
//
// So the order is not negotiable: **measure, then write the floors.** What the questions settle is
// the policy — which modules are coverage-checked at all — and the numbers come from here afterwards.
//
// It writes nothing. Proposing is the whole of the job; agreeing the numbers is the user's and
// writing the file is the executor's.
//
// Exit code is 0 for every measurement it manages to take, and 0 for a suite that fails too — a red
// suite on an existing project is the next round's problem, not this install's. A mistyped flag is
// the exception, as everywhere else here.

import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const flag = (name) => { const at = argv.indexOf(`--${name}`); return at === -1 ? undefined : argv[at + 1]; };

const KNOWN = ["command", "step"];
const strays = argv.filter((token) => token.startsWith("--")).map((token) => token.slice(2)).filter((name) => !KNOWN.includes(name));
if (strays.length) {
  process.stderr.write(`measure.mjs: unknown flag(s) --${strays.join(", --")}; this script takes only --${KNOWN.join(", --")}\n`);
  process.exit(1);
}

// `make genai-metrics` by default, because that is what the gate itself runs — measuring through the
// same command means the numbers proposed here are the numbers the gate will read. On a project whose
// recipe is not written yet, pass the command it does have and take the answer as an estimate.
const command = flag("command") ?? "make genai-metrics";
const step = Number(flag("step") ?? "0.05");
if (!Number.isFinite(step) || step <= 0 || step >= 1) {
  process.stderr.write(`measure.mjs: --step must be a fraction between 0 and 1; got ${JSON.stringify(flag("step"))}\n`);
  process.exit(1);
}

const lines = [];
const out = (text = "") => lines.push(text);
const section = (title) => { out(); out(title); out("─".repeat(title.length)); };
const item = (label, value) => out(`  ${label.padEnd(24)} ${value}`);
const finish = () => { process.stdout.write(`${lines.join("\n")}\n`); process.exit(0); };

section("what ran");
item("command", command);

// Both streams, and the exit code deliberately ignored. The gate reads it the same way: a failing
// suite still has to get its numbers through, so a non-zero exit here is data rather than a stop.
let output = "";
let exitCode = 0;
try {
  output = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 900000 });
} catch (error) {
  output = `${String(error.stdout ?? "")}${String(error.stderr ?? "")}`;
  exitCode = typeof error.status === "number" ? error.status : 1;
  if (error.stdout === undefined && error.stderr === undefined) output = String(error.message);
}
item("exit code", `${exitCode}${exitCode === 0 ? "" : " — not a stop; the numbers below are what matters"}`);

// Every marked line, because the protocol is one per module. Anything else in the output is the
// suite talking to a person and is none of this script's business.
const marked = output.split("\n")
  .map((l) => l.match(/genai-metrics:\s*(\{.*\})\s*$/)?.[1])
  .filter(Boolean);

section("the numbers");

if (!marked.length) {
  item("genai-metrics: lines", "NONE — nothing here can be proposed");
  out();
  out("  The command printed no `genai-metrics:` line, so there is no measurement to set floors from.");
  out("  That is expected before the recipe is written. Two ways on:");
  out("    · write the genai-metrics recipe first, then re-run this with no --command");
  out("    · or point --command at whatever this project already runs its tests with, and read its");
  out("      own report by hand — but set no floor from a number nobody measured.");
  out();
  out("  The last 15 lines of what it printed:");
  output.split("\n").filter(Boolean).slice(-15).forEach((l) => out(`      ${l}`));
  finish();
}

const DIMENSIONS = ["lines", "branches", "functions"];
const modules = [];
for (const payload of marked) {
  let parsed = null;
  try { parsed = JSON.parse(payload); } catch { /* reported below */ }
  if (parsed === null || typeof parsed !== "object") {
    item("UNREADABLE line", payload.slice(0, 120));
    continue;
  }
  const name = parsed.module ?? "(unnamed — fine only if the project is one module)";
  const tests = parsed.tests ?? {};
  const passed = Number(tests.passed ?? 0);
  const failed = Number(tests.failed ?? 0);
  const skipped = Number(tests.skipped ?? 0);
  const measured = {};
  for (const dimension of DIMENSIONS) {
    const value = parsed.coverage?.[dimension];
    measured[dimension] = typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
  }
  modules.push({ name, passed, failed, skipped, total: passed + failed + skipped, measured });
}

for (const m of modules) {
  out();
  item(m.name, m.total === 0 ? "no tests reported" : `${m.total} tests: ${m.passed} passed, ${m.failed} failed, ${m.skipped} skipped`);
  if (m.failed > 0) item("  note", "a red suite is the NEXT round's problem, not this install's — record the floors and move on");
  if (m.total > 0 && m.skipped / m.total > 0.1) item("  note", "more than a tenth is skipped, which the gate rejects on its own");
  for (const dimension of DIMENSIONS) {
    if (m.measured[dimension] === null) continue;
    item(`  coverage.${dimension}`, `${(m.measured[dimension] * 100).toFixed(1)}%`);
  }
  const reported = DIMENSIONS.filter((d) => m.measured[d] !== null);
  if (!reported.length) item("  coverage", "none reported — this module's tooling measures none, or it has no unit tests");
}

section("PROPOSED FLOORS — agree these with the user, then the executor writes the file");

// Rounded DOWN to the nearest step, so the proposal always lands at or below what was measured.
// A measurement that sits exactly on a step proposes itself, which is on purpose for the case it
// mostly arises in — 100% functions, where a floor of 1.0 is the usual intent anyway.
const floorFor = (value) => Math.max(0, Math.round(Math.floor(value / step) * step * 100) / 100);

const checked = modules.filter((m) => DIMENSIONS.some((d) => m.measured[d] !== null));
const exempt = modules.filter((m) => !DIMENSIONS.some((d) => m.measured[d] !== null));

out();
out("  {");
out('    "coverage": {');
checked.forEach((m, index) => {
  const reported = DIMENSIONS.filter((d) => m.measured[d] !== null);
  out(`      ${JSON.stringify(m.name)}: {`);
  reported.forEach((dimension, i) => {
    const comma = i === reported.length - 1 ? "" : ",";
    out(`        "${dimension}": ${floorFor(m.measured[dimension]).toFixed(2)}${comma}   // measured ${(m.measured[dimension] * 100).toFixed(1)}%`);
  });
  out(`      }${index === checked.length - 1 ? "" : ","}`);
});
if (!checked.length) out("      // nothing reported coverage, so nothing is proposed");
out("    }");
out("  }");
out();
if (exempt.length) {
  out(`  Left out on purpose: ${exempt.map((m) => m.name).join(", ")} — no coverage came through, so no floor`);
  out("  is proposed. A module absent from this object is not coverage-checked, which is how a client");
  out("  covered by its e2e suite is declared. Confirm with the user that each one is meant to be there.");
  out();
}
out("  Read before pasting:");
out("    · A round may NOT edit this file, which is what makes an exemption a decision somebody made");
out("      rather than one a round can award itself. A floor above what the module measures rejects");
out("      every round with nothing able to fix it.");
out("    · A dimension left out of a module's entry is not checked for that module — that is how Go,");
out("      whose cover reports statements and nothing else, declares what it can measure.");
out("    · Every module that IS listed has to report tests, or the gate reads it as `no_tests`.");
out("    · The `e2e` block is separate and is NOT proposed here. Leave it at the shipped values");
out("      unless the user has a reason, and note that omitting it does not opt out.");
out();

finish();
