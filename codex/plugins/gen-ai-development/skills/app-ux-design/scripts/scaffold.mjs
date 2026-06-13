#!/usr/bin/env node
// scaffold.mjs — copies the template into a working dir and prepares it for `pnpm dev`.
//
// Usage:
//   node <skill>/scripts/scaffold.mjs --topic <topic> [--project-root <dir>] [--no-install]
//   node <skill>/scripts/scaffold.mjs --out <explicit-dir> [--name <slug>] [--no-install]   (escape hatch)
//
// What it does:
//   1. Resolves working dir to <project-root>/docs/ued/<datetime>-<topic>/ (default).
//      The datetime prefix (YYYYMMDD-HHMMSS) keeps each design session in its own
//      isolated, sortable directory — resume = find the matching/most-recent one.
//   2. Copies template/ into it (skips node_modules / dist / .ued).
//   3. Rewrites package.json `name` to the topic slug.
//   4. Rewrites the `app-ux-framework` dep to the absolute framework path.
//   5. Initializes .ued/ for cross-phase state (brief.md + .skill-root pointer + assets/ + screens.json).
//   6. Creates design-system/ for ui-ux-pro-max's persisted MASTER.md.
//   7. Writes a .gitignore so node_modules / dist / pnpm-store stay out of git.
//   8. Runs `pnpm install` (unless --no-install).
//   9. Prints the RESOLVED working dir path — the agent needs it for the next commands.
//
// Convention: never scaffold to /tmp. Working dirs live in the repo at
// docs/ued/<datetime>-<topic>/, so brief / design system / inspect events /
// source are all version-controlled alongside the project.

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, "..");
const TEMPLATE_DIR = path.join(SKILL_ROOT, "template");
const FRAMEWORK_DIR = path.join(SKILL_ROOT, "framework");

const argv = parseArgs(process.argv.slice(2));
if (argv.help || argv.h) {
  printHelp();
  process.exit(0);
}

const topic = argv.topic ? sanitizeSlug(argv.topic) : null;
const slug = sanitizeSlug(argv.name || topic || "app-ux-prototype");
const projectRoot = path.resolve(argv["project-root"] || process.cwd());
const dirName = topic ? `${timestamp()}-${topic}` : null;
const outDir = path.resolve(
  argv.out
    || (dirName ? path.join(projectRoot, "docs", "ued", dirName) : null)
    || (() => {
      console.error("✗ Must pass either --topic <slug> or --out <dir>.");
      console.error("  Example: node scaffold.mjs --topic acme-dashboard --project-root /path/to/repo");
      process.exit(2);
    })(),
);
const doInstall = !argv["no-install"];

main().catch((err) => {
  console.error("✗ scaffold failed:", err.message || err);
  process.exit(1);
});

async function main() {
  if (!existsSync(TEMPLATE_DIR)) {
    throw new Error(`Template directory missing: ${TEMPLATE_DIR}`);
  }
  if (existsSync(outDir) && readdirSync(outDir).length > 0) {
    throw new Error(`Working directory not empty: ${outDir}. Use --out <fresh-dir>.`);
  }
  mkdirSync(outDir, { recursive: true });
  console.log(`→ Copying template → ${outDir}`);
  copyTree(TEMPLATE_DIR, outDir);

  // Rewrite package.json
  const pkgPath = path.join(outDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  pkg.name = slug;
  if (pkg.devDependencies && pkg.devDependencies["app-ux-framework"]) {
    pkg.devDependencies["app-ux-framework"] = `file:${FRAMEWORK_DIR}`;
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`→ Rewrote package.json (name=${slug}, app-ux-framework=file:${FRAMEWORK_DIR})`);

  // .gitignore — the working dir lives in the repo, so keep heavy/derived junk
  // out of git. We deliberately DO track .ued/ and design-system/ (brief,
  // design system, inspect events) since those are the project's design record.
  writeFileSync(
    path.join(outDir, ".gitignore"),
    "node_modules/\ndist/\n.pnpm-store/\n*.log\n.DS_Store\n",
  );

  // State dir
  const stateDir = path.join(outDir, ".ued");
  mkdirSync(stateDir, { recursive: true });
  // Tell the framework where the canonical skill root lives — pnpm may copy the
  // framework into .pnpm/ so it can't find data/ via __dirname.
  writeFileSync(path.join(stateDir, ".skill-root"), SKILL_ROOT);

  // Assets dir — where the user / agent drop reference screenshots, design
  // mocks, exported brand assets. Tracked by git so they survive resume.
  const assetsDir = path.join(stateDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(path.join(assetsDir, ".gitkeep"), "");

  // Design-system dir — ui-ux-pro-max --persist writes MASTER.md here; the
  // "延续设计" (continuation) mode reads it back on a later session.
  const dsDir = path.join(outDir, "design-system");
  mkdirSync(path.join(dsDir, "pages"), { recursive: true });
  writeFileSync(path.join(dsDir, "pages", ".gitkeep"), "");

  // Screen registry — source of truth for which screens exist. The agent
  // reads/writes this; /__ued/shell uses it for the screen switcher. Seeded
  // with the one "home" screen the template ships.
  const screensPath = path.join(stateDir, "screens.json");
  if (!existsSync(screensPath)) {
    writeFileSync(screensPath, JSON.stringify({
      version: 1,
      screens: [
        { id: "home", name: "Home", route: "/", file: "src/screens/home/index.tsx", status: "scaffolded" },
      ],
    }, null, 2) + "\n");
  }

  if (!existsSync(path.join(stateDir, "brief.md"))) {
    writeFileSync(path.join(stateDir, "brief.md"), briefTemplate(slug));
  }
  console.log(`→ Initialized .ued/ (assets/, screens.json, brief.md) + design-system/`);

  // Install
  if (doInstall) {
    console.log(`→ Running pnpm install …`);
    const r = spawnSync("pnpm", ["install"], { cwd: outDir, stdio: "inherit" });
    if (r.status !== 0) {
      console.warn(`! pnpm install exited with code ${r.status}. You may need to run it manually.`);
    }
  } else {
    console.log(`→ Skipped install (--no-install). Run \`pnpm install\` in ${outDir} before \`pnpm dev\`.`);
  }

  console.log(`\n✓ Scaffolded.\n`);
  console.log(`  WORKING_DIR=${outDir}`);
  console.log(`  Next steps:`);
  console.log(`    cd ${outDir}`);
  console.log(`    pnpm dev`);
  console.log(`  Then open:`);
  console.log(`    http://localhost:5173/__ued/shell    (preview + inspect)\n`);
}

function briefTemplate(slug) {
  return `# App UX Brief — ${slug}

_Filled out by the agent during 阶段/模式识别 + 需求对齐._

## Mode
<!-- One of: 全新设计 (greenfield) | 参考设计 (reference) | 延续设计 (continuation)
     全新设计  — brand-new design, no reference and no prior spec. Design from scratch.
     参考设计  — user provides a reference (screenshots / a product / a site) AND the
                 scope to borrow (e.g. only palette, only layout, only interaction).
                 Record the reference + the borrowed scope precisely.
     延续设计  — user provides an existing design spec (usually a prior
                 design-system/MASTER.md). Extend it; do not reinvent committed tokens. -->
- (unset)

## References
<!-- Drop screenshots / design mocks into .ued/assets/. List each here with a
     one-line note on WHAT to look at and (for 参考设计) WHICH dimension to borrow.
     Example:
       - assets/competitor-feed.png — borrow the feed card layout ONLY, not its colors
       - assets/brand-export.png — borrow the palette + logo treatment -->

## Function
<!-- The 2–3 primary jobs this surface lets the user do. -->

## Audience
<!-- Consumer / power user / developer / admin / first-time visitor. -->

## Platform
<!-- web (desktop / responsive) | mobile (iOS/Android) | desktop app | pad. Drives
     the default device frame in /__ued/shell. -->

## Product type
<!-- SaaS / e-commerce / dashboard / landing / portfolio / social / tool / dev tool.
     Feed this into the ui-ux-pro-max --design-system query. -->

## Locales
<!-- Primary + secondary languages. Drives :lang() font stacks in tokens.css.
     Default for Chinese-context tools: zh-Hans + en. -->
- Primary: zh-Hans
- Secondary: en

## Brand / vibe
<!-- Minimal / playful / dense / editorial / brutalist / corporate / immersive;
     any existing brand colors / fonts to honor. -->

## Constraints
<!-- Accessibility tier, dark mode requirement, perf budget, copy tone. -->

## Keywords
<!-- The multi-dimensional keyword string handed to ui-ux-pro-max, e.g.
     "fintech dashboard data-dense dark professional". -->
`;
}

function copyTree(src, dst) {
  const stack = [{ s: src, d: dst }];
  while (stack.length) {
    const { s, d } = stack.pop();
    const stat = statSync(s);
    if (stat.isDirectory()) {
      mkdirSync(d, { recursive: true });
      for (const name of readdirSync(s)) {
        if (name === "node_modules" || name === "dist" || name === ".ued") continue;
        stack.push({ s: path.join(s, name), d: path.join(d, name) });
      }
    } else {
      copyFileSync(s, d);
    }
  }
}

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith("--")) { out[key] = true; }
      else { out[key] = next; i++; }
    } else if (a.startsWith("-")) {
      out[a.slice(1)] = true;
    }
  }
  return out;
}

function sanitizeSlug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "app-ux-prototype";
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function printHelp() {
  console.log(`scaffold.mjs — copy template into a working directory and prepare it.

Usage (preferred):
  node scaffold.mjs --topic <topic> [--project-root <dir>] [--no-install]

Usage (escape hatch):
  node scaffold.mjs --out <dir> [--name <slug>] [--no-install]

Options:
  --topic <slug>        Logical project name. Working dir resolved to
                        <project-root>/docs/ued/<datetime>-<topic>/.
  --project-root <dir>  Repo root for the docs/ tree (default: cwd).
  --out <dir>           Explicit target directory (overrides --topic).
                        Use only for one-off experiments outside docs/ued/.
  --name <slug>         package.json name (default: --topic, or "app-ux-prototype").
  --no-install          Skip pnpm install (run it manually later).
  --help                Print this help.

On success the last lines print WORKING_DIR=<resolved path> — capture it; every
later command (pnpm dev, reading .ued/, save) needs that exact path.
`);
}
