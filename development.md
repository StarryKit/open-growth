# Development

Open Growth is an npm workspace with a React/Vite web app, a Fastify API, and shared TypeScript code.

## Requirements

- Node.js 20 or newer
- npm
- Optional: Supabase CLI and Docker when testing against local Supabase services

## Setup

Install dependencies from the repository root:

```bash
npm install
```

Create a local environment file when you need Supabase-backed auth, storage, or database behavior:

```bash
cp .env.example .env
```

The app can run without `.env`. In that mode, the API uses the local development fallback user and local runtime storage.

## Environment

`PORT` and `HOST` configure the Fastify API. Defaults are `3001` and `0.0.0.0`.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` enable Supabase Auth in the web app. Leave them empty for local development auth fallback.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` enable Supabase-backed API auth, domain storage, and media storage. Keep the service role key server-side only.

`SUPABASE_STORAGE_BUCKET` configures the Supabase Storage bucket for content assets. The default is `content-assets`.

`OPEN_GROWTH_USER_ID` can be used by API-side development tasks that need a default Supabase user scope.

`OPEN_GROWTH_OUTBOX_INTERVAL_MS` enables the outbox worker when set to a positive interval in milliseconds. The default `0` keeps the periodic worker disabled.

When using root `.env` values with the combined dev script, export them before starting the app:

```bash
set -a
source .env
set +a
npm run dev
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

## Supabase Development

Supabase is the durable product storage boundary, but local development can use the fallback mode when Supabase variables are not set.

For Supabase-backed development:

1. Start your Supabase project or local Supabase stack.
2. Apply migrations from `supabase/migrations/`.
3. Load `supabase/seed.sql` if you need demo workspace data.
4. Create the `content-assets` storage bucket, or set `SUPABASE_STORAGE_BUCKET` to the bucket you want to use.
5. Put the Supabase URL, anon key, service role key, and any needed user id in `.env`.
6. Export `.env` and run `npm run dev`.

## Test Workflow

Use the same checks that CI and reviewers should expect:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Run end-to-end tests separately:

```bash
npm run test:e2e
```

Playwright builds the web and API workspaces, starts the production API server on `http://127.0.0.1:3001`, and serves the built web app from the Fastify static server.

For focused test runs:

```bash
npm run test --workspace @open-growth/web
npm run test --workspace @open-growth/api
```

## Development Flow

1. Read `CONTEXT.md` and the relevant ADRs under `docs/adr/` before changing domain behavior.
2. Make changes inside the existing workspace boundary: `apps/web`, `apps/api`, or `packages/shared`.
3. Add or update Vitest coverage for changed app logic.
4. Add or update Playwright coverage when user-facing workflows change.
5. Run lint, typecheck, unit tests, and build before handing off a change.
6. Run Playwright when the change affects navigation, API integration, auth, storage, publishing, tracking, or trends workflows.
