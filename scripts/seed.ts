import { spawnSync } from "node:child_process";

const result = spawnSync("supabase", ["--workdir", "packages/db", "seed"], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
