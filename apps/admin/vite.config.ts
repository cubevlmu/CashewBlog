import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// The API gateway (ASP.NET) listens on 8080 and serves /api, /uploads and the public site.
const gateway = process.env.CASHEWBLOG_GATEWAY ?? "http://127.0.0.1:8080";

export default defineConfig({
  base: "/admin/",
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5174,
    open: "/admin/",
    proxy: {
      "/api": { target: gateway, changeOrigin: false },
      "/uploads": { target: gateway, changeOrigin: false },
      "/posts": { target: gateway, changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 4096,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
