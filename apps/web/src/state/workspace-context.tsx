import type { WorkspaceProject } from "@shared";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/state/auth-context";
import { apiJson, configureApiAuth, configureApiProject } from "@/ui/lib/api";

type WorkspaceState = {
  projects: WorkspaceProject[];
  activeProject: WorkspaceProject | null;
  loading: boolean;
  reloadWorkspace: () => Promise<void>;
  setWorkspace: (next: {
    projects: WorkspaceProject[];
    activeProject: WorkspaceProject | null;
  }) => void;
};

const WorkspaceContext = createContext<WorkspaceState | null>(null);

async function fetchWorkspace() {
  return apiJson<{
    projects: WorkspaceProject[];
    activeProject: WorkspaceProject | null;
  }>("/api/projects");
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [activeProject, setActiveProject] = useState<WorkspaceProject | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const reloadWorkspace = async () => {
    setLoading(true);

    try {
      const data = await fetchWorkspace();
      setProjects(data.projects);
      setActiveProject(data.activeProject);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    configureApiAuth(auth.accessToken);
    void reloadWorkspace();
  }, [auth.accessToken]);

  useEffect(() => {
    configureApiProject(() => activeProject?.id ?? null);
    return () => configureApiProject(null);
  }, [activeProject?.id]);

  const value = useMemo<WorkspaceState>(
    () => ({
      projects,
      activeProject,
      loading,
      reloadWorkspace,
      setWorkspace: (next) => {
        setProjects(next.projects);
        setActiveProject(next.activeProject);
      },
    }),
    [activeProject, loading, projects],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider.");
  }

  return context;
}
