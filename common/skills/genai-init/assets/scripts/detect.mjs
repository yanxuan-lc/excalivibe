#!/usr/bin/env node
// Phase 1 of genai-init: find out what this project already is. Read-only — it never writes, so it
// needs no permission and no confirmation, and it can be re-run at any point to see where an
// interrupted install stopped.
//
//   node <skill-dir>/assets/scripts/detect.mjs --target claude|codex|common
//
// It exists because the ten things below used to be ten separate commands with a model reading a
// paragraph of documentation between each one. Every branch here is decided by code; what comes out
// is already a conclusion. The report ends with the two sections that matter to whoever reads it:
// DECIDE, the questions this cannot answer for itself, and SUGGESTED, the apply.mjs line that
// carries the answers back.
//
// It exits 0 for everything it finds. "This project has nothing installed" is a finding, not a failure
// — and a non-zero exit for one would be indistinguishable from the script itself being broken. The
// single exception is a mistyped flag, which is not a finding about the project at all.

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, "..", "..");           // the skill directory this was loaded from
const SHIPPED_NODES = join(SKILL, "assets", "flow", "nodes");

const argv = process.argv.slice(2);
const flag = (name) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : argv[at + 1];
};
// A mistyped flag is the one case this exits non-zero for. Everything else it finds is a fact about
// the project, but `--targett codex` silently reports on the wrong end, and a report that answers a
// question nobody asked is worse than no report.
const KNOWN = ["target"];
const strays = argv.filter((token) => token.startsWith("--")).map((token) => token.slice(2)).filter((name) => !KNOWN.includes(name));
if (strays.length) {
  process.stderr.write(`detect.mjs: unknown flag(s) --${strays.join(", --")}; this script takes only --${KNOWN.join(", --")}\n`);
  process.exit(1);
}

const target = flag("target") ?? "claude";

// ───────────────────────── primitives ─────────────────────────

/** Run something for its output. Never throws: a missing binary is an answer, not an exception. */
function run(cmd, args) {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
  } catch (error) {
    return { ok: false, out: String(error.stdout ?? "").trim(), err: String(error.stderr ?? error.message).trim() };
  }
}

const read = (path) => { try { return readFileSync(path, "utf8"); } catch { return null; } };
const json = (path) => { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; } };
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
const dir = (path) => { try { return readdirSync(path).sort(); } catch { return null; } };
const isDir = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };

// Walk the working tree, not git's index. This phase runs *before* the repository may exist and
// before anything is added to it, so `git ls-files` and `git grep` both come back empty on a
// greenfield project that plainly has tests — and an empty answer here sends phase 2 to the wrong
// question and phase 4 to the wrong expected label.
const SKIP = new Set(["node_modules", ".git", ".flow", "dist", "build", "out", "coverage", "vendor", "target", ".venv", "venv", "__pycache__", ".next", ".cache", ".idea"]);
// Depth 12, not 6: `packages/api/src/features/billing/invoice/detail/thing.test.js` is eight deep and
// entirely ordinary in a monorepo, and missing it reports a project with tests as having none.
// Symlinked directories are not followed at all — that, rather than the depth, is what stops a loop.
const MAX_DEPTH = 12;
const MAX_FILES = 20000;
let truncated = false;
function walk(root = ".", depth = 0, found = []) {
  if (depth > MAX_DEPTH) { truncated = true; return found; }
  for (const entry of dir(root) ?? []) {
    if (SKIP.has(entry) || entry.startsWith(".DS")) continue;
    if (found.length >= MAX_FILES) { truncated = true; return found; }
    const path = root === "." ? entry : join(root, entry);
    let stat;
    try { stat = lstatSync(path); } catch { continue; }
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) walk(path, depth + 1, found);
    else found.push(path);
  }
  return found;
}
const files = walk();

const lines = [];
const out = (text = "") => lines.push(text);
const section = (title) => { out(); out(title); out("─".repeat(title.length)); };
const item = (label, value) => out(`  ${label.padEnd(28)} ${value}`);

const decide = [];   // what phase 2 has to ask
const blocked = [];  // what makes the install impossible until it is fixed

// ───────────────────────── 1. tooling ─────────────────────────

section("tooling");

const fsx = run("fsx", ["--version"]);
const openspec = run("openspec", ["--version"]);
// The renderer belongs here for one reason: genai.arch-decision sends its executor to `mdx-artifact`,
// which calls `mdxv`. Absent, that step of every round fails at the point of writing its document —
// far from anything that would explain why. The rest of what computer-use settles (the notification
// consent, the browser stack) stays with /install-computer-use; this is one binary, not a second copy
// of that list.
const mdxv = run("mdxv", ["--version"]);
item("fsx", fsx.ok ? fsx.out.split("\n")[0] : "MISSING — the graph engine the flow runs on");
item("openspec", openspec.ok ? openspec.out.split("\n")[0] : "MISSING — the spec and change tool");
item("mdxv", mdxv.ok ? mdxv.out.split("\n")[0] : "MISSING — the renderer genai.arch-decision writes through (npm: mdx-viewer)");

// The skill ships to a different path per end, so look in all three and report where it landed —
// that way one script serves every end, and a project installed for two hosts reads correctly.
const SKILL_PATHS = {
  claude: ".claude/skills/flow-scratch/SKILL.md",
  codex: ".codex/skills/flow-scratch.md",
  common: "docs/flow-scratch-skill.md",
};
const foundSkill = Object.entries(SKILL_PATHS).filter(([, p]) => existsSync(p));
item(
  "flow-scratch skill",
  foundSkill.length ? foundSkill.map(([end, p]) => `${p}${end === target ? "" : `  (for ${end}, not ${target})`}`).join(", ")
    : "MISSING — the driving manual",
);
item("openspec/", isDir("openspec") ? "present" : "MISSING — this project has never been initialised");

const missing = [
  !fsx.ok && "fsx",
  !openspec.ok && "openspec",
  !mdxv.ok && "mdxv",
  !foundSkill.some(([end]) => end === target) && "skill",
  !isDir("openspec") && "openspec-dir",
].filter(Boolean);
if (missing.length) decide.push(`install what is missing (${missing.join(", ")}) — offer: install now / user installs / stop`);

// ───────────────────────── 2. repository ─────────────────────────

section("repository");

const top = run("git", ["rev-parse", "--show-toplevel"]);
const head = run("git", ["rev-parse", "HEAD"]);
const atRoot = top.ok && resolve(top.out) === resolve(process.cwd());
item("git repository", top.ok ? (atRoot ? `yes, and this is its root` : `yes, but the root is ${top.out}`) : "no — not a repository");
item("HEAD", head.ok ? head.out.slice(0, 12) : "MISSING — no commit yet");

if (!top.ok) decide.push("create the repository (git init -b main + an empty first commit) — the user's call");
else if (!head.ok) decide.push("create the first commit (git commit --allow-empty) — the user's call");
if (top.ok && !atRoot) blocked.push(`run this from the repository root (${top.out}), not from a subdirectory`);

const ignore = read(".gitignore") ?? "";
const ignoresFlow = ignore.split("\n").some((l) => l.trim() === ".flow/" || l.trim() === "/.flow/");
// Tracked beats ignored: git honours the index, not the ignore file, for anything already committed.
const flowTracked = run("git", ["ls-files", ".flow/"]).out.trim() !== "";
item(
  ".gitignore covers .flow/",
  `${ignoresFlow ? "yes" : ignore.includes(".flow/runs/") ? "only .flow/runs/ — apply.mjs widens it" : "no — apply.mjs adds it"}${flowTracked ? "  — but .flow/ is TRACKED, so the ignore does nothing until `git rm -r --cached .flow`" : ""}`,
);

// A definition swapped under a live run leaves that run measuring against a contract it was not
// created with, so this is the one finding that stops an upgrade rather than prompting a question.
const status = isDir(".flow") ? run("fsx", ["status", "--json"]) : { ok: true, out: '{"graphs":[]}' };
const live = status.ok ? (parse(status.out)?.graphs ?? []).length : null;
item("live graphs", live === null ? "unknown — fsx did not answer, so treat an upgrade as unsafe" : live === 0 ? "none" : `${live} — DO NOT upgrade definitions now`);
if (live) blocked.push(`${live} graph(s) are live: finish or abort the round before replacing definitions`);

// ───────────────────────── 3. .flow/ ─────────────────────────

section(".flow/");

// "absent" and "there is a file in the way" send a reader to different places, so do not print the
// first when the second is true.
item(".flow/", isDir(".flow") ? "present" : existsSync(".flow") ? "EXISTS BUT IS NOT A DIRECTORY — move it aside" : "absent — apply.mjs runs fsx init");

const installed = (dir(".flow/nodes") ?? []).filter((n) => n.startsWith("genai."));
const shipped = (dir(SHIPPED_NODES) ?? []).filter((n) => n.startsWith("genai."));
// Compare the two listings, never either against a number written down: a count in a document is
// wrong the first time a step is added, and neither of these two ever is.
// An empty shipped list means this plugin copy is broken, not that the project is complete. Left
// unsaid, the comparison below reports perfect agreement between two empty listings.
if (!shipped.length) {
  item("SHIPPED DEFINITIONS", `NONE FOUND at ${SHIPPED_NODES} — this plugin copy is incomplete, so nothing below can be judged`);
  blocked.push(`this plugin copy has no step definitions at ${SHIPPED_NODES}: reinstall the plugin before installing anything from it`);
}
const notInstalled = shipped.filter((n) => !installed.includes(n));
const retired = installed.filter((n) => !shipped.includes(n));
item("genai.* definitions", `${installed.length} installed / ${shipped.length} shipped${notInstalled.length ? ` — missing: ${notInstalled.join(", ")}` : ""}${retired.length ? ` — no longer shipped, apply.mjs removes them: ${retired.join(", ")}` : ""}`);
item("gate evaluators", existsSync(".flow/genai/check.mjs") ? "present" : "absent — apply.mjs copies .flow/genai/");
item("workflow whitelist", existsSync(".flow/workflows/genai-sprint.yaml") ? "present" : "absent — apply.mjs copies it");

const config = read(".flow/config.yaml");
const configValue = (key) => {
  const hit = config?.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, "m"));
  return hit ? hit[1] : null;
};
item("config: patience", config === null ? "no config.yaml" : configValue("patience") ?? "not set");
item("config: graph_budget", config === null ? "no config.yaml" : configValue("graph_budget") ?? "not set");
const lang = config === null ? null : configValue("instruction_language");
item("config: language", lang ?? "not set");
// Only ask what is not already settled on disk. This script is the agenda for phase 2, and a re-run —
// which is also the upgrade path — must not walk the user back through decisions they already made.
if (!lang) decide.push("instruction_language — the language the requirement briefs are written in, not the language of whoever is typing");

// ───────────────────────── 4. what the project owns ─────────────────────────

section("project-owned files");

const makefile = read("Makefile");
const hasMetrics = /^genai-metrics:/m.test(makefile ?? "");
const declaredGoal = makefile?.match(/^\s*\.DEFAULT_GOAL\s*:=\s*(\S+)/m)?.[1];
// With no .DEFAULT_GOAL, make runs the first target in the file — so that name is what the bare
// command does today, and it is the thing this used to get wrong.
const firstTarget = makefile?.match(/^([a-zA-Z0-9_][a-zA-Z0-9_./-]*):(?!=)/m)?.[1];
item("Makefile", makefile === null ? "absent — apply.mjs writes the head + the target skeleton" : "present");
if (makefile !== null) {
  item("  bare `make` runs", declaredGoal ? `${declaredGoal} (.DEFAULT_GOAL)` : firstTarget ? `${firstTarget} (first target — no .DEFAULT_GOAL)` : "nothing");
  item("  help target", /^help:/m.test(makefile) ? "yes" : "no");
  item("  genai-metrics target", hasMetrics ? "present" : "absent — apply.mjs appends the skeleton");
  if (hasMetrics) {
    // The placeholder recipe lines carry make's `-` prefix, so match with and without it.
    const placeholder = /^\t-?@</m.test(makefile.slice(makefile.search(/^genai-metrics:/m)));
    item("  its recipe", placeholder ? "STILL THE PLACEHOLDER — phase 4 fills it" : "filled in");
  }
}

const thresholds = json("tools/genai/thresholds.json");
// Byte-identical to the shipped template means nobody has agreed these numbers yet, which is a
// different state from "the project set them" and asks a different question in phase 2.
const shippedThresholds = read(join(SKILL, "assets", "project", "thresholds.json"));
const thresholdsUnagreed = !existsSync("tools/genai/thresholds.json") || read("tools/genai/thresholds.json") === shippedThresholds;
item(
  "tools/genai/thresholds.json",
  thresholds
    ? `${JSON.stringify(thresholds.coverage ?? {})}${thresholdsUnagreed ? "  (still the shipped defaults — nobody has agreed them)" : ""}`
    : existsSync("tools/genai/thresholds.json") ? "UNREADABLE" : "absent — apply.mjs copies the template",
);
const e2e = json("tools/genai/e2e.json");
const e2eTemplate = e2e !== null && String(e2e.contains).startsWith("REPLACE-");
// Either shape reads back the way it was declared; a project with a `command` would otherwise be
// reported as `undefined contains "…"`.
const e2eShape = e2e?.url ? `url ${e2e.url}` : e2e?.command ? `command ${JSON.stringify(e2e.command)}` : "NEITHER url NOR command — the gate reads that as config_malformed";
item("tools/genai/e2e.json", e2e ? (e2eTemplate ? "TEMPLATE, unedited — phase 4 fills it" : `${e2eShape}, contains ${JSON.stringify(e2e.contains)}`) : "absent");

const sibling = `../${basename(process.cwd())}_genai`;
const siblingState = isDir(sibling)
  ? `present${isDir(join(sibling, ".git")) ? ", its own git repository" : ", not a git repository"}`
  : "absent — apply.mjs creates it";
item("requirements directory", `${sibling}  ${siblingState}`);
if (!isDir(sibling)) decide.push(`whether ${sibling} should be its own git repository — it sits outside this repo, so it has no history unless given one`);

// ───────────────────────── 5. the test toolchain ─────────────────────────
// This is what phase 4 needs to fill the genai-metrics recipe, and it is why detect.mjs looks at
// more than the flow's own files: a model that has already been told the runner and the reporter
// does not have to go reading build files to find them.

section("test toolchain (input for the genai-metrics recipe)");

const pkg = json("package.json");
// A manifest that exists and does not parse is not the same as no manifest: phase 4 reads this one to
// choose a reporter, so an unreadable one is a finding rather than a silence.
if (pkg === null && existsSync("package.json")) item("package.json", "UNREADABLE — it exists and does not parse");
const manifests = [
  pkg && "package.json",
  existsSync("Cargo.toml") && "Cargo.toml",
  (existsSync("pyproject.toml") || existsSync("pytest.ini") || existsSync("setup.cfg")) && "python",
  existsSync("go.mod") && "go.mod",
  (existsSync("pom.xml") || existsSync("build.gradle") || existsSync("build.gradle.kts")) && "jvm",
  existsSync("Gemfile") && "Gemfile",
  existsSync("composer.json") && "composer.json",
  existsSync("mix.exs") && "mix.exs",
].filter(Boolean);
item("manifests", manifests.length ? manifests.join(", ") : "none found");

// Python and Rust declare their runner in a manifest too, and phase 4 needs it for the same reason
// it needs npm's: to pick a machine-readable reporter without going and reading build files first.
const pyConfig = ["pyproject.toml", "pytest.ini", "tox.ini", "setup.cfg"].filter((f) => existsSync(f));
if (pyConfig.length) {
  const text = pyConfig.map((f) => read(f) ?? "").join("\n");
  const opts = text.match(/^\s*addopts\s*=\s*(.+)$/m)?.[1]?.trim();
  const tools = ["pytest-cov", "pytest", "coverage", "unittest", "nose"].filter((t) => text.includes(t));
  item("  python test config", `${pyConfig.join(", ")}${opts ? ` — addopts ${opts}` : ""}${tools.length ? ` — mentions ${tools.join(", ")}` : ""}`);
}
if (existsSync("Cargo.toml")) {
  const cargo = read("Cargo.toml") ?? "";
  const tools = ["tarpaulin", "llvm-cov", "nextest", "grcov"].filter((t) => cargo.includes(t));
  item("  cargo coverage tools", tools.length ? tools.join(", ") : "none declared — `cargo test` reports no coverage on its own");
}

if (pkg) {
  const scripts = Object.entries(pkg.scripts ?? {}).filter(([n]) => /^(test|coverage|cov)/.test(n));
  item("  npm test scripts", scripts.length ? scripts.map(([n, v]) => `${n}: ${v}`).join(" | ") : "none");
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const runners = ["vitest", "jest", "mocha", "ava", "tap", "node:test", "c8", "nyc", "@vitest/coverage-v8", "playwright", "@playwright/test"].filter((d) => deps?.[d]);
  item("  runners / coverage", runners.length ? runners.join(", ") : "none declared");
}

// Whether any test exists decides which metrics label is the expected one at install time — with no
// tests, `no_tests` is correct and `satisfied` is not reachable — and which question phase 2 asks
// about the floors. So a test has to be code: matching on the name alone counts
// `flutter-integration-test.md` in a docs-heavy repository, and this count is not decorative.
const CODE = /\.(js|mjs|cjs|jsx|ts|tsx|py|go|rs|rb|php|java|kt|kts|swift|dart|ex|exs|scala|cs|m|mm|c|cc|cpp|h|hpp|sh|bash)$/i;
// Dot-delimited (`cart.test.ts`), underscore conventions (`test_cart.py`, `cart_test.go`) and the
// conventional directories. Deliberately not the hyphen forms: `check-spec.mjs` is a script, and a
// repository of tooling has more of those than it has tests.
const TEST_NAME = /(^|\/)(tests?|specs?|__tests__)\/|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.[a-z]+$|_test\.[a-z]+$/i;
const testFiles = files.filter((f) => CODE.test(f) && TEST_NAME.test(f));
item("test files", testFiles.length ? `${testFiles.length} — e.g. ${testFiles.slice(0, 3).join(", ")}` : "none — `no_tests` is the expected metrics label here");
if (truncated) item("  NOTE", `the scan stopped at ${files.length} files or ${MAX_DEPTH} levels — anything past that is unread, so treat "none" here as "not found", not as "not there"`);
if (!thresholdsUnagreed) { /* the project has set them, and neither a round nor this install may */ }
else if (testFiles.length) decide.push("the coverage floors: measure what the project does today, then set floors at or below it — a floor above reality rejects every round with nothing able to fix it");
else decide.push("the coverage floors: the shipped defaults are right for a project with no tests yet");

// ───────────────────────── 6. app identity hints ─────────────────────────

section("app identity hints (input for tools/genai/e2e.json)");

if (pkg) {
  const serve = Object.entries(pkg.scripts ?? {}).filter(([n]) => /^(dev|start|serve|preview)/.test(n));
  item("serve scripts", serve.length ? serve.map(([n, v]) => `${n}: ${v}`).join(" | ") : "none");
}
const compose = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"].find((f) => existsSync(f));
if (compose) {
  const ports = [...(read(compose) ?? "").matchAll(/^\s*-\s*"?(\d+):(\d+)"?/gm)].map((m) => m[1]);
  item("compose ports", ports.length ? [...new Set(ports)].join(", ") : "none declared");
}
// Same reason as the test scan: read the working tree, since `git grep` sees only what is tracked.
const SCANNABLE = /\.(js|mjs|cjs|ts|tsx|jsx|py|go|rs|rb|php|java|kt|swift|dart|ex|exs|yml|yaml|toml|conf)$/i;
const small = (f) => { try { return statSync(f).size <= 512 * 1024; } catch { return false; } };
// The path has to look like a route, not merely contain one: a bare /ping also matches the import
// `"../src/ping.js"`, and a hint that points at a test file wastes the one reading it. So require the
// quote or `key:` that a declared route sits behind.
const ROUTE = /(["'`]|:\s*)\/(healthz|health|readyz|ping|status)\b/;
const health = files.filter((f) => SCANNABLE.test(f) && small(f)).filter((f) => ROUTE.test(read(f) ?? ""));
item("health-ish routes in", health.length ? `${health.slice(0, 5).join(", ")}${health.length > 5 ? ` (+${health.length - 5} more)` : ""}` : "nothing found");
// Only the first of these is a question. The template case is a fact about the file, and it is already
// reported above — DECIDE is the list phase 2 works through, so a statement in it gets asked.
if (e2e === null) decide.push("does this project's app exist and answer on a URL today? If not, leave tools/genai/e2e.json out — an invented URL is worse than an absent file");

// ───────────────────────── the two sections that get read ─────────────────────────

section("DECIDE — phase 2 asks these, in one pass");
if (decide.length) decide.forEach((q, i) => out(`  ${i + 1}. ${q}`));
else out("  Nothing. Every decision this install needs is already on disk — go straight to phase 3,");
if (!decide.length) out("  which will only refresh the definitions, or skip it if nothing needs upgrading.");

if (blocked.length) {
  section("BLOCKED — fix these before apply.mjs");
  blocked.forEach((b) => out(`  · ${b}`));
}

section("SUGGESTED — phase 3, once the answers are in");
const suggestion = [
  `node ${join(HERE, "apply.mjs")}`,
  `--target ${target}`,
  // A known value goes in bare. `--lang <zh-CN>` is not a placeholder a reader fills in — pasted into
  // a shell it is a redirection, which is the same mistake the Makefile placeholder used to make.
  lang ? `--lang ${lang}` : "--lang ZH-CN-OR-EN-US",
  missing.length ? `--install ${missing.join(",")}` : null,
  !top.ok ? "--git-init" : !head.ok ? "--git-commit" : null,
  e2e === null ? "[--e2e]" : null,
  isDir(sibling) ? null : "[--sibling-git]",
].filter(Boolean).join(" ");
out(`  ${suggestion}`);
out();
if (suggestion.includes("[")) {
  out("  Square brackets are the ones phase 2 decides. Drop --install for anything the user installs");
  out("  themselves, and re-run this script rather than assuming it worked.");
} else if (!lang) out("  Replace ZH-CN-OR-EN-US with the language the requirement briefs are written in.");
else out("  Nothing to fill in — that line is ready as it stands. Re-run this script afterwards rather");
if (!suggestion.includes("[") && lang) out("  than assuming it worked.");
out();

process.stdout.write(lines.join("\n"));
