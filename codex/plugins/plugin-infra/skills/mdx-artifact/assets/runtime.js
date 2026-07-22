/* mdx-artifact · runtime.js —— 内联进产物的交互脚本
   明暗切换 + Grid 分面筛选 + 滚动渐显 + TOC 高亮。纯 vanilla、无依赖、无网络。 */
(function () {
  "use strict";
  var root = document.documentElement;

  // ---- 明暗切换（持久化，Lucide 图标内联 SVG） ----
  var ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  var toggle = document.getElementById("da-theme-toggle");
  if (toggle) {
    var saved = null;
    try { saved = localStorage.getItem("da-theme"); } catch (e) {}
    if (saved) root.dataset.theme = saved;
    var sync = function () { toggle.innerHTML = root.dataset.theme === "dark" ? ICON_SUN : ICON_MOON; };
    sync();
    toggle.addEventListener("click", function () {
      root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem("da-theme", root.dataset.theme); } catch (e) {}
      sync();
      if (window.__mmdRender) setTimeout(window.__mmdRender, 0); // mermaid 随主题重渲
    });
  }

  // ---- Grid 分面筛选 ----
  document.querySelectorAll("[data-filter]").forEach(function (bar) {
    var grid = document.getElementById(bar.getAttribute("data-filter"));
    if (!grid) return;
    var btns = [].slice.call(bar.querySelectorAll("button"));
    var cards = [].slice.call(grid.querySelectorAll(".g"));
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        var f = b.getAttribute("data-f");
        cards.forEach(function (c) {
          var tags = (c.getAttribute("data-tags") || "").split(" ");
          c.classList.toggle("dim", !(f === "all" || tags.indexOf(f) !== -1));
        });
      });
    });
  });

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  var links = [].slice.call(document.querySelectorAll(".da-toc a"));
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });

  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
    return;
  }

  // 渐显：元素进入视口底部附近就触发（更早、更柔）
  var revObs = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); revObs.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
  reveals.forEach(function (el) { revObs.observe(el); });

  // TOC 高亮：小节滚到视口上部时点亮
  if (links.length) {
    var tocObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var a = byId[e.target.id];
        if (a) { links.forEach(function (x) { x.classList.remove("active"); }); a.classList.add("active"); }
      });
    }, { threshold: 0, rootMargin: "0px 0px -75% 0px" });
    document.querySelectorAll(".da-section[id]").forEach(function (el) { tocObs.observe(el); });
  }
})();

/* ============================================================
   Diagram 查看器 —— 全屏 + 滚轮缩放 + 拖拽平移
   独立 IIFE（不受上面 reduced-motion 提前 return 影响）。按需在点击时克隆 SVG，
   故 mermaid 客户端渲染完成后也能取到最新（含主题）的图。纯 vanilla、无依赖、无网络。
   ============================================================ */
(function () {
  "use strict";
  var boxes = [].slice.call(document.querySelectorAll(".da-diagram"));
  if (!boxes.length) return;
  var ICON_EXPAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';

  boxes.forEach(function (box) {
    if (box.classList.contains("da-diagram-err")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "da-dg-expand";
    btn.setAttribute("aria-label", "全屏查看图");
    btn.innerHTML = ICON_EXPAND;
    btn.addEventListener("click", function (e) { e.stopPropagation(); open(box); });
    box.appendChild(btn);
  });

  var overlay, stage, canvas, scale = 1, tx = 0, ty = 0, dragging = false, px = 0, py = 0;

  function build() {
    overlay = document.createElement("div");
    overlay.className = "da-dg-overlay";
    overlay.innerHTML =
      '<div class="da-dg-stage"><div class="da-dg-canvas"></div></div>' +
      '<div class="da-dg-bar">' +
        '<button type="button" data-a="out" aria-label="缩小">−</button>' +
        '<button type="button" data-a="reset" aria-label="适应窗口">⤡</button>' +
        '<button type="button" data-a="in" aria-label="放大">+</button>' +
        '<button type="button" data-a="close" class="x" aria-label="关闭">✕</button>' +
      "</div>" +
      '<div class="da-dg-hint">滚轮缩放 · 拖拽平移 · Esc 关闭</div>';
    document.body.appendChild(overlay);
    stage = overlay.querySelector(".da-dg-stage");
    canvas = overlay.querySelector(".da-dg-canvas");
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    overlay.querySelector(".da-dg-bar").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "close") return close();
      if (a === "reset") return fit();
      zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, a === "in" ? 1.25 : 0.8);
    });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
  }

  function open(box) {
    var svg = box.querySelector("svg");
    if (!svg) return;
    if (!overlay) build();
    canvas.innerHTML = "";
    var clone = svg.cloneNode(true);
    clone.removeAttribute("style");
    var vb = (clone.getAttribute("viewBox") || "").split(/[\s,]+/).map(parseFloat);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      clone.setAttribute("width", vb[2]); clone.setAttribute("height", vb[3]);
      clone.style.width = vb[2] + "px"; clone.style.height = vb[3] + "px";
    } else { clone.style.width = "auto"; clone.style.height = "auto"; }
    clone.style.maxWidth = "none"; clone.style.maxHeight = "none";
    canvas.appendChild(clone);
    overlay.classList.add("on");
    document.documentElement.style.overflow = "hidden";
    fit();
  }
  function close() {
    if (!overlay) return;
    overlay.classList.remove("on");
    document.documentElement.style.overflow = "";
  }
  function apply() { canvas.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")"; }
  function fit() {
    if (!canvas.firstChild) return;
    canvas.style.transform = "none";
    var cb = canvas.getBoundingClientRect(), sw = stage.clientWidth, sh = stage.clientHeight;
    scale = Math.min((sw * 0.92) / cb.width, (sh * 0.92) / cb.height);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    tx = (sw - cb.width * scale) / 2;
    ty = (sh - cb.height * scale) / 2;
    apply();
  }
  function zoomAt(cx, cy, factor) {
    var ns = Math.max(0.1, Math.min(40, scale * factor));
    tx = cx - (cx - tx) * (ns / scale);
    ty = cy - (cy - ty) * (ns / scale);
    scale = ns; apply();
  }
  function onWheel(e) {
    e.preventDefault();
    var r = stage.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }
  function onDown(e) { dragging = true; px = e.clientX; py = e.clientY; stage.classList.add("grab"); }
  function onMove(e) { if (!dragging) return; tx += e.clientX - px; ty += e.clientY - py; px = e.clientX; py = e.clientY; apply(); }
  function onUp() { dragging = false; if (stage) stage.classList.remove("grab"); }
  function onKey(e) {
    if (!overlay || !overlay.classList.contains("on")) return;
    if (e.key === "Escape") close();
    else if (e.key === "+" || e.key === "=") zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.25);
    else if (e.key === "-") zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 0.8);
    else if (e.key === "0") fit();
  }
})();
