export type ContentAssetKind = "image" | "video" | "text" | "other";

export type ContentAsset = {
  id?: string;
  projectId?: string | null;
  filename: string;
  path: string;
  type: ContentAssetKind;
  size: number;
  updatedAt: string;
  preview?: string;
  title?: string;
  description?: string;
  tags?: string[];
  source?: string;
  platforms?: GrowthPlatform[];
  status?: ContentAssetStatus;
  usageCount?: number;
};

export type ContentAssetStatus =
  | "uploading"
  | "ready"
  | "failed"
  | "deleting"
  | "deleted";

export type GrowthPlatform =
  | "x"
  | "reddit"
  | "hacker-news"
  | "xiaohongshu"
  | "wechat";

export type ConnectorAccountStatus =
  | "active"
  | "expired"
  | "revoked"
  | "needs-auth";

export type ConnectorAccount = {
  id: string;
  workspaceId: string;
  platform: GrowthPlatform;
  status: ConnectorAccountStatus;
  hasCredentialRef: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ConnectorCapability = {
  platform: GrowthPlatform;
  displayName: string;
  status: "simulated" | "adapter-required" | "oauth-required";
  supportsPublish: boolean;
  supportsEngagement: boolean;
  supportsTrends: boolean;
  maxCharacters?: number;
  maxMediaItems?: number;
  dataSource: string;
  limitation: string;
};

export type ConnectorConnection = ConnectorCapability & {
  account?: ConnectorAccount;
  connectionStatus: ConnectorAccountStatus;
};

export type PublishedContentStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export type PlatformPublishTargetStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export type PlatformPublishTarget = {
  id: string;
  publishedContentId: string;
  platform: GrowthPlatform;
  status: PlatformPublishTargetStatus;
  bodyOverride?: string;
  scheduledAt?: string;
  publishedAt?: string;
  platformContentId?: string;
  platformUrl?: string;
  lastError?: string;
  retryCount: number;
  updatedAt: string;
};

export type PublishedContent = {
  id: string;
  projectId: string | null;
  title: string;
  body: string;
  assetIds: string[];
  sourceTrendPostId?: string;
  status: PublishedContentStatus;
  platformTargets: PlatformPublishTarget[];
  createdAt: string;
  updatedAt: string;
};

export type EngagementMetrics = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  clicks: number;
};

export type EngagementSnapshot = {
  id: string;
  projectId: string | null;
  publishedContentId: string;
  platformTargetId: string;
  platform: GrowthPlatform;
  platformContentId?: string;
  capturedAt: string;
  metrics: EngagementMetrics;
  platformMetrics?: Record<string, number>;
  rawPayload?: unknown;
  error?: string;
};

export type EngagementContentSummary = {
  content: PublishedContent;
  latestSnapshots: EngagementSnapshot[];
  totalMetrics: EngagementMetrics;
  engagementRate: number;
};

export type EngagementOverview = {
  totals: EngagementMetrics;
  publishedTargetCount: number;
  averageEngagementRate: number;
  bestPlatform?: GrowthPlatform;
  byPlatform: Array<{
    platform: GrowthPlatform;
    publishedTargetCount: number;
    metrics: EngagementMetrics;
    engagementRate: number;
  }>;
  content: EngagementContentSummary[];
};

export type TrendPostStatus = "new" | "saved" | "ignored" | "responded";

export type TrendQuery = {
  id: string;
  projectId: string | null;
  name: string;
  keywords: string[];
  excludedKeywords: string[];
  platforms: GrowthPlatform[];
  language?: string;
  timeRange: "24h" | "7d" | "30d";
  createdAt: string;
  updatedAt: string;
};

export type TrendRun = {
  id: string;
  queryId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  startedAt: string;
  finishedAt?: string;
  platforms: GrowthPlatform[];
  resultCount: number;
  errors: string[];
};

export type TrendPost = {
  id: string;
  projectId: string | null;
  queryId: string;
  runId: string;
  platform: GrowthPlatform;
  platformPostId: string;
  url: string;
  title: string;
  summary: string;
  author: string;
  postedAt: string;
  capturedAt: string;
  matchedKeywords: string[];
  metrics: Partial<EngagementMetrics>;
  relevanceScore: number;
  status: TrendPostStatus;
  createdAt: string;
  updatedAt: string;
};
