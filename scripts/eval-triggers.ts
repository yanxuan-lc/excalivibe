#!/usr/bin/env node
/**
 * Trigger evals: does a skill fire on the utterances it should, and stay quiet on the rest?
 *
 * A `description` is not prose — it is the **routing surface**. It is the only thing a host sees
 * when deciding whether to load the skill at all, so a description that reads beautifully and
 * routes badly is a broken description, and nothing but a measurement tells the two apart.
 *
 * The corpus is written in English while a large share of the queries here are deliberately
 * Chinese. That combination is the question worth measuring: **does an English description still
 * catch a Chinese request?** The answer decides whether Chinese trigger phrases have to stay in
 * the descriptions, and it is not a thing to have an opinion about.
 *
 * Two phases, so the whole corpus costs **one** model call rather than one per query:
 *
 *   build   assemble a single prompt — every description, every query, shuffled together
 *   score   read the answers back, compare against should_trigger, report by language
 *
 *   node scripts/eval-triggers.ts build > /tmp/prompt.md
 *   claude -p --model opus < /tmp/prompt.md > /tmp/answer.json     # or any fresh context
 *   node scripts/eval-triggers.ts score /tmp/answer.json
 *
 * **Run the prompt in a fresh context.** Answering it inside the session that just edited the
 * descriptions measures that session's memory, not the descriptions — and it scores far too well
 * to notice something is wrong.
 *
 * One property makes partial fixtures worth having: every query is also a negative case for every
 * *other* skill. A file of twelve queries for one skill measures whether the twenty-three others
 * correctly stay quiet, so coverage does not have to be complete to be informative.
 *
 * **Two limits, both measured here, both able to make a run mean something it does not.**
 *
 * *The cases are not independent.* One prompt holds every query, so adding fixtures for skill X
 * changes how X is judged on X's other queries — observed directly: one query went from never
 * firing to always firing when eight unrelated cases were added to the same file, with the
 * description untouched. A before/after comparison is therefore only readable when the fixture set
 * is byte-identical across the two runs.
 *
 * *Tuning on this set proves nothing about this set.* There is no train/held-out split here, so a
 * description edited until a query passes will pass that query by construction. Measure such an
 * edit on queries written before it and never scored during it — the one time that was done, a
 * change that looked like it fixed a miss turned out to buy nothing the original wording did not
 * already do.
 *
 * Around 140 queries the single call starts dropping a few ids outright. `score` says how many; a
 * run missing several is a run to repeat, not to read.
 *
 * This measures the routing surface, and only that. Whether the skill then does its job is a
 * different question with a different harness.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { splitFrontmatter, descriptionFor, ENDS, type End } from '../src/common.ts';
import * as ui from './ui.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const PLUGINS = path.join(ROOT, 'src', 'plugins');

const argv = process.argv.slice(2);
const cmd = argv[0];
const endArg = argv.find((a) => a.startsWith('--end='))?.slice('--end='.length) ?? 'claude';
if (!ENDS.includes(endArg as End)) {
  ui.result(false, `unknown end "${endArg}"`);
  ui.next(`--end=<${ENDS.join('|')}> — each end may tune its own description`);
  process.exit(2);
}
const END = endArg as End;

interface Query {
  id: string;
  skill: string;
  query: string;
  expect: boolean;
  lang: 'zh' | 'en';
}

function skillDirs(): { plugin: string; skill: string; dir: string }[] {
  const out: { plugin: string; skill: string; dir: string }[] = [];
  for (const plugin of fs.readdirSync(PLUGINS).sort()) {
    const dir = path.join(PLUGINS, plugin, 'skills');
    if (!fs.existsSync(dir)) continue;
    for (const skill of fs.readdirSync(dir).sort()) {
      if (fs.existsSync(path.join(dir, skill, 'SKILL.md'))) out.push({ plugin, skill, dir: path.join(dir, skill) });
    }
  }
  return out;
}

/** The routing surface, resolved per end — a tuned `description-claude` is what Claude sees. */
function descriptions(): { name: string; description: string }[] {
  return skillDirs().flatMap(({ skill, dir }) => {
    const { raw } = splitFrontmatter(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'));
    const d = descriptionFor(raw, END).trim().replace(/^["']|["']$/g, '');
    return d ? [{ name: skill, description: d.replace(/\\"/g, '"') }] : [];
  });
}

function queries(): Query[] {
  const out: Query[] = [];
  for (const { skill, dir } of skillDirs()) {
    const f = path.join(dir, 'evals', 'trigger-evals.json');
    if (!fs.existsSync(f)) continue;
    const cases = JSON.parse(fs.readFileSync(f, 'utf8')) as { query: string; should_trigger: boolean }[];
    for (const [i, q] of cases.entries()) {
      out.push({
        id: `${skill}#${i}`,
        skill,
        query: q.query,
        expect: q.should_trigger,
        lang: /[一-鿿]/.test(q.query) ? 'zh' : 'en',
      });
    }
  }
  return out;
}

/**
 * Deterministic shuffle. Queries from one file sit together and often share an expected answer, so
 * a model that spots the run can score well by copying its previous line instead of routing. A
 * fixed seed breaks the pattern while keeping two runs comparable.
 */
function shuffled<T>(arr: readonly T[], seed = 20260807): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

if (cmd === 'build') {
  const skills = descriptions();
  const qs = shuffled(queries());
  if (!qs.length) {
    ui.result(false, 'no trigger fixtures found');
    ui.next('add src/plugins/<plugin>/skills/<skill>/evals/trigger-evals.json');
    process.exit(2);
  }
  process.stdout.write(`You are the skill router for a coding agent. ${skills.length} skills are installed.
Decide, for each user message below, **which skills should load**.

Judge only from the descriptions. A skill loads when its description says it covers this kind of
request; otherwise it does not. Loading one that does not apply costs context, so do not load a
skill "just in case".

## Installed skills

${skills.map((s) => `### ${s.name}\n${s.description}`).join('\n\n')}

## User messages

${qs.map((q) => `${q.id}\t${q.query}`).join('\n')}

## Output

Reply with **JSON only**, no prose: an object mapping every id above to the array of skill names
that should load — an empty array when none should.

{"grill#0": ["grill"], "tdd#3": [], …}
`);
  process.exit(0);
}

if (cmd === 'score') {
  const file = argv.slice(1).find((a) => !a.startsWith('--'));
  if (file === undefined) {
    ui.result(false, 'score needs the answer file');
    ui.next('node scripts/eval-triggers.ts score <answer.json>');
    process.exit(2);
  }
  const text = fs.readFileSync(file, 'utf8');
  // A model asked for JSON only still sometimes wraps it in a fence or a sentence. Taking the
  // outermost braces recovers the payload instead of failing on the packaging.
  const answer = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Record<string, string[]>;
  const qs = queries();

  const buckets: Record<'all' | 'zh' | 'en', boolean[]> = { all: [], zh: [], en: [] };
  const misses: (Query & { note: string; got?: string[] })[] = [];

  for (const q of qs) {
    const got = answer[q.id];
    if (got === undefined) {
      misses.push({ ...q, note: 'no answer for this id' });
      continue;
    }
    const ok = got.includes(q.skill) === q.expect;
    buckets.all.push(ok);
    buckets[q.lang].push(ok);
    if (!ok) misses.push({ ...q, got, note: q.expect ? 'should have fired, did not' : 'fired but should not have' });
  }

  const rate = (b: boolean[]): number => (b.length ? b.filter(Boolean).length / b.length : 0);
  const line = (k: string, b: boolean[]): string =>
    `${k.padEnd(4)} ${String(b.filter(Boolean).length).padStart(3)}/${String(b.length).padEnd(4)} ${
      b.length ? `${(rate(b) * 100).toFixed(1)}%` : '—'
    }`;

  ui.heading(`trigger accuracy — ${END} descriptions`);
  for (const k of ['all', 'zh', 'en'] as const) ui.detail(line(k, buckets[k]));

  // An id the answer simply omits cannot be scored either way, so it stays out of the buckets —
  // but that shrinks the denominator, and a run of 128/131 read next to one of 128/132 looks like
  // the same result. Say it out loud: it is a defect in the answer, not a pass.
  const dropped = misses.filter((m) => m.note === 'no answer for this id').length;
  if (dropped) ui.detail(`${dropped} id(s) missing from the answer — not scored, so the denominator is short by that many`, '?');

  // The whole reason for splitting by language: if an English description still catches a Chinese
  // request, the corpus can stay in one language. A gap here is the price of that choice, stated
  // as a number instead of an opinion.
  if (buckets.zh.length && buckets.en.length) {
    ui.detail(`cross-lingual gap (en − zh): ${((rate(buckets.en) - rate(buckets.zh)) * 100).toFixed(1)} points`);
  }

  if (misses.length) {
    const zh = misses.filter((m) => m.lang === 'zh').length;
    ui.heading(`${misses.length} miss(es)  [zh ${zh} · en ${misses.length - zh}]`);
    for (const m of misses) {
      ui.detail(`${m.lang}  ${m.skill.padEnd(22)} ${m.note}`, '~');
      ui.detail(`    "${m.query}"`);
      if (m.got?.length) ui.detail(`    routed to: ${m.got.join(', ')}`);
    }
  }

  ui.result(misses.length === 0, `${buckets.all.filter(Boolean).length}/${buckets.all.length} routed as expected`);
  process.exit(misses.length ? 1 : 0);
}

ui.result(false, `unknown command ${cmd ?? '(none)'}`);
ui.next('node scripts/eval-triggers.ts build [--end=claude|codex|common]', 'node scripts/eval-triggers.ts score <answer.json>');
process.exit(2);
