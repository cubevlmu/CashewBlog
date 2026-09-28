import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { cp, mkdir } from "node:fs/promises";
import { defineConfig } from "vitest/config";

// The API gateway (ASP.NET) listens on 8080 and serves /api, /uploads and the public site.
const gateway = process.env.CASHEWBLOG_GATEWAY ?? "http://127.0.0.1:8080";

export default defineConfig({
  base: "/admin/",
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: "stage-admin-dev-build",
      async closeBundle() {
        if (process.env.CASHEWBLOG_STAGE_ADMIN !== "1") return;
        const target = fileURLToPath(
          new URL("../../src/CashewBlog.Api/wwwroot/admin/", import.meta.url),
        );
        await mkdir(target, { recursive: true });
        await cp(fileURLToPath(new URL("./dist/", import.meta.url)), target, {
          recursive: true,
        });
        console.log("[CashewBlog] Admin updated — refresh /admin.");
      },
    },
  ],
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
