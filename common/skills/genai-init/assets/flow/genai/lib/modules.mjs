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
//
// `targets` names targets, never commands. A command here would be a second way to build the same
// module, and two ways to do one thing is one thing that can disagree with itself: the Makefile is
// where a project's commands already live, so this file points at them.

import { execFileSync } from "node:child_process";
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
  // The template ships with none, so this is also what an install that has not reached phase 4 yet
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
