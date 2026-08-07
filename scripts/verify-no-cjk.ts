#!/usr/bin/env node
/**
 * The model-facing corpus stays in one language.
 *
 * Everything under `src/` is English — skills, agent definitions, node briefs, gate messages, the
 * strings the scripts print. What a *person* reads is written in their language instead, and which
 * language that is gets decided at run time by the host's own setting, not by whatever happened to
 * be typed into a source file here.
 *
 * Why this needs a checker rather than a line in AGENTS.md: the corpus was translated once, in
 * full. Without something that fails the build, the next hurried edit adds one Chinese sentence,
 * the one after adds three, and within a year the rule is folklore. A convention nobody can break
 * by accident is the only kind that survives.
 *
 * Legitimate exceptions exist and are not rare — a skill description carrying Chinese trigger
 * phrases is the whole reason the description routes a Chinese request at all. They live in
 * `src/cjk-exceptions.json`, one entry per file with a reason, so keeping Chinese somewhere is a
 * decision on the record rather than an oversight. **Stale entries fail too**: an exception that
 * no longer covers anything claims a divergence that is not there, which is as misleading as an
 * unregistered one.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ui from './ui.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const EXCEPTIONS = path.join(SRC, 'cjk-exceptions.json');

/** CJK ideographs plus the fullwidth punctuation that always travels with them. */
const CJK = /[　-〿㐀-䶿一-鿿！-｠]/;

/** Binary files have no language to be wrong about; this is the set worth reading. */
const TEXTUAL = new Set(['.md', '.mdx', '.json', '.ts', '.js', '.mjs', '.sh', '.py', '.toml', '.yaml', '.yml', '.txt']);

/** source path relative to `src/` → why Chinese is allowed to stay there */
type ExceptionFile = Record<string, string>;

function walk(dir: string, base: string = dir, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, acc);
    else if (TEXTUAL.has(path.extname(p))) acc.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return acc;
}

const allow: ExceptionFile = fs.existsSync(EXCEPTIONS)
  ? (JSON.parse(fs.readFileSync(EXCEPTIONS, 'utf8')) as ExceptionFile)
  : {};

const found = new Map<string, number[]>();
for (const rel of walk(SRC).sort()) {
  if (rel === 'cjk-exceptions.json') continue; // it exists to describe Chinese; its reasons may quote it
  const lines = fs.readFileSync(path.join(SRC, rel), 'utf8').split('\n');
  const hits = lines.flatMap((l, i) => (CJK.test(l) ? [i + 1] : []));
  if (hits.length) found.set(rel, hits);
}

const unregistered = [...found.keys()].filter((f) => !(f in allow));
const stale = Object.keys(allow).filter((f) => !found.has(f));

if (unregistered.length || stale.length) {
  const summary: string[] = [];
  if (unregistered.length) {
    summary.push(`${unregistered.length} file(s) with unregistered Chinese`);
    ui.list(
      unregistered.map((f) => `src/${f} — line ${(found.get(f) as number[]).slice(0, 6).join(', ')}`),
      '~'
    );
  }
  if (stale.length) {
    summary.push(`${stale.length} exception(s) covering no Chinese`);
    ui.list(
      stale.map((f) => `src/${f} — ${allow[f] as string}`),
      '?'
    );
  }
  ui.step(false, `src/ is not one language — ${summary.join(', ')}`);
  ui.next(
    ...(unregistered.length
      ? [
          'translate it, or register the file in src/cjk-exceptions.json with the reason it stays',
          'a Chinese trigger phrase in a description is a reason; a Chinese explanation is not',
        ]
      : []),
    ...(stale.length ? ['delete the exception — the Chinese it covered is gone'] : [])
  );
  process.exit(1);
}

const n = Object.keys(allow).length;
ui.step(true, `src/ is English — ${n} registered exception${n === 1 ? '' : 's'}`);
