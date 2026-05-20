import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const repoRoot = path.resolve(rootDir, "../..");
  const webPort = Number(process.env.WEB_PORT ?? 5173);
  const apiPort = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
  const publicHostname = process.env.OPEN_GROWTH_DEV_PUBLIC_HOSTNAME;

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
      port: webPort,
      strictPort: true,
      allowedHosts: publicHostname ? [publicHostname] : [],
      hmr: publicHostname
        ? {
            protocol: "wss",
            host: publicHostname,
            clientPort: 443,
          }
        : undefined,
      proxy: {
        "/api": `http://127.0.0.1:${apiPort}`,
      },
    },
  };
});
