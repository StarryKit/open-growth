import { describe, expect, it } from "vitest";
import type { ConnectorAccount } from "../../../../packages/shared/src/index.js";
import {
  assertConnectorIdentity,
  fetchEngagement,
  getPostDetail,
  getPublishStatus,
  listConnectorCapabilities,
  mergeConnectorConnections,
  publishContentToPlatform,
  resolveConnectorIdentity,
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
          supportedUseCases: expect.arrayContaining(["publish", "trends"]),
          supportedAuthModes: expect.arrayContaining(["oauth"]),
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
        workspaceId: null,
        userId: "user-1",
        platform: "x",
        identityKind: "publishing",
        authMode: "oauth",
        useCases: ["publish", "reply", "engagement"],
        ownerScope: "user",
        status: "active",
        hasCredentialRef: true,
        enabledForWorkspace: true,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      {
        id: "collector-1",
        workspaceId: "workspace-1",
        userId: null,
        platform: "x",
        identityKind: "collector",
        authMode: "api_key",
        useCases: ["trends", "read"],
        ownerScope: "workspace",
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
          publishingStatus: "active",
          collectorStatus: "active",
          enabledPublishingIdentities: [
            expect.objectContaining({ hasCredentialRef: true }),
          ],
        }),
      ]),
    );
  });

  it("resolves identities by use case and workspace enablement", () => {
    const identities: ConnectorAccount[] = [
      {
        id: "publishing-1",
        workspaceId: null,
        userId: "user-1",
        platform: "reddit",
        identityKind: "publishing" as const,
        authMode: "oauth" as const,
        useCases: ["publish" as const, "reply" as const],
        ownerScope: "user" as const,
        status: "active" as const,
        hasCredentialRef: true,
        enabledForWorkspace: true,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      {
        id: "collector-1",
        workspaceId: "workspace-1",
        userId: null,
        platform: "reddit",
        identityKind: "collector" as const,
        authMode: "api_key" as const,
        useCases: ["trends" as const, "read" as const],
        ownerScope: "workspace" as const,
        status: "active" as const,
        hasCredentialRef: true,
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
    ];

    expect(
      resolveConnectorIdentity(identities, {
        platform: "reddit",
        identityKind: "publishing",
        useCase: "publish",
        requireWorkspaceEnabled: true,
      }),
    ).toMatchObject({ id: "publishing-1" });

    expect(
      resolveConnectorIdentity(identities, {
        platform: "reddit",
        identityKind: "collector",
        useCase: "trends",
      }),
    ).toMatchObject({ id: "collector-1" });

    expect(() =>
      assertConnectorIdentity(identities, {
        platform: "reddit",
        identityKind: "publishing",
        useCase: "trends",
      }),
    ).toThrow("Missing enabled Publishing identity");
  });
});

it("flags platforms that still need OAuth configuration", () => {
  expect(
    listConnectorCapabilities().find((item) => item.platform === "x"),
  ).toMatchObject({
    status: "oauth-required",
    supportedUseCases: expect.arrayContaining(["publish", "reply"]),
  });
});
