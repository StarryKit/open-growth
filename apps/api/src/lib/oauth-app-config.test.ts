import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("oauth app config", () => {
  it("stores and reads admin-managed OAuth app settings from Supabase", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    const rpc = vi.fn((name: string) => {
      if (name === "upsert_oauth_app_config") {
        return Promise.resolve({
          data: [
            {
              platform: "x",
              client_id: "x-client",
              has_client_secret: true,
              updated_at: "2026-05-19T00:00:00.000Z",
              client_secret: "x-secret",
            },
          ],
          error: null,
        });
      }

      if (name === "get_oauth_app_config") {
        return Promise.resolve({
          data: [
            {
              platform: "x",
              client_id: "x-client",
              has_client_secret: true,
              updated_at: "2026-05-19T00:00:00.000Z",
              client_secret: "x-secret",
            },
          ],
          error: null,
        });
      }

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

      throw new Error(`Unexpected rpc ${name}`);
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        rpc,
        from: vi.fn((table: string) => {
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
        }),
      }),
    }));

    const { getOAuthAppConfig, saveOAuthAppConfig } = await import(
      "./oauth-app-config.js"
    );

    await saveOAuthAppConfig({
      platform: "x",
      clientId: "x-client",
      clientSecret: "x-secret",
      context: { userId: "user-1", activeProjectId: "project-1" },
    });

    await expect(getOAuthAppConfig("x")).resolves.toMatchObject({
      platform: "x",
      clientId: "x-client",
      hasClientSecret: true,
      publicBaseUrl: "https://app.example.com",
      redirectUri: "https://api.example.com/api/connectors/oauth/x/callback",
    });
  });
});
