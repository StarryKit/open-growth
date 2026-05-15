import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

/** All workspace projects live under ~/.open-growth/ */
export const WORKSPACE_ROOT = path.join(os.homedir(), ".open-growth");

export type WorkspaceProject = {
  id: string;
  name: string;
  rootDir: string;
  createdAt: string;
};

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

const dataDirectory = path.join(process.cwd(), "data");
const projectsFilePath = path.join(dataDirectory, "projects.json");
const activeProjectFilePath = path.join(dataDirectory, "active-project.json");

const emptyProjectStore: ProjectStore = { projects: [] };

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallback;
    }

    if (error instanceof SyntaxError) {
      return fallback;
    }

    throw error;
  }
}

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
  const store = await readJsonFile<ProjectStore>(projectsFilePath, emptyProjectStore);

  return {
    projects: Array.isArray(store.projects) ? store.projects.filter(isWorkspaceProject) : [],
  };
}

async function writeProjectStore(store: ProjectStore) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(projectsFilePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function readActiveProjectStore(): Promise<ActiveProjectStore> {
  const store = await readJsonFile<ActiveProjectStore>(activeProjectFilePath, {
    activeProjectId: null,
  });

  return {
    activeProjectId:
      typeof store.activeProjectId === "string" && store.activeProjectId.length > 0
        ? store.activeProjectId
        : null,
  };
}

async function writeActiveProjectStore(activeProjectId: string | null) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(
    activeProjectFilePath,
    `${JSON.stringify({ activeProjectId }, null, 2)}\n`,
    "utf8",
  );
}

export async function listProjects(): Promise<WorkspaceProject[]> {
  const store = await readProjectStore();
  return store.projects;
}

export async function getProjectById(projectId: string): Promise<WorkspaceProject | null> {
  const projects = await listProjects();
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function getActiveProjectId(): Promise<string | null> {
  const store = await readActiveProjectStore();
  return store.activeProjectId;
}

export async function getActiveProject(): Promise<WorkspaceProject | null> {
  const [projects, activeProjectId] = await Promise.all([listProjects(), getActiveProjectId()]);

  if (!activeProjectId) {
    return null;
  }

  return projects.find((project) => project.id === activeProjectId) ?? null;
}

export async function createProject(input: { name: string }) {
  const rootDir = getWorkspaceDir(input.name);

  await fs.mkdir(rootDir, { recursive: true });

  const project: WorkspaceProject = {
    id: randomUUID(),
    name: input.name.trim(),
    rootDir,
    createdAt: new Date().toISOString(),
  };

  const projects = await listProjects();
  const nextProjects = [...projects, project];

  await writeProjectStore({ projects: nextProjects });
  await writeActiveProjectStore(project.id);

  return project;
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const projects = await listProjects();
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

export async function setActiveProject(projectId: string | null): Promise<WorkspaceProject | null> {
  if (!projectId) {
    await writeActiveProjectStore(null);
    return null;
  }

  const project = await getProjectById(projectId);

  if (!project) {
    return null;
  }

  await writeActiveProjectStore(project.id);
  return project;
}
