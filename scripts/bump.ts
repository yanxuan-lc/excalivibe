#!/usr/bin/env node
/**
 * Change a plugin's version.
 *
 * The version exists in exactly one place — `src/plugins/<name>/plugin.json`. Both plugin
 * manifests and `package.json` derive from it at compile time, so **never edit a version by
 * hand**: an edit reaches the source but not the artifacts, and `make check` then fails on a
 * repository that looks correct in the one file anybody opened.
 *
 *   node scripts/bump.ts <plugin> <major|minor|patch|x.y.z>
 *
 * Recompiling is the caller's job (`make bump` chains it). Splitting them keeps this script
 * doing one thing, and makes the two-step visible in the Makefile rather than hidden here.
 *
 * Exit codes: 0 success · 2 usage or environment error
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ui from './ui.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const [plugin, level] = process.argv.slice(2);

function die(msg: string, ...hints: string[]): never {
  ui.result(false, msg);
  if (hints.length) ui.next(...hints);
  process.exit(2);
}

if (plugin === undefined || level === undefined) {
  die('bump needs a plugin and a level', 'node scripts/bump.ts <plugin> <major|minor|patch|x.y.z>');
}

const srcPath = path.join(ROOT, 'src', 'plugins', plugin, 'plugin.json');
if (!fs.existsSync(srcPath)) {
  const available = fs
    .readdirSync(path.join(ROOT, 'src', 'plugins'))
    .filter((d) => fs.existsSync(path.join(ROOT, 'src', 'plugins', d, 'plugin.json')));
  die(`no such plugin: ${plugin}`, `available: ${available.join(' · ')}`);
}

const manifest = JSON.parse(fs.readFileSync(srcPath, 'utf8')) as { version: string } & Record<string, unknown>;
const current = manifest.version;

/** SemVer only, and no pre-release arithmetic — `major` on `1.2.3-rc.1` has no obvious answer. */
function next(from: string, how: string): string {
  if (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(how)) return how;
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(from);
  if (!m) die(`the current version "${from}" is not plain SemVer`, 'pass an explicit x.y.z instead');
  const [major, minor, patch] = m.slice(1).map(Number) as [number, number, number];
  if (how === 'major') return `${major + 1}.0.0`;
  if (how === 'minor') return `${major}.${minor + 1}.0`;
  if (how === 'patch') return `${major}.${minor}.${patch + 1}`;
  return die(`unknown level "${how}"`, 'expected: major | minor | patch | an explicit x.y.z');
}

const target = next(current, level);
if (target === current) {
  die(
    `${plugin} is already at ${current}`,
    'a version cannot be published twice — the registry rejects a re-used number'
  );
}

manifest.version = target;
fs.writeFileSync(srcPath, JSON.stringify(manifest, null, 2) + '\n');

ui.result(true, `${plugin}  ${current} → ${target}`);
ui.detail(`src/plugins/${plugin}/plugin.json — the only place the number lives`, '~');
ui.next('make build — so both manifests and package.json catch up');
