import type { GrowthPlatform, PublishedContent } from "@shared";
import {
  ArrowRight,
  CalendarClock,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { apiJson, formatDate } from "@/ui/lib/api";

type PublishedContentResponse = {
  contents: PublishedContent[];
};

const platformLabels: Record<GrowthPlatform, string> = {
  x: "X",
  reddit: "Reddit",
  "hacker-news": "Hacker News",
  xiaohongshu: "Xiaohongshu",
  wechat: "WeChat",
};

const publishPlatformOptions = ["x", "reddit"] as GrowthPlatform[];

export function PublishPage() {
  const [contents, setContents] = useState<PublishedContent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [targetBodies, setTargetBodies] = useState<Record<string, string>>({});
  const [, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () =>
      contents.find((content) => content.id === selectedId) ??
      contents[0] ??
      null,
    [contents, selectedId],
  );

  const loadContents = async () => {
    setLoading(true);
    try {
      const data = await apiJson<PublishedContentResponse>(
        "/api/published-content",
      );
      setContents(data.contents);
      setSelectedId((current) => current ?? data.contents[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContents();
  }, []);

  useEffect(() => {
    setDraftTitle(selected?.title ?? "");
    setDraftBody(selected?.body ?? "");
    setTargetBodies(
      Object.fromEntries(
        selected?.platformTargets.map((target) => [
          target.id,
          target.bodyOverride ?? selected.body,
        ]) ?? [],
      ),
    );
  }, [selected?.id, selected?.title, selected?.body]);

  const createDraft = () => {
    startTransition(async () => {
      setMessage(null);
      const created = await apiJson<{ content: PublishedContent }>(
        "/api/published-content",
        {
          method: "POST",
          body: JSON.stringify({
            title: `Draft ${contents.length + 1}`,
            body: "Draft body for project-specific publishing.",
            platforms: publishPlatformOptions,
          }),
        },
      );
      setContents((current) => [created.content, ...current]);
      setSelectedId(created.content.id);
      setMessage("Draft created.");
    });
  };

  const publishSelected = (endpoint: "publish" | "retry") => {
    if (!selected) return;

    startTransition(async () => {
      setMessage(null);
      const result = await apiJson<{ content: PublishedContent }>(
        `/api/published-content/${selected.id}/${endpoint}`,
        {
          method: "POST",
        },
      );
      await apiJson("/api/outbox-events/process", { method: "POST" });
      const refreshed = await apiJson<PublishedContentResponse>(
        "/api/published-content",
      );
      setContents((current) =>
        refreshed.contents.length > 0 ? refreshed.contents : current,
      );
      setSelectedId(result.content.id);
      setMessage(endpoint === "publish" ? "Published." : "Retry triggered.");
    });
  };

  const scheduleSelected = () => {
    if (!selected) return;

    startTransition(async () => {
      const scheduledAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString();
      const result = await apiJson<{ content: PublishedContent }>(
        `/api/published-content/${selected.id}/schedule`,
        {
          method: "POST",
          body: JSON.stringify({ scheduledAt }),
        },
      );
      setContents((current) =>
        current.map((content) =>
          content.id === result.content.id ? result.content : content,
        ),
      );
      setSelectedId(result.content.id);
      setMessage("Scheduled for tomorrow.");
    });
  };

  const saveSelected = () => {
    if (!selected) return;

    startTransition(async () => {
      const result = await apiJson<{ content: PublishedContent }>(
        `/api/published-content/${selected.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: draftTitle,
            body: draftBody,
            platformTargets: selected.platformTargets.map((target) => ({
              id: target.id,
              bodyOverride: targetBodies[target.id] ?? draftBody,
            })),
          }),
        },
      );
      setContents((current) =>
        current.map((content) =>
          content.id === result.content.id ? result.content : content,
        ),
      );
      setMessage("Draft updated.");
    });
  };

  const duplicateSelected = () => {
    if (!selected) return;

    startTransition(async () => {
      const created = await apiJson<{ content: PublishedContent }>(
        "/api/published-content",
        {
          method: "POST",
          body: JSON.stringify({
            title: `${selected.title} copy`,
            body: selected.body,
            assetIds: selected.assetIds,
            platforms: selected.platformTargets.map(
              (target) => target.platform,
            ),
            sourceTrendPostId: selected.sourceTrendPostId,
          }),
        },
      );
      setContents((current) => [created.content, ...current]);
      setSelectedId(created.content.id);
      setMessage("Draft duplicated.");
    });
  };

  const deleteSelected = () => {
    if (!selected) return;

    startTransition(async () => {
      await apiJson(`/api/published-content/${selected.id}`, {
        method: "DELETE",
      });
      setContents((current) =>
        current.filter((content) => content.id !== selected.id),
      );
      setSelectedId(null);
      setMessage("Draft deleted.");
    });
  };

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-900/60 dark:bg-slate-900 dark:text-cyan-300">
              <Sparkles className="size-3.5" />
              Publish workflow
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">
              Drafts, platform targets, and release control
            </h1>
          </div>

          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              onClick={() => void loadContents()}
              type="button"
            >
              <RefreshCw className="size-4" />
              Refresh
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
              disabled={isPending}
              onClick={createDraft}
              type="button"
            >
              <Send className="size-4" />
              New draft
            </button>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/50 dark:text-cyan-100">
            {message}
          </p>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Draft list
            </div>
            <div className="mt-4 space-y-2">
              {contents.map((content) => {
                const isActive = content.id === selected?.id;
                return (
                  <button
                    key={content.id}
                    className={[
                      "w-full rounded-xl border px-3 py-3 text-left transition",
                      isActive
                        ? "border-cyan-300 bg-cyan-50 dark:border-cyan-900/60 dark:bg-cyan-950/30"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40",
                    ].join(" ")}
                    onClick={() => setSelectedId(content.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-950 dark:text-white">
                        {content.title}
                      </span>
                      <ArrowRight className="size-4 text-slate-400" />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {content.status} · {content.platformTargets.length}{" "}
                      targets
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="grid gap-6">
            {selected ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Selected draft
                      </p>
                      <input
                        aria-label="Draft title"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-3xl font-bold text-slate-950 outline-none focus:border-cyan-300 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                        onChange={(event) => setDraftTitle(event.target.value)}
                        value={draftTitle}
                      />
                      <textarea
                        aria-label="Draft body"
                        className="mt-3 min-h-32 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-cyan-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                        onChange={(event) => setDraftBody(event.target.value)}
                        value={draftBody}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800"
                        onClick={saveSelected}
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800"
                        onClick={duplicateSelected}
                        type="button"
                      >
                        Duplicate
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:text-rose-200"
                        onClick={deleteSelected}
                        type="button"
                      >
                        Delete
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800"
                        onClick={() => publishSelected("retry")}
                        type="button"
                      >
                        Retry
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                        onClick={() => publishSelected("publish")}
                        type="button"
                      >
                        <Send className="size-4" />
                        Publish now
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800"
                        onClick={scheduleSelected}
                        type="button"
                      >
                        <CalendarClock className="size-4" />
                        Schedule
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {selected.platformTargets.map((target) => (
                    <article
                      key={target.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                          {platformLabels[target.platform]}
                        </h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {target.status}
                        </span>
                      </div>
                      <dl className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex justify-between gap-3">
                          <dt>Scheduled</dt>
                          <dd>{formatDate(target.scheduledAt)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Published</dt>
                          <dd>{formatDate(target.publishedAt)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Retries</dt>
                          <dd>{target.retryCount}</dd>
                        </div>
                      </dl>
                      <label
                        className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                        htmlFor={`target-body-${target.id}`}
                      >
                        Platform copy
                      </label>
                      <textarea
                        aria-label={`${platformLabels[target.platform]} body override`}
                        className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-cyan-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                        id={`target-body-${target.id}`}
                        onChange={(event) =>
                          setTargetBodies((current) => ({
                            ...current,
                            [target.id]: event.target.value,
                          }))
                        }
                        value={targetBodies[target.id] ?? draftBody}
                      />
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                No draft selected.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
