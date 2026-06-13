// GET /__ued/devices — returns the device-frame specs the shell uses to render
// phone / pad / desktop / web frames. Source: <skillRoot>/data/devices.json.
//
// This is the only piece of the old style-options endpoint that survives in
// app-ux-design: there is no in-browser style picker anymore (the design
// conversation runs through the ui-ux-pro-max skill in chat), so the shell only
// needs the device catalog, nothing else.

import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

const EMPTY = { mobile: [], pad: [], desktop: [], web: [] };

export function createDevicesApi(ctx) {
  return (req, res, next) => {
    if (req.method !== "GET") return next();
    let devices = EMPTY;
    try {
      const file = path.join(ctx.skillRoot, "data", "devices.json");
      if (existsSync(file)) {
        const parsed = JSON.parse(readFileSync(file, "utf-8"));
        devices = { ...EMPTY, ...parsed };
      }
    } catch {
      // fall through with EMPTY — the shell defaults to a responsive web frame
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(devices));
  };
}
