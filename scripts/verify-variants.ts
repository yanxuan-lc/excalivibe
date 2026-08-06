#!/usr/bin/env node
/**
 * Structural integrity check for variant blocks.
 *
 * The compile cannot catch a mis-nested variant boundary. If `<!--@claude-->` opens one level too
 * early, one end silently loses a whole section: the artifacts are still generated verbatim from
 * the source, the round-trip is still byte-identical, and nothing fails. The source itself is what
 * is wrong.
 *
 * That failure has a clear signature: **one end has a section with no counterpart on another end.**
 * Deliberate divergence normally comes in matched pairs (claude "detect claude --chrome" ↔ codex
 * "capability discovery"); an accidental loss shows up as an **orphan heading**.
 *
 * The verdict is not "an orphan is a bug" — some sections legitimately belong to one end only (a
 * Claude-side hooks section has no Codex counterpart by construction). So every orphan has to be
 * **registered individually, with a reason, in `src/variant-exceptions.json`**. That turns
 * divergence into a reviewed declaration instead of an accident of the compile.
 *
 * Unlike comparing the artifact trees, this renders each end from the source, so it does not care
 * that the three ends lay their files out differently.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ENDS, renderFor, type End } from '../src/common.ts';
import * as ui from './ui.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const R = (...p: string[]): string => path.join(ROOT, ...p);
const EXCEPTIONS = R('src', 'variant-exceptions.json');

interface Exception {
  heading: string;
  reason: string;
}
/** source path (relative to src/) → end → the orphan headings deliberately kept there */
type ExceptionFile = Record<string, Partial<Record<End, Exception[]>>>;

function walk(dir: string, base: string = dir, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, acc);
    else acc.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return acc;
}

/** Collect headings; **strip fenced code blocks first** — a `#` in there is a shell comment. */
const headings = (text: string): string[] =>
  [...text.replace(/^```[\s\S]*?^```/gm, '').matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => (m[1] as string).trim());

/** Normalize to "are these two headings about the same thing": drop parentheticals and end names. */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, '')
    .replace(new RegExp(`\\b(${ENDS.join('|')})\\b`, 'g'), '')
    .replace(/[^a-z0-9一-龥]/g, '');

const allow: ExceptionFile = fs.existsSync(EXCEPTIONS)
  ? (JSON.parse(fs.readFileSync(EXCEPTIONS, 'utf8')) as ExceptionFile)
  : {};

const findings: [string, End, string][] = [];
const stale: [string, End, string][] = [];
let registered = 0;

for (const rel of walk(R('src')).filter((r) => r.endsWith('.md')).sort()) {
  const text = fs.readFileSync(R('src', rel), 'utf8');
  if (!text.includes('<!--@')) continue; // no variants ⇒ every end is identical by construction

  /** end → normalized heading → the heading as written */
  const per = new Map<End, Map<string, string>>(
    ENDS.map((e) => [e, new Map(headings(renderFor(text, e)).map((h) => [norm(h), h]))])
  );

  const declared = allow[rel] ?? {};
  for (const end of ENDS) {
    const mine = per.get(end) as Map<string, string>;
    const orphans = [...mine.entries()]
      .filter(([n]) => ENDS.some((other) => other !== end && !(per.get(other) as Map<string, string>).has(n)))
      .map(([, h]) => h);
    const ok = declared[end] ?? [];
    for (const h of orphans) {
      if (ok.some((d) => d.heading === h)) registered++;
      else findings.push([rel, end, h]);
    }
    // A registered exception that no longer matches anything is a stale divergence claim, and is
    // as misleading as a missing one.
    for (const d of ok) if (!orphans.includes(d.heading)) stale.push([rel, end, d.heading]);
  }
}

if (findings.length || stale.length) {
  const summary: string[] = [];
  if (findings.length) {
    summary.push(`${findings.length} unregistered orphan section(s)`);
    ui.list(
      findings.map(([rel, end, h]) => `src/${rel}\n      ${end} only: ${h}`),
      '~'
    );
  }
  if (stale.length) {
    summary.push(`${stale.length} exception(s) matching no orphan`);
    ui.list(
      stale.map(([rel, end, h]) => `src/${rel} · ${end} · ${h}`),
      '?'
    );
  }
  ui.step(false, `variant sections diverge across ends — ${summary.join(', ')}`);
  ui.next(
    ...(findings.length
      ? [
          'usually a variant block nested at the wrong boundary, costing one end a whole section',
          'if the divergence is deliberate, register it in src/variant-exceptions.json with a reason',
        ]
      : []),
    ...(stale.length ? ['delete the exception — what it covered is no longer an orphan'] : [])
  );
  process.exit(1);
}
ui.step(
  true,
  `variant sections aligned across ends — ${registered} registered deliberate divergence${registered === 1 ? '' : 's'}`
);
