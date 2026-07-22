#!/usr/bin/env node
/* ============================================================
   mdx-artifact · serve.mjs —— 多文档实时预览服务器
   一个服务托管任意 mdx：URL 用 ?doc=<路径> 区分；改文件热重渲染 + 浏览器自动刷新。
   用法：node serve.mjs [初始mdx] [--port 4321] [--root <目录>] [--no-open]
        npm run preview -- <mdx路径>
   ============================================================ */
import http from "node:http";
import { readFileSync, watch, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, relative, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { render } from "./render.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, "../assets");
const SRC = resolve(__dirname, "../src");

let port = 4321, root = process.cwd(), noOpen = false, initial = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--port") port = Number(argv[++i]);
  else if (a === "--root") root = resolve(argv[++i]);
  else if (a === "--no-open") noOpen = true;
  else if (!a.startsWith("--")) initial = initial || a;
}
root = resolve(root);
const enc = encodeURIComponent;
const resolveDoc = (p) => resolve(root, p);

const RELOAD = (abs) => `<script>try{new EventSource('/__reload?doc=${enc(abs)}').onmessage=function(){location.reload()}}catch(e){}</script>`;
const errPage = (msg) => `<!doctype html><meta charset="utf-8"><body style="font:14px/1.6 ui-monospace,monospace;padding:32px;color:#c0344e"><h2>渲染出错</h2><pre style="white-space:pre-wrap">${String(msg).replace(/</g, "&lt;")}</pre></body>`;

// 多文档导航：把正文里指向本地 .md/.mdx/目录的相对链接改写成 ?doc= 路由，
// 使一棵 .mdx 文档树（如 docs/tech）用自然的相对链接即可在预览内互跳。
// 跳过外链 / 锚点 / 绝对路径 / 非文档资源；目录链接按 README.mdx 索引约定解析。
function rewriteLinks(html, abs) {
  const baseDir = dirname(abs);
  // 先屏蔽 <script>/<style> 块再改写：内联 JS/CSS（如 mermaid 运行时）里可能含 `<a href="...">`
  // 字面片段，若一并改写会破坏脚本导致解析失败（图渲染全崩）。用占位符抠出、改写正文、再还原。
  const stash = [];
  const masked = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (block) => {
    stash.push(block);
    return `@@MDXMASK${stash.length - 1}@@`;
  });
  const rewritten = masked.replace(/<a\s+([^>]*?)href="([^"#][^"]*)"/gi, (m, pre, href) => {
    if (/^(https?:|mailto:|tel:|data:|\/|\?doc=)/i.test(href)) return m;
    const hashIdx = href.indexOf("#");
    let path = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
    const hash = hashIdx >= 0 ? href.slice(hashIdx) : "";
    if (!path) return m;
    let target = resolve(baseDir, path);
    const isDir = path.endsWith("/") || (existsSync(target) && statSync(target).isDirectory());
    if (isDir) target = join(target, "README.mdx");
    else if (!/\.mdx?$/.test(target)) return m; // 只路由文档链接，别碰图片/其它资源
    return `<a ${pre}href="/?doc=${enc(target)}${hash}"`;
  });
  return rewritten.replace(/@@MDXMASK(\d+)@@/g, (_, i) => stash[+i]);
}

async function renderFile(abs) {
  let html = await render(readFileSync(abs, "utf8"), pathToFileURL(abs).href);
  html = rewriteLinks(html, abs);
  // 注入 live-reload 脚本必须锚在「文档真正的结尾 </body>」——用 lastIndexOf，
  // 因为内联的 mermaid 运行时 JS 里含字面 `</body></html>`（iframe 模板串），
  // String.replace 会命中那个而把脚本塞进 bundle 中间，导致解析崩溃、全图不渲染。
  const i = html.lastIndexOf("</body>");
  return i < 0 ? html + RELOAD(abs) : html.slice(0, i) + `${RELOAD(abs)}\n` + html.slice(i);
}

const clients = new Map();
const watchedDirs = new Set();
const timers = {};
const notify = (abs) => { const s = clients.get(abs); if (s) s.forEach((r) => r.write("data: reload\n\n")); };
const notifyAll = () => clients.forEach((s) => s.forEach((r) => r.write("data: reload\n\n")));
function ensureWatch(abs) {
  const dir = dirname(abs);
  if (watchedDirs.has(dir)) return;
  watchedDirs.add(dir);
  try { watch(dir, (_e, fn) => { if (!fn) return; const c = resolve(dir, fn.toString()); clearTimeout(timers[c]); timers[c] = setTimeout(() => notify(c), 90); }); } catch (e) {}
}
// 组件/样式变更 → 全量刷新（但 render.mjs 已被 import 缓存，改组件需重启服务）
try { watch(SRC, { recursive: true }, () => { clearTimeout(timers.__src); timers.__src = setTimeout(notifyAll, 90); }); } catch (e) {}
try { watch(ASSETS, { recursive: true }, () => { clearTimeout(timers.__a); timers.__a = setTimeout(notifyAll, 90); }); } catch (e) {}

function listDocs(dir, depth, out) {
  if (depth > 6 || out.length > 300) return;
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "vendor") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) listDocs(full, depth + 1, out);
    else if (e.name.endsWith(".mdx")) out.push(full);
  }
}
function indexPage() {
  const docs = []; listDocs(root, 0, docs);
  const items = docs.sort().map((f) => `<li><a href="/?doc=${enc(f)}">${relative(root, f) || f}</a></li>`).join("") || "<li style='color:#888'>root 下没找到 .mdx</li>";
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>mdx-artifact 预览</title>
<body style="font:15px/1.6 -apple-system,'PingFang SC',sans-serif;max-width:760px;margin:48px auto;padding:0 24px;color:#1a1a1a">
<h1 style="font-size:20px">mdx-artifact 预览</h1><p style="color:#666;font-size:13px">root：<code>${root}</code></p><ul style="line-height:2">${items}</ul></body>`;
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (u.pathname === "/__reload") {
    const doc = u.searchParams.get("doc");
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write("retry: 500\n\n");
    if (doc) { if (!clients.has(doc)) clients.set(doc, new Set()); clients.get(doc).add(res); ensureWatch(doc); req.on("close", () => { const s = clients.get(doc); if (s) s.delete(res); }); }
    return;
  }
  const docParam = u.searchParams.get("doc");
  if (!docParam) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(indexPage()); return; }
  const abs = resolveDoc(docParam);
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  if (!existsSync(abs)) { res.end(errPage("找不到文件：" + abs)); return; }
  ensureWatch(abs);
  try { res.end(await renderFile(abs)); }
  catch (e) { console.error("✗", e.message); res.end(errPage(e.stack || e.message)); }
}).listen(port, () => {
  const base = `http://localhost:${port}`;
  const url = initial ? `${base}/?doc=${enc(resolveDoc(initial))}` : base;
  console.error(`▸ mdx-artifact 预览  ${base}`);
  console.error(`  root: ${root}${initial ? "\n  打开: " + url : ""}`);
  console.error("  改 mdx 即热重渲染（改组件/样式需重启）· Ctrl-C 退出");
  if (process.platform === "darwin" && !noOpen) execFile("open", [url], () => {});
});
