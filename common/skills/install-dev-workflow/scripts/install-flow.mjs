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
  console.log('usage: install-flow.mjs [--check-spec <path>] [--dry-run]');
  process.exit(0);
}
const dryRun = argv.includes('--dry-run');

// ── locate the assets that ship beside this script ──────────────────────────────
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(HERE, '..', 'assets');
if (!fs.existsSync(path.join(ASSETS, 'workflows'))) {
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

// ── the workflows, their steps and their defaults come from the assets, never from here ────
// Two copies of a step list is two copies that will disagree. Each file under assets/workflows/
// is one workflow, and **its filename is the workflow name** - the same rule the node directories
// already follow, so adding a workflow is a file rather than an edit to this script.
const workflows = fs
  .readdirSync(path.join(ASSETS, 'workflows'))
  .filter((f) => f.endsWith('.yaml'))
  .sort()
  .map((f) => {
    const text = fs.readFileSync(path.join(ASSETS, 'workflows', f), 'utf8');
    return {
      name: path.basename(f, '.yaml'),
      stepIds: [...text.matchAll(/^ {2}- (\S+)$/gm)].map((m) => m[1]),
      defaults: [...text.matchAll(/^ {2}(\w+):\s*(\S+)$/gm)].map(([, k, v]) => `${k}=${v}`),
    };
  });
if (!workflows.length) die('assets/workflows/ declares no workflows', 'the directory holds one .yaml per workflow');
for (const wf of workflows) {
  if (!wf.stepIds.length) die(`workflow ${wf.name} declares no steps`, `assets/workflows/${wf.name}.yaml looks malformed`);
}
// Definitions are global; only whitelist membership is per workflow. A step listed by two
// workflows is written once and listed twice.
const allSteps = [...new Set(workflows.flatMap((w) => w.stepIds))].sort();

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

const summary = workflows.map((w) => `${w.name} (${w.stepIds.length})`).join(' · ');
console.log(dim(`  engine ${engine.stdout.trim()} · ${summary}`));
console.log(dim(`  completeness checker: ${path.relative(process.cwd(), checkSpec)}`));
if (dryRun) console.log(dim('  --dry-run: printing the command sequence, writing nothing\n'));

// Whitelist membership first, definitions after. `nodes new` creates the definition directory when
// it is absent and only adds a whitelist entry when it is not, so it is both the create and the
// attach - and `nodes edit` needs the directory to exist before it can replace anything.
const missing = new Set();
for (const wf of workflows) {
  fsx(['workflows', 'new', wf.name], `workflows new ${wf.name}`);
  for (const id of wf.stepIds) {
    if (!fs.existsSync(path.join(ASSETS, 'nodes', id))) {
      failures.push([id, `listed by workflow ${wf.name} but no definition ships for it`]);
      missing.add(id);
      continue;
    }
    fsx(['nodes', 'new', id, '-w', wf.name], `${id} → ${wf.name}`);
  }
}

for (const id of allSteps) {
  if (missing.has(id)) continue;
  const dir = path.join(ASSETS, 'nodes', id);
  // The gate that runs the completeness checker needs an absolute path; the asset carries a
  // placeholder so the definition stays host-independent until the moment it is installed.
  const declaration = fs
    .readFileSync(path.join(dir, 'node.yaml'), 'utf8')
    .replaceAll('{{CHECK_SPEC}}', `node ${checkSpec}`);
  const staged = path.join(tmp, `${id}.yaml`);
  fs.writeFileSync(staged, declaration);

  if (!fsx(['nodes', 'edit', id, '--file', staged], id)) continue;
  fsx(['nodes', 'brief', id, '--file', path.join(dir, 'brief.md')], `${id} (brief)`);
}

for (const wf of workflows) {
  // The scaffold ships a placeholder step; leaving it in a whitelist implies it is part of the flow.
  if (!dryRun) spawnSync('fsx', ['nodes', 'detach', 'task', wf.name], { encoding: 'utf8' });
  if (wf.defaults.length) fsx(['workflows', 'set', wf.name, ...wf.defaults], `${wf.name} defaults`);
}

fs.rmSync(tmp, { recursive: true, force: true });

// ── verdict ─────────────────────────────────────────────────────────────────────
for (const [what, why] of failures) detail(`${what}\n      ${why}`, '~');

if (failures.length) {
  result(false, `${failures.length} operation(s) failed`);
  next(
    'a definition a running graph references cannot be edited - finish or abort that graph, then re-run',
    'everything that did install is valid; re-running is safe'
  );
  process.exit(1);
}

const scope = `${allSteps.length} step(s) across ${workflows.length} workflow(s)`;
result(true, dryRun ? `${scope} would be installed into .flow/` : `${scope} installed into .flow/`);

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

  const byExec = new Map();
  const seen = new Set();
  for (const wf of workflows) {
    const r = spawnSync('fsx', ['nodes', '-w', wf.name, '--json'], { encoding: 'utf8' });
    let nodes;
    try {
      nodes = JSON.parse(r.stdout).nodes;
    } catch {
      nodes = undefined;
    }
    if (r.status !== 0 || !Array.isArray(nodes)) {
      // Say it could not be read. An empty list here would read as "no executors required", and a
      // reader has no way to tell that apart from a workflow that dispatches to nobody.
      console.log(dim(`  executors ${wf.name} requires: could not be read back`));
      detail(`fsx nodes -w ${wf.name} --json exited ${r.status ?? '?'}`, '~');
      return;
    }
    collect(nodes, byExec, seen);
  }

  console.log(dim('  executors these steps require:'));
  render(byExec);
}

/**
 * Tally one workflow's executors into the shared map.
 *
 * `seen` carries across workflows so a step listed by two of them is counted once - the question
 * the list answers is "which executors must exist here", and a step does not need its executor
 * twice for being reachable from two processes.
 */
function collect(nodes, byExec, seen) {
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    const e = node.executor ?? {};
    const label = e.params?.name ?? e.params?.channel ?? e.params?.adapter ?? e.params?.url;
    const key = label ? `${e.protocol} ${label}` : (e.protocol ?? '?');
    byExec.set(key, (byExec.get(key) ?? 0) + 1);
  }
}

function render(byExec) {
  for (const [ex, count] of [...byExec].sort()) detail(`${ex.padEnd(30)} ${count} step(s)`);
  next(
    'nothing validates those names - the engine does not own subagent definitions and cannot resolve them',
    'check them against what is actually installed; a missing one surfaces only when a dispatch fails',
    '`fsx check` then `fsx nodes -w <workflow>` to see the full definitions'
  );
}
