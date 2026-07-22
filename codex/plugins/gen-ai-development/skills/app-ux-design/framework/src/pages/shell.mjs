// Shell page (/__ued/shell). Full-height device stage + bottom-right floating
// control dock + floating inspect panel.
//
// The device frame is a flex column: a top chrome slot (phone status bar /
// browser tab bar / macOS title bar), the app iframe, and a bottom chrome slot
// (phone home indicator). shell.js fills these per platform/device. In "web"
// mode the frame goes full-bleed (no chrome, no device picker) so the preview
// fills the whole browser like a real responsive site.

export function createShellPage(_ctx, _url) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>App UX — Preview Shell</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" href="data:," />
<link rel="stylesheet" href="/__ued/overlay/shell.css" />
</head>
<body>
  <div id="ued-shell" data-platform="web" data-inspect="off">
    <main class="ued-stage" data-loading="false">
      <!-- sizer holds the SCALED footprint; the frame renders at the true device
           pixel size and is visually transform-scaled into it, so the app inside
           lays out at real device width (393, 834, …), not the shrunken size. -->
      <div id="ued-frame-sizer" class="ued-frame-sizer">
        <div id="ued-device-frame" class="ued-device-frame">
          <div class="ued-chrome ued-chrome-top" id="ued-chrome-top"></div>
          <iframe id="ued-app" title="App preview" src="/" referrerpolicy="no-referrer" loading="eager"></iframe>
          <div class="ued-chrome ued-chrome-bottom" id="ued-chrome-bottom"></div>
        </div>
      </div>
    </main>

    <!-- Floating inspect panel (overlay; shown when inspect is on) -->
    <aside id="ued-inspect-panel" class="ued-inspect-panel" aria-hidden="true">
      <div class="ued-panel-header">
        <div class="ued-panel-title">Inspect</div>
        <button id="ued-panel-close" class="ued-icon-btn" aria-label="Close">×</button>
      </div>
      <div class="ued-panel-menubar" id="ued-panel-menubar"></div>
      <div class="ued-panel-body" id="ued-panel-body">
        <p class="ued-panel-hint">Hover over the app and click any element to edit.</p>
      </div>
    </aside>

    <!-- Bottom-right floating control dock -->
    <div id="ued-dock" class="ued-dock" data-open="false">
      <div class="ued-dock-popover" id="ued-dock-popover" role="dialog" aria-label="Preview controls">
        <div class="ued-dock-section">
          <div class="ued-dock-label">Platform</div>
          <div class="ued-platform-group" role="tablist" aria-label="Platform">
            <button data-platform="mobile"  class="ued-pill">Mobile</button>
            <button data-platform="pad"     class="ued-pill">Pad</button>
            <button data-platform="desktop" class="ued-pill">Desktop</button>
            <button data-platform="web"     class="ued-pill is-active">Web</button>
          </div>
        </div>
        <div class="ued-dock-section" id="ued-dock-device">
          <div class="ued-dock-label">Device</div>
          <select id="ued-device" class="ued-select" aria-label="Device model"></select>
        </div>
        <div class="ued-dock-section">
          <div class="ued-dock-label">Screen</div>
          <select id="ued-screen" class="ued-select" aria-label="Screen" title="Screen / route">
            <option value="/">Home</option>
          </select>
        </div>
        <div class="ued-dock-actions">
          <button id="ued-inspect-toggle" class="ued-btn" title="Toggle inspect (I)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Inspect
          </button>
          <button id="ued-reload" class="ued-btn" title="Reload app">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
            Reload
          </button>
          <button id="ued-commit" class="ued-btn ued-commit-btn" title="提交所有 Inspect 改动，交给 Codex 写入源码">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
            <span class="ued-commit-label">落库</span>
            <span id="ued-commit-badge" class="ued-commit-badge" hidden>0</span>
          </button>
          <div id="ued-commit-hint" class="ued-commit-hint" hidden></div>
        </div>
      </div>
      <button id="ued-dock-ball" class="ued-dock-ball" title="Preview controls" aria-label="Preview controls" aria-expanded="false">
        <svg class="ued-dock-ball-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2.4" fill="currentColor" stroke="none"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2.4" fill="currentColor" stroke="none"/></svg>
      </button>
    </div>
  </div>
  <script type="module" src="/__ued/overlay/shell.js"></script>
</body>
</html>`;
}
