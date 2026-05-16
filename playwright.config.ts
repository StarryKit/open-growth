import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "npm run build --workspace @open-growth/web && npm run build --workspace @open-growth/api && npm run start --workspace @open-growth/api",
    port: 3001,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
