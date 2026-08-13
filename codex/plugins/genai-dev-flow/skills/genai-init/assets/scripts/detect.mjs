#!/usr/bin/env node
// The route step of genai-init: find out what this project already is. Read-only — it never writes,
// so it needs no permission and no confirmation, and it can be re-run at any point to see where an
// interrupted install stopped.
//
//   node <skill-dir>/assets/scripts/detect.mjs --target claude|codex|common
//
// It exists because the ten things below used to be ten separate commands with a model reading a
// paragraph of documentation between each one. Every branch here is decided by code; what comes out
// is already a conclusion. The report ends with the four sections that matter to whoever reads it:
// ROUTE, which of greenfield / brownfield / upgrade this project is; MODULES, a block to put in
// front of the user as it stands; DECIDE, the questions this cannot answer for itself; and
// SUGGESTED, the apply.mjs line that carries the answers back.
//
// It exits 0 for everything it finds. "This project has nothing installed" is a finding, not a failure
// — and a non-zero exit for one would be indistinguishable from the script itself being broken. The
// single exception is a mistyped flag, which is not a finding about the project at all.

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { signatureOf } from "./lib/signature.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, "..", "..");           // the skill directory this was loaded from
const SHIPPED_FLOW = join(SKILL, "assets", "flow");
const SHIPPED_NODES = join(SHIPPED_FLOW, "nodes");

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

// Walk the working tree, not git's index. This step runs *before* the repository may exist and
// before anything is added to it, so `git ls-files` and `git grep` both come back empty on a
// greenfield project that plainly has tests — and an empty answer here sends the ask step to the
// wrong question and the executor to the wrong expected label.
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

// What the ask step has to cover, as [round, question].
//
// Rounds, not one exchange. The host tool shows at most FOUR questions at a time, and this raises
// more than four — so "ask everything in one pass" cannot be carried out, and an executor trying to
// obey it either drops questions silently or crams several decisions into one. What the
// original instruction was actually against is the version that asked one thing per step with a
// paragraph of reading in between; batching into as few rounds as the tool allows keeps that.
//
// The grouping is not arbitrary: permission first, because a refusal there ends the procedure and
// everything asked afterwards would have been wasted; then the shape of the project; then the
// policy that rides on the shape.
const ROUNDS = ["permission and access", "what this project is", "policy"];
const decide = [];
const blocked = [];  // what makes the install impossible until it is fixed

// Always asked, and always first. Everything after it is only worth asking once someone has agreed
// there is going to be an install, so it is pushed here rather than conditionally anywhere below.
decide.push([1, "how to proceed — automatic (recommended) / manual, meaning every step is printed for the user to run / stop, which leaves this project exactly as it is"]);

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

// Only the global binaries are a question. Installing one reaches outside this directory — it
// replaces whatever was on PATH, an npm-linked local checkout included — so it is the user's to
// approve. What lands inside the project (`fsx skill install`, `openspec init`) apply.mjs simply
// does: consent to run the install already covered it, and a project being set up wants both.
const missing = [!fsx.ok && "fsx", !openspec.ok && "openspec", !mdxv.ok && "mdxv"].filter(Boolean);
if (missing.length) decide.push([1, `install the missing global binaries (${missing.join(", ")}) — offer: install now / user installs / stop`]);

const automatic = [
  !foundSkill.some(([end]) => end === target) && `fsx skill install --target ${target}`,
  !isDir("openspec") && "openspec init",
].filter(Boolean);
item("apply.mjs will also run", automatic.length ? automatic.join(", ") : "nothing extra — both are already in place");

// ───────────────────────── 2. repository ─────────────────────────

section("repository");

const top = run("git", ["rev-parse", "--show-toplevel"]);
const head = run("git", ["rev-parse", "HEAD"]);
const atRoot = top.ok && resolve(top.out) === resolve(process.cwd());
item("git repository", top.ok ? (atRoot ? `yes, and this is its root` : `yes, but the root is ${top.out}`) : "no — not a repository");
item("HEAD", head.ok ? head.out.slice(0, 12) : "MISSING — no commit yet");

// Both are apply.mjs's to do without asking: they stay inside this directory, and a project being
// set up wants a repository with something to compare against.
if (!top.ok) item("  apply.mjs will", "run git init -b main and make an empty first commit");
else if (!head.ok) item("  apply.mjs will", "make an empty first commit — several gates compare against HEAD");
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

// What this project recorded at its last install, against what this plugin copy would install now.
// The comparison is a signature rather than a version, so it also catches a definition edited
// between releases — the case a version number cannot see. See lib/signature.mjs.
const record = json(".flow/genai/installed.json");
const shippedSignature = signatureOf(SHIPPED_FLOW);
const behind = record !== null && shippedSignature !== null && record.signature !== shippedSignature;
item(
  "installed record",
  record === null
    ? existsSync(".flow/genai/installed.json") ? "UNREADABLE — it exists and does not parse" : "absent — either never installed, or installed before this record existed"
    : `${record.version ? `version ${record.version}` : "no version recorded"}, ${record.target ?? "unknown"} end, ${record.installed_at ?? "no timestamp"}`,
);
item(
  "  against what ships now",
  shippedSignature === null ? "this plugin copy has NO flow assets — nothing can be judged"
    : record === null ? "no record to compare — treat as a fresh install"
    : behind ? "DIFFERENT — the definitions here are not the ones this plugin ships. An upgrade is due"
    : "identical — nothing to upgrade",
);

const config = read(".flow/config.yaml");
const configValue = (key) => {
  const hit = config?.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, "m"));
  return hit ? hit[1] : null;
};
item("config: patience", config === null ? "no config.yaml" : configValue("patience") ?? "not set");
item("config: graph_budget", config === null ? "no config.yaml" : configValue("graph_budget") ?? "not set");
const lang = config === null ? null : configValue("instruction_language");
item("config: language", lang ?? "not set");
// Only ask what is not already settled on disk. This script is the agenda for the ask step, and a re-run —
// which is also the upgrade path — must not walk the user back through decisions they already made.
if (!lang) decide.push([2, "instruction_language — the language the requirement briefs are written in, not the language of whoever is typing"]);

// ───────────────────────── 4. what the project owns ─────────────────────────

section("project-owned files");

const makefile = read("Makefile");
const hasMetrics = /^genai-metrics:/m.test(makefile ?? "");
const hasBuild = /^genai-build:/m.test(makefile ?? "");
const declaredGoal = makefile?.match(/^\s*\.DEFAULT_GOAL\s*:=\s*(\S+)/m)?.[1];
// With no .DEFAULT_GOAL, make runs the first target in the file — so that name is what the bare
// command does today, and it is the thing this used to get wrong.
const firstTarget = makefile?.match(/^([a-zA-Z0-9_][a-zA-Z0-9_./-]*):(?!=)/m)?.[1];
// No script writes this file. Both genai targets describe THIS project — on several modules the
// build recipe IS that project's module list — and appending to somebody's existing Makefile
// collides with their includes, their variables and their default goal. So everything below is
// reported for an executor to act on, never as something an install is about to do.
item("Makefile", makefile === null ? "absent — the executor writes one, head included" : "present");
if (makefile !== null) {
  item("  bare `make` runs", declaredGoal ? `${declaredGoal} (.DEFAULT_GOAL)` : firstTarget ? `${firstTarget} (first target — no .DEFAULT_GOAL)` : "nothing");
  item("  help target", /^help:/m.test(makefile) ? "yes" : "no");
  item("  genai-metrics target", hasMetrics ? "present" : "absent — the executor writes it");
  if (hasMetrics) {
    // The placeholder recipe lines carry make's `-` prefix, so match with and without it.
    const placeholder = /^\t-?@</m.test(makefile.slice(makefile.search(/^genai-metrics:/m)));
    item("  its recipe", placeholder ? "STILL THE PLACEHOLDER — the executor replaces it" : "filled in");
  }
  item("  genai-build target", hasBuild ? "present" : "absent — the executor writes it");
  if (hasBuild) {
    // This placeholder announces itself by sentinel rather than by shape: it has to exit non-zero so
    // an unwritten build never reports green, which makes it look like a real recipe from the outside.
    const placeholder = makefile.slice(makefile.search(/^genai-build:/m)).includes("GENAI-BUILD-PLACEHOLDER");
    item("  its recipe", placeholder ? "STILL THE PLACEHOLDER — the executor replaces it" : "filled in");
  }
}

const thresholds = json("tools/genai/thresholds.json");
// Byte-identical to the shipped template means nobody has agreed these numbers yet, which is a
// different state from "the project set them" and asks a different question when the time comes to ask.
const shippedThresholds = read(join(SKILL, "assets", "project", "thresholds.json"));
const thresholdsUnagreed = !existsSync("tools/genai/thresholds.json") || read("tools/genai/thresholds.json") === shippedThresholds;
item(
  "tools/genai/thresholds.json",
  thresholds
    ? `${JSON.stringify(thresholds.coverage ?? {})}${thresholdsUnagreed ? "  (still the shipped defaults — nobody has agreed them)" : ""}`
    : existsSync("tools/genai/thresholds.json") ? "UNREADABLE" : "absent — apply.mjs copies the template",
);
// Unlike every other project-owned file here, this one is the round's to keep current — it declares
// structure and no gate judges by it. So "unfilled" is reported as a state to fix now, and "filled"
// is left entirely alone rather than compared against the template.
const modulesMap = json("tools/genai/modules.json");
const declaredModules = modulesMap && typeof modulesMap.modules === "object" && !Array.isArray(modulesMap.modules)
  ? Object.keys(modulesMap.modules)
  : null;
item(
  "tools/genai/modules.json",
  modulesMap === null
    ? existsSync("tools/genai/modules.json") ? "UNREADABLE — it exists and does not parse" : "absent — apply.mjs copies the template"
    : declaredModules === null ? "MALFORMED — no `modules` object; genai.spec refuses to start"
    : declaredModules.length === 0 ? "TEMPLATE, no modules declared — the executor fills it, and genai.spec refuses to start until it does"
    : `${declaredModules.length} module(s): ${declaredModules.join(", ")}`,
);

const e2e = json("tools/genai/e2e.json");
const e2eTemplate = e2e !== null && String(e2e.contains).startsWith("REPLACE-");
// Either shape reads back the way it was declared; a project with a `command` would otherwise be
// reported as `undefined contains "…"`.
const oneShape = (t) => (t?.url ? `url ${t.url}` : t?.command ? `command ${JSON.stringify(t.command)}` : "NEITHER url NOR command — the gate reads that as config_malformed");
const e2eShape = Array.isArray(e2e?.targets)
  ? `${e2e.targets.length} target(s): ${e2e.targets.map((t) => `${t?.name ?? "UNNAMED"} → ${oneShape(t)}, contains ${JSON.stringify(t?.contains)}`).join(" | ")}`
  : `${oneShape(e2e)}, contains ${JSON.stringify(e2e?.contains)}`;
item("tools/genai/e2e.json", e2e ? (e2eTemplate ? "TEMPLATE, unedited — the executor fills it" : e2eShape) : "absent");

const sibling = `../${basename(process.cwd())}_genai`;
const siblingState = isDir(sibling)
  ? `present${isDir(join(sibling, ".git")) ? ", its own git repository" : ", not a git repository"}`
  : "absent — apply.mjs creates it";
item("requirements directory", `${sibling}  ${siblingState}`);
// Created as a plain directory, with its version control left to whoever wants it. That is the
// default and it is not a question — apply.mjs takes `--sibling-git` when someone asks for one.

// ───────────────────────── 5. the modules and their toolchains ─────────────────────────
// This is what the executor needs to write modules.json and to fill the two recipes, and it is why
// detect.mjs looks at more than the flow's own files: a model that has already been told the split,
// the runners and the reporters does not have to go reading build files to find them.
//
// **Every depth, not just the root.** A manifest one level down is entirely ordinary — it is what a
// repository of several modules looks like — and a root-only scan reports the most interesting
// project it will ever meet as having no toolchain at all.

section("modules and toolchains (input for modules.json and the two recipes)");

// One manifest names one module. `python` and `jvm` collapse several filenames into one name
// because the distinction between pyproject.toml and setup.cfg does not change what the executor writes.
const MANIFESTS = [
  ["package.json", "package.json"],
  ["go.mod", "go.mod"],
  ["Cargo.toml", "Cargo.toml"],
  ["pyproject.toml", "python"], ["pytest.ini", "python"], ["setup.cfg", "python"],
  ["pom.xml", "jvm"], ["build.gradle", "jvm"], ["build.gradle.kts", "jvm"],
  ["Gemfile", "Gemfile"], ["composer.json", "composer.json"], ["mix.exs", "mix.exs"],
];
const MANIFEST_NAMES = new Map(MANIFESTS);

// Directory → the manifest kinds found in it. `.` for the root, so a single-module project reads
// the way it always did.
const byDir = new Map();
for (const file of files) {
  const name = basename(file);
  if (!MANIFEST_NAMES.has(name)) continue;
  const dir = dirname(file) === "." ? "." : dirname(file);
  if (!byDir.has(dir)) byDir.set(dir, new Set());
  byDir.get(dir).add(MANIFEST_NAMES.get(name));
}
const moduleDirs = [...byDir.keys()].sort();
const pkg = json("package.json");
// A manifest that exists and does not parse is not the same as no manifest: the executor reads this one to
// choose a reporter, so an unreadable one is a finding rather than a silence.
if (pkg === null && existsSync("package.json")) item("package.json", "UNREADABLE — it exists and does not parse");

item("manifests found in", moduleDirs.length ? `${moduleDirs.length} director${moduleDirs.length === 1 ? "y" : "ies"}` : "none found");
if (moduleDirs.length > 1) item("  NOTE", "more than one module — modules.json needs an entry each, and the metrics recipe has to aggregate across them");

// Module directory → a one-line stack, the way a person would say it: "Go + Gin",
// "TypeScript + Vite". It feeds the draft the user corrects, so the bar is recognisable rather than
// exhaustive — an unrecognised framework leaves just the language, which is still worth saying.
const stacks = new Map();
const FRAMEWORKS = {
  "package.json": [["next", "Next.js"], ["vite", "Vite"], ["react", "React"], ["vue", "Vue"], ["svelte", "Svelte"], ["@angular/core", "Angular"], ["nest", "NestJS"], ["express", "Express"], ["fastify", "Fastify"], ["astro", "Astro"]],
  "go.mod": [["gin-gonic/gin", "Gin"], ["labstack/echo", "Echo"], ["gofiber/fiber", "Fiber"], ["go-chi/chi", "chi"], ["gorilla/mux", "gorilla/mux"]],
  "Cargo.toml": [["axum", "Axum"], ["actix-web", "Actix"], ["rocket", "Rocket"], ["tauri", "Tauri"]],
  python: [["fastapi", "FastAPI"], ["django", "Django"], ["flask", "Flask"]],
  jvm: [["springframework", "Spring"], ["quarkus", "Quarkus"]],
};

for (const dir of moduleDirs) {
  const kinds = [...byDir.get(dir)].sort();
  item(dir === "." ? "  . (repository root)" : `  ${dir}`, kinds.join(", "));

  const at = (name) => (dir === "." ? name : join(dir, name));

  // The stack line, before the per-toolchain detail below.
  const parts = [];
  for (const kind of kinds) {
    const sources = {
      "package.json": [at("package.json")],
      "go.mod": [at("go.mod")],
      "Cargo.toml": [at("Cargo.toml")],
      python: ["pyproject.toml", "requirements.txt", "setup.cfg"].map(at),
      jvm: ["pom.xml", "build.gradle", "build.gradle.kts"].map(at),
    }[kind] ?? [];
    const text = sources.map((f) => read(f) ?? "").join("\n");
    const language = kind === "package.json"
      ? (existsSync(at("tsconfig.json")) || /"typescript"/.test(text) ? "TypeScript" : "JavaScript")
      : { "go.mod": "Go", "Cargo.toml": "Rust", python: "Python", jvm: "Java/Kotlin", Gemfile: "Ruby", "composer.json": "PHP", "mix.exs": "Elixir" }[kind] ?? kind;
    const found = (FRAMEWORKS[kind] ?? []).filter(([needle]) => text.includes(needle)).map(([, label]) => label);
    parts.push([language, ...found].join(" + "));
  }
  stacks.set(dir, parts.join(", "));
  item("      stack", stacks.get(dir));

  if (kinds.includes("package.json")) {
    const parsed = json(at("package.json"));
    if (parsed === null) item("      package.json", "UNREADABLE");
    else {
      const scripts = Object.entries(parsed.scripts ?? {}).filter(([n]) => /^(test|coverage|cov|build|lint|typecheck|tsc)/.test(n));
      item("      scripts", scripts.length ? scripts.map(([n, v]) => `${n}: ${v}`).join(" | ") : "none of test/build/lint/typecheck");
      const deps = { ...parsed.dependencies, ...parsed.devDependencies };
      const runners = ["vitest", "jest", "mocha", "ava", "tap", "node:test", "c8", "nyc", "@vitest/coverage-v8", "playwright", "@playwright/test"].filter((d) => deps?.[d]);
      item("      runners / coverage", runners.length ? runners.join(", ") : "none declared — this module has no test runner, so nothing here compiles it either");
    }
  }
  // Python and Rust declare their runner in a manifest too, and the executor needs it for the same reason
  // it needs npm's: to pick a machine-readable reporter without going and reading build files first.
  if (kinds.includes("python")) {
    const configs = ["pyproject.toml", "pytest.ini", "tox.ini", "setup.cfg"].filter((f) => existsSync(at(f)));
    const text = configs.map((f) => read(at(f)) ?? "").join("\n");
    const opts = text.match(/^\s*addopts\s*=\s*(.+)$/m)?.[1]?.trim();
    const tools = ["pytest-cov", "pytest", "coverage", "unittest", "nose", "mypy", "ruff"].filter((t) => text.includes(t));
    item("      python", `${configs.join(", ")}${opts ? ` — addopts ${opts}` : ""}${tools.length ? ` — mentions ${tools.join(", ")}` : ""}`);
  }
  if (kinds.includes("Cargo.toml")) {
    const cargo = read(at("Cargo.toml")) ?? "";
    const tools = ["tarpaulin", "llvm-cov", "nextest", "grcov"].filter((t) => cargo.includes(t));
    item("      cargo coverage", tools.length ? tools.join(", ") : "none declared — `cargo test` reports no coverage on its own");
  }
  if (kinds.includes("go.mod")) {
    // Worth stating rather than leaving the executor to discover: go's cover has statements and nothing
    // else, so a project whose only coverage comes from go cannot report two of the three dimensions.
    item("      go", "`go test -cover` reports STATEMENTS only — no branch and no function dimension");
  }
}

// The module question is asked on every route where the map is not already filled in — but it is a
// DIFFERENT question each time, so the route has to be known before it can be worded.
//
// This used to be conditioned on `moduleDirs.length > 1`, which was right when the only project this
// installed into was an existing one: there, one manifest needs no confirming. It is exactly wrong on
// a greenfield project, which has NO manifest and therefore has to be asked precisely because a file
// listing cannot settle it. That condition silently dropped the question on the one route that most
// needs it.
const mapUnfilled = declaredModules === null || declaredModules.length === 0;

// Whether any test exists decides which metrics label is the expected one at install time — with no
// tests, `no_tests` is correct and `satisfied` is not reachable — and which question the ask step asks
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
// ───────────────────────── two independent facts, not one three-way ──────────────────────────────
// Computed here rather than beside the ROUTE section below, because everything they read is now in
// hand and the questions they select have to reach DECIDE.
//
// These used to be fused into a single verdict, and fusing them was wrong in a way that only showed
// up on a re-run: an install interrupted after the components landed but before anyone filled the
// map came back as "upgrade — nothing to upgrade, re-running is safe", the module question was
// dropped because it was conditioned on not being an upgrade, and the report cheerfully described a
// project `genai.spec` would refuse at its first rule.
//
//   shape        what the build-out has to do — write a skeleton, or derive from what exists
//   definitions  whether the installed step definitions are absent, behind, or current
//
// `head` is deliberately NOT part of the shape test any more. apply.mjs creates an empty first
// commit, so a greenfield project became "brownfield" the moment it was installed — the flow was
// reading its own footprint as evidence about the project. What settles the shape is whether there
// is anything to derive from: a manifest, or a test.
const shape = !moduleDirs.length && !testFiles.length ? "greenfield" : "brownfield";
const definitions = !installed.length ? "absent" : behind ? "behind" : "current";

// Configuration is a third, orthogonal thing: components can be installed while the project-supplied
// half is still empty. Anything unfinished here brings its questions back, whatever the definitions
// say — which is the whole repair.
const makefileText = makefile ?? "";
const unfinished = [
  mapUnfilled && "tools/genai/modules.json declares no modules",
  !/^genai-build:/m.test(makefileText) && "the Makefile has no genai-build target",
  !/^genai-metrics:/m.test(makefileText) && "the Makefile has no genai-metrics target",
  thresholdsUnagreed && "the coverage floors are still the shipped template",
].filter(Boolean);

// One line per module, and only the three things a person actually holds: its name, what it is for,
// and what it is built with. Everything else in `modules.json` is derived — the path from the name,
// the target names from the name, the docs path by convention, the versions from the toolchain — so
// asking for any of it spends a user's attention on something the install can work out and the
// `modules-map` check will verify against make anyway.
if (mapUnfilled) {
  decide.push([2, "the modules, one line each: `- <name>: <what it is for>, <stack>` — e.g. `- web: the browser client, TypeScript + Vite`. One line is a single-module project. See the MODULES section below for the exact prompt to put in front of the user"]);
}

// Policy now; numbers after something has measured them. The two are separated on purpose: the
// numbers cannot be agreed before the metrics recipe exists and has run once, and a floor set from a
// sense of what a project like this should manage is how one lands above what it measures.
if (!thresholdsUnagreed) { /* the project has set them, and neither a round nor this install may */ }
else {
  decide.push([3,
    "coverage POLICY, not the numbers — which dimensions this toolchain can even report, and which modules are allowed to have no tests. "
    + (route === "brownfield" && testFiles.length
      ? "This project already has tests, so the numbers come from measure.mjs reading what they cover TODAY — never from what they ought to be"
      : "The numbers come from measure.mjs once the recipe exists and has run once"),
  ]);
}

// ───────────────────────── 6. what this project already runs ─────────────────────────
// The first rule on an existing project is to wrap the commands it already has rather than build a
// second set beside them: a project with working lint, test and coverage does not need this install
// to invent any of the three, and a second definition of how to build something is one that can
// disagree with the first. So the two genai recipes are written FROM this listing.
//
// It is also the answer to "which Makefile target does this module's `targets` point at" — that
// field names targets, not commands, so the names have to come from somewhere real.

section("commands this project already runs (wrap these; do not rebuild them)");

// Targets with their `## ` description where there is one, since that is what the project itself
// says each one is for. Skip .PHONY and pattern rules — neither is something to point a map at.
//
// Split rather than dumped. A mature repository has thirty targets and this section exists to
// nominate candidates for `targets` and the two recipes; printing all thirty with their full
// descriptions buries the four that matter under the ones that publish and tag.
const targets = [...(makefile ?? "").matchAll(/^([a-zA-Z0-9_][a-zA-Z0-9_./-]*):(?!=)[^\n]*?(?:##\s*(.*))?$/gm)]
  .map((hit) => ({ name: hit[1], note: hit[2]?.trim() }))
  .filter((t) => !t.name.startsWith("."));
const RELEVANT = /(^|-)(build|compile|test|tests|lint|check|verify|typecheck|tsc|fmt|format|cover|coverage|ci)($|-)/i;
const relevant = targets.filter((t) => RELEVANT.test(t.name));
const rest = targets.filter((t) => !RELEVANT.test(t.name));
const brief = (note) => (note && note.length > 48 ? `${note.slice(0, 47)}…` : note);
if (makefile === null) item("Makefile targets", "no Makefile");
else if (!targets.length) item("Makefile targets", "none declared");
else {
  item("  build/test/lint-ish", relevant.length ? relevant.map((t) => `${t.name}${t.note ? ` (${brief(t.note)})` : ""}`).join(", ") : "none — every target here is something else");
  if (rest.length) item("  everything else", `${rest.slice(0, 20).map((t) => t.name).join(", ")}${rest.length > 20 ? ` (+${rest.length - 20} more)` : ""}`);
}

const rootScripts = Object.entries(pkg?.scripts ?? {}).filter(([n]) => /^(test|coverage|cov|build|lint|typecheck|tsc|check|verify|ci)/.test(n));
item("root package.json scripts", existsSync("package.json") ? (rootScripts.length ? rootScripts.map(([n, v]) => `${n}: ${v}`).join(" | ") : "none that look like build/test/lint") : "no root package.json");

// CI is where a project's real commands are already written down, and it is the listing least likely
// to be out of date — it has to work or the pipeline goes red. Take the command lines and nothing
// else; a whole workflow file dumped here would bury the four lines that matter.
const CI_FILES = [".github/workflows", ".gitlab-ci.yml", ".circleci/config.yml", "Jenkinsfile", ".travis.yml", "azure-pipelines.yml"];
const ciPaths = CI_FILES.flatMap((path) => (isDir(path) ? (dir(path) ?? []).map((f) => join(path, f)) : existsSync(path) ? [path] : []));
if (!ciPaths.length) item("CI configuration", "none found");
else {
  item("CI configuration", ciPaths.join(", "));
  // `run:` (GitHub Actions), `- ` under script: (GitLab/Travis), `sh '…'` (Jenkins). One regex per
  // shape would be four regexes that each miss the other three; matching command-ish lines and
  // de-duplicating gets the same answer for the purpose this serves, which is naming candidates.
  const commands = new Set();
  for (const path of ciPaths.slice(0, 8)) {
    for (const line of (read(path) ?? "").split("\n")) {
      const hit = line.match(/^\s*(?:-\s*)?(?:run:|sh\s+['"]|- )\s*(.+?)\s*$/);
      const command = hit?.[1]?.replace(/['"]$/, "");
      if (command && /^(make|npm|pnpm|yarn|go|cargo|python|pytest|poetry|uv|mvn|gradle|dotnet|bundle|composer|mix|swift|flutter|dart|tox|just|task)\b/.test(command)) commands.add(command);
    }
  }
  item("  commands it runs", commands.size ? [...commands].slice(0, 12).join(" | ") : "none recognised — read the files themselves");
}

// ───────────────────────── 7. app identity hints ─────────────────────────

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
// reported above — DECIDE is the list the ask step works through, so a statement in it gets asked.
if (e2e === null) decide.push([3, "does this project's app exist and answer on a URL today? If not, leave tools/genai/e2e.json out — an invented URL is worse than an absent file"]);

// ───────────────────────── the sections that get read ─────────────────────────

// Which of the three routes this project is on. Decided by what is MISSING, never by what the
// project looks like: "greenfield" is not a kind of project, it is the absence of the three things
// the configuration work reads from — a manifest to name a module, a commit to compare against, and
// a test whose numbers set the floors.
//
// The scripted steps are identical on all three routes. What the route actually selects is which
// questions get asked and what the executor does with the answers, which is why one line of verdict
// here is enough and no flag carries it into apply.mjs.
section("ROUTE");

// `route` itself is decided further up, as soon as its inputs are in hand, because the questions it
// selects have to reach DECIDE. All that is left here is saying it out loud.
const why = {
  upgrade: `${installed.length} genai.* definitions are already installed${record === null ? ", though nothing recorded which version" : behind ? " and they differ from what ships now" : " and they match what ships now"}`,
  greenfield: "no manifest, no commit and no test file — there is nothing here to describe yet",
  brownfield: `${moduleDirs.length} manifest director${moduleDirs.length === 1 ? "y" : "ies"}, ${testFiles.length} test file(s), HEAD ${head.ok ? "present" : "missing"}`,
};
item("route", `${route.toUpperCase()} — ${why[route]}`);
if (route === "upgrade" && !behind && record !== null) {
  item("  note", "nothing to upgrade. Re-running is still safe and still refreshes the definitions");
}
if (route === "greenfield") {
  item("  what this means", "the executor writes a walking skeleton — one module, one passing test, one build that exits 0, one thing that answers — BEFORE the floors can be verified");
} else if (route === "brownfield") {
  item("  what this means", "measure before writing the floors. Run measure.mjs for the numbers, then set them at or below what came out");
}

// ───────────────────────── the modules prompt, ready to put in front of a person ─────────────────
// A free-text answer rather than a set of options: a module list is a table, and the two or three
// choices a picker can hold would flatten it to "one module or several", which answers nothing.
//
// Greenfield gets the blank form; brownfield gets what was detected, so the user corrects a draft
// instead of filling one. The script writes the draft because it is the one that has the data —
// leaving the executor to assemble it from the sections above is where a module quietly goes
// missing. Render it in the user's language when putting it in front of them.

if (mapUnfilled && route !== "upgrade") {
  section("MODULES — put this in front of the user, and take the reply as free text");
  if (route === "greenfield") {
    out("  Which modules does this project have? One line each:");
    out();
    out("    - <name>: <what it is for>, <stack>");
    out();
    out("  For example:");
    out("    - web: the browser client, TypeScript + Shadcn + Vite");
    out("    - server: the HTTP API behind it, Go + Gin");
    out();
    out("  A single-module project is one line.");
  } else {
    out("  This is what the code says. Correct anything wrong and fill in what each one is for:");
    out();
    for (const dir of moduleDirs) out(`    - ${dir === "." ? basename(process.cwd()) : dir}: <what it is for?>, ${stacks.get(dir)}`);
    if (!moduleDirs.length) out("    (no manifest was found anywhere, so say what this repository is made of)");
    if (targets.length) {
      out();
      out(`  Commands it already runs: ${targets.slice(0, 12).map((t) => t.name).join(", ")}`);
    }
  }
  out();
  out("  Everything else is derived: the path from the name, the make targets from the name, the docs");
  out("  path by convention, the versions from the toolchain, and the dependencies from what the roles");
  out("  and the code imply. All of it lands in tools/genai/modules.json, where `modules-map` checks it");
  out("  against make — so a wrong guess surfaces at the prove step rather than in the first round.");
}

// Claude caps a question widget at four shown at once, so a fifth would have its answer lost without
// saying so — which is why the count is checked there and a later addition announces itself. Codex
// and the neutral end have no such widget: the questions go out as prose, one round per message, and
// a hard ceiling would be inventing a limit their host does not have.
const PER_ROUND = target === "claude" ? 4 : null;
section(PER_ROUND ? `DECIDE — ask these in rounds, at most ${PER_ROUND} at a time, in this order` : "DECIDE — ask these in rounds, one round per message, in this order");
if (!decide.length) {
  out("  Nothing. Every decision this install needs is already on disk — go straight to apply.mjs,");
  out("  which will only refresh the definitions, or skip it if nothing needs upgrading.");
} else {
  ROUNDS.forEach((title, index) => {
    const asked = decide.filter(([round]) => round === index + 1).map(([, text]) => text);
    if (!asked.length) return;
    out();
    out(`  round ${index + 1} — ${title}`);
    asked.forEach((question, i) => out(`    ${i + 1}. ${question}`));
    if (PER_ROUND && asked.length > PER_ROUND) out(`    ! ${asked.length} questions here and the widget shows ${PER_ROUND}. Split this round rather than dropping the tail`);
  });
}

if (blocked.length) {
  section("BLOCKED — fix these before apply.mjs");
  blocked.forEach((b) => out(`  · ${b}`));
}

section("SUGGESTED — the apply line, once the answers are in");
const suggestion = [
  `node ${join(HERE, "apply.mjs")}`,
  `--target ${target}`,
  // A known value goes in bare. `--lang <zh-CN>` is not a placeholder a reader fills in — pasted into
  // a shell it is a redirection, which is the same mistake the Makefile placeholder used to make.
  lang ? `--lang ${lang}` : "--lang ZH-CN-OR-EN-US",
  missing.length ? `--install ${missing.join(",")}` : null,
  e2e === null ? "[--e2e]" : null,
].filter(Boolean).join(" ");
out(`  ${suggestion}`);
out();
if (suggestion.includes("[")) out("  Square brackets are the ones the ask step decides.");
if (missing.length) out("  Keep --install to whatever the user agreed to; drop the rest and let them install those.");
if (!lang) out("  Replace ZH-CN-OR-EN-US with the language the requirement briefs are written in.");
if (!suggestion.includes("[") && !missing.length && lang) out("  That line is ready as it stands.");
out("  Re-run this script afterwards rather than assuming it worked.");
out();

process.stdout.write(lines.join("\n"));
