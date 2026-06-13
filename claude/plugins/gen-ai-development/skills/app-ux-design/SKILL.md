---
name: app-ux-design
description: "Interactive UI/UX design workflow that turns a vague brief into a real, componentized, iterate-able front-end prototype — for apps, desktop apps, websites, dashboards, mobile screens, any GUI surface. It leans on the ui-ux-pro-max skill to decide style/palette/typography/layout in conversation, then scaffolds a real TypeScript + React + shadcn/ui + Tailwind + Zustand + TanStack + Vite workspace under docs/ued/<datetime>-<topic>/, serves it over HTTP, and iterates via chat and a DevTools-style inspect overlay whose edits commit back to source. Use this whenever the task touches how something LOOKS, FEELS, MOVES, or is laid out — visual表现, 交互, 组件, 配色, 布局, mockup, 原型, 改样式/风格, 'redo this flow', '帮我设计 X', '一起做个 X 的设计' — even when the user never says 'design' or 'prototype'. Prefer this over pure UI/UX guideline skills (including bare ui-ux-pro-max) when the user expects working code and live iteration rather than advice or a static mockup."
---

# App UX Design — Interactive Prototype Workflow

This skill collaborates with the user to take a UI/UX requirement from a vague
brief (or a reference, or an existing design spec) to a **working, browser-interactive
prototype** built in a real **Vite + React + TypeScript + Tailwind v4 + shadcn/ui +
Zustand + TanStack (Query / Router / Table)** workspace — the same medium engineering
ships in, not a throwaway HTML mockup.

The design *thinking* (style, palette, typography, layout, UX rules) is delegated to
the **`ui-ux-pro-max` skill**, which this skill drives in conversation. The design
*medium* is real code that the user previews and steers live.

Each session lives in its own isolated, version-controlled directory:
`docs/ued/<datetime>-<topic>/`. Everything — brief, the persisted design system,
prototype source, inspect feedback — is there, so the work survives across sessions.

> Substitute `<skill>` below with the absolute path to this skill directory.

## Why this shape

1. **Words are lossy, pictures are precise.** The user needs to *see* the design, not read about it.
2. **Real code beats HTML mockups.** A Vite/React workspace is what engineering will actually ship, so the design survives implementation.
3. **Iteration is the work.** A fast loop — HMR for live edits, an inspect overlay to point at things, a structured event log so feedback never gets lost.
4. **Don't reinvent design judgment.** `ui-ux-pro-max` already encodes 50+ styles, 161 palettes, 57 font pairings, 99 UX rules. This skill orchestrates it and turns its output into running code.

## Prerequisites

- **Node ≥ 20**, **pnpm ≥ 9** (`corepack enable` or `npm i -g pnpm`).
- **`ui-ux-pro-max` skill** installed and available (this skill depends on it for design decisions).
- **python3** (ui-ux-pro-max's search CLI needs it).
- A modern browser to open the preview shell.

---

## Step 0 — Phase recognition: new vs. resume

**Before assuming you're starting fresh, check whether this is a continuation.**
Many sessions resume an earlier one ("continue the dashboard design", "回到
docs/ued/...的那个设计").

Detection signals:

- User names an existing topic, or a path under `docs/ued/`.
- User says "继续 / 接着做 / resume / keep going / 回到…".
- Even with no signal: if `docs/ued/` already has `<datetime>-<topic>/` dirs, ask
  which one to resume vs. start new (list them, newest first — the datetime prefix sorts).

**Resume procedure:**

1. **Locate** the working dir `docs/ued/<datetime>-<topic>/`. If `design-system/MASTER.md`
   exists, the design step is already done.
2. **Read the durable artifacts**, in order:
   - `.ued/brief.md` — mode, references, function, audience, platform, locales, vibe.
   - `.ued/assets/` — list contents; re-load any reference images mentioned in the brief so they're back in your multimodal view.
   - `design-system/MASTER.md` (+ `design-system/pages/*.md`) — the committed design system.
   - `.ued/screens.json` — registry of screens already implemented.
   - `src/styles/tokens.css` — the live theme (its header notes which design system shaped it).
   - `.ued/inspect-events.jsonl` — Step 4 feedback. Read from the `.ued/.cursor` byte offset onward to find events not yet applied.
3. **Restart the dev server** from the working dir if it isn't running:
   `cd docs/ued/<datetime>-<topic> && pnpm dev`. Do **not** re-scaffold —
   `node_modules` and source already exist.
4. **Tell the user what you recovered** in one tight paragraph (brief gist, the
   design system in one line, screens implemented, pending inspect events). Then
   enter Step 4 and apply any pending events.

Only re-enter design (Step 2) when the user asks to change the style.

---

## Step 1 — Mode recognition + requirement alignment

Pick exactly one **mode** (record under `## Mode` in `.ued/brief.md`):

| Mode | When | How Step 2 behaves |
|------|------|--------------------|
| **全新设计** (greenfield) | Brand-new design, no reference, no prior spec. | Run ui-ux-pro-max fresh from the brief keywords. |
| **参考设计** (reference) | User provides a reference (screenshots / a product / a site) **and** the scope to borrow (e.g. only palette, only layout, only interaction). | Extract the borrowed dimension from the reference; let ui-ux-pro-max fill the rest. Borrowed values win. |
| **延续设计** (continuation) | User provides an existing design spec (usually a prior `design-system/MASTER.md`). | Treat the spec as authoritative; only run ui-ux-pro-max for *new* dimensions/pages it doesn't cover. |

Detection heuristics: "新产品 / 从零做" → 全新; "参考这个 / 照着 X 的配色 / 像 Y 那样" → 参考 (pin down WHICH dimension); "在原来的规约上加 / 延续之前 / 这是设计规范" → 延续.
If ambiguous, ask once.

**Then align on the requirement.** Ask short, focused questions — only the
dimensions whose answers will change the design. Don't fire a checklist; combine
related questions. Skip anything the brief or references already answer. Default
dimensions: function (2–3 primary jobs), audience, platform, product type,
locales, brand/vibe, constraints (a11y, dark mode, perf, copy tone).

**For 参考设计:** copy the user's screenshots into `.ued/assets/`, read them
multimodally, and write a precise note per reference in `brief.md` `## References`
— *what* to borrow and *which dimension only* (so you don't accidentally copy the
reference's colors when the user only wanted its layout).

Record everything in `.ued/brief.md`. If the user gave a crisp brief, skip ahead
and just label your assumptions.

### Multi-platform: separate designs, not just responsive

If the product targets **both mobile and PC as first-class** (not "a desktop site
that also works on a phone"), design them as **two distinct UIs** — different
layout, information architecture, and navigation — rather than one component that
merely reflows at breakpoints. A phone is not a narrow desktop: it wants a bottom
tab bar / stacked cards / one column / thumb-reachable actions; the desktop wants a
sidebar / multi-column density / hover affordances.

Decide the **design strategy** in Step 1 and record it in `brief.md`:

| Strategy | When | How you build it (Step 3) |
|----------|------|----------------------------|
| **Single responsive** | One platform is primary; the other is a nice-to-have. | One screen with Tailwind `md:`/`lg:` breakpoints. |
| **Separate per-platform** | Both mobile and PC are first-class. | A `mobile` and a `desktop` variant per screen, switched by **form factor** (not width) via `useFormFactor()`. |

When in doubt and the user says "支持移动端和 PC 端 / 跨端 / both", default to
**separate per-platform** — that's what they almost always mean by a real
cross-end product. Ask once if unsure.

> **Scaffold now or later?** You can scaffold the workspace right after the brief
> (so the dev server is up while you discuss design), or after Step 2. Scaffolding
> early is usually nicer — the user sees the neutral scaffold while you talk style.
> See Step 3 for the command.

---

## Step 2 — Design via ui-ux-pro-max (interactive)

**Goal:** settle style, palette, typography, layout, and the key UX rules — in
conversation, grounded by `ui-ux-pro-max`, persisted as the project's design system.

This replaces any "pick a card in the browser" step. The design conversation
happens in chat; the artifact is `design-system/MASTER.md` inside the working dir.

1. **Invoke the `ui-ux-pro-max` skill** to generate a design system from the brief.
   Build a multi-dimensional keyword query (product + industry + tone + density),
   and persist the result **into this project's working dir** so 延续设计 can reuse it:

   ```bash
   cd docs/ued/<datetime>-<topic>          # so --persist writes here
   python3 <ui-ux-pro-max>/scripts/search.py "<product> <industry> <keywords>" \
     --design-system --persist -p "<Topic>"
   # → writes design-system/MASTER.md (+ design-system/pages/ for page overrides)
   ```

   (If you can't resolve the script path, just trigger the ui-ux-pro-max skill and
   ensure its persisted `MASTER.md` ends up at `<working-dir>/design-system/MASTER.md`.)

2. **Per mode:**
   - **全新设计** — take ui-ux-pro-max's recommendation as the baseline.
   - **参考设计** — override the borrowed dimension with values you extracted from
     the reference (e.g. estimate exact hex codes / font family / radius from the
     screenshot); let ui-ux-pro-max own everything else. Note in MASTER.md which
     fields came from the reference.
   - **延续设计** — read the supplied MASTER.md as the source of truth. Only query
     ui-ux-pro-max for genuinely new pieces (a new page, a missing dimension); use
     its `--page` override for page-specific deviations. Never silently change
     committed tokens.

3. **Discuss with the user.** Summarize the recommended system in plain language
   (style, palette with a few hexes, type pairing, density, signature effects) and
   the notable UX rules. Offer 1–2 concrete alternatives where it matters. Iterate
   in chat until they're happy. Re-run ui-ux-pro-max with different keywords if the
   direction is off. Keep MASTER.md in sync with what you agree.

4. **Translate the agreed system into the live theme.** Hand-edit
   `src/styles/tokens.css` to match MASTER.md: palette → the 8 color vars, type
   pairing → per-locale font stacks (+ Google Fonts `@import`), effects → radius /
   shadow / density / line-height. `tokens.css` is the single theme source of truth
   and is **not** generated — edit it directly; Tailwind v4's `@theme` in
   `index.css` already maps these vars to `bg-*` / `text-*` / `rounded-*`, so HMR
   reskins the whole prototype on save.

---

## Step 3 — Prototype preview (build + serve)

**Goal:** turn the brief + design system into a real, interactive prototype, and
serve it over HTTP for the user to preview and steer.

### Scaffold (once per session)

```bash
node <skill>/scripts/scaffold.mjs --topic <topic> --project-root <repo-root>
# prints WORKING_DIR=<repo-root>/docs/ued/<datetime>-<topic>  — capture this exact path
```

Pick `<topic>` as a short kebab-case slug with the user. The script copies the
template, links `app-ux-framework`, runs `pnpm install`, and initializes `.ued/` +
`design-system/`. Then start the server (it stays up across turns):

```bash
cd <WORKING_DIR> && pnpm dev          # run in background
```

Tell the user: **open `http://localhost:5173/__ued/shell`** — the device-frame
shell with the inspect overlay. (`/` serves the bare app.)

### Build the prototype

Write code under `<WORKING_DIR>/src/`. The template ships:
- Tailwind v4 wired to the theme vars in `tokens.css`.
- shadcn/ui primitives (`button`, `card`, `input`, `dialog`, `tabs`, `badge`) in `src/components/ui/`.
- **TanStack Query** in `main.tsx`; centralize keys in `src/queries/index.ts` (key-factory).
- **TanStack Router** in `src/router.tsx` — one route per screen; root renders `<Outlet />`.
- **TanStack Table** available for data-heavy screens.
- **Zustand** store in `src/store/` (one per logical domain).
- **Recharts** + bundled themed chart wrappers in `src/shared/components/charts/` (`AreaTrend`, `BarSeries`, `DonutShare`, `Sparkline`) — see "Charts & data viz" below.
- **`useFormFactor()`** in `src/lib/preview.ts` — for separate mobile vs PC designs (see below).
- `src/shared/components/` for cross-screen components; per-screen components under `src/screens/<id>/`.

**Adding a screen:** create `src/screens/<id>/index.tsx` (default export) →
register a route in `src/router.tsx` → append an entry to `.ued/screens.json`
(`{ id, name, route, file, status }`). The shell's screen switcher picks it up on
reload.

**Build interactive, not screenshots:** buttons/inputs respond (shared state in
Zustand), stub backend data in `src/stub/*.ts`, include empty/loading/error
variants for async surfaces. Make the smallest target device work first.

### Separate per-platform designs (form factor)

When the brief's strategy is **separate per-platform** (Step 1), don't write one
responsive component — write two designs and switch on **form factor**, which the
preview shell controls (Mobile pill → `"mobile"`; Pad/Desktop/Web → `"desktop"`):

```
src/screens/home/
├── index.tsx          // dispatches on form factor
├── home.mobile.tsx    // phone design: bottom tabs, stacked, one column, big touch targets
└── home.desktop.tsx   // PC design: sidebar, multi-column, denser, hover affordances
```

```tsx
// index.tsx
import { useFormFactor } from "@/lib/preview";
import HomeMobile from "./home.mobile";
import HomeDesktop from "./home.desktop";
export default function Home() {
  return useFormFactor() === "mobile" ? <HomeMobile /> : <HomeDesktop />;
}
```

Switching the platform pill in the shell live-swaps the design (no width hack).
Share only what's genuinely identical (data, formatters, a logo) via
`src/shared/`; let the layouts diverge. Each variant must stay robust across its
whole band: the **mobile** design adapts 360→430px; the **desktop** design must
hold from **tablet portrait (~820px, the Pad pill)** all the way to wide desktop —
don't cram the top bar so full it only fits at 1440 (hide the subtitle/search and
let controls wrap at the narrow end). Verify in the shell at Mobile, **Pad**, and
Web before handoff — the preview renders each at its true device width, so what
you see is what those widths get.

> If the strategy is **single responsive**, ignore this — one screen with
> `md:`/`lg:` breakpoints is correct, and `useFormFactor()` is unused.

### Charts & data viz

Hand-rolled SVG charts read as amateur and don't scale. The template bundles
**Recharts** with themed wrappers in `src/shared/components/charts/` that already
read the design tokens (axis/grid/series colors), ship a token-styled tooltip, and
are responsive. Prefer them over inventing chart markup.

```tsx
import { AreaTrend, BarSeries, DonutShare } from "@/shared/components/charts";

<AreaTrend data={rows} xKey="month" series={[{ key: "cur", label: "本期" }, { key: "prev", label: "上期" }]} />
<BarSeries data={rows} categoryKey="channel" series={[{ key: "count" }]} layout="vertical" colorByCategory />
<DonutShare data={rows} nameKey="plan" valueKey="value" />
```

Choosing the chart — and when unsure, **query ui-ux-pro-max's chart domain**
(`python3 <ui-ux-pro-max>/scripts/search.py "<need>" --domain chart`):

| Data question | Chart |
|---------------|-------|
| change over time | `AreaTrend` (area/line) |
| compare categories | `BarSeries` (vertical) |
| rank many categories / long labels | `BarSeries layout="vertical"` (horizontal bars) |
| share of a total (≤5–6 parts) | `DonutShare` |
| single KPI trend in a card | the lightweight `Sparkline` (no axes) |

Always include: axis labels with units, a legend for >1 series, tooltips on
hover/tap, and an **empty + loading** state (skeleton, not a bare axis). Don't put
>6 slices in a donut (switch to bars), and don't rely on color alone — keep labels.
Charts inherit `prefers-reduced-motion` from Recharts defaults; keep entrance
animation subtle.

### className-first — so Inspect actually works

The Step-4 inspect overlay only edits **className**. Anything you put in
`style={...}` is invisible to the user, and worse, **inline `style` overrides
className**, so their inspect edit silently does nothing. Rule: if a property has
a Tailwind class form (especially one mapped via `@theme`), use the class.

| Property | Use | Not |
|---|---|---|
| Background / text / border color | `bg-accent` `text-foreground` `border-border` (or `bg-[#hex]`, `bg-[var(--ued-accent)]`) | `style={{ background: ... }}` ❌ |
| Font weight / size | `font-medium text-sm` | `style={{ fontWeight, fontSize }}` ❌ |
| Radius (theme) | `rounded` / `rounded-lg` | `style={{ borderRadius: "var(--ued-radius)" }}` ❌ |
| Box-shadow / motion (no class form) | inline `style={{ boxShadow: "var(--ued-shadow)" }}` ✅ | — |

Concrete failure this prevents: a chat bubble with `style={{ background:
"var(--ued-accent)" }}` ignores every `bg-*` class the user types into Inspect,
while a sibling using `bg-surface` updates perfectly. Don't mix the two.

**Fonts:** don't hardcode `font-family`; body inherits `--ued-font-body`. Use
`lang="en"` / `lang="zh-Hans"` on inline elements to switch fonts per locale, and
set `<html lang>` in `index.html` to the primary locale.

### Layout robustness — the #1 source of "looks broken"

Default-generated layouts most often fail by **wrapping text awkwardly or
overflowing their container** in the narrow case (a 2-col KPI grid on a 375px
phone, a flex row where a fixed-width chart sits next to a long number). Build so
the *smallest* target holds together, and the rest follows:

- **Flex rows that mix flexible + fixed children:** give the flexible child
  `min-w-0` (so it can shrink) and the fixed child (chart, icon, sparkline)
  `shrink-0`. Without `min-w-0`, the fixed child pushes past the edge — that's the
  classic sparkline-bleeding-past-the-card bug.
- **Short labels next to a value/badge:** wrap the pair in `flex items-center
  gap-* whitespace-nowrap` so "+12.5% 较上周期" never breaks mid-phrase into two
  lines. Hide non-essential labels on the narrowest breakpoint (`hidden sm:inline`)
  rather than letting them wrap.
- **Long single-line text** (names, titles, metric labels): `truncate` (needs a
  `min-w-0` flex parent) instead of letting it wrap or overflow.
- **Scale type down on mobile:** big numbers/headings often overflow 2-col cards —
  `text-xl md:text-2xl`, not a fixed `text-2xl`.
- **Dense card grids must step columns, not crush cells:** a KPI row should be
  `grid-cols-2 lg:grid-cols-4`, never a flat `grid-cols-4`. With a sidebar, a
  4-col grid at tablet width shrinks each card to ~125px — too narrow for a
  number + sparkline, so the sparkline bleeds out. Step the column count up with
  the breakpoint; same for chart rows (`grid-cols-1 lg:grid-cols-3`). Use the
  bundled `Sparkline` (it's `shrink-0` and won't push past its card).
- **Wide tables:** wrap in `overflow-x-auto` (with a sensible `min-w-[…]`), or swap
  to a stacked card/list layout under `md:` — don't let a table force horizontal
  page scroll.
- **Spacing:** stick to the Tailwind scale (`gap-2/3/4`, `p-4 md:p-6`); don't
  hand-pick one-off pixel paddings per element — inconsistent padding is what
  reads as "unstable whitespace".
- **Don't fake device chrome.** The shell already draws the phone status bar
  (clock / signal / battery), notch, and home indicator, and reserves that space —
  your screen renders *below* it. Don't add your own status bar, and don't pad the
  top for a notch; just build the screen content. (Web mode is full-bleed, no
  chrome — the app fills the whole viewport.)

Verify both ends before handing off: open `/__ued/shell`, check the Mobile frame
*and* the Web (full-bleed) view; nothing should clip, bleed, or wrap into a
two-line mess.

---

## Step 4 — Prototype iteration (two channels)

**Goal:** tight feedback loop. Keep going until the user says it's done.

### Channel A — Conversational (best for structural / cross-cutting changes)

The user tells you in chat ("make the sidebar collapsible", "swap to a darker
palette", "this section feels heavy"). Apply directly — edit source (or
`tokens.css` for theme-wide changes); HMR reflects it live. No event needed.

### Channel B — Inspect overlay (best for surface tweaks)

In the shell the user toggles the magnifier (or presses `I`), hovers, clicks an
element, and an inline panel lets them: edit text content, edit an input/textarea's
`placeholder`, edit className tokens (color / size / weight / radius via Tailwind
classes), leave a free-text note for you, or hide an element. Every change is appended to
`<WORKING_DIR>/.ued/inspect-events.jsonl`, one event per line:

```jsonl
{"ts":"…","kind":"text-edit","target":{"tag":"h1","text":"欢迎回来","lang":"zh-Hans","path":"App > main > header > h1"},"to":"欢迎回家"}
{"ts":"…","kind":"placeholder-edit","target":{"tag":"input","placeholder":"搜索…","path":"…"},"from":"搜索…","to":"搜索订单号"}
{"ts":"…","kind":"class-edit","target":{"tag":"button","path":"…"},"from":"bg-surface","to":"bg-accent text-white"}
{"ts":"…","kind":"note","target":{"tag":"button","text":"Sign in","path":"…"},"note":"add a loading spinner + disabled state on submit"}
{"ts":"…","kind":"undo","of":{"kind":"text-edit","target":{…},"to":"欢迎回家"}}
```

`lang` is the element's nearest `lang` attribute — it tells you which locale's
string was edited, so a Chinese change doesn't land in the English source.

> **The log is feedback, not source.** Appending to `inspect-events.jsonl` does
> *not* change any `.tsx`. The overlay replays pending edits so they survive a
> refresh visually, but until **you** apply them to source they are not saved —
> the panel says "已记录 · 待落库" (logged · pending), never "saved". `.ued/.cursor`
> is the boundary: events **before** it are already in source; events **after**
> it are pending. The user commits a batch by clicking **落库** in the dock
> popover (next to Inspect / Reload); the badge shows how many edits are pending.

### Channel C — 落库 commit (the durable save the user clicks)

> **Why edits don't reload the page:** the framework excludes `<stateDir>` (`.ued/`)
> from Vite's file watcher (`server.watch.ignored`). Without that, every appended
> inspect event (each blur) is a change to a non-module file inside the project
> root, and Vite answers with a full page reload — which reloads the app iframe
> mid-edit and closes any open dialog / resets the active tab. With it ignored,
> logging never reloads; only real source writes do, and those are React Fast
> Refresh, which preserves UI state (the dialog/tab stays open).

When the user clicks **落库**, the shell first runs the **fast path**: every net
static `text-edit` / `placeholder-edit` is written straight to source via
`POST /__ued/apply` and marked done with an `{kind:"apply", of:…}` line in the
log. If *all* pending edits went via the fast path, the shell advances `.cursor`
itself and you're never involved. Only the **leftovers** — dynamic text, className
edits, hides, notes, or anything the fast path couldn't resolve uniquely — are
written to `.ued/apply-request.json` (`{seq, offset, count, fast, ts}`, where
`offset` = the log size to apply up to and `count` = leftovers). The shell polls
`.ued/apply-result.json` for a result tagged with the same `seq`. **Your job is
to notice the request and apply the leftovers.**

**Arm a watcher whenever inspect is in play** (after scaffolding, on resume, or
the moment the user starts inspecting). Run a background command that blocks
until the marker changes, so a click re-invokes you with zero chat typing:

```bash
# background watcher — exits when the user clicks 落库; re-arm after each apply.
# mtime() is portable: BSD/macOS uses `stat -f %m`, GNU/Linux uses `stat -c %Y`.
# A hardcoded `stat -f %m` silently never fires on Linux (ref==cur forever, the
# loop hangs), so try both forms and fall back to 0 when the file is absent.
cd <WORKING_DIR>
mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }
ref=$(mtime .ued/apply-request.json)
while :; do cur=$(mtime .ued/apply-request.json); [ "$cur" != "$ref" ] && break; sleep 2; done
echo apply-requested
```

When it fires (or the user simply says "应用 inspect 改动"), run the apply loop,
then **re-arm the watcher**.

### The apply loop

1. **Read the pending slice** of `.ued/inspect-events.jsonl` — from the
   `.ued/.cursor` byte offset up to the `offset` in `apply-request.json` (or EOF
   if applying on a chat request). **Filter, in order:** (a) drop events the user
   undid — collect every `{"kind":"undo","of":X}` and drop each matching original
   `X` (match by `kind` + `target.path` + changed value); (b) drop events already
   written by the fast path — collect every `{"kind":"apply","of":X}` and drop the
   target whose net `to` it covers (these are already in source); (c) drop the
   `undo` / `apply` markers themselves. Keep only the **last edit per target**
   (later wins). What remains is the leftovers you must apply.
2. **Apply** each remaining event to source — use `path` + `text` to locate the
   element; verify after each edit. For `placeholder-edit`, change the located
   input/textarea's `placeholder` prop. `note` events are instructions, not
   auto-edits — act on them as feedback. If a target is **dynamic** (e.g. text is `{expr}` /
   className is `cn(...)`) so you can't safely patch it, skip the literal edit and
   handle it by judgement (or leave it for the user) — count it as `skipped`. If
   multiple sites match ambiguously, ask.
3. **Apply** any conversational feedback from the same turn.
4. **Advance `.cursor`** to the `offset` you applied through (the end of the slice).
5. **Write `.ued/apply-result.json`** = `{"seq": <from request>, "applied": <N>,
   "skipped": <M>, "ts": "<iso>"}` so the shell's 落库 button can confirm
   "已写入源码 N 项". (Skip this when applying from a plain chat request.)
6. **Confirm tersely, then re-arm.** On a 落库 commit the user wants the *action*,
   not a report: just apply and reply lean — a single line, or one short bullet
   per edit when there are several (`昵称 → 昵称1`). No preamble, no narrating the
   protocol (cursor / apply-result / fast-path), no re-opening the browser to
   verify — HMR already shows it live and the 落库 button already says "已写入源码
   N 项". Save the detailed walkthrough for when the user asks. Then **re-arm the
   watcher** and wait for the next commit.

When the user is satisfied, the working dir *is* the deliverable: the prototype
source + `design-system/MASTER.md` (the reusable design spec that 延续设计 reads
next time). There is no separate snapshot/export step.

---

## The framework

`<skill>/framework/` is a small Vite plugin (`app-ux-framework`) the template
imports. It contributes only what the prototype can't do itself:

- **`/__ued/shell`** — device frame (mobile / pad / desktop / web) + screen switcher + inspect toggle. Iframes the app at `/`.
- **`/__ued/devices`** — device specs from `<skill>/data/devices.json`.
- **`/__ued/inspect-event` / `/__ued/inspect-events`** — append / tail the inspect event log (`?since=<offset>` tails the pending slice).
- **`/__ued/apply`** — POST `{kind, from, to}`; the **fast path**. Writes a static `text-edit` / `placeholder-edit` straight to source by unique-literal find-replace in `src/**` (returns `{ok:true,file}`), or refuses (`not-found` / `ambiguous` / `unsupported`) so the shell falls back to the agent. No agent, near-instant via HMR.
- **`/__ued/state/<file>`** — raw read/write of `.ued/` state files. The 落库 button uses this to write `apply-request.json`, advance `.cursor`, and read back `apply-result.json`; the bridge reads `.cursor` here too.
- **Inspect bridge** — injected into every served HTML page; handles element picking + live preview edits inside the app, posts events back, and **replays only the pending slice** (events after `.cursor`) via a MutationObserver so edits stick across React re-renders until you apply them to source.

There is no style-picker page and no token generator: theming is just you editing
`tokens.css`. See `ARCHITECTURE.md` for the data flow.

## Scripts & data

| Path | Purpose |
|------|---------|
| `scripts/scaffold.mjs` | Copy template → `docs/ued/<datetime>-<topic>/`, link framework, `pnpm install`, init state. |
| `data/devices.json` | Device-frame specs (phone / pad / desktop / web) for the shell. Extend by adding entries. |

## State files (in `<WORKING_DIR>/`)

| File | Owner | Lifecycle |
|------|-------|-----------|
| `.ued/brief.md` | You (Step 1) | Mode + alignment; written once, updated inline. |
| `.ued/assets/` | User + you | Reference screenshots / mocks. |
| `.ued/screens.json` | scaffold + you (Step 3) | Screen registry; drives the shell switcher. |
| `design-system/MASTER.md` | ui-ux-pro-max + you (Step 2) | Committed design system; 延续设计 reads it. |
| `src/styles/tokens.css` | You (Step 2) | The live theme; hand-edited, not generated. |
| `.ued/inspect-events.jsonl` | User + fast path (Step 4, append) | One event per line; you consume. Also holds `{kind:"apply",of:…}` markers the fast path appends for edits it already wrote to source. |
| `.ued/.cursor` | You + 落库 button | Byte offset already in source (boundary: before = in source, after = pending). The button advances it when *all* edits went via the fast path. |
| `.ued/apply-request.json` | 落库 button (Step 4) | `{seq, offset, count, fast, ts}` — request to write the **leftover** (non-fast-path) edits up to `offset`. `fast` = how many were already written instantly. You watch it. |
| `.ued/apply-result.json` | You (Step 4) | `{seq, applied, skipped, ts}` — written after an apply so the 落库 button confirms. |

## Anti-patterns

- **Don't generate static HTML mockups.** The point is real React that survives implementation.
- **Don't skip ui-ux-pro-max.** It's where the design judgment lives; you orchestrate it, you don't replace it with vibes.
- **Don't put theme colors in inline `style`.** It silently breaks the user's inspect edits — use className. (See the table in Step 3.)
- **Don't apply inspect events silently — but don't over-report either.** A terse
  one-line confirmation per commit is the target; skip the protocol narration and
  re-verification unless asked.
- **Don't re-scaffold on resume.** Read the existing state and restart `pnpm dev`.
- **Don't overwrite committed tokens in 延续设计.** Extend the spec; don't reinvent it.
