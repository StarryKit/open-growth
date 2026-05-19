import { promises as fs } from "node:fs";
import path, { extname } from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import statik from "@fastify/static";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import {
  getAssetType,
  isSupportedAsset,
} from "../../../packages/db/src/content-assets.js";
import { isAdminUserId, resolveAuthContext } from "./lib/auth-service.js";
import {
  beginPublishingOAuth,
  completePublishingOAuth,
  connectorOAuthFailureUrl,
  connectorOAuthSuccessUrl,
} from "./lib/connector-oauth.js";
import { listConnectorCapabilities } from "./lib/connector-service.js";
import {
  getDeploymentSettings,
  saveDeploymentSettings,
} from "./lib/deployment-settings.js";
import type { DomainContext } from "./lib/domain-store.js";
import {
  createContentAsset,
  createPublishedContent,
  createResponseDraftFromTrendPost,
  createTrendQuery,
  deleteContentAsset,
  deletePublishedContent,
  deleteTrendQuery,
  getEngagementOverview,
  getPublishedContent,
  getWorkspaceSummary,
  listConnectorAccounts,
  listConnectorConnections,
  listContentAssets,
  listEngagementSnapshots,
  listOutboxEvents,
  listPublishedContent,
  listTrendPosts,
  listTrendQueries,
  publishContent,
  requestEngagementRefresh,
  retryPublishedContent,
  runTrendQuery,
  schedulePublishedContent,
  setWorkspacePublishingIdentityEnabled,
  testCollectorIdentity,
  updateContentAsset,
  updatePublishedContent,
  updateTrendPost,
  updateTrendQuery,
  upsertCollectorIdentity,
  upsertConnectorAccount,
} from "./lib/domain-store.js";
import {
  readSupabaseMediaObject,
  saveMediaObject,
} from "./lib/media-storage.js";
import {
  listOAuthAppConfigs,
  saveOAuthAppConfig,
} from "./lib/oauth-app-config.js";
import { processDueOutboxEvents } from "./lib/outbox-worker.js";
import {
  createProject,
  deleteProject,
  getActiveProject,
  listProjects,
  setActiveProject,
} from "./lib/project-store.js";

const contentTypes = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".txt", "text/plain; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

async function handleContentAssetUpload(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ error: "Missing file field." });
    }

    if (!isSupportedAsset(file.filename)) {
      return reply.code(400).send({ error: "Unsupported file type." });
    }

    const buffer = await file.toBuffer();
    const stored = await saveMediaObject({
      originalFilename: file.filename,
      buffer,
      type: getAssetType(file.filename),
      mimeType: file.mimetype,
      context,
    });

    const asset = await createContentAsset(
      {
        assetId: stored.assetId,
        filename: stored.filename,
        path: stored.path,
        type: stored.type,
        size: stored.size,
        preview: stored.preview,
        storageBucket: stored.bucket,
        mimeType: file.mimetype,
        sha256: stored.sha256,
      },
      context,
    );

    return {
      success: true,
      asset,
      filename: stored.filename,
      path: stored.path,
      type: stored.type,
    };
  } catch {
    return reply.code(500).send({ error: "Unable to save uploaded file." });
  }
}

async function resolveDomainContext(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<DomainContext | null> {
  try {
    const auth = await resolveAuthContext(request);
    const projectHeader = request.headers["x-open-growth-project-id"];
    const activeProjectId = Array.isArray(projectHeader)
      ? projectHeader[0]
      : projectHeader;

    return {
      userId: auth.user.id,
      activeProjectId:
        typeof activeProjectId === "string" && activeProjectId.length > 0
          ? activeProjectId
          : null,
    };
  } catch (error) {
    reply.code(401).send({
      error:
        error instanceof Error ? error.message : "Authentication required.",
    });
    return null;
  }
}

async function resolveAdminContext(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<DomainContext | null> {
  const context = await resolveDomainContext(request, reply);
  if (!context) return null;

  if (!context.userId || !isAdminUserId(context.userId)) {
    reply.code(403).send({ error: "Admin access is required." });
    return null;
  }

  return context;
}

export async function buildApp() {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(multipart);
  await app.register(statik, {
    root: path.resolve("../../dist/web"),
    prefix: "/",
  });

  app.get("/api/health", async () => {
    return { ok: true };
  });

  app.get("/api/auth/session", async (request, reply) => {
    try {
      return await resolveAuthContext(request);
    } catch (error) {
      return reply.code(401).send({
        error:
          error instanceof Error ? error.message : "Unable to verify session.",
      });
    }
  });

  app.get("/api/admin/status", async (request, reply) => {
    try {
      const auth = await resolveAuthContext(request);
      return { isAdmin: isAdminUserId(auth.user.id) };
    } catch (error) {
      return reply.code(401).send({
        error:
          error instanceof Error ? error.message : "Unable to verify session.",
      });
    }
  });

  app.get("/api/projects", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    try {
      const [projects, activeProject] = await Promise.all([
        listProjects(context),
        getActiveProject(context),
      ]);

      return { projects, activeProject };
    } catch {
      return reply.code(500).send({ error: "Unable to read projects." });
    }
  });

  app.post<{ Body: { name?: string } }>(
    "/api/projects",
    async (request, reply) => {
      const name = request.body?.name?.trim();

      if (!name) {
        return reply.code(400).send({ error: "Project name is required." });
      }

      try {
        const context = await resolveDomainContext(request, reply);
        if (!context) return;

        const project = await createProject({ name }, context);
        return reply.code(201).send({ project });
      } catch {
        return reply.code(500).send({ error: "Unable to create project." });
      }
    },
  );

  app.delete<{ Querystring: { id?: string } }>(
    "/api/projects",
    async (request, reply) => {
      if (!request.query.id) {
        return reply.code(400).send({ error: "Project ID is required." });
      }

      try {
        const context = await resolveDomainContext(request, reply);
        if (!context) return;

        const removed = await deleteProject(request.query.id, context);

        if (!removed) {
          return reply.code(404).send({ error: "Project not found." });
        }

        return { success: true };
      } catch {
        return reply.code(500).send({ error: "Unable to delete project." });
      }
    },
  );

  app.put<{ Body: { projectId?: string | null } }>(
    "/api/projects/active",
    async (request, reply) => {
      if (request.body?.projectId === undefined) {
        return reply.code(400).send({ error: "Project ID is required." });
      }

      try {
        const context = await resolveDomainContext(request, reply);
        if (!context) return;

        const project = await setActiveProject(
          request.body.projectId ?? null,
          context,
        );

        if (request.body.projectId && !project) {
          return reply.code(404).send({ error: "Project not found." });
        }

        return { project };
      } catch {
        return reply.code(500).send({ error: "Unable to switch project." });
      }
    },
  );

  app.post("/api/content-assets", handleContentAssetUpload);

  app.get("/api/content-assets", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    try {
      return { assets: await listContentAssets(context) };
    } catch {
      return reply.code(500).send({ error: "Unable to read content assets." });
    }
  });

  app.get<{ Params: { id: string } }>(
    "/api/content-assets/:id/blob",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const assets = await listContentAssets(context);
      const asset = assets.find(
        (candidate) => candidate.id === request.params.id,
      );

      if (!asset) {
        return reply.code(404).send({ error: "Content asset not found." });
      }

      const extension = extname(asset.filename).toLowerCase();
      const contentType =
        contentTypes.get(extension) ?? "application/octet-stream";

      const buffer = await readSupabaseMediaObject(asset.path);
      if (!buffer) {
        return reply.code(404).send({ error: "File not found." });
      }

      reply.header("Cache-Control", "no-store");
      reply.header("Content-Length", buffer.byteLength.toString());
      reply.header("Content-Type", contentType);
      return reply.send(buffer);
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      tags?: string[];
      source?: string;
      platforms?: string[];
      status?: string;
    };
  }>("/api/content-assets/:id", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    const asset = await updateContentAsset(
      request.params.id,
      {
        title: request.body.title,
        description: request.body.description,
        tags: request.body.tags,
        source: request.body.source,
        platforms: request.body.platforms as never,
        status: request.body.status as never,
      },
      context,
    );

    if (!asset) {
      return reply.code(404).send({ error: "Content asset not found." });
    }

    return { asset };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/content-assets/:id",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const removed = await deleteContentAsset(request.params.id, context);

      if (!removed) {
        return reply.code(404).send({ error: "Content asset not found." });
      }

      return { success: true };
    },
  );

  app.get("/api/workspace/summary", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    try {
      return await getWorkspaceSummary(context);
    } catch {
      return reply.code(500).send({ error: "Unable to read workspace." });
    }
  });

  app.get("/api/connectors", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    return { connectors: await listConnectorConnections(context) };
  });

  app.post<{
    Body: {
      platform?: string;
      redirectTo?: string;
    };
  }>("/api/connectors/publishing-identities/start", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    const platform = request.body.platform;
    const supportedPlatforms = new Set(
      listConnectorCapabilities().map((capability) => capability.platform),
    );

    if (!platform || !supportedPlatforms.has(platform as never)) {
      return reply.code(400).send({ error: "Supported platform is required." });
    }

    try {
      const auth = await beginPublishingOAuth({
        platform: platform as never,
        redirectTo: request.body.redirectTo,
        context,
      });
      return {
        authorizationUrl: auth.authorizationUrl,
        state: auth.state,
      };
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error ? error.message : "Unable to start OAuth.",
      });
    }
  });

  app.get<{
    Params: { platform: string };
    Querystring: { code?: string; state?: string };
  }>("/api/connectors/oauth/:platform/callback", async (request, reply) => {
    const platform = request.params.platform as never;
    const code = request.query.code?.trim();
    const state = request.query.state?.trim();

    if (!code || !state) {
      return reply
        .code(400)
        .send({ error: "OAuth code and state are required." });
    }

    try {
      const result = await completePublishingOAuth({
        platform,
        code,
        state,
      });
      return reply.redirect(
        await connectorOAuthSuccessUrl({
          redirectTo: result.redirectTo,
          platform,
        }),
      );
    } catch (error) {
      return reply.redirect(
        await connectorOAuthFailureUrl(
          error instanceof Error ? error.message : "OAuth failed.",
          platform,
        ),
      );
    }
  });

  app.post<{
    Body: {
      platform?: string;
      displayName?: string;
      platformAccountId?: string;
      status?: string;
      expiresAt?: string;
    };
  }>("/api/connectors/publishing-identities", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    return reply.code(410).send({
      error: "Use the OAuth start endpoint for publishing identities.",
    });
  });

  app.post<{
    Body: {
      connectorAccountId?: string;
      enabled?: boolean;
    };
  }>(
    "/api/connectors/workspace-publishing-identities",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const connectorAccountId = request.body.connectorAccountId?.trim();
      if (!connectorAccountId) {
        return reply
          .code(400)
          .send({ error: "Connector account id is required." });
      }

      return {
        result: await setWorkspacePublishingIdentityEnabled(
          connectorAccountId,
          request.body.enabled ?? true,
          context,
        ),
      };
    },
  );

  app.post<{
    Body: {
      platform?: string;
      credentialRef?: string;
      status?: string;
      expiresAt?: string;
    };
  }>("/api/connectors/accounts", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    const platform = request.body.platform;
    const credentialRef = request.body.credentialRef?.trim();
    const supportedPlatforms = new Set(
      listConnectorCapabilities().map((capability) => capability.platform),
    );

    if (!platform || !supportedPlatforms.has(platform as never)) {
      return reply.code(400).send({ error: "Supported platform is required." });
    }

    if (!credentialRef) {
      return reply
        .code(400)
        .send({ error: "Credential reference is required." });
    }

    const account = await upsertConnectorAccount(
      {
        platform: platform as never,
        credentialRef,
        status: request.body.status as never,
        expiresAt: request.body.expiresAt,
      },
      context,
    );

    return reply.code(201).send({ account });
  });

  app.get("/api/admin/collector-identities", async (request, reply) => {
    const context = await resolveAdminContext(request, reply);
    if (!context) return;

    const accounts = await listConnectorAccounts(context);
    return {
      collectorIdentities: accounts.filter(
        (account) => account.identityKind === "collector",
      ),
    };
  });

  app.get("/api/admin/oauth-apps", async (request, reply) => {
    const context = await resolveAdminContext(request, reply);
    if (!context) return;

    return { oauthApps: await listOAuthAppConfigs() };
  });

  app.get("/api/admin/deployment-settings", async (request, reply) => {
    const context = await resolveAdminContext(request, reply);
    if (!context) return;

    return { deploymentSettings: await getDeploymentSettings() };
  });

  app.post<{
    Body: {
      platform?: string;
      clientId?: string;
      clientSecret?: string;
    };
  }>("/api/admin/oauth-apps", async (request, reply) => {
    const context = await resolveAdminContext(request, reply);
    if (!context) return;

    const platform = request.body.platform;
    if (!platform) {
      return reply.code(400).send({ error: "Platform is required." });
    }

    try {
      const oauthApp = await saveOAuthAppConfig({
        platform: platform as never,
        clientId: request.body.clientId ?? "",
        clientSecret: request.body.clientSecret ?? undefined,
        context,
      });
      return reply.code(201).send({ oauthApp });
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error ? error.message : "Unable to save OAuth app.",
      });
    }
  });

  app.post<{
    Body: {
      publicBaseUrl?: string;
      redirectBaseUrl?: string;
    };
  }>("/api/admin/deployment-settings", async (request, reply) => {
    const context = await resolveAdminContext(request, reply);
    if (!context) return;

    const publicBaseUrl = request.body.publicBaseUrl?.trim();
    const redirectBaseUrl = request.body.redirectBaseUrl?.trim();

    if (!publicBaseUrl || !redirectBaseUrl) {
      return reply
        .code(400)
        .send({ error: "Public base URL and redirect base URL are required." });
    }

    try {
      const deploymentSettings = await saveDeploymentSettings({
        publicBaseUrl,
        redirectBaseUrl,
        context,
      });

      return reply.code(201).send({ deploymentSettings });
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error
            ? error.message
            : "Unable to save deployment settings.",
      });
    }
  });

  app.post<{
    Body: {
      platform?: string;
      credentialRef?: string;
      displayName?: string;
      authMode?: string;
      adapterBackend?: string;
      ownerScope?: string;
      useCases?: string[];
      status?: string;
    };
  }>("/api/admin/collector-identities", async (request, reply) => {
    const context = await resolveAdminContext(request, reply);
    if (!context) return;

    const platform = request.body.platform;
    const supportedPlatforms = new Set(
      listConnectorCapabilities().map((capability) => capability.platform),
    );

    if (!platform || !supportedPlatforms.has(platform as never)) {
      return reply.code(400).send({ error: "Supported platform is required." });
    }

    if (
      request.body.authMode !== "public" &&
      !request.body.credentialRef?.trim()
    ) {
      return reply
        .code(400)
        .send({ error: "Credential reference is required." });
    }

    const account = await upsertCollectorIdentity(
      {
        platform: platform as never,
        credentialRef: request.body.credentialRef?.trim(),
        displayName: request.body.displayName?.trim(),
        authMode: request.body.authMode as never,
        adapterBackend: request.body.adapterBackend as never,
        ownerScope: request.body.ownerScope as never,
        useCases: request.body.useCases as never,
        status: request.body.status as never,
      },
      context,
    );

    return reply.code(201).send({ account });
  });

  app.post<{
    Body: {
      platform?: string;
      credentialRef?: string;
      displayName?: string;
      authMode?: string;
      adapterBackend?: string;
      ownerScope?: string;
      useCases?: string[];
    };
  }>("/api/admin/collector-identities/test", async (request, reply) => {
    const context = await resolveAdminContext(request, reply);
    if (!context) return;

    const platform = request.body.platform;
    const supportedPlatforms = new Set(
      listConnectorCapabilities().map((capability) => capability.platform),
    );

    if (!platform || !supportedPlatforms.has(platform as never)) {
      return reply.code(400).send({ error: "Supported platform is required." });
    }

    const account = await testCollectorIdentity(
      {
        platform: platform as never,
        credentialRef: request.body.credentialRef?.trim(),
        displayName: request.body.displayName?.trim(),
        authMode: request.body.authMode as never,
        adapterBackend: request.body.adapterBackend as never,
        ownerScope: request.body.ownerScope as never,
        useCases: request.body.useCases as never,
      },
      context,
    );

    return { account };
  });

  app.get("/api/published-content", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    try {
      return { contents: await listPublishedContent(context) };
    } catch {
      return reply
        .code(500)
        .send({ error: "Unable to read published content." });
    }
  });

  app.get<{ Params: { id: string } }>(
    "/api/published-content/:id",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const content = await getPublishedContent(request.params.id, context);

      if (!content) {
        return reply.code(404).send({ error: "Published content not found." });
      }

      return { content };
    },
  );

  app.post<{
    Body: {
      title?: string;
      body?: string;
      assetIds?: string[];
      platforms?: string[];
      sourceTrendPostId?: string;
    };
  }>("/api/published-content", async (request, reply) => {
    const title = request.body.title?.trim();
    const body = request.body.body?.trim();
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    if (!title || !body) {
      return reply.code(400).send({ error: "Title and body are required." });
    }

    const content = await createPublishedContent(
      {
        title,
        body,
        assetIds: request.body.assetIds,
        platforms: request.body.platforms as never,
        sourceTrendPostId: request.body.sourceTrendPostId,
      },
      context,
    );

    return reply.code(201).send({ content });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      body?: string;
      assetIds?: string[];
      status?: string;
      platformTargets?: Array<{
        id: string;
        bodyOverride?: string;
      }>;
    };
  }>("/api/published-content/:id", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    const content = await updatePublishedContent(
      request.params.id,
      {
        title: request.body.title,
        body: request.body.body,
        assetIds: request.body.assetIds,
        status: request.body.status as never,
        platformTargets: request.body.platformTargets,
      },
      context,
    );

    if (!content) {
      return reply.code(404).send({ error: "Published content not found." });
    }

    return { content };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/published-content/:id",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const removed = await deletePublishedContent(request.params.id, context);

      if (!removed) {
        return reply.code(404).send({ error: "Published content not found." });
      }

      return { success: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/published-content/:id/publish",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const content = await publishContent(request.params.id, context);

      if (!content) {
        return reply.code(404).send({ error: "Published content not found." });
      }

      return { content };
    },
  );

  app.post<{ Params: { id: string }; Body: { scheduledAt?: string } }>(
    "/api/published-content/:id/schedule",
    async (request, reply) => {
      if (!request.body.scheduledAt) {
        return reply.code(400).send({ error: "scheduledAt is required." });
      }

      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const content = await schedulePublishedContent(
        request.params.id,
        request.body.scheduledAt,
        context,
      );

      if (!content) {
        return reply.code(404).send({ error: "Published content not found." });
      }

      return { content };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/published-content/:id/retry",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const content = await retryPublishedContent(request.params.id, context);

      if (!content) {
        return reply.code(404).send({ error: "Published content not found." });
      }

      return { content };
    },
  );

  app.get("/api/engagement/overview", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    try {
      return await getEngagementOverview(context);
    } catch {
      return reply.code(500).send({ error: "Unable to read engagement." });
    }
  });

  app.get("/api/engagement/content", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    try {
      return { snapshots: await listEngagementSnapshots(context) };
    } catch {
      return reply.code(500).send({ error: "Unable to read engagement." });
    }
  });

  app.get<{ Params: { id: string } }>(
    "/api/engagement/content/:id",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const contents = await listPublishedContent(context);
      const content = contents.find((item) => item.id === request.params.id);

      if (!content) {
        return reply.code(404).send({ error: "Published content not found." });
      }

      const snapshots = (await listEngagementSnapshots(context)).filter(
        (snapshot) => snapshot.publishedContentId === content.id,
      );

      return { content, snapshots };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/engagement/content/:id/refresh",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const contents = await listPublishedContent(context);
      const content = contents.find((item) => item.id === request.params.id);

      if (!content) {
        return reply.code(404).send({ error: "Published content not found." });
      }

      const event = await requestEngagementRefresh(
        { contentId: content.id },
        context,
      );

      return { event };
    },
  );

  app.post("/api/engagement/refresh", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    const event = await requestEngagementRefresh(undefined, context);

    return { event };
  });

  app.get("/api/trends/queries", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    return { queries: await listTrendQueries(context) };
  });

  app.post<{
    Body: {
      name?: string;
      keywords?: string[];
      excludedKeywords?: string[];
      platforms?: string[];
      language?: string;
      timeRange?: "24h" | "7d" | "30d";
    };
  }>("/api/trends/queries", async (request, reply) => {
    const name = request.body.name?.trim();
    const keywords = request.body.keywords?.filter(Boolean) ?? [];
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    if (!name || keywords.length === 0) {
      return reply.code(400).send({ error: "Name and keywords are required." });
    }

    const query = await createTrendQuery(
      {
        name,
        keywords,
        excludedKeywords: request.body.excludedKeywords,
        platforms: request.body.platforms as never,
        language: request.body.language,
        timeRange: request.body.timeRange,
      },
      context,
    );

    return reply.code(201).send({ query });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      keywords?: string[];
      excludedKeywords?: string[];
      platforms?: string[];
      language?: string;
      timeRange?: "24h" | "7d" | "30d";
    };
  }>("/api/trends/queries/:id", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    const query = await updateTrendQuery(
      request.params.id,
      {
        name: request.body.name,
        keywords: request.body.keywords,
        excludedKeywords: request.body.excludedKeywords,
        platforms: request.body.platforms as never,
        language: request.body.language,
        timeRange: request.body.timeRange,
      },
      context,
    );

    if (!query) {
      return reply.code(404).send({ error: "Trend query not found." });
    }

    return { query };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/trends/queries/:id",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const removed = await deleteTrendQuery(request.params.id, context);

      if (!removed) {
        return reply.code(404).send({ error: "Trend query not found." });
      }

      return { success: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/trends/queries/:id/run",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const result = await runTrendQuery(request.params.id, context);

      if (!result) {
        return reply.code(404).send({ error: "Trend query not found." });
      }

      return result;
    },
  );

  app.get("/api/trends/posts", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    return { posts: await listTrendPosts(context) };
  });

  app.patch<{
    Params: { id: string };
    Body: { status?: string; title?: string; summary?: string };
  }>("/api/trends/posts/:id", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    const post = await updateTrendPost(
      request.params.id,
      {
        status: request.body.status as never,
        title: request.body.title,
        summary: request.body.summary,
      },
      context,
    );

    if (!post) {
      return reply.code(404).send({ error: "Trend post not found." });
    }

    return { post };
  });

  app.post<{ Params: { id: string } }>(
    "/api/trends/posts/:id/create-response-draft",
    async (request, reply) => {
      const context = await resolveDomainContext(request, reply);
      if (!context) return;

      const result = await createResponseDraftFromTrendPost(
        request.params.id,
        context,
      );

      if (!result) {
        return reply.code(404).send({ error: "Trend post not found." });
      }

      return result;
    },
  );

  app.get("/api/outbox-events", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    return { events: await listOutboxEvents(context) };
  });

  app.post("/api/outbox-events/process", async (request, reply) => {
    const context = await resolveDomainContext(request, reply);
    if (!context) return;

    return await processDueOutboxEvents(context);
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not found." });
    }

    return reply
      .type("text/html")
      .send(
        await fs.readFile(path.resolve("../../dist/web/index.html"), "utf8"),
      );
  });

  return app;
}
