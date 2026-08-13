// The state of the project's documentation, as one value.
//
// The documentation step produces the tree, not a commit — declaring the branch tip as its artifact
// would put two steps' outputs at one location, and then the presence check is satisfied by
// whichever wrote first while the second passes having done nothing. fsx reports that collision at
// load time (`node_output_collision`), which is how this shape was arrived at.
//
// There is no locator that reaches it cleanly either: a project may have no `docs/` at all on its
// first round, and a glob matching nothing reads as a missing artifact rather than as an empty one.
// So it is an `observed` artifact with a custom signature, the same shape `genai.accept` uses for
// the archive — measured by command rather than by path.
//
// **Where the documentation lives is the project's answer, not this file's.** A single `docs/` tree
// is one convention; a repository split into modules usually keeps a README beside each of them, and
// hard-coding `docs/` measures an empty tree there forever — a step that wrote three module READMEs
// would show no progress at all. So the roots come from `tools/genai/modules.json`, and `docs/`
// is what a project that has not said otherwise gets.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { docRoots } from "./modules.mjs";

const DEFAULT_ROOTS = ["docs"];

/**
 * Every documentation file, sorted, or an empty list when nothing declared is there yet.
 *
 * A root may be a directory or a single file, because both are how projects actually write this
 * down — `docs/` on one side, `web/README.md` on the other.
 *
 * An unreadable or absent map falls back to the default root rather than failing. This is a
 * signature, not a gate: the map has its own check with its own message, and making the
 * documentation step collapse on a JSON syntax error somewhere else would report the wrong problem.
 */
export function docFiles() {
  const roots = docRoots() ?? DEFAULT_ROOTS;
  const out = new Set();
  for (const root of roots.length > 0 ? roots : DEFAULT_ROOTS) walk(root, out);
  return [...out].sort();
}

/**
 * A hash over the documentation's paths and contents.
 *
 * Paths are in it as well as contents: moving a document changes what a reader can find without
 * changing a byte of prose, and a signature that cannot see the move would call that no progress.
 *
 * The field separator is NUL because no path and no file content can contain one, so two different
 * splits of the same bytes cannot collide. **Written as the escape `\x00`, never as a literal NUL
 * byte** — a source file carrying one is classified as binary by grep, git grep and most editors'
 * search, and then the whole file is silently invisible to the tool people look for it with.
 *
 * Nothing present hashes to the digest of the empty string rather than failing. A project whose
 * first round has not created its documentation yet is a normal state, not a broken one.
 */
export function treeSignature() {
  const hash = createHash("sha256");
  for (const path of docFiles()) {
    hash.update(path);
    hash.update("\x00");
    hash.update(readFileSync(path));
    hash.update("\x00");
  }
  return hash.digest("hex");
}

function walk(path, out) {
  if (!existsSync(path)) return;
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return;
  }
  if (!stat.isDirectory()) {
    out.add(path);
    return;
  }
  for (const entry of readdirSync(path)) walk(join(path, entry), out);
}
