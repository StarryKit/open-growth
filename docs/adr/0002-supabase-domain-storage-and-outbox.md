# ADR-0002: Supabase domain storage, media, and outbox boundaries

Status: accepted
Date: 2026-05-17

## Context

Open Growth now models the full workspace workflow surface: project-scoped content, drafts, published content, engagement snapshots, trend queries, and trend posts. The product requirement states that user data must persist in Supabase Postgres, user authentication must use Supabase Auth, media must live in Supabase Storage, and external side effects must flow through an outbox.

## Decision

Use Supabase as the durable boundary for all user data:

- Supabase Postgres stores structured workspace, project, content, publish, tracking, and trends data.
- Supabase Auth is the only supported identity system.
- Supabase Storage stores content binaries and derived media.
- `outbox_events` records publish, tracking refresh, trends search, and storage cleanup side effects.
- Every project-scoped table includes `workspace_id` and `project_id` where applicable.
- Row level security is mandatory on all user-visible tables.

## Consequences

- The local JSON store used in development must be treated as a runtime-only fallback, not the product storage model.
- Future connectors should write platform side effects through outbox processing rather than directly mutating business state in request handlers.
- Schema changes must be expressed as migrations under `supabase/migrations/`.

## Implementation Plan

- Define the core tables, enums, and RLS helpers in Supabase migrations.
- Seed a private workspace and a demo project for local development.
- Keep the Fastify API aligned with the shared domain model and the PRD workflow states.

