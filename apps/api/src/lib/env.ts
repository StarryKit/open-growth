import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);
const loadedEnvFiles = new Set<string>();

function parseEnvLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) {
    return null;
  }

  let value = match[2].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  } else {
    const commentIndex = value.indexOf(" #");
    if (commentIndex >= 0) {
      value = value.slice(0, commentIndex).trimEnd();
    }
  }

  return { key: match[1], value };
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath) || loadedEnvFiles.has(filePath)) {
    return;
  }

  loadedEnvFiles.add(filePath);
  const contents = readFileSync(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed || process.env[parsed.key] !== undefined) {
      continue;
    }

    process.env[parsed.key] = parsed.value;
  }
}

export function loadRootEnv() {
  const explicitEnvFile = process.env.OPEN_GROWTH_ENV_FILE;
  const candidates = explicitEnvFile
    ? [path.resolve(repoRoot, explicitEnvFile)]
    : [path.join(repoRoot, ".env")];

  for (const candidate of candidates) {
    loadEnvFile(candidate);
  }
}
