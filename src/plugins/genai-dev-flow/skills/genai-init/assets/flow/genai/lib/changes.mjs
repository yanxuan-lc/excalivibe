// What openspec has on disk: the changes still open, and the spec deltas inside them.
//
// `archive/` is excluded everywhere. It holds finished rounds, and counting it would let a past
// round satisfy a check about this one.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CHANGES = join("openspec", "changes");
const ARCHIVE = "archive";

/** Change ids still open, or null when openspec/changes/ does not exist. */
export function openChanges() {
  if (!existsSync(CHANGES)) return null;
  return readdirSync(CHANGES)
    .filter((name) => name !== ARCHIVE)
    .filter((name) => statSync(join(CHANGES, name)).isDirectory())
    .sort();
}

/** Spec delta files under the open changes, or null when openspec/changes/ does not exist. */
export function specDeltas() {
  const open = openChanges();
  if (open === null) return null;
  const out = [];
  for (const id of open) out.push(...specDeltasOf(id));
  return out;
}

/**
 * Spec delta files under one open change.
 *
 * The per-change version exists because the e2e contract is per change: a change's scenario ids,
 * its manifest and its report all have to line up with each other, and an id set flattened across
 * the round cannot say which change an unaccounted id belongs to.
 */
export function specDeltasOf(change) {
  const out = [];
  walk(join(CHANGES, change, "specs"), out);
  return out;
}

/** Where this change's e2e records live. Both are written by a step, neither is committed by one. */
export function genaiDir(change) {
  return join(CHANGES, change, "genai");
}

/** Every file under the open changes — what a cross-reference search reads. */
export function changeFiles() {
  const open = openChanges();
  if (open === null) return null;
  const out = [];
  for (const id of open) walk(join(CHANGES, id), out);
  return out;
}

function walk(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
}
