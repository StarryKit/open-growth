# Development

Open Growth is an npm workspace with a React/Vite web app, a Fastify API, and shared TypeScript code.

## Requirements

- Node.js 20 or newer
- npm
- Supabase CLI and Docker for database-backed local development

## Setup

Install dependencies from the repository root:

```bash
npm install
```

Create the local environment file:

```bash
cp .env.example .env
```

Open Growth requires Supabase for API auth, domain storage, and media storage. Local development should use the Supabase CLI stack so schema, RLS, Auth, Storage, and migrations match deployment.

## Environment

`PORT` and `HOST` configure the Fastify API. Defaults are `3001` and `0.0.0.0`.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` enable Supabase Auth in the web app. Put local Supabase CLI values or non-production branch values in `.env`; put production values in your deployment provider.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` enable Supabase-backed API auth, domain storage, and media storage. Keep the service role key server-side only.

`SUPABASE_STORAGE_BUCKET` configures the Supabase Storage bucket for content assets. The default is `content-assets`.

`OPEN_GROWTH_USER_ID` can be used by API-side development tasks that need a default Supabase user scope.

`OPEN_GROWTH_OUTBOX_INTERVAL_MS` enables the outbox worker when set to a positive interval in milliseconds. The default `0` keeps the periodic worker disabled.

The API loads root `.env` by default. Set `OPEN_GROWTH_ENV_FILE=/path/to/file` only when you intentionally want to run the API with another env file.

## Local Supabase Workflow

Use this for normal feature development and schema changes.

1. Install the Supabase CLI and make sure Docker is running.
2. Start local Supabase:

```bash
npm run db:start
```

3. Copy `.env.example` to `.env`.
4. Run `npm run db:status` and copy the printed `anon key` and `service_role key` into `.env`.
5. Reset the database whenever you want a clean schema and seed:

```bash
npm run db:reset
```

6. Start the app:

```bash
pnpm dev
```

The seeded local login is:

- Email: `local-dev@open-growth.test`
- Password: `open-growth-local`

Schema changes go in `packages/db/supabase/migrations/`. Create a new migration with:

```bash
npm run db:new your_migration_name
```

## Run Locally

Start both the web app and API:

```bash
npm run dev
```

- Web app: `http://localhost:5173`
- API: `http://localhost:3001`

The Vite dev server proxies `/api` requests to the API server.

Run one workspace at a time when debugging a single side:

```bash
npm run dev --workspace @open-growth/web
npm run dev --workspace @open-growth/api
```

## Supabase Branch And Production Workflow

Supabase is the durable product storage boundary.

Use Supabase preview or persistent branches for PR review, QA, or cross-machine testing. Do not point local development at production unless you are intentionally debugging a production-only issue.

For a branch environment:

1. Create or select a Supabase branch.
2. Fill `.env` with the branch `SUPABASE_URL`, `VITE_SUPABASE_URL`, anon key, and service role key.
4. Run:

```bash
pnpm dev
```

For production:

1. Apply reviewed migrations to the production Supabase project or merge the Supabase branch.
2. Configure the deployment provider with production Supabase URL, anon key, and service role key.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.

If you need to test manually against any Supabase project:

1. Apply migrations from `packages/db/supabase/migrations/`.
2. Load `packages/db/supabase/seed.sql` only for non-production demo data.
3. Create the `content-assets` storage bucket if migrations were not used.
4. Put the Supabase URL, anon key, service role key, and any needed user id in an env file.
5. Run the app with that env file.

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
