/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.PORT) || 5173;
const apiUrl = process.env.API_URL || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port,
    strictPort: true,
    // Freebuff requires HMR to remain disabled.
    hmr: false,
    // Freebuff previews reach the dev server through a workspace tunnel
    // domain; Vite's host check would otherwise 403 every request.
    allowedHosts: true,
    proxy: {
      "/api": {
        target: apiUrl,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port,
    strictPort: true,
    proxy: {
      "/api": { target: apiUrl, changeOrigin: true },
    },
  },
  build: {
    // Emit to the repository root so production builds land in dist/.
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
