import { publishContentToPlatform } from "./connector-service.js";
import type { OutboxEventRecord } from "./database-store.js";
import {
  completeDatabaseContentAssetDeletion,
  completeDatabasePublishedTarget,
  enqueueDueDatabaseEngagementRefreshEvents,
  getDatabasePublishedContent,
  listDueDatabaseOutboxEvents,
  type StoreContext,
  updateDatabaseOutboxEventStatus,
} from "./database-store.js";
import {
  createEngagementSnapshot,
  executeTrendRunFromOutbox,
  listOutboxEvents,
  listPublishedContent,
  updateLocalOutboxEventStatus,
} from "./domain-store.js";
import { deleteSupabaseMediaObject } from "./media-storage.js";

type ProcessResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ eventId: string; error: string }>;
};

type OutboxEvent = OutboxEventRecord;

let intervalHandle: NodeJS.Timeout | null = null;
let processing = false;

async function processPublishEvent(event: OutboxEvent, context?: StoreContext) {
  const content = await getDatabasePublishedContent(event.aggregateId, context);

  if (!content) {
    throw new Error("Published content not found.");
  }

  for (const target of content.platformTargets) {
    if (target.status === "published") {
      continue;
    }

    const result = await publishContentToPlatform({
      contentId: content.id,
      platform: target.platform,
      body: target.bodyOverride ?? content.body,
    });
    await completeDatabasePublishedTarget(target.id, result, context);
  }
}

async function processEngagementRefreshEvent(
  event: OutboxEvent,
  context?: StoreContext,
) {
  const contentId =
    typeof event.payload.publishedContentId === "string"
      ? event.payload.publishedContentId
      : event.aggregateId;
  const targetId =
    typeof event.payload.platformTargetId === "string"
      ? event.payload.platformTargetId
      : undefined;

  const contents = await listPublishedContent(context);
  const content =
    event.aggregateType === "project"
      ? null
      : contents.find((candidate) => candidate.id === contentId);

  if (event.aggregateType !== "project" && !content) {
    throw new Error("Published content not found.");
  }

  const sourceContents = content ? [content] : contents;
  const targets = sourceContents.flatMap((item) =>
    targetId
      ? item.platformTargets
          .filter((target) => target.id === targetId)
          .map((target) => ({ contentId: item.id, target }))
      : item.platformTargets
          .filter((target) => target.status === "published")
          .map((target) => ({ contentId: item.id, target })),
  );

  for (const { contentId: targetContentId, target } of targets) {
    await createEngagementSnapshot(targetContentId, target.id, context);
  }
}

async function processTrendRunEvent(
  event: OutboxEvent,
  context?: StoreContext,
) {
  const queryId =
    typeof event.payload.queryId === "string"
      ? event.payload.queryId
      : event.aggregateId;
  const runId =
    event.aggregateType === "trend_run" ? event.aggregateId : undefined;

  await executeTrendRunFromOutbox(
    {
      runId: runId ?? `run_${event.id}`,
      queryId,
    },
    context,
  );
}

async function processStorageDeleteEvent(
  event: OutboxEvent,
  context?: StoreContext,
) {
  const storagePath =
    typeof event.payload.storagePath === "string"
      ? event.payload.storagePath
      : null;

  if (!storagePath) {
    throw new Error("Storage delete event is missing storagePath.");
  }

  await deleteSupabaseMediaObject(storagePath);
  await completeDatabaseContentAssetDeletion(event.aggregateId, context);
}

async function processEvent(event: OutboxEvent, context?: StoreContext) {
  switch (event.eventType) {
    case "publish.execute":
    case "publish.retry":
    case "publish.schedule":
      await processPublishEvent(event, context);
      return;
    case "engagement.refresh":
      await processEngagementRefreshEvent(event, context);
      return;
    case "trends.run":
      await processTrendRunEvent(event, context);
      return;
    case "storage.delete":
      await processStorageDeleteEvent(event, context);
      return;
    default:
      throw new Error(`Unsupported outbox event type: ${event.eventType}`);
  }
}

function eventContext(
  event: OutboxEvent,
  context?: StoreContext,
): StoreContext | undefined {
  if (!event.workspaceId && !event.projectId) {
    return context;
  }

  return {
    ...context,
    workspaceId: event.workspaceId ?? context?.workspaceId,
    activeProjectId: event.projectId ?? context?.activeProjectId ?? undefined,
  };
}

function dueLocalEvent(event: OutboxEvent) {
  return (
    event.status === "pending" &&
    new Date(event.availableAt).getTime() <= Date.now()
  );
}

export async function processDueOutboxEvents(
  context?: StoreContext,
  limit = 25,
): Promise<ProcessResult> {
  await enqueueDueDatabaseEngagementRefreshEvents(context);
  const databaseEvents = await listDueDatabaseOutboxEvents(context, limit);
  const isDatabaseMode = databaseEvents !== null;
  const events =
    databaseEvents ??
    (await listOutboxEvents()).filter(dueLocalEvent).slice(0, limit);
  const result: ProcessResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  for (const event of events) {
    result.processed += 1;

    try {
      if (isDatabaseMode) {
        await updateDatabaseOutboxEventStatus(
          event.id,
          "processing",
          undefined,
          context,
        );
      } else {
        await updateLocalOutboxEventStatus(event.id, "processing");
      }

      await processEvent(event, eventContext(event, context));

      if (isDatabaseMode) {
        await updateDatabaseOutboxEventStatus(
          event.id,
          "succeeded",
          undefined,
          context,
        );
      } else {
        await updateLocalOutboxEventStatus(event.id, "succeeded");
      }
      result.succeeded += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Outbox processing failed.";
      if (isDatabaseMode) {
        await updateDatabaseOutboxEventStatus(
          event.id,
          "failed",
          message,
          context,
        );
      } else {
        await updateLocalOutboxEventStatus(event.id, "failed", message);
      }
      result.failed += 1;
      result.errors.push({ eventId: event.id, error: message });
    }
  }

  return result;
}

export function startOutboxWorker(options?: {
  intervalMs?: number;
  context?: StoreContext;
  limit?: number;
}) {
  const intervalMs =
    options?.intervalMs ??
    Number(process.env.OPEN_GROWTH_OUTBOX_INTERVAL_MS ?? 0);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return null;
  }

  if (intervalHandle) {
    return intervalHandle;
  }

  intervalHandle = setInterval(() => {
    if (processing) {
      return;
    }

    processing = true;
    processDueOutboxEvents(options?.context, options?.limit)
      .catch(() => {
        // Event-level failures are persisted in outbox status; keep the loop alive.
      })
      .finally(() => {
        processing = false;
      });
  }, intervalMs);

  intervalHandle.unref();
  return intervalHandle;
}

export function stopOutboxWorker() {
  if (!intervalHandle) {
    return;
  }

  clearInterval(intervalHandle);
  intervalHandle = null;
  processing = false;
}
