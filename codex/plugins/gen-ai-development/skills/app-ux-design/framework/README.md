# app-ux-framework

Vite plugin used by the [`app-ux-design`](../SKILL.md) skill. Adds an in-browser
device-frame preview shell and a DevTools-style inspect overlay to any Vite dev
server. It does **not** make design decisions or generate themes — that's the
agent's job (driven by the `ui-ux-pro-max` skill), with theming done by editing
`src/styles/tokens.css` directly.

## Install

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { uedFramework } from "app-ux-framework";

export default defineConfig({
  plugins: [react(), tailwindcss(), uedFramework({ stateDir: ".ued" })],
});
```

## Options

| Option         | Default  | Notes                                                  |
|----------------|----------|--------------------------------------------------------|
| `stateDir`     | `".ued"` | Where to read/write cross-phase state files.           |
| `skillRoot`    | auto     | Path to the app-ux-design skill (for `data/devices.json`). |
| `injectBridge` | `true`   | Inject inspect-bridge.js into every served HTML.       |

## Routes added

- `GET /__ued/shell` — device-frame outer page that iframes `/`, with the inspect panel.
- `GET /__ued/overlay/*` — static JS/CSS for the shell + the inspect bridge.
- `GET /__ued/devices` — device specs (mobile / pad / desktop / web) from `data/devices.json`.
- `POST /__ued/inspect-event` — appends to `<stateDir>/inspect-events.jsonl`.
- `GET /__ued/inspect-events?since=<bytes>` — tail events.
- `GET|POST /__ued/state/<name>` — raw read/write of state files (no path traversal).

## HTML injection

Every served HTML page (except `/__ued/*`) gets:

```html
<script type="module" src="/__ued/overlay/inspect-bridge.js"></script>
```

The bridge listens for `postMessage({ ns:"ued", type:"set-inspect", on:true })`
from the shell parent and posts back hover/select descriptors + applies live
preview edits. Disable with `injectBridge: false` if debugging conflicts.

> The exported function is named `uedFramework` and the route prefix is `/__ued/`
> for historical reasons; they're kept stable so the inspect bridge and shell
> wiring don't need rewiring. They're internal — the user never types them.
