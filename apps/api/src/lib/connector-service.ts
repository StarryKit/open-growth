import { randomUUID } from "node:crypto";
import type {
  ConnectorAccount,
  ConnectorAccountStatus,
  ConnectorCapability,
  ConnectorConnection,
  ConnectorIdentityKind,
  ConnectorUseCase,
  EngagementMetrics,
  GrowthPlatform,
  TrendPost,
  TrendQuery,
} from "../../../../packages/shared/src/index.js";

type PublishInput = {
  contentId: string;
  platform: GrowthPlatform;
  body: string;
};

type PublishStatusResult = {
  platformContentId: string;
  status: "published" | "unavailable";
  checkedAt: string;
};

type TrendSearchInput = {
  query: TrendQuery;
  runId: string;
};

const connectorCapabilities: Record<GrowthPlatform, ConnectorCapability> = {
  x: {
    platform: "x",
    displayName: "X",
    status: "oauth-required",
    supportsPublish: true,
    supportsEngagement: true,
    supportsTrends: true,
    supportedAuthModes: ["oauth", "api_key", "browser_profile", "vendor"],
    supportedUseCases: ["publish", "reply", "engagement", "trends", "read"],
    collectorModes: ["api_key", "browser_profile", "vendor"],
    maxCharacters: 280,
    maxMediaItems: 4,
    dataSource: "X API adapter",
    limitation: "Requires user OAuth credentials and API access tier.",
  },
  reddit: {
    platform: "reddit",
    displayName: "Reddit",
    status: "oauth-required",
    supportsPublish: true,
    supportsEngagement: true,
    supportsTrends: true,
    supportedAuthModes: ["oauth", "api_key", "browser_profile", "vendor"],
    supportedUseCases: ["publish", "reply", "engagement", "trends", "read"],
    collectorModes: ["api_key", "browser_profile", "vendor"],
    maxCharacters: 40_000,
    dataSource: "Reddit API adapter",
    limitation: "Requires OAuth app credentials and subreddit permissions.",
  },
  "hacker-news": {
    platform: "hacker-news",
    displayName: "Hacker News",
    status: "adapter-required",
    supportsPublish: false,
    supportsEngagement: true,
    supportsTrends: true,
    supportedAuthModes: ["public"],
    supportedUseCases: ["engagement", "trends", "read"],
    collectorModes: ["public"],
    dataSource: "Hacker News Firebase/API adapter",
    limitation: "Public data only; posting is intentionally not automated.",
  },
  xiaohongshu: {
    platform: "xiaohongshu",
    displayName: "Xiaohongshu",
    status: "adapter-required",
    supportsPublish: false,
    supportsEngagement: false,
    supportsTrends: true,
    supportedAuthModes: ["api_key", "browser_profile", "vendor"],
    supportedUseCases: ["trends", "read"],
    collectorModes: ["api_key", "browser_profile", "vendor"],
    dataSource: "Approved partner/API adapter only",
    limitation:
      "No credential injection or scraping bypass; must use compliant official access.",
  },
  wechat: {
    platform: "wechat",
    displayName: "WeChat",
    status: "adapter-required",
    supportsPublish: true,
    supportsEngagement: true,
    supportsTrends: false,
    supportedAuthModes: ["oauth", "api_key", "browser_profile"],
    supportedUseCases: ["publish", "reply", "engagement", "read"],
    collectorModes: ["api_key", "browser_profile"],
    dataSource: "WeChat Official Account API adapter",
    limitation:
      "Requires official account credentials stored server-side as a secret reference.",
  },
};

export function listConnectorCapabilities() {
  return Object.values(connectorCapabilities);
}

export function getConnectorCapability(platform: GrowthPlatform) {
  return connectorCapabilities[platform];
}

export function mergeConnectorConnections(
  accounts: ConnectorAccount[],
): ConnectorConnection[] {
  return listConnectorCapabilities().map((capability) => {
    const platformAccounts = accounts.filter(
      (candidate) => candidate.platform === capability.platform,
    );
    const publishingIdentities = platformAccounts.filter(
      (account) => account.identityKind === "publishing",
    );
    const enabledPublishingIdentities = publishingIdentities.filter(
      (account) => account.enabledForWorkspace,
    );
    const collectorIdentity = platformAccounts.find(
      (account) => account.identityKind === "collector",
    );
    const publishingStatus = connectionStatusFor(
      enabledPublishingIdentities,
      capability.supportsPublish ||
        capability.supportedUseCases.includes("reply"),
    );
    const collectorStatus =
      collectorIdentity?.status ??
      (capability.collectorModes.includes("public")
        ? "public-available"
        : capability.supportsTrends
          ? "not-configured"
          : "unsupported");

    return {
      ...capability,
      publishingIdentities,
      enabledPublishingIdentities,
      collectorIdentity,
      publishingStatus,
      collectorStatus,
      connectionStatus:
        publishingStatus === "active" || collectorStatus === "active"
          ? "active"
          : publishingStatus !== "unsupported"
            ? publishingStatus
            : collectorStatus,
    };
  });
}

function connectionStatusFor(
  accounts: ConnectorAccount[],
  supported: boolean,
): ConnectorAccountStatus {
  if (!supported) {
    return "unsupported";
  }

  if (accounts.some((account) => account.status === "active")) {
    return "active";
  }

  return accounts[0]?.status ?? "needs-auth";
}

export function resolveConnectorIdentity(
  accounts: ConnectorAccount[],
  input: {
    platform: GrowthPlatform;
    identityKind: ConnectorIdentityKind;
    useCase: ConnectorUseCase;
    requireWorkspaceEnabled?: boolean;
  },
) {
  return accounts.find(
    (account) =>
      account.platform === input.platform &&
      account.identityKind === input.identityKind &&
      account.status === "active" &&
      account.useCases.includes(input.useCase) &&
      (!input.requireWorkspaceEnabled || account.enabledForWorkspace),
  );
}

export function assertConnectorIdentity(
  accounts: ConnectorAccount[],
  input: {
    platform: GrowthPlatform;
    identityKind: ConnectorIdentityKind;
    useCase: ConnectorUseCase;
    requireWorkspaceEnabled?: boolean;
  },
) {
  const identity = resolveConnectorIdentity(accounts, input);

  if (!identity) {
    const subject =
      input.identityKind === "publishing"
        ? "enabled Publishing identity"
        : "Collector identity";
    throw new Error(
      `Missing ${subject} for ${input.platform} ${input.useCase}.`,
    );
  }

  return identity;
}

function platformSeed(platform: GrowthPlatform) {
  switch (platform) {
    case "x":
      return 12;
    case "reddit":
      return 18;
    case "hacker-news":
      return 11;
    case "xiaohongshu":
      return 9;
    case "wechat":
      return 14;
  }
}

export async function publishContentToPlatform(input: PublishInput) {
  const capability = getConnectorCapability(input.platform);

  if (!capability.supportsPublish) {
    throw new Error(`${capability.displayName} publishing is not supported.`);
  }

  return {
    platformContentId: `${input.platform}-${input.contentId}`,
    platformUrl: `https://${input.platform}.example.com/posts/${input.platform}-${input.contentId}`,
    publishedAt: new Date().toISOString(),
  };
}

export async function getPublishStatus(
  platform: GrowthPlatform,
  platformContentId: string,
): Promise<PublishStatusResult> {
  const capability = getConnectorCapability(platform);

  if (!capability.supportsPublish) {
    return {
      platformContentId,
      status: "unavailable",
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    platformContentId,
    status: "published",
    checkedAt: new Date().toISOString(),
  };
}

export async function fetchEngagement(
  platform: GrowthPlatform,
  multiplier: number,
): Promise<EngagementMetrics> {
  const capability = getConnectorCapability(platform);

  if (!capability.supportsEngagement) {
    throw new Error(`${capability.displayName} engagement is not supported.`);
  }

  const seed = platformSeed(platform);

  return {
    views: seed * multiplier * 7,
    likes: seed * multiplier * 2,
    comments: seed * multiplier,
    shares: seed * Math.max(multiplier - 1, 1),
    bookmarks: Math.floor(seed / 2) * multiplier,
    clicks: seed * multiplier * 3,
  };
}

function relevanceScore(
  keywords: string[],
  text: string,
  metrics: Partial<EngagementMetrics>,
) {
  const lowerText = text.toLowerCase();
  const keywordHits = keywords.reduce(
    (count, keyword) =>
      count + (lowerText.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
  return Number(
    (
      keywordHits * 2 +
      (metrics.likes ?? 0) / 10 +
      (metrics.comments ?? 0) / 10
    ).toFixed(2),
  );
}

export async function searchTrends(
  input: TrendSearchInput,
): Promise<TrendPost[]> {
  const { query, runId } = input;

  return query.platforms.flatMap((platform, platformIndex) => {
    const capability = getConnectorCapability(platform);
    if (!capability.supportsTrends) {
      return [];
    }

    const timestamp = new Date(
      Date.now() - platformIndex * 45 * 60 * 1000,
    ).toISOString();

    return Array.from({ length: 3 }, (_, index) => {
      const title = `${query.name} ${platform} opportunity ${index + 1}`;
      const summary = `${query.keywords.join(", ")} discussion about ${platform} surfaced in the last ${query.timeRange}.`;
      const metrics: Partial<EngagementMetrics> = {
        views: (index + 1) * 100,
        likes: (index + 1) * 10,
        comments: index * 4,
        shares: index * 3,
        bookmarks: index * 2,
        clicks: (index + 1) * 7,
      };

      return {
        id: randomUUID(),
        projectId: query.projectId,
        queryId: query.id,
        runId,
        platform,
        platformPostId: `${platform}-${query.id}-${index}`,
        url: `https://${platform}.example.com/${query.id}/${index}`,
        title,
        summary,
        author: `${platform}-creator-${index + 1}`,
        postedAt: timestamp,
        capturedAt: new Date().toISOString(),
        matchedKeywords: query.keywords.slice(0, 3),
        metrics,
        relevanceScore: relevanceScore(
          query.keywords,
          `${title} ${summary}`,
          metrics,
        ),
        status: "new",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  });
}

export async function getPostDetail(
  platform: GrowthPlatform,
  platformPostId: string,
): Promise<TrendPost> {
  const capability = getConnectorCapability(platform);

  if (!capability.supportsTrends) {
    throw new Error(`${capability.displayName} trends are not supported.`);
  }

  const timestamp = new Date().toISOString();

  return {
    id: randomUUID(),
    projectId: null,
    queryId: "connector-detail",
    runId: "connector-detail",
    platform,
    platformPostId,
    url: `https://${platform}.example.com/detail/${platformPostId}`,
    title: `${capability.displayName} post detail`,
    summary: `Normalized detail for ${platformPostId}.`,
    author: `${platform}-author`,
    postedAt: timestamp,
    capturedAt: timestamp,
    matchedKeywords: [],
    metrics: {},
    relevanceScore: 0,
    status: "new",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
