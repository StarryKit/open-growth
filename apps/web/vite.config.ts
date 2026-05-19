import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const repoRoot = path.resolve(rootDir, "../..");

  return {
    envDir: repoRoot,
    plugins: [react()],
    build: {
      outDir: "../../dist/web",
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "./src"),
        "@shared": path.resolve(rootDir, "../../packages/shared/src/index.ts"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: ["dev.opengrowth.dev"],
      hmr: {
        clientPort: 8443,
      },
      proxy: {
        "/api": "http://localhost:3001",
      },
    },
  };
});
