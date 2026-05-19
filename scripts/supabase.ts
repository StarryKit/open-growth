import { spawnSync } from "node:child_process";
import { loadRootEnv } from "./env";

loadRootEnv();

const args = process.argv.slice(2);
const result = spawnSync("supabase", ["--workdir", "packages/db", ...args], {
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
