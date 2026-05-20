import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadEnvFile, parseEnvLine } from "./env.js";

type Slot = {
  slot: string;
  hostname: string;
};

type PortSet = {
  web: number;
  api: number;
  supabaseApi: number;
  supabaseDb: number;
  supabaseShadow: number;
  supabaseStudio: number;
  supabaseInbucket: number;
  supabaseSmtp: number;
  supabasePop3: number;
};

type SupabaseStatus = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

type CloudflareTunnel = {
  id: string;
  name: string;
  credentialsFile: string;
};

type CloudflareZone = {
  id: string;
  name: string;
  accountId: string;
};

type WorktreeConfig = {
  version: 1;
  workspaceRoot: string;
  slot: string;
  hostname: string;
  publicOrigin: string;
  projectId: string;
  instanceDir: string;
  cloudflaredConfigPath: string;
  ports: PortSet;
  tunnel: CloudflareTunnel;
  createdAt: string;
  updatedAt: string;
};

type SlotReservation = {
  version: 1;
  workspaceRoot: string;
  slot: string;
  hostname: string;
  publicOrigin: string;
  projectId: string;
  instanceDir: string;
  ports: PortSet;
  createdAt: string;
  updatedAt: string;
};

const repoRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const envDevPath = path.join(repoRoot, ".env.dev");
const envLocalPath = path.join(repoRoot, ".env.dev.local");
const devDir = path.join(repoRoot, ".dev");
const worktreeConfigPath = path.join(devDir, "worktree.json");
const cloudflaredDir = path.join(os.homedir(), ".cloudflared");
const slotReservationDir = path.join(
  os.homedir(),
  ".cache",
  "open-growth",
  "dev-slots",
);
const portStarts = {
  web: 5173,
  api: 3001,
  supabaseApi: 54321,
  supabaseDb: 54322,
  supabaseShadow: 54320,
  supabaseStudio: 54323,
  supabaseInbucket: 54324,
  supabaseSmtp: 54325,
  supabasePop3: 54326,
};
const children = new Set<ChildProcess>();
let stopping = false;

function log(message: string) {
  console.log(`[dev-preview] ${message}`);
}

const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
};

function printUrlSummary(input: {
  publicOrigin: string;
  localWebUrl: string;
  publicApiHealthUrl: string;
  localApiHealthUrl: string;
  supabaseUrl: string;
  studioUrl: string;
}) {
  const labelWidth = 10;
  const rows = [
    ["Frontend", input.publicOrigin],
    ["Local Web", input.localWebUrl],
    ["API", input.publicApiHealthUrl],
    ["Local API", input.localApiHealthUrl],
    ["Supabase", input.supabaseUrl],
    ["Studio", input.studioUrl],
  ] as const;
  const width = Math.max(
    ...rows.map(([, value]) => labelWidth + value.length + 2),
    " Open Growth dev preview is ready".length,
  );
  const line = "=".repeat(width);

  console.log("");
  console.log(`${color.bold}${color.cyan}+${line}+${color.reset}`);
  console.log(
    `${color.bold}${color.cyan}|${color.reset} ${color.bold}${color.green}Open Growth dev preview is ready${color.reset}${" ".repeat(width - 35)}${color.bold}${color.cyan}|${color.reset}`,
  );
  console.log(`${color.bold}${color.cyan}+${line}+${color.reset}`);
  for (const [label, value] of rows) {
    const text = ` ${label.padEnd(labelWidth)} ${value}`;
    const valueColor =
      label === "Frontend" || label === "API" ? color.magenta : color.yellow;
    const padding = Math.max(0, width - text.length);
    console.log(
      `${color.bold}${color.cyan}|${color.reset}${text.replace(value, `${valueColor}${value}${color.reset}`)}${" ".repeat(padding)}${color.bold}${color.cyan}|${color.reset}`,
    );
  }
  console.log(`${color.bold}${color.cyan}+${line}+${color.reset}`);
  console.log("");
}

function fail(message: string): never {
  console.error(`[dev-preview] ${message}`);
  process.exit(1);
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Missing ${name}. Copy .env.dev.example to .env.dev and fill it in.`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function optionalRawEnv(name: string) {
  const value = process.env[name];
  return value === undefined ? undefined : value.trim();
}

function envFileValue(value: string | number) {
  return JSON.stringify(String(value));
}

function commandExists(command: string) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function run(
  command: string,
  args: string[],
  options?: { env?: NodeJS.ProcessEnv; stdio?: "inherit" | "ignore" },
) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: options?.env ?? process.env,
    stdio: options?.stdio ?? "inherit",
  });

  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed.`);
  }
}

function output(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}

function currentWorkspaceRoot() {
  return output("git", ["rev-parse", "--show-toplevel"]) || repoRoot;
}

function mainWorkspaceRoot() {
  const worktrees = output("git", ["worktree", "list", "--porcelain"]);
  const first = worktrees
    .split(/\r?\n/)
    .find((line) => line.startsWith("worktree "));
  return first?.replace(/^worktree /, "").trim() ?? currentWorkspaceRoot();
}

function loadStableEnv() {
  if (!existsSync(envDevPath)) {
    fail("Missing .env.dev. Copy .env.dev.example to .env.dev first.");
  }
  loadEnvFile(envDevPath);
}

function requireCommand(command: string, message: string) {
  if (!commandExists(command)) fail(message);
}

function configuredSlots(domainBase: string) {
  const forcedSlot = optionalRawEnv("OPEN_GROWTH_DEV_SLOT");
  const slotCandidates =
    forcedSlot !== undefined
      ? forcedSlot
      : optionalEnv("OPEN_GROWTH_DEV_SLOT_CANDIDATES", ",a,b,c,d,e,f");
  const rawSlots = slotCandidates.split(",").map((slot) => {
    const trimmed = slot.trim();
    return trimmed === "" || trimmed === "main" ? "main" : trimmed;
  });

  const seen = new Set<string>();
  return rawSlots
    .filter((slot) => {
      if (seen.has(slot)) return false;
      seen.add(slot);
      return true;
    })
    .map((slot) => ({
      slot,
      hostname: hostnameForSlot(slot, domainBase),
    }));
}

function hostnameForSlot(slot: string, domainBase: string) {
  return slot === "main" ? domainBase : `${slot}-${domainBase}`;
}

function reservationPath(slot: string) {
  return path.join(slotReservationDir, `${slot}.json`);
}

function readReservation(slot: string) {
  return existsSync(reservationPath(slot))
    ? readJsonFile<SlotReservation>(reservationPath(slot))
    : null;
}

function writeReservation(config: WorktreeConfig) {
  const now = new Date().toISOString();
  const existing = readReservation(config.slot);
  writeJsonFile(reservationPath(config.slot), {
    version: 1,
    workspaceRoot: config.workspaceRoot,
    slot: config.slot,
    hostname: config.hostname,
    publicOrigin: config.publicOrigin,
    projectId: config.projectId,
    instanceDir: config.instanceDir,
    ports: config.ports,
    createdAt: existing?.createdAt ?? config.createdAt,
    updatedAt: now,
  } satisfies SlotReservation);
}

function removeReservation(config: WorktreeConfig) {
  const reservation = readReservation(config.slot);
  if (
    reservation &&
    path.resolve(reservation.workspaceRoot) ===
      path.resolve(config.workspaceRoot)
  ) {
    rmSync(reservationPath(config.slot), { force: true });
  }
}

function allReservations() {
  if (!existsSync(slotReservationDir)) return [];
  return readdirSync(slotReservationDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) =>
      readJsonFile<SlotReservation>(path.join(slotReservationDir, file)),
    )
    .filter((reservation): reservation is SlotReservation =>
      Boolean(reservation),
    );
}

function removeStaleReservations() {
  for (const reservation of allReservations()) {
    if (!existsSync(reservation.workspaceRoot)) {
      rmSync(reservationPath(reservation.slot), { force: true });
    }
  }
}

function canListen(port: number, host: string) {
  const script = [
    'const net=require("node:net");',
    "const s=net.createServer();",
    "s.once('error',()=>process.exit(1));",
    `s.listen({port:${port},host:${JSON.stringify(host)}},()=>s.close(()=>process.exit(0)));`,
  ].join("");

  return (
    spawnSync(process.execPath, ["-e", script], { stdio: "ignore" }).status ===
    0
  );
}

function findFreePort(start: number, used: Set<number>, host = "127.0.0.1") {
  for (let port = start; port < start + 400; port += 1) {
    if (used.has(port)) continue;
    if (canListen(port, host)) {
      used.add(port);
      return port;
    }
  }

  fail(`Could not find a free port at or above ${start}.`);
}

function collectReservedPortsForOtherWorktrees() {
  const root = path.resolve(currentWorkspaceRoot());
  const ports = new Set<number>();
  for (const reservation of allReservations()) {
    if (path.resolve(reservation.workspaceRoot) === root) continue;
    for (const value of Object.values(reservation.ports)) {
      ports.add(value);
    }
  }
  return ports;
}

function allocatePorts(): PortSet {
  const used = collectReservedPortsForOtherWorktrees();
  return {
    web: findFreePort(portStarts.web, used, "0.0.0.0"),
    api: findFreePort(portStarts.api, used, "0.0.0.0"),
    supabaseApi: findFreePort(portStarts.supabaseApi, used, "0.0.0.0"),
    supabaseDb: findFreePort(portStarts.supabaseDb, used, "0.0.0.0"),
    supabaseShadow: findFreePort(portStarts.supabaseShadow, used, "0.0.0.0"),
    supabaseStudio: findFreePort(portStarts.supabaseStudio, used, "0.0.0.0"),
    supabaseInbucket: findFreePort(
      portStarts.supabaseInbucket,
      used,
      "0.0.0.0",
    ),
    supabaseSmtp: findFreePort(portStarts.supabaseSmtp, used, "0.0.0.0"),
    supabasePop3: findFreePort(portStarts.supabasePop3, used, "0.0.0.0"),
  };
}

function safeProjectId(slot: string) {
  const rootHash = crypto
    .createHash("sha1")
    .update(currentWorkspaceRoot())
    .digest("hex")
    .slice(0, 8);
  return `open-growth-${slot}-${rootHash}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
}

function slotForConfig(config: WorktreeConfig): Slot {
  return { slot: config.slot, hostname: config.hostname };
}

function instanceDirForSlot(slot: string) {
  return path.join(devDir, "instances", slot);
}

function readWorktreeConfig() {
  const config = existsSync(worktreeConfigPath)
    ? readJsonFile<WorktreeConfig>(worktreeConfigPath)
    : null;
  if (!config) return null;

  const currentRoot = path.resolve(currentWorkspaceRoot());
  if (path.resolve(config.workspaceRoot) !== currentRoot) {
    fail(
      `.dev/worktree.json belongs to ${config.workspaceRoot}, but this worktree is ${currentRoot}.`,
    );
  }
  return config;
}

function requireWorktreeConfig(message?: string) {
  const config = readWorktreeConfig();
  if (!config) {
    fail(
      message ??
        "This worktree is not initialized. Run `pnpm worktree:init` first.",
    );
  }
  return config;
}

function isMainWorkspace() {
  return (
    path.resolve(currentWorkspaceRoot()) === path.resolve(mainWorkspaceRoot())
  );
}

async function readOrInitializeMainWorktreeConfig() {
  const existing = readWorktreeConfig();
  if (existing) return existing;

  if (!isMainWorkspace()) {
    return requireWorktreeConfig();
  }

  log("Main checkout is not initialized yet; initializing it now.");
  return initWorktree();
}

async function refreshWorktreeConfigForDomain(
  config: WorktreeConfig,
  domainBase: string,
) {
  const hostname = hostnameForSlot(config.slot, domainBase);
  if (hostname === config.hostname) {
    return config;
  }

  log(`Updating slot hostname: ${config.hostname} -> ${hostname}`);
  const updated = {
    ...config,
    hostname,
    publicOrigin: `https://${hostname}`,
    updatedAt: new Date().toISOString(),
  } satisfies WorktreeConfig;
  const tunnel = await prepareCloudflare(updated, domainBase);
  const refreshed = { ...updated, tunnel } satisfies WorktreeConfig;
  syncSupabaseWorkdir(refreshed);
  writeReservation(refreshed);
  writeJsonFile(worktreeConfigPath, refreshed);
  return refreshed;
}

function selectSlot(domainBase: string) {
  mkdirSync(slotReservationDir, { recursive: true });
  removeStaleReservations();

  const root = currentWorkspaceRoot();
  const mainRoot = mainWorkspaceRoot();
  const allSlots = configuredSlots(domainBase);
  const preferredSlots =
    path.resolve(root) === path.resolve(mainRoot)
      ? allSlots
      : [...allSlots.filter((slot) => slot.slot !== "main"), ...allSlots];

  for (const slot of preferredSlots) {
    const reservation = readReservation(slot.slot);
    if (!reservation) return slot;
    if (path.resolve(reservation.workspaceRoot) === path.resolve(root)) {
      return slot;
    }
  }

  fail(
    `No free dev slot found. Checked: ${preferredSlots
      .map((slot) => slot.hostname)
      .join(", ")}.`,
  );
}

function patchSupabaseConfig(
  instanceDir: string,
  config: WorktreeConfig,
): boolean {
  const configPath = path.join(instanceDir, "supabase/config.toml");
  const before = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  let contents = before;
  const localWebUrls = [
    `http://127.0.0.1:${config.ports.web}`,
    `http://localhost:${config.ports.web}`,
  ];

  const replacements: Array<[RegExp, string]> = [
    [/^project_id = ".*"$/m, `project_id = "${config.projectId}"`],
    [/^port = \d+$/m, `port = ${config.ports.supabaseApi}`],
    [/^\[db\]\nport = \d+/m, `[db]\nport = ${config.ports.supabaseDb}`],
    [/^shadow_port = \d+$/m, `shadow_port = ${config.ports.supabaseShadow}`],
    [
      /^\[studio\]\nenabled = true\nport = \d+/m,
      `[studio]\nenabled = true\nport = ${config.ports.supabaseStudio}`,
    ],
    [
      /^api_url = "http:\/\/127\.0\.0\.1:\d+"$/m,
      `api_url = "http://127.0.0.1:${config.ports.supabaseApi}"`,
    ],
    [
      /^\[inbucket\]\nenabled = true\nport = \d+/m,
      `[inbucket]\nenabled = true\nport = ${config.ports.supabaseInbucket}`,
    ],
    [/^smtp_port = \d+$/m, `smtp_port = ${config.ports.supabaseSmtp}`],
    [/^pop3_port = \d+$/m, `pop3_port = ${config.ports.supabasePop3}`],
    [/^site_url = ".*"$/m, `site_url = "${config.publicOrigin}"`],
    [
      /^additional_redirect_urls = \[.*\]$/m,
      `additional_redirect_urls = ${JSON.stringify([config.publicOrigin, ...localWebUrls])}`,
    ],
    [
      /^redirect_uri = ".*"$/m,
      `redirect_uri = "${config.publicOrigin}/auth/v1/callback"`,
    ],
  ];

  for (const [pattern, replacement] of replacements) {
    contents = contents.replace(pattern, replacement);
  }

  writeFileSync(configPath, contents);
  return before !== contents;
}

function syncSupabaseWorkdir(config: WorktreeConfig) {
  const source = path.join(repoRoot, "packages/db/supabase");
  const destination = path.join(config.instanceDir, "supabase");
  const before = existsSync(path.join(destination, "config.toml"))
    ? readFileSync(path.join(destination, "config.toml"), "utf8")
    : "";

  mkdirSync(config.instanceDir, { recursive: true });
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
  patchSupabaseConfig(config.instanceDir, config);

  const after = readFileSync(path.join(destination, "config.toml"), "utf8");
  return before !== after;
}

function parseStatusOutput(status: string): SupabaseStatus {
  const apiUrl =
    status.match(/API URL:\s*(\S+)/)?.[1] ??
    status.match(/SUPABASE_URL="?([^"\n]+)"?/)?.[1];
  const anonKey =
    status.match(/anon key:\s*(\S+)/i)?.[1] ??
    status.match(/publishable:\s*(\S+)/i)?.[1] ??
    status.match(/ANON_KEY="?([^"\n]+)"?/)?.[1] ??
    status.match(/PUBLISHABLE_KEY="?([^"\n]+)"?/)?.[1];
  const serviceRoleKey =
    status.match(/service_role key:\s*(\S+)/i)?.[1] ??
    status.match(/secret:\s*(\S+)/i)?.[1] ??
    status.match(/SERVICE_ROLE_KEY="?([^"\n]+)"?/)?.[1] ??
    status.match(/SECRET_KEY="?([^"\n]+)"?/)?.[1];

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    fail("Could not read Supabase keys from `supabase status`.");
  }

  return { apiUrl, anonKey, serviceRoleKey };
}

function readSupabaseStatus(workdir: string): SupabaseStatus {
  const json = spawnSync(
    "supabase",
    ["--workdir", workdir, "status", "--output", "json"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (json.status === 0 && json.stdout.trim()) {
    try {
      const parsed = JSON.parse(json.stdout) as Record<string, string>;
      const apiUrl = parsed.api_url ?? parsed.API_URL ?? parsed.SUPABASE_URL;
      const anonKey =
        parsed.anon_key ??
        parsed.publishable_key ??
        parsed.ANON_KEY ??
        parsed.PUBLISHABLE_KEY;
      const serviceRoleKey = parsed.service_role_key ?? parsed.SERVICE_ROLE_KEY;
      const serviceRoleOrSecretKey =
        serviceRoleKey ?? parsed.secret_key ?? parsed.SECRET_KEY;
      if (apiUrl && anonKey && serviceRoleOrSecretKey) {
        return { apiUrl, anonKey, serviceRoleKey: serviceRoleOrSecretKey };
      }
    } catch {
      // Fall through to plain output parsing.
    }
  }

  const plain = spawnSync("supabase", ["--workdir", workdir, "status"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (plain.status !== 0) {
    fail("`supabase status` failed.");
  }
  return parseStatusOutput(plain.stdout);
}

function isSupabaseRunning(config: WorktreeConfig) {
  const status = spawnSync(
    "supabase",
    ["--workdir", config.instanceDir, "status", "--output", "json"],
    { cwd: repoRoot, encoding: "utf8", stdio: "pipe" },
  );
  return status.status === 0 && status.stdout.trim().length > 0;
}

function supabaseEnv() {
  return {
    ...process.env,
    SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID:
      process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID ?? "",
    SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET:
      process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET ??
      process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET ??
      "",
  };
}

function warmSupabaseAuthOutboundNetwork(config: WorktreeConfig) {
  if (
    !process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID ||
    !(
      process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET ||
      process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET
    )
  ) {
    return;
  }

  log("Warming Supabase Auth outbound Google OAuth network path.");
  spawnSync(
    "docker",
    [
      "exec",
      `supabase_auth_${config.projectId}`,
      "sh",
      "-lc",
      "wget -S -O- --timeout=5 https://oauth2.googleapis.com/token >/dev/null 2>&1 || true",
    ],
    { cwd: repoRoot, stdio: "ignore" },
  );
}

function startOrResetSupabase(config: WorktreeConfig, shouldReset = true) {
  const configChanged = syncSupabaseWorkdir(config);
  const running = isSupabaseRunning(config);
  const env = supabaseEnv();

  if (running && configChanged) {
    log("Supabase config changed; restarting this worktree instance.");
    run("supabase", ["--workdir", config.instanceDir, "stop", "--no-backup"], {
      env,
    });
  }

  if (!running || configChanged) {
    log("Starting local Supabase stack.");
    run("supabase", ["--workdir", config.instanceDir, "start"], { env });
  } else {
    log("Reusing running local Supabase stack.");
  }

  if (shouldReset) {
    log("Resetting local Supabase database.");
    run("supabase", ["--workdir", config.instanceDir, "db", "reset"], { env });
  }
  warmSupabaseAuthOutboundNetwork(config);
  const status = readSupabaseStatus(config.instanceDir);
  writeGeneratedEnv(config, status);
  return status;
}

async function cloudflareApi<T>(
  pathName: string,
  init: RequestInit = {},
): Promise<T> {
  const token = requiredEnv("CLOUDFLARE_API_TOKEN");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4${pathName}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    },
  );
  const data = (await response.json()) as {
    success: boolean;
    errors?: Array<{ message: string }>;
    result: T;
  };
  if (!response.ok || !data.success) {
    const reason = data.errors?.map((error) => error.message).join("; ");
    fail(`Cloudflare API request failed: ${reason ?? response.statusText}`);
  }
  return data.result;
}

async function discoverZone(domainBase: string): Promise<CloudflareZone> {
  const labels = domainBase.split(".");
  const zoneName = labels.slice(-2).join(".");
  const explicitZoneId = optionalRawEnv("CLOUDFLARE_ZONE_ID");
  const explicitAccountId = optionalRawEnv("CLOUDFLARE_ACCOUNT_ID");
  const zone = explicitZoneId
    ? await cloudflareApi<{
        id: string;
        name: string;
        account?: { id?: string };
      }>(`/zones/${explicitZoneId}`)
    : (
        await cloudflareApi<
          Array<{ id: string; name: string; account?: { id?: string } }>
        >(`/zones?name=${encodeURIComponent(zoneName)}`)
      ).find((candidate) => candidate.name === zoneName);

  if (!zone) {
    fail("Could not discover Cloudflare zone. Set CLOUDFLARE_ZONE_ID.");
  }

  const accountId = explicitAccountId || zone.account?.id;
  if (!accountId) {
    fail("Could not discover Cloudflare account. Set CLOUDFLARE_ACCOUNT_ID.");
  }

  return { id: zone.id, name: zone.name, accountId };
}

function tunnelName(slot: Slot) {
  const prefix = optionalEnv(
    "OPEN_GROWTH_DEV_TUNNEL_NAME_PREFIX",
    "open-growth-dev",
  );
  return `${prefix}-${os.hostname()}-${slot.slot}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function findLocalTunnelCredentials(
  tunnelName: string,
): CloudflareTunnel | null {
  if (!existsSync(cloudflaredDir)) return null;

  const files = readdirSync(cloudflaredDir).filter((file) =>
    file.endsWith(".json"),
  );
  for (const file of files) {
    const credentialsFile = path.join(cloudflaredDir, file);
    const credentials = readJsonFile<{
      TunnelID?: string;
      TunnelName?: string;
      TunnelSecret?: string;
    }>(credentialsFile);
    if (
      credentials?.TunnelName === tunnelName &&
      credentials.TunnelID &&
      credentials.TunnelSecret
    ) {
      return {
        id: credentials.TunnelID,
        name: credentials.TunnelName,
        credentialsFile,
      };
    }
  }

  return null;
}

async function ensureTunnel(
  slot: Slot,
  accountId: string,
): Promise<CloudflareTunnel> {
  const name = tunnelName(slot);
  const localCredentials = findLocalTunnelCredentials(name);
  if (localCredentials) {
    return localCredentials;
  }

  const existing = await cloudflareApi<Array<{ id: string; name: string }>>(
    `/accounts/${accountId}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`,
  );
  mkdirSync(cloudflaredDir, { recursive: true });

  const existingTunnel = existing.find((candidate) => candidate.name === name);
  const secret = crypto.randomBytes(32).toString("base64");
  const tunnel = existingTunnel
    ? await cloudflareApi<{ id: string; name: string; account_tag?: string }>(
        `/accounts/${accountId}/cfd_tunnel/${existingTunnel.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name,
            tunnel_secret: secret,
          }),
        },
      )
    : await cloudflareApi<{ id: string; name: string; account_tag?: string }>(
        `/accounts/${accountId}/cfd_tunnel`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            tunnel_secret: secret,
            config_src: "local",
          }),
        },
      );

  const credentialsFile = path.join(cloudflaredDir, `${tunnel.id}.json`);
  writeFileSync(
    credentialsFile,
    `${JSON.stringify(
      {
        AccountTag: tunnel.account_tag ?? accountId,
        TunnelSecret: secret,
        TunnelID: tunnel.id,
        TunnelName: tunnel.name ?? name,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );

  return { id: tunnel.id, name: tunnel.name ?? name, credentialsFile };
}

async function upsertDns(slot: Slot, tunnel: CloudflareTunnel, zoneId: string) {
  const records = await cloudflareApi<
    Array<{ id: string; type: string; content: string; proxied: boolean }>
  >(
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(slot.hostname)}&per_page=100`,
  );
  for (const record of records.filter((record) => record.type !== "CNAME")) {
    await cloudflareApi(`/zones/${zoneId}/dns_records/${record.id}`, {
      method: "DELETE",
    });
  }

  const payload = {
    type: "CNAME",
    name: slot.hostname,
    content: `${tunnel.id}.cfargotunnel.com`,
    proxied: true,
    ttl: 1,
  };
  const cname = records.find((record) => record.type === "CNAME");

  if (!cname) {
    await cloudflareApi(`/zones/${zoneId}/dns_records`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return;
  }

  if (cname.content === payload.content && cname.proxied === true) {
    return;
  }

  await cloudflareApi(`/zones/${zoneId}/dns_records/${cname.id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

function writeCloudflaredConfig(
  config: Pick<WorktreeConfig, "cloudflaredConfigPath" | "hostname" | "ports">,
  tunnel: CloudflareTunnel,
) {
  const contents = [
    `tunnel: ${tunnel.id}`,
    `credentials-file: ${tunnel.credentialsFile}`,
    "ingress:",
    `  - hostname: ${config.hostname}`,
    '    path: "^/api(/.*)?$"',
    `    service: http://127.0.0.1:${config.ports.api}`,
    `  - hostname: ${config.hostname}`,
    '    path: "^/auth/v1(/.*)?$"',
    `    service: http://127.0.0.1:${config.ports.supabaseApi}`,
    `  - hostname: ${config.hostname}`,
    '    path: "^/rest/v1(/.*)?$"',
    `    service: http://127.0.0.1:${config.ports.supabaseApi}`,
    `  - hostname: ${config.hostname}`,
    '    path: "^/storage/v1(/.*)?$"',
    `    service: http://127.0.0.1:${config.ports.supabaseApi}`,
    `  - hostname: ${config.hostname}`,
    '    path: "^/realtime/v1(/.*)?$"',
    `    service: http://127.0.0.1:${config.ports.supabaseApi}`,
    `  - hostname: ${config.hostname}`,
    '    path: "^/graphql/v1(/.*)?$"',
    `    service: http://127.0.0.1:${config.ports.supabaseApi}`,
    `  - hostname: ${config.hostname}`,
    `    service: http://127.0.0.1:${config.ports.web}`,
    "  - service: http_status:404",
    "",
  ].join("\n");
  mkdirSync(path.dirname(config.cloudflaredConfigPath), { recursive: true });
  writeFileSync(config.cloudflaredConfigPath, contents);
}

async function prepareCloudflare(config: WorktreeConfig, domainBase: string) {
  const zone = await discoverZone(domainBase);
  const tunnel = await ensureTunnel(slotForConfig(config), zone.accountId);
  await upsertDns(slotForConfig(config), tunnel, zone.id);
  writeCloudflaredConfig(config, tunnel);
  return tunnel;
}

function writeGeneratedEnv(config: WorktreeConfig, supabase: SupabaseStatus) {
  const values: Record<string, string | number> = {
    OPEN_GROWTH_DEV_SLOT: config.slot,
    OPEN_GROWTH_DEV_PUBLIC_HOSTNAME: config.hostname,
    OPEN_GROWTH_DEV_PUBLIC_ORIGIN: config.publicOrigin,
    WEB_PORT: config.ports.web,
    API_PORT: config.ports.api,
    PORT: config.ports.api,
    HOST: "0.0.0.0",
    SUPABASE_LOCAL_API_PORT: config.ports.supabaseApi,
    SUPABASE_URL: supabase.apiUrl,
    SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
    SUPABASE_STORAGE_BUCKET: optionalEnv(
      "SUPABASE_STORAGE_BUCKET",
      "content-assets",
    ),
    VITE_SUPABASE_URL: config.publicOrigin,
    VITE_SUPABASE_ANON_KEY: supabase.anonKey,
    OPEN_GROWTH_DEV_CLOUDFLARE_TUNNEL_ID: config.tunnel.id,
    OPEN_GROWTH_DEV_CLOUDFLARE_TUNNEL_NAME: config.tunnel.name,
    OPEN_GROWTH_DEV_CLOUDFLARE_TUNNEL_CREDENTIALS_FILE:
      config.tunnel.credentialsFile,
    OPEN_GROWTH_DEV_SUPABASE_STUDIO_URL: `http://127.0.0.1:${config.ports.supabaseStudio}`,
    OPEN_GROWTH_DEV_SUPABASE_INBUCKET_URL: `http://127.0.0.1:${config.ports.supabaseInbucket}`,
    VITE_DEMO_ACCOUNT_EMAIL: optionalEnv(
      "VITE_DEMO_ACCOUNT_EMAIL",
      "local-dev@open-growth.test",
    ),
    VITE_DEMO_ACCOUNT_PASSWORD: optionalEnv(
      "VITE_DEMO_ACCOUNT_PASSWORD",
      "open-growth-local",
    ),
    OPEN_GROWTH_USER_ID: optionalEnv(
      "OPEN_GROWTH_USER_ID",
      "00000000-0000-0000-0000-000000000001",
    ),
    OPEN_GROWTH_ADMIN_USER_IDS: optionalEnv(
      "OPEN_GROWTH_ADMIN_USER_IDS",
      "00000000-0000-0000-0000-000000000001",
    ),
    OPEN_GROWTH_OUTBOX_INTERVAL_MS: optionalEnv(
      "OPEN_GROWTH_OUTBOX_INTERVAL_MS",
      "0",
    ),
  };

  const contents = [
    "# Generated by Open Growth dev workflow. Do not edit by hand.",
    ...Object.entries(values).map(
      ([key, value]) => `${key}=${envFileValue(value)}`,
    ),
    "",
  ].join("\n");
  writeFileSync(envLocalPath, contents);
}

function readRuntimeEnv() {
  return {
    ...process.env,
    ...Object.fromEntries(
      readFileSync(envLocalPath, "utf8")
        .split(/\r?\n/)
        .map(parseEnvLine)
        .filter((parsed): parsed is { key: string; value: string } =>
          Boolean(parsed),
        )
        .map((parsed) => [parsed.key, parsed.value]),
    ),
    OPEN_GROWTH_ENV_FILE: envLocalPath,
  };
}

function spawnLogged(
  name: string,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);

  const prefix = `[${name}]`;
  child.stdout?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line) console.log(`${prefix} ${line}`);
    }
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line) console.error(`${prefix} ${line}`);
    }
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!stopping) {
      fail(`${name} exited with ${signal ?? code}.`);
    }
  });
  return child;
}

export function stopChildProcesses() {
  if (stopping) return;
  stopping = true;

  for (const child of children) {
    child.kill("SIGTERM");
  }
}

export async function initWorktree() {
  loadStableEnv();
  requireCommand("cloudflared", "cloudflared is not installed.");

  const existing = readWorktreeConfig();
  if (existing) {
    const domainBase = requiredEnv("OPEN_GROWTH_DEV_DOMAIN_BASE");
    const active = await refreshWorktreeConfigForDomain(existing, domainBase);
    log(`Worktree already initialized: ${active.slot} (${active.hostname})`);
    const tunnel = await prepareCloudflare(active, domainBase);
    const updated = {
      ...active,
      tunnel,
      updatedAt: new Date().toISOString(),
    } satisfies WorktreeConfig;
    writeReservation(updated);
    writeJsonFile(worktreeConfigPath, updated);
    syncSupabaseWorkdir(updated);
    return updated;
  }

  const domainBase = requiredEnv("OPEN_GROWTH_DEV_DOMAIN_BASE");
  const slot = selectSlot(domainBase);
  const now = new Date().toISOString();
  const config: WorktreeConfig = {
    version: 1,
    workspaceRoot: currentWorkspaceRoot(),
    slot: slot.slot,
    hostname: slot.hostname,
    publicOrigin: `https://${slot.hostname}`,
    projectId: safeProjectId(slot.slot),
    instanceDir: instanceDirForSlot(slot.slot),
    cloudflaredConfigPath: path.join(
      instanceDirForSlot(slot.slot),
      "cloudflared.yml",
    ),
    ports: allocatePorts(),
    tunnel: {
      id: "",
      name: "",
      credentialsFile: "",
    },
    createdAt: now,
    updatedAt: now,
  };

  mkdirSync(config.instanceDir, { recursive: true });
  const tunnel = await prepareCloudflare(config, domainBase);
  const initialized = { ...config, tunnel } satisfies WorktreeConfig;
  syncSupabaseWorkdir(initialized);
  writeReservation(initialized);
  writeJsonFile(worktreeConfigPath, initialized);

  log(
    `Initialized worktree slot: ${initialized.slot} (${initialized.hostname})`,
  );
  log(`Instance: ${initialized.instanceDir}`);
  log(`Config: ${worktreeConfigPath}`);
  return initialized;
}

export function dbStart() {
  loadStableEnv();
  requireCommand("supabase", "Supabase CLI is not installed.");
  const config = requireWorktreeConfig();
  const status = startOrResetSupabase(config, true);
  log(`Supabase API: ${status.apiUrl}`);
  log(`Supabase Studio: http://127.0.0.1:${config.ports.supabaseStudio}`);
}

export function dbStop() {
  loadStableEnv();
  requireCommand("supabase", "Supabase CLI is not installed.");
  const config = requireWorktreeConfig();
  run("supabase", ["--workdir", config.instanceDir, "stop", "--no-backup"]);
}

export function dbReset() {
  loadStableEnv();
  requireCommand("supabase", "Supabase CLI is not installed.");
  const config = requireWorktreeConfig();
  startOrResetSupabase(config, true);
}

export function dbStatus() {
  loadStableEnv();
  requireCommand("supabase", "Supabase CLI is not installed.");
  const config = requireWorktreeConfig();
  run("supabase", ["--workdir", config.instanceDir, "status"]);
}

export async function dev() {
  loadStableEnv();
  requireCommand("supabase", "Supabase CLI is not installed.");
  requireCommand("cloudflared", "cloudflared is not installed.");

  const domainBase = requiredEnv("OPEN_GROWTH_DEV_DOMAIN_BASE");
  const config = await refreshWorktreeConfigForDomain(
    await readOrInitializeMainWorktreeConfig(),
    domainBase,
  );
  if (!existsSync(config.cloudflaredConfigPath)) {
    const tunnel = await prepareCloudflare(config, domainBase);
    const updated = {
      ...config,
      tunnel,
      updatedAt: new Date().toISOString(),
    } satisfies WorktreeConfig;
    writeJsonFile(worktreeConfigPath, updated);
    writeReservation(updated);
  }

  const activeConfig = requireWorktreeConfig();
  const supabase = startOrResetSupabase(activeConfig, true);
  const runtimeEnv = readRuntimeEnv();

  spawnLogged(
    "api",
    "npm",
    ["run", "dev", "--workspace", "@open-growth/api"],
    runtimeEnv,
  );
  spawnLogged(
    "web",
    "npm",
    ["run", "dev", "--workspace", "@open-growth/web"],
    runtimeEnv,
  );
  spawnLogged(
    "cloudflared",
    "cloudflared",
    ["tunnel", "--config", activeConfig.cloudflaredConfigPath, "run"],
    runtimeEnv,
  );

  log(`Slot: ${activeConfig.slot} (${activeConfig.hostname})`);
  printUrlSummary({
    publicOrigin: activeConfig.publicOrigin,
    localWebUrl: `http://127.0.0.1:${activeConfig.ports.web}`,
    publicApiHealthUrl: `${activeConfig.publicOrigin}/api/health`,
    localApiHealthUrl: `http://127.0.0.1:${activeConfig.ports.api}/api/health`,
    supabaseUrl: supabase.apiUrl,
    studioUrl: `http://127.0.0.1:${activeConfig.ports.supabaseStudio}`,
  });
}

export function cleanWorktree() {
  loadStableEnv();
  const config = requireWorktreeConfig();
  if (commandExists("supabase")) {
    spawnSync(
      "supabase",
      ["--workdir", config.instanceDir, "stop", "--no-backup"],
      {
        cwd: repoRoot,
        stdio: "inherit",
      },
    );
  }
  removeReservation(config);
  rmSync(config.instanceDir, { recursive: true, force: true });
  rmSync(worktreeConfigPath, { force: true });
  rmSync(envLocalPath, { force: true });
  log(`Cleaned worktree slot: ${config.slot} (${config.hostname})`);
}
