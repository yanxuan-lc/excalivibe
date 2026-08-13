#!/usr/bin/env node
// The measure step of genai-init: run what the project reports its numbers with, read them, and
// propose coverage floors from what came out.
//
//   node <skill-dir>/assets/scripts/measure.mjs [--command "<shell command>"] [--step 0.05]
//
// It exists for one error, and that error has cost more rounds than any other thing this install can
// get wrong: **a floor set above what the project measures**. `tools/genai/thresholds.json` is a file
// a round may not edit, so a floor above reality rejects every round with nothing able to fix it —
// and the number that would have caught it is one the setter had already been shown. Proposing the
// floors arithmetically from the measurement removes the whole class.
//
// So the order is not negotiable: **measure, then write the floors.** Never the other way round, on
// either route. What the questions settle is the policy — which dimensions apply at all, which
// modules are exempt from having tests — and the numbers come from here afterwards.
//
// It writes nothing. Proposing is the whole of the job; agreeing the numbers is the user's and
// writing the file is the executor's.
//
// Exit code is 0 for every measurement it manages to take, and 0 for a suite that fails too — a red
// suite on an existing project is the next round's problem, not this install's, and exiting non-zero
// for one would make it indistinguishable from this script being broken. A mistyped flag is the
// exception, as everywhere else here.

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
// same command means the number proposed here is the number the gate will read. On a project whose
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

// The one marked line, read the way the gate reads it. Anything else in the output is the suite
// talking to a person and is none of this script's business.
const marked = output.split("\n").map((l) => l.match(/genai-metrics:\s*(\{.*\})\s*$/)?.[1]).filter(Boolean).pop();

section("the numbers");

if (!marked) {
  item("genai-metrics: line", "NONE — nothing here can be proposed");
  out();
  out("  The command printed no `genai-metrics:` line, so there is no measurement to set floors from.");
  out("  That is expected before the recipe is written. Two ways on:");
  out("    · write the genai-metrics recipe first, then re-run this with no --command");
  out("    · or point --command at whatever this project already runs its tests with, and read its");
  out("      own report by hand — but do NOT set floors from a number nobody measured.");
  out();
  out("  The last 15 lines of what it printed:");
  output.split("\n").filter(Boolean).slice(-15).forEach((l) => out(`      ${l}`));
  finish();
}

let parsed = null;
try { parsed = JSON.parse(marked); } catch { /* reported below */ }
if (parsed === null || typeof parsed !== "object") {
  item("genai-metrics: line", "UNREADABLE — it is there but does not parse as JSON");
  out(`      ${marked}`);
  finish();
}

const tests = parsed.tests ?? {};
const passed = Number(tests.passed ?? 0);
const failed = Number(tests.failed ?? 0);
const skipped = Number(tests.skipped ?? 0);
const total = passed + failed + skipped;
item("tests", total === 0 ? "0 — the suite reported no tests at all" : `${total} total: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) item("  note", "a red suite is the NEXT round's problem, not this install's — record the floors and move on");
if (total > 0 && skipped / total > 0.1) item("  note", "more than a tenth is skipped, which the gate rejects on its own. Worth raising before the first round");

const DIMENSIONS = ["lines", "branches", "functions"];
const coverage = parsed.coverage ?? {};
const measured = {};
for (const dimension of DIMENSIONS) {
  const value = coverage[dimension];
  measured[dimension] = typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
  item(
    `coverage.${dimension}`,
    measured[dimension] === null
      ? value === undefined || value === null ? "not reported by this toolchain" : `IGNORED — ${JSON.stringify(value)} is not a fraction in [0,1]`
      : `${(measured[dimension] * 100).toFixed(1)}%`,
  );
}

section("PROPOSED FLOORS — agree these with the user, then the executor writes the file");

// Rounded DOWN to the nearest step, so the proposal always lands at or below what was measured.
// A measurement that sits exactly on a step proposes itself, and that is on purpose for the case it
// mostly arises in — 100% functions, where the shipped default is 1.0 anyway. Everywhere else the
// rounding leaves the headroom that keeps the first round from being rejected for one line.
const floorFor = (value) => Math.max(0, Math.round(Math.floor(value / step) * step * 100) / 100);
const proposal = {};
for (const dimension of DIMENSIONS) {
  proposal[dimension] = measured[dimension] === null ? null : floorFor(measured[dimension]);
}

out();
out("  {");
out('    "coverage": {');
DIMENSIONS.forEach((dimension, index) => {
  const comma = index === DIMENSIONS.length - 1 ? "" : ",";
  const note = proposal[dimension] === null
    ? "   // nothing measures this here — null opts the dimension out"
    : `   // measured ${(measured[dimension] * 100).toFixed(1)}%`;
  out(`      "${dimension}": ${proposal[dimension] === null ? "null" : proposal[dimension].toFixed(2)}${comma}${note}`);
});
out("    }");
out("  }");
out();
out("  Read before pasting:");
out("    · A round may NOT edit this file. A floor above what the project measures rejects every");
out("      round with nothing able to fix it, which is the failure these proposals exist to prevent.");
out("    · `null` opts a dimension out, and it is the only way out. Use it where the toolchain");
out("      reports nothing — Go's cover has statements and neither branches nor functions.");
out("    · In a repository of several modules, a module with no tests belongs in the denominator.");
out("      Left out, it cannot pull any dimension down and its absence reads as coverage.");
out("    · The `e2e` block is separate and is NOT proposed here. Leave it at the shipped values");
out("      unless the user has a reason, and note that omitting it does not opt out.");
out();

finish();
