#!/usr/bin/env node
// Every check the genai step definitions make, behind one command.
//
//   node .flow/genai/check.mjs <atom> [--flag value]
//
// Each atom reports a **fact** as a label and never a verdict. The node maps that label to a
// verdict or an entry decision, which is why one atom serves two nodes that want opposite answers
// from it: `open-changes` is `absent → pass` for the archive and `absent → ready` for the
// acceptance, with no negation flag anywhere. Polarity belongs to the caller.
//
// Nothing here is written in shell inside a node.yaml. A gate command in YAML is a line nobody can
// test, review or reuse, and the six that used to live there had four separate copies of the same
// "find the requirements directory" logic between them.
//
//   backlog-status --status <s>   present | absent | unreadable
//   backlog-claimed              agreed | unclaimed | none_active | unreadable
//   open-changes                 present | absent | unreadable
//   spec-deltas                  present | absent | unreadable
//   worktree                     clean | dirty | unreadable
//   openspec-valid --scope <s>   satisfied | validation_failed | totals_unreadable
//                                | openspec_unavailable
//   metrics                      satisfied | tests_failing | no_tests | too_many_skipped
//                                | coverage_below_floor | metrics_missing | metrics_unreadable
//                                | thresholds_missing
//   spec-scenarios               unique | unnumbered | duplicated | count_mismatch | unreadable
//   arch-doc                     complete | no_decisions | decision_incomplete | external_reference
//                                | background_over_ceiling | unreadable
//   e2e-manifest                 accounted | unaccounted | over_ceiling | manifest_missing
//                                | manifest_malformed | unreadable
//   e2e-mapping                  matched | title_missing | file_missing | unreadable
//   e2e-report                   green | product_failure | test_failure | infra_failure
//                                | coverage_short | db_evidence_missing | report_missing
//                                | report_malformed | unreadable
//   app-identity                 identified | wrong_service | unreachable | config_missing
//                                | config_malformed
//   signature-docs               (not a check: prints the documentation tree's signature)
//   signature-archive            (not a check: prints the archive's signature)
//   signature-e2e-suite          (not a check: prints the e2e suite's signature)

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { archived, backlogRoot, items } from "./lib/backlog.mjs";
import { changeFiles, openChanges, specDeltas } from "./lib/changes.mjs";
import { judgeDocs } from "./lib/decision.mjs";
import { treeSignature } from "./lib/docs.mjs";
import { judgeManifest, judgeMapping, judgeReport, judgeScenarios, probeApp, suiteSignature } from "./lib/e2e.mjs";
import { judge } from "./lib/metrics.mjs";
import { validate } from "./lib/openspec.mjs";
import { emit, flags, say } from "./lib/say.mjs";
import { readFileSync } from "node:fs";

const [atom, ...rest] = process.argv.slice(2);
const options = flags(rest);

const atoms = {
  "backlog-status": backlogStatus,
  "backlog-claimed": backlogClaimed,
  "open-changes": openChangesAtom,
  "spec-deltas": specDeltasAtom,
  worktree,
  "openspec-valid": openspecValid,
  metrics: metricsAtom,
  "spec-scenarios": specScenarios,
  "arch-doc": archDoc,
  "e2e-manifest": e2eManifest,
  "e2e-mapping": e2eMapping,
  "e2e-report": e2eReport,
  "app-identity": appIdentity,
  "signature-docs": signatureDocs,
  "signature-archive": signatureArchive,
  "signature-e2e-suite": signatureE2eSuite,
};

if (!Object.hasOwn(atoms, atom ?? "")) {
  // Deliberately not a thrown error: a misnamed atom is a definition bug, and reporting it as a
  // label puts it in the event log next to the rule that named it.
  say("unreadable", { reason: "unknown check", found: atom ?? null, known: Object.keys(atoms) });
}
// Awaited because one atom reaches the network. `say` exits the process, so nothing here returns.
await atoms[atom]();

function backlogStatus() {
  const wanted = options.status;
  if (wanted === undefined) say("unreadable", { reason: "backlog-status needs --status <state>" });
  const all = items();
  if (all === null) say("unreadable", { reason: "the requirements directory is not there", expected: backlogRoot() });
  const matching = all.filter((item) => item.status === wanted).map((item) => item.id);
  say(matching.length > 0 ? "present" : "absent", { status: wanted, items: matching, total: all.length });
}

// Claiming and producing must agree in both directions. "Nothing was claimed" is its own label
// because it has its own fix: the set of active items IS the round's roster, so a round that
// claims nothing leaves the closing steps with an empty set to approve.
function backlogClaimed() {
  const all = items();
  if (all === null) say("unreadable", { reason: "the requirements directory is not there", expected: backlogRoot() });
  const active = all.filter((item) => item.status === "active").map((item) => item.id);
  if (active.length === 0) say("none_active", { total: all.length });

  const files = changeFiles();
  if (files === null) say("unreadable", { reason: "openspec/changes/ is not there" });
  const text = files.map((file) => readFileSync(file, "utf8")).join("\n");
  const unreferenced = active.filter((id) => !text.includes(id));
  say(unreferenced.length > 0 ? "unclaimed" : "agreed", { active, unreferenced });
}

function openChangesAtom() {
  const open = openChanges();
  if (open === null) say("unreadable", { reason: "openspec/changes/ is not there" });
  say(open.length > 0 ? "present" : "absent", { changes: open });
}

function specDeltasAtom() {
  const deltas = specDeltas();
  if (deltas === null) say("unreadable", { reason: "openspec/changes/ is not there" });
  say(deltas.length > 0 ? "present" : "absent", { count: deltas.length, files: deltas.slice(0, 20) });
}

// Untracked files are invisible here, which is load-bearing: the review leaves its records
// uncommitted on purpose, and the merge is what commits them.
function worktree() {
  try {
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const changed = status.split("\n").filter((line) => line.trim() !== "");
    say(changed.length > 0 ? "dirty" : "clean", { changed: changed.slice(0, 20) });
  } catch (cause) {
    say("unreadable", { reason: String(cause?.message ?? cause) });
  }
}

function openspecValid() {
  const { label, facts } = validate(options.scope);
  say(label, facts);
}

function metricsAtom() {
  const { label, facts } = judge();
  say(label, facts);
}

function specScenarios() {
  const { label, facts } = judgeScenarios();
  say(label, facts);
}

function archDoc() {
  const { label, facts } = judgeDocs();
  say(label, facts);
}

function e2eManifest() {
  const { label, facts } = judgeManifest();
  say(label, facts);
}

function e2eMapping() {
  const { label, facts } = judgeMapping();
  say(label, facts);
}

function e2eReport() {
  const { label, facts } = judgeReport();
  say(label, facts);
}

async function appIdentity() {
  const { label, facts } = await probeApp();
  say(label, facts);
}

// Not a check. The documentation step produces the tree rather than a commit, and declaring the
// branch tip instead would collide with the implementation step's own output — fsx refuses that at
// load time. An absent docs/ is a legitimate state and hashes to the empty digest.
function signatureDocs() {
  emit(treeSignature());
}

// Not a check. The acceptance step's artifact lives outside the repository, where a locator may not
// reach, so its signature is measured by command instead.
function signatureArchive() {
  const names = archived();
  emit(createHash("sha256").update((names ?? []).join("\n")).digest("hex"));
}

// Not a check either, and for the mirror reason: the e2e suite goes wherever the project already
// keeps its tests, so there is no locator that finds it. The manifest names the files; this hashes
// what they contain.
function signatureE2eSuite() {
  emit(suiteSignature());
}
