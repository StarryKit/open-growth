import { spawnSync } from "node:child_process";
import { loadRootEnv } from "./env";

loadRootEnv();

const result = spawnSync(
  "supabase",
  ["--workdir", "packages/db", "db", "reset"],
  {
    env: process.env,
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
