import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("database store", () => {
  it("stays disabled when Supabase service configuration is absent", async () => {
    const {
      getDefaultScope,
      isDatabaseStoreEnabled,
      listDatabaseContentAssets,
      listDatabaseProjects,
    } = await import("./database-store.js");

    expect(isDatabaseStoreEnabled()).toBe(false);
    await expect(getDefaultScope()).resolves.toBeNull();
    await expect(listDatabaseProjects()).resolves.toBeNull();
    await expect(listDatabaseContentAssets()).resolves.toBeNull();
  });

  it("creates published content through the transactional Supabase RPC", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    const rpc = vi.fn().mockResolvedValue({
      data: {
        content: {
          id: "published-1",
          project_id: "project-1",
          title: "Launch",
          body: "Body",
          asset_ids: [],
          source_trend_post_id: null,
          status: "draft",
          created_at: "2026-05-17T00:00:00.000Z",
          updated_at: "2026-05-17T00:00:00.000Z",
        },
        targets: [
          {
            id: "target-1",
            published_content_id: "published-1",
            platform: "x",
            status: "draft",
            body_override: "Body",
            scheduled_at: null,
            published_at: null,
            platform_content_id: null,
            platform_url: null,
            last_error: null,
            retry_count: 0,
            updated_at: "2026-05-17T00:00:00.000Z",
          },
        ],
      },
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "workspace_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { workspace_id: "workspace-1" },
            error: null,
          }),
        };
      }

      if (table === "projects") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "project-1" },
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        from,
        rpc,
      }),
    }));

    const { insertDatabasePublishedContent } = await import(
      "./database-store.js"
    );
    const content = await insertDatabasePublishedContent(
      {
        title: "Launch",
        body: "Body",
        platforms: ["x"],
      },
      { userId: "user-1", activeProjectId: "project-1" },
    );

    expect(rpc).toHaveBeenCalledWith("create_published_content_with_targets", {
      p_workspace_id: "workspace-1",
      p_project_id: "project-1",
      p_user_id: "user-1",
      p_title: "Launch",
      p_body: "Body",
      p_asset_ids: [],
      p_source_trend_post_id: null,
      p_platforms: ["x"],
    });
    expect(content).toMatchObject({
      id: "published-1",
      platformTargets: [{ id: "target-1", platform: "x" }],
    });
  });

  it("creates text content assets with Markdown metadata", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    const insertedTextRows: unknown[] = [];
    const from = vi.fn((table: string) => {
      if (table === "workspace_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { workspace_id: "workspace-1" },
            error: null,
          }),
        };
      }

      if (table === "projects") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "project-1" },
            error: null,
          }),
        };
      }

      if (table === "content_assets") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "asset-1",
                  workspace_id: "workspace-1",
                  project_id: "project-1",
                  kind: "text",
                  original_filename: "Launch copy.md",
                  storage_bucket: null,
                  storage_path: null,
                  current_storage_path: null,
                  mime_type: null,
                  byte_size: null,
                  sha256: null,
                  created_at: "2026-05-19T00:00:00.000Z",
                  updated_at: "2026-05-19T00:00:00.000Z",
                  preview: "Hello launch",
                  title: "Launch copy",
                  description: null,
                  tags: ["launch"],
                  source: "repository",
                  platforms: [],
                  status: "ready",
                  usage_count: 0,
                },
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === "content_asset_texts") {
        return {
          insert: vi.fn((row) => {
            insertedTextRows.push(row);
            return Promise.resolve({ error: null });
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({ from }),
    }));

    const { insertDatabaseTextContentAsset } = await import(
      "./database-store.js"
    );
    const asset = await insertDatabaseTextContentAsset(
      {
        title: "Launch copy",
        body: "Hello launch",
        tags: ["launch"],
      },
      { userId: "user-1", activeProjectId: "project-1" },
    );

    expect(insertedTextRows).toEqual([
      expect.objectContaining({
        asset_id: "asset-1",
        body_markdown: "Hello launch",
        body_preview: "Hello launch",
        character_count: 12,
      }),
    ]);
    expect(asset).toMatchObject({
      id: "asset-1",
      kind: "text",
      body: "Hello launch",
      characterCount: 12,
    });
  });

  it("enqueues automatic engagement refresh events for stale published targets", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "workspace_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { workspace_id: "workspace-1" },
            error: null,
          }),
        };
      }

      if (table === "projects") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "project-1" },
            error: null,
          }),
        };
      }

      if (table === "platform_publish_targets") {
        const targetQuery = {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "target-1",
                workspace_id: "workspace-1",
                project_id: "project-1",
                published_content_id: "published-1",
                published_at: "2026-05-17T00:00:00.000Z",
              },
            ],
            error: null,
          }),
        };
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue(targetQuery),
        };
      }

      if (table === "engagement_snapshots") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }

      if (table === "outbox_events") {
        return { upsert };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        from,
      }),
    }));

    const { enqueueDueDatabaseEngagementRefreshEvents } = await import(
      "./database-store.js"
    );

    await expect(
      enqueueDueDatabaseEngagementRefreshEvents(
        { userId: "user-1", activeProjectId: "project-1" },
        new Date("2026-05-17T02:00:00.000Z"),
      ),
    ).resolves.toEqual({ enqueued: 1 });
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          event_type: "engagement.refresh",
          aggregate_id: "published-1",
          idempotency_key:
            "engagement.refresh:auto:target-1:2026-05-17T02:00:00.000Z",
        }),
      ],
      { ignoreDuplicates: true, onConflict: "idempotency_key" },
    );
  });

  it("stores user publishing identities and workspace enablement separately", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    const insertedRows: unknown[] = [];
    const enabledRows: unknown[] = [];
    const connectorSingle = {
      data: {
        id: "connector-1",
        workspace_id: null,
        user_id: "user-1",
        platform: "x",
        identity_kind: "publishing",
        auth_mode: "oauth",
        use_cases: ["publish", "reply", "engagement"],
        owner_scope: "user",
        status: "active",
        credential_ref: "oauth://x/user-1",
        display_name: "X founder",
        platform_account_id: null,
        adapter_backend: "official_api",
        expires_at: null,
        last_verified_at: null,
        last_error: null,
        created_at: "2026-05-19T00:00:00.000Z",
        updated_at: "2026-05-19T00:00:00.000Z",
      },
      error: null,
    };
    const from = vi.fn((table: string) => {
      if (table === "workspace_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { workspace_id: "workspace-1" },
            error: null,
          }),
        };
      }

      if (table === "projects") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "project-1" },
            error: null,
          }),
        };
      }

      if (table === "connector_accounts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
          insert: vi.fn((row) => {
            insertedRows.push(row);
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue(connectorSingle),
              })),
            };
          }),
        };
      }

      if (table === "workspace_connector_accounts") {
        return {
          upsert: vi.fn((row) => {
            enabledRows.push(row);
            return Promise.resolve({ error: null });
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        from,
      }),
    }));

    const {
      setDatabaseWorkspacePublishingIdentityEnabled,
      upsertDatabasePublishingIdentity,
    } = await import("./database-store.js");

    const account = await upsertDatabasePublishingIdentity(
      {
        platform: "x",
        credentialRef: "oauth://x/user-1",
        displayName: "X founder",
      },
      { userId: "user-1", activeProjectId: "project-1" },
    );
    const enabled = await setDatabaseWorkspacePublishingIdentityEnabled(
      "connector-1",
      true,
      { userId: "user-1", activeProjectId: "project-1" },
    );

    expect(insertedRows).toEqual([
      expect.objectContaining({
        workspace_id: null,
        user_id: "user-1",
        identity_kind: "publishing",
      }),
    ]);
    expect(account).toMatchObject({
      id: "connector-1",
      identityKind: "publishing",
      enabledForWorkspace: false,
    });
    expect(enabledRows).toEqual([
      expect.objectContaining({
        workspace_id: "workspace-1",
        connector_account_id: "connector-1",
      }),
    ]);
    expect(enabled).toEqual({
      connectorAccountId: "connector-1",
      enabled: true,
    });
  });

  it("reads and writes deployment settings through the Supabase RPC contract", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    const rpc = vi.fn((name: string) => {
      if (name === "get_deployment_settings") {
        return Promise.resolve({
          data: [
            {
              public_base_url: "https://app.example.com",
              redirect_base_url: "https://api.example.com",
              updated_at: "2026-05-19T00:00:00.000Z",
            },
          ],
          error: null,
        });
      }

      if (name === "upsert_deployment_settings") {
        return Promise.resolve({
          data: [
            {
              public_base_url: "https://app.example.com",
              redirect_base_url: "https://api.example.com",
              updated_at: "2026-05-19T00:00:00.000Z",
            },
          ],
          error: null,
        });
      }

      throw new Error(`Unexpected rpc ${name}`);
    });
    const from = vi.fn((table: string) => {
      if (table === "workspace_members") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { workspace_id: "workspace-1" },
            error: null,
          }),
        };
      }

      if (table === "projects") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "project-1" },
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        from,
        rpc,
      }),
    }));

    const { getDatabaseDeploymentSettings, upsertDatabaseDeploymentSettings } =
      await import("./database-store.js");

    await expect(getDatabaseDeploymentSettings()).resolves.toMatchObject({
      publicBaseUrl: "https://app.example.com",
      redirectBaseUrl: "https://api.example.com",
    });
    await expect(
      upsertDatabaseDeploymentSettings(
        {
          publicBaseUrl: "https://app.example.com",
          redirectBaseUrl: "https://api.example.com",
        },
        { userId: "user-1", activeProjectId: "project-1" },
      ),
    ).resolves.toMatchObject({
      publicBaseUrl: "https://app.example.com",
      redirectBaseUrl: "https://api.example.com",
    });

    expect(rpc).toHaveBeenCalledWith("get_deployment_settings");
    expect(rpc).toHaveBeenCalledWith("upsert_deployment_settings", {
      p_public_base_url: "https://app.example.com",
      p_redirect_base_url: "https://api.example.com",
      p_user_id: "user-1",
    });
  });
});
