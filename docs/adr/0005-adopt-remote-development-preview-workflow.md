# ADR-0005: Adopt worktree-based remote development preview workflow

Status: accepted
Date: 2026-05-20
Builds on: [ADR-0001](./0001-current-workspace-architecture.md), [ADR-0002](./0002-supabase-domain-storage-and-outbox.md)
Related: [Worktree-based preview workflow pattern](../dev-preview-workflow.md)

## Context

Open Growth is developed on a remote PC. The development loop needs a complete
preview environment containing:

1. Vite web app.
2. Fastify API app.
3. Local Supabase stack.
4. Public HTTPS access through Cloudflare Tunnel.

Multiple git worktrees may run at the same time on the same remote PC. Each
worktree needs independent ports, an independent local Supabase project, and a
predictable public hostname that can be registered with OAuth providers.

The previous runner created a fresh temporary instance during `pnpm dev`. That
worked, but it made Supabase lifecycle too expensive and tied hostname slots to
running processes rather than to worktrees. In practice, a slot should belong to
a worktree until that worktree is cleaned up.

## Decision

Adopt a worktree-based development preview lifecycle:

```bash
pnpm worktree:init
pnpm db:start
pnpm db:stop
pnpm db:reset
pnpm db:status
pnpm dev
pnpm worktree:clean
```

`pnpm worktree:init` is the one-time setup command for secondary git worktrees.
It selects a slot, assigns stable ports, creates `.dev/worktree.json`, creates
`.dev/instances/<slot>/`, creates or reuses the slot Cloudflare Tunnel, upserts
DNS, and writes generated Supabase/cloudflared config.

`pnpm dev` initializes the main checkout automatically when `.dev/worktree.json`
is missing. Secondary git worktrees still require explicit `pnpm worktree:init`
so slot ownership is intentional. It then reuses the slot and ports from
`.dev/worktree.json`, starts Supabase if needed, resets the database, writes
`.env.dev.local`, starts the API, starts Vite, and starts cloudflared. Exiting
`pnpm dev` stops only the foreground app and tunnel processes. Supabase remains
running for the worktree.

`pnpm worktree:clean` stops Supabase, removes the worktree instance directory,
removes `.env.dev.local`, removes `.dev/worktree.json`, and releases the slot
reservation.

## Slot And Port Persistence

Each worktree stores its identity in:

```text
.dev/worktree.json
```

Slot reservations are machine-global and live under:

```text
~/.cache/open-growth/dev-slots/
```

Reservations are long-lived. `pnpm worktree:init` removes reservations whose
`workspaceRoot` no longer exists. If every slot is reserved by an existing
worktree, initialization fails.

Ports are assigned at `worktree:init` time and reused until
`worktree:clean`. This prevents tunnel config, Supabase redirect URLs, and
generated env values from drifting between runs.

The main slot uses `OPEN_GROWTH_DEV_DOMAIN_BASE` directly, for example
`dev.opengrowth.com`. Non-main slots use a hyphen prefix, for example
`a-dev.opengrowth.com`, so every slot remains covered by a single
`*.opengrowth.com` certificate.

## Configuration

Copy `.env.dev.example` to `.env.dev` and fill in stable values:

```bash
OPEN_GROWTH_DEV_DOMAIN_BASE=dev.opengrowth.example
CLOUDFLARE_API_TOKEN=...

SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```

Optional values:

```bash
OPEN_GROWTH_DEV_SLOT_CANDIDATES=,a,b,c,d,e,f
OPEN_GROWTH_DEV_SLOT=a
OPEN_GROWTH_DEV_TUNNEL_NAME_PREFIX=open-growth-dev
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_ZONE_ID=...
```

Do not put generated runtime values in `.env.dev`. The workflow writes these to
`.env.dev.local`:

```text
PORT
HOST
WEB_PORT
API_PORT
OPEN_GROWTH_DEV_SLOT
OPEN_GROWTH_DEV_PUBLIC_HOSTNAME
OPEN_GROWTH_DEV_PUBLIC_ORIGIN
SUPABASE_LOCAL_API_PORT
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
OPEN_GROWTH_DEV_CLOUDFLARE_TUNNEL_ID
OPEN_GROWTH_DEV_CLOUDFLARE_TUNNEL_NAME
OPEN_GROWTH_DEV_CLOUDFLARE_TUNNEL_CREDENTIALS_FILE
OPEN_GROWTH_DEV_SUPABASE_STUDIO_URL
OPEN_GROWTH_DEV_SUPABASE_INBUCKET_URL
```

## Supabase

Use one Supabase CLI workdir per initialized worktree:

```text
.dev/instances/<slot>/
```

Supabase containers are intentionally reused. `pnpm dev`, `pnpm db:start`, and
`pnpm db:reset` run `supabase db reset` so migrations and seed data are applied
to a clean database, but they do not tear down containers unless generated
Supabase config changed.

This keeps the remote dev loop fast while still exercising migrations on every
preview run.

## Cloudflare And Routing

Use one Cloudflare Tunnel per selected slot. The runner upserts a proxied CNAME:

```text
<slot-hostname> CNAME <tunnel-id>.cfargotunnel.com
```

Browser routing is same-origin:

```text
https://slot-domain/                 -> Vite web
https://slot-domain/api/*            -> Fastify API
https://slot-domain/auth/v1/*        -> Supabase
https://slot-domain/rest/v1/*        -> Supabase
https://slot-domain/storage/v1/*     -> Supabase
https://slot-domain/realtime/v1/*    -> Supabase
https://slot-domain/graphql/v1/*     -> Supabase
```

Cloudflared `path` entries must be anchored regular expressions, such as
`"^/api(/.*)?$"`, because cloudflared treats `path` as a regex.

## Google OAuth Setup

Use one Google OAuth web application client for the dev slots.

Authorized JavaScript origins:

```text
https://dev.opengrowth.com
https://a-dev.opengrowth.com
https://b-dev.opengrowth.com
https://c-dev.opengrowth.com
https://d-dev.opengrowth.com
https://e-dev.opengrowth.com
https://f-dev.opengrowth.com
```

Authorized redirect URIs:

```text
https://dev.opengrowth.com/auth/v1/callback
https://a-dev.opengrowth.com/auth/v1/callback
https://b-dev.opengrowth.com/auth/v1/callback
https://c-dev.opengrowth.com/auth/v1/callback
https://d-dev.opengrowth.com/auth/v1/callback
https://e-dev.opengrowth.com/auth/v1/callback
https://f-dev.opengrowth.com/auth/v1/callback
```

Google OAuth does not accept wildcard redirect URIs for this use case.

## Consequences

Benefits:

- Worktree slots are stable and predictable.
- Ports do not drift between `pnpm dev` runs.
- Supabase startup is faster because containers stay warm.
- Migrations are still tested against a clean database on every preview run.
- Foreground dev processes can be restarted without tearing down Supabase.

Tradeoffs:

- Developers must run `pnpm worktree:init` once per secondary git worktree.
  The main checkout is initialized automatically by `pnpm dev`.
- Developers should run `pnpm worktree:clean` before deleting a worktree.
- Slot reservations can outlive a worktree if the directory is removed in an
  unusual way, but `worktree:init` garbage-collects missing paths.
- Local Supabase data is disposable because database reset is intentional.

## Troubleshooting

### `This worktree is not initialized`

In a secondary git worktree, run:

```bash
pnpm worktree:init
```

### `No free dev slot found`

Inspect slot reservations:

```bash
ls ~/.cache/open-growth/dev-slots/
```

Run `pnpm worktree:clean` in old worktrees, or remove reservations whose
`workspaceRoot` no longer exists.

### Supabase migration changes do not appear

Run:

```bash
pnpm db:reset
```

`pnpm dev` also resets the database before starting the app.

### OAuth redirect mismatch

Confirm the selected slot in `.dev/worktree.json` or `.env.dev.local`, then add
both of these to the Google OAuth client:

```text
https://<slot-host>
https://<slot-host>/auth/v1/callback
```

## Status

Implemented in:

- `scripts/dev-workflow.ts`
- `scripts/worktree-init.ts`
- `scripts/worktree-clean.ts`
- `scripts/db-start.ts`
- `scripts/db-stop.ts`
- `scripts/db-reset.ts`
- `scripts/db-status.ts`
- `scripts/dev.ts`
- `apps/web/vite.config.ts`
- `packages/db/supabase/config.toml`
- `.env.dev.example`
