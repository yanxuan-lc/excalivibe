#!/usr/bin/env node
/**
 * No source file carries a raw NUL byte.
 *
 * A NUL is the right **value** for a hash field separator — no path, no identifier and no id can
 * contain one, so two different splits of the same bytes cannot collide, which is why `find -print0`
 * and `sort -z` exist. What is wrong is writing it as a literal byte in the source instead of the
 * escape `\x00`: grep, `git grep` and most editors' search classify a file holding one as **binary**
 * and stop reporting matches inside it. The file then goes missing from the tool people look for it
 * with, silently, while every other check stays green.
 *
 * That is not hypothetical. `assets/flow/genai/lib/e2e.mjs` — 488 lines, the largest gate evaluator
 * in the flow — held four of them, and three separate greps for a function it exports came back
 * empty before anyone thought to question the tool rather than the memory.
 *
 * Why a checker rather than a line in AGENTS.md: knowing about it does not prevent it. The author
 * who diagnosed the e2e.mjs case wrote two more NULs into a new file an hour later, because the
 * character is invisible in every editor and survives a copy-paste of the surrounding line. Nothing
 * in `make check` looked, so both survived a full green run.
 *
 * There is no exception registry, deliberately. Chinese in a description is a legitimate exception
 * and `cjk-exceptions.json` exists for it; a raw NUL in a text source has no legitimate case at all.
 * If one ever appears, that is the moment to build the registry — shipping one for zero cases leaves
 * a door open for a rule that has never needed it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ui from './ui.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Sources only. The three compiled trees are byte-for-byte derivations of `src/`, so a NUL there
 * came from here and is reported here, at the one place it can be fixed; `verify-build` is what
 * says an artifact matches its source.
 */
const ROOTS = ['src', 'scripts'];

/** Extensions that are meant to be read as text. A real binary has every right to hold NULs. */
const TEXTUAL = new Set(['.md', '.mdx', '.json', '.ts', '.js', '.mjs', '.sh', '.py', '.toml', '.yaml', '.yml', '.txt']);

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (TEXTUAL.has(path.extname(p))) acc.push(p);
  }
  return acc;
}

const corpus = ROOTS.flatMap((r) => (fs.existsSync(path.join(ROOT, r)) ? walk(path.join(ROOT, r)) : [])).sort();

/** file, relative to the repository root → the 1-based lines holding a NUL */
const found = new Map<string, number[]>();
for (const file of corpus) {
  const bytes = fs.readFileSync(file);
  if (!bytes.includes(0)) continue;
  const lines = bytes.toString('utf8').split('\n');
  found.set(
    path.relative(ROOT, file).split(path.sep).join('/'),
    lines.flatMap((l, i) => (l.includes('\0') ? [i + 1] : []))
  );
}

if (found.size) {
  ui.list(
    [...found].map(([file, lines]) => `${file} — line ${lines.slice(0, 6).join(', ')}`),
    '~'
  );
  ui.step(false, `a raw NUL byte hides a file from grep — ${found.size} file(s)`);
  ui.next(
    'write it as the escape \\x00 — identical at run time, and the file stays greppable',
    'check with: /usr/bin/grep -c . <file>, which reports a NUL-bearing file as binary'
  );
  process.exit(1);
}

ui.step(true, `no raw NUL bytes — ${corpus.length} files`);
