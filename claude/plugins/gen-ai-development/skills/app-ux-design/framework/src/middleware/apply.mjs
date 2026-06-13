// /__ued/apply  POST → write a single inspect edit straight to source (fast path).
//
// The agent-applies loop is correct but slow (an LLM turn per commit). For the
// common case — a *static* text or placeholder string that appears exactly once
// in src/** — we can patch the file directly and let Vite HMR refresh, with no
// agent in the loop. Anything we can't resolve unambiguously (dynamic `{expr}`
// text that isn't a literal in source, a string that appears 0 or >1 times) is
// refused with a reason, and the shell falls back to the agent path.
//
// Request:  { kind: "text-edit" | "placeholder-edit", from: string, to: string }
// Response: { ok: true, file } | { ok: false, reason: "not-found"|"ambiguous"|"unsupported"|"noop", count? }

import path from "node:path";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";

const EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);

function walk(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = path.join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(p))) out.push(p);
  }
  return out;
}

// All start offsets of `needle` in `haystack`, optionally filtered by a context
// predicate (txt, index, len) → boolean. Non-overlapping.
function matchOffsets(haystack, needle, predicate) {
  const out = [];
  if (!needle) return out;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) >= 0) {
    if (!predicate || predicate(haystack, i, needle.length)) out.push(i);
    i += needle.length;
  }
  return out;
}

// True when the match at `idx` sits in JSX *text-node* position — i.e. the
// nearest non-whitespace char before it is `>` and after it is `<`. text-edit
// only ever originates from an element's direct text content, so requiring this
// context stops a fast-path write from landing inside a comment, a string
// literal, or an attribute value that happens to contain the same string. If a
// literal appears once but NOT in text position, we'd rather refuse and let the
// agent resolve it than silently patch the wrong place.
function isJsxTextContext(txt, idx, len) {
  let i = idx - 1;
  while (i >= 0 && /\s/.test(txt[i])) i--;
  if (txt[i] !== ">") return false;
  let j = idx + len;
  while (j < txt.length && /\s/.test(txt[j])) j++;
  return txt[j] === "<";
}

export function createApplyApi(ctx) {
  return async (req, res) => {
    const reply = (o) => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(o));
    };
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end(JSON.stringify({ ok: false, error: "POST only" }));
    }
    let body;
    try {
      const chunks = [];
      for await (const ch of req) chunks.push(ch);
      body = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
    } catch (e) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
    }

    const { kind, from, to } = body;
    if (from == null || to == null || String(from) === String(to)) return reply({ ok: false, reason: "noop" });

    // Candidate (needle → replacement) pairs by edit kind, each with an optional
    // context predicate. The first form that matches exactly once across src/**
    // (in an accepted context) wins.
    let candidates;
    if (kind === "text-edit") {
      // Raw text is only safe to replace when it sits in JSX text position.
      candidates = [{ needle: String(from), replacement: String(to), predicate: isJsxTextContext }];
    } else if (kind === "placeholder-edit") {
      // The `placeholder=…` wrapper is already specific enough; no extra context.
      candidates = [
        { needle: `placeholder="${from}"`, replacement: `placeholder="${to}"` },
        { needle: `placeholder={"${from}"}`, replacement: `placeholder={"${to}"}` },
        { needle: `placeholder={\`${from}\`}`, replacement: `placeholder={\`${to}\`}` },
      ];
    } else {
      return reply({ ok: false, reason: "unsupported" });
    }

    const srcDir = path.join(ctx.projectRoot, "src");
    if (!existsSync(srcDir)) return reply({ ok: false, reason: "no-src" });
    const files = walk(srcDir);

    for (const { needle, replacement, predicate } of candidates) {
      let hitFile = null, hitTxt = null, hitIndex = -1, total = 0;
      for (const f of files) {
        const txt = readFileSync(f, "utf-8");
        const idxs = matchOffsets(txt, needle, predicate);
        if (idxs.length) {
          if (hitFile === null) { hitFile = f; hitTxt = txt; hitIndex = idxs[0]; }
          total += idxs.length;
        }
      }
      if (total === 1) {
        // Splice at the exact matched offset — avoids replacing a different
        // earlier raw occurrence that the predicate rejected.
        const out = hitTxt.slice(0, hitIndex) + replacement + hitTxt.slice(hitIndex + needle.length);
        writeFileSync(hitFile, out);
        return reply({ ok: true, file: path.relative(ctx.projectRoot, hitFile) });
      }
      if (total > 1) return reply({ ok: false, reason: "ambiguous", count: total });
      // total === 0 → try the next candidate form
    }
    return reply({ ok: false, reason: "not-found" });
  };
}
