"use client";

import type { WorkspaceProject } from "@shared";
import {
  BarChart3,
  Check,
  ChevronDown,
  Folder,
  Home,
  Link2,
  Loader2,
  type LucideIcon,
  Plus,
  Send,
  TrendingUp,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/state/auth-context";
import { useWorkspace } from "@/state/workspace-context";
import { apiJson } from "@/ui/lib/api";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type ProjectResponse = {
  project: WorkspaceProject;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Connectors", href: "/connectors", icon: Link2 },
  { label: "Content Repository", href: "/repository", icon: Folder },
  { label: "Publish", href: "/publish", icon: Send },
  { label: "Tracking", href: "/tracking", icon: BarChart3 },
  { label: "Trends", href: "/trends", icon: TrendingUp },
];

export function Sidebar() {
  const location = useLocation();
  const auth = useAuth();
  const { projects, activeProject, loading, setWorkspace } = useWorkspace();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeProjectName = activeProject?.name ?? "Open Growth";

  const switchProject = (project: WorkspaceProject) => {
    if (project.id === activeProject?.id) {
      setIsSwitcherOpen(false);
      return;
    }

    startTransition(async () => {
      setError(null);

      try {
        const data = await apiJson<ProjectResponse>("/api/projects/active", {
          method: "PUT",
          body: JSON.stringify({ projectId: project.id }),
        });

        setWorkspace({ projects, activeProject: data.project });
        setIsSwitcherOpen(false);
      } catch (projectError) {
        setError(
          projectError instanceof Error
            ? projectError.message
            : "Unable to switch project.",
        );
      }
    });
  };

  const createWorkspaceProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      setError(null);

      try {
        const data = await apiJson<ProjectResponse>("/api/projects", {
          method: "POST",
          body: JSON.stringify({ name: projectName }),
        });

        setWorkspace({
          projects: [...projects, data.project],
          activeProject: data.project,
        });
        setProjectName("");
        setIsDialogOpen(false);
        setIsSwitcherOpen(false);
      } catch (projectError) {
        setError(
          projectError instanceof Error
            ? projectError.message
            : "Unable to create project.",
        );
      }
    });
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-white/10 bg-slate-950 text-slate-100">
        <div className="relative px-3 py-4">
          <button
            aria-expanded={isSwitcherOpen}
            className="flex h-14 w-full items-center gap-3 rounded-lg px-3 text-left transition hover:bg-white/8"
            onClick={() => setIsSwitcherOpen((isOpen) => !isOpen)}
            type="button"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30">
              OG
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                Workspace
              </p>
              <h1 className="truncate text-base font-bold tracking-tight">
                {loading ? "Loading..." : activeProjectName}
              </h1>
            </div>
            <ChevronDown
              aria-hidden="true"
              className={[
                "size-4 shrink-0 text-cyan-200/80 transition",
                isSwitcherOpen ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          {isSwitcherOpen ? (
            <div className="absolute left-3 right-3 top-[4.75rem] z-40 overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-2xl shadow-slate-950/60">
              <div className="max-h-64 overflow-y-auto p-2">
                {projects.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-400">
                    No projects yet.
                  </p>
                ) : (
                  projects.map((project) => {
                    const isActive = project.id === activeProject?.id;

                    return (
                      <button
                        className={[
                          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                          isActive
                            ? "bg-cyan-400/12 text-cyan-100"
                            : "text-slate-300 hover:bg-white/8 hover:text-white",
                        ].join(" ")}
                        key={project.id}
                        onClick={() => switchProject(project)}
                        type="button"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {project.name}
                          </span>
                        </span>
                        {isActive ? (
                          <Check
                            aria-hidden="true"
                            className="size-4 text-emerald-300"
                          />
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="border-t border-white/10 p-2">
                <button
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 text-sm font-semibold text-slate-950 transition hover:brightness-105"
                  onClick={() => {
                    setError(null);
                    setIsDialogOpen(true);
                  }}
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  New Project
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.href);

            return (
              <NavLink
                key={item.href}
                to={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "group flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                  isActive
                    ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/20"
                    : "text-slate-300 hover:bg-white/8 hover:text-white",
                ].join(" ")}
              >
                <Icon
                  aria-hidden="true"
                  className={[
                    "size-4 shrink-0",
                    isActive
                      ? "text-slate-950"
                      : "text-cyan-200/70 group-hover:text-cyan-100",
                  ].join(" ")}
                />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Growth OS
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Content, signals, and publishing in one workspace.
          </p>
          {auth.mode === "supabase" ? (
            <button
              className="mt-4 h-9 rounded-lg border border-white/10 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/8"
              onClick={() => void auth.signOut()}
              type="button"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </aside>

      {isDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-slate-950/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Workspace
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">
                  New Project
                </h2>
              </div>
              <button
                aria-label="Close new project dialog"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/8 hover:text-white"
                onClick={() => setIsDialogOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={createWorkspaceProject}>
              <label className="block">
                <span className="text-sm font-medium text-slate-200">
                  Project name
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10"
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Campaign Lab"
                  required
                  type="text"
                  value={projectName}
                />
              </label>

              {error ? (
                <p className="rounded-lg border border-rose-900/60 bg-rose-950/60 px-3 py-2 text-sm text-rose-100">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  className="h-10 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/8"
                  onClick={() => setIsDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : null}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
