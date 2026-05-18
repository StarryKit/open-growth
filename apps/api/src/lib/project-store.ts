import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { WorkspaceProject } from "../../../../packages/shared/src/workspace.js";
import {
  deleteDatabaseProject,
  insertDatabaseProject,
  listDatabaseProjects,
  type StoreContext,
} from "./database-store.js";
import { dataDirectory, readJsonFile, writeJsonFile } from "./json-store.js";

/** All workspace projects live under ~/.open-growth/ */
export const WORKSPACE_ROOT = path.join(os.homedir(), ".open-growth");

/** Compute the project directory from its name. */
export function getWorkspaceDir(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return path.join(WORKSPACE_ROOT, slug || "untitled");
}

type ProjectStore = {
  projects: WorkspaceProject[];
};

type ActiveProjectStore = {
  activeProjectId: string | null;
};

const projectsFilePath = path.join(dataDirectory, "projects.json");
const activeProjectFilePath = path.join(dataDirectory, "active-project.json");

const emptyProjectStore: ProjectStore = { projects: [] };

function isWorkspaceProject(value: unknown): value is WorkspaceProject {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WorkspaceProject>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.rootDir === "string" &&
    typeof candidate.createdAt === "string"
  );
}

async function readProjectStore(): Promise<ProjectStore> {
  const store = await readJsonFile<ProjectStore>(
    projectsFilePath,
    emptyProjectStore,
  );

  return {
    projects: Array.isArray(store.projects)
      ? store.projects.filter(isWorkspaceProject)
      : [],
  };
}

async function writeProjectStore(store: ProjectStore) {
  await writeJsonFile(projectsFilePath, store);
}

async function readActiveProjectStore(): Promise<ActiveProjectStore> {
  const store = await readJsonFile<ActiveProjectStore>(activeProjectFilePath, {
    activeProjectId: null,
  });

  return {
    activeProjectId:
      typeof store.activeProjectId === "string" &&
      store.activeProjectId.length > 0
        ? store.activeProjectId
        : null,
  };
}

async function writeActiveProjectStore(activeProjectId: string | null) {
  await writeJsonFile(activeProjectFilePath, { activeProjectId });
}

export async function listProjects(
  context?: StoreContext,
): Promise<WorkspaceProject[]> {
  const databaseProjects = await listDatabaseProjects(context);
  if (databaseProjects) {
    return databaseProjects;
  }

  const store = await readProjectStore();
  return store.projects;
}

export async function getProjectById(
  projectId: string,
  context?: StoreContext,
): Promise<WorkspaceProject | null> {
  const projects = await listProjects(context);
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function getActiveProjectId(): Promise<string | null> {
  const store = await readActiveProjectStore();
  return store.activeProjectId;
}

export async function getActiveProject(
  context?: StoreContext,
): Promise<WorkspaceProject | null> {
  const [projects, activeProjectId] = await Promise.all([
    listProjects(context),
    getActiveProjectId(),
  ]);

  if (!activeProjectId) {
    return projects[0] ?? null;
  }

  return projects.find((project) => project.id === activeProjectId) ?? null;
}

export async function createProject(
  input: { name: string },
  context?: StoreContext,
) {
  const databaseProject = await insertDatabaseProject(input, context);
  if (databaseProject) {
    return databaseProject;
  }

  const rootDir = getWorkspaceDir(input.name);

  await fs.mkdir(rootDir, { recursive: true });

  const project: WorkspaceProject = {
    id: randomUUID(),
    name: input.name.trim(),
    rootDir,
    createdAt: new Date().toISOString(),
  };

  const projects = await listProjects(context);
  const nextProjects = [...projects, project];

  await writeProjectStore({ projects: nextProjects });
  await writeActiveProjectStore(project.id);

  return project;
}

export async function deleteProject(
  projectId: string,
  context?: StoreContext,
): Promise<boolean> {
  const databaseRemoved = await deleteDatabaseProject(projectId, context);
  if (databaseRemoved !== null) {
    return databaseRemoved;
  }

  const projects = await listProjects(context);
  const nextProjects = projects.filter((project) => project.id !== projectId);

  if (nextProjects.length === projects.length) {
    return false;
  }

  await writeProjectStore({ projects: nextProjects });

  const activeProjectId = await getActiveProjectId();
  if (activeProjectId === projectId) {
    await writeActiveProjectStore(null);
  }

  return true;
}

export async function setActiveProject(
  projectId: string | null,
  context?: StoreContext,
): Promise<WorkspaceProject | null> {
  if (!projectId) {
    await writeActiveProjectStore(null);
    return null;
  }

  const project = await getProjectById(projectId, context);

  if (!project) {
    return null;
  }

  await writeActiveProjectStore(project.id);
  return project;
}
