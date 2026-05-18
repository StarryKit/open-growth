import { spawnSync } from "node:child_process";

const result = spawnSync(
  "supabase",
  ["--workdir", "packages/db", "db", "reset"],
  {
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
