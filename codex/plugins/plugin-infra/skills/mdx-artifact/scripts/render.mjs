#!/usr/bin/env node
/* ============================================================
   mdx-artifact · render.mjs
   MDX（markdown + 组件）→ 构建期 React SSG → 自包含单文件 HTML。
   - 组件注册表（OCP）渲染，运行时零 React
   - 内联 theme.css + 轻交互 runtime.js；Math 用 KaTeX（woff2 base64 内联）
   - frontmatter 驱动主题与自动 Hero/Footer 骨架
   用法：node render.mjs <input.mdx> [output.html]
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluate } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import * as jsxRuntime from "react/jsx-runtime";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { components, resetIds } from "../src/components/registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../src");
const ASSETS = resolve(__dirname, "../assets");
const KATEX = resolve(ASSETS, "vendor/katex");
const h = React.createElement;
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function parseFrontmatter(mdx) {
  const m = mdx.match(/^\s*---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: mdx };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v === "true") v = true; else if (v === "false") v = false;
    meta[kv[1]] = v;
  }
  return { meta, body: mdx.slice(m[0].length) };
}

function katexCssInlined() {
  let css = readFileSync(resolve(KATEX, "katex.min.css"), "utf8");
  css = css.replace(/url\(fonts\/([A-Za-z0-9_.-]+\.woff2)\)/g, (m, f) =>
    `url(data:font/woff2;base64,${readFileSync(resolve(KATEX, "fonts", f)).toString("base64")})`);
  css = css.replace(/,\s*url\(fonts\/[^)]+\.(?:woff|ttf)\)\s*format\("[^"]+"\)/g, "");
  return css;
}

export async function render(mdx, inputUrl) {
  const { meta, body } = parseFrontmatter(mdx);

  // MDX → React 组件
  const { default: Content } = await evaluate(body, { ...jsxRuntime, remarkPlugins: [remarkGfm], baseUrl: inputUrl || pathToFileURL(process.cwd() + "/").href });

  resetIds();
  const content = renderToStaticMarkup(h(Content, { components }));

  const hasHero = /<Hero[\s/>]/.test(body);
  const hasFooter = /<Footer[\s/>]/.test(body);
  const chromeOff = meta.chrome === "off";

  let autoHero = "";
  if (!chromeOff && !hasHero && meta.title) {
    autoHero = renderToStaticMarkup(h(components.Hero, {
      title: meta.title, sub: meta.subtitle, eyebrow: meta.eyebrow,
      date: [meta.date, meta.org].filter(Boolean).join(" · ") || undefined,
    }));
  }

  // 生成时间戳：在渲染那一刻自动捕获，精确到秒——机器事实，无需作者填写，且始终存在。
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  const genTime = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
  // 作者 Agent 不可由机器推导，仍是必填；缺失时兜底并告警（不硬失败，保证可渲染）。
  const author = meta.author || "AI Agent";
  if (!meta.author) console.error(`⚠ frontmatter 未声明 author（撰写此文档的 Agent）：已用「AI Agent」兜底。建议写明具体模型/Agent。`);
  const copyright = meta.copyright || (meta.org ? `© ${now.getFullYear()} ${meta.org}` : `© ${now.getFullYear()}`);

  // 叙述页脚（可选寄语）：来自 <Footer> 组件或 frontmatter footer。
  let footer = "";
  if (!chromeOff && !hasFooter && meta.footer) {
    footer = renderToStaticMarkup(h(components.Footer, null, h("p", { className: "ft" }, meta.footer)));
  }
  // 版本记（落款）：始终追加。只传「用户实际信息」——版权 / 撰写模型 / 生成时间；
  // ExcaliVibe 品牌推广（名称/版本/许可/GitHub）由 Colophon 组件内的固定常量输出，与用户数据分离。
  const colophon = chromeOff ? "" : renderToStaticMarkup(h(components.Colophon,
    { copyright, author, time: genTime }));

  const all = autoHero + content + footer + colophon;
  const mathUsed = /class="katex/.test(all);

  // TOC
  let toc = "";
  if (meta.toc === true) {
    const items = [];
    const re = /<section class="da-section[^"]*" id="([^"]+)">[\s\S]*?<p class="st">([\s\S]*?)<\/p>/g;
    let m;
    while ((m = re.exec(content))) items.push({ id: m[1], title: m[2].replace(/<[^>]+>/g, "") });
    if (items.length) toc = `<nav class="da-toc"><p class="tl">目录</p>${items.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join("")}</nav>`;
  }

  const themeCss = readFileSync(resolve(SRC, "styles/theme.css"), "utf8");
  const runtimeJs = readFileSync(resolve(ASSETS, "runtime.js"), "utf8");
  const mathCss = mathUsed ? katexCssInlined() : "";

  const mode = meta.mode === "dark" || meta.mode === "auto" ? meta.mode : "light";
  const palette = meta.palette || "indigo";
  const density = meta.density === "compact" ? ' data-density="compact"' : "";
  const themeAttr = mode === "auto" ? "" : ` data-theme="${mode}"`;
  const autoScript = mode === "auto"
    ? `<script>var mq=matchMedia('(prefers-color-scheme:dark)');var set=function(){document.documentElement.dataset.theme=mq.matches?'dark':'light'};set();mq.addEventListener('change',set)</script>`
    : "";

  return `<!doctype html>
<html lang="zh-CN"${themeAttr} data-palette="${esc(palette)}"${density}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title || "document")}</title>
${autoScript}
<style>
${themeCss}
${mathCss}
</style>
</head>
<body>
<div class="da-topbar"><div class="tb-title">${esc(meta.title || "")}</div><div class="tb-right"><button class="da-theme-toggle" id="da-theme-toggle" aria-label="切换明暗"></button></div></div>
<div class="doc"><div class="body">
${autoHero}
<div class="md">${content}</div>
</div></div>
${footer}
${colophon}
${toc}
<script>
${runtimeJs}
</script>
</body>
</html>
`;
}

/* CLI */
const isMain = resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);
if (isMain) {
  const input = process.argv[2];
  if (!input) { console.error("用法: node render.mjs <input.mdx> [output.html]"); process.exit(1); }
  const inputAbs = resolve(input);
  const out = process.argv[3] || inputAbs.replace(/\.mdx?$/, "") + ".html";
  const html = await render(readFileSync(inputAbs, "utf8"), pathToFileURL(inputAbs).href);
  writeFileSync(resolve(out), html);
  console.error(`✓ ${out}  (${(html.length / 1024).toFixed(0)} KB)`);
}
