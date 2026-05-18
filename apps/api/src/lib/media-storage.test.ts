import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const tempDirectories: string[] = [];

let mediaStorage: typeof import("./media-storage.js");

async function createTempDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "open-growth-media-"));
  tempDirectories.push(directory);
  return directory;
}

beforeEach(async () => {
  const directory = await createTempDirectory();
  process.chdir(directory);
  vi.resetModules();
  mediaStorage = await import("./media-storage.js");
});

afterEach(async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_STORAGE_BUCKET;
  process.chdir(originalCwd);
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("media storage", () => {
  it("saves local media objects with text previews when Supabase is not configured", async () => {
    const stored = await mediaStorage.saveMediaObject({
      originalFilename: "brief.md",
      buffer: Buffer.from("line one\nline two"),
      type: "text",
    });

    expect(stored).toMatchObject({
      filename: "brief.md",
      path: "content/brief.md",
      preview: "line one\nline two",
    });
    await expect(
      readFile(path.join(process.cwd(), "content", "brief.md"), "utf8"),
    ).resolves.toBe("line one\nline two");
  });

  it("uses workspace/project/asset paths for Supabase uploads", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    vi.resetModules();

    const upload = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        storage: {
          from: vi.fn(() => ({ upload })),
        },
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

          if (table === "content_assets") {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "asset-1",
                  workspace_id: "workspace-1",
                  project_id: "project-1",
                  original_filename: "Launch-Plan.md",
                  storage_bucket: "content-assets",
                },
                error: null,
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        rpc: vi.fn().mockResolvedValue({
          data: {
            assetId: "asset-1",
            workspaceId: "workspace-1",
            projectId: "project-1",
            filename: "Launch-Plan.md",
            storageBucket: "content-assets",
            storagePath: "workspace-1/project-1/asset-1/Launch-Plan.md",
          },
          error: null,
        }),
      }),
    }));

    mediaStorage = await import("./media-storage.js");
    const stored = await mediaStorage.saveMediaObject({
      originalFilename: "Launch Plan.md",
      buffer: Buffer.from("plan"),
      type: "text",
      mimeType: "text/markdown",
      context: { userId: "user-1", activeProjectId: "project-1" },
    });

    expect(stored).toMatchObject({
      assetId: "asset-1",
      path: "workspace-1/project-1/asset-1/Launch-Plan.md",
    });
    expect(upload).toHaveBeenCalledWith(
      "workspace-1/project-1/asset-1/Launch-Plan.md",
      Buffer.from("plan"),
      expect.objectContaining({ contentType: "text/markdown" }),
    );
  });
});
