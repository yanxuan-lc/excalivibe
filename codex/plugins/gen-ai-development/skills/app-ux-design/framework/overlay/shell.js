// shell.js — drives /__ued/shell.

const NS = "ued";
const el = (sel) => document.querySelector(sel);
const els = (sel) => Array.from(document.querySelectorAll(sel));
const UNDO_LIMIT = 20;

// Theme token slots. The actual hex values are read at render time from the
// iframe's computed :root (CSS variables don't propagate parent-side), so the
// shell page swatches always reflect the current palette.
const COLOR_TOKENS = [
  { key: "background", cssVar: "--ued-background" },
  { key: "surface",    cssVar: "--ued-surface" },
  { key: "foreground", cssVar: "--ued-ink" },
  { key: "muted",      cssVar: "--ued-muted" },
  { key: "border",     cssVar: "--ued-border" },
  { key: "accent",     cssVar: "--ued-accent" },
  { key: "danger",     cssVar: "--ued-danger" },
  { key: "success",    cssVar: "--ued-success" },
];
const COLOR_KEYS = COLOR_TOKENS.map((t) => t.key);

function readTokenColors() {
  const doc = iframe?.contentDocument;
  if (!doc) return Object.fromEntries(COLOR_TOKENS.map((t) => [t.key, "#ddd"]));
  const cs = getComputedStyle(doc.documentElement);
  const out = {};
  for (const t of COLOR_TOKENS) {
    out[t.key] = cs.getPropertyValue(t.cssVar).trim() || "#ddd";
  }
  return out;
}

const TEXT_SIZES = ["xs", "sm", "base", "lg", "xl", "2xl"];
const FONT_WEIGHTS = [
  { key: "normal",   label: "N" },
  { key: "medium",   label: "M" },
  { key: "semibold", label: "SB" },
  { key: "bold",     label: "B" },
];
const RADII = [
  { key: "none", label: "0" },
  { key: "sm",   label: "SM" },
  { key: "md",   label: "MD" },
  { key: "lg",   label: "LG" },
  { key: "xl",   label: "XL" },
  { key: "full", label: "∞" },
];
const DISPLAYS = [
  { key: "flex",        label: "Flex" },
  { key: "grid",        label: "Grid" },
  { key: "block",       label: "Block" },
  { key: "inline-flex", label: "IFlex" },
  { key: "hidden",      label: "Hide" },
];

const state = {
  platform: "web",
  device: null,
  inspectOn: false,
  selection: null,
  devices: { mobile: [], pad: [], desktop: [], web: [] },
  screens: [],
  recentEvents: [],
  undoStack: [],
  // Live editor working copy. editorTarget is the immutable descriptor captured
  // at click time. editorWorking is mutated by the structured controls / text
  // / note fields. editorCommitted snapshots the last saved state, so the
  // auto-commit diff knows what's already in the event log.
  editorTarget: null,
  editorWorking: null,
  editorCommitted: null,
  editorTimestamp: null,
  // Source-commit tracking: pendingCount = durable inspect edits logged but not
  // yet written to source (computed from the agent's .cursor offset). applySeq
  // monotonically tags each "落库" request so we can match its result.
  pendingCount: 0,
  applySeq: 0,
};

let autoCommitTimer = null;

const shell = el("#ued-shell");
const frame = el("#ued-device-frame");
const sizer = el("#ued-frame-sizer");
const chromeTop = el("#ued-chrome-top");
const iframe = el("#ued-app");
const deviceSelect = el("#ued-device");
const screenSelect = el("#ued-screen");
const inspectBtn = el("#ued-inspect-toggle");
const reloadBtn = el("#ued-reload");
const commitBtn = el("#ued-commit");
const commitBadge = el("#ued-commit-badge");
const commitHint = el("#ued-commit-hint");
const panel = el("#ued-inspect-panel");
const panelBody = el("#ued-panel-body");
const panelMenubar = el("#ued-panel-menubar");
const dock = el("#ued-dock");
const dockBall = el("#ued-dock-ball");

// Persisted shell config (platform / device / route / inspect / dock). Restored
// on load so a refresh doesn't reset the preview. `ready` gates saves so the
// restore pass inside init() doesn't write half-applied state back to storage.
const LS_KEY = "ued:shell-config";
let ready = false;

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; }
}
function saveConfig() {
  if (!ready) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      platform: state.platform,
      deviceId: state.device?.id || null,
      route: screenSelect?.value || "/",
      inspectOn: state.inspectOn,
      dockOpen: dock?.dataset.open === "true",
    }));
  } catch {}
}
function setDock(open) {
  dock.dataset.open = open ? "true" : "false";
  dockBall.setAttribute("aria-expanded", open ? "true" : "false");
  saveConfig();
}

async function init() {
  try {
    const r = await fetch("/__ued/devices");
    const data = await r.json();
    state.devices = data || state.devices;
  } catch {
    // first run — proceed with defaults
  }
  await refreshScreens();
  bindControls();
  bindMessages();
  shell.dataset.inspect = "off";

  // Restore persisted config (or defaults). Order matters: setPlatform seeds a
  // default device for that platform, then we override it with the saved one if
  // it's still valid.
  const saved = loadConfig();
  const platform = saved?.platform && state.devices[saved.platform]?.length ? saved.platform : "web";
  setPlatform(platform);
  if (saved?.deviceId) setDevice(saved.deviceId);
  if (saved?.route && saved.route !== "/") {
    const known = state.screens.find((s) => (s.route || "/") === saved.route);
    if (known) { screenSelect.value = saved.route; setScreen(saved.route); }
  }
  if (saved?.dockOpen) setDock(true);
  if (saved?.inspectOn) setInspect(true);
  renderMenubar();
  ready = true;
  void refreshPendingCount();
}

// Load .ued/screens.json into the screen-switcher select. If the file doesn't
// exist (older drafts pre-multi-screen), fall back to a single Home / "/"
// option so the dropdown isn't blank.
async function refreshScreens() {
  let screens = [{ id: "home", name: "Home", route: "/" }];
  try {
    const r = await fetch("/__ued/state/screens.json");
    if (r.ok) {
      const json = await r.json();
      if (Array.isArray(json?.screens) && json.screens.length) screens = json.screens;
    }
  } catch {}
  state.screens = screens;
  screenSelect.innerHTML = "";
  for (const s of screens) {
    const opt = document.createElement("option");
    opt.value = s.route || "/";
    opt.textContent = s.name || s.id;
    screenSelect.appendChild(opt);
  }
  // Default to first; if iframe.src already matches a screen, preserve it.
  const currentPath = new URL(iframe.src || location.origin).pathname;
  const match = screens.find((s) => (s.route || "/") === currentPath);
  if (match) screenSelect.value = match.route;
}

function setScreen(route) {
  if (!route) return;
  // The iframe normally lives at "/"; navigate it to the target route. TanStack
  // Router will pick up the path. Setting iframe.src forces a full reload —
  // acceptable because the device frame visually owns the screen.
  // After the new page loads, the inspect-bridge re-arms itself; if inspect
  // was on, push the on-state through again so the user doesn't have to
  // re-toggle.
  iframe.addEventListener("load", function reArmInspect() {
    iframe.removeEventListener("load", reArmInspect);
    if (state.inspectOn) {
      iframe.contentWindow?.postMessage({ ns: NS, type: "set-inspect", on: true }, "*");
    }
  });
  // Carry the form factor in the URL hash so the app renders the right design on
  // first paint (before the postMessage arrives), avoiding a mobile↔desktop flash.
  const sep = route.includes("#") ? "&" : "#";
  iframe.src = `${route}${sep}ued-ff=${formFactor()}`;
  saveConfig();
}

// Phone/pad status-bar icons (cellular · wifi · battery), dark on a light bar.
const SB_ICONS =
  `<svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="0.7"/><rect x="4.5" y="5.5" width="3" height="6.5" rx="0.7"/><rect x="9" y="3" width="3" height="9" rx="0.7"/><rect x="13.5" y="0.5" width="3" height="11.5" rx="0.7"/></svg>` +
  `<svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 4.2a10 10 0 0 1 14 0" stroke-linecap="round"/><path d="M3.6 6.9a6.2 6.2 0 0 1 8.8 0" stroke-linecap="round"/><circle cx="8" cy="9.8" r="1.1" fill="currentColor" stroke="none"/></svg>` +
  `<svg width="26" height="13" viewBox="0 0 26 13" fill="none" aria-hidden="true"><rect x="0.6" y="0.6" width="21" height="11.8" rx="3" stroke="currentColor" stroke-opacity="0.5"/><rect x="2.4" y="2.4" width="15" height="8.2" rx="1.5" fill="currentColor"/><rect x="23" y="4" width="2" height="5" rx="1" fill="currentColor" fill-opacity="0.5"/></svg>`;

function clockHHMM() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function statusBarHtml() {
  return `<span class="ued-sb-time">${clockHHMM()}</span><span class="ued-sb-icons">${SB_ICONS}</span>`;
}

function stageBox() {
  const stage = el(".ued-stage");
  const cs = getComputedStyle(stage);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  return {
    w: Math.max(120, stage.clientWidth - padX),
    h: Math.max(120, stage.clientHeight - padY),
  };
}

// Re-apply the current layout (used on resize and when the inspect panel toggles
// the stage width). Dispatches to web-fill or device sizing by platform.
function relayout() {
  if (state.platform === "web") setWebFill();
  else if (state.device) setDevice(state.device.id);
}

// Form factor drives which *design* the app renders — a separate mobile vs PC
// UI, not a width-based responsive reflow. Mobile platform → "mobile" design;
// pad / desktop / web → "desktop" design. The app reads this via useFormFactor().
function formFactor() {
  return state.platform === "mobile" ? "mobile" : "desktop";
}
function sendFormFactor() {
  iframe.contentWindow?.postMessage({ ns: NS, type: "set-formfactor", value: formFactor() }, "*");
}

function setPlatform(p) {
  state.platform = p;
  shell.dataset.platform = p;
  els(".ued-platform-group .ued-pill").forEach((b) => b.classList.toggle("is-active", b.dataset.platform === p));
  const list = state.devices[p] || [];
  deviceSelect.innerHTML = "";
  list.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${d.name} · ${d.w}×${d.h}`;
    deviceSelect.appendChild(opt);
  });
  if (p === "web") setWebFill();
  else if (list[0]) setDevice(list[0].id);
  saveConfig();
}

// Web preview = full-bleed: the app fills the whole stage (no device frame, no
// chrome, no scaling), like a real responsive site in a browser tab.
function setWebFill() {
  state.device = null;
  frame.dataset.chrome = "none";
  frame.removeAttribute("data-notch");
  chromeTop.innerHTML = "";
  frame.style.setProperty("--ued-device-radius", "0px");
  sizer.style.width = "100%";
  sizer.style.height = "100%";
  frame.style.transform = "none";
  frame.style.width = "100%";
  frame.style.height = "100%";
  sendFormFactor();
  saveConfig();
}

function setDevice(id) {
  if (state.platform === "web") { setWebFill(); return; }
  const all = [...state.devices.mobile, ...state.devices.pad, ...state.devices.desktop, ...state.devices.web];
  const d = all.find((x) => x.id === id);
  if (!d) return;
  state.device = d;
  deviceSelect.value = id;

  // Size the frame (device dimensions, scaled to fit the stage). The chrome
  // slots (status bar / title bar) live inside this box; the iframe takes the rest.
  const isResponsive = d.w === 0 || d.h === 0;
  const box = stageBox();
  const w = isResponsive ? box.w : d.w;
  const h = isResponsive ? box.h : d.h;
  const scale = Math.min(box.w / w, box.h / h, 1);
  // The iframe renders at the TRUE device width/height; we scale the frame
  // visually with a transform, and the sizer reserves the scaled footprint so
  // the stage centers it correctly. (Without this the app would lay out at the
  // shrunken width and look cramped — sidebar+grid crushed into ~595px, etc.)
  frame.style.width = w + "px";
  frame.style.height = h + "px";
  frame.style.transform = `scale(${scale})`;
  sizer.style.width = Math.round(w * scale) + "px";
  sizer.style.height = Math.round(h * scale) + "px";

  // Chrome: mobile/pad get a status bar (with notch decoration); desktop gets a
  // window title bar (macOS) or a browser bar (generic).
  let chromeKind = "none";
  let notch = "";
  if (state.platform === "mobile") { chromeKind = "mobile"; notch = d.notch || "dynamic-island"; }
  else if (state.platform === "pad") { chromeKind = "pad"; }
  else { chromeKind = d.chrome === "macos" ? "macos" : "browser"; }

  frame.dataset.chrome = chromeKind;
  if (notch) frame.dataset.notch = notch; else frame.removeAttribute("data-notch");
  chromeTop.innerHTML = (chromeKind === "mobile" || chromeKind === "pad") ? statusBarHtml() : "";

  const radius = state.platform === "mobile" ? (d.shellRadius || 40)
              : state.platform === "pad" ? (d.shellRadius || 22)
              : 10;
  frame.style.setProperty("--ued-device-radius", radius + "px");
  sendFormFactor();
  saveConfig();
}

function setInspect(on) {
  if (!on) flushAutoCommit();
  state.inspectOn = on;
  inspectBtn.classList.toggle("is-active", on);
  iframe.contentWindow?.postMessage({ ns: NS, type: "set-inspect", on }, "*");
  shell.dataset.inspect = on ? "on" : "off";
  panel.setAttribute("aria-hidden", on ? "false" : "true");
  // The floating panel shifts the stage; recompute the layout against the new box.
  relayout();
  if (!on) {
    state.editorTarget = null;
    state.editorWorking = null;
    state.editorCommitted = null;
    panelBody.innerHTML = `<p class="ued-panel-hint">Hover over the app and click any element to edit.</p>` + renderRecent();
  }
  saveConfig();
}

function bindControls() {
  els(".ued-platform-group .ued-pill").forEach((b) => {
    b.addEventListener("click", () => setPlatform(b.dataset.platform));
  });
  deviceSelect.addEventListener("change", () => setDevice(deviceSelect.value));
  if (screenSelect) screenSelect.addEventListener("change", () => setScreen(screenSelect.value));
  inspectBtn.addEventListener("click", () => setInspect(!state.inspectOn));
  reloadBtn.addEventListener("click", () => { iframe.src = iframe.src; });
  commitBtn.addEventListener("click", () => { void commitToAgent(); });
  el("#ued-panel-close").addEventListener("click", () => setInspect(false));
  dockBall.addEventListener("click", () => setDock(dock.dataset.open !== "true"));
  window.addEventListener("keydown", (e) => {
    if ((e.key === "i" || e.key === "I") && !isTyping(e.target)) {
      setInspect(!state.inspectOn);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
      if (isTyping(e.target)) return;
      if (!state.undoStack.length) return;
      e.preventDefault();
      undo();
    }
  });
  window.addEventListener("resize", () => relayout());
  // Keep the device status-bar clock current.
  setInterval(() => {
    const t = el(".ued-sb-time");
    if (t) t.textContent = clockHHMM();
  }, 30000);
}

function isTyping(node) {
  if (!node) return false;
  const t = node.tagName?.toLowerCase();
  return t === "input" || t === "textarea" || node.isContentEditable;
}

function bindMessages() {
  window.addEventListener("message", (ev) => {
    const m = ev.data;
    if (!m || m.ns !== NS) return;
    if (m.type === "bridge-ready") {
      iframe.contentWindow?.postMessage({ ns: NS, type: "set-inspect", on: state.inspectOn }, "*");
      sendFormFactor();
    } else if (m.type === "select") {
      // Switching to a new element — commit anything pending on the previous one first.
      flushAutoCommit();
      state.selection = m.payload;
      renderEditor(m.payload);
    } else if (m.type === "escape") {
      setInspect(false);
    }
  });
}

/* ============================================================
 * className parsing — split a Tailwind class string into named
 * slots (Fill / Text / Size / …) plus raw leftovers, and serialize
 * back. Stable round-trip for recognized slots; everything else
 * goes through unchanged via `raw`.
 * ============================================================ */

function parseClasses(className) {
  const all = (className || "").trim().split(/\s+/).filter(Boolean);
  const out = {
    bg: null, textColor: null, textSize: null, weight: null,
    radius: null, display: null,
    raw: [],
  };
  for (const c of all) {
    let m;
    if ((m = COLOR_KEYS.find((k) => c === `bg-${k}`))) { out.bg = m; continue; }
    if ((m = COLOR_KEYS.find((k) => c === `text-${k}`))) { out.textColor = m; continue; }
    if ((m = TEXT_SIZES.find((s) => c === `text-${s}`))) { out.textSize = m; continue; }
    const w = FONT_WEIGHTS.find((x) => c === `font-${x.key}`);
    if (w) { out.weight = w.key; continue; }
    if (c === "rounded") { out.radius = "md"; continue; }
    const r = RADII.find((x) => c === `rounded-${x.key}`);
    if (r) { out.radius = r.key; continue; }
    const d = DISPLAYS.find((x) => c === x.key);
    if (d) { out.display = d.key; continue; }
    out.raw.push(c);
  }
  return out;
}

function serializeClasses(p) {
  const out = [];
  if (p.display) out.push(p.display);
  if (p.bg) out.push(`bg-${p.bg}`);
  if (p.textColor) out.push(`text-${p.textColor}`);
  if (p.textSize) out.push(`text-${p.textSize}`);
  if (p.weight) out.push(`font-${p.weight}`);
  if (p.radius) out.push(p.radius === "md" ? "rounded" : `rounded-${p.radius}`);
  out.push(...p.raw);
  return out.join(" ");
}

/* ============================================================
 * Figma-style className panel
 * ============================================================ */

function renderClassPanel() {
  const p = parseClasses(state.editorWorking?.className || "");
  const colors = readTokenColors();

  const swatchRow = (slot, label) => {
    const cur = p[slot];
    const cells = [
      `<button class="ued-sw ued-sw-none ${cur ? "" : "is-active"}" data-slot="${slot}" data-val="" title="无"></button>`,
      ...COLOR_TOKENS.map((t) =>
        `<button class="ued-sw ${cur === t.key ? "is-active" : ""}" data-slot="${slot}" data-val="${t.key}" title="${t.key} · ${colors[t.key]}" style="background:${colors[t.key]}"></button>`,
      ),
    ].join("");
    return `<div class="ued-prop"><div class="ued-prop-name">${label}</div><div class="ued-prop-controls ued-swatches">${cells}</div></div>`;
  };

  const pillRow = (slot, label, options) => {
    const cur = p[slot];
    const cells = [
      `<button class="ued-ps ued-ps-none ${cur ? "" : "is-active"}" data-slot="${slot}" data-val="">⌀</button>`,
      ...options.map((o) => {
        const k = typeof o === "object" ? o.key : o;
        const l = typeof o === "object" ? o.label : o.toUpperCase();
        return `<button class="ued-ps ${cur === k ? "is-active" : ""}" data-slot="${slot}" data-val="${k}">${escapeHtml(l)}</button>`;
      }),
    ].join("");
    return `<div class="ued-prop"><div class="ued-prop-name">${label}</div><div class="ued-prop-controls ued-pillset">${cells}</div></div>`;
  };

  const rawPills = p.raw.length
    ? p.raw.map((c) => {
        const safe = escapeHtml(c);
        return `<span class="ued-raw-pill">${safe}<button class="ued-raw-x" data-cls="${safe}" title="移除">×</button></span>`;
      }).join("")
    : `<span class="ued-raw-empty">无其它 class</span>`;

  return `
    <div class="ued-classpanel" id="ued-class-panel">
      ${swatchRow("bg", "Fill")}
      ${swatchRow("textColor", "Text")}
      ${pillRow("textSize", "Size", TEXT_SIZES)}
      ${pillRow("weight", "Weight", FONT_WEIGHTS)}
      ${pillRow("radius", "Radius", RADII)}
      ${pillRow("display", "Display", DISPLAYS)}
      <div class="ued-prop ued-prop-raw">
        <div class="ued-prop-name">Other</div>
        <div class="ued-prop-controls">
          <div class="ued-raw-pills">${rawPills}</div>
          <input class="ued-raw-input" id="ued-class-add" placeholder="+ class … (Enter)" />
        </div>
      </div>
    </div>
  `;
}

function bindClassPanel() {
  els("#ued-class-panel [data-slot]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slot = btn.dataset.slot;
      const val = btn.dataset.val || null;
      const p = parseClasses(state.editorWorking.className || "");
      p[slot] = val;
      updateWorkingClassName(serializeClasses(p));
    });
  });
  els("#ued-class-panel .ued-raw-x").forEach((x) => {
    x.addEventListener("click", () => {
      const cls = x.dataset.cls;
      const p = parseClasses(state.editorWorking.className || "");
      p.raw = p.raw.filter((c) => c !== cls);
      updateWorkingClassName(serializeClasses(p));
    });
  });
  const addInput = el("#ued-class-add");
  if (addInput) {
    addInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const v = addInput.value.trim();
      if (!v) return;
      const p = parseClasses(state.editorWorking.className || "");
      const incoming = parseClasses(v);
      // Recognized slots from input override existing; raw appended unique.
      for (const k of ["bg", "textColor", "textSize", "weight", "radius", "display"]) {
        if (incoming[k]) p[k] = incoming[k];
      }
      for (const r of incoming.raw) if (!p.raw.includes(r)) p.raw.push(r);
      addInput.value = "";
      updateWorkingClassName(serializeClasses(p));
    });
  }
}

// Mutate working className, live-apply to the iframe, re-render the class
// panel, and schedule an auto-commit. Multiple rapid clicks (e.g. flipping
// through swatches) collapse into one event 400ms after the last interaction.
function updateWorkingClassName(newCls) {
  state.editorWorking.className = newCls;
  iframe.contentWindow?.postMessage(
    {
      ns: NS,
      type: "apply-edit",
      payload: { selector: state.editorTarget, kind: "className", value: newCls },
    },
    "*",
  );
  const container = el("#ued-class-panel");
  if (container) {
    const tmp = document.createElement("div");
    tmp.innerHTML = renderClassPanel().trim();
    container.replaceWith(tmp.firstElementChild);
    bindClassPanel();
  }
  scheduleAutoCommit();
}

/* ============================================================
 * Auto-commit — flushes editorWorking diff into the event log
 * + undo stack without an explicit "Save" click. Triggered by:
 *   - className change (debounced 400ms)
 *   - text/note textarea blur (immediate)
 *   - new element selected (flush before re-render)
 *   - inspect turned off / panel closed (flush)
 * ============================================================ */

function scheduleAutoCommit(delay = 400) {
  if (autoCommitTimer) clearTimeout(autoCommitTimer);
  autoCommitTimer = setTimeout(() => {
    autoCommitTimer = null;
    void autoCommit();
  }, delay);
}

function flushAutoCommit() {
  if (autoCommitTimer) {
    clearTimeout(autoCommitTimer);
    autoCommitTimer = null;
  }
  void autoCommit();
}

async function autoCommit() {
  const t = state.editorTarget;
  const w = state.editorWorking;
  const c = state.editorCommitted;
  if (!t || !w || !c) return;

  // Latest textarea values (working copies for these get pulled on demand —
  // textareas are uncontrolled, source-of-truth is the input itself until
  // we snapshot it here).
  const liveText = el("#ued-edit-text")?.value ?? w.text;
  const liveNote = (el("#ued-edit-note")?.value ?? "").trim();
  // Placeholder only exists for input/textarea (c.placeholder != null then).
  const livePlaceholder = c.placeholder != null ? (el("#ued-edit-placeholder")?.value ?? c.placeholder) : null;

  const events = [];
  if (t.hasDirectText && liveText !== c.text) {
    events.push({ kind: "text-edit", target: t, from: c.text, to: liveText });
    iframe.contentWindow?.postMessage(
      { ns: NS, type: "apply-edit", payload: { selector: t, kind: "text", value: liveText } },
      "*",
    );
  }
  if (c.placeholder != null && livePlaceholder !== c.placeholder) {
    events.push({ kind: "placeholder-edit", target: t, from: c.placeholder, to: livePlaceholder });
    iframe.contentWindow?.postMessage(
      { ns: NS, type: "apply-edit", payload: { selector: t, kind: "placeholder", value: livePlaceholder } },
      "*",
    );
  }
  if (w.className !== c.className) {
    events.push({ kind: "class-edit", target: t, from: c.className, to: w.className });
    // Already live-applied via updateWorkingClassName.
  }
  if (liveNote && liveNote !== c.note) {
    events.push({ kind: "note", target: t, note: liveNote });
  }
  if (!events.length) return;

  for (const ev of events) await postEvent(ev);
  state.recentEvents.push(...events);
  for (const ev of events) if (inverseEdit(ev)) pushUndo(ev);

  state.editorCommitted = { className: w.className, text: liveText, placeholder: livePlaceholder, note: liveNote };
  state.editorWorking = { className: w.className, text: liveText, placeholder: livePlaceholder, note: liveNote };
  state.editorTimestamp = new Date();
  renderMenubar();
  renderSaveStatus();
  renderRecentIntoBody();
  void refreshPendingCount();
}

function renderSaveStatus() {
  const status = el("#ued-save-status");
  if (!status) return;
  const ts = state.editorTimestamp;
  if (!ts) {
    status.textContent = "尚未改动";
    status.dataset.state = "idle";
    return;
  }
  const h = String(ts.getHours()).padStart(2, "0");
  const m = String(ts.getMinutes()).padStart(2, "0");
  const s = String(ts.getSeconds()).padStart(2, "0");
  // Honest wording: the edit is recorded in the feedback log, NOT yet written to
  // source. Durable persistence happens when the user clicks 落库 and the agent
  // applies it. Avoid implying it's already saved to disk.
  status.textContent = `已记录 · 待落库 · ${h}:${m}:${s}`;
  status.dataset.state = "saved";
}

// Update the "Recent edits" sub-block in place without nuking the editor.
function renderRecentIntoBody() {
  const log = el(".ued-event-log");
  if (!log) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = renderRecent().trim();
  if (tmp.firstElementChild) log.replaceWith(tmp.firstElementChild);
}

/* ============================================================
 * Editor / commit / undo
 * ============================================================ */

function renderEditor(target) {
  state.editorTarget = target;
  state.editorWorking = {
    className: target.className || "",
    text: target.text || "",
    placeholder: target.placeholder ?? null, // null = element has no placeholder slot
    note: "",
  };
  state.editorCommitted = { ...state.editorWorking };
  state.editorTimestamp = null;

  const safeText = (target.text || "").replace(/</g, "&lt;");
  const editable = !!target.hasDirectText;
  const hasPlaceholder = target.placeholder != null; // input / textarea
  const safePlaceholder = String(target.placeholder ?? "").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  panelBody.innerHTML = `
    <div class="ued-target">
      <b>&lt;${target.tag}&gt;</b><br/>
      ${target.path || ""}
      ${target.id ? `<br/><i>#${target.id}</i>` : ""}
      ${target.data?.loc ? `<br/><small>📍 ${escapeHtml(target.data.loc)}</small>` : ""}
    </div>
    <div class="ued-field">
      <label>Text content${editable ? "" : " <span style='text-transform:none;color:#94A3B8'>· 此元素无直接文本</span>"}</label>
      <textarea id="ued-edit-text" ${editable ? "" : "disabled"} placeholder="${editable ? "" : "（容器元素，仅含子元素）"}">${editable ? safeText : ""}</textarea>
    </div>
    ${hasPlaceholder ? `
    <div class="ued-field">
      <label>Placeholder</label>
      <input id="ued-edit-placeholder" type="text" value="${safePlaceholder}" placeholder="占位提示文案" />
    </div>` : ""}
    <div class="ued-field">
      <label>className</label>
      ${renderClassPanel()}
    </div>
    <div class="ued-field">
      <label>Note for agent</label>
      <textarea id="ued-edit-note" placeholder="e.g. 'this should be smaller and right-aligned on mobile'"></textarea>
    </div>
    <div class="ued-row">
      <button class="ued-btn" data-kind="hide">Hide</button>
      <div class="ued-save-status" id="ued-save-status" data-state="idle">尚未保存</div>
    </div>
    ${renderRecent()}
  `;
  bindClassPanel();
  el(".ued-row [data-kind=hide]").addEventListener("click", () => commitHide(target));

  // Auto-commit on blur of text / placeholder / note fields (immediate, no debounce).
  el("#ued-edit-text")?.addEventListener("blur", () => flushAutoCommit());
  el("#ued-edit-placeholder")?.addEventListener("blur", () => flushAutoCommit());
  el("#ued-edit-note")?.addEventListener("blur", () => flushAutoCommit());
}

function renderRecent() {
  if (!state.recentEvents.length) return "";
  const items = state.recentEvents.slice(-5).reverse().map((e) => {
    const label =
      e.kind === "text-edit" ? `text → "${truncate(e.to, 40)}"`
      : e.kind === "placeholder-edit" ? `placeholder → "${truncate(e.to, 40)}"`
      : e.kind === "class-edit" ? `class → "${truncate(e.to, 40)}"`
      : e.kind === "note"       ? `note: "${truncate(e.note, 40)}"`
      : e.kind === "hide"       ? `hide ${e.target?.tag}`
      : e.kind;
    return `<li><code>${e.target?.tag}</code> · ${escapeHtml(label)}</li>`;
  }).join("");
  return `<div class="ued-event-log"><h4>Recent edits (this session)</h4><ol>${items}</ol></div>`;
}

function renderMenubar() {
  const canUndo = state.undoStack.length > 0;
  panelMenubar.innerHTML = `
    <button id="ued-undo-btn" class="ued-menu-btn" ${canUndo ? "" : "disabled"}>
      <span>↶ Undo</span>
      ${canUndo ? `<span class="ued-menu-badge">${state.undoStack.length}</span>` : ""}
      <span class="ued-menu-kbd">⌘Z</span>
    </button>
  `;
  const btn = el("#ued-undo-btn");
  if (btn) btn.addEventListener("click", undo);
}

function inverseEdit(ev) {
  if (ev.kind === "text-edit")  return { kind: "text",      value: ev.from ?? "" };
  if (ev.kind === "placeholder-edit") return { kind: "placeholder", value: ev.from ?? "" };
  if (ev.kind === "class-edit") return { kind: "className", value: ev.from ?? "" };
  if (ev.kind === "hide")       return { kind: "show" };
  if (ev.kind === "show")       return { kind: "hide" };
  return null;
}

function pushUndo(ev) {
  state.undoStack.push(ev);
  if (state.undoStack.length > UNDO_LIMIT) {
    state.undoStack.splice(0, state.undoStack.length - UNDO_LIMIT);
  }
}

async function undo() {
  if (!state.undoStack.length) return;
  const ev = state.undoStack.pop();
  const inv = inverseEdit(ev);
  if (inv) {
    iframe.contentWindow?.postMessage(
      { ns: NS, type: "apply-edit", payload: { selector: ev.target, ...inv } },
      "*",
    );
  }
  const idx = state.recentEvents.lastIndexOf(ev);
  if (idx >= 0) state.recentEvents.splice(idx, 1);
  await postEvent({ kind: "undo", of: ev });
  const label =
    ev.kind === "text-edit" ? `text → "${truncate(ev.from ?? "", 40)}"`
    : ev.kind === "class-edit" ? `class → "${truncate(ev.from ?? "", 40)}"`
    : ev.kind === "hide" ? `重新显示 ${ev.target?.tag}`
    : ev.kind === "show" ? `重新隐藏 ${ev.target?.tag}`
    : ev.kind === "note" ? `撤销 note` : ev.kind;
  panelBody.innerHTML =
    `<p class="ued-panel-hint">已撤销：${escapeHtml(label)}</p>` + renderRecent();
  renderMenubar();
  void refreshPendingCount();
}

async function commitHide(target) {
  flushAutoCommit();
  const event = { kind: "hide", target };
  iframe.contentWindow?.postMessage({ ns: NS, type: "apply-edit", payload: { selector: target, kind: "hide" } }, "*");
  await postEvent(event);
  state.recentEvents.push(event);
  pushUndo(event);
  panelBody.innerHTML = `<p class="ued-panel-hint">Hidden. ⌘Z 撤销以重新显示。</p>${renderRecent()}`;
  renderMenubar();
  void refreshPendingCount();
}

async function postEvent(ev) {
  try {
    await fetch("/__ued/inspect-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ev, ts: new Date().toISOString() }),
    });
  } catch (e) {
    console.warn("ued: failed to persist event", e);
  }
}

/* ============================================================
 * Commit to source.
 *
 * Inspect edits append to .ued/inspect-events.jsonl — a feedback log, NOT the
 * source. .ued/.cursor is the byte offset already written to source. On 落库 we:
 *   1. FAST PATH — write static text/placeholder edits straight to source via
 *      POST /__ued/apply (unique literal find-replace). Instant, no agent. Each
 *      success gets an {kind:"apply"} marker so it's treated as in-source.
 *   2. If everything went via the fast path, advance .cursor ourselves — done.
 *   3. LEFTOVERS (dynamic text / className / hide / notes / ambiguous) → write
 *      apply-request.json; a watching agent applies them and writes
 *      apply-result.json, which we poll.
 * pendingCount = net edits after cursor, minus undone, minus fast-path-acked.
 * ============================================================ */

const keyOf = (t) => t?.selector || t?.path || "";
const sigOf = (e) => `${e.kind}|${keyOf(e.target)}|${e.to ?? e.from ?? ""}`;

// Net pending edits after the cursor: last edit per target (later wins), with
// undone and fast-path-acked targets removed. `from` is the FIRST edit's value
// (the original source string) so the fast path can find it; `to` is the last.
async function loadPendingNet() {
  let since = 0;
  try {
    const cr = await fetch("/__ued/state/.cursor");
    if (cr.ok) since = Number((await cr.text()).trim()) || 0;
  } catch { /* no cursor → from start */ }
  let events = [], offset = since;
  try {
    const r = await fetch(`/__ued/inspect-events?since=${since}`);
    const j = await r.json();
    events = j.events || [];
    offset = Number(j.offset) || since;
  } catch { /* empty */ }

  const undone = new Set(events.filter((e) => e.kind === "undo" && e.of).map((e) => sigOf(e.of)));
  const acked = new Map(); // target key → `to` already written to source
  for (const e of events) if (e.kind === "apply" && e.of) acked.set(keyOf(e.of.target), e.of.to);

  const lastByTarget = new Map();
  const firstFrom = new Map();
  let notes = 0;
  for (const ev of events) {
    if (ev.kind === "note") { notes++; continue; }
    if (!["text-edit", "placeholder-edit", "class-edit", "hide", "show"].includes(ev.kind)) continue;
    if (undone.has(sigOf(ev))) continue;
    const k = keyOf(ev.target) || sigOf(ev);
    if (!firstFrom.has(k)) firstFrom.set(k, ev.from);
    lastByTarget.set(k, ev);
  }
  const list = [];
  for (const [k, ev] of lastByTarget) {
    if (acked.get(k) === ev.to) continue;            // already in source via fast path
    const from = firstFrom.get(k);
    if (from !== undefined && from === ev.to) continue; // net no-op (edited back to original) — drop entirely
    list.push({ key: k, kind: ev.kind, target: ev.target, from, to: ev.to });
  }
  return { list, notes, offset };
}

async function refreshPendingCount() {
  try {
    const { list, notes } = await loadPendingNet();
    state.pendingCount = list.length + notes;
  } catch {
    state.pendingCount = 0;
  }
  renderCommitBadge();
}

function renderCommitBadge() {
  if (!commitBadge) return;
  const n = state.pendingCount;
  if (n > 0) { commitBadge.textContent = String(n); commitBadge.hidden = false; }
  else { commitBadge.hidden = true; }
}

function setCommitState(stateName, label, hint, hintState) {
  if (commitBtn) {
    commitBtn.dataset.state = stateName || "";
    const lab = commitBtn.querySelector(".ued-commit-label");
    if (lab && label) lab.textContent = label;
    commitBtn.disabled = stateName === "busy";
  }
  if (commitHint) {
    if (hint) { commitHint.textContent = hint; commitHint.hidden = false; commitHint.dataset.state = hintState || ""; }
    else { commitHint.hidden = true; }
  }
}

async function commitToAgent() {
  flushAutoCommit();
  // snapOffset = log EOF at the moment we snapshot the pending set. Anything the
  // user appends AFTER this (still editing while we commit) is > snapOffset and
  // must stay pending — so we never advance the cursor past it (see below).
  const { list, notes, offset: snapOffset } = await loadPendingNet();
  state.pendingCount = list.length + notes;
  renderCommitBadge();
  if (list.length + notes === 0) {
    setCommitState("", "落库", "没有待落库的改动。先用 Inspect 改点东西吧。", "");
    setTimeout(() => setCommitState("", "落库", "", ""), 2400);
    return;
  }

  const seq = (state.applySeq = Date.now());
  setCommitState("busy", "落库中…", "正在写入源码…", "");

  // 1) Fast path — static text / placeholder edits written straight to source.
  let fast = 0;
  const deferred = [];
  for (const e of list) {
    if (e.kind === "text-edit" || e.kind === "placeholder-edit") {
      let ok = false;
      try {
        const r = await fetch("/__ued/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: e.kind, from: e.from, to: e.to }),
        });
        ok = (await r.json())?.ok === true;
      } catch { /* fall through to deferred */ }
      if (ok) {
        fast++;
        // Mark as in-source so pending/replay stop counting it.
        await postEvent({ kind: "apply", of: { kind: e.kind, target: e.target, to: e.to } });
        continue;
      }
    }
    deferred.push(e);
  }

  // Re-read EOF *after* the apply markers, so the agent's slice (apply-request
  // offset) includes them. Only used on the agent path below; the fast-path-only
  // path advances the cursor to snapOffset instead.
  let offset = 0;
  try {
    const r = await fetch("/__ued/inspect-events?since=0");
    offset = Number((await r.json()).offset) || 0;
  } catch { /* best effort */ }

  const needAgent = deferred.length > 0 || notes > 0;
  if (!needAgent) {
    // Everything went via the fast path → advance the cursor ourselves. No agent.
    // Advance to snapOffset (NOT the fresh EOF): the apply markers we appended
    // sit after snapOffset, but they're harmless when left pending (next load
    // sees them as acked no-ops). Stopping at snapOffset means a user edit
    // appended mid-commit stays pending instead of being skipped and lost.
    try {
      await fetch("/__ued/state/.cursor", { method: "POST", headers: { "Content-Type": "text/plain" }, body: String(snapOffset) });
    } catch { /* non-fatal */ }
    await refreshPendingCount();
    setCommitState("done", "落库", `已写入源码 ${fast} 项 · 即时`, "");
    setTimeout(() => setCommitState("", "落库", "", ""), 5000);
    return;
  }

  // 2) Leftovers (dynamic text / className / hide / notes / ambiguous) → agent.
  setCommitState("busy", "落库中…", `${fast > 0 ? fast + " 项已即时写入；" : ""}${deferred.length + notes} 项交给 Codex…`, "");
  try {
    await fetch("/__ued/state/apply-request.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seq, offset, count: deferred.length + notes, fast, ts: new Date().toISOString() }),
    });
  } catch {
    setCommitState("error", "落库", "无法写入提交标记，请检查 dev server。", "error");
    return;
  }

  const deadline = Date.now() + 90000;
  const poll = async () => {
    let res = null;
    try {
      const r = await fetch("/__ued/state/apply-result.json", { cache: "no-store" });
      if (r.ok) res = await r.json();
    } catch { /* not written yet */ }
    if (res && Number(res.seq) === seq) {
      await refreshPendingCount();
      const applied = (res.applied ?? deferred.length) + fast;
      const skipped = res.skipped ? `，${res.skipped} 项需人工处理` : "";
      setCommitState("done", "落库", `已写入源码 ${applied} 项${skipped}。`, "");
      setTimeout(() => setCommitState("", "落库", "", ""), 6000);
      return;
    }
    if (Date.now() > deadline) {
      setCommitState("", "落库", "已提交，但未收到 Codex 的写入确认（确认会话在监听，或直接说「应用 inspect 改动」）。", "error");
      return;
    }
    setTimeout(() => { void poll(); }, 500);
  };
  setTimeout(() => { void poll(); }, 300);
}

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c])); }
function truncate(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : s; }

init();
