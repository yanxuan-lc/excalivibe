import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { uedFramework } from "app-ux-framework";

export default defineConfig({
  plugins: [react(), tailwindcss(), uedFramework({ stateDir: ".ued" })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
