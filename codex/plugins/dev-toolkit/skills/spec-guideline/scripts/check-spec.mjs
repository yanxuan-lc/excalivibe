#!/usr/bin/env node
/**
 * Completeness check for a change's design.md and scenario identifiers.
 *
 * Runs `openspec validate` first, then adds the two things it does not cover. That split is
 * measured, not assumed: `openspec validate` catches a scenario heading demoted from four
 * hashtags to three, and passes a change whose design.md **does not exist at all** — even under
 * `--strict`. Its coverage is `specs/**` and nothing else.
 *
 * WHAT THIS CHECKS
 *   design.md   the file exists · every section the template declares is present · each one has
 *               something written in it · Verification Carrier names a legal value
 *   specs/**    every scenario heading parses into an identifier · identifiers are unique inside
 *               the change · no identifier contains ':'
 *
 * WHAT IT DOES NOT CHECK, and cannot
 *   Whether the DDL is right, whether a budget number is sensible, whether the scenarios cover
 *   the main path, or whether a "not applicable" is true. Section bodies are free prose - there
 *   is no grammar to parse. A section holding the word "TODO" passes: this separates written
 *   from unwritten, never good from bad.
 *
 * EXIT CODES ARE THE CONTRACT
 *   0  both halves ran, both passed
 *   1  both halves ran, there are findings
 *   2  could not run - missing change, missing openspec, unreadable template
 *
 * 1 and 2 must never be conflated. "The check failed" and "the check never executed" produce
 * identical-looking output otherwise, and a broken checker then reads as good news.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

// ── output: three shapes, so evidence never looks like a verdict ────────────────
// Self-contained on purpose. This script ships inside a skill and runs in someone else's
// project, where the repo's shared output module does not exist.
const color = process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
const paint = (c, s) => (color ? `\u001b[${c}m${s}\u001b[0m` : s);
const dim = (s) => paint('2', s);
const detail = (text, glyph = ' ') => console.log(dim(`  ${glyph} ${text}`));
const result = (ok, text) => console.log(`\n${ok ? paint('32', '✓') : paint('31', '✗')} ${text}`);
const next = (...lines) => {
  console.log('');
  for (const l of lines) console.log(dim(`→ ${l}`));
};
const die = (msg) => {
  result(false, msg);
  next('nothing was checked - this is not a passing run');
  process.exit(2);
};

// ── arguments ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  console.log('usage: check-spec.mjs <change-id> | --all');
  process.exit(0);
}
const CHANGES = path.join('openspec', 'changes');
if (!fs.existsSync(CHANGES)) die(`${CHANGES}/ not found - run this from the project root`);

const all = argv.includes('--all');
const named = argv.filter((a) => !a.startsWith('-'));
const ids = all
  ? fs
      .readdirSync(CHANGES, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'archive')
      .map((e) => e.name)
      .sort()
  : named;
if (!ids.length) die(all ? 'no active change to check' : 'no change named - pass a change id, or --all');
for (const id of ids) {
  if (!fs.existsSync(path.join(CHANGES, id))) die(`change "${id}" does not exist under ${CHANGES}/`);
}

// ── the section list comes from the template, never from this file ──────────────
// Three copies of the list - template, schema instruction, checker - is three copies that will
// disagree. Deriving it means adding a section is a one-file edit.
const DEFAULT_SECTIONS = [
  'Context',
  'Goals / Non-Goals',
  'Module Design',
  'External Protocol',
  'Database Design',
  'Non-functional Budgets',
  'Security & Permissions',
  'Observability',
  'Rollback & Migration',
  'Verification Carrier',
  'Decisions',
  'Risks / Trade-offs',
];

function loadSections() {
  const schemas = path.join('openspec', 'schemas');
  if (fs.existsSync(schemas)) {
    for (const dir of fs.readdirSync(schemas).sort()) {
      const tpl = path.join(schemas, dir, 'templates', 'design.md');
      if (!fs.existsSync(tpl)) continue;
      const found = headings(fs.readFileSync(tpl, 'utf8'));
      // Open Questions is explicitly omittable, so it is never required.
      const required = found.filter((h) => h !== 'Open Questions');
      if (required.length) return { sections: required, from: tpl };
    }
  }
  return { sections: DEFAULT_SECTIONS, from: 'built-in fallback (no schema template found)' };
}

const headings = (text) => [...text.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1]);

/** Body of `## <name>`, from its heading to the next `## ` or EOF. */
function sectionBody(text, name) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^##[ \t]+/.test(l) && l.replace(/^##[ \t]+/, '').trim() === name);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##[ \t]+/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/** Template guidance lives in HTML comments, so an unwritten section is empty once they go. */
const written = (body) => body.replace(/<!--[\s\S]*?-->/g, '').trim().length > 0;

const CARRIERS = ['scripted', 'agent-driven', 'existing-suite'];

// ── scenario identifiers ────────────────────────────────────────────────────────
const EM_DASH = '—';
/** Internal whitespace matches loosely: `S-A / R3` and `S-A/R3` are the same identifier. */
const canonical = (id) => id.replace(/\s+/g, '');

function specFiles(dir) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

// ── the checks ──────────────────────────────────────────────────────────────────
const { sections, from: sectionSource } = loadSections();
const problems = [];
const warnings = [];
let scenarioCount = 0;

function checkChange(id) {
  const root = path.join(CHANGES, id);
  const label = ids.length > 1 ? `${id}: ` : '';

  // scenarios first - the carrier check below depends on whether any exist
  const seen = new Map();
  let mine = 0;
  for (const f of specFiles(path.join(root, 'specs'))) {
    const text = fs.readFileSync(f, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const m = /^####[ \t]+Scenario:[ \t]*(.+?)[ \t]*$/.exec(line);
      if (!m) return;
      mine++;
      const at = `${f}:${i + 1}`;
      const title = m[1];

      if (!title.includes(EM_DASH)) {
        const hint = /\s[-–]\s/.test(title)
          ? 'the separator is an en dash or hyphen - the identifier needs an em dash (—), which is a mechanical fix'
          : 'expected `#### Scenario: <id> — <title>`';
        problems.push([at, `${label}scenario heading carries no identifier — ${hint}`]);
        return;
      }

      const rawId = title.slice(0, title.indexOf(EM_DASH)).trim();
      if (!rawId) {
        problems.push([at, `${label}scenario heading has an empty identifier before the em dash`]);
        return;
      }
      if (rawId.includes(':')) {
        problems.push([
          at,
          `${label}identifier "${rawId}" contains ':' — that is the cross-change namespace separator, so the qualified form <change-id>:<id> could not be split`,
        ]);
      }
      const key = canonical(rawId);
      if (seen.has(key)) problems.push([at, `${label}identifier "${rawId}" already used at ${seen.get(key)}`]);
      else seen.set(key, at);

      // advisory: a scenario that asserts nothing about persisted state
      const body = [];
      for (let j = i + 1; j < lines.length && !/^#{1,4}[ \t]/.test(lines[j]); j++) body.push(lines[j]);
      if (!/\*\*AND\*\*\s*Database:/i.test(body.join('\n'))) {
        warnings.push([at, `${label}scenario "${rawId}" states no expected database effect`]);
      }
    });
  }
  scenarioCount += mine;

  // design.md
  const design = path.join(root, 'design.md');
  if (!fs.existsSync(design)) {
    problems.push([design, `${label}design.md does not exist (openspec validate passes without it)`]);
    return;
  }
  const text = fs.readFileSync(design, 'utf8');
  for (const name of sections) {
    const body = sectionBody(text, name);
    if (body === null) {
      problems.push([design, `${label}section "## ${name}" is missing`]);
      continue;
    }
    if (!written(body)) {
      problems.push([
        design,
        `${label}section "## ${name}" is empty — write one line saying it does not apply, so a deliberate omission is distinguishable from an overlooked one`,
      ]);
      continue;
    }
    if (name === 'Verification Carrier' && mine > 0) {
      const plain = body.replace(/<!--[\s\S]*?-->/g, '');
      const hits = CARRIERS.filter((c) => plain.includes(c));
      if (hits.length !== 1) {
        problems.push([
          design,
          `${label}Verification Carrier names ${hits.length === 0 ? 'none' : hits.length} of ${CARRIERS.join(' / ')} — exactly one is required while this change has scenarios`,
        ]);
      }
    }
  }
}

// ── step 1: openspec's own validation ───────────────────────────────────────────
const probe = spawnSync('openspec', ['--version'], { encoding: 'utf8' });
if (probe.error) die('`openspec` is not on PATH - this check runs on top of it, not instead of it');

console.log(dim(`  openspec ${probe.stdout.trim()} · sections from ${sectionSource}`));
const os = spawnSync('openspec', ['validate', '--changes', ...ids], { encoding: 'utf8' });
const osOut = `${os.stdout ?? ''}${os.stderr ?? ''}`.trim();
const osOk = os.status === 0;
if (!osOk) for (const line of osOut.split('\n').filter(Boolean)) detail(line, '~');

// ── step 2: ours ────────────────────────────────────────────────────────────────
for (const id of ids) checkChange(id);

for (const [at, msg] of problems) detail(`${at}\n      ${msg}`, '~');
for (const [at, msg] of warnings) detail(`${at}\n      ${msg}`, '?');

// ── verdict ─────────────────────────────────────────────────────────────────────
const parts = [];
if (!osOk) parts.push('openspec validate failed');
if (problems.length) parts.push(`${problems.length} completeness problem(s)`);
const ok = osOk && problems.length === 0;

result(
  ok,
  ok
    ? `${ids.length} change(s) complete — ${scenarioCount} scenario(s), ${warnings.length} advisory`
    : parts.join(', ')
);
if (!ok) {
  next(
    ...(osOk ? [] : ['fix the spec deltas first — `openspec validate --changes <id>` explains each one']),
    ...(problems.length ? ['a section that does not apply still needs one written line saying so'] : [])
  );
  process.exit(1);
}
console.log(dim('  Presence only: nothing here judges whether the DDL is right, whether a budget'));
console.log(dim('  is sensible, or whether a "not applicable" is true.'));
