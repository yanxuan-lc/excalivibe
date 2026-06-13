// /__ued/inspect-event   POST → appends one event line to inspect-events.jsonl
// /__ued/inspect-events  GET  → returns events as JSON array (?since=<byte-offset> for tail)

import path from "node:path";
import { existsSync, mkdirSync, appendFileSync, readFileSync, statSync } from "node:fs";

export function createInspectApi(ctx) {
  const file = () => path.join(ctx.stateDir, "inspect-events.jsonl");

  return {
    append: async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        return res.end(JSON.stringify({ ok: false, error: "POST only" }));
      }
      try {
        const chunks = [];
        for await (const ch of req) chunks.push(ch);
        const raw = Buffer.concat(chunks).toString("utf-8") || "{}";
        const obj = JSON.parse(raw);
        obj.ts = obj.ts || new Date().toISOString();
        mkdirSync(ctx.stateDir, { recursive: true });
        appendFileSync(file(), JSON.stringify(obj) + "\n");
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
      }
    },

    read: async (req, res) => {
      if (req.method !== "GET") {
        res.statusCode = 405;
        return res.end(JSON.stringify({ ok: false, error: "GET only" }));
      }
      try {
        const f = file();
        if (!existsSync(f)) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ events: [], offset: 0 }));
        }
        const url = new URL(req.url || "/", "http://x");
        const since = Number(url.searchParams.get("since") || 0);
        const size = statSync(f).size;
        if (since >= size) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ events: [], offset: size }));
        }
        const buf = readFileSync(f);
        const tail = buf.slice(since).toString("utf-8");
        const events = tail
          .split("\n")
          .filter(Boolean)
          .map((l) => {
            try { return JSON.parse(l); } catch { return null; }
          })
          .filter(Boolean);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ events, offset: size }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
      }
    },
  };
}
