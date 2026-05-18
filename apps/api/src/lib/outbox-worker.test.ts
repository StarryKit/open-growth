import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const tempDirectories: string[] = [];

let projectStore: typeof import("./project-store.js");
let domainStore: typeof import("./domain-store.js");
let outboxWorker: typeof import("./outbox-worker.js");

async function createTempDirectory() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "open-growth-outbox-"),
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
  outboxWorker = await import("./outbox-worker.js");
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

describe("outbox worker", () => {
  it("processes due local trend run events and marks them succeeded", async () => {
    const query = await domainStore.createTrendQuery({
      name: "Launch mentions",
      keywords: ["open growth"],
      platforms: ["hacker-news"],
    });
    await domainStore.enqueueOutboxEvent({
      eventType: "trends.run",
      aggregateType: "trend_query",
      aggregateId: query.id,
      payload: { queryId: query.id },
      idempotencyKey: `trends.run:${query.id}`,
    });

    const result = await outboxWorker.processDueOutboxEvents();

    expect(result).toMatchObject({
      processed: 1,
      succeeded: 1,
      failed: 0,
    });
    await expect(domainStore.listTrendPosts()).resolves.toHaveLength(3);
    await expect(domainStore.listOutboxEvents()).resolves.toContainEqual(
      expect.objectContaining({
        eventType: "trends.run",
        status: "succeeded",
        attempts: 1,
      }),
    );
  });

  it("uses the event run id when processing queued local trend runs", async () => {
    const query = await domainStore.createTrendQuery({
      name: "Queued launch mentions",
      keywords: ["queued growth"],
      platforms: ["hacker-news"],
    });
    await domainStore.enqueueOutboxEvent({
      eventType: "trends.run",
      aggregateType: "trend_run",
      aggregateId: "run-fixed",
      payload: { queryId: query.id },
      idempotencyKey: "trends.run:run-fixed",
    });

    await outboxWorker.processDueOutboxEvents();

    const posts = await domainStore.listTrendPosts();
    expect(posts).toHaveLength(3);
    expect(posts).toEqual(
      expect.arrayContaining([expect.objectContaining({ runId: "run-fixed" })]),
    );
  });

  it("starts a non-overlapping interval runner", () => {
    vi.useFakeTimers();
    const handle = outboxWorker.startOutboxWorker({ intervalMs: 1_000 });

    expect(handle).not.toBeNull();

    outboxWorker.stopOutboxWorker();
    vi.useRealTimers();
  });
});
