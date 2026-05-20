import {
  createDatabaseResponseDraftFromTrendPost,
  deleteDatabaseContentAsset,
  deleteDatabasePublishedContent,
  deleteDatabaseTrendQuery,
  finishDatabaseTrendRun,
  getDatabaseContentAsset,
  insertDatabaseContentAsset,
  insertDatabaseEngagementSnapshot,
  insertDatabaseOutboxEvent,
  insertDatabasePublishedContent,
  insertDatabaseTextContentAsset,
  insertDatabaseTrendQuery,
  insertDatabaseTrendRun,
  isDatabaseStoreEnabled,
  listDatabaseConnectorAccounts,
  listDatabaseContentAssets,
  listDatabaseEngagementSnapshots,
  listDatabaseOutboxEvents,
  listDatabasePublishedContent,
  listDatabaseTrendPosts,
  listDatabaseTrendQueries,
  markDatabasePublishStarted,
  retryDatabasePublishedContent,
  type StoreContext,
  scheduleDatabasePublishedContent,
  setDatabaseWorkspacePublishingIdentityEnabled,
  updateDatabaseContentAsset,
  updateDatabaseContentAssetCurrentPath,
  updateDatabasePublishedContent,
  updateDatabaseTextContentAsset,
  updateDatabaseTrendPost,
  updateDatabaseTrendQuery,
  upsertDatabaseCollectorIdentity,
  upsertDatabaseConnectorAccount,
  upsertDatabasePublishingIdentity,
} from "../../../../packages/db/src/database-store.js";
import type {
  ConnectorAccount,
  ConnectorAdapterBackend,
  ConnectorAuthMode,
  ConnectorOwnerScope,
  ConnectorUseCase,
  ContentAsset,
  EngagementMetrics,
  EngagementOverview,
  EngagementSnapshot,
  GrowthPlatform,
  PlatformPublishTarget,
  PublishedContent,
  TrendPost,
  TrendQuery,
} from "../../../../packages/shared/src/index.js";
import {
  assertConnectorIdentity,
  fetchEngagement,
  mergeConnectorConnections,
  searchTrends,
} from "./connector-service.js";

export type DomainContext = StoreContext;

const emptyMetrics: EngagementMetrics = {
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  bookmarks: 0,
  clicks: 0,
};

function assertDatabaseStoreConfigured() {
  if (!isDatabaseStoreEnabled()) {
    throw new Error("Supabase database storage is not configured.");
  }
}

function assertDatabaseResult<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Supabase database scope is not configured.");
  }

  return value;
}

function now() {
  return new Date().toISOString();
}

function sumMetrics(
  values: Array<Partial<EngagementMetrics>>,
): EngagementMetrics {
  return values.reduce<EngagementMetrics>(
    (acc, value) => ({
      views: acc.views + (value.views ?? 0),
      likes: acc.likes + (value.likes ?? 0),
      comments: acc.comments + (value.comments ?? 0),
      shares: acc.shares + (value.shares ?? 0),
      bookmarks: acc.bookmarks + (value.bookmarks ?? 0),
      clicks: acc.clicks + (value.clicks ?? 0),
    }),
    { ...emptyMetrics },
  );
}

function engagementRate(metrics: EngagementMetrics) {
  const exposure = Math.max(metrics.views, 1);
  return Number(
    ((metrics.likes + metrics.comments + metrics.shares) / exposure).toFixed(4),
  );
}

export async function listContentAssets(
  context?: DomainContext,
  filters?: { kind?: ContentAsset["kind"]; q?: string; tag?: string },
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(
    await listDatabaseContentAssets(context, filters),
  );
}

export async function getContentAsset(
  assetId: string,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return getDatabaseContentAsset(assetId, context);
}

export async function createContentAsset(
  input: {
    filename: string;
    path: string;
    type: ContentAsset["type"];
    kind?: ContentAsset["kind"];
    size: number;
    assetId?: string;
    preview?: string;
    storageBucket?: string;
    mimeType?: string;
    sha256?: string;
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(await insertDatabaseContentAsset(input, context));
}

export async function createTextContentAsset(
  input: {
    title?: string;
    body?: string;
    tags?: string[];
    description?: string;
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(
    await insertDatabaseTextContentAsset(input, context),
  );
}

export async function updateContentAsset(
  assetId: string,
  patch: Partial<
    Pick<
      ContentAsset,
      "title" | "description" | "tags" | "source" | "platforms" | "status"
    >
  >,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return updateDatabaseContentAsset(assetId, patch, context);
}

export async function updateTextContentAsset(
  assetId: string,
  patch: {
    title?: string;
    body?: string;
    tags?: string[];
    description?: string;
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return updateDatabaseTextContentAsset(assetId, patch, context);
}

export async function updateContentAssetCurrentPath(
  assetId: string,
  input: {
    currentStoragePath: string;
    byteSize?: number;
    mimeType?: string;
    editState?: unknown;
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return updateDatabaseContentAssetCurrentPath(assetId, input, context);
}

export async function deleteContentAsset(
  assetId: string,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(
    await deleteDatabaseContentAsset(assetId, context),
  );
}

export async function listPublishedContent(context?: DomainContext) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(await listDatabasePublishedContent(context));
}

export async function createPublishedContent(
  input: {
    title: string;
    body: string;
    assetIds?: string[];
    sourceTrendPostId?: string;
    platforms?: GrowthPlatform[];
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(
    await insertDatabasePublishedContent(input, context),
  );
}

export async function updatePublishedContent(
  contentId: string,
  patch: Partial<
    Pick<
      PublishedContent,
      "title" | "body" | "assetIds" | "sourceTrendPostId" | "status"
    >
  > & {
    platformTargets?: Array<Pick<PlatformPublishTarget, "id" | "bodyOverride">>;
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return updateDatabasePublishedContent(contentId, patch, context);
}

export async function getPublishedContent(
  contentId: string,
  context?: DomainContext,
) {
  const contents = await listPublishedContent(context);
  return contents.find((content) => content.id === contentId) ?? null;
}

export async function deletePublishedContent(
  contentId: string,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(
    await deleteDatabasePublishedContent(contentId, context),
  );
}

export async function schedulePublishedContent(
  contentId: string,
  scheduledAt: string,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return scheduleDatabasePublishedContent(contentId, scheduledAt, context);
}

export async function publishContent(
  contentId: string,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  await assertPublishingIdentitiesForContent(contentId, context);
  return markDatabasePublishStarted(contentId, context);
}

export async function retryPublishedContent(
  contentId: string,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  await assertPublishingIdentitiesForContent(contentId, context);
  return retryDatabasePublishedContent(contentId, context);
}

async function assertPublishingIdentitiesForContent(
  contentId: string,
  context?: DomainContext,
) {
  const content = await getPublishedContent(contentId, context);
  if (!content) {
    throw new Error("Published content not found.");
  }

  const connectorAccounts = await listConnectorAccounts(context);
  for (const target of content.platformTargets) {
    assertConnectorIdentity(connectorAccounts, {
      platform: target.platform,
      identityKind: "publishing",
      useCase: "publish",
      requireWorkspaceEnabled: true,
    });
  }
}

export async function createEngagementSnapshot(
  contentId: string,
  platformTargetId: string,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  const contents = assertDatabaseResult(
    await listDatabasePublishedContent(context),
  );
  const content = contents.find((item) => item.id === contentId);
  const target = content?.platformTargets.find(
    (candidate) => candidate.id === platformTargetId,
  );

  if (!content || !target) {
    return null;
  }

  const snapshotCount =
    assertDatabaseResult(await listDatabaseEngagementSnapshots(context))
      .length + 1;
  const metrics = await fetchEngagement(target.platform, snapshotCount);

  return assertDatabaseResult(
    await insertDatabaseEngagementSnapshot(
      {
        publishedContentId: contentId,
        platformTargetId,
        platform: target.platform,
        platformContentId: target.platformContentId,
        metrics,
        platformMetrics: {
          saves: Math.max(Math.floor(metrics.bookmarks / 2), 1),
        },
        rawPayload: {
          note: "connector engagement payload",
        },
      },
      context,
    ),
  );
}

export async function requestEngagementRefresh(
  input?: { contentId?: string },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(
    await insertDatabaseOutboxEvent(
      {
        eventType: "engagement.refresh",
        aggregateType: input?.contentId ? "published_content" : "project",
        aggregateId: input?.contentId,
        payload: input?.contentId
          ? { publishedContentId: input.contentId }
          : {},
        idempotencyKey: `engagement.refresh:${input?.contentId ?? "project"}:${now()}`,
      },
      context,
    ),
  );
}

export async function listEngagementSnapshots(context?: DomainContext) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(await listDatabaseEngagementSnapshots(context));
}

export async function getEngagementOverview(
  context?: DomainContext,
): Promise<EngagementOverview> {
  const contents = await listPublishedContent(context);
  const snapshots = await listEngagementSnapshots(context);

  const latestSnapshotsByContent = new Map<string, EngagementSnapshot[]>();
  for (const snapshot of snapshots) {
    const list =
      latestSnapshotsByContent.get(snapshot.publishedContentId) ?? [];
    list.push(snapshot);
    latestSnapshotsByContent.set(snapshot.publishedContentId, list);
  }

  const content = contents.map((item) => {
    const contentSnapshots =
      latestSnapshotsByContent
        .get(item.id)
        ?.slice()
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
        .slice(0, 3) ?? [];

    const totalMetrics = sumMetrics(
      contentSnapshots.map((snapshot) => snapshot.metrics),
    );

    return {
      content: item,
      latestSnapshots: contentSnapshots,
      totalMetrics,
      engagementRate: engagementRate(totalMetrics),
    };
  });

  const totals = sumMetrics(content.map((item) => item.totalMetrics));
  const byPlatform = new Map<
    GrowthPlatform,
    {
      platform: GrowthPlatform;
      publishedTargetCount: number;
      metrics: EngagementMetrics;
      engagementRate: number;
    }
  >();

  for (const item of contents) {
    for (const target of item.platformTargets) {
      const current = byPlatform.get(target.platform) ?? {
        platform: target.platform,
        publishedTargetCount: 0,
        metrics: { ...emptyMetrics },
        engagementRate: 0,
      };

      current.publishedTargetCount += 1;
      const targetSnapshots = snapshots.filter(
        (snapshot) => snapshot.platformTargetId === target.id,
      );
      current.metrics = sumMetrics([
        current.metrics,
        ...targetSnapshots.map((snapshot) => snapshot.metrics),
      ]);
      current.engagementRate = engagementRate(current.metrics);
      byPlatform.set(target.platform, current);
    }
  }

  const bestPlatform = [...byPlatform.values()].sort(
    (a, b) => b.engagementRate - a.engagementRate,
  )[0]?.platform;

  return {
    totals,
    publishedTargetCount: contents.reduce(
      (count, item) => count + item.platformTargets.length,
      0,
    ),
    averageEngagementRate: content.length
      ? content.reduce((sum, item) => sum + item.engagementRate, 0) /
        content.length
      : 0,
    bestPlatform,
    byPlatform: [...byPlatform.values()],
    content,
  };
}

export async function createTrendQuery(
  input: {
    name: string;
    keywords: string[];
    excludedKeywords?: string[];
    platforms: GrowthPlatform[];
    language?: string;
    timeRange?: TrendQuery["timeRange"];
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(await insertDatabaseTrendQuery(input, context));
}

export async function updateTrendQuery(
  queryId: string,
  patch: Partial<Omit<TrendQuery, "id" | "projectId" | "createdAt">>,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return updateDatabaseTrendQuery(queryId, patch, context);
}

export async function deleteTrendQuery(
  queryId: string,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(await deleteDatabaseTrendQuery(queryId, context));
}

export async function listTrendQueries(context?: DomainContext) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(await listDatabaseTrendQueries(context));
}

export async function runTrendQuery(queryId: string, context?: DomainContext) {
  const query = (await listTrendQueries(context)).find(
    (candidate) => candidate.id === queryId,
  );

  if (!query) {
    return null;
  }

  const run = await insertDatabaseTrendRun(query, context);
  if (!run) {
    throw new Error("Unable to create Supabase trend run.");
  }

  return { run, posts: [] };
}

export async function executeTrendRunFromOutbox(
  input: { runId: string; queryId: string },
  context?: DomainContext,
) {
  const query = (await listTrendQueries(context)).find(
    (candidate) => candidate.id === input.queryId,
  );

  if (!query) {
    return null;
  }

  const connectorAccounts = await listConnectorAccounts(context);
  for (const platform of query.platforms) {
    if (platform === "hacker-news") {
      continue;
    }

    assertConnectorIdentity(connectorAccounts, {
      platform,
      identityKind: "collector",
      useCase: "trends",
    });
  }

  const posts = (await searchTrends({ query, runId: input.runId })).map(
    (post) => ({
      ...post,
      projectId: query.projectId,
      queryId: query.id,
      runId: input.runId,
    }),
  );
  const uniqueByUrl = new Map<string, TrendPost>();
  for (const post of posts) {
    if (!uniqueByUrl.has(post.url)) {
      uniqueByUrl.set(post.url, post);
    }
  }
  const orderedPosts = [...uniqueByUrl.values()].sort(
    (a, b) =>
      b.relevanceScore - a.relevanceScore ||
      b.postedAt.localeCompare(a.postedAt),
  );

  return assertDatabaseResult(
    await finishDatabaseTrendRun(input.runId, orderedPosts, [], context),
  );
}

export async function listTrendPosts(context?: DomainContext) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(await listDatabaseTrendPosts(context));
}

export async function updateTrendPost(
  postId: string,
  patch: Partial<
    Pick<TrendPost, "status" | "summary" | "title" | "matchedKeywords">
  >,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return updateDatabaseTrendPost(postId, patch, context);
}

export async function createResponseDraftFromTrendPost(
  postId: string,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return createDatabaseResponseDraftFromTrendPost(postId, context);
}

export async function getWorkspaceSummary(context?: DomainContext) {
  const [assets, contents, queries, posts, overview, connectors] =
    await Promise.all([
      listContentAssets(context),
      listPublishedContent(context),
      listTrendQueries(context),
      listTrendPosts(context),
      getEngagementOverview(context),
      listConnectorConnections(context),
    ]);

  return {
    assets,
    contents,
    queries,
    posts,
    overview,
    connectors,
    activeProjectId: context?.activeProjectId ?? null,
  };
}

export async function listConnectorConnections(context?: DomainContext) {
  return mergeConnectorConnections(await listConnectorAccounts(context));
}

export async function listConnectorAccounts(context?: DomainContext) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(await listDatabaseConnectorAccounts(context));
}

export async function upsertConnectorAccount(
  input: {
    platform: GrowthPlatform;
    credentialRef: string;
    status?: ConnectorAccount["status"];
    expiresAt?: string;
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(
    await upsertDatabaseConnectorAccount(input, context),
  );
}

export async function upsertPublishingIdentity(
  input: {
    platform: GrowthPlatform;
    credentialRef?: string;
    displayName?: string;
    platformAccountId?: string;
    authMode?: ConnectorAuthMode;
    useCases?: ConnectorUseCase[];
    status?: ConnectorAccount["status"];
    expiresAt?: string;
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(
    await upsertDatabasePublishingIdentity(input, context),
  );
}

export async function setWorkspacePublishingIdentityEnabled(
  connectorAccountId: string,
  enabled: boolean,
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(
    await setDatabaseWorkspacePublishingIdentityEnabled(
      connectorAccountId,
      enabled,
      context,
    ),
  );
}

export async function upsertCollectorIdentity(
  input: {
    platform: GrowthPlatform;
    credentialRef?: string;
    displayName?: string;
    authMode?: ConnectorAuthMode;
    useCases?: ConnectorUseCase[];
    ownerScope?: ConnectorOwnerScope;
    adapterBackend?: ConnectorAdapterBackend;
    status?: ConnectorAccount["status"];
    expiresAt?: string;
    lastVerifiedAt?: string;
    lastError?: string | null;
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(
    await upsertDatabaseCollectorIdentity(input, context),
  );
}

export async function testCollectorIdentity(
  input: {
    platform: GrowthPlatform;
    credentialRef?: string;
    displayName?: string;
    authMode?: ConnectorAuthMode;
    useCases?: ConnectorUseCase[];
    ownerScope?: ConnectorOwnerScope;
    adapterBackend?: ConnectorAdapterBackend;
  },
  context?: DomainContext,
) {
  const now = new Date().toISOString();
  return upsertCollectorIdentity(
    {
      ...input,
      status:
        input.authMode === "public" || input.credentialRef
          ? "active"
          : "needs-attention",
      lastVerifiedAt: now,
      lastError:
        input.authMode === "public" || input.credentialRef
          ? null
          : "Credential reference is required for this collector mode.",
    },
    context,
  );
}

export async function enqueueOutboxEvent(
  input: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    availableAt?: string;
  },
  context?: DomainContext,
) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(await insertDatabaseOutboxEvent(input, context));
}

export async function listOutboxEvents(context?: DomainContext) {
  assertDatabaseStoreConfigured();
  return assertDatabaseResult(await listDatabaseOutboxEvents(context));
}
