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
});
