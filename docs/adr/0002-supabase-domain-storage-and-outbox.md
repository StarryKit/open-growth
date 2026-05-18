# ADR-0002: Supabase product data and environment boundaries

Status: accepted
Date: 2026-05-17
Updated: 2026-05-18

## Context

Open Growth now models the full workspace workflow surface: project-scoped content, drafts, published content, engagement snapshots, trend queries, and trend posts. The product requirement states that user data must persist in Supabase Postgres, user authentication must use Supabase Auth, media must live in Supabase Storage, and external side effects must flow through an outbox.

The previous JSON/file fallback has been removed so local development exercises migrations, RLS, Auth, Storage policies, and production-like data access. Developers need a fast way to change schema, reset data, and test integrated database behavior without risking production data. Preview and QA environments also need to switch cleanly from local development without changing application code.

## Decision

Use Supabase as the durable boundary for all user data:

- Supabase Postgres stores structured workspace, project, content, publish, tracking, and trends data.
- Supabase Auth is the only supported identity system.
- Supabase Storage stores content binaries and derived media.
- `outbox_events` records publish, tracking refresh, trends search, and storage cleanup side effects.
- Every project-scoped table includes `workspace_id` and `project_id` where applicable.
- Row level security is mandatory on all user-visible tables.

Use a Supabase environment ladder for every runtime:

- Local development: Supabase CLI stack, configured by `packages/db/config.toml` and `.env`.
- Pull request or QA testing: Supabase preview or persistent branches, configured by `.env`.
- Production: the production Supabase project, configured only in the deployment provider.

All schema changes must be represented as SQL migrations under `packages/db/migrations/`. Seed data for local development lives in `packages/db/seed.sql`.

The application fails fast when required Supabase variables are absent.

## Consequences

- The local JSON store is not the product storage model and should not be restored as a runtime fallback.
- Future connectors should write platform side effects through outbox processing rather than directly mutating business state in request handlers.
- Schema changes must be expressed as migrations under `packages/db/migrations/`.
- Developers can run `npm run db:start`, `npm run db:reset`, and `pnpm dev` to test against a local production-like stack.
- Deployment and branch switching are environment-variable changes, not application-code changes.
- RLS, Auth, Storage, and transactional RPC behavior are exercised during normal development.
- Database-sensitive tests should live in `packages/db` and target Supabase-backed environments when they need production-like behavior.

## Implementation Plan

- Define the core tables, enums, and RLS helpers in Supabase migrations.
- Seed a private workspace and a demo project for local development.
- Keep the Fastify API aligned with the shared domain model and the PRD workflow states.
- Keep `packages/db/config.toml` aligned with app ports and local Auth redirect URLs.
- Keep `.env.example` current when required Supabase variables change.
- Keep `development.md` as the setup source of truth.
- Prefer new migrations over editing applied migrations once remote environments exist.
