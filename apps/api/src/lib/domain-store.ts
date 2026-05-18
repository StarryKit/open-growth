import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  ConnectorAccount,
  ContentAsset,
  EngagementMetrics,
  EngagementOverview,
  EngagementSnapshot,
  GrowthPlatform,
  PlatformPublishTarget,
  PublishedContent,
  TrendPost,
  TrendQuery,
  TrendRun,
} from "../../../../packages/shared/src/index.js";
import {
  fetchEngagement,
  mergeConnectorConnections,
  publishContentToPlatform,
  searchTrends,
} from "./connector-service.js";
import {
  createDatabaseResponseDraftFromTrendPost,
  deleteDatabaseContentAsset,
  deleteDatabasePublishedContent,
  deleteDatabaseTrendQuery,
  finishDatabaseTrendRun,
  insertDatabaseContentAsset,
  insertDatabaseEngagementSnapshot,
  insertDatabaseOutboxEvent,
  insertDatabasePublishedContent,
  insertDatabaseTrendQuery,
  insertDatabaseTrendRun,
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
  updateDatabaseContentAsset,
  updateDatabasePublishedContent,
  updateDatabaseTrendPost,
  updateDatabaseTrendQuery,
  upsertDatabaseConnectorAccount,
} from "./database-store.js";
import { dataDirectory, readJsonFile, writeJsonFile } from "./json-store.js";
import { getActiveProject } from "./project-store.js";

type DomainData = {
  contentAssets: ContentAsset[];
  publishedContents: PublishedContent[];
  engagementSnapshots: EngagementSnapshot[];
  trendQueries: TrendQuery[];
  trendRuns: TrendRun[];
  trendPosts: TrendPost[];
  connectorAccounts: ConnectorAccount[];
  outboxEvents: OutboxEvent[];
};

export type DomainContext = StoreContext;

type OutboxEvent = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "succeeded" | "failed";
  attempts: number;
  idempotencyKey: string;
  availableAt: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

const domainStorePath = path.join(dataDirectory, "open-growth-domain.json");

const emptyMetrics: EngagementMetrics = {
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  bookmarks: 0,
  clicks: 0,
};

const emptyDomainData: DomainData = {
  contentAssets: [],
  publishedContents: [],
  engagementSnapshots: [],
  trendQueries: [],
  trendRuns: [],
  trendPosts: [],
  connectorAccounts: [],
  outboxEvents: [],
};

async function loadDomainData(): Promise<DomainData> {
  return readJsonFile(domainStorePath, emptyDomainData);
}

async function saveDomainData(data: DomainData) {
  await writeJsonFile(domainStorePath, data);
}

function now() {
  return new Date().toISOString();
}

function ensureArray<T>(value: T[] | undefined, fallback: T[] = []) {
  return Array.isArray(value) ? value : fallback;
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

function normalizeProjectId(projectId: string | null | undefined) {
  return projectId ?? null;
}

function activeProjectId() {
  return getActiveProject().then((project) => project?.id ?? null);
}

function scopedProjectId(context?: DomainContext) {
  return context?.activeProjectId ?? activeProjectId();
}

function makeAssetId() {
  return `asset_${randomUUID()}`;
}

function makePublishedContentId() {
  return `published_${randomUUID()}`;
}

function makeTrendQueryId() {
  return `query_${randomUUID()}`;
}

function makeTrendRunId() {
  return `run_${randomUUID()}`;
}

function makeTrendPostId() {
  return `post_${randomUUID()}`;
}

function makeOutboxId() {
  return `outbox_${randomUUID()}`;
}

function projectScope(
  currentProjectId: string | null,
  targetProjectId: string | null,
) {
  return currentProjectId === targetProjectId;
}

export async function listContentAssets(context?: DomainContext) {
  const databaseAssets = await listDatabaseContentAssets(context);
  if (databaseAssets) {
    return databaseAssets;
  }

  const data = await loadDomainData();
  const projectId = await scopedProjectId(context);

  return data.contentAssets
    .filter((asset) =>
      projectScope(projectId, normalizeProjectId(asset.projectId)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createContentAsset(
  input: {
    filename: string;
    path: string;
    type: ContentAsset["type"];
    size: number;
    assetId?: string;
    preview?: string;
    storageBucket?: string;
    mimeType?: string;
    sha256?: string;
  },
  context?: DomainContext,
) {
  const databaseAsset = await insertDatabaseContentAsset(input, context);
  if (databaseAsset) {
    return databaseAsset;
  }

  const data = await loadDomainData();
  const projectId = await scopedProjectId(context);
  const timestamp = now();
  const asset: ContentAsset = {
    id: makeAssetId(),
    projectId,
    filename: input.filename,
    path: input.path,
    type: input.type,
    size: input.size,
    updatedAt: timestamp,
    preview: input.preview,
    title: input.filename,
    description: "",
    tags: [],
    source: "upload",
    platforms: ["x", "reddit", "hacker-news"],
    status: "ready",
    usageCount: 0,
  };

  data.contentAssets.push(asset);
  await saveDomainData(data);
  return asset;
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
  const databaseAsset = await updateDatabaseContentAsset(
    assetId,
    patch,
    context,
  );
  if (databaseAsset) {
    return databaseAsset;
  }

  const data = await loadDomainData();
  const asset = data.contentAssets.find(
    (candidate) => candidate.id === assetId,
  );

  if (!asset) {
    return null;
  }

  Object.assign(asset, patch, { updatedAt: now() });
  await saveDomainData(data);
  return asset;
}

export async function deleteContentAsset(
  assetId: string,
  context?: DomainContext,
) {
  const databaseRemoved = await deleteDatabaseContentAsset(assetId, context);
  if (databaseRemoved !== null) {
    return databaseRemoved;
  }

  const data = await loadDomainData();
  const before = data.contentAssets.length;
  data.contentAssets = data.contentAssets.filter(
    (asset) => asset.id !== assetId,
  );

  if (data.contentAssets.length === before) {
    return false;
  }

  await saveDomainData(data);
  return true;
}

export async function listPublishedContent(context?: DomainContext) {
  const databaseContents = await listDatabasePublishedContent(context);
  if (databaseContents) {
    return databaseContents;
  }

  const data = await loadDomainData();
  const projectId = await scopedProjectId(context);

  return data.publishedContents
    .filter((content) =>
      projectScope(projectId, normalizeProjectId(content.projectId)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function buildPlatformTargets(
  contentId: string,
  body: string,
  platforms: GrowthPlatform[],
  timestamp: string,
): PlatformPublishTarget[] {
  return platforms.map((platform, index) => ({
    id: `target_${randomUUID()}`,
    publishedContentId: contentId,
    platform,
    status: "draft",
    bodyOverride: body,
    retryCount: 0,
    scheduledAt: index === 0 ? timestamp : undefined,
    updatedAt: timestamp,
  }));
}

function createPublishedContentRecord(input: {
  projectId: string | null;
  title: string;
  body: string;
  assetIds?: string[];
  sourceTrendPostId?: string;
  platforms?: GrowthPlatform[];
}) {
  const timestamp = now();
  const id = makePublishedContentId();
  return {
    content: {
      id,
      projectId: input.projectId,
      title: input.title,
      body: input.body,
      assetIds: ensureArray(input.assetIds),
      sourceTrendPostId: input.sourceTrendPostId,
      status: "draft" as PublishedContent["status"],
      platformTargets: buildPlatformTargets(
        id,
        input.body,
        input.platforms?.length ? input.platforms : ["x", "reddit", "wechat"],
        timestamp,
      ),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    timestamp,
  };
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
  const databaseContent = await insertDatabasePublishedContent(input, context);
  if (databaseContent) {
    return databaseContent;
  }

  const data = await loadDomainData();
  const projectId = await scopedProjectId(context);
  const record = createPublishedContentRecord({
    projectId,
    ...input,
  });

  data.publishedContents.push(record.content);
  await saveDomainData(data);
  return record.content;
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
  const databaseContent = await updateDatabasePublishedContent(
    contentId,
    patch,
    context,
  );
  if (databaseContent) {
    return databaseContent;
  }

  const data = await loadDomainData();
  const content = data.publishedContents.find(
    (candidate) => candidate.id === contentId,
  );

  if (!content) {
    return null;
  }

  const { platformTargets, ...contentPatch } = patch;
  Object.assign(content, contentPatch, { updatedAt: now() });
  if (platformTargets?.length) {
    const timestamp = now();
    const overrides = new Map(
      platformTargets.map((target) => [target.id, target.bodyOverride]),
    );
    content.platformTargets = content.platformTargets.map((target) =>
      overrides.has(target.id)
        ? {
            ...target,
            bodyOverride: overrides.get(target.id),
            updatedAt: timestamp,
          }
        : target,
    );
  }
  await saveDomainData(data);
  return content;
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
  const databaseRemoved = await deleteDatabasePublishedContent(
    contentId,
    context,
  );
  if (databaseRemoved !== null) {
    return databaseRemoved;
  }

  const data = await loadDomainData();
  const before = data.publishedContents.length;
  data.publishedContents = data.publishedContents.filter(
    (content) => content.id !== contentId,
  );
  data.engagementSnapshots = data.engagementSnapshots.filter(
    (snapshot) => snapshot.publishedContentId !== contentId,
  );

  if (data.publishedContents.length === before) {
    return false;
  }

  await saveDomainData(data);
  return true;
}

export async function schedulePublishedContent(
  contentId: string,
  scheduledAt: string,
  context?: DomainContext,
) {
  const databaseContent = await scheduleDatabasePublishedContent(
    contentId,
    scheduledAt,
    context,
  );
  if (databaseContent) {
    return databaseContent;
  }

  const data = await loadDomainData();
  const content = data.publishedContents.find(
    (candidate) => candidate.id === contentId,
  );

  if (!content) {
    return null;
  }

  content.status = "scheduled";
  content.updatedAt = now();
  for (const target of content.platformTargets) {
    target.status = "scheduled";
    target.scheduledAt = scheduledAt;
    target.updatedAt = now();
  }

  data.outboxEvents.push({
    id: makeOutboxId(),
    eventType: "publish.schedule",
    aggregateType: "published_content",
    aggregateId: contentId,
    payload: { scheduledAt },
    status: "pending",
    attempts: 0,
    idempotencyKey: `${contentId}:${scheduledAt}`,
    availableAt: scheduledAt,
    createdAt: now(),
    updatedAt: now(),
  });

  await saveDomainData(data);
  return content;
}

export async function publishContent(
  contentId: string,
  context?: DomainContext,
) {
  const databaseStarted = await markDatabasePublishStarted(contentId, context);
  if (databaseStarted) {
    return databaseStarted;
  }

  const data = await loadDomainData();
  const content = data.publishedContents.find(
    (candidate) => candidate.id === contentId,
  );

  if (!content) {
    return null;
  }

  const timestamp = now();
  content.status = "published";
  content.updatedAt = timestamp;

  for (const target of content.platformTargets) {
    const result = await publishContentToPlatform({
      contentId: content.id,
      platform: target.platform,
      body: target.bodyOverride ?? content.body,
    });

    target.status = "published";
    target.publishedAt = result.publishedAt;
    target.platformContentId = result.platformContentId;
    target.platformUrl = result.platformUrl;
    target.lastError = undefined;
    target.updatedAt = timestamp;
  }

  await saveDomainData(data);
  return content;
}

export async function retryPublishedContent(
  contentId: string,
  context?: DomainContext,
) {
  const databaseContent = await retryDatabasePublishedContent(
    contentId,
    context,
  );
  if (databaseContent) {
    return databaseContent;
  }

  const data = await loadDomainData();
  const content = data.publishedContents.find(
    (candidate) => candidate.id === contentId,
  );

  if (!content) {
    return null;
  }

  for (const target of content.platformTargets) {
    if (target.status === "failed") {
      target.status = "publishing";
      target.retryCount += 1;
      target.updatedAt = now();
    }
  }

  content.status = "publishing";
  content.updatedAt = now();
  await saveDomainData(data);
  return content;
}

export async function createEngagementSnapshot(
  contentId: string,
  platformTargetId: string,
  context?: DomainContext,
) {
  const databaseContents = await listDatabasePublishedContent(context);
  if (databaseContents) {
    const content = databaseContents.find((item) => item.id === contentId);
    const target = content?.platformTargets.find(
      (candidate) => candidate.id === platformTargetId,
    );

    if (!content || !target) {
      return null;
    }

    const index = (await listDatabaseEngagementSnapshots(context))?.length ?? 0;
    const metrics = await fetchEngagement(target.platform, index + 1);

    return insertDatabaseEngagementSnapshot(
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
    );
  }

  const data = await loadDomainData();
  const content = data.publishedContents.find(
    (candidate) => candidate.id === contentId,
  );
  const target = content?.platformTargets.find(
    (candidate) => candidate.id === platformTargetId,
  );

  if (!content || !target) {
    return null;
  }

  const index = data.engagementSnapshots.length + 1;
  const metrics = await fetchEngagement(target.platform, index);

  const snapshot: EngagementSnapshot = {
    id: `snapshot_${randomUUID()}`,
    projectId: content.projectId,
    publishedContentId: contentId,
    platformTargetId,
    platform: target.platform,
    platformContentId: target.platformContentId,
    capturedAt: now(),
    metrics,
    platformMetrics: {
      saves: Math.max(Math.floor(metrics.bookmarks / 2), 1),
    },
    rawPayload: {
      note: "simulated engagement payload",
    },
  };

  data.engagementSnapshots.push(snapshot);
  await saveDomainData(data);
  return snapshot;
}

export async function requestEngagementRefresh(
  input?: { contentId?: string },
  context?: DomainContext,
) {
  const databaseEvent = await enqueueDatabaseOutboxEvent(
    {
      eventType: "engagement.refresh",
      aggregateType: input?.contentId ? "published_content" : "project",
      aggregateId: input?.contentId,
      payload: input?.contentId ? { publishedContentId: input.contentId } : {},
      idempotencyKey: `engagement.refresh:${input?.contentId ?? "project"}:${now()}`,
    },
    context,
  );

  if (databaseEvent) {
    return databaseEvent;
  }

  return enqueueOutboxEvent({
    eventType: "engagement.refresh",
    aggregateType: input?.contentId ? "published_content" : "project",
    aggregateId: input?.contentId ?? "project",
    payload: input?.contentId ? { publishedContentId: input.contentId } : {},
    idempotencyKey: `engagement.refresh:${input?.contentId ?? "project"}:${now()}`,
  });
}

export async function listEngagementSnapshots(context?: DomainContext) {
  const databaseSnapshots = await listDatabaseEngagementSnapshots(context);
  if (databaseSnapshots) {
    return databaseSnapshots;
  }

  const data = await loadDomainData();
  const projectId = await scopedProjectId(context);

  return data.engagementSnapshots.filter((snapshot) =>
    projectScope(projectId, normalizeProjectId(snapshot.projectId)),
  );
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
  const databaseQuery = await insertDatabaseTrendQuery(input, context);
  if (databaseQuery) {
    return databaseQuery;
  }

  const data = await loadDomainData();
  const projectId = await scopedProjectId(context);
  const timestamp = now();
  const query: TrendQuery = {
    id: makeTrendQueryId(),
    projectId,
    name: input.name,
    keywords: input.keywords,
    excludedKeywords: input.excludedKeywords ?? [],
    platforms: input.platforms,
    language: input.language,
    timeRange: input.timeRange ?? "7d",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  data.trendQueries.push(query);
  await saveDomainData(data);
  return query;
}

export async function updateTrendQuery(
  queryId: string,
  patch: Partial<Omit<TrendQuery, "id" | "projectId" | "createdAt">>,
  context?: DomainContext,
) {
  const databaseQuery = await updateDatabaseTrendQuery(queryId, patch, context);
  if (databaseQuery) {
    return databaseQuery;
  }

  const data = await loadDomainData();
  const query = data.trendQueries.find((candidate) => candidate.id === queryId);

  if (!query) {
    return null;
  }

  Object.assign(query, patch, { updatedAt: now() });
  await saveDomainData(data);
  return query;
}

export async function deleteTrendQuery(
  queryId: string,
  context?: DomainContext,
) {
  const databaseRemoved = await deleteDatabaseTrendQuery(queryId, context);
  if (databaseRemoved !== null) {
    return databaseRemoved;
  }

  const data = await loadDomainData();
  const before = data.trendQueries.length;
  data.trendQueries = data.trendQueries.filter((query) => query.id !== queryId);
  data.trendRuns = data.trendRuns.filter((run) => run.queryId !== queryId);
  data.trendPosts = data.trendPosts.filter((post) => post.queryId !== queryId);

  if (before === data.trendQueries.length) {
    return false;
  }

  await saveDomainData(data);
  return true;
}

export async function listTrendQueries(context?: DomainContext) {
  const databaseQueries = await listDatabaseTrendQueries(context);
  if (databaseQueries) {
    return databaseQueries;
  }

  const data = await loadDomainData();
  const projectId = await scopedProjectId(context);
  return data.trendQueries.filter((query) =>
    projectScope(projectId, normalizeProjectId(query.projectId)),
  );
}

export async function runTrendQuery(queryId: string, context?: DomainContext) {
  const databaseQueries = await listDatabaseTrendQueries(context);
  if (databaseQueries) {
    const query = databaseQueries.find((candidate) => candidate.id === queryId);
    if (!query) {
      return null;
    }

    const run = await insertDatabaseTrendRun(query, context);
    if (!run) {
      return null;
    }

    return { run, posts: [] };
  }

  return executeLocalTrendQuery(queryId);
}

async function executeLocalTrendQuery(queryId: string, forcedRunId?: string) {
  const data = await loadDomainData();
  const query = data.trendQueries.find((candidate) => candidate.id === queryId);

  if (!query) {
    return null;
  }

  const run: TrendRun = {
    id: forcedRunId ?? makeTrendRunId(),
    queryId,
    status: "running",
    startedAt: now(),
    platforms: query.platforms,
    resultCount: 0,
    errors: [],
  };

  data.trendRuns.push(run);

  const projectId = query.projectId;
  const posts: TrendPost[] = (await searchTrends({ query, runId: run.id })).map(
    (post) => ({
      ...post,
      id: makeTrendPostId(),
      projectId,
      queryId,
      runId: run.id,
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

  data.trendPosts.push(...orderedPosts);
  run.status = "succeeded";
  run.resultCount = orderedPosts.length;
  run.finishedAt = now();
  await saveDomainData(data);
  return { run, posts: orderedPosts };
}

export async function executeTrendRunFromOutbox(
  input: { runId: string; queryId: string },
  context?: DomainContext,
) {
  const databaseQueries = await listDatabaseTrendQueries(context);
  if (databaseQueries) {
    const query = databaseQueries.find(
      (candidate) => candidate.id === input.queryId,
    );
    if (!query) {
      return null;
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
    return finishDatabaseTrendRun(input.runId, orderedPosts, [], context);
  }

  return executeLocalTrendQuery(input.queryId, input.runId);
}

export async function listTrendPosts(context?: DomainContext) {
  const databasePosts = await listDatabaseTrendPosts(context);
  if (databasePosts) {
    return databasePosts;
  }

  const data = await loadDomainData();
  const projectId = await scopedProjectId(context);
  return data.trendPosts
    .filter((post) =>
      projectScope(projectId, normalizeProjectId(post.projectId)),
    )
    .sort(
      (a, b) =>
        b.relevanceScore - a.relevanceScore ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
}

export async function updateTrendPost(
  postId: string,
  patch: Partial<
    Pick<TrendPost, "status" | "summary" | "title" | "matchedKeywords">
  >,
  context?: DomainContext,
) {
  const databasePost = await updateDatabaseTrendPost(postId, patch, context);
  if (databasePost) {
    return databasePost;
  }

  const data = await loadDomainData();
  const post = data.trendPosts.find((candidate) => candidate.id === postId);

  if (!post) {
    return null;
  }

  Object.assign(post, patch, { updatedAt: now() });
  await saveDomainData(data);
  return post;
}

export async function createResponseDraftFromTrendPost(
  postId: string,
  context?: DomainContext,
) {
  const databaseResult = await createDatabaseResponseDraftFromTrendPost(
    postId,
    context,
  );
  if (databaseResult) {
    return databaseResult;
  }

  const data = await loadDomainData();
  const post = data.trendPosts.find((candidate) => candidate.id === postId);

  if (!post) {
    return null;
  }

  post.status = "responded";
  post.updatedAt = now();
  const record = createPublishedContentRecord({
    projectId: post.projectId,
    title: `Response: ${post.title}`,
    body: `Reply to ${post.platform} post ${post.url}\n\n${post.summary}`,
    sourceTrendPostId: post.id,
    platforms: [post.platform],
  });
  data.publishedContents.push(record.content);
  await saveDomainData(data);
  return { post, draft: record.content };
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
    activeProjectId: await scopedProjectId(context),
  };
}

export async function listConnectorConnections(context?: DomainContext) {
  const databaseConnections = await listDatabaseConnectorAccounts(context);
  if (databaseConnections) {
    return mergeConnectorConnections(databaseConnections);
  }

  const data = await loadDomainData();
  return mergeConnectorConnections(data.connectorAccounts);
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
  const databaseAccount = await upsertDatabaseConnectorAccount(input, context);
  if (databaseAccount) {
    return databaseAccount;
  }

  const data = await loadDomainData();
  const projectId = await scopedProjectId(context);
  const timestamp = now();
  const existing = data.connectorAccounts.find(
    (account) => account.platform === input.platform,
  );
  const account: ConnectorAccount = {
    id: existing?.id ?? `connector_${randomUUID()}`,
    workspaceId: existing?.workspaceId ?? "workspace-local",
    platform: input.platform,
    status: input.status ?? "active",
    hasCredentialRef: true,
    expiresAt: input.expiresAt,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  data.connectorAccounts = data.connectorAccounts.filter(
    (candidate) => candidate.platform !== input.platform,
  );
  data.connectorAccounts.push({
    ...account,
    workspaceId: projectId ?? account.workspaceId,
  });
  await saveDomainData(data);
  return account;
}

export async function enqueueOutboxEvent(input: {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  availableAt?: string;
}) {
  const data = await loadDomainData();
  const event: OutboxEvent = {
    id: makeOutboxId(),
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    idempotencyKey: input.idempotencyKey,
    availableAt: input.availableAt ?? now(),
    createdAt: now(),
    updatedAt: now(),
  };

  data.outboxEvents.push(event);
  await saveDomainData(data);
  return event;
}

export async function enqueueDatabaseOutboxEvent(
  input: {
    eventType: string;
    aggregateType: string;
    aggregateId?: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    availableAt?: string;
  },
  context?: DomainContext,
) {
  const databaseEvent = await insertDatabaseOutboxEvent(input, context);
  if (databaseEvent) {
    return databaseEvent;
  }

  return null;
}

export async function updateLocalOutboxEventStatus(
  eventId: string,
  status: OutboxEvent["status"],
  lastError?: string,
) {
  const data = await loadDomainData();
  const event = data.outboxEvents.find((candidate) => candidate.id === eventId);

  if (!event) {
    return false;
  }

  event.status = status;
  event.lastError = lastError;
  event.attempts += status === "processing" ? 1 : 0;
  event.updatedAt = now();
  await saveDomainData(data);
  return true;
}

export async function listOutboxEvents(context?: DomainContext) {
  const databaseEvents = await listDatabaseOutboxEvents(context);
  if (databaseEvents) {
    return databaseEvents;
  }

  const data = await loadDomainData();
  return data.outboxEvents;
}
