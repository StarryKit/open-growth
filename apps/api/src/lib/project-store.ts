import {
  deleteDatabaseProject,
  insertDatabaseProject,
  listDatabaseProjects,
  type StoreContext,
} from "../../../../packages/db/src/database-store.js";
import type { WorkspaceProject } from "../../../../packages/shared/src/workspace.js";

export async function listProjects(
  context?: StoreContext,
): Promise<WorkspaceProject[]> {
  const databaseProjects = await listDatabaseProjects(context);
  if (!databaseProjects) {
    throw new Error("Supabase project storage is not configured.");
  }

  return databaseProjects;
}

export async function getProjectById(
  projectId: string,
  context?: StoreContext,
): Promise<WorkspaceProject | null> {
  const projects = await listProjects(context);
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function getActiveProject(
  context?: StoreContext,
): Promise<WorkspaceProject | null> {
  const projects = await listProjects(context);
  const activeProjectId = context?.activeProjectId ?? null;

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
  if (!databaseProject) {
    throw new Error("Supabase project storage is not configured.");
  }

  return databaseProject;
}

export async function deleteProject(
  projectId: string,
  context?: StoreContext,
): Promise<boolean> {
  const databaseRemoved = await deleteDatabaseProject(projectId, context);
  if (databaseRemoved === null) {
    throw new Error("Supabase project storage is not configured.");
  }

  return databaseRemoved;
}

export async function setActiveProject(
  projectId: string | null,
  context?: StoreContext,
): Promise<WorkspaceProject | null> {
  if (!projectId) {
    return null;
  }

  const project = await getProjectById(projectId, context);

  if (!project) {
    return null;
  }

  return project;
}
