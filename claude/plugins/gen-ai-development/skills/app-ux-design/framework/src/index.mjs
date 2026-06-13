// app-ux-framework — Vite plugin entry.
//
// Wires three things into a Vite dev server:
//   1. /__ued/shell    — device-frame outer page with an iframe to the user app
//   2. /__ued/* APIs   — device catalog, raw state read/write, inspect event log
//   3. Inspect bridge  — injected into every HTML page via transformIndexHtml,
//                        listens for postMessage from the shell and reports the
//                        element the user picked + the edits they made.
//
// There is no in-browser style picker. The design conversation runs through the
// ui-ux-pro-max skill in chat; the agent writes the chosen tokens straight into
// src/styles/tokens.css, and Vite HMR pushes them to the running app. So the
// framework's only jobs are: frame the app on the right device, and capture
// inspect feedback into a log the agent can replay onto source.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { createStateApi } from "./middleware/state.mjs";
import { createDevicesApi } from "./middleware/devices.mjs";
import { createInspectApi } from "./middleware/inspect.mjs";
import { createApplyApi } from "./middleware/apply.mjs";
import { createShellPage } from "./pages/shell.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_ROOT = path.resolve(__dirname, "..");
const SKILL_ROOT = path.resolve(FRAMEWORK_ROOT, "..");

// File we probe to confirm a path really is the skill root (holds data/).
const SKILL_ROOT_MARKER = path.join("data", "devices.json");

/**
 * @typedef {object} AppUxFrameworkOptions
 * @property {string} [stateDir=".ued"]   Cross-phase state dir (relative to project).
 * @property {string} [skillRoot]         Override skill root path (auto-detected).
 * @property {boolean} [injectBridge=true]  Inject inspect-bridge.js into served HTML.
 */

/**
 * @param {AppUxFrameworkOptions} [options]
 * @returns {import("vite").Plugin}
 */
export function uedFramework(options = {}) {
  const opts = {
    stateDir: ".ued",
    skillRoot: SKILL_ROOT,
    injectBridge: true,
    ...options,
  };

  /** @type {string} */
  let projectRoot;

  return {
    name: "app-ux-framework",
    enforce: "post",

    // Keep Vite's file watcher OUT of the state dir. The inspect log, cursor, and
    // apply-request/result files live under <stateDir> inside the project root, so
    // Vite watches them by default — and every appended inspect event (each blur /
    // edit) is a change to a NON-module file, which Vite answers with a full page
    // reload. That reloads the app iframe mid-edit and closes any open dialog/tab.
    // Ignoring the dir means logging an edit never reloads; only real source writes
    // do (and those are React Fast Refresh, which preserves UI state).
    config() {
      const dir = opts.stateDir.replace(/^\.?\/+/, "").replace(/\/+$/, "");
      return { server: { watch: { ignored: [`**/${dir}/**`] } } };
    },

    configResolved(config) {
      projectRoot = config.root;
    },

    configureServer(server) {
      const stateDir = path.resolve(projectRoot, opts.stateDir);
      // Resolve skillRoot. Priority: explicit option → .ued/.skill-root pointer
      // (written by scaffold.mjs) → env var → __dirname-based default. pnpm may
      // copy the framework into .pnpm/, so __dirname can't always find data/.
      const hasMarker = (root) => root && existsSync(path.join(root, SKILL_ROOT_MARKER));
      let resolvedSkillRoot = opts.skillRoot;
      if (!hasMarker(resolvedSkillRoot)) {
        const pointer = path.join(stateDir, ".skill-root");
        if (existsSync(pointer)) {
          const p = readFileSync(pointer, "utf-8").trim();
          if (hasMarker(p)) resolvedSkillRoot = p;
        }
      }
      if (!hasMarker(resolvedSkillRoot)) {
        if (hasMarker(process.env.UED_SKILL_ROOT)) resolvedSkillRoot = process.env.UED_SKILL_ROOT;
        else resolvedSkillRoot = SKILL_ROOT;
      }
      const ctx = {
        projectRoot,
        stateDir,
        skillRoot: resolvedSkillRoot,
      };

      // API endpoints
      server.middlewares.use("/__ued/state", createStateApi(ctx));
      server.middlewares.use("/__ued/devices", createDevicesApi(ctx));
      server.middlewares.use("/__ued/inspect-event", createInspectApi(ctx).append);
      server.middlewares.use("/__ued/inspect-events", createInspectApi(ctx).read);
      server.middlewares.use("/__ued/apply", createApplyApi(ctx));

      // Static overlay assets (inspect bridge + shell static js/css)
      server.middlewares.use("/__ued/overlay", (req, res, next) => {
        const rel = (req.url || "/").split("?")[0].replace(/^\//, "");
        const file = path.join(FRAMEWORK_ROOT, "overlay", rel);
        if (!existsSync(file)) return next();
        const ext = path.extname(file).toLowerCase();
        const mime = ext === ".js" ? "application/javascript; charset=utf-8"
                   : ext === ".css" ? "text/css; charset=utf-8"
                   : ext === ".html" ? "text/html; charset=utf-8"
                   : ext === ".json" ? "application/json; charset=utf-8"
                   : "application/octet-stream";
        res.statusCode = 200;
        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "no-store");
        res.end(readFileSync(file));
      });

      // Shell page
      server.middlewares.use("/__ued/shell", (req, res, next) => {
        if (req.method !== "GET") return next();
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(createShellPage(ctx, req.url || ""));
      });

      // Friendly index for /__ued
      server.middlewares.use("/__ued", (req, res, next) => {
        const url = (req.url || "/").split("?")[0];
        if (url !== "/" && url !== "") return next();
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(indexHtml());
      });

      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        const port = typeof addr === "object" && addr ? addr.port : (server.config.server.port ?? 5173);
        // eslint-disable-next-line no-console
        console.log(`\n  app-ux-framework ready`);
        // eslint-disable-next-line no-console
        console.log(`    Shell:  http://localhost:${port}/__ued/shell   (preview + inspect)`);
        // eslint-disable-next-line no-console
        console.log(`    App:    http://localhost:${port}/                (bare app)`);
        // eslint-disable-next-line no-console
        console.log(`    State:  ${ctx.stateDir}\n`);
      });
    },

    transformIndexHtml(html, ctx) {
      if (!opts.injectBridge) return html;
      // Don't inject into the framework's own pages (they include their own logic).
      if (ctx?.path?.startsWith("/__ued/")) return html;
      const tag = `<script type="module" src="/__ued/overlay/inspect-bridge.js"></script>`;
      if (html.includes("</body>")) return html.replace("</body>", `${tag}\n</body>`);
      return html + tag;
    },
  };
}

function indexHtml() {
  return `<!doctype html><meta charset="utf-8"><title>app-ux-framework</title>
  <body style="font:14px/1.5 -apple-system,system-ui,sans-serif;max-width:42rem;margin:5rem auto;padding:0 1.5rem;color:#222">
    <h1 style="font-size:1.5rem;font-weight:600">app-ux-framework</h1>
    <p>This Vite dev server has the app-ux-design framework enabled.</p>
    <ul>
      <li><a href="/__ued/shell">/__ued/shell</a> — device-frame shell wrapping your app, with the inspect overlay</li>
      <li><a href="/">/</a> — your application directly</li>
    </ul>
    <p style="color:#666;font-size:12px">Edit <code>src/styles/tokens.css</code> to retheme; Vite HMR pushes changes to the shell instantly. Toggle inspect in the shell to point at elements and leave edits the agent will apply.</p>
  </body>`;
}
