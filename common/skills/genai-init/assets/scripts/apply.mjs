#!/usr/bin/env node
// The scaffold step of genai-init: do the file work. Every branch this takes was decided before it ran —
// by detect.mjs finding a file present or absent, or by the user answering a round of questions whose
// answer arrives here as a flag. It makes no judgement of its own, which is the point: the parts of
// this install that need judgement belong to the executor.
//
//   node <skill-dir>/assets/scripts/apply.mjs --target claude|codex|common --lang zh-CN [flags]
//
//   --install a,b,c   the GLOBAL binaries the user approved: fsx | openspec | mdxv
//   --lang <tag>      instruction_language: the language of the requirement briefs
//   --patience <n>    default 5
//   --budget <n>      default 50
//   --e2e             copy the tools/genai/e2e.json template. Whether the app runs today does not
//                     come into it — a project that will answer on a URL and one that will answer to
//                     a command both need the file; what may not be invented is what goes inside it
//   --sibling-git     also make the requirements directory its own git repository
//   --upgrade         replace definitions and evaluators, touch nothing else
//
// Four things happen on their own, with no flag and no question, because they are confined to this
// project and a project being set up wants all four: `git init` and an empty first commit where
// there is no repository, `fsx skill install` where the driving manual is absent, and `openspec init`
// where `openspec/` is. Only the three global binaries above are asked about, because installing one
// reaches outside this directory — it replaces whatever was on PATH, an npm-linked local checkout
// included, and says nothing about having done so.
//
// Idempotent, and that is what makes it the upgrade path too: re-running replaces the definitions
// wholesale and leaves every project-owned file alone. It refuses to run at all while a graph is
// live, because swapping a definition under a live run leaves that run measuring against a contract
// it was not created with.
//
// Exit code is 1 only when a step it was told to do did not happen. "Already there" is success.

import { execFileSync } from "node:child_process";
import { accessSync, constants, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { signatureOf } from "./lib/signature.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, "..", "..");
const ASSETS = join(SKILL, "assets");

const argv = process.argv.slice(2);
const flag = (name) => { const at = argv.indexOf(`--${name}`); return at === -1 ? undefined : argv[at + 1]; };
const has = (name) => argv.includes(`--${name}`);

// An unrecognised flag is a typo, and a silently ignored one is worse than a rejected one: `--e2ee`
// leaves no e2e.json and the log then explains its absence with "the app does not answer on a URL
// yet", which is a reason the caller never gave.
const KNOWN = ["target", "install", "lang", "patience", "budget", "e2e", "sibling-git", "upgrade"];
const strays = argv.filter((token) => token.startsWith("--")).map((token) => token.slice(2)).filter((name) => !KNOWN.includes(name));

const target = flag("target");
const install = (flag("install") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
// Global binaries only. What lands inside this project needs no permission of its own — the consent
// to run this install already covered it.
const INSTALLABLE = ["fsx", "openspec", "mdxv"];
const lang = flag("lang");
const patience = flag("patience") ?? "5";
const budget = flag("budget") ?? "50";
const upgrade = has("upgrade");

const log = [];
const did = (text) => log.push(`  ✓ ${text}`);
const skip = (text) => log.push(`  · ${text}`);
const warn = (text) => log.push(`  ! ${text}`);
const head = (text) => { log.push(""); log.push(text); };
let broken = 0;

function fail(message) {
  // Flush first. A caller that stops mid-run still has to be able to see which steps landed, because
  // the answer to "what do I do now" is "fix this and re-run", and that is only safe if the reader can
  // see where it stopped.
  if (log.length) process.stdout.write(`${log.join("\n")}\n\n`);
  process.stderr.write(`apply.mjs: ${message}\n`);
  process.exit(1);
}

// The one place the three ends differ. Everything else in this script is end-agnostic.
const TARGETS = {
  claude: { skill: "claude", openspec: "claude" },
  codex: { skill: "codex", openspec: "codex" },
  common: { skill: "generic", openspec: "agents" },
};
// Required rather than defaulted. A default of claude on a codex project would install the wrong
// host's skill and drop Claude command files into it, and nothing downstream would notice.
if (strays.length) fail(`unknown flag(s) --${strays.join(", --")}; this script takes only --${KNOWN.join(", --")}`);
if (!target) fail("--target is required: claude, codex or common. It decides which host the skill and the openspec command files are installed for.");
if (!TARGETS[target]) fail(`unknown --target ${target}; expected claude, codex or common`);
// A typo here would otherwise install nothing and report success, which is the one outcome that
// cannot be told apart from "the user said they would install it themselves".
const unknown = install.filter((name) => !INSTALLABLE.includes(name));
if (unknown.length) fail(`unknown --install ${unknown.join(", ")}; expected any of ${INSTALLABLE.join(", ")}`);
// Both land in config.yaml as YAML numbers. Unchecked, `--patience abc` writes a config fsx refuses to
// load, and it does that after reporting the write as a step that succeeded.
for (const [name, value] of [["patience", patience], ["budget", budget]]) {
  if (!/^[1-9][0-9]*$/.test(value)) fail(`--${name} must be a positive integer; got ${JSON.stringify(value)}. It is written into .flow/config.yaml as a number, and fsx refuses to load anything else.`);
}

function run(cmd, args, { allowFail = false } = {}) {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
  } catch (error) {
    const out = `${String(error.stdout ?? "")}${String(error.stderr ?? "")}`.trim() || String(error.message);
    if (!allowFail) { warn(`${cmd} ${args.join(" ")} failed: ${out.split("\n")[0]}`); broken += 1; }
    return { ok: false, out };
  }
}

const read = (path) => { try { return readFileSync(path, "utf8"); } catch { return null; } };
const isDir = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };
const dirList = (path) => { try { return readdirSync(path); } catch { return null; } };
const tracked = () => { const r = run("git", ["status", "--porcelain"], { allowFail: true }); return r.ok ? new Set(r.out.split("\n").filter(Boolean).map((l) => l.slice(3))) : new Set(); };

/** The plugin version this copy ships.
 *
 *  `assets/plugin-version.json` is stamped by the compiler, so it answers on every end — including
 *  `common`, which ships a bare `skills/<name>/` with no manifest anywhere above it and could
 *  otherwise only report a hash. The manifest walk behind it is for running straight out of `src/`,
 *  where the file still holds its uncompiled placeholder.
 *
 *  Either way the version is an annotation, not the upgrade decision: that rests on the signature. */
function shippedVersion() {
  try {
    const stamped = JSON.parse(readFileSync(join(ASSETS, "plugin-version.json"), "utf8")).version;
    if (stamped) return stamped;
  } catch { /* fall through to the manifests */ }
  for (const candidate of [
    join(SKILL, "..", "..", ".claude-plugin", "plugin.json"),
    join(SKILL, "..", "..", ".codex-plugin", "plugin.json"),
    join(SKILL, "..", "..", "plugin.json"),
    join(SKILL, "..", "..", "package.json"),
  ]) {
    try { return JSON.parse(readFileSync(candidate, "utf8")).version ?? null; } catch { /* try the next */ }
  }
  return null;
}

/** mkdir -p, but say which existing file is in the way rather than raising ENOTDIR from three frames down. */
function ensureDir(path) {
  for (const part of path.split("/").reduce((acc, p) => [...acc, acc.length ? `${acc[acc.length - 1]}/${p}` : p], [])) {
    if (existsSync(part) && !isDir(part)) fail(`${part} exists and is not a directory, so ${path} cannot be created. Move it aside and re-run.`);
  }
  mkdirSync(path, { recursive: true });
}

// Whatever goes wrong, the reader still gets the record of what already happened. Without this an
// unexpected throw exits on a stack trace and discards the entire log, leaving nobody able to tell
// which steps landed — and every step here is idempotent, so re-running is only safe if you can see
// where it stopped.
process.on("uncaughtException", (error) => {
  warn(`stopped early: ${error.message}`);
  log.push("", "Nothing after that point ran. Fix the cause and re-run — every step above is idempotent.");
  process.stdout.write(`${log.join("\n")}\n`);
  process.exit(1);
});

// ───────────────────────── guards ─────────────────────────

// This script calls fsx four times. If it is not here and nobody asked for it to be installed, say so
// now: the alternative is failing at `fsx init` two sections in, with half a log and a stack of
// follow-on errors that all have the same one cause.
if (!install.includes("fsx") && !run("fsx", ["--version"], { allowFail: true }).ok) {
  fail("fsx is not on PATH, and --install does not name it. Install it (npm i -g flow-scratch) or re-run with --install fsx.");
}

const status = run("fsx", ["status", "--json"], { allowFail: true });
if (status.ok) {
  let graphs = [];
  try { graphs = JSON.parse(status.out).graphs ?? []; } catch { /* an unparseable answer is not a live graph */ }
  if (graphs.length) fail(`${graphs.length} graph(s) are live. Replacing definitions under a live run leaves it measuring against a contract it was not created with — finish or abort the round first.`);
}

// --upgrade replaces what is already there and deliberately skips everything else — the Makefile, the
// thresholds, the engine defaults, the requirements directory. Run on a project with no install, that
// leaves definitions sitting in a `.flow/` with none of the rest, and reports success while the executor
// list it prints refers to a make target that does not exist.
if (upgrade) {
  const already = (dirList(".flow/nodes") ?? []).filter((n) => n.startsWith("genai."));
  if (!already.length) fail("--upgrade replaces definitions that are already installed, and this project has none. Drop --upgrade and pass --lang to run the full install.");
}

// Check this install's own files before touching the project's. A plugin copied incompletely — the
// scripts present, assets/flow/ missing — otherwise gets as far as scaffolding .flow/ and then dies on
// a scandir path, leaving a half-installed project and a message about someone else's directory.
for (const required of [["flow", "nodes"], ["flow", "genai"], ["flow", "workflows", "genai-sprint.yaml"], ["project", "makefile-head.mk"], ["project", "genai-metrics.mk"], ["project", "genai-build.mk"], ["project", "thresholds.json"], ["project", "modules.json"], ["project", "e2e.json"]]) {
  const path = join(ASSETS, ...required);
  if (!existsSync(path)) fail(`this install is incomplete: ${path} is missing. Reinstall the plugin rather than working around it.`);
}

// Writability, before any tool is handed the job. A read-only project directory otherwise reaches
// `fsx init`, which reports it as "flow-scratch internal error — please report this stack trace": a
// false alarm aimed at the wrong maintainer for a condition that has an obvious one-line explanation.
try { accessSync(".", constants.W_OK); } catch { fail(`this directory is not writable (${process.cwd()}), so nothing can be installed into it.`); }
const siblingPath = `../${basename(process.cwd())}_genai`;
if (!upgrade && !existsSync(siblingPath)) {
  try { accessSync("..", constants.W_OK); } catch { fail(`the parent directory is not writable, so the requirements directory ${siblingPath} cannot be created. It has to be a sibling — two gates locate it by that exact name.`); }
}

const before = tracked();

// ───────────────────────── 1. prerequisites ─────────────────────────

if (install.length) {
  head("prerequisites");
  // A global install replaces whatever was there, including an npm link to somebody's local
  // checkout, and prints nothing about it. So only ever install what was reported missing.
  if (install.includes("fsx")) {
    run("npm", ["i", "-g", "flow-scratch"]);
    const v = run("fsx", ["--version"], { allowFail: true });
    v.ok ? did(`fsx installed — ${v.out.split("\n")[0]}`) : (warn("fsx installed but does not answer --version"), (broken += 1));
  }
  if (install.includes("openspec")) {
    run("npm", ["i", "-g", "@fission-ai/openspec"]);
    const v = run("openspec", ["--version"], { allowFail: true });
    v.ok ? did(`openspec installed — ${v.out.split("\n")[0]}`) : (warn("openspec installed but does not answer --version"), (broken += 1));
  }
  if (install.includes("mdxv")) {
    // The npm package and the binary have different names, which is the whole reason `command -v
    // mdx-viewer` finds nothing on a machine that has it.
    run("npm", ["i", "-g", "mdx-viewer"]);
    const v = run("mdxv", ["--version"], { allowFail: true });
    v.ok ? did(`mdxv installed — ${v.out.split("\n")[0]}`) : (warn("mdx-viewer installed but mdxv does not answer --version"), (broken += 1));
  }
}

// ───────────────────────── 2. the repository ─────────────────────────
// Unconditional, and it needs no flag: a project being set up wants a repository, and both of these
// are confined to this directory.

head("repository");
// Ask git, not the filesystem. In a linked worktree `.git` is a *file*, so an isDir() test says "no
// repository here", runs git init against a perfectly good worktree, and reports creating a
// repository on main while the branch checked out is something else entirely.
if (run("git", ["rev-parse", "--show-toplevel"], { allowFail: true }).ok) skip("already a git repository");
else { run("git", ["init", "-b", "main"]); did("git repository created on main"); }

if (run("git", ["rev-parse", "HEAD"], { allowFail: true }).ok) skip("HEAD already exists");
else {
  // Several gates compare against HEAD and a repository with no commits has none. Nothing earlier
  // catches it: check.mjs worktree reports `clean` there, so a missing HEAD stays invisible until
  // the merge step measures its output at locator: HEAD.
  run("git", ["commit", "--allow-empty", "-m", "chore: init"]);
  did("empty first commit created — the gates that compare against HEAD now have one");
}

// ───────────────────────── 3. this project's own tooling ─────────────────────────
// Also unconditional, for the same reason, and after the repository so both land inside one.

head("this project's own tooling");

const SKILL_PATHS = {
  claude: ".claude/skills/flow-scratch/SKILL.md",
  codex: ".codex/skills/flow-scratch.md",
  common: "docs/flow-scratch-skill.md",
};
if (existsSync(SKILL_PATHS[target])) skip(`the flow-scratch skill is already installed for ${target}`);
else {
  // A refusal here is information: it means someone edited their copy, and replacing it is their
  // call. Report it and carry on rather than reaching for --force.
  const r = run("fsx", ["skill", "install", "--target", TARGETS[target].skill], { allowFail: true });
  if (r.ok) did(`flow-scratch skill installed for ${target}`);
  else { warn(`fsx skill install refused — someone may have edited their copy. Show them the diff before reaching for --force:\n      ${r.out.split("\n")[0]}`); broken += 1; }
}

if (isDir("openspec")) skip("openspec/ is already initialised");
else {
  // `--tools` and `--no-animation` keep it non-interactive; without them it waits for an answer
  // nobody is there to give.
  run("openspec", ["init", "--tools", TARGETS[target].openspec, "--no-animation"]);
  isDir("openspec") ? did("openspec initialised") : (warn("openspec init left no openspec/ directory"), (broken += 1));
}

const top = run("git", ["rev-parse", "--show-toplevel"], { allowFail: true });
if (!top.ok) fail("still not a git repository after `git init` — check what went wrong above before re-running.");
if (resolve(top.out) !== resolve(process.cwd())) fail(`run this from the repository root (${top.out}), not from a subdirectory.`);

// ───────────────────────── 4. .flow/ ─────────────────────────

head(".flow/");

// Check the collision before calling fsx: handed a `.flow` that is a file, fsx init fails with an
// internal stack trace, and that lands in the log above the one sentence that actually explains it.
if (existsSync(".flow") && !isDir(".flow")) fail(".flow exists and is not a directory. Move it aside and re-run.");
if (!isDir(".flow")) { run("fsx", ["init"]); isDir(".flow") ? did("fsx init scaffolded .flow/") : (warn("fsx init left no .flow/"), (broken += 1)); }
else skip(".flow/ already scaffolded");

// Copy the definitions, the evaluators they call by path, and the whitelist — always all three.
// A definition without its evaluator gates every attempt to `unexecutable`, and a step without its
// record template starts transcribing a format from memory.
ensureDir(".flow/nodes");
ensureDir(".flow/workflows");
const shipped = readdirSync(join(ASSETS, "flow", "nodes")).filter((n) => n.startsWith("genai."));
cpSync(join(ASSETS, "flow", "nodes"), ".flow/nodes", { recursive: true });
cpSync(join(ASSETS, "flow", "genai"), ".flow/genai", { recursive: true });
cpSync(join(ASSETS, "flow", "workflows", "genai-sprint.yaml"), ".flow/workflows/genai-sprint.yaml");

// Copying replaces; only removing retires. A `genai.*` directory that no longer ships is a step this
// plugin deleted, and leaving it behind is not harmless: it stays in `.flow/nodes/`, `fsx check`
// counts it, and one that disagrees with its own directory name takes the whole check to `ok: false`
// — permanently, since no later upgrade would touch it either.
//
// Only `genai.*` is ever removed. fsx's own `task/` and anything the project wrote itself live in the
// same directory and are none of this install's business.
did(`${shipped.length} genai.* definitions, .flow/genai/ evaluators and the genai-sprint whitelist copied`);
for (const retired of (dirList(".flow/nodes") ?? []).filter((n) => n.startsWith("genai.") && !shipped.includes(n))) {
  rmSync(join(".flow/nodes", retired), { recursive: true, force: true });
  did(`${retired} removed — it no longer ships with this plugin`);
}

// What was just installed, so a later run can tell whether this project is behind without diffing
// two trees. It has to be written AFTER the copy above: `.flow/genai/` is replaced wholesale, so a
// record written first is a record the next upgrade deletes.
//
// Not `.flow/config.yaml`. Both of fsx's config schemas are strict objects, so an unrecognised key
// there comes back from `fsx check` as `config_invalid` — an error rather than a warning, which
// takes `ok` to false, which section 9 below reads as a failed install. The record would make every
// run from then on report a break whose only cause is the record itself.
//
// A whole-file rewrite rather than an edit: fixed schema, no user content to preserve, so being
// idempotent costs nothing here.
const installedRecord = {
  signature: signatureOf(join(ASSETS, "flow")),
  version: shippedVersion(),
  target,
  nodes: shipped.slice().sort(),
  installed_at: new Date().toISOString(),
};
writeFileSync(".flow/genai/installed.json", `${JSON.stringify(installedRecord, null, 2)}\n`);
did(`.flow/genai/installed.json records signature ${installedRecord.signature?.slice(0, 19) ?? "NONE — this plugin copy has no flow assets"}…${installedRecord.version ? ` (version ${installedRecord.version})` : " (no version — running from an uncompiled source tree)"}`);

if (!upgrade) {
  // fsx writes an ignore for .flow/runs/ only, and its comment is right for definitions a project
  // wrote itself. These were not: they are versioned in the plugin that installs them, so committing
  // them puts a second copy of an already-versioned artifact into every consuming repository.
  const gitignore = read(".gitignore") ?? "";
  const OURS = [
    "# genai flow: the whole .flow/ tree is versioned in the plugin that installs it, not here.",
    "# Committing it would also make a branch switch change the engine's contract, and make every",
    "# definition edit dirty a working tree a passed review was recorded against.",
    ".flow/",
  ];
  // Once `.flow/` is ignored, leave the file alone entirely — however it got there, and wherever in
  // the file it sits. Rewriting it on a re-run would reorder lines the project has since added and
  // dirty a tracked file for no gain, and a dirty working tree is not free here: a commit made to
  // clear it during a review invalidates the verdict being recorded.
  // An ignore rule does nothing for a file git already tracks. A project installed by an earlier
  // generation committed .flow/, so the line below would be written, reported as done, and change
  // nothing: every definition edit still dirties the tree, and a commit made to clear it during a
  // review invalidates the verdict being recorded. Untracking is a git operation on someone else's
  // index, so say it rather than do it.
  const trackedFlow = run("git", ["ls-files", "--error-unmatch", ".flow"], { allowFail: true }).ok
    || run("git", ["ls-files", ".flow/"], { allowFail: true }).out.trim() !== "";
  if (trackedFlow) {
    warn("`.flow/` is already tracked by git, so ignoring it has no effect until it is untracked. The project owns that call:\n        git rm -r --cached .flow && git commit -m \"chore: stop tracking .flow/\"\n      Until then every definition edit dirties the working tree, and a commit that clears it mid-review invalidates the verdict being recorded.");
  }

  const ignored = gitignore.split("\n").some((l) => [".flow/", "/.flow/", ".flow"].includes(l.trim()));
  if (ignored) skip(".gitignore already ignores .flow/ — left untouched");
  else {
    // Strip fsx's block as well as any earlier, partial one of ours, so the file gains one block
    // rather than a second copy of the same comment.
    const DROP = [...OURS, "# flow-scratch runtime state", "# They grow with every run", "# The config.yaml / workflows/", ".flow/runs/"];
    const keep = gitignore.split("\n").filter((l) => !DROP.some((d) => l.trim().startsWith(d)));
    while (keep.length && keep[keep.length - 1].trim() === "") keep.pop();
    writeFileSync(".gitignore", `${[...(keep.length ? [...keep, ""] : []), ...OURS].join("\n")}\n`);
    did(".gitignore now ignores the whole .flow/ tree");
  }
}

// ───────────────────────── 5. engine defaults ─────────────────────────

if (!upgrade) {
  head("engine defaults");
  if (!lang) fail("--lang is required: instruction_language decides the language of every dispatched instruction, and therefore of the reports and documents executors write back.");
  // An edit, not a copy. fsx init wrote this file with its own explanatory comments and it may gain
  // keys in a later version; overwriting it with a template of ours would quietly delete both.
  let config = read(".flow/config.yaml");
  const wanted = { patience, instruction_language: lang, graph_budget: budget };
  if (config === null) {
    config = `defaults:\n${Object.entries(wanted).map(([k, v]) => `  ${k}: ${v}`).join("\n")}\n`;
    writeFileSync(".flow/config.yaml", config);
    did("config.yaml was absent (fsx allows that) — written with the three defaults");
  } else {
    const changed = [];
    for (const [key, value] of Object.entries(wanted)) {
      const line = new RegExp(`^(\\s*)${key}:[ \\t]*(.+?)[ \\t]*$`, "m");
      const hit = config.match(line);
      if (hit) {
        if (hit[2] !== String(value)) { config = config.replace(line, `$1${key}: ${value}`); changed.push(`${key}: ${hit[2]} → ${value}`); }
      } else if (/^defaults:\s*$/m.test(config)) {
        config = config.replace(/^defaults:\s*$/m, `defaults:\n  ${key}: ${value}`);
        changed.push(`${key}: ${value} (the key was absent — inserted rather than assumed)`);
      } else { config += `\ndefaults:\n  ${key}: ${value}\n`; changed.push(`${key}: ${value} (no defaults block — appended)`); }
    }
    if (changed.length) { writeFileSync(".flow/config.yaml", config); changed.forEach((c) => did(`config.yaml ${c}`)); }
    else skip("config.yaml already has all three values");
  }
}

// ───────────────────────── 6. the Makefile, which the executor writes ─────────────────────────
// It used to append two targets here. It no longer writes this file at all, for two reasons that
// turned out to be the same reason.
//
// The recipes need judgement. `genai-build` on a repository of several modules is a list of that
// project's own module targets, and `genai-metrics` has to read whatever machine-readable reporter
// this project's runner happens to produce. Neither is something a template knows. Appending a
// placeholder only moved the work later while leaving two targets that fail by construction.
//
// And appending to an existing Makefile is not safe in general. A project's own file has includes,
// variables, `.PHONY` conventions, a default goal, sometimes already a target of that name — and
// every one of those collides quietly. A script may only touch a file it can modify idempotently or
// detect its way around first; this one is neither, so it goes to the executor that can read it.
//
// The three .mk files under assets/project/ stay where they are and change role: they are the
// reference the executor writes from, not something copied into place.

if (!upgrade) {
  head("Makefile");
  if (existsSync("Makefile")) {
    const existing = read("Makefile") ?? "";
    const have = ["genai-build", "genai-metrics"].filter((t) => new RegExp(`^${t}:`, "m").test(existing));
    skip(`Makefile exists and is untouched — ${have.length ? `it already declares ${have.join(" and ")}` : "neither genai target is declared yet"}. Writing them is the executor's step, from assets/project/*.mk`);
  } else {
    skip("no Makefile — the executor writes one, head included, from assets/project/makefile-head.mk");
  }
}

// ───────────────────────── 7. tools/genai/ ─────────────────────────

if (!upgrade) {
  head("tools/genai/");
  ensureDir("tools/genai");
  if (!existsSync("tools/genai/thresholds.json")) {
    cpSync(join(ASSETS, "project", "thresholds.json"), "tools/genai/thresholds.json");
    did("thresholds.json copied — the floors a project starting from nothing should have; the executor agrees the numbers against what the project measures");
  } else skip("thresholds.json already there — a round may not edit it, so neither does this");

  // The one project-supplied file a round MAY edit — it declares structure and no gate judges by it —
  // so an existing one is left alone because it is the project's current answer, not because editing
  // it is forbidden.
  if (!existsSync("tools/genai/modules.json")) {
    cpSync(join(ASSETS, "project", "modules.json"), "tools/genai/modules.json");
    did("modules.json copied — it declares NO modules yet, which the modules-map check reports until the executor fills it in");
  } else skip("modules.json already there — left as the project's own description of itself");

  // Report on the file, not on the flag: on a re-run without --e2e the file may already be there and
  // filled in, and "not written" would read as "absent".
  if (existsSync("tools/genai/e2e.json")) skip("e2e.json already there — a round may not write it, so neither does this");
  else if (has("e2e")) {
    cpSync(join(ASSETS, "project", "e2e.json"), "tools/genai/e2e.json");
    did("e2e.json copied — its `contains` deliberately cannot match anything until the executor replaces it");
  } else skip("e2e.json not written — pass --e2e to write the template. A project that will answer on a URL and one that will answer to a command both need this file; what must not be invented is the URL or the marker inside it");
}

// ───────────────────────── 8. the requirements directory ─────────────────────────

if (!upgrade) {
  head("requirements directory");
  const sibling = siblingPath;
  // The name is load-bearing: gate commands receive no variables, so two gates locate this as
  // `../$(basename "$PWD")_genai`. A different name breaks both of them silently.
  const made = !isDir(sibling);
  ensureDir(join(sibling, "backlogs"));
  ensureDir(join(sibling, "archive"));
  made ? did(`${sibling}/{backlogs,archive} created — a SIBLING of this repository, not inside it`) : skip(`${sibling} already there`);
  if (has("sibling-git") && !isDir(join(sibling, ".git"))) {
    run("git", ["-C", sibling, "init", "-b", "main"]);
    did(`${sibling} is now its own git repository`);
  }
}

// ───────────────────────── 9. what an upgrade backfills ─────────────────────────
// An upgrade refreshes the definitions, and a refreshed definition can gate on something the
// project has never been asked for. That is what happened when the build gate and the module map
// arrived: an install from before them would come back with `target_missing` at genai.implement and
// `map_missing` at genai.spec, on a project whose only mistake was being installed earlier.
//
// So an upgrade adds what is absent and touches nothing that is present. Both land as placeholders
// for the same reason they do on a fresh install — there is no way to guess a project's build
// command or its module split, and a plausible guess that validates is worse than an empty one that
// says so.

if (upgrade) {
  head("upgrade backfill (only what the new definitions require and this project lacks)");
  let backfilled = 0;
  const forExecutor = [];

  // A Makefile target the new definitions gate on is reported, never appended — same reason as
  // section 5. On an upgrade the reporting is the whole of the job anyway: what an upgrade must not
  // do is let a project reach its next round not knowing a new gate arrived.
  const makefile = existsSync("Makefile") ? read("Makefile") ?? "" : null;
  if (makefile === null) forExecutor.push("there is no Makefile at all, so neither genai target exists — this project wants a full install, not an upgrade");
  else for (const target of ["genai-build", "genai-metrics"]) {
    if (!new RegExp(`^${target}:`, "m").test(makefile)) forExecutor.push(`${target} is not declared — its gate reports target_missing until the executor writes the recipe`);
  }

  if (!existsSync("tools/genai/modules.json")) {
    ensureDir("tools/genai");
    cpSync(join(ASSETS, "project", "modules.json"), "tools/genai/modules.json");
    did("modules.json copied — it declares NO modules, so genai.spec refuses to start until someone describes the project's split");
    backfilled += 1;
  }

  if (backfilled === 0 && !forExecutor.length) skip("nothing to backfill — this project already has everything the current definitions gate on");
  if (backfilled) warn("the backfilled files are placeholders. Fill them BEFORE the next round starts, or that round refuses at its first step.");
  for (const line of forExecutor) warn(line);
  if (forExecutor.length) log.push("      A new definition gates on something this project was never asked for. Write it before the next round starts.");
}

// ───────────────────────── 10. verify the shape ─────────────────────────
// Only the shape. Whether the numbers are right is the executor.s question, and it cannot be asked until
// the metrics recipe exists.

head("verification (shape only — the content is the executor's)");

const check = run("fsx", ["check", "--json"], { allowFail: true });
if (check.ok || check.out) {
  let parsed = null;
  try { parsed = JSON.parse(check.out); } catch { /* fall through to the raw output */ }
  // Print problems[] verbatim and judge none of them: severity is fsx's to assign and the content is
  // the reader's to act on. But `ok` is a fact worth carrying into the exit code — a warning leaves it
  // true, so `ok: false` means fsx found something it calls an error, and an install that ends on one
  // must not report success.
  if (parsed === null) {
    warn(`fsx check did not return parseable JSON:\n${check.out.split("\n").slice(0, 10).map((l) => `      ${l}`).join("\n")}`);
    broken += 1;
  } else if (!Array.isArray(parsed.problems)) {
    warn(`fsx check answered without a problems list, so nothing here was verified: ${check.out.slice(0, 300)}`);
    broken += 1;
  } else if (parsed.problems.length) {
    warn(`fsx check reports ${parsed.problems.length} problem(s)${parsed.ok === false ? " including at least one it calls an ERROR" : " — all warnings, which leave ok true"}:`);
    parsed.problems.forEach((p) => log.push(`      ${JSON.stringify(p)}`));
    if (parsed.ok === false) broken += 1;
  } else did("fsx check: no problems reported");
}

// The judgement is this listing against the directory, never either against a number. `fsx check`
// cannot serve here: it counts every definition on disk, including the template node fsx init
// scaffolds, so its totals always come out higher than this workflow's.
const nodes = run("fsx", ["nodes", "-w", "genai-sprint", "--json"], { allowFail: true });
if (!nodes.ok) { warn(`fsx nodes -w genai-sprint failed — the definitions are on disk but cannot be resolved against the whitelist:\n      ${nodes.out.split("\n")[0]}`); broken += 1; }
else {
  let listed = null;
  try { listed = (JSON.parse(nodes.out).nodes ?? []).map((n) => n.id); } catch { /* handled below */ }
  const absent = listed === null ? null : shipped.filter((n) => !listed.includes(n));
  if (absent === null) { warn(`fsx nodes returned no parseable JSON — verify by hand:\n      ${nodes.out.split("\n")[0]}`); broken += 1; }
  else if (absent.length) { warn(`copied but not resolvable: ${absent.join(", ")} — a broken install, not something to work around`); broken += 1; }
  else did(`fsx nodes -w genai-sprint resolves all ${shipped.length} copied definitions`);
}

// ───────────────────────── what appeared, and what is left ─────────────────────────

const after = tracked();
const appeared = [...after].filter((p) => !before.has(p)).sort();
if (appeared.length) {
  head("new in the working tree");
  // openspec init writes more than openspec/: given --tools it also drops command and skill files
  // wherever this host keeps them. Those files are the project's, not this flow's, so the user
  // decides what to track — this only makes sure nothing appeared unannounced.
  appeared.forEach((p) => log.push(`      ${p}`));
}

head("NEXT — the steps that need an executor and not a script");
log.push("  1. Write the Makefile. This script no longer touches it: the recipes describe THIS project's");
log.push("     modules, and appending to somebody's existing file collides with their includes, their");
log.push("     variables and their default goal. Write from assets/project/*.mk as the reference.");
log.push("       · head        — .DEFAULT_GOAL := help, so the bare command shows help");
log.push("       · genai-build — the compiler, or the type checker where there is none. NO `-` prefix on");
log.push("                       any line; on several modules, their own targets as prerequisites.");
log.push("       · genai-metrics — read a machine-readable reporter (JSON, JUnit, lcov summary), never a");
log.push("                       human-readable table. This one DOES take `-` on the line that runs the");
log.push("                       suite — the opposite of genai-build.");
log.push("     An existing Makefile keeps its own head and its own default goal.");
log.push("  2. Describe the project in tools/genai/modules.json — one entry per module, `path` `.` for a");
log.push("     project that is one module. `targets` names Makefile targets, never commands.");
log.push("  3. Agree the coverage floors, PER MODULE, and MEASURE FIRST — a round may not edit that file,");
log.push("     so a floor above reality rejects every round with nothing able to fix it.");
log.push("       { \"coverage\": { \"server\": { \"lines\": 0.8 }, \"core\": { \"lines\": 0.9, \"branches\": 0.85 } } }");
log.push("     A module left out is not coverage-checked — that is how a client covered by its e2e suite");
log.push("     is declared. A dimension left out of a module's entry is not checked for that module,");
log.push("     which is how Go declares that its cover reports statements and nothing else. A module");
log.push("     that IS listed has to report tests, or the gate reads it as no_tests.");
log.push("  4. Fill tools/genai/e2e.json — url or command, plus a `contains` marker only");
log.push("     this build returns.");
log.push("  5. Prove it — ONE command says whether this install is done:");
log.push("       node .flow/genai/check.mjs install-ready  → ready | unfinished | broken");
log.push("     `ready` is the only verdict that means done. `unfinished` lists what is still to be");
log.push("     written; `broken` means something already there contradicts itself. A green board is");
log.push("     NOT the criterion — no_tests and tests_failing are both acceptable at install time,");
log.push("     and install-ready is what knows that. The individual checks carry the detail:");
log.push("       make genai-build · make genai-metrics");
log.push("       check.mjs modules-map · build-ok · metrics · app-identity");
log.push("  6. Commit the baseline explicitly — Makefile, tools/genai, openspec/config.yaml, .gitignore,");
log.push("     AND every source file step 4 wrote: the modules, the e2e directory, the scripts, the");
log.push("     lockfiles. On a greenfield project the skeleton IS part of this baseline — left");
log.push("     untracked it drifts into genai.merge's commit, and the first code review never sees");
log.push("     where the project started. Not `git add -A`, which sweeps in whatever else is lying around.");

process.stdout.write(`${log.join("\n")}\n`);
process.exit(broken ? 1 : 0);
