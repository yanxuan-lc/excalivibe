// Whether the project still builds.
//
// One target, `make genai-build`, and the exit code is the whole verdict. That is the opposite of
// how `genai-metrics` is read — there the exit code is ignored, because a failing suite is data and
// the numbers still have to come through. Here there are no numbers: a build either completed or it
// did not, and the code saying so is the answer rather than an obstacle to it.
//
// The same difference decides how the recipe is written. `genai-metrics` needs make's `-` prefix on
// the line that runs the suite, so a red test does not stop the recipe before it prints. A
// `genai-build` recipe needs the opposite — no prefix at all — because stopping at the failing line
// IS the result, and carrying on past it would report a build that did not happen.
//
// **This deliberately does not read `tools/genai/modules.json`.** The map is a structure declaration
// a round may edit; the build gate is not. Keeping them apart is what stops an edit to the map from
// moving the verdict — and it also keeps the two failures legible, since a broken map and a broken
// build are different problems with different owners.
//
// Why a single aggregate target rather than a per-module walk driven by the map: narrowing belongs
// to the toolchain, not to a gate. `go test` already skips packages nothing touched, tsc has
// `--incremental`, and a project whose build is genuinely slow can narrow inside its own recipe,
// where the knowledge of how to do that safely already lives. A gate that narrows has to be right
// about the module map, the dependency graph and the fork point all at once, and being wrong about
// any of them means silently testing less — which looks exactly like passing.

import { spawnSync } from "node:child_process";
import { targetExists } from "./modules.mjs";

const TARGET = "genai-build";

// The recipe genai-init installs prints this and exits 1. Both halves matter: exiting 1 stops an
// unwritten build from ever reporting green, and the sentinel is what separates "nobody has written
// this yet" from "the code does not compile". They are opposite problems — one is a person's, the
// other is the round's — and without the sentinel the first arrives dressed as the second, sending a
// round to chase a compile error that does not exist.
const PLACEHOLDER = "GENAI-BUILD-PLACEHOLDER";

// Long enough for a cold multi-module build, and short enough to come back before the gate's own
// timeout. Hitting the gate timeout instead would be reported as `failed`, whose message says the
// installed step definitions are buggy — a false accusation, and the reason this bound is here.
const BUILD_TIMEOUT_MS = 600_000;

export function judgeBuild() {
  const known = targetExists(TARGET);
  if (!known.exists) {
    return { label: "target_missing", facts: { target: TARGET, reason: known.reason } };
  }

  const run = spawnSync("make", [TARGET, "--no-print-directory"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: BUILD_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${String(run.stdout ?? "")}${String(run.stderr ?? "")}`;

  if (output.includes(PLACEHOLDER)) {
    return {
      label: "target_missing",
      facts: { target: TARGET, reason: "the target is there but still holds the placeholder recipe genai-init installed, so nothing has been built" },
    };
  }
  if (run.error) {
    return {
      label: "build_failed",
      facts: { target: TARGET, reason: String(run.error?.message ?? run.error), output_tail: tail(output) },
    };
  }
  if (run.status !== 0) {
    // The tail rather than the head: make stops at the line that failed, so what went wrong is at
    // the end of the output and the beginning is the part that worked.
    return { label: "build_failed", facts: { target: TARGET, exit: run.status, output_tail: tail(output) } };
  }
  return { label: "built", facts: { target: TARGET } };
}

function tail(output, lines = 40) {
  return output.split("\n").filter((line) => line.trim() !== "").slice(-lines).join("\n").slice(-4000);
}
