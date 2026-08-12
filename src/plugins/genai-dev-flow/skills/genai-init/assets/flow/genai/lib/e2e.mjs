// The e2e contract, in one place: what the specs asked for, what the manifest promised, and what
// the report delivered. Five judgements are exported, one per atom in check.mjs.
//
// The shape of the chain is the whole design:
//
//   spec deltas          #### Scenario: S1 - ...        the ids, and there is no other source of them
//   e2e-manifest.md      S1 -> mapped | agent-driven | waived
//   the suite            test('S1: ...')                the id is greppable, so the mapping cannot drift
//   e2e-report.md        S1 -> pass/fail + DB evidence
//
// Both records carry one fenced ```json block and any prose their author wants around it. That
// split is the same one `make genai-metrics` uses: a machine-readable payload for the gate, free
// text for the person who reads it later. A markdown table would have been prettier and would put
// the round at the mercy of column alignment.
//
// Nothing here decides a verdict. Each function returns a label naming what is on disk, and the
// node maps that label — which is why `test_failure` can be a hand-off in one node and would be a
// rejection in another.

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, join, normalize } from "node:path";
import { genaiDir, openChanges, specDeltasOf } from "./changes.mjs";
import { scenarioCounts } from "./openspec.mjs";

const MANIFEST = "e2e-manifest.md";
const REPORT = "e2e-report.md";
const THRESHOLDS = join("tools", "genai", "thresholds.json");
const APP_CONFIG = join("tools", "genai", "e2e.json");

const BUCKETS = ["mapped", "agent-driven", "waived"];
const DB_ASSERT = ["suite", "runner", "not-applicable"];
const EXECUTIONS = ["script", "agent-driven"];
const CLASSIFICATIONS = ["product", "test", "infra"];

// Scenario headers, read the way openspec reads them: **any** non-fenced level-4 header inside a
// requirement block is a scenario, whether or not it says `Scenario:`. Matching only `####
// Scenario:` here would count fewer scenarios than openspec does, and the ones it skipped would be
// the ones nobody noticed were unaddressed.
const REQUIREMENT = /^ {0,3}###\s+/;
const HEADER = /^ {0,3}####\s+(.*\S)\s*$/;
const LABEL = /^Scenario:\s*/i;

// One form, and the strictness is the point: the id is a key in the manifest, a substring of a test
// title and a key in the report, so `s1`, `S01` and `S-1` are three different ids and none of them
// is `S1`. The convention itself, and why it is numbers rather than words, is in `genai-openspec`.
const ID = /^S\d+$/;

// A missing ceiling means the shipped one, NOT no ceiling. This is deliberately the opposite of the
// coverage floors, where an absent dimension opts out: a floor left out is a project saying it does
// not measure that, while a ceiling left out would be a project silently allowed to hand-drive
// every scenario. Raising it has to be visible in the project's own file.
//
// Two numbers, one limit: the round is over the ceiling only when it exceeds **both**, so the
// effective allowance is the larger of them at this scenario count.
const CEILING = { max_non_scripted: 5, max_non_scripted_ratio: 0.2 };

const APP_TIMEOUT_MS = 5000;

/**
 * The scenario ids in this round's spec deltas — the only place they come from.
 *
 * Uniqueness is required within a change and not across the round. The manifest, the report and the
 * test titles are all per change, so a collision between two changes cannot confuse any of them;
 * requiring more would make two independent changes able to break each other.
 */
export function judgeScenarios() {
  const changes = collect();
  if (changes === null) return unreadable();

  const unnumbered = [];
  const duplicated = [];
  const counts = {};
  for (const change of changes) {
    unnumbered.push(...change.scenarios.unnumbered);
    duplicated.push(...change.scenarios.duplicated.map((id) => `${change.id}:${id}`));
    counts[change.id] = change.scenarios.ids.length;
  }

  // openspec's count is the authority on how many scenarios there are; the ids are ours to read,
  // because its JSON drops the headers. Where the two disagree with nothing locally to blame, the
  // reader here is wrong — and saying so is the whole reason to ask twice.
  const authority = scenarioCounts(changes.map((change) => change.id));
  const disagreement = authority === null
    ? []
    : changes
        .filter((change) => change.scenarios.headers !== authority[change.id])
        .map((change) => ({ change: change.id, openspec: authority[change.id], found: change.scenarios.headers }));

  // Reported as a fact rather than a label: a change with no scenario at all is legitimate (a
  // documentation-only change has nothing to drive), and it is also how a spec quietly opts out of
  // the whole e2e branch. Nothing mechanical can tell the two apart, so it lands in the event log
  // where the spec review can see it.
  const facts = { scenarios: counts, without_scenarios: changes.filter((c) => c.scenarios.ids.length === 0).map((c) => c.id) };

  if (duplicated.length > 0) return { label: "duplicated", facts: { ...facts, duplicated } };
  if (unnumbered.length > 0) return { label: "unnumbered", facts: { ...facts, unnumbered: unnumbered.slice(0, 20) } };
  if (disagreement.length > 0) return { label: "count_mismatch", facts: { ...facts, disagreement } };
  return { label: "unique", facts };
}

/** Every scenario accounted for in exactly one bucket, and the non-scripted share under the ceiling. */
export function judgeManifest() {
  const changes = collect();
  if (changes === null) return unreadable();

  const missing = [];
  const extra = [];
  let scenarios = 0;
  let nonScripted = 0;
  const buckets = {};

  for (const change of changes) {
    const parsed = payload(join(genaiDir(change.id), MANIFEST));
    if (parsed.label !== null) {
      return { label: parsed.label === "absent" ? "manifest_missing" : "manifest_malformed", facts: { change: change.id, ...parsed.facts } };
    }

    const rows = parsed.data?.scenarios;
    if (rows === null || typeof rows !== "object" || Array.isArray(rows)) {
      return { label: "manifest_malformed", facts: { change: change.id, reason: "`scenarios` must be an object keyed by scenario id", found: typeof rows } };
    }

    const declared = Object.keys(rows);
    missing.push(...change.scenarios.ids.filter((id) => !Object.hasOwn(rows, id)).map((id) => `${change.id}:${id}`));
    extra.push(...declared.filter((id) => !change.scenarios.ids.includes(id)).map((id) => `${change.id}:${id}`));

    for (const [id, row] of Object.entries(rows)) {
      const shape = rowShape(id, row);
      if (shape !== null) return { label: "manifest_malformed", facts: { change: change.id, scenario: id, reason: shape } };
      buckets[row.bucket] = (buckets[row.bucket] ?? 0) + 1;
      if (row.bucket !== "mapped") nonScripted += 1;
      scenarios += 1;
    }

    // Run commands are what the report's numbers have to be reproducible from, so they are required
    // exactly when there is something scripted to run.
    const mapped = declared.filter((id) => rows[id]?.bucket === "mapped");
    const run = parsed.data?.run;
    if (mapped.length > 0 && (!Array.isArray(run) || run.filter((c) => typeof c === "string" && c.trim() !== "").length === 0)) {
      return { label: "manifest_malformed", facts: { change: change.id, reason: "`run` must list at least one command when any scenario is mapped" } };
    }
  }

  if (missing.length > 0 || extra.length > 0) {
    return { label: "unaccounted", facts: { missing, extra, scenarios } };
  }

  // The two limits are one limit: whichever is the more generous at this scenario count. They are
  // there for opposite ends of the range — the absolute keeps a small round from being nagged about
  // three waivers out of eight, the ratio keeps a large one honest — so taking them together with
  // `or` would let the absolute govern everything: at 63 scenarios, `0.2` allows 12 and `5` allows 5,
  // and the ratio has no effect at all. Which is what happened, and it pushed a round into narrowing
  // its waiver list by changing the product's own interface.
  const ceiling = ceiling_();
  const ratio = scenarios === 0 ? 0 : nonScripted / scenarios;
  const allowed = Math.max(ceiling.max_non_scripted, ceiling.max_non_scripted_ratio * scenarios);
  const facts = {
    scenarios,
    non_scripted: nonScripted,
    ratio: Number(ratio.toFixed(3)),
    allowed: Number(allowed.toFixed(2)),
    buckets,
    ceiling,
  };
  if (nonScripted > allowed) return { label: "over_ceiling", facts };
  return { label: "accounted", facts };
}

/**
 * Every mapped scenario's id is greppable in the test file the manifest names.
 *
 * This is the rule that keeps the mapping honest. A manifest row is a claim about a file, and the
 * claim costs nothing to write; checking that the id really appears in the title is what makes a
 * renamed or deleted test show up here rather than as a silently uncovered scenario months later.
 */
export function judgeMapping() {
  const changes = collect();
  if (changes === null) return unreadable();

  const checked = [];
  for (const change of changes) {
    const parsed = payload(join(genaiDir(change.id), MANIFEST));
    if (parsed.label !== null) {
      return { label: "unreadable", facts: { change: change.id, reason: "the manifest could not be read as a payload", ...parsed.facts } };
    }
    for (const [id, row] of Object.entries(parsed.data?.scenarios ?? {})) {
      if (row?.bucket !== "mapped") continue;
      // The manifest rule runs ahead of this one and has already refused a row of the wrong shape.
      // Re-checked anyway, because this is the atom that opens a file whose path came out of a
      // record an executor wrote.
      if (typeof row.test !== "string" || escapes(row.test)) {
        return { label: "file_missing", facts: { change: change.id, scenario: id, test: row.test ?? null, reason: "`test` must be a path inside the project" } };
      }
      if (!existsSync(row.test)) {
        return { label: "file_missing", facts: { change: change.id, scenario: id, test: row.test } };
      }
      if (!readFileSync(row.test, "utf8").includes(row.title)) {
        return { label: "title_missing", facts: { change: change.id, scenario: id, test: row.test, title: row.title } };
      }
      checked.push(`${change.id}:${id}`);
    }
  }
  return { label: "matched", facts: { checked } };
}

/**
 * The acceptance facts, and who the remaining work belongs to.
 *
 * Order matters and is not arbitrary. Anything wrong with the record itself comes first, because a
 * report that cannot be read says nothing about the product. Coverage comes before results for the
 * same reason: a scenario nobody ran is not a scenario that passed. Only then do the failures get
 * classified, and a product failure outranks a test failure — with both present the code is wrong
 * first, and the broken test is still broken on the next pass.
 */
export function judgeReport() {
  const changes = collect();
  if (changes === null) return unreadable();

  const missing = [];
  const noEvidence = [];
  const failures = [];
  const executed = { script: 0, "agent-driven": 0 };
  let waived = 0;
  let notApplicable = 0;

  for (const change of changes) {
    const manifest = payload(join(genaiDir(change.id), MANIFEST));
    if (manifest.label !== null) {
      return { label: "unreadable", facts: { change: change.id, reason: "the manifest could not be read as a payload", ...manifest.facts } };
    }
    const rows = manifest.data?.scenarios ?? {};

    const parsed = payload(join(genaiDir(change.id), REPORT));
    if (parsed.label !== null) {
      return { label: parsed.label === "absent" ? "report_missing" : "report_malformed", facts: { change: change.id, ...parsed.facts } };
    }
    const results = parsed.data?.scenarios;
    if (results === null || typeof results !== "object" || Array.isArray(results)) {
      return { label: "report_malformed", facts: { change: change.id, reason: "`scenarios` must be an object keyed by scenario id", found: typeof results } };
    }

    for (const [id, row] of Object.entries(rows)) {
      if (row.bucket === "waived") {
        waived += 1;
        continue;
      }
      const result = results[id];
      if (result === undefined) {
        missing.push(`${change.id}:${id}`);
        continue;
      }
      const shape = resultShape(id, result);
      if (shape !== null) return { label: "report_malformed", facts: { change: change.id, scenario: id, reason: shape } };
      executed[result.execution] += 1;
      if (result.result === "pass") {
        // A pass with no database evidence is the failure this whole chain exists to catch, so it is
        // its own label rather than a line in the report nobody reads.
        if (result.db.verified_by === "not-applicable") notApplicable += 1;
        if (String(result.db.evidence ?? "").trim() === "") noEvidence.push(`${change.id}:${id}`);
      }
    }

    for (const failure of parsed.data?.failures ?? []) {
      if (!CLASSIFICATIONS.includes(failure?.classification)) {
        return { label: "report_malformed", facts: { change: change.id, reason: `every failure needs a classification of ${CLASSIFICATIONS.join(" | ")}`, found: failure?.classification ?? null } };
      }
      failures.push({ change: change.id, scenario: failure.scenario ?? null, classification: failure.classification });
    }

    const failed = Object.entries(results).filter(([, r]) => r?.result === "fail").map(([id]) => id);
    const claimed = new Set(parsed.data?.failures?.map((f) => f?.scenario));
    const unexplained = failed.filter((id) => !claimed.has(id));
    if (unexplained.length > 0) {
      return { label: "report_malformed", facts: { change: change.id, reason: "every failed scenario needs an entry under `failures` with a classification", scenarios: unexplained } };
    }
  }

  const facts = { executed, waived, not_applicable: notApplicable, failures };

  if (missing.length > 0) return { label: "coverage_short", facts: { ...facts, missing } };
  if (noEvidence.length > 0) return { label: "db_evidence_missing", facts: { ...facts, without_evidence: noEvidence } };

  const kinds = new Set(failures.map((f) => f.classification));
  if (kinds.has("product")) return { label: "product_failure", facts };
  if (kinds.has("test")) return { label: "test_failure", facts };
  if (kinds.has("infra")) return { label: "infra_failure", facts };
  return { label: "green", facts };
}

/**
 * Is the system under test up, and is it the right one?
 *
 * An open port is not the check. On a developer's machine several projects' services are usually
 * listening at once, so a TCP connect or even a 200 only proves *something* answered — port 8080
 * replying with someone else's console is a failed precondition, not a reachable app. The project
 * declares a marker its own app returns, and identity is what gets measured.
 */
export async function probeApp() {
  if (!existsSync(APP_CONFIG)) return { label: "config_missing", facts: { file: APP_CONFIG } };

  let config;
  try {
    config = JSON.parse(readFileSync(APP_CONFIG, "utf8"));
  } catch (cause) {
    return { label: "config_malformed", facts: { file: APP_CONFIG, reason: String(cause?.message ?? cause) } };
  }
  const url = config?.url;
  const contains = config?.contains;
  const status = config?.status ?? 200;
  if (typeof url !== "string" || url === "" || typeof contains !== "string" || contains === "") {
    return { label: "config_malformed", facts: { file: APP_CONFIG, reason: "`url` and `contains` are both required — without a marker there is nothing to identify the app by" } };
  }

  let response;
  let body;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(APP_TIMEOUT_MS), redirect: "follow" });
    body = await response.text();
  } catch (cause) {
    return { label: "unreachable", facts: { url, reason: String(cause?.message ?? cause) } };
  }
  if (response.status !== status) {
    return { label: "unreachable", facts: { url, expected_status: status, status: response.status } };
  }
  if (!body.includes(contains)) {
    return { label: "wrong_service", facts: { url, status, expected_marker: contains, body_head: body.slice(0, 200) } };
  }
  return { label: "identified", facts: { url, status, marker: contains } };
}

/**
 * The suite's signature: the content of every test file the manifests name.
 *
 * The test code has no fixed location — it goes wherever the project already keeps its e2e tests —
 * so a locator cannot reach it and the framework has nothing to measure. Deriving the signature
 * from the manifest's own claims closes that: a rework that edits a selector moves this hash, and a
 * rework that changed nothing does not.
 *
 * The field separator is NUL because no change id, scenario id or path can contain one, so two
 * different splits of the same bytes cannot collide. **Write it as the escape `\x00`, never as a
 * literal NUL byte in this file** — a source file carrying one is classified as binary by grep, git
 * grep and most editors' search, and the whole file then goes silently missing from the tool people
 * look for it with. This one did, for as long as it held four of them.
 */
export function suiteSignature() {
  const hash = createHash("sha256");
  for (const change of collect() ?? []) {
    const parsed = payload(join(genaiDir(change.id), MANIFEST));
    if (parsed.label !== null) {
      hash.update(`${change.id}\x00${parsed.label}\n`);
      continue;
    }
    for (const [id, row] of Object.entries(parsed.data?.scenarios ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      if (row?.bucket !== "mapped" || typeof row.test !== "string") continue;
      hash.update(`${change.id}\x00${id}\x00${row.test}\x00`);
      hash.update(existsSync(row.test) ? readFileSync(row.test) : "absent");
      hash.update("\n");
    }
  }
  return hash.digest("hex");
}

function collect() {
  const open = openChanges();
  if (open === null) return null;
  return open.map((id) => ({ id, scenarios: idsOf(id) }));
}

function idsOf(change) {
  const out = { ids: [], unnumbered: [], duplicated: [], headers: 0 };
  const seen = new Set();
  for (const file of specDeltasOf(change)) {
    const lines = readFileSync(file, "utf8").split("\n");
    const fenced = fenceMask(lines);
    // Level-4 headers only count inside a requirement, which is what everything after the first
    // level-3 header is. A `#### ` above that belongs to the delta's own prose.
    let inRequirement = false;
    for (let index = 0; index < lines.length; index += 1) {
      if (fenced[index]) continue;
      if (REQUIREMENT.test(lines[index])) {
        inRequirement = true;
        continue;
      }
      const header = HEADER.exec(lines[index]);
      if (header === null || !inRequirement) continue;
      out.headers += 1;
      const first = header[1].replace(LABEL, "").trim().split(/\s+/)[0].replace(/[:,]+$/, "");
      if (!ID.test(first)) {
        out.unnumbered.push({ file, header: header[1].slice(0, 80) });
        continue;
      }
      if (seen.has(first)) {
        out.duplicated.push(first);
        continue;
      }
      seen.add(first);
      out.ids.push(first);
    }
  }
  return out;
}

/**
 * Which lines sit inside a fenced block.
 *
 * openspec masks them and so must this: a `#### Scenario:` written as an example inside triple
 * backticks is not a scenario to openspec, and counting it here would put the two readers one apart
 * on a spec that is perfectly correct.
 */
function fenceMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const open = /^\s*(```+|~~~+)/.exec(lines[index]);
    if (fence === null && open !== null) {
      fence = open[1][0];
      mask[index] = true;
      continue;
    }
    if (fence !== null) {
      mask[index] = true;
      if (open !== null && open[1][0] === fence) fence = null;
    }
  }
  return mask;
}

/**
 * The one fenced json block in a record, or the reason there is none.
 *
 * `label` is null on success. `absent` and `malformed` are returned rather than named directly
 * because the two callers want different labels for the same two facts.
 */
function payload(path) {
  if (!existsSync(path)) return { label: "absent", facts: { expected: path } };
  const text = readFileSync(path, "utf8");
  const block = /```json\s*\n([\s\S]*?)\n```/.exec(text);
  if (block === null) {
    return { label: "malformed", facts: { file: path, reason: "no fenced json block — the gate reads that block and nothing else" } };
  }
  try {
    return { label: null, data: JSON.parse(block[1]) };
  } catch (cause) {
    return { label: "malformed", facts: { file: path, reason: String(cause?.message ?? cause) } };
  }
}

function rowShape(id, row) {
  if (row === null || typeof row !== "object") return "each row must be an object";
  if (!BUCKETS.includes(row.bucket)) return `bucket must be one of ${BUCKETS.join(" | ")}`;
  if (row.bucket === "mapped") {
    if (typeof row.test !== "string" || row.test.trim() === "") return "a mapped scenario needs `test`, the file its case lives in";
    if (typeof row.title !== "string" || !row.title.includes(id)) return "`title` must be the test's own title and must contain the scenario id";
    if (!DB_ASSERT.includes(row.db_assert)) return `db_assert must be one of ${DB_ASSERT.join(" | ")}`;
    if (escapes(row.test)) return "`test` must be a path inside the project, without `..`";
    return null;
  }
  if (typeof row.reason !== "string" || row.reason.trim() === "") return "a scenario that is not mapped needs `reason`";
  return null;
}

function resultShape(id, result) {
  if (result === null || typeof result !== "object") return "each result must be an object";
  if (!EXECUTIONS.includes(result.execution)) return `execution must be one of ${EXECUTIONS.join(" | ")}`;
  if (result.result !== "pass" && result.result !== "fail") return "result must be `pass` or `fail`";
  if (result.result === "fail") return null;
  if (result.db === null || typeof result.db !== "object") return "a passing scenario needs a `db` object";
  if (!DB_ASSERT.includes(result.db.verified_by)) return `db.verified_by must be one of ${DB_ASSERT.join(" | ")}`;
  return null;
}

// Both records name files the gate then reads, so the same rule fsx applies to its own locators
// applies here: nothing may point outside the project.
function escapes(path) {
  return isAbsolute(path) || normalize(path).split(/[\\/]/).includes("..");
}

function ceiling_() {
  if (!existsSync(THRESHOLDS)) return CEILING;
  try {
    const declared = JSON.parse(readFileSync(THRESHOLDS, "utf8")).e2e ?? {};
    return {
      max_non_scripted: typeof declared.max_non_scripted === "number" ? declared.max_non_scripted : CEILING.max_non_scripted,
      max_non_scripted_ratio: typeof declared.max_non_scripted_ratio === "number" ? declared.max_non_scripted_ratio : CEILING.max_non_scripted_ratio,
    };
  } catch {
    return CEILING;
  }
}

function unreadable() {
  return { label: "unreadable", facts: { reason: "openspec/changes/ is not there" } };
}
