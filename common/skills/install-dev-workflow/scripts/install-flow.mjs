#!/usr/bin/env node
/**
 * Install this plugin's step definitions into a project's `.flow/`.
 *
 * EVERYTHING GOES THROUGH THE ENGINE'S COMMAND SURFACE — never a file copy. The constraints on a
 * definition live in the engine's loader, so writing the file directly relies on a contract nothing
 * enforces. The commands buy validation before the write, atomicity, and refusal to edit a
 * definition that a running graph still references.
 *
 * That last refusal is not overridden here. A graph mid-run has already dispatched work against
 * the definition as it was; swapping it underneath leaves a history describing steps that no longer
 * exist. The installer reports it and stops.
 *
 * EXIT CODES ARE THE CONTRACT
 *   0  everything installed
 *   1  ran, some step failed - the definitions that did install are valid, the rest are untouched
 *   2  could not run - no engine, no .flow/, assets missing, checker not found
 *
 * 1 and 2 must never be conflated: "install failed" and "install never started" leave very
 * different projects behind, and only one of them is safe to retry blindly.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ── output: evidence indented and dim, verdict at column 0, next steps last ─────
const color = process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
const paint = (c, s) => (color ? `\u001b[${c}m${s}\u001b[0m` : s);
const dim = (s) => paint('2', s);
const detail = (text, glyph = ' ') => console.log(dim(`  ${glyph} ${text}`));
const result = (ok, text) => console.log(`\n${ok ? paint('32', '✓') : paint('31', '✗')} ${text}`);
const next = (...lines) => {
  console.log('');
  for (const l of lines) console.log(dim(`→ ${l}`));
};
const die = (msg, ...hints) => {
  result(false, msg);
  next(...hints, 'nothing was installed - this is not a partial state');
  process.exit(2);
};

// ── arguments ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
if (argv.includes('-h') || argv.includes('--help')) {
  console.log('usage: install-flow.mjs [--workflow <name>] [--check-spec <path>] [--dry-run]');
  process.exit(0);
}
const dryRun = argv.includes('--dry-run');
const workflow = flag('--workflow') ?? 'genai';

// ── locate the assets that ship beside this script ──────────────────────────────
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(HERE, '..', 'assets');
if (!fs.existsSync(path.join(ASSETS, 'workflow.yaml'))) {
  die(`assets are missing at ${ASSETS}`, 'this script must stay beside the assets/ directory it ships with');
}

// ── prerequisites ───────────────────────────────────────────────────────────────
const engine = spawnSync('fsx', ['--version'], { encoding: 'utf8' });
if (engine.error) {
  die('`fsx` is not on PATH', 'this plugin ships definitions, not the engine - install flow-scratch first');
}
if (!fs.existsSync('.flow')) {
  die('no .flow/ in the current directory', 'run `fsx init` first, then this', 'run this from the project root');
}

/**
 * The completeness checker lives in a sibling plugin, and the two hosts lay plugins out
 * differently. Try both known shapes before asking; guessing wrong would bake a path that fails
 * only later, inside a gate, where it reads as the spec being wrong.
 */
function findCheckSpec() {
  const override = flag('--check-spec');
  if (override) return path.resolve(override);
  const candidates = [
    // plugin layout: <plugins>/dev-workflow/skills/<this>/scripts → <plugins>/dev-toolkit/…
    path.resolve(HERE, '../../../../dev-toolkit/skills/spec-guideline/scripts/check-spec.mjs'),
    // flat layout: <skills>/<this>/scripts → <skills>/spec-guideline/…
    path.resolve(HERE, '../../spec-guideline/scripts/check-spec.mjs'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}
const checkSpec = findCheckSpec();
if (!checkSpec) {
  die(
    'could not locate the spec completeness checker',
    'it ships in the dev-toolkit plugin as spec-guideline/scripts/check-spec.mjs',
    'pass --check-spec <path> if that plugin is installed somewhere unusual'
  );
}

// ── the node list and the defaults come from the asset, never from this file ────
// Two copies of the step list is two copies that will disagree. The workflow asset is the source;
// this script translates it into commands.
const wfText = fs.readFileSync(path.join(ASSETS, 'workflow.yaml'), 'utf8');
const stepIds = [...wfText.matchAll(/^ {2}- (\S+)$/gm)].map((m) => m[1]);
const defaults = [...wfText.matchAll(/^ {2}(\w+):\s*(\S+)$/gm)].map(([, k, v]) => `${k}=${v}`);
if (!stepIds.length) die('the workflow asset declares no steps', 'assets/workflow.yaml looks malformed');

// ── run ─────────────────────────────────────────────────────────────────────────
const failures = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'install-flow-'));

function fsx(args, label) {
  if (dryRun) {
    detail(`fsx ${args.join(' ')}`);
    return true;
  }
  const r = spawnSync('fsx', args, { encoding: 'utf8' });
  if (r.status === 0) return true;
  const why = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').filter(Boolean).slice(-2).join(' · ');
  failures.push([label, why || `exit ${r.status}`]);
  return false;
}

console.log(dim(`  engine ${engine.stdout.trim()} · workflow ${workflow} · ${stepIds.length} step(s)`));
console.log(dim(`  completeness checker: ${path.relative(process.cwd(), checkSpec)}`));
if (dryRun) console.log(dim('  --dry-run: printing the command sequence, writing nothing\n'));

fsx(['workflows', 'new', workflow], `workflows new ${workflow}`);

for (const id of stepIds) {
  const dir = path.join(ASSETS, 'nodes', id);
  if (!fs.existsSync(dir)) {
    failures.push([id, 'declared in the workflow asset but no definition ships for it']);
    continue;
  }
  // The gate that runs the completeness checker needs an absolute path; the asset carries a
  // placeholder so the definition stays host-independent until the moment it is installed.
  const declaration = fs
    .readFileSync(path.join(dir, 'node.yaml'), 'utf8')
    .replaceAll('{{CHECK_SPEC}}', `node ${checkSpec}`);
  const staged = path.join(tmp, `${id}.yaml`);
  fs.writeFileSync(staged, declaration);

  if (!fsx(['nodes', 'new', id, '-w', workflow], id)) continue;
  if (!fsx(['nodes', 'edit', id, '--file', staged], id)) continue;
  fsx(['nodes', 'brief', id, '--file', path.join(dir, 'brief.md')], `${id} (brief)`);
}

// The scaffold ships a placeholder step; leaving it in the whitelist implies it is part of the flow.
if (!dryRun) spawnSync('fsx', ['nodes', 'detach', 'task', workflow], { encoding: 'utf8' });
if (defaults.length) fsx(['workflows', 'set', workflow, ...defaults], 'workflow defaults');

fs.rmSync(tmp, { recursive: true, force: true });

// ── verdict ─────────────────────────────────────────────────────────────────────
for (const [what, why] of failures) detail(`${what}\n      ${why}`, '~');

if (failures.length) {
  result(false, `${failures.length} of ${stepIds.length + 1} operation(s) failed`);
  next(
    'a definition a running graph references cannot be edited - finish or abort that graph, then re-run',
    'everything that did install is valid; re-running is safe'
  );
  process.exit(1);
}

result(true, dryRun ? `${stepIds.length} step(s) would be installed into .flow/` : `${stepIds.length} step(s) installed into .flow/`);

console.log('');
summariseExecutors();

/**
 * What each installed step will dispatch to.
 *
 * Read back from the engine rather than parsed out of the assets on the way in. Two reasons, and
 * the second is the one that matters: an executor declaration is a structure the engine owns, so a
 * regex here is a second parser for someone else's format that breaks silently the next time that
 * format moves - which is exactly the failure this rewrite followed. And the warning underneath is
 * about what is *installed*, so it should be describing what landed, not what was about to be sent.
 */
function summariseExecutors() {
  if (dryRun) {
    console.log(dim('  executors these steps require: not available under --dry-run'));
    detail('the list is read back from the engine, and nothing was installed for it to read', '~');
    return;
  }

  const r = spawnSync('fsx', ['nodes', '-w', workflow, '--json'], { encoding: 'utf8' });
  let nodes;
  try {
    nodes = JSON.parse(r.stdout).nodes;
  } catch {
    nodes = undefined;
  }
  if (r.status !== 0 || !Array.isArray(nodes)) {
    // Say it could not be read. An empty list here would read as "no executors required", and a
    // reader has no way to tell that apart from a step list that genuinely dispatches to nobody.
    console.log(dim('  executors these steps require: could not be read back'));
    detail(`fsx nodes -w ${workflow} --json exited ${r.status ?? '?'}`, '~');
    return;
  }

  console.log(dim('  executors these steps require:'));
  const byExec = new Map();
  for (const node of nodes) {
    const e = node.executor ?? {};
    const label = e.params?.name ?? e.params?.channel ?? e.params?.adapter ?? e.params?.url;
    const key = label ? `${e.protocol} ${label}` : (e.protocol ?? '?');
    byExec.set(key, (byExec.get(key) ?? 0) + 1);
  }
  for (const [ex, count] of [...byExec].sort()) detail(`${ex.padEnd(30)} ${count} step(s)`);

  next(
    'nothing validates those names - the engine does not own subagent definitions and cannot resolve them',
    'check them against what is actually installed; a missing one surfaces only when a dispatch fails',
    '`fsx check` then `fsx nodes -w ' + workflow + '` to see the full definitions'
  );
}
