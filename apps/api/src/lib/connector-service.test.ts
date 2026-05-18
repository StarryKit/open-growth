import { describe, expect, it } from "vitest";
import {
  fetchEngagement,
  getPostDetail,
  getPublishStatus,
  listConnectorCapabilities,
  mergeConnectorConnections,
  publishContentToPlatform,
  searchTrends,
} from "./connector-service.js";

describe("connector service", () => {
  it("normalizes publish and engagement responses", async () => {
    const publishResult = await publishContentToPlatform({
      contentId: "content-1",
      platform: "reddit",
      body: "Launch post",
    });

    expect(publishResult.platformContentId).toBe("reddit-content-1");
    expect(publishResult.platformUrl).toContain("reddit.example.com");

    await expect(fetchEngagement("reddit", 2)).resolves.toMatchObject({
      views: expect.any(Number),
      likes: expect.any(Number),
      clicks: expect.any(Number),
    });

    await expect(
      getPublishStatus("reddit", "reddit-content-1"),
    ).resolves.toMatchObject({
      platformContentId: "reddit-content-1",
      status: "published",
    });
  });

  it("normalizes trend search results", async () => {
    const posts = await searchTrends({
      runId: "run-1",
      query: {
        id: "query-1",
        projectId: "project-1",
        name: "Open Growth",
        keywords: ["open growth"],
        excludedKeywords: [],
        platforms: ["hacker-news"],
        timeRange: "7d",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(posts).toHaveLength(3);
    expect(posts[0]).toMatchObject({
      platform: "hacker-news",
      status: "new",
      matchedKeywords: ["open growth"],
    });

    await expect(
      getPostDetail("hacker-news", "hn-post-1"),
    ).resolves.toMatchObject({
      platform: "hacker-news",
      platformPostId: "hn-post-1",
      status: "new",
    });
  });

  it("exposes platform capabilities and compliance limitations", async () => {
    const capabilities = listConnectorCapabilities();

    expect(capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: "x",
          supportsPublish: true,
          status: "oauth-required",
        }),
        expect.objectContaining({
          platform: "xiaohongshu",
          dataSource: expect.stringContaining("Approved"),
          limitation: expect.stringContaining("No credential injection"),
        }),
        expect.objectContaining({
          platform: "hacker-news",
          supportsPublish: false,
        }),
      ]),
    );

    await expect(
      publishContentToPlatform({
        contentId: "content-1",
        platform: "hacker-news",
        body: "Launch post",
      }),
    ).rejects.toThrow("publishing is not supported");
  });

  it("merges connector account status without exposing secret references", () => {
    const connections = mergeConnectorConnections([
      {
        id: "account-1",
        workspaceId: "workspace-1",
        platform: "x",
        status: "active",
        hasCredentialRef: true,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
    ]);

    expect(connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: "x",
          connectionStatus: "active",
          account: expect.objectContaining({ hasCredentialRef: true }),
        }),
      ]),
    );
  });
});
