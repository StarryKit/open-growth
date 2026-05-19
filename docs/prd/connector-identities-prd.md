# Connector Identities PRD

Date: 2026-05-19

## Problem Statement

Open Growth needs two different platform identity workflows, but the current connector surface does not distinguish them clearly enough.

Users need to connect their own platform accounts so Open Growth can publish posts and replies as that user. This is a user-consent workflow and should feel like "click a platform logo, authorize, then publish as me."

Open Growth also needs platform access for Trends and data collection. This should not default to user publishing accounts. Data collection should use platform official accounts, approved API credentials, public adapters, vendor credentials, or controlled OpenCLI browser profiles configured by approved Open Growth admins.

The product needs a connector configuration experience that makes this separation obvious, safe, and testable.

## Solution

Create a Connector Identities product surface with two identity types:

1. Publishing identity
   - User-bound.
   - Configured by the signed-in user.
   - Used for publishing posts, replying to posts, and reading status or engagement for content that user published when required by the platform.
   - Configured through platform OAuth or another platform-approved user authorization flow.
   - Stored against the user's Open Growth identity, not against a single Workspace.
   - Made available to Workspaces only when that Workspace explicitly enables one or more of the user's connected identities.

2. Collector identity
   - Admin-controlled.
   - Configured only by designated Open Growth admins.
   - Used for Trends, broad read workflows, public content collection, and platform search.
   - Configured through official platform API credentials, public adapter selection, vendor data credentials, or controlled OpenCLI browser profile references.

The UI should make publishing identity setup feel lightweight and user-facing, while collector identity setup should live in a guarded admin panel.

## Collector Identity Admin Panel

A Collector identity is configured from an admin-only "Collector identities" page. The page is reachable from the app sidebar only when the signed-in user is a designated Open Growth admin.

Non-admin users must not see the sidebar entry, must not be able to open the page by URL, and must not be able to call Collector identity APIs successfully. The backend must enforce admin authorization independently from frontend visibility.

Admin access rules:

- Admin status is evaluated from a server-trusted environment variable allowlist.
- The backend reads admin user identifiers from an environment variable such as `OPEN_GROWTH_ADMIN_USER_IDS`.
- Admin identifiers should match stable Supabase Auth user IDs, not emails, display names, or client-provided fields.
- Frontend navigation hides the sidebar entry for non-admin users.
- API routes for listing, creating, updating, testing, disabling, or deleting Collector identities require admin authorization.
- Failed admin checks return a clear forbidden response and do not reveal whether specific credentials or Collector identities exist.

The configuration flow is:

1. Choose platform
   - Show all supported platforms in a platform grid.
   - Each platform tile shows logo, platform name, supported collector use cases, current collector status, and whether public access is available.

2. Choose collector mode
   - `public`: no secret required; used for platforms like Hacker News where public API access is enough.
   - `official_api`: uses platform official API credentials or official account credentials.
   - `vendor`: uses an external data provider credential.
   - `browser_profile`: uses a controlled OpenCLI profile or browser automation profile managed by the backend worker.
   - `disabled`: platform is intentionally unavailable for collection in this workspace.

3. Enter credential reference
   - The UI never asks for raw passwords, raw cookies, raw OAuth tokens, or browser session dumps.
   - The UI accepts a secret reference, such as `secret://platform/x-collector-prod`, or lets a deployment-specific secret picker provide one.
   - Public collectors do not require a credential reference.

4. Select use cases
   - Available values: Trends search, read post detail, read comments, read public metrics, download public media where allowed.
   - The UI prevents selecting unsupported use cases for the chosen platform and mode.

5. Configure operational controls
   - Rate limit policy.
   - Maximum results per run.
   - Default language or region, when relevant.
   - Compliance note visible to workspace admins.
   - Adapter backend: official API, custom API adapter, OpenCLI, vendor, or public API.

6. Test connection
   - User clicks "Test collector".
   - Backend validates the secret reference is resolvable, the adapter can authenticate, and a minimal read command can complete.
   - Test result shows status, checked time, adapter backend, supported use cases, and a safe error message when failed.

7. Save identity
   - Saving creates or updates a Collector identity with `identity_kind = collector`.
   - Saved Collector identities are available for Trends runs.
   - Secret values remain server-side and never return to the frontend.

Collector identity status states:

- `not_configured`: no collector identity exists for this platform.
- `public_available`: collection can run through public access without credentials.
- `active`: configured and last test passed.
- `needs_attention`: configured but last test failed or credentials are incomplete.
- `disabled`: intentionally disabled for the workspace.
- `unsupported`: platform has no supported collector mode yet.

## Publishing Identity UI And Interaction

Publishing identity setup should be available on the connector configuration page in a "Publishing access" section.

The primary interaction is a platform logo grid:

- Show every supported platform as a logo tile.
- Each tile includes logo, platform name, connection status, and supported publishing actions.
- Tile status should be visually scannable: not connected, connected, expired, needs reauth, unsupported, or coming soon.
- Clicking a platform tile opens the platform-specific publishing identity flow.

Publishing identity flow:

1. User clicks platform logo.
2. If platform supports publishing through OAuth, show a compact authorization panel with:
   - platform name and logo
   - requested capabilities, such as publish posts, reply, read own post status, read own engagement
   - the user's Open Growth identity that will own this platform authorization
   - connect button
3. User clicks "Connect".
4. Frontend starts the platform OAuth flow or official authorization flow.
5. OAuth callback returns to Open Growth and creates a Publishing identity bound to:
   - user
   - platform
   - granted scopes
   - expiration time, when provided
6. The platform tile updates to connected state.
7. The Publishing identity becomes part of the user's connected identities.
8. A Workspace can select one or more of the user's connected Publishing identities to enable for Publish and reply workflows in that Workspace.

## Workspace Publishing Identity Enablement

Publishing identities are user-level assets. A user connects a platform account once, and that authorization belongs to the user's Open Growth identity.

Each Workspace controls which connected Publishing identities are enabled for that Workspace:

- A Workspace can enable one or more Publishing identities already connected by its users.
- A Workspace can enable multiple identities for the same platform when multiple users have connected accounts.
- A Workspace can disable a Publishing identity without deleting the user's underlying platform authorization.
- Publish and reply workflows must use only identities enabled for the active Workspace.
- When creating or sending Published content, the user must choose an enabled Publishing identity when more than one eligible identity exists for the selected platform.
- If only one eligible identity exists for a platform in the Workspace, the product may select it by default while still showing which identity will be used.
- If no eligible identity is enabled for a platform, Publish and reply actions for that platform show a configuration error and link to the Publishing access setup flow.

Reauthorization flow:

- If a Publishing identity is expired or revoked, the platform tile shows "Needs reauth".
- Clicking the tile opens the same authorization panel with a reauthorize action.
- Reauthorization replaces or refreshes the existing credential reference without exposing the old secret.

Disconnect flow:

- User can disconnect their own Publishing identity.
- Disconnecting removes that identity from every Workspace where it was enabled and prevents future publish and reply actions through that identity.
- Historical Published content, platform URLs, and Engagement snapshots remain visible.
- Pending outbox events for that identity should fail safely with a configuration error rather than switching to a Collector identity.

Unsupported platform flow:

- If a platform supports Trends collection but not publishing, the tile remains visible but disabled for Publishing access.
- The disabled tile explains that publishing is unavailable for that platform.
- The platform may still be configurable under Collector access if collection is supported.

## User Stories

1. As a user, I want to see all supported platform logos in one connector page, so that I can quickly understand what I can connect.
2. As a user, I want to click the X logo and authorize my account, so that Open Growth can publish posts as me on X.
3. As a user, I want to click the Reddit logo and authorize my account, so that Open Growth can publish posts or replies as me on Reddit.
4. As a user, I want a platform tile to show whether my account is connected, so that I know if publishing is ready.
5. As a user, I want expired platform authorization to show as needing reauthorization, so that I can fix it before publishing fails.
6. As a user, I want to disconnect a publishing account, so that Open Growth can no longer publish as me on that platform.
7. As a user, I want the publishing authorization panel to list requested capabilities, so that I understand what permissions I am granting.
8. As a user, I want unsupported publishing platforms to remain visible but disabled, so that I understand the platform roadmap without guessing.
9. As a user, I want publish actions to fail with a clear message if I have not connected the required platform, so that I know what to configure.
10. As a user, I want reply actions to require my own identity, so that replies are never sent through a collector account.
11. As a user, I want my Publishing identity to belong to my Open Growth user account rather than one Workspace, so that I can reuse it where permitted.
12. As a workspace member, I want a Workspace to enable one or more user-connected Publishing identities, so that the team can choose which account publishes each post.
13. As a workspace member, I want to see which Publishing identity will be used before publishing, so that posts are not sent from the wrong account.
14. As an admin, I want a sidebar entry for Collector identities only when I am allowed to manage collection access, so that operational settings stay out of the normal user workflow.
15. As an admin, I want to configure Collector identities separately from user Publishing identities, so that Trends collection does not depend on user accounts.
16. As an admin, I want to select a collector mode per platform, so that I can choose public API, official API, vendor, or controlled browser profile access.
17. As an admin, I want to store only secret references in Open Growth, so that raw platform credentials are not exposed in the app.
18. As an admin, I want to test a Collector identity before saving it, so that I know Trends runs will work.
19. As an admin, I want to see which collector use cases are supported by a platform, so that I do not configure impossible workflows.
20. As an admin, I want to disable collection for a platform, so that the deployment avoids unsupported or non-compliant collection.
21. As a non-admin user, I do not want to see Collector identity configuration in the sidebar, so that I only see settings I am allowed to use.
22. As a non-admin user, I want Collector identity APIs to reject my requests, so that frontend visibility is not the only protection.
23. As a deployment operator, I want system-level Collector identities to be available to Trends workflows, so that data collection can use centrally managed official accounts.
24. As a deployment operator, I want OpenCLI browser profile usage to be explicit, so that browser automation is not confused with OAuth identity.
25. As a growth operator, I want Trends runs to use Collector identities, so that user publishing accounts are not consumed for broad data gathering.
26. As a growth operator, I want a Trends run to show which platforms failed because collector access was missing, so that an admin can fix connector configuration.
27. As a maintainer, I want connector capability metadata to describe identity type, auth mode, and use cases, so that future platform adapters are implemented consistently.
28. As a maintainer, I want frontend responses to hide secrets, so that platform credentials are never leaked through API responses.
29. As a maintainer, I want tests for admin access, publishing identity enablement, and collector identity resolution, so that future changes do not accidentally mix the identity types.

## Implementation Decisions

- Follow ADR-0003: Publishing identity and Collector identity are separate domain concepts.
- The connector page should contain the user-facing Publishing access flow.
- Collector access should live in a sidebar-linked admin panel visible only to designated admins.
- Publishing access is user-facing and starts from a platform logo grid.
- Publishing identities are bound to users, not Workspaces.
- Workspaces enable one or more already-connected Publishing identities for Publish and reply workflows.
- Collector identity APIs must be protected by backend admin authorization.
- Collector identity UI visibility must be driven by the same server-trusted env-based admin status used by the API.
- The environment configuration must include an admin allowlist variable for Collector identity management.
- Connector capability metadata must include supported use cases and supported auth modes per platform.
- Connector identity records must support user-owned Publishing identities independently from Workspace or system Collector identities.
- Workspace-level enablement records must support multiple enabled Publishing identities per Workspace and platform.
- Secret values must never be stored as raw values in Postgres and must never be returned to the frontend.
- Publishing and reply outbox events must resolve only Publishing identities.
- Publishing and reply outbox events must resolve a Publishing identity that is enabled for the active Workspace.
- Trends outbox events must resolve Collector identities or public adapters.
- Engagement reads may use Publishing identity only for user-owned published content when required by the platform.
- OpenCLI must be represented as an adapter backend selected by connector configuration, not as the product identity system.
- Collector identity testing is part of the configuration flow and should persist a last-checked status.
- Platform tiles should remain visible even when a capability is unsupported, but unsupported actions must be disabled.

## Testing Decisions

- Tests should assert user-visible behavior and identity resolution outcomes, not private implementation details.
- Connector service tests should cover platform capability metadata, supported auth modes, and use case filtering.
- Database tests should cover storing user-owned Publishing identities, admin-managed Collector identities, and Workspace-level Publishing identity enablement.
- API tests should verify that connector status responses separate Publishing access from Collector access and hide credential values.
- API tests should verify non-admin users cannot list, create, update, test, disable, or delete Collector identities.
- API tests should verify Workspace publish configuration can enable one or more user-owned Publishing identities without copying credentials into the Workspace.
- Outbox worker tests should verify publish and reply events never resolve Collector identities.
- Outbox worker tests should verify publish and reply events use only Publishing identities enabled for the active Workspace.
- Outbox worker tests should verify Trends events use Collector identities or public adapters and report missing collector configuration.
- Frontend page tests should verify the Publishing identity platform logo grid, status rendering, disabled unsupported states, connect actions, and Workspace identity selection.
- Frontend page tests should verify the admin sidebar entry appears only for admin users and Collector identity screens are unavailable to non-admin users.
- Existing connector page tests and outbox worker tests are the closest prior art.

## Out of Scope

- Building every platform adapter in this PRD.
- Implementing a connector marketplace.
- Letting users paste raw passwords, cookies, or browser session dumps.
- Using user Publishing identities as default Trends collectors.
- Automatically creating Collector identities from user OAuth authorization.
- Binding Publishing identities directly to a single Workspace.
- Showing Collector identity configuration to non-admin users.
- Guaranteeing that every platform supports publishing, reply, engagement, and Trends.

## Further Notes

Collector identity setup should be documented in operator-facing setup docs once implementation begins. For local development, public Collector identities and mock secret references are acceptable, but the runtime shape must match production: explicit identity kind, auth mode, use cases, status, and safe credential references.

The first practical rollout can start with:

1. Hacker News collection through public access.
2. X and Reddit Publishing identity through OAuth or mocked OAuth-compatible status.
3. X, Reddit, Xiaohongshu, and WeChat Collector identity records backed by safe secret references, even before every adapter is fully implemented.
4. OpenCLI collector mode hidden behind backend adapter configuration, not exposed as raw browser session management to normal users.
