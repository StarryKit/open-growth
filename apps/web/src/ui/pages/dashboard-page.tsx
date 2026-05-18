import type { ConnectorConnection } from "@shared";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Folder,
  Link2,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "@/state/workspace-context";
import { apiJson } from "@/ui/lib/api";

const workflowCards = [
  {
    title: "Repository",
    href: "/repository",
    icon: Folder,
    description: "Collect and tag content assets for the active project.",
  },
  {
    title: "Publish",
    href: "/publish",
    icon: Send,
    description: "Shape drafts into platform targets and schedule release.",
  },
  {
    title: "Tracking",
    href: "/tracking",
    icon: BarChart3,
    description: "Inspect engagement snapshots and platform performance.",
  },
  {
    title: "Trends",
    href: "/trends",
    icon: TrendingUp,
    description:
      "Capture relevant discussions and turn them into response drafts.",
  },
];

export function DashboardPage() {
  const { activeProject, projects } = useWorkspace();
  const [connectors, setConnectors] = useState<ConnectorConnection[]>([]);

  useEffect(() => {
    let cancelled = false;
    void apiJson<{ connectors: ConnectorConnection[] }>("/api/connectors").then(
      (data) => {
        if (!cancelled) {
          setConnectors(data.connectors ?? []);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_42%,#f8fafc_100%)] px-8 py-8 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_48%,#020617_100%)]">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 shadow-sm dark:border-cyan-900/60 dark:bg-slate-900 dark:text-cyan-300">
              <Sparkles className="size-3.5" />
              Open Growth workspace
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-6xl">
              Manage content, publish, track, and respond from one project-aware
              surface.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">
              The current workspace is isolated by project. Use the sidebar to
              switch projects, then move through the repository, publishing,
              tracking, and trends workflows without losing context.
            </p>
          </div>

          <div className="grid min-w-72 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Workspace status
            </div>
            <div className="text-2xl font-black text-slate-950 dark:text-white">
              {activeProject?.name ?? "No active project"}
            </div>
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600 dark:text-slate-400">
              <span>
                {projects.length} project{projects.length === 1 ? "" : "s"}
              </span>
              <span>
                {activeProject
                  ? "Active project ready"
                  : "Create a project to begin"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {workflowCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                to={card.href}
                className="group flex min-h-44 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                      <Icon className="size-5" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                      {card.title}
                    </h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {card.description}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 size-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-950 dark:group-hover:text-white" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Link2 className="size-3.5" />
                Connector status
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">
                Platform access and capability limits
              </h2>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800"
              to="/connectors"
            >
              Manage connectors
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {connectors.map((connector) => (
              <div
                key={connector.platform}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-950 dark:text-white">
                    {connector.displayName}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <CheckCircle2 className="size-3.5" />
                    {connector.connectionStatus}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {connector.limitation}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
