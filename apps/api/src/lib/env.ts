import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRootEnv as loadRepoRootEnv } from "../../../../scripts/env.js";

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);

export function loadRootEnv() {
  loadRepoRootEnv(repoRoot);
}
