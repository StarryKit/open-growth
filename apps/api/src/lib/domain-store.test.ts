import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const tempDirectories: string[] = [];

let projectStore: typeof import("./project-store.js");
let domainStore: typeof import("./domain-store.js");

async function createTempDirectory() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "open-growth-domain-"),
  );
  tempDirectories.push(directory);
  return directory;
}

beforeEach(async () => {
  const directory = await createTempDirectory();
  process.chdir(directory);
  vi.resetModules();
  projectStore = await import("./project-store.js");
  domainStore = await import("./domain-store.js");
  await projectStore.createProject({ name: "Launch Lab" });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("domain store", () => {
  it("creates project-scoped content assets", async () => {
    const asset = await domainStore.createContentAsset({
      filename: "brief.md",
      path: "content/brief.md",
      type: "text",
      size: 42,
      preview: "Launch brief",
    });

    await expect(domainStore.listContentAssets()).resolves.toMatchObject([
      {
        id: asset.id,
        filename: "brief.md",
        status: "ready",
      },
    ]);
  });

  it("publishes content and appends engagement snapshots", async () => {
    const draft = await domainStore.createPublishedContent({
      title: "Launch post",
      body: "We are launching Open Growth.",
      platforms: ["x", "reddit"],
    });

    const published = await domainStore.publishContent(draft.id);

    expect(published?.status).toBe("published");
    expect(published?.platformTargets).toHaveLength(2);

    if (!published) {
      throw new Error("Expected published content.");
    }

    for (const target of published.platformTargets) {
      await domainStore.createEngagementSnapshot(published.id, target.id);
    }

    const overview = await domainStore.getEngagementOverview();
    expect(overview.publishedTargetCount).toBe(2);
    expect(overview.totals.views).toBeGreaterThan(0);
    expect(overview.content[0]?.latestSnapshots).toHaveLength(2);
  });

  it("runs trend queries and creates response drafts", async () => {
    const query = await domainStore.createTrendQuery({
      name: "Competitor mentions",
      keywords: ["open growth", "content operations"],
      platforms: ["hacker-news"],
    });

    const result = await domainStore.runTrendQuery(query.id);
    expect(result?.run.status).toBe("succeeded");
    expect(result?.posts).toHaveLength(3);

    const firstPost = result?.posts[0];
    expect(firstPost).toBeDefined();

    const response = await domainStore.createResponseDraftFromTrendPost(
      firstPost?.id ?? "",
    );

    expect(response?.post.status).toBe("responded");
    expect(response?.draft.sourceTrendPostId).toBe(firstPost?.id);
    await expect(domainStore.listPublishedContent()).resolves.toContainEqual(
      expect.objectContaining({
        id: response?.draft.id,
        status: "draft",
      }),
    );
  });
});
