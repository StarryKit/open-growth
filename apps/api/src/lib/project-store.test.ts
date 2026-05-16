import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const tempDirectories: string[] = [];

let store: typeof import("./project-store.js");

async function createTempDirectory() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "open-growth-projects-"),
  );
  tempDirectories.push(directory);
  return directory;
}

beforeEach(async () => {
  const directory = await createTempDirectory();
  process.chdir(directory);
  vi.resetModules();
  store = await import("./project-store.js");
});

afterEach(async () => {
  process.chdir(originalCwd);
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("project store", () => {
  it("creates a project and marks it active", async () => {
    const project = await store.createProject({ name: "Campaign Lab" });

    expect(project.name).toBe("Campaign Lab");
    expect(project.rootDir).toContain(".open-growth/campaign-lab");
    await expect(store.getActiveProjectId()).resolves.toBe(project.id);

    const persistedProjects = JSON.parse(
      await readFile(path.join(process.cwd(), "data", "projects.json"), "utf8"),
    ) as { projects: Array<{ id: string }> };

    expect(persistedProjects.projects[0]?.id).toBe(project.id);
  });

  it("switches and clears the active project", async () => {
    const firstProject = await store.createProject({ name: "First" });
    const secondProject = await store.createProject({ name: "Second" });

    await expect(
      store.setActiveProject(firstProject.id),
    ).resolves.toMatchObject({
      id: firstProject.id,
    });
    await expect(store.getActiveProjectId()).resolves.toBe(firstProject.id);

    await expect(store.setActiveProject(null)).resolves.toBeNull();
    await expect(store.getActiveProjectId()).resolves.toBeNull();
    await expect(store.getProjectById(secondProject.id)).resolves.toMatchObject(
      {
        id: secondProject.id,
      },
    );
  });

  it("deletes a project and clears active state when needed", async () => {
    const project = await store.createProject({ name: "Delete Me" });

    await expect(store.deleteProject(project.id)).resolves.toBe(true);
    await expect(store.getActiveProjectId()).resolves.toBeNull();
    await expect(store.listProjects()).resolves.toEqual([]);
  });
});
