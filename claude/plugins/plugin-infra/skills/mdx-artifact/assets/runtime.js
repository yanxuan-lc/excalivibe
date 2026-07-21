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
