/* ============================================================
   mdx-artifact · 组件注册表（OCP 核心）
   MDX 标签 → React 组件的映射。加组件 = 在此注册一个函数，核心渲染器不改。
   用 React.createElement（h）以便在纯 Node SSG 直接运行（无需 JSX 转译）。
   组件输出与旧 vanilla 完全一致的 .da-* 结构，复用同一套 theme.css 保证视觉平移。
   ============================================================ */
import React from "react";
import katex from "../../assets/vendor/katex/katex.mjs";

const h = React.createElement;
const F = React.Fragment;

// section 锚点 / grid id —— 每次渲染前 reset
const used = new Set();
let gid = 0;
export function resetIds() { used.clear(); gid = 0; }
function slug(s) {
  let b = String(s || "sec").trim().replace(/\s+/g, "-").replace(/[^\w一-龥-]/g, "").toLowerCase() || "sec";
  let id = b, i = 2;
  while (used.has(id)) id = b + "-" + i++;
  used.add(id);
  return id;
}
const kids = (children) => React.Children.toArray(children).filter((c) => !(typeof c === "string" && !c.trim()));

/* ---------- 布局 / 结构 ---------- */
function Hero({ dark, eyebrow, title, sub, date, stats, children }) {
  return h("section", { className: "da-hero reveal", ...(dark !== undefined ? { "data-dark": "" } : {}) },
    h("div", { className: "hwrap" },
      eyebrow ? h("p", { className: "eyebrow" }, eyebrow) : null,
      h("h1", null, title),
      sub ? h("p", { className: "lead" }, sub) : null,
      children ? h("p", { className: "desc" }, children) : null,
      date ? h("p", { className: "meta" }, date) : null,
      stats && stats.length ? h("div", { className: "stats" },
        stats.map((s, i) => h("div", { key: i }, h("div", { className: "v" }, s.v), h("div", { className: "l" }, s.l)))) : null));
}

function Footer({ children }) {
  return h("footer", { className: "da-footer" }, h("div", { className: "fwrap" }, h("div", { className: "md" }, children)));
}

// GitHub mark（官方 octocat 轮廓）——构建期内联为 currentColor，零外链。
const GH_MARK = '<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

// ExcaliVibe 品牌 / 推广信息（固定常量，非用户数据）——每份产物都带上，为 ExcaliVibe 署名推广，用户改不了。
// version 是版本同步点，随 plugin-infra 版本更新。
export const BRAND = { name: "ExcaliVibe", tool: "mdx-artifact", version: "0.4.0", license: "MIT", repo: "https://github.com/yanxuan-lc/excalivibe" };

// 版本记（落款）——渲染器始终追加在最底部，两行分区，职责清晰：
//   1) 用户实际信息：© 用户org · 撰写模型 · 生成时间（到秒）——全部来自使用者的 frontmatter / 渲染时刻。
//   2) ExcaliVibe 固定推广：以 ExcaliVibe · mdx-artifact vX 生成 · 许可 + GitHub 图标链接（跳 ExcaliVibe 仓库）。
function Colophon({ copyright, author, time }) {
  const userLine = [copyright, author ? `由 ${author} 撰写` : null, time ? `生成于 ${time}` : null].filter(Boolean).join("  ·  ");
  return h("div", { className: "da-colophon" },
    h("div", { className: "cwrap" },
      userLine ? h("p", { className: "prov" }, userLine) : null,
      h("p", { className: "brand" },
        `以 ${BRAND.name} · ${BRAND.tool} v${BRAND.version} 生成 · ${BRAND.license} ·`,
        h("a", { className: "gh", href: BRAND.repo, target: "_blank", rel: "noopener noreferrer",
          "aria-label": `${BRAND.name} on GitHub`, dangerouslySetInnerHTML: { __html: GH_MARK } }))));
}

function Section({ number, eyebrow, title, anchor }) {
  return h("section", { className: "da-section reveal", id: slug(anchor || title) },
    h("div", { className: "head" },
      number ? h("span", { className: "num" }, number) : null,
      eyebrow ? h("span", { className: "eyebrow" }, eyebrow) : null),
    h("p", { className: "st" }, title));
}

function Callout({ tone, title, children }) {
  return h("div", { className: "da-callout", ...(tone ? { "data-tone": tone } : {}) },
    title ? h("p", { className: "ct" }, title) : null,
    h("div", { className: "cb" }, children));
}

function Card({ tone, title, badge, badgeTone, children }) {
  return h("div", { className: "da-card", ...(tone ? { "data-tone": tone } : {}) },
    badge ? h("span", { className: "da-badge da-card-badge", "data-dot": "", ...(badgeTone ? { "data-tone": badgeTone } : {}) }, badge) : null,
    title ? h("p", { className: "ct" }, tone ? h("span", { className: "dot" }) : null, title) : null,
    children);
}

function Columns({ ratio, children }) {
  return h("div", { className: "da-cols", "data-ratio": ratio || "1:1" },
    kids(children).map((c, i) => h("div", { key: i }, c)));
}

function Toggle({ title, open, children }) {
  return h("details", { className: "da-toggle", ...(open !== undefined ? { open: "" } : {}) },
    h("summary", null, title),
    h("div", { className: "body" }, children));
}

/* ---------- 步骤 / 指标 / 键值 ---------- */
function Steps({ children }) { return h("div", { className: "da-steps" }, children); }
function Step({ title, status, children }) {
  return h("div", { className: "s", ...(status ? { "data-status": status } : {}) },
    h("div", { className: "n" }),
    h("div", null, h("div", { className: "st" }, title), children ? h("div", { className: "sd" }, children) : null));
}
function Stats({ children }) { return h("div", { className: "da-statrow" }, children); }
function Stat({ value, label, delta, dir }) {
  return h("div", { className: "da-stat" },
    h("div", { className: "v" }, value, delta ? h("span", { className: "d " + (dir === "down" ? "down" : "up") }, delta) : null),
    h("div", { className: "l" }, label));
}
function Fields({ children }) { return h("div", { className: "da-fields" }, children); }
function Field({ k, v }) { return h("div", { className: "row" }, h("div", { className: "k" }, k), h("div", { className: "v" }, v)); }

/* ---------- 用例（Gherkin） ---------- */
function Scenario({ title, children }) {
  return h("div", { className: "da-scenario" }, title ? h("p", { className: "title" }, title) : null, children);
}
const Kw = (kw, cls) => ({ children }) => h("div", { className: "row" }, h("span", { className: "kw " + cls }, kw), h("span", null, children));
const When = Kw("WHEN", "when"), And = Kw("AND", "and"), Then = Kw("THEN", "then");

/* ---------- Grid（可筛选） ---------- */
function parseFacets(f) {
  if (Array.isArray(f)) return f;
  return String(f || "").split(",").map((s) => s.trim()).filter(Boolean)
    .map((s) => { const [id, ...l] = s.split(":"); return { id: id.trim(), label: (l.join(":") || id).trim() }; });
}
function Grid({ filterable, facets, children }) {
  const id = "grid-" + (++gid);
  let bar = null;
  if (filterable !== undefined) {
    const fs = [{ id: "all", label: "全部" }].concat(parseFacets(facets));
    bar = h("div", { className: "da-filter", "data-filter": id },
      fs.map((f, i) => h("button", { key: f.id, "data-f": f.id, "aria-pressed": i === 0 ? "true" : "false" }, f.label)));
  }
  return h(F, null, bar, h("div", { className: "da-grid", id }, children));
}
function Item({ tags, children }) {
  return h("div", { className: "g", "data-tags": Array.isArray(tags) ? tags.join(" ") : (tags || "") },
    h("div", { className: "gt" }, children));
}

/* ---------- 代码 / 公式 / 图 ---------- */
function Code({ filename, children }) {
  return h("div", { className: "da-code" }, filename ? h("div", { className: "fn" }, filename) : null, h("pre", null, children));
}
function Math({ tex, display }) {
  const html = katex.renderToString(String(tex || ""), { displayMode: display !== "inline", throwOnError: false });
  return h("div", { className: "da-math", dangerouslySetInnerHTML: { __html: html } });
}
function Diagram({ engine }) { return h("div", { className: "da-diagram" }, "［图待渲染 · engine=" + (engine || "?") + "］"); }
function Badge({ tone, dot, children }) {
  return h("span", { className: "da-badge", ...(tone ? { "data-tone": tone } : {}), ...(dot !== undefined ? { "data-dot": "" } : {}) }, children);
}

/* ---------- markdown 内建元素覆写（代码块 / 表格） ---------- */
function Pre({ children }) {
  const codeEl = React.Children.toArray(children)[0];
  const text = codeEl && codeEl.props ? codeEl.props.children : children;
  return h("div", { className: "da-code" }, h("pre", null, text));
}
function Table({ children }) {
  return h("div", { className: "da-table-wrap" }, h("table", { className: "da-table" }, children));
}

/* ---------- 注册表：标签 → 组件（面向扩展，加组件在此追加一行） ---------- */
export const components = {
  Hero, Footer, Colophon, Section, Callout, Card, Columns, Toggle,
  Steps, Step, Stats, Stat, Fields, Field,
  Scenario, When, And, Then,
  Grid, Item, Code, Math, Diagram, Badge,
  // 内建元素覆写（markdown 产出的代码块/表格套上 .da-* 皮肤；其余 h/p/ul/blockquote… 由 .md 基础样式接管）
  pre: Pre, table: Table,
};
