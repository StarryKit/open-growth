import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { getActiveProject, listProjects } from "@/lib/project-store";

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const [projects, activeProject] = await Promise.all([listProjects(), getActiveProject()]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <Sidebar initialProjects={projects} initialActiveProject={activeProject} />
      <div className="min-h-screen pl-60">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
