// inspect-bridge.js — injected into every Vite-served page (except /__ued/*).
//
// Listens for postMessage commands from the shell parent and reports selection / edit
// events. Has no UI of its own beyond a highlight overlay.

(function () {
  if (window.__uedBridge) return;
  const NS = "ued";
  const UID_ATTR = "data-ued-uid";
  let inspectOn = false;
  let hoverBox = null;
  let selectBox = null;
  let lastHovered = null;
  let selectedEl = null;
  let uidCounter = 0;

  // Concatenate only the DIRECT text-node children's content. We use this
  // (not innerText) as the canonical "text" the user can safely edit — if the
  // element has no direct text, edits would otherwise blast through to nested
  // child elements (icons, layout wrappers) which is never what the user wants.
  function directText(el) {
    let out = "";
    for (const n of el.childNodes) {
      if (n.nodeType === 3) out += n.nodeValue || "";
    }
    return out;
  }

  function describe(el) {
    if (!el || el.nodeType !== 1) return null;
    const tag = el.tagName.toLowerCase();
    const directRaw = directText(el);
    const text = directRaw.trim().slice(0, 160);
    const hasDirectText = directRaw.trim() !== "";
    const className = el.className?.toString?.() || "";
    const id = el.id || "";
    // ancestor path (root → element), short labels
    const path = [];
    let cur = el;
    while (cur && cur !== document.body && path.length < 8) {
      const seg = cur.tagName.toLowerCase()
        + (cur.id ? `#${cur.id}` : "")
        + (cur.className && typeof cur.className === "string"
            ? "." + cur.className.trim().split(/\s+/).slice(0, 2).join(".")
            : "");
      path.unshift(seg);
      cur = cur.parentElement;
    }
    // Walk up to find the nearest [lang] ancestor (or html lang) so the agent
    // knows which locale this text belongs to.
    let langEl = el;
    let lang = null;
    while (langEl) {
      if (langEl.lang) { lang = langEl.lang; break; }
      langEl = langEl.parentElement;
    }
    if (!lang) lang = document.documentElement.lang || null;
    const rect = el.getBoundingClientRect();
    // Inputs / textareas have no direct text to edit; their visible copy lives in
    // the `placeholder` attribute. Capture it so the panel can offer a field.
    const supportsPlaceholder = tag === "input" || tag === "textarea";
    const placeholder = supportsPlaceholder ? (el.getAttribute("placeholder") ?? "") : null;
    return {
      tag, text, hasDirectText, className, id, lang, placeholder,
      path: path.join(" > "),
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      data: {
        loc: el.getAttribute?.("data-loc") || null,
        testid: el.getAttribute?.("data-testid") || null,
      },
    };
  }

  function makeBox({ dashed }) {
    const box = document.createElement("div");
    box.style.cssText = `
      position: fixed; pointer-events: none; z-index: 2147483646;
      border: 2px ${dashed ? "dashed" : "solid"} #3B82F6;
      background: ${dashed ? "rgba(59,130,246,0.04)" : "rgba(59,130,246,0.10)"};
      box-shadow: 0 0 0 1px rgba(0,0,0,0.06); border-radius: 2px;
      transition: all 60ms linear;
      display: none;
    `;
    document.documentElement.appendChild(box);
    return box;
  }

  function ensureHover() {
    if (!hoverBox) hoverBox = makeBox({ dashed: true });
    return hoverBox;
  }

  function ensureSelect() {
    if (!selectBox) selectBox = makeBox({ dashed: false });
    return selectBox;
  }

  function placeBox(box, rect) {
    box.style.display = "block";
    box.style.left = rect.x + "px";
    box.style.top = rect.y + "px";
    box.style.width = rect.w + "px";
    box.style.height = rect.h + "px";
  }

  function hideHover() {
    if (hoverBox) hoverBox.style.display = "none";
  }

  function hideSelect() {
    if (selectBox) selectBox.style.display = "none";
  }

  function refreshSelect() {
    if (!selectedEl || !document.contains(selectedEl)) {
      hideSelect();
      return;
    }
    const r = selectedEl.getBoundingClientRect();
    placeBox(ensureSelect(), { x: r.x, y: r.y, w: r.width, h: r.height });
  }

  function onMove(e) {
    if (!inspectOn) return;
    const el = e.target;
    if (el === lastHovered) return;
    lastHovered = el;
    const desc = describe(el);
    if (!desc) return;
    if (el === selectedEl) {
      // Don't draw hover box on top of selected — they'd visually fight.
      hideHover();
    } else {
      placeBox(ensureHover(), desc.rect);
    }
    parent.postMessage({ ns: NS, type: "hover", payload: desc }, "*");
  }

  function onClick(e) {
    if (!inspectOn) return;
    e.preventDefault();
    e.stopPropagation();
    const desc = describe(e.target);
    if (!desc) return;
    selectedEl = e.target;
    // Pin a stable token on the picked element so every later live edit resolves
    // to exactly THIS node — even after an edit mutates its text/className, which
    // would otherwise defeat the fuzzy descriptor lookup and land the edit on the
    // wrong element (the root cause of "edited but nothing updated").
    let uid = selectedEl.getAttribute(UID_ATTR);
    if (!uid) { uid = "u" + (++uidCounter); selectedEl.setAttribute(UID_ATTR, uid); }
    desc.uid = uid;
    // Also capture a STABLE structural selector (nth-child path anchored at the
    // nearest id). The uid is runtime-only and gone after a refresh; this selector
    // re-finds the exact element on a fresh render, so replay restores the right
    // node (not a fuzzy text/class guess that lands on a sibling).
    desc.selector = cssPath(selectedEl);
    hideHover();
    placeBox(ensureSelect(), desc.rect);
    parent.postMessage({ ns: NS, type: "select", payload: desc }, "*");
  }

  function setInspect(on) {
    inspectOn = !!on;
    document.documentElement.style.cursor = inspectOn ? "crosshair" : "";
    if (!inspectOn) {
      hideHover();
      hideSelect();
      selectedEl = null;
      lastHovered = null;
    }
  }

  // Replace ONLY the direct text-node children of an element. Containers with
  // no direct text are refused so editing a layout wrapper can never reach into
  // its children. Whitespace-only direct text nodes (the spacing between child
  // elements in JSX output) are preserved untouched.
  function replaceTextContent(el, value) {
    if (!el) return false;
    const directTextNodes = Array.from(el.childNodes).filter(
      (n) => n.nodeType === 3 && (n.nodeValue || "").trim() !== "",
    );
    if (directTextNodes.length === 0) return false;
    directTextNodes[0].nodeValue = value;
    for (let i = 1; i < directTextNodes.length; i++) directTextNodes[i].nodeValue = "";
    return true;
  }

  // Apply a live edit from the panel (in-iframe only; persistence is handled by parent).
  function applyEdit(payload) {
    const { selector, kind, value } = payload || {};
    if (!selector) return false;
    const el = resolveTarget(selector);
    if (!el) return false;
    if (kind === "text") {
      const ok = replaceTextContent(el, value);
      if (ok && el === selectedEl) refreshSelect();
      return ok;
    } else if (kind === "placeholder") {
      if ("placeholder" in el) el.placeholder = value ?? "";
      else el.setAttribute("placeholder", value ?? "");
      if (el === selectedEl) refreshSelect();
      return true;
    } else if (kind === "className") {
      el.className = value;
      if (el === selectedEl) refreshSelect();
    } else if (kind === "hide") {
      el.style.display = "none";
      if (el === selectedEl) hideSelect();
    } else if (kind === "show") {
      el.style.display = "";
      if (el === selectedEl) refreshSelect();
    }
    return true;
  }

  // Resolve the element a live edit targets. Priority:
  //   1. the pinned uid attribute (exact node, survives text/class mutation),
  //   2. the currently-selected element (live edits always target the selection),
  //   3. best-effort fuzzy descriptor lookup (used by cross-refresh replay, when
  //      uids no longer exist and selectedEl is null).
  function resolveTarget(desc) {
    if (desc?.uid) {
      const byUid = document.querySelector(`[${UID_ATTR}="${cssEscape(desc.uid)}"]`);
      if (byUid) return byUid;
    }
    if (selectedEl && document.contains(selectedEl)) return selectedEl;
    return querySelectorFromDesc(desc);
  }

  function cssEscape(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&");
  }

  // Build a stable structural selector from the element up to its nearest id
  // ancestor (usually #root): `#root > div:nth-child(1) > section:nth-child(2) > …`.
  // Deterministic from the source render, so it survives a page refresh.
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return null;
    const segs = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      if (cur.id) { segs.unshift("#" + cssEscape(cur.id)); break; }
      const parent = cur.parentElement;
      if (!parent) { segs.unshift(cur.tagName.toLowerCase()); break; }
      const idx = Array.prototype.indexOf.call(parent.children, cur) + 1;
      segs.unshift(`${cur.tagName.toLowerCase()}:nth-child(${idx})`);
      cur = parent;
    }
    return segs.join(" > ");
  }

  // Reverse-lookup an element from a partial path / text descriptor.
  // Best-effort; the persisted event carries enough info for the agent to redo it precisely.
  function querySelectorFromDesc(desc) {
    if (desc?.uid) {
      const byUid = document.querySelector(`[${UID_ATTR}="${cssEscape(desc.uid)}"]`);
      if (byUid) return byUid;
    }
    // Stable structural selector — the reliable path after a refresh.
    if (desc?.selector) {
      try {
        const bySel = document.querySelector(desc.selector);
        if (bySel) return bySel;
      } catch { /* malformed selector — fall through to fuzzy */ }
    }
    if (desc?.id) {
      const byId = document.getElementById(desc.id);
      if (byId) return byId;
    }
    if (desc?.tag) {
      const candidates = Array.from(document.getElementsByTagName(desc.tag));
      if (desc.text) {
        const needle = desc.text.trim().slice(0, 64);
        // exact match first
        const exact = candidates.find((el) => (el.innerText || "").trim() === needle);
        if (exact) return exact;
        // prefix match next
        const prefix = candidates.find((el) => (el.innerText || "").trim().startsWith(needle.slice(0, 32)));
        if (prefix) return prefix;
      }
      if (desc.className) {
        const cls = desc.className.toString().trim().split(/\s+/)[0];
        if (cls) {
          const byClass = candidates.find((el) => (el.className?.toString?.() || "").includes(cls));
          if (byClass) return byClass;
        }
      }
      return candidates[0] || null;
    }
    return null;
  }

  // Replay persisted Inspect edits onto the freshly-rendered DOM so the user's
  // unsaved tweaks survive a refresh until the agent writes them to source.
  //
  // Two correctness rules that the old fixed-retry version got wrong:
  //   1. Only replay PENDING edits — those after the agent's .cursor offset.
  //      Edits before the cursor are already in source; replaying them would
  //      fight a hand-edited source-of-truth. We fetch with ?since=<cursor>.
  //   2. Survive React re-renders. A replayed text/class mutation is out-of-band;
  //      React reconciles it back on the next render (tab switch, search, …).
  //      Instead of 3 timed retries, a MutationObserver re-applies any drifted
  //      pending edit idempotently — so it sticks through renders AND late mount.
  const KIND_MAP = { "text-edit": "text", "placeholder-edit": "placeholder", "class-edit": "className", hide: "hide", show: "show" };
  let pendingReplay = [];        // [{ ev, kind, value }]
  let replayObserver = null;
  let replayScheduled = false;

  function desiredMatches(elx, kind, value) {
    if (!elx) return false;
    if (kind === "text") return (elx.innerText || "").trim() === String(value ?? "").trim();
    if (kind === "placeholder") return (elx.getAttribute?.("placeholder") ?? "") === String(value ?? "");
    if (kind === "className") return (elx.className?.toString?.() || "") === String(value ?? "");
    if (kind === "hide") return elx.style.display === "none";
    if (kind === "show") return elx.style.display !== "none";
    return false;
  }

  function applyReplay() {
    replayScheduled = false;
    if (!pendingReplay.length) return;
    for (const p of pendingReplay) {
      const elx = querySelectorFromDesc(p.ev.target);
      if (!elx) continue;                              // not mounted yet — observer retries
      if (desiredMatches(elx, p.kind, p.value)) continue; // idempotent: skip if already right
      applyEdit({ selector: p.ev.target, kind: p.kind, value: p.value });
    }
  }

  function scheduleReplay() {
    if (replayScheduled) return;
    replayScheduled = true;
    // Debounce to batch a burst of React mutations into one re-apply pass.
    setTimeout(applyReplay, 60);
  }

  async function replayPersisted() {
    let since = 0;
    try {
      const cr = await fetch("/__ued/state/.cursor");
      if (cr.ok) since = Number((await cr.text()).trim()) || 0;
    } catch { /* no cursor → replay from start */ }

    let events;
    try {
      const r = await fetch(`/__ued/inspect-events?since=${since}`);
      events = (await r.json()).events || [];
    } catch {
      return;
    }
    if (!events.length) return;

    // Drop events the user undid (⌘Z appends {kind:"undo", of:<original>}); match
    // the original by kind + path + changed value. Keep only the last edit per
    // target (later wins).
    const keyOf = (t) => t?.selector || t?.path || "";
    const sig = (e) => `${e.kind}|${keyOf(e.target)}|${e.to ?? e.from ?? ""}`;
    const undone = new Set(events.filter((e) => e.kind === "undo" && e.of).map((e) => sig(e.of)));
    // Fast-path-acked targets are already in source — don't replay (would fight it).
    const acked = new Map();
    for (const e of events) if (e.kind === "apply" && e.of) acked.set(keyOf(e.of.target), e.of.to);
    const lastByTarget = new Map();
    for (const ev of events) {
      if (!["text-edit", "placeholder-edit", "class-edit", "hide", "show"].includes(ev.kind)) continue;
      if (undone.has(sig(ev))) continue;
      lastByTarget.set(keyOf(ev.target) || sig(ev), ev);
    }
    pendingReplay = [...lastByTarget.entries()]
      .filter(([k, ev]) => acked.get(k) !== ev.to)
      .map(([, ev]) => ({ ev, kind: KIND_MAP[ev.kind], value: ev.to }));
    if (!pendingReplay.length) return;

    applyReplay();

    // Keep edits sticky across React re-renders / late mounts. The idempotent
    // guard in applyReplay() makes our own mutations no-ops, so this won't loop.
    if (!replayObserver && document.body) {
      replayObserver = new MutationObserver(scheduleReplay);
      replayObserver.observe(document.body, {
        subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ["class", "style"],
      });
    }
  }

  window.addEventListener("message", (ev) => {
    const m = ev.data;
    if (!m || m.ns !== NS) return;
    if (m.type === "set-inspect") setInspect(m.on);
    else if (m.type === "apply-edit") {
      const ok = applyEdit(m.payload);
      parent.postMessage({ ns: NS, type: "apply-edit-result", ok, payload: m.payload }, "*");
    }
  });

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  // Hide the dashed hover box once the pointer leaves the iframe document.
  // Selected (solid) box stays — it's pinned by click.
  document.addEventListener(
    "mouseout",
    (e) => {
      if (!inspectOn) return;
      if (!e.relatedTarget) {
        hideHover();
        lastHovered = null;
      }
    },
    true,
  );
  window.addEventListener("blur", () => {
    if (!inspectOn) return;
    hideHover();
    lastHovered = null;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && inspectOn) {
      setInspect(false);
      parent.postMessage({ ns: NS, type: "escape" }, "*");
    }
  });

  window.__uedBridge = { setInspect, replayPersisted };
  parent.postMessage({ ns: NS, type: "bridge-ready", href: location.href }, "*");

  // Replay persisted edits onto the DOM. Wait for DOM ready (React hydration) first.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(replayPersisted, 50));
  } else {
    setTimeout(replayPersisted, 50);
  }
})();
