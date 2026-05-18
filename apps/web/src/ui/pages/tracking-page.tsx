import type { EngagementOverview } from "@shared";
import {
  BarChart3,
  MousePointerClick,
  RefreshCw,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { apiJson, formatDate, formatNumber } from "@/ui/lib/api";

const emptyOverview: EngagementOverview = {
  totals: {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    bookmarks: 0,
    clicks: 0,
  },
  publishedTargetCount: 0,
  averageEngagementRate: 0,
  byPlatform: [],
  content: [],
};

export function TrackingPage() {
  const [overview, setOverview] = useState<EngagementOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadOverview = async () => {
    setLoading(true);
    try {
      setOverview(
        await apiJson<EngagementOverview>("/api/engagement/overview"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const refreshAll = () => {
    startTransition(async () => {
      setMessage(null);
      await apiJson("/api/engagement/refresh", { method: "POST" });
      await loadOverview();
      setMessage("Engagement snapshots refreshed.");
    });
  };

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
              Engagement tracking
            </p>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">
              Snapshot performance across published targets
            </h1>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
            disabled={isPending}
            onClick={refreshAll}
            type="button"
          >
            <RefreshCw className="size-4" />
            Refresh all
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/50 dark:text-cyan-100">
            {message}
          </p>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={BarChart3}
            label="Views"
            value={overview.totals.views}
          />
          <MetricCard
            icon={ThumbsUp}
            label="Interactions"
            value={
              overview.totals.likes +
              overview.totals.comments +
              overview.totals.shares
            }
          />
          <MetricCard
            icon={MousePointerClick}
            label="Clicks"
            value={overview.totals.clicks}
          />
          <MetricCard
            icon={RefreshCw}
            label="Published targets"
            value={overview.publishedTargetCount}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="font-bold text-slate-950 dark:text-white">
                Content performance
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {overview.content.map((item) => (
                <article key={item.content.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-950 dark:text-white">
                        {item.content.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.content.status} ·{" "}
                        {item.content.platformTargets.length} platforms
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-right text-sm">
                      <Stat label="Views" value={item.totalMetrics.views} />
                      <Stat label="Likes" value={item.totalMetrics.likes} />
                      <Stat
                        label="Rate"
                        value={`${(item.engagementRate * 100).toFixed(1)}%`}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.latestSnapshots.map((snapshot) => (
                      <span
                        key={snapshot.id}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {snapshot.platform} · {formatDate(snapshot.capturedAt)}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
              {!loading && overview.content.length === 0 ? (
                <div className="px-5 py-12 text-center text-slate-500">
                  Publish content first, then refresh engagement snapshots.
                </div>
              ) : null}
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-bold text-slate-950 dark:text-white">
              Platform comparison
            </h2>
            <div className="mt-4 space-y-3">
              {overview.byPlatform.map((platform) => (
                <div
                  key={platform.platform}
                  className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{platform.platform}</span>
                    <span className="text-xs text-slate-500">
                      {(platform.engagementRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{
                        width: `${Math.min(platform.engagementRate * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {formatNumber(platform.metrics.views)} views
                  </div>
                </div>
              ))}
              {overview.byPlatform.length === 0 ? (
                <p className="text-sm text-slate-500">No platform data yet.</p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Icon className="size-5 text-cyan-600 dark:text-cyan-300" />
      <div className="mt-5 text-3xl font-black text-slate-950 dark:text-white">
        {formatNumber(value)}
      </div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="font-bold text-slate-950 dark:text-white">
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
