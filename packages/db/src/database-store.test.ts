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
});
