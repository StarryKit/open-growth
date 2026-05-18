import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const tempDirectories: string[] = [];

let buildApp: typeof import("./app.js").buildApp;

async function createTempDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "open-growth-api-"));
  tempDirectories.push(directory);
  return directory;
}

beforeEach(async () => {
  const directory = await createTempDirectory();
  process.chdir(directory);
  vi.resetModules();
  ({ buildApp } = await import("./app.js"));
});

afterEach(async () => {
  process.chdir(originalCwd);
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("api app", () => {
  it("returns health status", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });

  it("creates and lists projects", async () => {
    const app = await buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "Project One" },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json() as {
      project: { id: string; name: string };
    };
    expect(created.project.name).toBe("Project One");

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/projects",
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      activeProject: { id: created.project.id },
      projects: [{ id: created.project.id, name: "Project One" }],
    });

    await app.close();
  });

  it("rejects upload requests without a file and lists empty assets", async () => {
    const app = await buildApp();

    const uploadResponse = await app.inject({
      method: "POST",
      url: "/api/upload",
      headers: {
        "content-type": "multipart/form-data; boundary=----boundary",
      },
      payload:
        '------boundary\r\nContent-Disposition: form-data; name="noop"\r\n\r\n1\r\n------boundary--\r\n',
    });

    expect(uploadResponse.statusCode).toBe(400);
    expect(uploadResponse.json()).toEqual({ error: "Missing file field." });

    const assetsResponse = await app.inject({
      method: "GET",
      url: "/api/upload",
    });

    expect(assetsResponse.statusCode).toBe(200);
    expect(assetsResponse.json()).toEqual({ assets: [] });

    await app.close();
  });

  it("supports the core workspace workflow endpoints", async () => {
    const app = await buildApp();

    const contentResponse = await app.inject({
      method: "POST",
      url: "/api/published-content",
      payload: {
        title: "Launch note",
        body: "Release the first post.",
        platforms: ["x", "reddit"],
      },
    });

    expect(contentResponse.statusCode).toBe(201);
    const content = contentResponse.json() as {
      content: {
        id: string;
        platformTargets: Array<{ id: string }>;
        status: string;
      };
    };

    const publishResponse = await app.inject({
      method: "POST",
      url: `/api/published-content/${content.content.id}/publish`,
    });

    expect(publishResponse.statusCode).toBe(200);

    const overrideResponse = await app.inject({
      method: "PATCH",
      url: `/api/published-content/${content.content.id}`,
      payload: {
        platformTargets: [
          {
            id: content.content.platformTargets[0].id,
            bodyOverride: "X-specific launch copy.",
          },
        ],
      },
    });

    expect(overrideResponse.statusCode).toBe(200);
    expect(overrideResponse.json()).toMatchObject({
      content: {
        platformTargets: expect.arrayContaining([
          expect.objectContaining({
            id: content.content.platformTargets[0].id,
            bodyOverride: "X-specific launch copy.",
          }),
        ]),
      },
    });

    const connectorResponse = await app.inject({
      method: "POST",
      url: "/api/connectors/accounts",
      payload: {
        platform: "x",
        credentialRef: "secret://x/account",
      },
    });

    expect(connectorResponse.statusCode).toBe(201);
    expect(connectorResponse.json()).toMatchObject({
      account: {
        platform: "x",
        hasCredentialRef: true,
      },
    });
    expect(JSON.stringify(connectorResponse.json())).not.toContain(
      "secret://x/account",
    );

    const connectorsResponse = await app.inject({
      method: "GET",
      url: "/api/connectors",
    });

    expect(connectorsResponse.statusCode).toBe(200);
    expect(connectorsResponse.json()).toMatchObject({
      connectors: expect.arrayContaining([
        expect.objectContaining({
          platform: "x",
          connectionStatus: "active",
        }),
      ]),
    });

    const overviewResponse = await app.inject({
      method: "GET",
      url: "/api/engagement/overview",
    });

    expect(overviewResponse.statusCode).toBe(200);
    expect(overviewResponse.json()).toMatchObject({
      publishedTargetCount: 2,
    });

    const refreshResponse = await app.inject({
      method: "POST",
      url: `/api/engagement/content/${content.content.id}/refresh`,
    });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json()).toMatchObject({
      event: expect.objectContaining({
        eventType: "engagement.refresh",
        aggregateType: "published_content",
      }),
    });

    const outboxResponse = await app.inject({
      method: "POST",
      url: "/api/outbox-events/process",
    });

    expect(outboxResponse.statusCode).toBe(200);
    expect(outboxResponse.json()).toMatchObject({
      processed: 1,
      succeeded: 1,
    });

    const queryResponse = await app.inject({
      method: "POST",
      url: "/api/trends/queries",
      payload: {
        name: "Open Growth",
        keywords: ["open growth", "content ops"],
        platforms: ["hacker-news"],
      },
    });

    expect(queryResponse.statusCode).toBe(201);
    const query = queryResponse.json() as { query: { id: string } };

    const runResponse = await app.inject({
      method: "POST",
      url: `/api/trends/queries/${query.query.id}/run`,
    });

    expect(runResponse.statusCode).toBe(200);
    expect((runResponse.json() as { posts: unknown[] }).posts).toHaveLength(3);

    const contentDetailResponse = await app.inject({
      method: "GET",
      url: `/api/published-content/${content.content.id}`,
    });

    expect(contentDetailResponse.statusCode).toBe(200);
    expect(contentDetailResponse.json()).toMatchObject({
      content: { id: content.content.id },
    });

    const engagementDetailResponse = await app.inject({
      method: "GET",
      url: `/api/engagement/content/${content.content.id}`,
    });

    expect(engagementDetailResponse.statusCode).toBe(200);
    expect(engagementDetailResponse.json()).toMatchObject({
      content: { id: content.content.id },
      snapshots: expect.any(Array),
    });

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/published-content/${content.content.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);

    await app.close();
  });

  it("scopes published content by the project header", async () => {
    const app = await buildApp();

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "Project One" },
    });
    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "Project Two" },
    });
    const first = firstResponse.json() as { project: { id: string } };
    const second = secondResponse.json() as { project: { id: string } };

    await app.inject({
      method: "POST",
      url: "/api/published-content",
      headers: { "x-open-growth-project-id": first.project.id },
      payload: {
        title: "First project post",
        body: "Scoped content.",
        platforms: ["x"],
      },
    });
    await app.inject({
      method: "POST",
      url: "/api/published-content",
      headers: { "x-open-growth-project-id": second.project.id },
      payload: {
        title: "Second project post",
        body: "Scoped content.",
        platforms: ["x"],
      },
    });

    const firstList = await app.inject({
      method: "GET",
      url: "/api/published-content",
      headers: { "x-open-growth-project-id": first.project.id },
    });
    const secondList = await app.inject({
      method: "GET",
      url: "/api/published-content",
      headers: { "x-open-growth-project-id": second.project.id },
    });

    expect(firstList.json()).toMatchObject({
      contents: [expect.objectContaining({ title: "First project post" })],
    });
    expect(secondList.json()).toMatchObject({
      contents: [expect.objectContaining({ title: "Second project post" })],
    });

    await app.close();
  });
});
