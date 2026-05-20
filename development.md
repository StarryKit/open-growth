# Development

Open Growth is an npm workspace with a React/Vite web app, a Fastify API, and shared TypeScript code.

## Requirements

- Node.js 20 or newer
- npm
- Supabase CLI and Docker for database-backed local development
- cloudflared
- A Cloudflare API token for remote preview tunnels

## Setup

Install dependencies from the repository root:

```bash
npm install
```

Create the remote preview environment file:

```bash
cp .env.dev.example .env.dev
```

Open Growth requires Supabase for API auth, domain storage, and media storage. Local development should use the Supabase CLI stack so schema, RLS, Auth, Storage, and migrations match deployment.

## Environment

The default development entrypoint is the remote preview workflow. In the main
checkout, `pnpm dev` initializes the preview identity automatically on first
run. For secondary git worktrees, initialize the worktree once:

```bash
pnpm worktree:init
```

Then start the full preview stack:

```bash
pnpm dev
```

`worktree:init` reads stable human-written values from `.env.dev`, selects a
hostname slot, assigns stable ports, creates `.dev/worktree.json`, prepares
`.dev/instances/<slot>/`, and creates or reuses the slot Cloudflare Tunnel.

`pnpm dev` uses that worktree identity, creating it first when the current
checkout is the main checkout. It starts Supabase if needed, resets the
database, writes `.env.dev.local`, starts the API and web app, starts
cloudflared, and exposes the app over HTTPS. Stopping `pnpm dev` stops the
foreground app and tunnel processes; the worktree Supabase instance remains
available until `pnpm db:stop` or `pnpm worktree:clean`.

`.env.dev` contains stable values:

- `OPEN_GROWTH_DEV_DOMAIN_BASE`
- optional `OPEN_GROWTH_DEV_SLOT_CANDIDATES`
- optional `OPEN_GROWTH_DEV_SLOT`
- optional `OPEN_GROWTH_DEV_TUNNEL_NAME_PREFIX`
- `CLOUDFLARE_API_TOKEN`
- optional `CLOUDFLARE_ACCOUNT_ID`
- optional `CLOUDFLARE_ZONE_ID`
- optional local Google OAuth provider credentials

`.env.dev.local` is generated and ignored by git. It contains selected ports, Supabase keys, `OPEN_GROWTH_DEV_PUBLIC_ORIGIN`, `VITE_SUPABASE_URL`, and API runtime values.

`PORT` and `HOST` configure the Fastify API. The preview runner writes them dynamically.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` enable Supabase Auth in the web app. The preview runner points browser traffic at the selected public HTTPS origin, and the tunnel routes Supabase paths to the generated local Supabase API.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` enable Supabase-backed API auth, domain storage, and media storage. The preview runner points server traffic directly at the generated local Supabase API URL. Keep the service role key server-side only.

`SUPABASE_STORAGE_BUCKET` configures the Supabase Storage bucket for content assets. The default is `content-assets`.

`OPEN_GROWTH_USER_ID` can be used by API-side development tasks that need a default Supabase user scope.

`OPEN_GROWTH_OUTBOX_INTERVAL_MS` enables the outbox worker when set to a positive interval in milliseconds. The default `0` keeps the periodic worker disabled.

The preview runner starts the API with `OPEN_GROWTH_ENV_FILE=.env.dev.local`.

## Remote Preview Workflow

Use this for normal feature development and schema changes.

1. Install the Supabase CLI, Docker, and cloudflared.
2. Copy `.env.dev.example` to `.env.dev`.
3. Fill the Cloudflare values in `.env.dev`.
4. Initialize secondary git worktrees. Skip this in the main checkout if you
   prefer `pnpm dev` to initialize automatically:

```bash
pnpm worktree:init
```

5. Start the preview stack:

```bash
pnpm dev
```

The runner selects a hostname slot from `OPEN_GROWTH_DEV_SLOT_CANDIDATES`, which defaults to the main slot plus `a-f`. If `OPEN_GROWTH_DEV_DOMAIN_BASE=dev.opengrowth.com`, the hostnames are:

```text
dev.opengrowth.com
a-dev.opengrowth.com
b-dev.opengrowth.com
c-dev.opengrowth.com
```

The main checkout gets the main slot first. Git worktrees prefer alphabetical slots. Non-main hostnames use a hyphen prefix, such as `a-dev.opengrowth.com`, so they remain covered by a `*.opengrowth.com` certificate. Set `OPEN_GROWTH_DEV_SLOT=a` only when you want to force one checkout to a specific slot. Slot reservations live under `~/.cache/open-growth/dev-slots/`, and reservations for deleted worktree paths are reclaimed by `pnpm worktree:init`.

`pnpm worktree:init`:

1. Allocates stable web, API, and Supabase ports.
2. Creates `.dev/instances/<slot>/`.
3. Writes `.dev/worktree.json`.
4. Copies `packages/db/supabase/` into the instance and patches Supabase config.
5. Creates or reuses the slot Cloudflare Tunnel.
6. Upserts DNS for the slot hostname.

`pnpm dev`:

1. Reuses the initialized worktree slot and ports.
2. Starts Supabase if it is not already running.
3. Resets the database from migrations and seed data.
4. Writes `.env.dev.local`.
5. Starts the API, Vite web app, and Cloudflare Tunnel.
6. Prints the public URL, local web URL, local API health URL, and Supabase URL.

Database lifecycle commands:

```bash
pnpm db:start   # start/reuse Supabase and reset the DB
pnpm db:stop    # stop this worktree's Supabase instance
pnpm db:reset   # start if needed, then reset the DB
pnpm db:status  # show this worktree's Supabase status
```

When removing a worktree, run:

```bash
pnpm worktree:clean
```

This stops Supabase, removes `.dev/instances/<slot>/`, removes
`.env.dev.local`, and releases the slot reservation.

The seeded local login is:

- Email: `local-dev@open-growth.test`
- Password: `open-growth-local`

### OAuth Redirects

Supabase Auth is exposed on the public preview origin under `/auth`. For Google sign-in, register each planned slot redirect URI:

```text
https://dev.opengrowth.com/auth/v1/callback
https://a-dev.opengrowth.com/auth/v1/callback
https://b-dev.opengrowth.com/auth/v1/callback
https://c-dev.opengrowth.com/auth/v1/callback
```

The preview tunnel routes Supabase Auth, REST, Storage, Realtime, and GraphQL paths directly to the local Supabase API.

Put the local Google OAuth values in `.env.dev`:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```

Do not commit Google OAuth secrets. After changing these values, run
`pnpm db:stop` and then `pnpm dev` or `pnpm db:start` so Supabase restarts with
the new provider values.

Schema changes go in `packages/db/supabase/migrations/`. Create a new migration with:

```bash
npm run db:new your_migration_name
```

## Local-Only Fallback

The preview workflow is the default. When you intentionally do not need a public HTTPS tunnel, you can still run the local-only stack:

```bash
npm run dev:local
```

- Web app: `http://localhost:5173`
- API: `http://localhost:3001`

The Vite dev server proxies `/api` requests to the API server. Supabase browser traffic uses `VITE_SUPABASE_URL` directly.

Run one workspace at a time when debugging a single side:

```bash
npm run dev --workspace @open-growth/web
npm run dev --workspace @open-growth/api
```

## Test Workflow

Use the same checks that CI and reviewers should expect:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

For focused test runs:

```bash
npm run test --workspace @open-growth/web
npm run test --workspace @open-growth/api
npm run test --workspace @open-growth/db
```

## Development Flow

1. Read `CONTEXT.md` and the relevant ADRs under `docs/adr/` before changing domain behavior.
2. Make changes inside the existing workspace boundary: `apps/web`, `apps/api`, or `packages/shared`.
3. Add or update colocated Vitest unit tests for changed app logic.
4. Add or update package-root `integration/` tests for integration behavior.
5. Keep database tests inside `packages/db`.
6. Run lint, typecheck, Vitest, and build before handing off a change.
