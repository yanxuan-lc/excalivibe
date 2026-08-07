#!/usr/bin/env node
/**
 * Every JSON in `src/` parses, and the graph skeletons refer only to themselves.
 *
 * Most JSON here is read by the compile, so a broken one already fails `make build`. A handful is
 * not: hook registrations and the graph skeletons are **copied verbatim** into all three ends.
 * Nothing on this side ever parses them, so a trailing comma reaches a user's project and surfaces
 * as the host silently ignoring a hook, or `fsx graph create` refusing a file the user did not
 * write.
 *
 * The skeletons get one check beyond parsing, because parsing is not the failure that happens to
 * them: **every edge endpoint has to be a node declared in the same file.** A renamed instance
 * leaves the old id behind on an edge, the file still parses, and the graph is created with a step
 * nothing routes to — which reads as the run mysteriously stopping, two commands later, with
 * nothing pointing back here. This is the only structural rule worth holding: the rest — whether a
 * step exists, whether the variables resolve — belongs to the engine, which owns those definitions
 * and checks them at `graph create`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ui from './ui.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

interface Skeleton {
  nodes?: { id?: string }[];
  edges?: { from?: string; to?: string }[];
}

function walk(dir: string, base: string = dir, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, acc);
    else if (p.endsWith('.json')) acc.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return acc;
}

const problems: string[] = [];
const files = walk(SRC).sort();
let skeletons = 0;

for (const rel of files) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(path.join(SRC, rel), 'utf8'));
  } catch (e) {
    problems.push(`src/${rel} — ${(e as Error).message}`);
    continue;
  }

  if (!/\/assets\/graphs\/[^/]+\.json$/.test(rel)) continue;
  skeletons++;

  const g = parsed as Skeleton;
  const declared = new Set((g.nodes ?? []).map((n) => n.id));
  for (const [i, e] of (g.edges ?? []).entries()) {
    for (const end of ['from', 'to'] as const) {
      const id = e[end];
      if (id !== undefined && !declared.has(id)) {
        problems.push(`src/${rel} — edges[${i}].${end} is "${id}", which no node in this file declares`);
      }
    }
  }
}

if (problems.length) {
  ui.list(problems, '~');
  ui.step(false, `${problems.length} broken JSON source${problems.length === 1 ? '' : 's'}`);
  ui.next('these ship verbatim — nothing downstream parses them before a user does');
  process.exit(1);
}

ui.step(true, `every JSON parses — ${files.length} file${files.length === 1 ? '' : 's'}, ${skeletons} graph skeleton${skeletons === 1 ? '' : 's'} referentially whole`);
