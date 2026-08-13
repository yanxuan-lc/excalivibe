// What a plugin copy would install, as one hash over paths and bytes. Shared by detect.mjs, which
// compares it against what a project recorded, and apply.mjs, which writes that record.
//
// A signature rather than a version string, because a version is only as true as the last bump: two
// definitions edited between releases carry the same number, and an upgrade check that read the
// number would report nothing to do. What a signature cannot say is which side is newer — so the
// version rides along in the record for a person to read, and the signature decides.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const isDir = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };
const dirList = (path) => { try { return readdirSync(path); } catch { return null; } };

/** Every file under a directory, relative and sorted — the order a signature has to be stable across. */
export function treeFiles(root, base = root, found = []) {
  for (const entry of (dirList(root) ?? []).sort()) {
    const path = join(root, entry);
    if (isDir(path)) treeFiles(path, base, found);
    else found.push(relative(base, path));
  }
  return found.sort();
}

/** sha256 over every file's path and bytes. Returns null for a directory with nothing in it, which
 *  is a broken plugin copy rather than an empty install — the callers report it as such. */
export function signatureOf(root) {
  const files = treeFiles(root);
  if (!files.length) return null;
  const hash = createHash("sha256");
  for (const path of files) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(join(root, path)));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}
