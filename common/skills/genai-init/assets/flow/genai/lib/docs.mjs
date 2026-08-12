// The state of the project's documentation tree, as one value.
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

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "docs";

/** Every documentation file, sorted, or an empty list when the tree is not there yet. */
export function docFiles() {
  const out = [];
  walk(ROOT, out);
  return out.sort();
}

/**
 * A hash over the tree's paths and contents.
 *
 * Paths are in it as well as contents: moving a document changes what a reader can find without
 * changing a byte of prose, and a signature that cannot see the move would call that no progress.
 *
 * The field separator is NUL because no path and no file content can contain one, so two different
 * splits of the same bytes cannot collide. **Written as the escape `\x00`, never as a literal NUL
 * byte** — a source file carrying one is classified as binary by grep, git grep and most editors'
 * search, and then the whole file is silently invisible to the tool people look for it with.
 *
 * An absent tree hashes to the digest of the empty string rather than failing. A project whose
 * first round has not created `docs/` yet is a normal state, not a broken one.
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

function walk(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
}
