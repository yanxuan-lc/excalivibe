#!/usr/bin/env node
/**
 * Bring a project to the state where this flow can run, and keep it there.
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
  console.log('usage: init.mjs [--cmd-check-diff <cmd>|none] [--cmd-test …] [--cmd-lint …] [--cmd-build …]');
  console.log('                [--check-spec <path>] [--host claude|codex] [--dry-run]');
  process.exit(0);
}
const dryRun = argv.includes('--dry-run');
const host = flag('--host') ?? 'claude';

/**
 * Every item this script touches lands in exactly one of three dispositions, and the run says
 * which. That output is what makes running it twice a safe thing to do rather than a gamble:
 * `preserved` is a promise that the project's own content was not rewritten.
 */
const ledger = [];
const note = (disposition, what, why) => ledger.push([disposition, what, why]);

// ── locate the assets that ship beside this script ──────────────────────────────
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(HERE, '..', 'assets');
if (!fs.existsSync(path.join(ASSETS, 'workflows'))) {
  die(`assets are missing at ${ASSETS}`, 'this script must stay beside the assets/ directory it ships with');
}

// ── prerequisites ───────────────────────────────────────────────────────────────
const have = (bin) => spawnSync(bin, ['--version'], { encoding: 'utf8' }).error === undefined;

const engine = spawnSync('fsx', ['--version'], { encoding: 'utf8' });
if (engine.error) {
  die('`fsx` is not on PATH', 'this plugin ships definitions, not the engine - install flow-scratch first');
}
if (!have('openspec')) {
  die('`openspec` is not on PATH', 'the spec workflow is built on it - install it, then run this again');
}
// mdxv is needed by exactly one step. Missing it degrades that step rather than the setup, so it
// warns instead of stopping - dying here would block a project that never generates a review doc.
const haveMdxv = have('mdxv');

if (!fs.existsSync('.git')) {
  die('this is not a git repository root', 'the flow signs commits and branches; run this from the project root');
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

// ── content this script writes into files the project owns ──────────────────────
const GLOSSARY_SEED = `# Glossary

The agreed word for each domain concept in this bounded context. One line each: the canonical term,
what it means, and — where they matter — accepted aliases and forms that are not to be used.

New terms are added where the domain is first framed with the person asking for the work. Nothing
here is generated; a term is in this file because somebody decided it.

<!-- Example:
- **customer** — a party that pays us. Forbidden: \`client\`.
-->
`;

const ROUTING_BLOCK = `This project runs its development work through flow-scratch. The available steps are whatever
\`fsx nodes -w genai-feature\` reports — that is the authority, not this block.

Two kinds of run, distinguished by the graph variable they supply: one change
(\`--var change=<id>\`, artifacts under \`openspec/changes/<id>/\`) or a batch of finished ones
(\`--var sprint=<id>\`, artifacts under \`genai/sprints/<id>/\`).`;

/**
 * Read-only git commands, allowed so they stop prompting.
 *
 * Only read-only ones. Adding a mutating command here removes the interruption at exactly the point
 * where it is worth its cost, and trains the reader to approve without looking.
 */
const READ_ONLY_GIT = ['log', 'show', 'diff', 'status', 'blame', 'branch', 'reflog', 'describe']
  .map((c) => `Bash(git ${c}:*)`);

/**
 * The `schema:` line in openspec/config.yaml, and only that line.
 *
 * `openspec init` writes `schema: spec-driven`. Leaving it would install the fork and never use it:
 * scaffolding would produce the stock design template while the completeness checker demanded the
 * eight sections the fork adds - which is precisely the failure this whole step exists to remove.
 * The rest of the file is the project's, so this is a one-line edit rather than a rewrite.
 */
function pointAtOurSchema() {
  const at = path.join('openspec', 'config.yaml');
  const label = `${at} (schema line)`;
  if (!fs.existsSync(at)) {
    if (!dryRun) fs.writeFileSync(at, 'schema: excalivibe\n');
    note('created', label, '');
    return;
  }
  const text = fs.readFileSync(at, 'utf8');
  const current = /^schema:[ \t]*(\S+)[ \t]*$/m.exec(text);
  if (current?.[1] === 'excalivibe') { note('preserved', label, 'already points at the fork'); return; }
  const next = current
    ? text.replace(current[0], 'schema: excalivibe')
    : `schema: excalivibe\n${text}`;
  if (!dryRun) fs.writeFileSync(at, next);
  note('refreshed', label, current ? `was ${current[1]}; the rest of the file is untouched` : 'prepended');
}

function allowReadOnlyGit() {
  const at = path.join('.claude', 'settings.json');
  let settings = {};
  if (fs.existsSync(at)) {
    try { settings = JSON.parse(fs.readFileSync(at, 'utf8')); }
    catch {
      // Leave a file we cannot parse alone. Rewriting it would discard whatever is in there.
      note('preserved', at, 'could not be parsed, so it was not touched - add the read-only git entries by hand');
      return;
    }
  }
  const allow = settings.permissions?.allow ?? [];
  const missing = READ_ONLY_GIT.filter((e) => !allow.includes(e));
  if (!missing.length) { note('preserved', at, 'already allows read-only git'); return; }
  settings.permissions = { ...(settings.permissions ?? {}), allow: [...allow, ...missing] };
  if (!dryRun) {
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.writeFileSync(at, `${JSON.stringify(settings, null, 2)}\n`);
  }
  note(fs.existsSync(at) ? 'refreshed' : 'created', at, `${missing.length} read-only git entr${missing.length === 1 ? 'y' : 'ies'} added`);
}

// ── setup: everything the definitions need to exist alongside ───────────────────
/** Run a command for effect. Returns false and records a failure rather than throwing. */
function run(bin, args, label) {
  if (dryRun) { detail(`${bin} ${args.join(' ')}`); return true; }
  const r = spawnSync(bin, args, { encoding: 'utf8' });
  if (r.status === 0) return true;
  failures.push([label, `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').filter(Boolean).slice(-2).join(' · ') || `exit ${r.status}`]);
  return false;
}

/** Copy a directory we own. Always refreshed - it is the toolkit's, and a stale copy is the bug. */
function refreshDir(from, to, label) {
  const existed = fs.existsSync(to);
  if (!dryRun) fs.cpSync(from, to, { recursive: true });
  note(existed ? 'refreshed' : 'created', label, existed ? 'ours, so it carries the current version' : '');
}

/** Create a file only when absent. Once it has content, it is the project's. */
function seedFile(at, body, label, why) {
  if (fs.existsSync(at)) { note('preserved', label, why); return; }
  if (!dryRun) { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, body); }
  note('created', label, '');
}

const MARK_OPEN = '<!-- genai:begin -->';
const MARK_CLOSE = '<!-- genai:end -->';

/**
 * Replace only what lies between the markers, in a file the project owns.
 *
 * An unclosed block stops the run rather than being repaired by guessing: the guess would either
 * swallow content someone wrote or append a second block, and both are worse than saying so.
 */
function markedBlock(at, body, label) {
  const block = `${MARK_OPEN}\n${body}\n${MARK_CLOSE}`;
  if (!fs.existsSync(at)) {
    if (!dryRun) fs.writeFileSync(at, `${block}\n`);
    note('created', label, '');
    return;
  }
  const text = fs.readFileSync(at, 'utf8');
  const open = text.indexOf(MARK_OPEN);
  const close = text.indexOf(MARK_CLOSE);
  if (open !== -1 && close === -1) {
    die(`${label} has an opening genai marker with no closing one`,
        'repairing that means guessing where the block ends, and a wrong guess eats content someone wrote',
        'close the block by hand, then run this again');
  }
  const next = open === -1
    ? `${text.replace(/\n*$/, '')}\n\n${block}\n`
    : text.slice(0, open) + block + text.slice(close + MARK_CLOSE.length);
  if (!dryRun && next !== text) fs.writeFileSync(at, next);
  note(open === -1 ? 'created' : 'refreshed', label,
       open === -1 ? 'appended; nothing already in the file was rewritten' : 'only the marked block');
}

const failures = [];

// `--tools <host>` is what makes it non-interactive; without it, it waits for a keypress.
if (!fs.existsSync('openspec')) {
  if (run('openspec', ['init', '--tools', host], 'openspec init')) note('created', 'openspec/', '');
} else note('preserved', 'openspec/', 'already initialised');

refreshDir(path.join(ASSETS, 'openspec-schema'), path.join('openspec', 'schemas', 'excalivibe'),
           'openspec/schemas/excalivibe/');
pointAtOurSchema();

if (!fs.existsSync('.flow')) {
  if (run('fsx', ['init'], 'fsx init')) note('created', '.flow/', '');
} else note('preserved', '.flow/', 'already initialised');
if (run('fsx', ['skill', 'install', '--target', host], 'fsx skill install')) {
  note('refreshed', `the engine driving skill (${host})`, 'the engine owns it, so it carries the engine version');
}

seedFile('CONTEXT.md', GLOSSARY_SEED, 'CONTEXT.md',
         'it accumulates the project\'s own terms; overwriting it would erase domain knowledge');

for (const f of ['AGENTS.md', 'CLAUDE.md']) markedBlock(f, ROUTING_BLOCK, `${f} (genai block)`);
allowReadOnlyGit();

// ── the project's own check commands ────────────────────────────────────────────
/**
 * Three states, not two: given, declared absent, or not mentioned at all.
 *
 * The third stops the run. Silently skipping a gate because nobody said anything is how a project
 * ends up unguarded without a decision having been made — and the rule this inherits is explicit
 * that a command is never invented to fake one ("we do not invent a tautological command").
 *
 * A re-run needs no flags: the value is read back out of the installed definition, which is the
 * only place the gate actually reads it from. A state file beside it would be a second copy of the
 * same fact, and two copies disagree eventually.
 */
const COMMANDS = [
  { key: 'CMD_CHECK_DIFF', flag: '--cmd-check-diff', step: 'genai.implement',  what: 'scoped checks: changed packages plus their reverse dependencies' },
  { key: 'CMD_TEST',       flag: '--cmd-test',       step: 'genai.full-check', what: 'the whole test suite' },
  { key: 'CMD_LINT',       flag: '--cmd-lint',       step: 'genai.full-check', what: 'static checks over the whole tree' },
  { key: 'CMD_BUILD',      flag: '--cmd-build',      step: 'genai.integrate',  what: 'the build' },
];

/** What an installed definition currently carries for a placeholder, if anything. */
function installedCommand(step, key) {
  const at = path.join('.flow', 'nodes', step, 'node.yaml');
  if (!fs.existsSync(at)) return undefined;
  const text = fs.readFileSync(at, 'utf8');
  if (!text.includes(`{{${key}_BEGIN}}`) && !text.includes(`rule_id: ${RULE_OF[key]}`)) return 'none';
  const m = new RegExp(`rule_id: ${RULE_OF[key]}[\\s\\S]*?command: "(.*)"`).exec(text);
  return m?.[1];
}
const RULE_OF = { CMD_CHECK_DIFF: 'scoped_checks', CMD_TEST: 'full_suite', CMD_LINT: 'full_lint', CMD_BUILD: 'builds' };

const resolved = new Map();
const unguarded = [];
for (const c of COMMANDS) {
  const given = flag(c.flag) ?? installedCommand(c.step, c.key);
  if (given === undefined) {
    die(`no command given for ${c.flag}`,
        `${c.step} needs it to gate ${c.what}`,
        `pass ${c.flag} '<command>', or ${c.flag} none if this project genuinely has no such command`,
        'a command that trivially succeeds is worse than none: it reads as a passing gate');
  }
  resolved.set(c.key, given);
  if (given === 'none') unguarded.push(c);
}

/** Substitute the command, or delete the whole rule when the project declared it absent. */
function applyCommands(text) {
  for (const [key, value] of resolved) {
    const open = `# {{${key}_BEGIN}}`, close = `# {{${key}_END}}`;
    if (value === 'none') {
      const lines = text.split('\n');
      const a = lines.findIndex((l) => l.includes(open));
      const b = lines.findIndex((l) => l.includes(close));
      if (a !== -1 && b !== -1) text = [...lines.slice(0, a), ...lines.slice(b + 1)].join('\n');
      continue;
    }
    text = text
      .split('\n')
      .filter((l) => !l.includes(open) && !l.includes(close))
      .join('\n')
      .replaceAll(`{{${key}}}`, value);
  }
  return text;
}

// ── run ─────────────────────────────────────────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'genai-init-'));

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
  const withCommands = applyCommands(declaration);
  const staged = path.join(tmp, `${id}.yaml`);
  fs.writeFileSync(staged, withCommands);

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
    'a setup step that failed leaves the items before it done; the report above says which',
    're-running is safe: every item is created, refreshed or preserved, never duplicated'
  );
  process.exit(1);
}

const scope = `${allSteps.length} step(s) across ${workflows.length} workflow(s)`;
result(true, dryRun ? `${scope} would be set up` : `${scope} set up`);

console.log('');
console.log(dim('  what this run did to each item:'));
for (const [disposition, what, why] of ledger) {
  detail(`${disposition.padEnd(10)} ${what}${why ? `  ${dim(`- ${why}`)}` : ''}`);
}

console.log('');
console.log(dim('  the checks these gates run, as installed:'));
for (const c of COMMANDS) {
  const v = resolved.get(c.key);
  detail(`${c.flag.replace('--cmd-', '').padEnd(11)} ${v === 'none' ? dim('(none declared)') : v}`);
}
if (unguarded.length) {
  // Say what is not enforced. Without this line the project reads as fully gated and is not, which
  // is exactly the shape the "no tautological command" rule was written against.
  next(...unguarded.map((c) => `no gate runs ${c.what} - ${c.step} is unguarded for it, by declaration`));
}
if (!haveMdxv) next('`mdxv` is not on PATH - the review document cannot be previewed locally until it is');

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
