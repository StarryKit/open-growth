import type { ContentAsset } from "@shared";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { RepositoryClient } from "@/components/repository-client";
import { useWorkspace } from "@/state/workspace-context";

export function RepositoryPage() {
  const { activeProject, loading: workspaceLoading } = useWorkspace();
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAssets = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/upload", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Failed to load assets.");
        }

        const data = (await response.json()) as { assets: ContentAsset[] };

        if (!cancelled) {
          setAssets(data.assets);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load assets.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAssets();

    return () => {
      cancelled = true;
    };
  }, [activeProject?.id]);

  if (workspaceLoading || loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Loading repository
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-100">
          {error}
        </div>
      </div>
    );
  }

  return (
    <RepositoryClient activeProject={activeProject} initialAssets={assets} />
  );
}
