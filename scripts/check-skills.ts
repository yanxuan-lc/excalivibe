#!/usr/bin/env node
/**
 * Two checks over the **emitted** skills and agents, not the source.
 *
 * Running on the artifacts is the point: a per-end description or a variant block can turn a fine
 * source into a broken one on exactly one end, and a source file that reads as 300 lines holds all
 * three ends' text at once — neither problem is visible from `src/`.
 *
 *   1. frontmatter is a valid YAML subset (zero dependencies; the accepted subset is tiny)
 *   2. a rendered SKILL.md stays inside its context budget
 *
 * The budget exists because SKILL.md is loaded in full the moment a skill triggers, while
 * `references/` is loaded only when the body sends the model there. A long SKILL.md therefore
 * spends context on every invocation to carry material most invocations do not need. 500 lines is
 * the point past which that trade has clearly gone wrong — split the detail into `references/` and
 * leave a pointer saying when to read it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ui from './ui.ts';

/** Lines of rendered SKILL.md past which the body should have been split into references/. */
const SKILL_LINE_BUDGET = 500;

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const isAgent = (f: string): boolean => f.split(path.sep).includes('agents') && f.endsWith('.md');
const all = ['claude', 'codex', 'common'].flatMap((r) => walk(r));
const skills = all.filter((f) => path.basename(f) === 'SKILL.md').sort();
const files = [...skills, ...all.filter((f) => isAgent(f) && path.basename(f) !== 'README.md')].sort();

const bad: [string, string][] = [];

for (const f of files) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(f, 'utf8'));
  if (!m) {
    bad.push([f, 'no frontmatter']);
    continue;
  }
  const keys = new Set<string>();
  for (const line of (m[1] as string).split('\n')) {
    if (!line.trim()) continue;
    const kv = /^([A-Za-z_][\w-]*):\s*([\s\S]*)$/.exec(line);
    if (!kv) {
      bad.push([f, `not a key: value pair — ${line.slice(0, 50)}`]);
      break;
    }
    const key = kv[1] as string;
    const value = kv[2] as string;
    if (keys.has(key)) {
      bad.push([f, `duplicate key ${key}`]);
      break;
    }
    keys.add(key);
    // A ": " inside a bare scalar makes YAML read it as a nested mapping
    if (!/^["']/.test(value) && /:\s/.test(value)) {
      bad.push([f, `the bare value of ${key} contains ": ", which YAML fails to parse — quote it or use a dash instead`]);
      break;
    }
  }
  for (const need of ['name', 'description']) {
    if (!keys.has(need)) bad.push([f, `required key ${need} is missing`]);
  }
}

const over: [string, number][] = [];
for (const f of skills) {
  const n = fs.readFileSync(f, 'utf8').split('\n').length;
  if (n > SKILL_LINE_BUDGET) over.push([f, n]);
}

if (bad.length || over.length) {
  const summary: string[] = [];
  if (bad.length) {
    summary.push(`${bad.length} frontmatter block(s) invalid`);
    ui.list(
      bad.map(([f, e]) => `${f}\n      ${e}`),
      '~'
    );
  }
  if (over.length) {
    summary.push(`${over.length} SKILL.md over the ${SKILL_LINE_BUDGET}-line budget`);
    ui.list(
      over.map(([f, n]) => `${f} — ${n} lines`),
      '~'
    );
  }
  ui.step(false, summary.join(', '));
  ui.next(
    ...(bad.length ? ['quote the value, or replace the ": " inside it — the emitted frontmatter must parse'] : []),
    ...(over.length
      ? ['move detail into references/ and leave a pointer — SKILL.md loads in full on every trigger, references/ only when the body points there']
      : [])
  );
  process.exit(1);
}
ui.step(true, `frontmatter valid — ${files.length} block(s), ${skills.length} SKILL.md within budget`);
