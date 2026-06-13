# Architecture

## Why this shape

The whole skill runs on a single Vite dev server with one plugin
(`app-ux-framework`). No separate proxy, no Python service, no extra process. The
plugin contributes:

1. One extra page (`/__ued/shell`) served as plain HTML alongside the user's app.
2. A few JSON middleware endpoints under `/__ued/*` (devices, state, inspect log).
3. A small `inspect-bridge.js` injected into every served HTML page, which handles
   element picking and live preview edits inside the user app.

Everything else — the user app, HMR, the asset pipeline — is stock Vite. The
design *decisions* are made by the `ui-ux-pro-max` skill in chat (not by any page
this framework serves), and theming is just the agent editing `src/styles/tokens.css`.

## Data flow

```
┌──────────────────────────────────────────────────────────────────┐
│ Browser                                                            │
│   /__ued/shell                                                     │
│   ┌────────────────────────────────────────────┐                  │
│   │ device frame + inspect panel                │                  │
│   │ ┌──────────────────────────────────────┐    │                  │
│   │ │ iframe → /  (user's app)             │    │                  │
│   │ │   inject inspect-bridge.js           │    │                  │
│   │ │     ◄── postMessage set-inspect ─────┼────┘                  │
│   │ │     ──► postMessage select ──────────┘                       │
│   │ └──────────────────────────────────────┘                       │
│   │        │ fetch /__ued/devices                                   │
│   └────────┼─────────── POST /__ued/inspect-event ─────────────────┘
└────────────┼───────────────────────────┼──────────────────────────┘
             ▼                           ▼
┌──────────────────────────────────────────────────────────────────┐
│ Vite dev server (pnpm dev)                                         │
│   app-ux-framework plugin                                          │
│     ├── transformIndexHtml   → inject inspect-bridge.js            │
│     ├── /__ued/shell         → shell HTML                          │
│     ├── /__ued/overlay/*     → static shell.js / shell.css / bridge│
│     ├── /__ued/devices       → read data/devices.json              │
│     ├── /__ued/inspect-event → append .ued/inspect-events.jsonl    │
│     ├── /__ued/inspect-events→ read events since byte offset       │
│     └── /__ued/state/<file>  → read/write raw state files          │
└────────────┼───────────────────────────────────────────────────────┘
             ▼
   <working-dir>/
     ├── .ued/{brief.md, screens.json, inspect-events.jsonl, .cursor, assets/}
     ├── design-system/MASTER.md      (written by ui-ux-pro-max --persist)
     └── src/styles/tokens.css        (hand-edited by the agent = the live theme)
```

## Inspect: how a click in the browser becomes a source edit

1. **User toggles inspect** in the shell → shell posts `{ ns:"ued", type:"set-inspect", on:true }` to the iframe.
2. **inspect-bridge.js** in the app starts handling `mousemove` (highlight) and `click` (select), default-preventing the click.
3. On select, the bridge builds a descriptor (`{ tag, text, className, id, path, rect, lang }`) and posts it to the shell.
4. **Shell** renders an edit panel (text / className via Figma-style controls / note / hide). Edits live-preview via `postMessage({ type:"apply-edit" })` and append to the event log via `POST /__ued/inspect-event` (⌘Z appends an `undo` marker). The panel says **"已记录 · 待落库"** — logged, not yet in source.
5. **Edits persist visually across refresh.** On load the bridge replays the *pending* slice — events after `.cursor` (fetched via `?since=<cursor>`) — and a `MutationObserver` re-applies them idempotently so they survive React re-renders until written to source. Events *before* `.cursor` are already in source and are not replayed (so replay never fights a hand-edited file).
6. **User clicks 落库** (dock popover) → shell writes `.ued/apply-request.json` (`{seq, offset, count}`) and polls `.ued/apply-result.json`.
7. **Agent applies**: watching `apply-request.json` (or on a chat request), it reads `inspect-events.jsonl` from `.cursor` up to `offset`, filters undone events, interprets each `target` against the source, applies the edit (skipping dynamic `{expr}` / `cn(...)` targets it can't safely patch), advances `.cursor`, and writes `apply-result.json` (`{seq, applied, skipped}`) so the button confirms "已写入源码 N 项".

The bridge is **not** the canonical writer — the browser preview is throwaway, the
JSONL is the feedback log, and `.cursor` is the boundary between what's in source
and what's still pending. This decouples Inspect from any source-locator plugin
and lets the agent handle dynamic / ambiguous cases. The "落库" button is just an
explicit batch-commit signal — nothing is written to source until the user asks.

## Why a Vite plugin and not a separate server

- **HMR free.** Editing prototype source (or `tokens.css`) instantly refreshes the shell iframe.
- **Same origin.** No CORS between shell and app.
- **One process, one port.** The user just runs `pnpm dev`.

## Theming: no generator

Unlike a card-picker workflow, there is no token-generation step. The agent reads
the design system (`design-system/MASTER.md`, produced by `ui-ux-pro-max`) and
hand-writes `src/styles/tokens.css`. Tailwind v4's `@theme` block in
`src/styles/index.css` maps those CSS variables (`--ued-background`,
`--ued-accent`, `--ued-font-body`, `--ued-radius`, …) to utility classes, so the
whole prototype reskins on save. Keeping it hand-edited means the theme is plain,
inspectable CSS with no hidden build step.

## Multi-language as a first-class concern

- `tokens.css` declares per-locale font stacks and `:lang(en)` / `:lang(zh-Hans)`
  rules that switch `--ued-font-heading` / `--ued-font-body` per element. CJK gets
  `line-height: 1.7`, Latin 1.5.
- `index.html` sets `<html lang>` to the primary locale; English subsections get
  wrapped in `<span lang="en">…</span>`.
- The inspect bridge records `lang` on every event so a text edit lands in the
  right locale's source string.
- Fallback stacks include OS-native CJK fonts (PingFang SC, Microsoft YaHei) so
  the page degrades gracefully if Google Fonts can't load.

## Trade-offs we accepted

- **Inspect can't be 100% deterministic.** Without a source-locator plugin, the
  agent reasons about ambiguity — acceptable, since it's the one writing code and
  this is robust against dynamic/mapped JSX.
- **Design decisions live in another skill.** This skill depends on `ui-ux-pro-max`;
  if that skill isn't installed, Step 2 has to fall back to manual judgment.
- **Tailwind v4 required.** v4's `@theme` is far cleaner than v3 theming wiring.
- **One template.** Want Next.js or another framework? Add a `template-<name>/`
  and let scaffold pick by flag — mostly mechanical.
