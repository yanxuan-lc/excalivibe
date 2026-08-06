#!/usr/bin/env node
/**
 * Compile: **`src/` is the only source; `claude/`, `codex/` and `common/` are artifacts in their
 * entirety**, along with the two generated marketplace manifests.
 *
 * There is not one hand-written file in the artifact trees — SKILL.md, commands, agents, hooks and
 * manifests are all generated here. To change anything, edit `src/`, then run `make build`.
 *
 * Why the artifacts are committed: the Claude marketplace installs straight from the repo, so what
 * a user clones is `claude/plugins/<name>/` — it cannot be something that only exists after a
 * build. The price is a double diff on every change; what it buys is that a capability has exactly
 * one source and the ends cannot drift apart.
 *
 *   node scripts/build.ts                     # compile
 *   node scripts/build.ts --check             # verify; exit 1 on drift from source or on orphans
 *   node scripts/build.ts --clean             # delete every artifact
 *   node scripts/build.ts --verify-roundtrip  # snapshot → clean → rebuild → compare
 *
 * `--check` catches three things: **forgot to compile**, **hand-edited an artifact**, and
 * **an artifact with nothing in the source behind it (an orphan)**.
 *
 * Exit codes: 0 in sync or generated · 1 mismatch · 2 usage or source error
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENDS,
  TIER,
  isTier,
  renderFor,
  lintVariants,
  splitFrontmatter,
  descriptionFor,
  descriptionValueFor,
  type End,
} from '../src/common.ts';
import * as ui from './ui.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p: string[]): string => path.join(REPO, ...p);
const argv = process.argv.slice(2);
const check = argv.includes('--check');
const clean = argv.includes('--clean');
const roundtrip = argv.includes('--verify-roundtrip');

function die(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(2);
}

/** What `src/plugins/<name>/plugin.json` may hold. One source, one serialization per end. */
interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: { name: string; url?: string };
  /** Codex marketplace grouping; Claude has no equivalent field. */
  category?: string;
  keywords: Record<'claude' | 'codex', string[]>;
  /** Codex requires it; the Claude manifest has no such field. */
  interface: Record<string, unknown>;
  mcpServers?: string;
}

interface MarketplaceSource {
  name: string;
  displayName?: string;
  description: string;
  owner: { name: string; url?: string };
}

/** Every artifact lands in this map first and is written / compared in one pass at the end —
 *  which is what makes `--check` completely free of side effects. */
const out = new Map<string, string>();
/** Who emitted each path, so a collision can name both culprits. */
const origin = new Map<string, string>();
/** Permission bits for artifacts copied verbatim. A bundled `probe.sh` that arrives non-executable
 *  is a skill that cannot run its own script, and nothing else in the pipeline would notice. */
const modes = new Map<string, number>();

function emit(rel: string, body: string | Buffer, from: string, mode?: number): void {
  const text = Buffer.isBuffer(body) ? body.toString('utf8') : body;
  if (out.has(rel)) {
    die(
      `two sources both compile to ${rel}\n` +
        `  ${origin.get(rel)}\n  ${from}\n` +
        `  The common end drops the plugin directory, so a skill name is repo-global there. Rename one.`
    );
  }
  out.set(rel, text);
  origin.set(rel, from);
  if (mode !== undefined) modes.set(rel, mode & 0o777);
}

/** The source file's permission bits, for artifacts that are byte-for-byte copies. */
const modeOf = (file: string): number => fs.statSync(file).mode & 0o777;

const json = (o: unknown): string => JSON.stringify(o, null, 2) + '\n';

function walk(dir: string, base: string = dir, acc: string[] = []): string[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, base, acc);
    else acc.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return acc;
}

/** Only markdown is rendered (variants / PLUGIN_ROOT); scripts and data are copied verbatim. */
const isProse = (rel: string): boolean => /\.(md|mdx)$/.test(rel);
/**
 * Not shipped to users. `evals/` holds trigger fixtures and expected outputs — they exist to tune a
 * skill's description in this repo, and a consumer who installs the plugin has no use for them.
 * Keeping them in `src/` but out of the artifacts is the whole point of having a compile step.
 */
const NO_SHIP = [/\.test\.ts$/, /(^|\/)evals\//];

/**
 * Source files named per end: `probe.claude.sh` / `probe.codex.sh` → each end gets `probe.sh`.
 * Non-markdown files cannot carry HTML-comment variant blocks, so they diverge by filename.
 */
function endSuffix(rel: string): { rel: string; end: End | null } {
  const m = new RegExp(`^(.*)\\.(${ENDS.join('|')})(\\.[^.]+)$`).exec(rel);
  return m ? { rel: (m[1] as string) + (m[3] as string), end: m[2] as End } : { rel, end: null };
}

/** Render prose for one end, refusing to emit anything whose variant markers do not hold up. */
function prose(text: string, end: End, where: string): string {
  const problems = lintVariants(text);
  if (problems.length) die(`${where}\n  ${problems.join('\n  ')}`);
  return renderFor(text, end);
}

/** Where a skill file lands on each end. The common end has no plugin wrapper. */
const skillPath = (end: End, plugin: string, rel: string): string =>
  end === 'common' ? `common/skills/${rel}` : `${end}/plugins/${plugin}/skills/${rel}`;

const PLUGINS = fs.existsSync(R('src/plugins'))
  ? fs
      .readdirSync(R('src/plugins'))
      .filter((d) => fs.existsSync(R('src/plugins', d, 'plugin.json')))
      .sort()
  : [];
if (!PLUGINS.length) die('no plugin found under src/plugins/*/plugin.json');

const manifests: PluginManifest[] = [];

for (const p of PLUGINS) {
  const S = R('src/plugins', p);
  const m = JSON.parse(fs.readFileSync(path.join(S, 'plugin.json'), 'utf8')) as PluginManifest;
  if (m.name !== p) die(`src/plugins/${p}/plugin.json declares name "${m.name}" — it must match its directory`);
  manifests.push(m);

  // ── manifest: one source, one serialization per end that has the concept.
  //    The common end has no plugin manifest at all — nothing to emit.
  const src = `src/plugins/${p}/plugin.json`;
  const base = { name: m.name, version: m.version, description: m.description, author: m.author };
  emit(`claude/plugins/${p}/.claude-plugin/plugin.json`, json({ ...base, keywords: m.keywords.claude }), src);
  emit(
    `codex/plugins/${p}/.codex-plugin/plugin.json`,
    json({
      ...base,
      keywords: m.keywords.codex,
      skills: './skills/',
      ...(m.mcpServers ? { mcpServers: m.mcpServers } : {}),
      interface: m.interface,
    }),
    src
  );

  // ── plugin root files. `.mcp.json` is a Claude/Codex concept; the common tree is flat, so a
  //    per-plugin README has nowhere to go there.
  for (const rel of ['README.md', '.mcp.json']) {
    const f = path.join(S, rel);
    if (!fs.existsSync(f)) continue;
    const from = `src/plugins/${p}/${rel}`;
    const body = fs.readFileSync(f, 'utf8');
    for (const end of ENDS) {
      if (end === 'common') continue;
      // `.mcp.json` is data, but it carries a server command path — so it goes through the same
      // ${PLUGIN_ROOT} substitution as prose, or the Codex artifact would point at Claude's root.
      emit(`${end}/plugins/${p}/${rel}`, prose(body, end, from), from);
    }
  }

  // ── skills
  for (const rel of walk(path.join(S, 'skills'))) {
    if (NO_SHIP.some((re) => re.test(rel))) continue;
    const f = path.join(S, 'skills', rel);
    const from = `src/plugins/${p}/skills/${rel}`;
    const { rel: outRel, end: only } = endSuffix(rel);
    const targets: readonly End[] = only ? [only] : ENDS;
    const name = path.basename(outRel);

    // realization.json: the source carries a key per end; each end takes only its own half
    if (name === 'realization.json') {
      const r = JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, unknown>;
      for (const end of targets) {
        if (!(end in r)) die(`${from} has no "${end}" key, but ${end} is a compile target`);
        emit(skillPath(end, p, outRel), json(r[end]), from);
      }
      continue;
    }

    // SKILL.md: the description may diverge per end; the body goes through variant rendering
    if (name === 'SKILL.md') {
      const { meta, raw, body } = splitFrontmatter(fs.readFileSync(f, 'utf8'));
      const skill = meta['name'];
      if (!skill) die(`${from} frontmatter has no name:`);
      for (const end of targets) {
        const head = ['---', `name: ${skill}`, `description: ${descriptionFor(raw, end)}`, '---', ''].join('\n');
        emit(skillPath(end, p, outRel), head + prose(body, end, from), from);
      }

      // `command: true` ⇒ Claude additionally gets a **thin wrapper**.
      // Codex has no notion of commands, and the vendor-neutral layout has no agreed location for
      // one either, so every capability is implemented as a skill; Claude merely gains an explicit
      // entry point (`/<plugin>:<skill>`). The wrapper holds no logic — the logic lives only in the
      // skill, so there are never two copies to drift apart.
      if (meta['command'] === 'true' && targets.includes('claude')) {
        const fm = ['---', `description: ${descriptionFor(raw, 'claude')}`];
        for (const k of ['argument-hint', 'allowed-tools']) if (raw[k]) fm.push(`${k}: ${raw[k]}`);
        fm.push('---', '');
        emit(
          `claude/plugins/${p}/commands/${skill}.md`,
          fm.join('\n') +
            [
              `# /${p}:${skill}`,
              '',
              '<!-- GENERATED wrapper — the logic lives in the skill; do not add content here -->',
              '',
              `Invoke the **\`${p}:${skill}\`** skill to run this flow.`,
              '',
              'Additional instructions from the user (may be empty): $ARGUMENTS',
              '',
            ].join('\n'),
          from
        );
      }
      continue;
    }

    const body = fs.readFileSync(f, 'utf8');
    for (const end of targets) {
      if (isProse(outRel)) emit(skillPath(end, p, outRel), prose(body, end, from), from);
      else emit(skillPath(end, p, outRel), body, from, modeOf(f));
    }
  }

  // ── agents: one prose source, three serializations.
  //    Claude: bundled in the plugin. Codex: a plugin **cannot** bundle agents, so they land at the
  //    repo-level `codex/agents/` and the user copies them into ~/.codex/agents/ by hand — which is
  //    what the accompanying README explains. Common: plain markdown, no model field.
  const agentsDir = path.join(S, 'agents');
  if (fs.existsSync(path.join(agentsDir, 'README.md'))) {
    emit('codex/agents/README.md', fs.readFileSync(path.join(agentsDir, 'README.md'), 'utf8'), `src/plugins/${p}/agents/README.md`);
  }
  for (const f of walk(agentsDir)
    .filter((x) => x.endsWith('.md') && x !== 'README.md')
    .sort()) {
    const from = `src/plugins/${p}/agents/${f}`;
    const { meta, raw, body } = splitFrontmatter(fs.readFileSync(path.join(agentsDir, f), 'utf8'));
    const id = meta['name'] ?? path.basename(f, '.md');
    for (const t of [meta['tier'], ...ENDS.map((e) => meta[`tier-${e}`])]) {
      if (t && !isTier(t)) die(`tier "${t}" of agent ${id} is not one of ${Object.keys(TIER).join(' | ')}`);
    }
    const modelFor = (end: End): string | null => {
      const t = meta[`tier-${end}`] ?? meta['tier'];
      return t && isTier(t) ? TIER[t][end] : null;
    };

    // claude — markdown, model from the tier table
    const cm = ['---', `name: ${id}`, `description: ${descriptionFor(raw, 'claude')}`];
    const cModel = modelFor('claude');
    if (cModel) cm.push(`model: ${cModel}`);
    for (const k of ['effort', 'color', 'memory', 'tools']) if (meta[k]) cm.push(`${k}: ${meta[k]}`);
    cm.push('---', '');
    emit(`claude/plugins/${p}/agents/${id}.md`, cm.join('\n') + prose(body, 'claude', from), from);

    // codex — TOML, repo-level
    const esc = JSON.stringify;
    const tl = [`name = ${esc(id)}`, `description = ${esc(descriptionValueFor(meta, 'codex').replace(/`/g, ''))}`];
    const xModel = modelFor('codex');
    if (xModel) tl.push(`model = ${esc(xModel)}`);
    const eff = meta['effort-codex'] ?? meta['effort'];
    if (eff) tl.push(`model_reasoning_effort = ${esc(eff)}`);
    tl.push('developer_instructions = """', prose(body, 'codex', from).trim(), '"""', '');
    emit(`codex/agents/${id}.toml`, tl.join('\n'), from);

    // common — markdown with no model field; the host decides (see TIER in src/common.ts)
    const om = ['---', `name: ${id}`, `description: ${descriptionFor(raw, 'common')}`];
    if (meta['tools']) om.push(`tools: ${meta['tools']}`);
    om.push('---', '');
    emit(`common/agents/${id}.md`, om.join('\n') + prose(body, 'common', from), from);
  }

  // ── hooks: Claude-only, and not a capability (they are PreToolUse interception scripts), which
  //    is why they get their own source tree. A `hooks` field in .codex-plugin/plugin.json makes
  //    Codex's validator exit 1, and the common layout has no hook concept at all.
  for (const rel of walk(path.join(S, 'hooks'))) {
    const f = path.join(S, 'hooks', rel);
    const from = `src/plugins/${p}/hooks/${rel}`;
    const body = fs.readFileSync(f, 'utf8');
    if (isProse(rel)) emit(`claude/plugins/${p}/hooks/${rel}`, prose(body, 'claude', from), from);
    else emit(`claude/plugins/${p}/hooks/${rel}`, body, from, modeOf(f));
  }
}

// ── marketplaces: generated, so adding a plugin means adding a source directory and nothing else
const mkPath = R('src/marketplace.json');
if (!fs.existsSync(mkPath)) die('src/marketplace.json is missing (name / description / owner of the marketplace)');
const MK = JSON.parse(fs.readFileSync(mkPath, 'utf8')) as MarketplaceSource;
emit(
  '.claude-plugin/marketplace.json',
  json({
    $schema: 'https://json.schemastore.org/claude-code-marketplace.json',
    name: MK.name,
    description: MK.description,
    owner: MK.owner,
    plugins: manifests.map((m) => ({
      name: m.name,
      description: m.description,
      source: `./claude/plugins/${m.name}`,
    })),
  }),
  'src/marketplace.json'
);
emit(
  '.agents/plugins/marketplace.json',
  json({
    name: MK.name,
    interface: { displayName: MK.displayName ?? MK.name },
    plugins: manifests.map((m) => ({
      name: m.name,
      source: { source: 'local', path: `./codex/plugins/${m.name}` },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: m.category ?? 'Developer Tools',
    })),
  }),
  'src/marketplace.json'
);

// ───────────────────────── mode dispatch ─────────────────────────

/** Every root the compiler owns. Anything inside them the source does not produce is junk. */
const OUT_ROOTS = ['claude', 'codex', 'common', '.claude-plugin', '.agents'];

function pruneEmptyDirs(): void {
  for (let pass = 0; pass < 8; pass++) {
    for (const d of OUT_ROOTS) {
      const dirs: string[] = [];
      const collect = (x: string): void => {
        if (!fs.existsSync(x) || !fs.statSync(x).isDirectory()) return;
        for (const e of fs.readdirSync(x)) collect(path.join(x, e));
        dirs.push(x);
      };
      collect(R(d));
      for (const x of dirs) {
        try {
          if (!fs.readdirSync(x).length) fs.rmdirSync(x);
        } catch {
          /* not empty, leave it alone */
        }
      }
    }
  }
}

if (roundtrip) {
  const snap = new Map<string, Buffer>();
  for (const d of OUT_ROOTS) for (const rel of walk(R(d))) snap.set(`${d}/${rel}`, fs.readFileSync(R(d, rel)));
  for (const rel of out.keys()) if (fs.existsSync(R(rel))) fs.rmSync(R(rel));
  for (const [rel, body] of out) {
    fs.mkdirSync(path.dirname(R(rel)), { recursive: true });
    fs.writeFileSync(R(rel), body);
    const mode = modes.get(rel);
    if (mode !== undefined) fs.chmodSync(R(rel), mode);
  }
  const after = new Map<string, Buffer>();
  for (const d of OUT_ROOTS) for (const rel of walk(R(d))) after.set(`${d}/${rel}`, fs.readFileSync(R(d, rel)));
  const diffs: string[] = [];
  for (const [rel, buf] of snap) {
    const now = after.get(rel);
    if (!now) diffs.push(`not recreated after the clean (orphan — nothing in the source produces it): ${rel}`);
    else if (!now.equals(buf)) diffs.push(`content changed after the rebuild: ${rel}`);
  }
  for (const rel of after.keys()) if (!snap.has(rel)) diffs.push(`appeared out of nowhere: ${rel}`);
  if (diffs.length) {
    ui.list(diffs, '✗');
    ui.result(false, `clean→rebuild does not round-trip — ${diffs.length} discrepancy(ies) across ${after.size} file(s)`);
    ui.next('a source file is missing, or an artifact was hand-written and nothing regenerates it');
    process.exit(1);
  }
  ui.result(true, `clean→rebuild round-trips byte for byte — ${after.size} file(s) compared`);
  ui.next('the source is complete, and no artifact is left unbacked by it');
  process.exit(0);
}

if (clean) {
  let n = 0;
  for (const rel of out.keys()) {
    if (fs.existsSync(R(rel))) {
      fs.rmSync(R(rel));
      n++;
    }
  }
  pruneEmptyDirs();
  ui.result(true, `deleted ${n} artifact(s)`);
  ui.next(
    'the artifacts are committed to the repo, so git will now show mass deletions',
    '`make build` restores them · `make rebuild` proves the source can regenerate every one'
  );
  process.exit(0);
}

/** `[glyph, description]` — `−` for an artifact that is gone, `~` for one that drifted. */
const problems: [string, string][] = [];
/** `[glyph, path]` — `+` for a file that did not exist, `~` for one whose bytes changed. */
const actions: [string, string][] = [];
for (const [rel, body] of out) {
  const abs = R(rel);
  const exists = fs.existsSync(abs);
  const have = exists ? fs.readFileSync(abs, 'utf8') : null;
  const wantMode = modes.get(rel);
  // A copied script can drift in its permission bits alone — same bytes, no longer executable.
  const modeDrift = exists && wantMode !== undefined && (fs.statSync(abs).mode & 0o777) !== wantMode;
  if (have === body && !modeDrift) continue;
  if (check) {
    problems.push(
      have === null
        ? ['−', `${rel} — missing`]
        : have !== body
          ? ['~', `${rel} — differs from the source`]
          : ['~', `${rel} — permission bits differ, want ${wantMode?.toString(8)}`]
    );
  } else {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
    if (wantMode !== undefined) fs.chmodSync(abs, wantMode);
    actions.push([have === null ? '+' : '~', rel]);
  }
}
/** A file in an artifact tree that the source does not generate = an orphan. `--check` has to
 *  block it, or else "the trees are artifacts in their entirety" is simply untrue. */
const orphans: string[] = [];
for (const d of OUT_ROOTS) for (const rel of walk(R(d))) if (!out.has(`${d}/${rel}`)) orphans.push(`${d}/${rel}`);

if (check) {
  if (problems.length || orphans.length) {
    const summary: string[] = [];
    if (problems.length) {
      summary.push(`${problems.length} out of sync with the source`);
      for (const [glyph, text] of problems.slice(0, 30)) ui.detail(text, glyph);
      if (problems.length > 30) ui.detail(`… ${problems.length - 30} more (${problems.length} in total)`);
    }
    if (orphans.length) {
      summary.push(`${orphans.length} orphan(s) with nothing in the source behind them`);
      ui.list(orphans, '?');
    }
    ui.step(false, `artifacts — ${summary.join(', ')}`);
    ui.next(
      '`make build` recompiles — a hand edit to an artifact is lost, edit src/ instead',
      ...(orphans.length ? ['an orphan must move into src/ or be deleted — no artifact tree holds hand-written files'] : [])
    );
    process.exit(1);
  }
  ui.step(true, `artifacts in sync with the source — ${out.size}, no orphans`);
  process.exit(0);
}

// `generated` and `updated` as line prefixes make the column that actually varies — the path —
// start at a ragged offset. A glyph carries the same distinction in one fixed column: + new, ~ changed.
for (const [glyph, rel] of actions.slice(0, 25)) ui.detail(rel, glyph);
if (actions.length > 25) ui.detail(`… ${actions.length - 25} more (${actions.length} in total)`);
// The artifacts are 100% generated ⇒ an orphan is by definition residue from an earlier compile
// (a file since deleted from the source). Sweep them away and name each one — leaving them
// standing makes "the trees are artifacts in their entirety" false.
if (orphans.length) {
  for (const o of orphans) fs.rmSync(R(o));
  pruneEmptyDirs();
  if (actions.length) console.log('');
  ui.detail(`swept ${orphans.length} leftover artifact(s) — nothing in the source produces them:`);
  ui.list(orphans, '−', 12);
}
ui.result(
  true,
  actions.length
    ? `compiled — ${actions.length} change(s), ${out.size} artifacts in total`
    : `already up to date — ${out.size} artifacts`
);
