# ADR-0001: Record the current workspace architecture

Status: accepted
Date: 2026-05-16

## Context

The repository already implements a workspace-style application. The codebase is the source of truth for the current architecture:

- `apps/web` is a React 19 app built with Vite.
- `apps/api` is a Fastify 5 API and static asset server.
- `packages/shared` holds shared types and helpers.
- Tooling is Biome, TypeScript, and Vitest.

This ADR records that structure so future changes can be compared against the implementation that actually exists.

## Decision

Keep the current architecture as the baseline:

- React + Vite for the web app
- Fastify for the API
- `packages/shared` for shared code
- Biome for linting and formatting
- Vitest for unit and integration tests

The repository code, package manifests, and test configs are the source of truth. If documentation conflicts with the implementation, update the docs to match the code or write a new ADR if the architecture is changing.

## Consequences

- New features should follow the existing workspace split instead of introducing a new framework or app shell.
- Shared logic should continue to live in `packages/shared` when it is used by both web and API code.
- Test coverage should use the existing Vitest setup.
- Biome remains the project formatter and linter unless a future ADR replaces it.

## Non-goals

- Redesigning the repo structure.
- Introducing a different frontend framework.
- Replacing Fastify, Biome, or Vitest.

## Implementation Plan

- **Affected paths**: `apps/web/`, `apps/api/`, `packages/shared/`, `biome.json`, `vitest.workspace.ts`, `package.json`.
- **Pattern**: keep new code aligned with the existing workspace boundaries and shared-package conventions already in the repo.
- **Tests**: add or update colocated Vitest unit tests for app logic, app-level `integration/` tests for integration behavior, and database tests in `packages/db`.
- **Docs**: keep `README.md`, `CONTEXT.md`, and `docs/adr/` aligned with the implementation.

## Verification

- [ ] `apps/web/package.json` still defines the web app as a Vite-based React workspace.
- [ ] `apps/api/package.json` still defines the API as a Fastify/TypeScript workspace.
- [ ] `packages/shared` remains the shared code location.
- [ ] `biome.json` and `vitest.workspace.ts` remain the active tooling/test entry points.
- [ ] `docs/adr/README.md` links to this ADR.
