// /__ued/state/<file> — GET (read) / POST (write) raw state files under <stateDir>.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ALLOWED = /^[A-Za-z0-9._-]+$/;

export function createStateApi(ctx) {
  return async (req, res) => {
    const url = (req.url || "/").split("?")[0];
    const name = url.replace(/^\//, "");
    if (!name || !ALLOWED.test(name)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "invalid state name" }));
    }
    const file = path.join(ctx.stateDir, name);

    if (req.method === "GET") {
      if (!existsSync(file)) {
        // 204 (not 404) for absent state files: these are polled (.cursor,
        // apply-result.json) before they exist, and a 404 spams the browser
        // console with red errors that read as "broken". Callers treat r.ok +
        // empty body / failed JSON parse as "absent". No content, no noise.
        res.statusCode = 204;
        return res.end();
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/octet-stream");
      return res.end(readFileSync(file));
    }

    if (req.method === "POST") {
      const chunks = [];
      for await (const ch of req) chunks.push(ch);
      mkdirSync(ctx.stateDir, { recursive: true });
      writeFileSync(file, Buffer.concat(chunks));
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: true, bytes: Buffer.concat(chunks).length }));
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "method not allowed" }));
  };
}
