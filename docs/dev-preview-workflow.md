# Worktree-Based Development Preview Workflow

This document describes the reusable remote development preview pattern used by
Open Growth. It is intended to be portable to other projects developed on a
remote machine.

## Goals

- Give each git worktree a stable development identity.
- Support multiple concurrent worktrees on the same machine.
- Expose each worktree through a predictable HTTPS hostname.
- Keep local Supabase containers warm across `pnpm dev` runs.
- Reset the database on each app preview run so migrations and seed data are
  always exercised from a clean state.

## Commands

Use separate commands for worktree lifecycle, database lifecycle, and app
preview:

```bash
pnpm worktree:init
pnpm db:start
pnpm db:stop
pnpm db:reset
pnpm db:status
pnpm dev
pnpm worktree:clean
```

`pnpm worktree:init` is run once after creating a secondary git worktree. The
main checkout may skip it; `pnpm dev` initializes the main checkout on first
run. Initialization:

1. Reads stable configuration from `.env.dev`.
2. Selects an available hostname slot.
3. Allocates stable ports for this worktree.
4. Creates `.dev/instances/<slot>/`.
5. Writes `.dev/worktree.json`.
6. Creates or reuses the Cloudflare Tunnel for the slot.
7. Upserts DNS for the slot hostname.
8. Generates the slot-specific Supabase and cloudflared config files.

`pnpm db:start` starts the current worktree's Supabase instance if needed, then
runs `supabase db reset` so migrations and seed data are applied to a clean
database. It writes `.env.dev.local` with runtime Supabase keys and URLs.

`pnpm dev` uses the initialized worktree identity. In the main checkout, it
creates that identity automatically when `.dev/worktree.json` is missing. In
secondary git worktrees, run `pnpm worktree:init` explicitly so slot ownership is
intentional. It starts Supabase through the same path as `pnpm db:start` if it
is not already running, always resets the database, then starts the API, Vite
app, and cloudflared. Stopping `pnpm dev` stops only those foreground app/tunnel
processes; Supabase remains available for the worktree.

`pnpm worktree:clean` stops Supabase, removes the worktree instance directory,
removes `.env.dev.local`, and releases the slot reservation.

## Worktree Identity

Each worktree has a local identity file:

```text
.dev/worktree.json
```

It records:

```json
{
  "slot": "a",
  "hostname": "a-dev.example.com",
  "publicOrigin": "https://a-dev.example.com",
  "instanceDir": "/repo/.dev/instances/a",
  "ports": {
    "web": 5174,
    "api": 3002,
    "supabaseApi": 54331
  }
}
```

The exact port set is project-specific. The important rule is that ports are
assigned at `worktree:init` time and reused until `worktree:clean`.

## Slot Reservations

Slot reservations are machine-global and long-lived, because slots belong to
worktrees rather than running processes.

Use a cache directory such as:

```text
~/.cache/<project-name>/dev-slots/
```

Each reservation records the slot, hostname, workspace root, instance path, and
ports. `worktree:init` should remove reservations whose `workspaceRoot` no
longer exists. If all slots are reserved by existing worktrees, initialization
should fail with a clear message.

The main checkout should prefer the main slot. Additional git worktrees should
prefer alphabetical slots. Non-main hostnames should be prefixed with a hyphen,
for example `a-dev.example.com`, so a single `*.example.com` certificate covers
every slot.

## Environment Files

Use two development env files:

```text
.env.dev        stable human-managed values
.env.dev.local  generated runtime values
```

`.env.dev` contains stable values:

```bash
DEV_DOMAIN_BASE=dev.example.com
CLOUDFLARE_API_TOKEN=...
OAUTH_CLIENT_ID=...
OAUTH_CLIENT_SECRET=...
```

`.env.dev.local` contains generated values:

```bash
DEV_PUBLIC_ORIGIN=https://a-dev.example.com
WEB_PORT=5174
API_PORT=3002
SUPABASE_URL=http://127.0.0.1:54331
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=https://a-dev.example.com
VITE_SUPABASE_ANON_KEY=...
```

Do not commit either file. Commit only `.env.dev.example`.

## Supabase

Use one Supabase CLI workdir per worktree slot:

```text
.dev/instances/<slot>/
```

The runner copies the project's Supabase config, migrations, seed data, and
templates into that instance directory and patches `config.toml` with the
worktree's stable ports and public origin.

Supabase containers are intentionally long-lived. `pnpm dev` does not tear them
down when it exits. This keeps the remote development loop fast while still
testing migrations, because `pnpm dev` and `pnpm db:start` run `supabase db
reset` against the existing instance.

Restart Supabase only when:

- It is not already running.
- The generated Supabase config changed.
- The developer explicitly runs `pnpm db:stop` and `pnpm db:start`.

## Cloudflare Tunnel

Use one Cloudflare Tunnel per hostname slot. This avoids connector routing
ambiguity when multiple worktrees run concurrently.

For each slot:

1. Create or reuse a named Cloudflare Tunnel.
2. Store credentials under `~/.cloudflared/`.
3. Upsert a proxied CNAME:

```text
<slot-hostname> CNAME <tunnel-id>.cfargotunnel.com
```

The tunnel config lives under the worktree instance directory:

```text
.dev/instances/<slot>/cloudflared.yml
```

Use anchored path regexes for tunnel routing. Cloudflared treats `path` as a
regular expression, so unanchored patterns such as `/api/*` can accidentally
match frontend module paths like `/src/ui/lib/api.ts`.

## Same-Origin Routing

Browser-facing services should share the slot origin:

```text
https://slot-dev.example.com/                 -> Vite web
https://slot-dev.example.com/api/*            -> API
https://slot-dev.example.com/auth/v1/*        -> Supabase Auth
https://slot-dev.example.com/rest/v1/*        -> Supabase REST
https://slot-dev.example.com/storage/v1/*     -> Supabase Storage
https://slot-dev.example.com/realtime/v1/*    -> Supabase Realtime
https://slot-dev.example.com/graphql/v1/*     -> Supabase GraphQL
```

The browser-facing Supabase URL is the public origin:

```bash
VITE_SUPABASE_URL=https://slot-dev.example.com
```

Server processes should use local URLs:

```bash
SUPABASE_URL=http://127.0.0.1:<supabase-api-port>
```

## OAuth

Register every planned slot with OAuth providers. For Google OAuth, add each
slot to Authorized JavaScript origins and Authorized redirect URIs:

```text
https://dev.example.com
https://dev.example.com/auth/v1/callback
https://a-dev.example.com
https://a-dev.example.com/auth/v1/callback
```

Google OAuth does not accept wildcard redirect URIs for this use case.

## Adapting To Another Project

To reuse the pattern in another repository:

1. Pick project-specific env names and a domain base.
2. Add `.env.dev.example` with stable human-managed values only.
3. Implement `worktree:init` to persist slot, hostname, ports, tunnel, and
   instance path in `.dev/worktree.json`.
4. Implement `db:start`, `db:stop`, `db:reset`, and `db:status` around the
   worktree instance.
5. Make `pnpm dev` initialize the main checkout when needed, require explicit
   initialization in secondary worktrees, start/reset dependencies, then launch
   app processes and cloudflared.
6. Make `worktree:clean` stop Supabase and release the slot reservation.
