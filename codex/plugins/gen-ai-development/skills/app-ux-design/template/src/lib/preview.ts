// Preview form factor — "mobile" vs "desktop" — driven by the app-ux-design
// preview shell, NOT by viewport width. Use this to render genuinely SEPARATE
// designs per platform (different layout / IA / navigation), instead of one
// responsive component that just reflows.
//
//   const ff = useFormFactor();
//   return ff === "mobile" ? <HomeMobile /> : <HomeDesktop />;
//
// The shell maps its platform pills to a form factor (mobile → "mobile";
// pad / desktop / web → "desktop") and pushes it via postMessage + a `ued-ff`
// URL hash so the first paint is already correct. Opened standalone (no shell),
// it defaults to "desktop".

import { useSyncExternalStore } from "react";

export type FormFactor = "mobile" | "desktop";

function readInitial(): FormFactor {
  if (typeof location === "undefined") return "desktop";
  const fromSearch = new URLSearchParams(location.search).get("ued-ff");
  const fromHash = location.hash.match(/ued-ff=(\w+)/)?.[1];
  return (fromSearch || fromHash) === "mobile" ? "mobile" : "desktop";
}

let current: FormFactor = readInitial();
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("message", (e: MessageEvent) => {
    const d = e.data;
    if (!d || d.ns !== "ued" || d.type !== "set-formfactor") return;
    const next: FormFactor = d.value === "mobile" ? "mobile" : "desktop";
    if (next !== current) {
      current = next;
      listeners.forEach((fn) => fn());
    }
  });
}

export function useFormFactor(): FormFactor {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
}
