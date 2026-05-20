import type {
  ConnectorAccount,
  ConnectorAdapterBackend,
  ConnectorAuthMode,
  ConnectorIdentityKind,
  ConnectorOwnerScope,
  ConnectorUseCase,
  ContentAsset,
  EngagementMetrics,
  EngagementSnapshot,
  GrowthPlatform,
  PlatformPublishTarget,
  PublishedContent,
  TrendPost,
  TrendQuery,
  TrendRun,
  WorkspaceProject,
} from "../../shared/src/index.js";
import {
  createSupabaseServiceClient,
  supabaseServiceConfig,
} from "./client.js";
import { getAssetType } from "./content-assets.js";

export type StoreContext = {
  userId?: string;
  workspaceId?: string;
  activeProjectId?: string | null;
};

export type DatabaseScope = {
  workspaceId: string;
  projectId: string;
  userId: string;
};

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
};

type ContentAssetRow = {
  id: string;
  workspace_id?: string;
  project_id: string;
  kind?: ContentAsset["kind"] | null;
  original_filename: string;
  storage_bucket: string | null;
  storage_path: string | null;
  current_storage_path?: string | null;
  mime_type: string | null;
  byte_size: number | null;
  sha256: string | null;
  created_at?: string;
  updated_at: string;
  preview: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  source: string | null;
  platforms: GrowthPlatform[];
  status: ContentAsset["status"];
  usage_count: number;
};

type ContentAssetTextRow = {
  asset_id: string;
  workspace_id: string;
  project_id: string;
  body_markdown: string;
  body_preview: string;
  character_count: number;
};

type EngagementSnapshotRow = {
  id: string;
  project_id: string;
  published_content_id: string;
  platform_target_id: string;
  platform: GrowthPlatform;
  platform_content_id: string | null;
  captured_at: string;
  metrics: Partial<EngagementMetrics>;
  platform_metrics: Record<string, number> | null;
  raw_payload: unknown;
  error: string | null;
};

type TrendQueryRow = {
  id: string;
  project_id: string;
  name: string;
  keywords: string[];
  excluded_keywords: string[];
  platforms: GrowthPlatform[];
  language: string | null;
  time_range: TrendQuery["timeRange"];
  created_at: string;
  updated_at: string;
};

type TrendRunRow = {
  id: string;
  trend_query_id: string;
  status: TrendRun["status"];
  started_at: string;
  finished_at: string | null;
  platforms: GrowthPlatform[];
  result_count: number;
  error_summary: string[] | null;
};

type TrendPostRow = {
  id: string;
  project_id: string;
  trend_query_id: string;
  trend_run_id: string;
  platform: GrowthPlatform;
  platform_post_id: string;
  url: string;
  title: string;
  summary: string;
  author: string;
  posted_at: string;
  captured_at: string;
  matched_keywords: string[];
  metrics: Partial<EngagementMetrics>;
  relevance_score: number;
  status: TrendPost["status"];
  created_at: string;
  updated_at: string;
};

type ConnectorAccountRow = {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  platform: GrowthPlatform;
  identity_kind?: ConnectorIdentityKind;
  auth_mode?: ConnectorAuthMode;
  use_cases?: ConnectorUseCase[];
  owner_scope?: ConnectorOwnerScope;
  status: string;
  credential_ref: string | null;
  display_name?: string | null;
  platform_account_id?: string | null;
  adapter_backend?: ConnectorAdapterBackend | null;
  expires_at: string | null;
  last_verified_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
};

const connectorAccountColumns =
  "id, workspace_id, user_id, platform, identity_kind, auth_mode, use_cases, owner_scope, status, credential_ref, display_name, platform_account_id, adapter_backend, expires_at, last_verified_at, last_error, created_at, updated_at";

type ConnectorOAuthAuthorizationRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  platform: GrowthPlatform;
  state: string;
  code_verifier: string | null;
  redirect_to: string | null;
  status: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export type ConnectorOAuthAuthorizationRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  platform: GrowthPlatform;
  state: string;
  codeVerifier?: string;
  redirectTo?: string;
  status: string;
  expiresAt: string;
  consumedAt?: string;
  createdAt: string;
};

type OAuthAppConfigRow = {
  platform: GrowthPlatform;
  client_id: string;
  has_client_secret: boolean;
  updated_at: string | null;
  client_secret?: string | null;
};

export type DatabaseOAuthAppConfig = {
  platform: GrowthPlatform;
  clientId: string;
  hasClientSecret: boolean;
  updatedAt?: string;
  clientSecret?: string;
};

type DeploymentSettingsRow = {
  public_base_url: string;
  redirect_base_url: string;
  updated_at: string | null;
};

export type DatabaseDeploymentSettings = {
  publicBaseUrl: string;
  redirectBaseUrl: string;
  updatedAt?: string;
};

type PublishedContentRow = {
  id: string;
  project_id: string;
  title: string;
  body: string;
  asset_ids: string[];
  source_trend_post_id: string | null;
  status: PublishedContent["status"];
  created_at: string;
  updated_at: string;
};

export type OutboxEventRecord = {
  id: string;
  workspaceId?: string;
  projectId?: string | null;
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

export type PreparedDatabaseContentAssetUpload = {
  assetId: string;
  workspaceId: string;
  projectId: string;
  filename: string;
  storageBucket: string;
  storagePath: string;
};

const contentAssetColumns =
  "id, workspace_id, project_id, kind, original_filename, storage_bucket, storage_path, current_storage_path, mime_type, byte_size, sha256, created_at, updated_at, preview, title, description, tags, source, platforms, status, usage_count";

type PlatformTargetRow = {
  id: string;
  published_content_id: string;
  platform: GrowthPlatform;
  status: PlatformPublishTarget["status"];
  body_override: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  platform_content_id: string | null;
  platform_url: string | null;
  last_error: string | null;
  retry_count: number;
  updated_at: string;
};

type AutoRefreshTargetRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  published_content_id: string;
  published_at: string | null;
};

type AutoRefreshSnapshotRow = {
  platform_target_id: string;
  captured_at: string;
};

type RpcPublishedContentResult = {
  content: PublishedContentRow;
  targets: PlatformTargetRow[];
};

type RpcResponseDraftResult = {
  post: TrendPostRow;
  draft: PublishedContentRow;
  targets: PlatformTargetRow[];
};

type RpcDefaultWorkspaceResult = {
  workspaceId?: string;
  workspace_id?: string;
  projectId?: string;
  project_id?: string;
  userId?: string;
  user_id?: string;
};

function client() {
  return createSupabaseServiceClient();
}

export function isDatabaseStoreEnabled() {
  return Boolean(supabaseServiceConfig());
}

async function ensureDefaultScope(
  supabase: NonNullable<ReturnType<typeof client>>,
  userId: string,
): Promise<DatabaseScope | null> {
  const { data, error } = await supabase.rpc("ensure_default_workspace", {
    p_user_id: userId,
    p_workspace_name: "Open Growth",
    p_project_name: "Launch Lab",
  });

  if (error || !data) {
    return null;
  }

  const result = data as RpcDefaultWorkspaceResult;
  const workspaceId = result.workspaceId ?? result.workspace_id;
  const projectId = result.projectId ?? result.project_id;
  const resolvedUserId = result.userId ?? result.user_id ?? userId;

  if (!workspaceId || !projectId) {
    return null;
  }

  return {
    workspaceId,
    projectId,
    userId: resolvedUserId,
  };
}

export async function getDefaultScope(
  context?: StoreContext,
): Promise<DatabaseScope | null> {
  const supabase = client();
  const userId = context?.userId ?? process.env.OPEN_GROWTH_USER_ID;

  if (!supabase) {
    return null;
  }

  if (context?.workspaceId && context.activeProjectId) {
    return {
      workspaceId: context.workspaceId,
      projectId: context.activeProjectId,
      userId: userId ?? "service-role",
    };
  }

  if (!userId) {
    return null;
  }

  let membershipQuery = supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);

  if (context?.workspaceId) {
    membershipQuery = membershipQuery.eq("workspace_id", context.workspaceId);
  }

  const { data: membership, error: membershipError } = await membershipQuery
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    const createdScope = await ensureDefaultScope(supabase, userId);
    if (createdScope) {
      return createdScope;
    }

    throw membershipError ?? new Error("Workspace membership not found.");
  }

  const projectQuery = supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", membership.workspace_id);

  const { data: project, error: projectError } = context?.activeProjectId
    ? await projectQuery.eq("id", context.activeProjectId).maybeSingle()
    : await projectQuery
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  if (projectError || !project) {
    const createdScope = await ensureDefaultScope(supabase, userId);
    if (createdScope) {
      return createdScope;
    }

    throw projectError ?? new Error("Project not found.");
  }

  return {
    workspaceId: membership.workspace_id,
    projectId: project.id,
    userId,
  };
}

export async function listDatabaseProjects(
  context?: StoreContext,
): Promise<WorkspaceProject[] | null> {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) {
    return null;
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("workspace_id", scope.workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as ProjectRow[]).map((project) => ({
    id: project.id,
    name: project.name,
    rootDir: `supabase://${scope.workspaceId}/${project.id}`,
    createdAt: project.created_at,
  }));
}

export async function insertDatabaseProject(
  input: { name: string },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: scope.workspaceId,
      name: input.name.trim(),
      created_by: scope.userId,
    })
    .select("id, name, created_at")
    .single();

  if (error) throw error;
  const project = data as ProjectRow;
  return {
    id: project.id,
    name: project.name,
    rootDir: `supabase://${scope.workspaceId}/${project.id}`,
    createdAt: project.created_at,
  } satisfies WorkspaceProject;
}

export async function deleteDatabaseProject(
  projectId: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("workspace_id", scope.workspaceId)
    .eq("id", projectId);

  if (error) throw error;
  return true;
}

function mapAsset(
  row: ContentAssetRow,
  text?: ContentAssetTextRow | null,
): ContentAsset {
  const kind = row.kind ?? getAssetType(row.original_filename);
  const currentStoragePath = row.current_storage_path ?? row.storage_path ?? "";
  const extension = row.original_filename
    .slice(row.original_filename.lastIndexOf("."))
    .toLowerCase();

  return {
    id: row.id,
    projectId: row.project_id,
    filename: row.original_filename,
    path: row.storage_path ?? "",
    currentStoragePath,
    kind,
    type: kind,
    size: row.byte_size ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    preview: text?.body_preview ?? row.preview ?? undefined,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    tags: row.tags,
    source: row.source ?? undefined,
    platforms: row.platforms,
    status: row.status,
    usageCount: row.usage_count,
    storageBucket: row.storage_bucket ?? undefined,
    mimeType: row.mime_type ?? undefined,
    sha256: row.sha256 ?? undefined,
    body: text?.body_markdown,
    bodyPreview: text?.body_preview,
    characterCount: text?.character_count,
    editable: kind === "image" ? ![".gif", ".svg"].includes(extension) : true,
  };
}

async function textRowsByAssetId(
  assetIds: string[],
  scope: DatabaseScope,
  supabase: NonNullable<ReturnType<typeof client>>,
) {
  if (assetIds.length === 0) {
    return new Map<string, ContentAssetTextRow>();
  }

  const { data, error } = await supabase
    .from("content_asset_texts")
    .select(
      "asset_id, workspace_id, project_id, body_markdown, body_preview, character_count",
    )
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .in("asset_id", assetIds);

  if (error) throw error;

  return new Map(
    ((data ?? []) as ContentAssetTextRow[]).map((row) => [row.asset_id, row]),
  );
}

export async function listDatabaseContentAssets(
  context?: StoreContext,
  filters?: { kind?: ContentAsset["kind"]; q?: string; tag?: string },
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  let query = supabase
    .from("content_assets")
    .select(contentAssetColumns)
    .eq("project_id", scope.projectId)
    .order("updated_at", { ascending: false });

  if (filters?.kind) {
    query = query.eq("kind", filters.kind);
  }

  if (filters?.tag) {
    query = query.contains("tags", [filters.tag]);
  }

  const { data, error } = await query;

  if (error) throw error;
  const rows = (data ?? []) as ContentAssetRow[];
  const textRows = await textRowsByAssetId(
    rows.map((row) => row.id),
    scope,
    supabase,
  );
  const assets = rows.map((row) => mapAsset(row, textRows.get(row.id)));

  if (!filters?.q?.trim()) {
    return assets;
  }

  const q = filters.q.trim().toLowerCase();
  return assets.filter((asset) =>
    [
      asset.title,
      asset.filename,
      asset.description,
      asset.preview,
      asset.body,
      ...(asset.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

export async function getDatabaseContentAsset(
  assetId: string,
  context?: StoreContext,
) {
  const assets = await listDatabaseContentAssets(context);
  return assets?.find((asset) => asset.id === assetId) ?? null;
}

function bodyPreview(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function insertDatabaseTextContentAsset(
  input: {
    title?: string;
    body?: string;
    tags?: string[];
    description?: string;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const body = input.body ?? "";
  const title = input.title?.trim() || "Untitled snippet";
  const { data, error } = await supabase
    .from("content_assets")
    .insert({
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
      kind: "text",
      original_filename: `${title}.md`,
      title,
      description: input.description ?? null,
      tags: input.tags ?? [],
      source: "repository",
      platforms: [],
      status: "ready",
      preview: bodyPreview(body),
      created_by: scope.userId,
    })
    .select(contentAssetColumns)
    .single();

  if (error) throw error;
  const assetRow = data as ContentAssetRow;
  const textRow: ContentAssetTextRow = {
    asset_id: assetRow.id,
    workspace_id: scope.workspaceId,
    project_id: scope.projectId,
    body_markdown: body,
    body_preview: bodyPreview(body),
    character_count: body.length,
  };

  const { error: textError } = await supabase
    .from("content_asset_texts")
    .insert(textRow);

  if (textError) throw textError;
  return mapAsset(assetRow, textRow);
}

export async function updateDatabaseTextContentAsset(
  assetId: string,
  patch: {
    title?: string;
    body?: string;
    tags?: string[];
    description?: string;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const current = await getDatabaseContentAsset(assetId, context);
  if (!current || current.kind !== "text") {
    return null;
  }

  const body = patch.body ?? current.body ?? "";
  const preview = bodyPreview(body);
  const { data, error } = await supabase
    .from("content_assets")
    .update({
      title: patch.title,
      description: patch.description,
      tags: patch.tags,
      preview,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("id", assetId)
    .eq("kind", "text")
    .select(contentAssetColumns)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const textValues = {
    asset_id: assetId,
    workspace_id: scope.workspaceId,
    project_id: scope.projectId,
    body_markdown: body,
    body_preview: preview,
    character_count: body.length,
    updated_at: new Date().toISOString(),
  };
  const { data: textData, error: textError } = await supabase
    .from("content_asset_texts")
    .upsert(textValues, { onConflict: "asset_id" })
    .select(
      "asset_id, workspace_id, project_id, body_markdown, body_preview, character_count",
    )
    .single();

  if (textError) throw textError;
  return mapAsset(data as ContentAssetRow, textData as ContentAssetTextRow);
}

export async function updateDatabaseContentAssetCurrentPath(
  assetId: string,
  input: {
    currentStoragePath: string;
    byteSize?: number;
    mimeType?: string;
    editState?: unknown;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("content_assets")
    .update({
      current_storage_path: input.currentStoragePath,
      byte_size: input.byteSize,
      mime_type: input.mimeType,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("id", assetId)
    .eq("kind", "image")
    .select(contentAssetColumns)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { error: editError } = await supabase
    .from("content_asset_image_edits")
    .upsert(
      {
        asset_id: assetId,
        workspace_id: scope.workspaceId,
        project_id: scope.projectId,
        edited_storage_path: input.currentStoragePath,
        edit_state: input.editState ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "asset_id" },
    );

  if (editError) throw editError;
  return mapAsset(data as ContentAssetRow);
}

export async function prepareDatabaseContentAssetUpload(
  input: {
    filename: string;
    storageBucket: string;
    mimeType?: string;
    kind?: ContentAsset["kind"];
  },
  context?: StoreContext,
): Promise<PreparedDatabaseContentAssetUpload | null> {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "prepare_content_asset_upload",
    {
      p_workspace_id: scope.workspaceId,
      p_project_id: scope.projectId,
      p_user_id: scope.userId,
      p_storage_bucket: input.storageBucket,
      p_original_filename: input.filename,
      p_mime_type: input.mimeType ?? null,
      p_kind: input.kind ?? getAssetType(input.filename),
    },
  );

  if (!rpcError && rpcData) {
    return rpcData as PreparedDatabaseContentAssetUpload;
  }

  const { data, error } = await supabase
    .from("content_assets")
    .insert({
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
      kind: input.kind ?? getAssetType(input.filename),
      storage_bucket: input.storageBucket,
      mime_type: input.mimeType,
      original_filename: input.filename,
      title: input.filename,
      source: "upload",
      platforms: ["x", "reddit", "hacker-news"],
      status: "uploading",
      created_by: scope.userId,
    })
    .select("id, workspace_id, project_id, original_filename, storage_bucket")
    .single();

  if (error) throw error;

  const asset = data as ContentAssetRow;
  const storagePath = `${scope.userId}/${asset.workspace_id ?? scope.workspaceId}/${asset.project_id}/${asset.id}/original/${asset.original_filename}`;

  return {
    assetId: asset.id,
    workspaceId: asset.workspace_id ?? scope.workspaceId,
    projectId: asset.project_id,
    filename: asset.original_filename,
    storageBucket: asset.storage_bucket ?? input.storageBucket,
    storagePath,
  };
}

export async function insertDatabaseContentAsset(
  input: {
    assetId?: string;
    filename: string;
    path: string;
    size: number;
    type?: ContentAsset["type"];
    kind?: ContentAsset["kind"];
    preview?: string;
    storageBucket?: string;
    mimeType?: string;
    sha256?: string;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const values = {
    workspace_id: scope.workspaceId,
    project_id: scope.projectId,
    kind: input.kind ?? input.type ?? getAssetType(input.filename),
    storage_bucket: input.storageBucket,
    storage_path: input.path,
    current_storage_path: input.path,
    byte_size: input.size,
    mime_type: input.mimeType,
    sha256: input.sha256,
    original_filename: input.filename,
    preview: input.preview,
    title: input.filename,
    source: "upload",
    platforms: ["x", "reddit", "hacker-news"],
    status: "ready",
    created_by: scope.userId,
  };

  if (input.assetId) {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "complete_content_asset_upload",
      {
        p_workspace_id: scope.workspaceId,
        p_project_id: scope.projectId,
        p_asset_id: input.assetId,
        p_storage_bucket: input.storageBucket ?? null,
        p_storage_path: input.path,
        p_byte_size: input.size,
        p_mime_type: input.mimeType ?? null,
        p_sha256: input.sha256 ?? null,
        p_preview: input.preview ?? null,
      },
    );

    if (!rpcError && rpcData) {
      return mapAsset(rpcData as ContentAssetRow);
    }
  }

  const query = input.assetId
    ? supabase
        .from("content_assets")
        .update({
          storage_bucket: values.storage_bucket,
          storage_path: values.storage_path,
          current_storage_path: values.current_storage_path,
          kind: values.kind,
          byte_size: values.byte_size,
          mime_type: values.mime_type,
          sha256: values.sha256,
          preview: values.preview,
          title: values.title,
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("id", input.assetId)
    : supabase.from("content_assets").insert(values);

  const { data, error } = await query.select(contentAssetColumns).single();

  if (error) throw error;
  return mapAsset(data as ContentAssetRow);
}

export async function updateDatabaseContentAsset(
  assetId: string,
  patch: Partial<
    Pick<
      ContentAsset,
      "title" | "description" | "tags" | "source" | "platforms" | "status"
    >
  >,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("content_assets")
    .update({
      title: patch.title,
      description: patch.description,
      tags: patch.tags,
      source: patch.source,
      platforms: patch.platforms,
      status: patch.status,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", scope.projectId)
    .eq("id", assetId)
    .select(contentAssetColumns)
    .maybeSingle();

  if (error) throw error;
  return data ? mapAsset(data as ContentAssetRow) : null;
}

export async function deleteDatabaseContentAsset(
  assetId: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "request_content_asset_delete_with_outbox",
    {
      p_workspace_id: scope.workspaceId,
      p_project_id: scope.projectId,
      p_asset_id: assetId,
    },
  );

  if (!rpcError && typeof rpcData === "boolean") {
    return rpcData;
  }

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("content_assets")
    .update({ status: "deleting", updated_at: timestamp })
    .eq("project_id", scope.projectId)
    .eq("id", assetId)
    .select("id, storage_path, current_storage_path")
    .maybeSingle();

  if (error) throw error;
  if (!data) return false;

  const { error: outboxError } = await supabase.from("outbox_events").insert({
    workspace_id: scope.workspaceId,
    project_id: scope.projectId,
    event_type: "storage.delete",
    aggregate_type: "content_asset",
    aggregate_id: assetId,
    payload: {
      storagePath: data.storage_path,
      currentStoragePath: data.current_storage_path,
    },
    idempotency_key: `storage.delete:${assetId}`,
    available_at: timestamp,
  });

  if (outboxError) throw outboxError;
  return true;
}

export async function completeDatabaseContentAssetDeletion(
  assetId: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("content_assets")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("id", assetId)
    .select(contentAssetColumns)
    .maybeSingle();

  if (error) throw error;
  return data ? mapAsset(data as ContentAssetRow) : null;
}

export async function markDatabaseContentAssetFailed(
  assetId: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "mark_content_asset_upload_failed",
    {
      p_workspace_id: scope.workspaceId,
      p_project_id: scope.projectId,
      p_asset_id: assetId,
    },
  );

  if (!rpcError && typeof rpcData === "boolean") {
    return rpcData;
  }

  const { error } = await supabase
    .from("content_assets")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("id", assetId);

  if (error) throw error;
  return true;
}

function mapPublishedContent(
  row: PublishedContentRow,
  targets: PlatformTargetRow[],
): PublishedContent {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    body: row.body,
    assetIds: row.asset_ids,
    sourceTrendPostId: row.source_trend_post_id ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    platformTargets: targets
      .filter((target) => target.published_content_id === row.id)
      .map((target) => ({
        id: target.id,
        publishedContentId: target.published_content_id,
        platform: target.platform,
        status: target.status,
        bodyOverride: target.body_override ?? undefined,
        scheduledAt: target.scheduled_at ?? undefined,
        publishedAt: target.published_at ?? undefined,
        platformContentId: target.platform_content_id ?? undefined,
        platformUrl: target.platform_url ?? undefined,
        lastError: target.last_error ?? undefined,
        retryCount: target.retry_count,
        updatedAt: target.updated_at,
      })),
  };
}

function mapRpcPublishedContent(result: RpcPublishedContentResult) {
  return mapPublishedContent(result.content, result.targets);
}

export async function listDatabasePublishedContent(context?: StoreContext) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const [
    { data: contentRows, error: contentError },
    { data: targetRows, error: targetError },
  ] = await Promise.all([
    supabase
      .from("published_contents")
      .select(
        "id, project_id, title, body, asset_ids, source_trend_post_id, status, created_at, updated_at",
      )
      .eq("project_id", scope.projectId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("platform_publish_targets")
      .select(
        "id, published_content_id, platform, status, body_override, scheduled_at, published_at, platform_content_id, platform_url, last_error, retry_count, updated_at",
      )
      .eq("project_id", scope.projectId),
  ]);

  if (contentError) throw contentError;
  if (targetError) throw targetError;

  return ((contentRows ?? []) as PublishedContentRow[]).map((content) =>
    mapPublishedContent(content, (targetRows ?? []) as PlatformTargetRow[]),
  );
}

export async function insertDatabasePublishedContent(
  input: {
    title: string;
    body: string;
    assetIds?: string[];
    sourceTrendPostId?: string;
    platforms?: GrowthPlatform[];
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const timestamp = new Date().toISOString();
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_published_content_with_targets",
    {
      p_workspace_id: scope.workspaceId,
      p_project_id: scope.projectId,
      p_user_id: scope.userId,
      p_title: input.title,
      p_body: input.body,
      p_asset_ids: input.assetIds ?? [],
      p_source_trend_post_id: input.sourceTrendPostId ?? null,
      p_platforms: input.platforms?.length
        ? input.platforms
        : ["x", "reddit", "wechat"],
    },
  );

  if (!rpcError && rpcData) {
    return mapRpcPublishedContent(rpcData as RpcPublishedContentResult);
  }

  const { data: contentRow, error: contentError } = await supabase
    .from("published_contents")
    .insert({
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
      title: input.title,
      body: input.body,
      asset_ids: input.assetIds ?? [],
      source_trend_post_id: input.sourceTrendPostId,
      status: "draft",
      created_by: scope.userId,
    })
    .select(
      "id, project_id, title, body, asset_ids, source_trend_post_id, status, created_at, updated_at",
    )
    .single();

  if (contentError) throw contentError;

  const platforms = input.platforms?.length
    ? input.platforms
    : (["x", "reddit", "wechat"] satisfies GrowthPlatform[]);
  const { data: targetRows, error: targetError } = await supabase
    .from("platform_publish_targets")
    .insert(
      platforms.map((platform) => ({
        workspace_id: scope.workspaceId,
        project_id: scope.projectId,
        published_content_id: contentRow.id,
        platform,
        status: "draft",
        body_override: input.body,
        updated_at: timestamp,
      })),
    )
    .select(
      "id, published_content_id, platform, status, body_override, scheduled_at, published_at, platform_content_id, platform_url, last_error, retry_count, updated_at",
    );

  if (targetError) throw targetError;

  return mapPublishedContent(
    contentRow as PublishedContentRow,
    (targetRows ?? []) as PlatformTargetRow[],
  );
}

export async function updateDatabasePublishedContent(
  contentId: string,
  patch: Partial<
    Pick<
      PublishedContent,
      "title" | "body" | "assetIds" | "sourceTrendPostId" | "status"
    >
  > & {
    platformTargets?: Array<Pick<PlatformPublishTarget, "id" | "bodyOverride">>;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("published_contents")
    .update({
      title: patch.title,
      body: patch.body,
      asset_ids: patch.assetIds,
      source_trend_post_id: patch.sourceTrendPostId,
      status: patch.status,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", scope.projectId)
    .eq("id", contentId)
    .select(
      "id, project_id, title, body, asset_ids, source_trend_post_id, status, created_at, updated_at",
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  if (patch.platformTargets?.length) {
    const timestamp = new Date().toISOString();
    const targetUpdates = await Promise.all(
      patch.platformTargets.map((target) =>
        supabase
          .from("platform_publish_targets")
          .update({
            body_override: target.bodyOverride,
            updated_at: timestamp,
          })
          .eq("workspace_id", scope.workspaceId)
          .eq("project_id", scope.projectId)
          .eq("published_content_id", contentId)
          .eq("id", target.id),
      ),
    );
    const targetUpdateError = targetUpdates.find((result) => result.error);
    if (targetUpdateError?.error) throw targetUpdateError.error;
  }

  const { data: targets, error: targetError } = await supabase
    .from("platform_publish_targets")
    .select(
      "id, published_content_id, platform, status, body_override, scheduled_at, published_at, platform_content_id, platform_url, last_error, retry_count, updated_at",
    )
    .eq("published_content_id", contentId);

  if (targetError) throw targetError;
  return mapPublishedContent(
    data as PublishedContentRow,
    (targets ?? []) as PlatformTargetRow[],
  );
}

export async function getDatabasePublishedContent(
  contentId: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const [
    { data: contentRow, error: contentError },
    { data: targetRows, error: targetError },
  ] = await Promise.all([
    supabase
      .from("published_contents")
      .select(
        "id, project_id, title, body, asset_ids, source_trend_post_id, status, created_at, updated_at",
      )
      .eq("project_id", scope.projectId)
      .eq("id", contentId)
      .maybeSingle(),
    supabase
      .from("platform_publish_targets")
      .select(
        "id, published_content_id, platform, status, body_override, scheduled_at, published_at, platform_content_id, platform_url, last_error, retry_count, updated_at",
      )
      .eq("project_id", scope.projectId)
      .eq("published_content_id", contentId),
  ]);

  if (contentError) throw contentError;
  if (targetError) throw targetError;
  return contentRow
    ? mapPublishedContent(
        contentRow as PublishedContentRow,
        (targetRows ?? []) as PlatformTargetRow[],
      )
    : null;
}

export async function deleteDatabasePublishedContent(
  contentId: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { error, count } = await supabase
    .from("published_contents")
    .delete({ count: "exact" })
    .eq("workspace_id", scope.workspaceId)
    .eq("project_id", scope.projectId)
    .eq("id", contentId);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function scheduleDatabasePublishedContent(
  contentId: string,
  scheduledAt: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "schedule_published_content_with_outbox",
    {
      p_workspace_id: scope.workspaceId,
      p_project_id: scope.projectId,
      p_content_id: contentId,
      p_scheduled_at: scheduledAt,
    },
  );

  if (!rpcError && rpcData) {
    return mapRpcPublishedContent(rpcData as RpcPublishedContentResult);
  }

  const timestamp = new Date().toISOString();
  const [
    { error: contentError },
    { error: targetError },
    { error: outboxError },
  ] = await Promise.all([
    supabase
      .from("published_contents")
      .update({ status: "scheduled", updated_at: timestamp })
      .eq("project_id", scope.projectId)
      .eq("id", contentId),
    supabase
      .from("platform_publish_targets")
      .update({
        status: "scheduled",
        scheduled_at: scheduledAt,
        updated_at: timestamp,
      })
      .eq("project_id", scope.projectId)
      .eq("published_content_id", contentId),
    supabase.from("outbox_events").insert({
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
      event_type: "publish.schedule",
      aggregate_type: "published_content",
      aggregate_id: contentId,
      payload: { scheduledAt },
      idempotency_key: `publish.schedule:${contentId}:${scheduledAt}`,
      available_at: scheduledAt,
    }),
  ]);

  if (contentError) throw contentError;
  if (targetError) throw targetError;
  if (outboxError) throw outboxError;
  return getDatabasePublishedContent(contentId, context);
}

export async function markDatabasePublishStarted(
  contentId: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const timestamp = new Date().toISOString();
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "request_publish_content_with_outbox",
    {
      p_workspace_id: scope.workspaceId,
      p_project_id: scope.projectId,
      p_content_id: contentId,
      p_event_type: "publish.execute",
      p_idempotency_key: `publish.execute:${contentId}:${timestamp}`,
    },
  );

  if (!rpcError && rpcData) {
    return mapRpcPublishedContent(rpcData as RpcPublishedContentResult);
  }

  const [
    { error: contentError },
    { error: targetError },
    { error: outboxError },
  ] = await Promise.all([
    supabase
      .from("published_contents")
      .update({ status: "publishing", updated_at: timestamp })
      .eq("project_id", scope.projectId)
      .eq("id", contentId),
    supabase
      .from("platform_publish_targets")
      .update({ status: "publishing", updated_at: timestamp })
      .eq("project_id", scope.projectId)
      .eq("published_content_id", contentId),
    supabase.from("outbox_events").insert({
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
      event_type: "publish.execute",
      aggregate_type: "published_content",
      aggregate_id: contentId,
      payload: { requestedAt: timestamp },
      idempotency_key: `publish.execute:${contentId}:${timestamp}`,
      available_at: timestamp,
    }),
  ]);

  if (contentError) throw contentError;
  if (targetError) throw targetError;
  if (outboxError) throw outboxError;
  return getDatabasePublishedContent(contentId, context);
}

export async function completeDatabasePublishedTarget(
  targetId: string,
  result: {
    platformContentId: string;
    platformUrl: string;
    publishedAt: string;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("platform_publish_targets")
    .update({
      status: "published",
      platform_content_id: result.platformContentId,
      platform_url: result.platformUrl,
      published_at: result.publishedAt,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", scope.projectId)
    .eq("id", targetId)
    .select("published_content_id")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  await supabase
    .from("published_contents")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("project_id", scope.projectId)
    .eq("id", data.published_content_id);

  return getDatabasePublishedContent(data.published_content_id, context);
}

export async function retryDatabasePublishedContent(
  contentId: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const timestamp = new Date().toISOString();
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "request_publish_content_with_outbox",
    {
      p_workspace_id: scope.workspaceId,
      p_project_id: scope.projectId,
      p_content_id: contentId,
      p_event_type: "publish.retry",
      p_idempotency_key: `publish.retry:${contentId}:${timestamp}`,
    },
  );

  if (!rpcError && rpcData) {
    return mapRpcPublishedContent(rpcData as RpcPublishedContentResult);
  }

  const [
    { error: contentError },
    { error: targetError },
    { error: outboxError },
  ] = await Promise.all([
    supabase
      .from("published_contents")
      .update({ status: "publishing", updated_at: timestamp })
      .eq("project_id", scope.projectId)
      .eq("id", contentId),
    supabase
      .from("platform_publish_targets")
      .update({
        status: "publishing",
        retry_count: 1,
        updated_at: timestamp,
      })
      .eq("project_id", scope.projectId)
      .eq("published_content_id", contentId)
      .eq("status", "failed"),
    supabase.from("outbox_events").insert({
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
      event_type: "publish.retry",
      aggregate_type: "published_content",
      aggregate_id: contentId,
      payload: { requestedAt: timestamp },
      idempotency_key: `publish.retry:${contentId}:${timestamp}`,
      available_at: timestamp,
    }),
  ]);

  if (contentError) throw contentError;
  if (targetError) throw targetError;
  if (outboxError) throw outboxError;
  return getDatabasePublishedContent(contentId, context);
}

function completeMetrics(input: Partial<EngagementMetrics>): EngagementMetrics {
  return {
    views: input.views ?? 0,
    likes: input.likes ?? 0,
    comments: input.comments ?? 0,
    shares: input.shares ?? 0,
    bookmarks: input.bookmarks ?? 0,
    clicks: input.clicks ?? 0,
  };
}

function mapEngagementSnapshot(row: EngagementSnapshotRow): EngagementSnapshot {
  return {
    id: row.id,
    projectId: row.project_id,
    publishedContentId: row.published_content_id,
    platformTargetId: row.platform_target_id,
    platform: row.platform,
    platformContentId: row.platform_content_id ?? undefined,
    capturedAt: row.captured_at,
    metrics: completeMetrics(row.metrics),
    platformMetrics: row.platform_metrics ?? undefined,
    rawPayload: row.raw_payload,
    error: row.error ?? undefined,
  };
}

export async function insertDatabaseEngagementSnapshot(
  input: Omit<EngagementSnapshot, "id" | "capturedAt" | "projectId">,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("engagement_snapshots")
    .insert({
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
      published_content_id: input.publishedContentId,
      platform_target_id: input.platformTargetId,
      platform: input.platform,
      platform_content_id: input.platformContentId,
      metrics: input.metrics,
      platform_metrics: input.platformMetrics,
      raw_payload: input.rawPayload,
      error: input.error,
    })
    .select(
      "id, project_id, published_content_id, platform_target_id, platform, platform_content_id, captured_at, metrics, platform_metrics, raw_payload, error",
    )
    .single();

  if (error) throw error;
  return mapEngagementSnapshot(data as EngagementSnapshotRow);
}

export async function listDatabaseEngagementSnapshots(context?: StoreContext) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("engagement_snapshots")
    .select(
      "id, project_id, published_content_id, platform_target_id, platform, platform_content_id, captured_at, metrics, platform_metrics, raw_payload, error",
    )
    .eq("project_id", scope.projectId)
    .order("captured_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as EngagementSnapshotRow[]).map(mapEngagementSnapshot);
}

function mapTrendQuery(row: TrendQueryRow): TrendQuery {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    keywords: row.keywords,
    excludedKeywords: row.excluded_keywords,
    platforms: row.platforms,
    language: row.language ?? undefined,
    timeRange: row.time_range,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrendRun(row: TrendRunRow): TrendRun {
  return {
    id: row.id,
    queryId: row.trend_query_id,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    platforms: row.platforms,
    resultCount: row.result_count,
    errors: row.error_summary ?? [],
  };
}

function mapTrendPost(row: TrendPostRow): TrendPost {
  return {
    id: row.id,
    projectId: row.project_id,
    queryId: row.trend_query_id,
    runId: row.trend_run_id,
    platform: row.platform,
    platformPostId: row.platform_post_id,
    url: row.url,
    title: row.title,
    summary: row.summary,
    author: row.author,
    postedAt: row.posted_at,
    capturedAt: row.captured_at,
    matchedKeywords: row.matched_keywords,
    metrics: row.metrics,
    relevanceScore: Number(row.relevance_score),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDatabaseTrendQueries(context?: StoreContext) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("trend_queries")
    .select(
      "id, project_id, name, keywords, excluded_keywords, platforms, language, time_range, created_at, updated_at",
    )
    .eq("project_id", scope.projectId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as TrendQueryRow[]).map(mapTrendQuery);
}

export async function insertDatabaseTrendQuery(
  input: {
    name: string;
    keywords: string[];
    excludedKeywords?: string[];
    platforms: GrowthPlatform[];
    language?: string;
    timeRange?: TrendQuery["timeRange"];
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("trend_queries")
    .insert({
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
      name: input.name,
      keywords: input.keywords,
      excluded_keywords: input.excludedKeywords ?? [],
      platforms: input.platforms,
      language: input.language,
      time_range: input.timeRange ?? "7d",
      created_by: scope.userId,
    })
    .select(
      "id, project_id, name, keywords, excluded_keywords, platforms, language, time_range, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapTrendQuery(data as TrendQueryRow);
}

export async function updateDatabaseTrendQuery(
  queryId: string,
  patch: Partial<Omit<TrendQuery, "id" | "projectId" | "createdAt">>,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("trend_queries")
    .update({
      name: patch.name,
      keywords: patch.keywords,
      excluded_keywords: patch.excludedKeywords,
      platforms: patch.platforms,
      language: patch.language,
      time_range: patch.timeRange,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", scope.projectId)
    .eq("id", queryId)
    .select(
      "id, project_id, name, keywords, excluded_keywords, platforms, language, time_range, created_at, updated_at",
    )
    .maybeSingle();

  if (error) throw error;
  return data ? mapTrendQuery(data as TrendQueryRow) : null;
}

export async function deleteDatabaseTrendQuery(
  queryId: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { error } = await supabase
    .from("trend_queries")
    .delete()
    .eq("project_id", scope.projectId)
    .eq("id", queryId);

  if (error) throw error;
  return true;
}

export async function insertDatabaseTrendRun(
  query: TrendQuery,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_trend_run_with_outbox",
    {
      p_workspace_id: scope.workspaceId,
      p_project_id: scope.projectId,
      p_query_id: query.id,
    },
  );

  if (!rpcError && rpcData) {
    return mapTrendRun(rpcData as TrendRunRow);
  }

  const { data, error } = await supabase
    .from("trend_runs")
    .insert({
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
      trend_query_id: query.id,
      status: "running",
      platforms: query.platforms,
      result_count: 0,
    })
    .select(
      "id, trend_query_id, status, started_at, finished_at, platforms, result_count, error_summary",
    )
    .single();

  if (error) throw error;

  const run = mapTrendRun(data as TrendRunRow);
  const { error: outboxError } = await supabase.from("outbox_events").insert({
    workspace_id: scope.workspaceId,
    project_id: scope.projectId,
    event_type: "trends.run",
    aggregate_type: "trend_run",
    aggregate_id: run.id,
    payload: { queryId: query.id, platforms: query.platforms },
    idempotency_key: `trends.run:${run.id}`,
  });

  if (outboxError) throw outboxError;
  return run;
}

export async function finishDatabaseTrendRun(
  runId: string,
  posts: TrendPost[],
  errors: string[],
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const timestamp = new Date().toISOString();
  const { data: insertedPosts, error: postsError } = await supabase
    .from("trend_posts")
    .upsert(
      posts.map((post) => ({
        workspace_id: scope.workspaceId,
        project_id: scope.projectId,
        trend_query_id: post.queryId,
        trend_run_id: runId,
        platform: post.platform,
        platform_post_id: post.platformPostId,
        url: post.url,
        title: post.title,
        summary: post.summary,
        author: post.author,
        posted_at: post.postedAt,
        captured_at: post.capturedAt,
        matched_keywords: post.matchedKeywords,
        metrics: post.metrics,
        relevance_score: post.relevanceScore,
        status: post.status,
        updated_at: timestamp,
      })),
      { onConflict: "platform,platform_post_id" },
    )
    .select(
      "id, project_id, trend_query_id, trend_run_id, platform, platform_post_id, url, title, summary, author, posted_at, captured_at, matched_keywords, metrics, relevance_score, status, created_at, updated_at",
    );

  if (postsError) throw postsError;

  const { data: runRow, error: runError } = await supabase
    .from("trend_runs")
    .update({
      status: errors.length ? "failed" : "succeeded",
      finished_at: timestamp,
      result_count: insertedPosts?.length ?? 0,
      error_summary: errors,
    })
    .eq("project_id", scope.projectId)
    .eq("id", runId)
    .select(
      "id, trend_query_id, status, started_at, finished_at, platforms, result_count, error_summary",
    )
    .single();

  if (runError) throw runError;
  return {
    run: mapTrendRun(runRow as TrendRunRow),
    posts: ((insertedPosts ?? []) as TrendPostRow[]).map(mapTrendPost),
  };
}

export async function listDatabaseTrendPosts(context?: StoreContext) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("trend_posts")
    .select(
      "id, project_id, trend_query_id, trend_run_id, platform, platform_post_id, url, title, summary, author, posted_at, captured_at, matched_keywords, metrics, relevance_score, status, created_at, updated_at",
    )
    .eq("project_id", scope.projectId)
    .order("relevance_score", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as TrendPostRow[]).map(mapTrendPost);
}

export async function updateDatabaseTrendPost(
  postId: string,
  patch: Partial<
    Pick<TrendPost, "status" | "summary" | "title" | "matchedKeywords">
  >,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("trend_posts")
    .update({
      status: patch.status,
      summary: patch.summary,
      title: patch.title,
      matched_keywords: patch.matchedKeywords,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", scope.projectId)
    .eq("id", postId)
    .select(
      "id, project_id, trend_query_id, trend_run_id, platform, platform_post_id, url, title, summary, author, posted_at, captured_at, matched_keywords, metrics, relevance_score, status, created_at, updated_at",
    )
    .maybeSingle();

  if (error) throw error;
  return data ? mapTrendPost(data as TrendPostRow) : null;
}

export async function createDatabaseResponseDraftFromTrendPost(
  postId: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_response_draft_from_trend_post",
    {
      p_workspace_id: scope.workspaceId,
      p_project_id: scope.projectId,
      p_post_id: postId,
      p_user_id: scope.userId,
    },
  );

  if (!rpcError && rpcData) {
    const result = rpcData as RpcResponseDraftResult;
    return {
      post: mapTrendPost(result.post),
      draft: mapPublishedContent(result.draft, result.targets),
    };
  }

  const post = await updateDatabaseTrendPost(
    postId,
    { status: "responded" },
    context,
  );

  if (!post) return null;

  const draft = await insertDatabasePublishedContent(
    {
      title: `Response: ${post.title}`,
      body: `Reply to ${post.platform} post ${post.url}\n\n${post.summary}`,
      sourceTrendPostId: post.id,
      platforms: [post.platform],
    },
    context,
  );

  if (!draft) return null;
  return { post, draft };
}

export async function listDatabaseOutboxEvents(context?: StoreContext) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("outbox_events")
    .select(
      "id, workspace_id, project_id, event_type, aggregate_type, aggregate_id, payload, status, attempts, idempotency_key, available_at, last_error, created_at, updated_at",
    )
    .eq("workspace_id", scope.workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (
    (data ?? []) as Array<{
      id: string;
      workspace_id: string;
      project_id: string | null;
      event_type: string;
      aggregate_type: string;
      aggregate_id: string;
      payload: Record<string, unknown>;
      status: OutboxEventRecord["status"];
      attempts: number;
      idempotency_key: string;
      available_at: string;
      last_error: string | null;
      created_at: string;
      updated_at: string;
    }>
  ).map((event) => ({
    id: event.id,
    workspaceId: event.workspace_id,
    projectId: event.project_id,
    eventType: event.event_type,
    aggregateType: event.aggregate_type,
    aggregateId: event.aggregate_id,
    payload: event.payload,
    status: event.status,
    attempts: event.attempts,
    idempotencyKey: event.idempotency_key,
    availableAt: event.available_at,
    lastError: event.last_error ?? undefined,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  }));
}

function mapConnectorAccount(
  account: ConnectorAccountRow,
  enabledForWorkspace = false,
): ConnectorAccount {
  return {
    id: account.id,
    workspaceId: account.workspace_id,
    userId: account.user_id,
    platform: account.platform,
    identityKind: account.identity_kind ?? "publishing",
    authMode: account.auth_mode ?? "oauth",
    useCases: account.use_cases ?? ["publish", "reply", "engagement"],
    ownerScope: account.owner_scope ?? "user",
    status: account.status as ConnectorAccount["status"],
    hasCredentialRef: Boolean(account.credential_ref),
    displayName: account.display_name ?? undefined,
    platformAccountId: account.platform_account_id ?? undefined,
    adapterBackend: account.adapter_backend ?? undefined,
    expiresAt: account.expires_at ?? undefined,
    lastVerifiedAt: account.last_verified_at ?? undefined,
    lastError: account.last_error ?? undefined,
    enabledForWorkspace,
    createdAt: account.created_at,
    updatedAt: account.updated_at,
  };
}

export async function listDatabaseConnectorAccounts(context?: StoreContext) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data: publishingData, error: publishingError } = await supabase
    .from("connector_accounts")
    .select(connectorAccountColumns)
    .eq("identity_kind", "publishing")
    .eq("user_id", scope.userId)
    .order("created_at", { ascending: false });

  if (publishingError) throw publishingError;

  const { data: enabledData, error: enabledError } = await supabase
    .from("workspace_connector_accounts")
    .select("connector_account_id")
    .eq("workspace_id", scope.workspaceId);

  if (enabledError) throw enabledError;

  const enabledIds = new Set(
    ((enabledData ?? []) as Array<{ connector_account_id: string }>).map(
      (row) => row.connector_account_id,
    ),
  );
  const enabledAccountIds = [...enabledIds];
  const enabledAccounts =
    enabledAccountIds.length > 0
      ? await supabase
          .from("connector_accounts")
          .select(connectorAccountColumns)
          .in("id", enabledAccountIds)
      : { data: [], error: null };

  if (enabledAccounts.error) throw enabledAccounts.error;

  const { data: collectorData, error: collectorError } = await supabase
    .from("connector_accounts")
    .select(connectorAccountColumns)
    .eq("identity_kind", "collector")
    .or(`workspace_id.eq.${scope.workspaceId},owner_scope.eq.system`)
    .order("created_at", { ascending: false });

  if (collectorError) throw collectorError;

  const byId = new Map<string, ConnectorAccount>();
  for (const account of [
    ...((publishingData ?? []) as ConnectorAccountRow[]),
    ...((enabledAccounts.data ?? []) as ConnectorAccountRow[]),
    ...((collectorData ?? []) as ConnectorAccountRow[]),
  ]) {
    byId.set(
      account.id,
      mapConnectorAccount(account, enabledIds.has(account.id)),
    );
  }

  return [...byId.values()];
}

async function findConnectorAccount(input: {
  platform: GrowthPlatform;
  identityKind: ConnectorIdentityKind;
  userId?: string | null;
  workspaceId?: string | null;
  ownerScope?: ConnectorOwnerScope;
}) {
  const supabase = client();
  if (!supabase) return null;

  let query = supabase
    .from("connector_accounts")
    .select(connectorAccountColumns)
    .eq("platform", input.platform)
    .eq("identity_kind", input.identityKind);

  if (input.userId !== undefined) {
    query =
      input.userId === null
        ? query.is("user_id", null)
        : query.eq("user_id", input.userId);
  }

  if (input.workspaceId !== undefined) {
    query =
      input.workspaceId === null
        ? query.is("workspace_id", null)
        : query.eq("workspace_id", input.workspaceId);
  }

  if (input.ownerScope) {
    query = query.eq("owner_scope", input.ownerScope);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as ConnectorAccountRow | null;
}

export async function upsertDatabasePublishingIdentity(
  input: {
    platform: GrowthPlatform;
    status?: ConnectorAccount["status"];
    credentialRef?: string;
    displayName?: string;
    platformAccountId?: string;
    authMode?: ConnectorAuthMode;
    useCases?: ConnectorUseCase[];
    expiresAt?: string;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const existing = await findConnectorAccount({
    platform: input.platform,
    identityKind: "publishing",
    userId: scope.userId,
  });
  const row = {
    workspace_id: null,
    user_id: scope.userId,
    platform: input.platform,
    identity_kind: "publishing",
    auth_mode: input.authMode ?? "oauth",
    use_cases: input.useCases ?? ["publish", "reply", "engagement"],
    owner_scope: "user",
    status: input.status ?? "active",
    credential_ref: input.credentialRef ?? null,
    display_name: input.displayName ?? null,
    platform_account_id: input.platformAccountId ?? null,
    adapter_backend: "official_api",
    expires_at: input.expiresAt ?? null,
  };

  const query = existing
    ? supabase.from("connector_accounts").update(row).eq("id", existing.id)
    : supabase.from("connector_accounts").insert(row);

  const { data, error } = await query.select(connectorAccountColumns).single();

  if (error) throw error;

  return mapConnectorAccount(data as ConnectorAccountRow);
}

export async function upsertDatabaseCollectorIdentity(
  input: {
    platform: GrowthPlatform;
    status?: ConnectorAccount["status"];
    credentialRef?: string;
    displayName?: string;
    authMode?: ConnectorAuthMode;
    useCases?: ConnectorUseCase[];
    ownerScope?: ConnectorOwnerScope;
    adapterBackend?: ConnectorAdapterBackend;
    expiresAt?: string;
    lastVerifiedAt?: string;
    lastError?: string | null;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const ownerScope = input.ownerScope ?? "workspace";
  const workspaceId = ownerScope === "system" ? null : scope.workspaceId;
  const existing = await findConnectorAccount({
    platform: input.platform,
    identityKind: "collector",
    workspaceId,
    ownerScope,
  });
  const row = {
    workspace_id: workspaceId,
    user_id: null,
    platform: input.platform,
    identity_kind: "collector",
    auth_mode: input.authMode ?? "api_key",
    use_cases: input.useCases ?? ["trends", "read"],
    owner_scope: ownerScope,
    status: input.status ?? "active",
    credential_ref: input.credentialRef ?? null,
    display_name: input.displayName ?? null,
    platform_account_id: null,
    adapter_backend: input.adapterBackend ?? "official_api",
    expires_at: input.expiresAt ?? null,
    last_verified_at: input.lastVerifiedAt ?? null,
    last_error: input.lastError ?? null,
  };

  const query = existing
    ? supabase.from("connector_accounts").update(row).eq("id", existing.id)
    : supabase.from("connector_accounts").insert(row);

  const { data, error } = await query.select(connectorAccountColumns).single();

  if (error) throw error;

  return mapConnectorAccount(data as ConnectorAccountRow);
}

export async function setDatabaseWorkspacePublishingIdentityEnabled(
  connectorAccountId: string,
  enabled: boolean,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  if (!enabled) {
    const { error } = await supabase
      .from("workspace_connector_accounts")
      .delete()
      .eq("workspace_id", scope.workspaceId)
      .eq("connector_account_id", connectorAccountId);

    if (error) throw error;
    return { connectorAccountId, enabled: false };
  }

  const { error } = await supabase.from("workspace_connector_accounts").upsert(
    {
      workspace_id: scope.workspaceId,
      connector_account_id: connectorAccountId,
      enabled_by: scope.userId,
    },
    { onConflict: "workspace_id,connector_account_id" },
  );

  if (error) throw error;

  return { connectorAccountId, enabled: true };
}

function mapConnectorOAuthAuthorization(
  row: ConnectorOAuthAuthorizationRow,
): ConnectorOAuthAuthorizationRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    platform: row.platform,
    state: row.state,
    codeVerifier: row.code_verifier ?? undefined,
    redirectTo: row.redirect_to ?? undefined,
    status: row.status,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function insertDatabaseConnectorOAuthAuthorization(
  input: {
    platform: GrowthPlatform;
    state: string;
    codeVerifier?: string;
    redirectTo?: string;
    expiresAt: string;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("connector_oauth_authorizations")
    .insert({
      workspace_id: scope.workspaceId,
      user_id: scope.userId,
      platform: input.platform,
      state: input.state,
      code_verifier: input.codeVerifier ?? null,
      redirect_to: input.redirectTo ?? null,
      status: "pending",
      expires_at: input.expiresAt,
    })
    .select(
      "id, workspace_id, user_id, platform, state, code_verifier, redirect_to, status, expires_at, consumed_at, created_at",
    )
    .single();

  if (error) throw error;
  return mapConnectorOAuthAuthorization(data as ConnectorOAuthAuthorizationRow);
}

export async function consumeDatabaseConnectorOAuthAuthorization(input: {
  platform: GrowthPlatform;
  state: string;
}) {
  const supabase = client();

  if (!supabase) return null;

  const columns =
    "id, workspace_id, user_id, platform, state, code_verifier, redirect_to, status, expires_at, consumed_at, created_at";
  const { data: existing, error: readError } = await supabase
    .from("connector_oauth_authorizations")
    .select(columns)
    .eq("platform", input.platform)
    .eq("state", input.state)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (readError) throw readError;
  if (!existing) return null;

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("connector_oauth_authorizations")
    .update({
      status: "consumed",
      consumed_at: timestamp,
    })
    .eq("id", (existing as ConnectorOAuthAuthorizationRow).id)
    .select(columns)
    .single();

  if (error) throw error;
  return mapConnectorOAuthAuthorization(data as ConnectorOAuthAuthorizationRow);
}

function mapOAuthAppConfig(row: OAuthAppConfigRow): DatabaseOAuthAppConfig {
  return {
    platform: row.platform,
    clientId: row.client_id,
    hasClientSecret: row.has_client_secret,
    updatedAt: row.updated_at ?? undefined,
    clientSecret: row.client_secret ?? undefined,
  };
}

function mapDeploymentSettings(
  row: DeploymentSettingsRow,
): DatabaseDeploymentSettings {
  return {
    publicBaseUrl: row.public_base_url,
    redirectBaseUrl: row.redirect_base_url,
    updatedAt: row.updated_at ?? undefined,
  };
}

export async function getDatabaseOAuthAppConfig(platform: GrowthPlatform) {
  const supabase = client();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_oauth_app_config", {
    p_platform: platform,
  });

  if (error) throw error;

  const rows = (data ?? []) as OAuthAppConfigRow[];
  return rows[0] ? mapOAuthAppConfig(rows[0]) : null;
}

export async function upsertDatabaseOAuthAppConfig(
  input: {
    platform: GrowthPlatform;
    clientId: string;
    clientSecret: string;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);
  if (!supabase || !scope) return null;

  const { data, error } = await supabase.rpc("upsert_oauth_app_config", {
    p_platform: input.platform,
    p_client_id: input.clientId,
    p_client_secret: input.clientSecret,
    p_user_id: scope.userId,
  });

  if (error) throw error;

  const rows = (data ?? []) as OAuthAppConfigRow[];
  return rows[0] ? mapOAuthAppConfig(rows[0]) : null;
}

export async function getDatabaseDeploymentSettings() {
  const supabase = client();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_deployment_settings");

  if (error) throw error;

  const rows = (data ?? []) as DeploymentSettingsRow[];
  return rows[0] ? mapDeploymentSettings(rows[0]) : null;
}

export async function upsertDatabaseDeploymentSettings(
  input: {
    publicBaseUrl: string;
    redirectBaseUrl: string;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);
  if (!supabase || !scope) return null;

  const { data, error } = await supabase.rpc("upsert_deployment_settings", {
    p_public_base_url: input.publicBaseUrl,
    p_redirect_base_url: input.redirectBaseUrl,
    p_user_id: scope.userId,
  });

  if (error) throw error;

  const rows = (data ?? []) as DeploymentSettingsRow[];
  return rows[0] ? mapDeploymentSettings(rows[0]) : null;
}

export async function saveDatabaseOAuthTokenSecret(input: {
  name: string;
  secret: string;
  description?: string;
}) {
  const supabase = client();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("save_oauth_token_secret", {
    p_name: input.name,
    p_secret: input.secret,
    p_description: input.description ?? null,
  });

  if (error) throw error;
  return typeof data === "string" ? data : null;
}

export async function upsertDatabaseConnectorAccount(
  input: {
    platform: GrowthPlatform;
    status?: ConnectorAccount["status"];
    credentialRef: string;
    expiresAt?: string;
  },
  context?: StoreContext,
) {
  return upsertDatabasePublishingIdentity(input, context);
}

export async function listDueDatabaseOutboxEvents(
  context?: StoreContext,
  limit = 25,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase) return null;

  let query = supabase
    .from("outbox_events")
    .select(
      "id, workspace_id, project_id, event_type, aggregate_type, aggregate_id, payload, status, attempts, idempotency_key, available_at, last_error, created_at, updated_at",
    )
    .eq("status", "pending")
    .lte("available_at", new Date().toISOString())
    .order("available_at", { ascending: true });

  if (scope) {
    query = query.eq("workspace_id", scope.workspaceId);
  }

  const { data, error } = await query.limit(limit);

  if (error) throw error;
  return (
    (data ?? []) as Array<{
      id: string;
      workspace_id: string;
      project_id: string | null;
      event_type: string;
      aggregate_type: string;
      aggregate_id: string;
      payload: Record<string, unknown>;
      status: OutboxEventRecord["status"];
      attempts: number;
      idempotency_key: string;
      available_at: string;
      last_error: string | null;
      created_at: string;
      updated_at: string;
    }>
  ).map((event) => ({
    id: event.id,
    workspaceId: event.workspace_id,
    projectId: event.project_id,
    eventType: event.event_type,
    aggregateType: event.aggregate_type,
    aggregateId: event.aggregate_id,
    payload: event.payload,
    status: event.status,
    attempts: event.attempts,
    idempotencyKey: event.idempotency_key,
    availableAt: event.available_at,
    lastError: event.last_error ?? undefined,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  }));
}

export async function updateDatabaseOutboxEventStatus(
  eventId: string,
  status: OutboxEventRecord["status"],
  lastError?: string,
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { error } = await supabase
    .from("outbox_events")
    .update({
      status,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", scope.workspaceId)
    .eq("id", eventId);

  if (error) throw error;
  return true;
}

export async function insertDatabaseOutboxEvent(
  input: {
    eventType: string;
    aggregateType: string;
    aggregateId?: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    availableAt?: string;
  },
  context?: StoreContext,
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase || !scope) return null;

  const { data, error } = await supabase
    .from("outbox_events")
    .insert({
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
      event_type: input.eventType,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId ?? scope.projectId,
      payload: input.payload,
      idempotency_key: input.idempotencyKey,
      available_at: input.availableAt ?? new Date().toISOString(),
    })
    .select(
      "id, workspace_id, project_id, event_type, aggregate_type, aggregate_id, payload, status, attempts, idempotency_key, available_at, last_error, created_at, updated_at",
    )
    .single();

  if (error) throw error;

  const event = data as {
    id: string;
    workspace_id: string;
    project_id: string | null;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    payload: Record<string, unknown>;
    status: OutboxEventRecord["status"];
    attempts: number;
    idempotency_key: string;
    available_at: string;
    last_error: string | null;
    created_at: string;
    updated_at: string;
  };

  return {
    id: event.id,
    workspaceId: event.workspace_id,
    projectId: event.project_id,
    eventType: event.event_type,
    aggregateType: event.aggregate_type,
    aggregateId: event.aggregate_id,
    payload: event.payload,
    status: event.status,
    attempts: event.attempts,
    idempotencyKey: event.idempotency_key,
    availableAt: event.available_at,
    lastError: event.last_error ?? undefined,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  } satisfies OutboxEventRecord;
}

function refreshBucket(date: Date, intervalMs: number) {
  return new Date(
    Math.floor(date.getTime() / intervalMs) * intervalMs,
  ).toISOString();
}

export async function enqueueDueDatabaseEngagementRefreshEvents(
  context?: StoreContext,
  nowDate = new Date(),
) {
  const supabase = client();
  const scope = await getDefaultScope(context);

  if (!supabase) return null;

  let targetQuery = supabase
    .from("platform_publish_targets")
    .select("id, workspace_id, project_id, published_content_id, published_at")
    .eq("status", "published");

  if (scope) {
    targetQuery = targetQuery
      .eq("workspace_id", scope.workspaceId)
      .eq("project_id", scope.projectId);
  }

  const { data: targets, error: targetError } = await targetQuery.order(
    "published_at",
    { ascending: true },
  );
  if (targetError) throw targetError;

  const targetRows = (targets ?? []) as AutoRefreshTargetRow[];
  if (targetRows.length === 0) {
    return { enqueued: 0 };
  }

  const { data: snapshots, error: snapshotError } = await supabase
    .from("engagement_snapshots")
    .select("platform_target_id, captured_at")
    .in(
      "platform_target_id",
      targetRows.map((target) => target.id),
    )
    .order("captured_at", { ascending: false });

  if (snapshotError) throw snapshotError;

  const latestByTarget = new Map<string, string>();
  for (const snapshot of (snapshots ?? []) as AutoRefreshSnapshotRow[]) {
    if (!latestByTarget.has(snapshot.platform_target_id)) {
      latestByTarget.set(snapshot.platform_target_id, snapshot.captured_at);
    }
  }

  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const events = targetRows.flatMap((target) => {
    const publishedAt = target.published_at
      ? new Date(target.published_at)
      : nowDate;
    const ageMs = nowDate.getTime() - publishedAt.getTime();
    const intervalMs = ageMs <= oneDay ? oneHour : oneDay;
    const latestRefresh = latestByTarget.get(target.id);

    if (
      latestRefresh &&
      nowDate.getTime() - new Date(latestRefresh).getTime() < intervalMs
    ) {
      return [];
    }

    const bucket = refreshBucket(nowDate, intervalMs);

    return [
      {
        workspace_id: target.workspace_id,
        project_id: target.project_id,
        event_type: "engagement.refresh",
        aggregate_type: "published_content",
        aggregate_id: target.published_content_id,
        payload: {
          publishedContentId: target.published_content_id,
          platformTargetId: target.id,
          automatic: true,
        },
        idempotency_key: `engagement.refresh:auto:${target.id}:${bucket}`,
        available_at: nowDate.toISOString(),
      },
    ];
  });

  if (events.length === 0) {
    return { enqueued: 0 };
  }

  const { error: insertError } = await supabase
    .from("outbox_events")
    .upsert(events, {
      onConflict: "idempotency_key",
      ignoreDuplicates: true,
    });

  if (insertError) throw insertError;
  return { enqueued: events.length };
}
