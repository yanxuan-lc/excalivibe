// How this project is divided, as the project itself declares it.
//
// `tools/genai/modules.json` is a **structure declaration**, not a gate input. Nothing here decides
// a verdict from what a module contains — the build gate judges `make genai-build`'s exit code and
// the metrics gate judges the numbers, and neither reads this file. That distinction is what makes
// this the one project-supplied file **a round may edit**: adding a module is ordinary work, and a
// map that may not follow the code it describes is a map that goes stale by design. What guards it
// is the reviewer, not a gate, because removing a module from the map does not remove it from the
// build.
//
// Its readers are the steps themselves. A model told "this repository is web/typescript,
// service/go and agent/python, and web consumes service's contract" writes a different spec, puts
// code in a different place and reviews a different diff than one that has to infer the split from
// a directory listing. Everything in the schema is there because some step needs it:
//
//   path/language/role  what and where — every agent's project sense
//   depends_on          who consumes whose contract — the spec reviewer's dependency direction,
//                       and the code reviewer's "was the other side of this contract changed too"
//   docs                where this module's documentation lives — the documentation tree signature
//                       reads it, so a project keeping README.md per module is measured on those
//                       rather than on a `docs/` it does not have
//   targets             the Makefile targets that build, lint and test this module — the one place
//                       this file touches something executable, and the reason `modules-map` exists
//   version_files       optional: every file carrying this module's version number. Read by
//                       genai.release and by nothing here, which is why this reader neither requires
//                       nor validates it — an unknown key is not an error, and a release that
//                       discovers a fifth copy of the version adds it in the same commit
//
// `targets` names targets, never commands. A command here would be a second way to build the same
// module, and two ways to do one thing is one thing that can disagree with itself: the Makefile is
// where a project's commands already live, so this file points at them.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MAP = join("tools", "genai", "modules.json");

/** The declared target kinds. A module may name a target for each, or `null` where it has none. */
const KINDS = ["build", "lint", "test"];

/**
 * The parsed map, or a reason it cannot be used.
 *
 * Callers that only want the data — the documentation signature, say — take `map` and ignore
 * everything else; `judgeMap` is the same read with the verdict attached.
 */
export function readMap() {
  if (!existsSync(MAP)) return { label: "map_missing", facts: { file: MAP } };
  let raw;
  try {
    raw = JSON.parse(readFileSync(MAP, "utf8"));
  } catch (cause) {
    return { label: "map_malformed", facts: { file: MAP, reason: "not valid JSON", detail: String(cause?.message ?? cause) } };
  }

  const declared = raw?.modules;
  if (declared === null || typeof declared !== "object" || Array.isArray(declared)) {
    return { label: "map_malformed", facts: { file: MAP, reason: "`modules` must be an object keyed by module name", found: typeof declared } };
  }
  const names = Object.keys(declared);
  // The template ships with none, so this is also what an install whose build-out step has not run yet
  // reports. It is a setup problem either way, and the reason says which.
  if (names.length === 0) {
    return { label: "map_malformed", facts: { file: MAP, reason: "no modules are declared — a single-module project declares one module whose `path` is `.`" } };
  }

  const modules = {};
  for (const name of names) {
    const entry = declared[name];
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return { label: "map_malformed", facts: { file: MAP, module: name, reason: "each module must be an object" } };
    }
    for (const field of ["path", "language", "role"]) {
      if (typeof entry[field] !== "string" || entry[field] === "") {
        return { label: "map_malformed", facts: { file: MAP, module: name, reason: `\`${field}\` must be a non-empty string`, found: entry[field] ?? null } };
      }
    }
    const depends = entry.depends_on ?? [];
    if (!Array.isArray(depends) || depends.some((d) => typeof d !== "string")) {
      return { label: "map_malformed", facts: { file: MAP, module: name, reason: "`depends_on` must be an array of module names" } };
    }
    // A dangling name is worth refusing rather than ignoring: the code reviewer uses this edge to
    // decide whether a contract has another side, and an edge pointing nowhere silently removes
    // that question instead of answering it.
    const dangling = depends.filter((d) => !names.includes(d));
    if (dangling.length > 0) {
      return { label: "map_malformed", facts: { file: MAP, module: name, reason: "`depends_on` names a module that is not declared", dangling, declared: names } };
    }
    const docs = entry.docs ?? [];
    if (!Array.isArray(docs) || docs.some((d) => typeof d !== "string")) {
      return { label: "map_malformed", facts: { file: MAP, module: name, reason: "`docs` must be an array of paths" } };
    }
    const targets = entry.targets;
    if (targets === null || typeof targets !== "object" || Array.isArray(targets)) {
      return { label: "map_malformed", facts: { file: MAP, module: name, reason: "`targets` must be an object" } };
    }
    for (const kind of KINDS) {
      const value = targets[kind] ?? null;
      // `null` is how a module says it has no target of this kind — a Python package with nothing to
      // compile, a module with no tests yet. Omitting the key means the same thing. Both are visible
      // in the project's own file, which is the only place an exemption belongs.
      if (value !== null && (typeof value !== "string" || value === "")) {
        return { label: "map_malformed", facts: { file: MAP, module: name, reason: `\`targets.${kind}\` must be a target name or null`, found: value } };
      }
    }
    modules[name] = {
      name,
      path: entry.path,
      language: entry.language,
      role: entry.role,
      depends_on: depends,
      docs,
      targets: Object.fromEntries(KINDS.map((kind) => [kind, targets[kind] ?? null])),
    };
  }

  return { label: "ok", map: modules };
}

/**
 * The map, and whether the Makefile still has everything it points at.
 *
 * The two files are one declaration kept in two places, which is the shape that goes stale: a
 * module renamed in the Makefile and not here reads as a project that still builds. Asking make
 * itself is the only check that cannot drift — a grep for `^web-build:` misses `$(MODULES:%=%-build)`
 * and every other way a target gets generated.
 */
export function judgeMap() {
  const read = readMap();
  if (read.label !== "ok") return read;

  const wanted = [];
  for (const module of Object.values(read.map)) {
    for (const kind of KINDS) {
      const target = module.targets[kind];
      if (target !== null) wanted.push({ module: module.name, kind, target });
    }
  }

  const missing = [];
  for (const want of wanted) {
    const found = targetExists(want.target);
    if (found.exists) continue;
    missing.push({ ...want, reason: found.reason });
  }
  const facts = {
    file: MAP,
    modules: Object.fromEntries(Object.values(read.map).map((m) => [m.name, { path: m.path, language: m.language, depends_on: m.depends_on }])),
    checked: wanted.length,
  };
  if (missing.length > 0) return { label: "target_missing", facts: { ...facts, missing } };
  return { label: "consistent", facts };
}

/**
 * Whether make knows this target, without running it.
 *
 * `-n` prints a recipe instead of running it, and a target make has never heard of exits 2. The one
 * documented exception — make runs a line containing `$(MAKE)` even under `-n` — is not one here:
 * `-n` travels to the sub-make through MAKEFLAGS, so the recursion prints too.
 *
 * A target that exists but whose prerequisites cannot be resolved also exits 2, and is reported the
 * same way on purpose. The map points at something make cannot carry out either way, and make's own
 * message is in the facts.
 */
export function targetExists(target) {
  try {
    execFileSync("make", ["-n", "--no-print-directory", target], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { exists: true };
  } catch (cause) {
    const output = `${String(cause?.stdout ?? "")}${String(cause?.stderr ?? "")}`.trim();
    return { exists: false, reason: output.slice(0, 300) || String(cause?.message ?? cause) };
  }
}

/**
 * What the code review was about, narrowed to the product code this project declares.
 *
 * `genai.merge` premises the review against this instead of against the branch tip, and the
 * difference is the whole point. A tip signature says "some commit landed"; a round routinely lands
 * commits the review's subject does not include — a test the acceptance author repaired, a document
 * the writer updated — and every one of them used to invalidate an approval that was still true of
 * every line it had read. Measured: a round reached the merge with the product code untouched since
 * the approval and two commits against it, one test and one document.
 *
 * The narrowing is drawn from declarations the project already maintains, and from nothing else:
 * what the modules claim, minus the documentation those same modules point at. **A path no module
 * claims is not product code** — a top-level `e2e/` is outside every module's `path` by
 * construction, which is exactly the shape the incident above had.
 *
 * `HEAD`, not the working tree: a review is a statement about commits, and the uncommitted records
 * this flow deliberately leaves lying around are not part of what was approved.
 *
 * **A single-module project whose `path` is `.` gets no narrowing at all**, because everything is
 * claimed. That is a real limit and not a bug to work around here: such a project narrows this by
 * declaring the directory its source actually lives in, which is a one-line edit to its own map.
 *
 * Both unreadable cases hash their reason rather than throwing. A signature has to be defined for
 * the framework to compare anything, and hashing the reason gives the honest one: stable while the
 * map or the repository stays broken, and moving the moment it is repaired — which is the moment an
 * approval taken against it deserves to be taken again.
 */
export function productSignature() {
  const read = readMap();
  if (read.label !== "ok") return digest(`map-unreadable:${read.label}`);

  const modules = Object.values(read.map);
  const roots = [...new Set(modules.map((module) => module.path))].sort();
  const docs = [...new Set(modules.flatMap((module) => module.docs))];

  let listing;
  try {
    listing = execFileSync("git", ["ls-tree", "-r", "HEAD", "--", ...roots], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (cause) {
    return digest(`git-unreadable:${String(cause?.message ?? cause)}`);
  }

  // `<mode> <type> <object>\t<path>` per line. The object id is the content, already computed by
  // git, so nothing here opens a file.
  const entries = [];
  for (const line of listing.split("\n")) {
    const [meta, path] = line.split("\t");
    if (path === undefined || meta === undefined) continue;
    const object = meta.trim().split(/\s+/)[2];
    if (object === undefined) continue;
    if (docs.some((doc) => path === doc || path.startsWith(`${doc}/`))) continue;
    entries.push(`${object} ${path}`);
  }
  return digest(entries.sort().join("\n"));
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Documentation roots the project declares, across every module, or null when the map cannot be
 * read. Sorted and de-duplicated so the signature over them does not move when the map is reordered.
 */
export function docRoots() {
  const read = readMap();
  if (read.label !== "ok") return null;
  const roots = new Set();
  for (const module of Object.values(read.map)) for (const path of module.docs) roots.add(path);
  return [...roots].sort();
}
