# ADR-0003: Separate publishing and collector identities

Status: accepted
Date: 2026-05-19

## Context

Open Growth needs connectors for two different classes of platform work:

- Publish and reply workflows, where a user intentionally acts as themselves on X, Reddit, WeChat, Xiaohongshu, or another platform.
- Trends and data collection workflows, where Open Growth searches, reads, normalizes, and tracks platform content for a Project.

The current connector model stores one `connector_accounts` record per `workspace_id`, `user_id`, and `platform`, with a single `credential_ref`. That shape does not distinguish whether the credential is allowed to publish user-authored content, reply to posts, fetch engagement for a user's own published content, or collect Trends data through a platform-approved account.

OpenCLI can help execute deterministic platform adapters, especially for browser-session platforms such as X, Reddit, Xiaohongshu, and WeChat. However, OpenCLI reuses browser sessions or public adapters; it is not the product's OAuth identity system. Treating OpenCLI as the primary connector account model would couple user publishing identity, backend collection identity, browser profile management, and platform compliance into one unclear boundary.

ADR-0002 requires external platform side effects to flow through `outbox_events`, and all connector state must remain Supabase-backed. This decision refines that connector boundary.

## Decision

Separate platform connector identities by use case:

- **Publishing identity**: a user-bound platform authorization used only when that user publishes posts, creates replies, or performs other user-intentional write actions. Publishing identities are bound to the user's Open Growth identity through OAuth or another platform-approved user authorization flow. Workspaces can enable one or more user-bound Publishing identities, but the Workspace does not own the underlying platform authorization.
- **Collector identity**: a backend-controlled platform authorization used for Trends search, public content collection, broad read workflows, and other non-user-persona data collection. Collector identities use admin-provided platform official accounts, platform-approved API credentials, public adapters, or vendor credentials.
- **Admin**: an Open Growth user whose Supabase Auth user ID appears in a server-side environment variable allowlist such as `OPEN_GROWTH_ADMIN_USER_IDS`.

Do not use collector identities to publish user-authored content or replies.

Do not use a user's publishing identity as the default source for Trends collection. A user's publishing identity may be used for engagement or status reads for content that the same user published, when a platform requires the user's authorization for that specific post.

Model connector capabilities explicitly. Each connector account must declare:

- `platform`
- `identity_kind`: `publishing` or `collector`
- `auth_mode`: `oauth`, `api_key`, `public`, `browser_profile`, or `vendor`
- supported `use_cases`: `publish`, `reply`, `engagement`, `trends`, `read`
- owner scope: `user`, `workspace`, or `system`
- secret reference metadata, never raw credentials exposed to the frontend

OpenCLI is allowed as an adapter backend, not as the domain identity model. When OpenCLI is used for collection, it must run under an explicitly configured collector identity, such as a controlled browser profile or public adapter. When OpenCLI is used for publishing or reply automation, it must run only under the requesting user's publishing identity and must preserve the same outbox, audit, and idempotency requirements as official API adapters.

## Alternatives Considered

1. Keep a single connector account per user and platform.
   - Rejected because it cannot safely express whether a credential is authorized for publishing, replying, engagement reads, or Trends collection.
   - It would make future agents likely to reuse user OAuth tokens for broad data collection.

2. Use OpenCLI as the primary connector and identity system.
   - Rejected because OpenCLI's browser adapters depend on logged-in browser sessions or browser profiles, while Open Growth needs durable Supabase-backed connector records, OAuth flows, outbox processing, and clear workspace permissions.
   - OpenCLI remains useful as an adapter implementation detail, especially for MVP collection on platforms where official APIs are limited.

3. Separate publishing identities from collector identities.
   - Accepted because it matches the product boundary: users publish and reply as themselves, while data collection runs through controlled official collector accounts or public sources.

## Consequences

- `connector_accounts` must evolve beyond a single `credential_ref` per user and platform.
- Connector UI must show separate connection states for publishing access and collector access.
- Collector identity configuration must live behind an admin-only UI entry and admin-protected APIs.
- Publish and reply actions must require an active Publishing identity that is enabled for the active Workspace and target platform.
- Trends runs must resolve a collector identity or public adapter for each requested platform before executing.
- Outbox payloads for `publish.execute`, `publish.retry`, `publish.schedule`, `engagement.refresh`, and `trends.run` must carry enough identity intent to resolve the correct connector account at processing time.
- OpenCLI can be invoked by the backend worker only through the connector adapter layer, with explicit `identity_kind` and `auth_mode` selection.
- Compliance language in connector capabilities should describe whether each platform uses official OAuth/API, public API, controlled browser profile, or vendor data.

## Non-goals

- Do not implement a full connector marketplace in this decision.
- Do not require every platform to support both publishing and collection.
- Do not use raw passwords, raw cookies, or user-supplied browser session dumps as connector credentials.
- Do not make user OAuth login for the Open Growth app itself responsible for platform publishing authorization.
- Do not bind Publishing identities directly to a single Workspace.
- Do not expose Collector identity configuration to non-admin users.
- Do not treat OpenCLI browser profiles as a substitute for platform-approved user OAuth when an official publish API is required.

## Implementation Plan

- **Affected paths**: `packages/shared/src/content.ts`, `packages/db/supabase/migrations/`, `packages/db/src/database-store.ts`, `apps/api/src/lib/connector-service.ts`, `apps/api/src/lib/domain-store.ts`, `apps/api/src/lib/outbox-worker.ts`, `apps/api/src/app.ts`, `apps/api/src/lib/env.ts`, `apps/web/src/components/sidebar.tsx`, `apps/web/src/ui/pages/connectors-page.tsx`, `apps/web/src/ui/pages/publish-page.tsx`, `apps/web/src/ui/pages/trends-page.tsx`, `.env.dev.example`, `CONTEXT.md`, and `docs/prd/open-growth-prd.md`.
- **Shared types**: add connector identity concepts for `identity_kind`, `auth_mode`, `use_cases`, and owner scope. Keep platform values in `GrowthPlatform`.
- **Database**: add a migration that extends or replaces `connector_accounts` so records can represent user-owned Publishing identities and workspace/system Collector identities independently. Add a Workspace-level enablement relationship so a Workspace can enable one or more user-owned Publishing identities without copying credentials. Preserve RLS so users can read allowed connector status but cannot read secret values.
- **Secrets**: continue storing only `credential_ref` or provider references in Postgres. Raw OAuth tokens, API keys, and browser profile secrets must stay in a server-side secret store or deployment secret provider.
- **Admin authorization**: read `OPEN_GROWTH_ADMIN_USER_IDS` or an equivalent env allowlist in the API process. Collector identity list/create/update/test/disable/delete endpoints must require the authenticated Supabase user ID to be present in that allowlist.
- **API**: replace manual `credentialRef` connection behavior with explicit connector endpoints for publishing authorization, Workspace Publishing identity enablement, and admin-only Collector configuration. OAuth callback endpoints should create user-owned Publishing identities.
- **Publishing**: before a publish or reply outbox event is processed, resolve an active `publishing` identity for the event's requesting `user_id`, `platform`, and active `workspace_id`; the identity must be user-owned and enabled for that Workspace.
- **Trends**: before a Trends run is executed, resolve a `collector` identity or public adapter for each platform in the query. If a platform has no configured collector identity and no public adapter, mark that platform's run result as failed with a visible configuration error.
- **Engagement**: use the publishing identity for user-owned published content when required by the platform; otherwise allow a collector or public read adapter only for non-private public metrics.
- **OpenCLI adapter**: introduce OpenCLI behind the connector adapter interface only. Store the selected OpenCLI profile or public mode as connector metadata, not as a frontend-exposed credential. Do not let request handlers shell out directly to OpenCLI.
- **Tests**: update connector service tests to verify identity resolution by use case, database tests to cover the new connector schema and RLS-sensitive fields, API tests for connection status responses, and outbox worker tests for publishing vs Trends identity selection.
- **Docs**: update the PRD connector account section and `CONTEXT.md` glossary with Publishing identity, Collector identity, and Connector adapter.

## Verification

- [ ] `packages/shared/src/content.ts` defines connector identity kind, auth mode, use case, and owner scope types.
- [ ] Development preview configuration documents the admin allowlist runtime variable for Collector identity management.
- [ ] A Supabase migration can store a user-owned Publishing identity and an admin-managed Collector identity for the same platform without conflict.
- [ ] A Workspace can enable one or more user-owned Publishing identities without owning or copying the credential.
- [ ] Frontend connector status can display publishing and collector readiness separately for the same platform.
- [ ] Non-admin users cannot see the Collector identity sidebar entry and receive a forbidden response from Collector identity APIs.
- [ ] Publish and reply API paths fail with a clear configuration error when no active Publishing identity is enabled for the active Workspace and platform.
- [ ] Trends outbox processing never resolves a user's publishing identity unless the event explicitly targets engagement or status reads for that user's own published content.
- [ ] OpenCLI execution is reachable only through the connector adapter layer, not directly from Fastify request handlers.
- [ ] No API response includes raw credentials, raw tokens, cookies, or browser profile secrets.
- [ ] Connector, database, API, and outbox tests cover the accepted identity separation.

## Revisit Conditions

Revisit this decision if a platform requires all collection to happen under the same end-user OAuth identity as publishing, if Open Growth becomes single-user local-only software with no shared backend worker, or if a platform partnership provides a unified official API that safely covers both publishing and collection under separate scopes.
