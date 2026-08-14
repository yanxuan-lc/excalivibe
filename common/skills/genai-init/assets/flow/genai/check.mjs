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
//   round-commits                ahead | not_ahead | no_baseline | unreadable
//   openspec-valid --scope <s>   satisfied | validation_failed | totals_unreadable
//                                | openspec_unavailable
//   metrics                      satisfied | tests_failing | no_tests | too_many_skipped
//                                | coverage_below_floor | metrics_missing | metrics_unreadable
//                                | thresholds_missing
//   build-ok                     built | build_failed | target_missing
//   modules-map                  consistent | map_missing | map_malformed | target_missing
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
//   install-ready                ready | unfinished | broken  (composes the four above and applies
//                                the install-time acceptance table; re-judges nothing)
//   signature-docs               (not a check: prints the documentation tree's signature)
//   signature-archive            (not a check: prints the archive's signature)
//   signature-e2e-suite          (not a check: prints the e2e suite's signature)

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { archived, backlogRoot, items } from "./lib/backlog.mjs";
import { changeFiles, openChanges, specDeltas } from "./lib/changes.mjs";
import { judgeBuild } from "./lib/build.mjs";
import { judgeDocs } from "./lib/decision.mjs";
import { treeSignature } from "./lib/docs.mjs";
import { judgeMap } from "./lib/modules.mjs";
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
  "round-commits": roundCommits,
  "openspec-valid": openspecValid,
  metrics: metricsAtom,
  "build-ok": buildOk,
  "modules-map": modulesMap,
  "spec-scenarios": specScenarios,
  "arch-doc": archDoc,
  "e2e-manifest": e2eManifest,
  "e2e-mapping": e2eMapping,
  "e2e-report": e2eReport,
  "app-identity": appIdentity,
  "install-ready": installReady,
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

/**
 * Does this branch carry work that no other branch has?
 *
 * `outputs_present` on a `git_commit` locator asks whether the branch has a tip, and after the
 * install baseline it always has one; `signature_changed` compares an attempt to the one before it,
 * and the first attempt has nothing to compare to. Between them a step that committed nothing at all
 * passes both on its first try — measured, not theorised. The implement brief already requires "at
 * least one new commit"; this is the check that reads it.
 *
 * The baseline is derived rather than declared, because a gate command gets no variables and the
 * round's branch name is one. Every other local branch that is an ancestor of HEAD is a candidate,
 * and the nearest one is what this round grew from — that is the integration branch by construction,
 * since the flow creates one branch per round off it.
 *
 * **`no_baseline` is a pass, deliberately.** A repository shape this cannot read — a round working
 * directly on the integration branch, a single-branch clone — must not stall behind a check whose own
 * premise did not hold. The failure it exists to catch is a comparison that came out empty, not a
 * comparison that could not be made.
 */
function roundCommits() {
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  let head;
  let branches;
  try {
    head = git("rev-parse", "--abbrev-ref", "HEAD");
    branches = git("for-each-ref", "--format=%(refname:short)", "refs/heads/")
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name !== "" && name !== head);
  } catch (cause) {
    say("unreadable", { reason: String(cause?.message ?? cause) });
  }

  const ancestors = branches.filter((name) => {
    try {
      git("merge-base", "--is-ancestor", name, "HEAD");
      return true;
    } catch {
      return false;
    }
  });
  if (ancestors.length === 0) {
    say("no_baseline", { branch: head, candidates: branches });
  }

  // The nearest ancestor: the one this branch has the fewest commits beyond. Comparing against a
  // further one would count another round's commits as this round's.
  const counted = ancestors
    .map((name) => ({ name, ahead: Number(git("rev-list", "--count", `${name}..HEAD`)) }))
    .sort((left, right) => left.ahead - right.ahead);
  const nearest = counted[0];
  say(nearest.ahead > 0 ? "ahead" : "not_ahead", {
    branch: head,
    baseline: nearest.name,
    ahead: nearest.ahead,
    considered: counted,
  });
}

function openspecValid() {
  const { label, facts } = validate(options.scope);
  say(label, facts);
}

function metricsAtom() {
  const { label, facts } = judge();
  say(label, facts);
}

function buildOk() {
  const { label, facts } = judgeBuild();
  say(label, facts);
}

// Separate from build-ok on purpose. This one asks whether the map still describes the Makefile;
// that one asks whether the project builds. Folding them together would report a renamed target and
// a broken compile as the same fact, and they are neither the same problem nor the same person's.
function modulesMap() {
  const { label, facts } = judgeMap();
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

// Whether an install is finished — the one thing genai-init could not answer with a command.
//
// It used to end by running the four checks below and having a model read the labels against a table
// written in prose. That table is the hard part, because **a green board is not the criterion**:
// `no_tests` is the CORRECT answer on a project that has none, `unreachable` is fine while the app is
// down, and `tests_failing` on an existing project belongs to the next round. Read the other way
// round, half the failures look like success. A judgement that lives in prose drifts, and the same
// half-finished project could come back "all set" in one session and "three things missing" in the
// next.
//
// So this atom re-judges nothing: it calls the same four evaluators the gates call, and adds only
// the mapping the prose used to carry — which of their labels are acceptable AT INSTALL TIME.
//
//   ready       a round can start
//   unfinished  something is still to be written — `blocking` says what
//   broken      something exists and contradicts itself or reality: a file the install copies that
//               has gone missing or changed shape, a marker pointing at the wrong service
//
// The split is missing-versus-wrong, and it is the useful one: `unfinished` is work outstanding,
// `broken` needs somebody to look at what is already there.

async function installReady() {
  const INSTALL_TIME = {
    "modules-map": {
      consistent: "ok",
      map_missing: "broken",         // the install copies this file; absent means it did not run
      map_malformed: "unfinished",   // overwhelmingly the untouched template — the reason says which
      target_missing: "unfinished",  // the map names a target make does not have
    },
    "build-ok": {
      built: "ok",
      build_failed: "unfinished",    // the recipe exists and the project does not compile: a person's
      target_missing: "unfinished",  // no genai-build target, or still the placeholder
    },
    metrics: {
      satisfied: "ok",
      no_tests: "ok",                // expected before anything is implemented
      tests_failing: "ok",           // the next round's problem, not this install's
      too_many_skipped: "ok",        // likewise fixable by a round
      coverage_below_floor: "unfinished", // floors set above what the project measures — and a round
                                          // may not edit them, so only a person can undo this
      // Nothing this install produces guarantees a `genai-metrics:` line any more: the executor
      // writes that target. So its absence is work outstanding, not a failed install.
      metrics_missing: "unfinished",
      // These two are the other half of the split — a file that exists and contradicts itself. The
      // install copies thresholds.json, so a missing or wrong-shaped one is not "unwritten".
      metrics_unreadable: "broken",
      thresholds_missing: "broken",
    },
    "app-identity": {
      identified: "ok",
      unreachable: "ok",             // the app is simply not running right now
      config_missing: "ok",          // deliberately not written when nothing answers yet
      wrong_service: "broken",       // the marker never appeared: the URL points elsewhere
      config_malformed: "broken",
    },
  };

  const results = {
    "modules-map": judgeMap(),
    "build-ok": judgeBuild(),
    metrics: judge(),
    "app-identity": await probeApp(),
  };

  const checks = {};
  const blocking = [];
  const broken = [];
  for (const [name, { label, facts }] of Object.entries(results)) {
    // An unmapped label is a new one somebody added to an evaluator without deciding what it means
    // here. Treating it as acceptable would let a new failure mode ship as "ready", so it blocks and
    // says so — the loud answer is the recoverable one.
    const verdict = INSTALL_TIME[name][label] ?? "unfinished";
    checks[name] = { label, verdict, reason: facts?.reason ?? null };
    if (verdict === "broken") broken.push({ check: name, label, facts });
    else if (verdict === "unfinished") blocking.push({ check: name, label, facts });
  }

  if (broken.length) say("broken", { checks, broken, blocking });
  if (blocking.length) say("unfinished", { checks, blocking });
  say("ready", { checks });
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
