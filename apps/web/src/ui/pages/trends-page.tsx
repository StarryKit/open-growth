import type { GrowthPlatform, TrendPost, TrendQuery } from "@shared";
import {
  Bookmark,
  EyeOff,
  MessageSquarePlus,
  Play,
  Search,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { apiJson, formatDate, formatNumber } from "@/ui/lib/api";

const platformLabels: Record<GrowthPlatform, string> = {
  x: "X",
  reddit: "Reddit",
  "hacker-news": "Hacker News",
  xiaohongshu: "Xiaohongshu",
  wechat: "WeChat",
};

const defaultPlatforms = ["x", "reddit", "hacker-news"] as GrowthPlatform[];

export function TrendsPage() {
  const [queries, setQueries] = useState<TrendQuery[]>([]);
  const [posts, setPosts] = useState<TrendPost[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [queryName, setQueryName] = useState("Project opportunity scan");
  const [keywords, setKeywords] = useState(
    "open growth, social media, content operations",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedQuery = useMemo(
    () =>
      queries.find((query) => query.id === selectedQueryId) ??
      queries[0] ??
      null,
    [queries, selectedQueryId],
  );

  const loadData = async () => {
    const [queryData, postData] = await Promise.all([
      apiJson<{ queries: TrendQuery[] }>("/api/trends/queries"),
      apiJson<{ posts: TrendPost[] }>("/api/trends/posts"),
    ]);
    setQueries(queryData.queries);
    setPosts(postData.posts);
    setSelectedQueryId(
      (current) => current ?? queryData.queries[0]?.id ?? null,
    );
  };

  useEffect(() => {
    void loadData();
  }, []);

  const createQuery = () => {
    startTransition(async () => {
      setMessage(null);
      const result = await apiJson<{ query: TrendQuery }>(
        "/api/trends/queries",
        {
          method: "POST",
          body: JSON.stringify({
            name: queryName,
            keywords: keywords
              .split(",")
              .map((keyword) => keyword.trim())
              .filter(Boolean),
            platforms: defaultPlatforms,
            timeRange: "7d",
            language: "en",
          }),
        },
      );
      setQueries((current) => [result.query, ...current]);
      setSelectedQueryId(result.query.id);
      setMessage("Trend query created.");
    });
  };

  const runQuery = (query: TrendQuery) => {
    startTransition(async () => {
      setMessage(null);
      const result = await apiJson<{ posts: TrendPost[] }>(
        `/api/trends/queries/${query.id}/run`,
        { method: "POST" },
      );
      if (result.posts.length === 0) {
        await apiJson("/api/outbox-events/process", { method: "POST" });
      }
      await loadData();
      setMessage(
        result.posts.length === 0
          ? "Trend search queued and processed."
          : `${result.posts.length} posts found.`,
      );
    });
  };

  const updatePostStatus = (post: TrendPost, status: TrendPost["status"]) => {
    startTransition(async () => {
      const result = await apiJson<{ post: TrendPost }>(
        `/api/trends/posts/${post.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      setPosts((current) =>
        current.map((item) =>
          item.id === result.post.id ? result.post : item,
        ),
      );
    });
  };

  const createResponseDraft = (post: TrendPost) => {
    startTransition(async () => {
      const result = await apiJson<{ post: TrendPost }>(
        `/api/trends/posts/${post.id}/create-response-draft`,
        { method: "POST" },
      );
      setPosts((current) =>
        current.map((item) =>
          item.id === result.post.id ? result.post : item,
        ),
      );
      setMessage("Response draft created in Publish.");
    });
  };

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
              Trends search
            </p>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">
              Find relevant posts and turn them into response drafts
            </h1>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap gap-2">
              <input
                className="h-10 w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-300 dark:border-slate-800 dark:bg-slate-950"
                onChange={(event) => setQueryName(event.target.value)}
                value={queryName}
              />
              <input
                className="h-10 w-80 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-300 dark:border-slate-800 dark:bg-slate-950"
                onChange={(event) => setKeywords(event.target.value)}
                value={keywords}
              />
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                disabled={isPending}
                onClick={createQuery}
                type="button"
              >
                <Search className="size-4" />
                Save query
              </button>
            </div>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/50 dark:text-cyan-100">
            {message}
          </p>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Saved queries
            </div>
            <div className="mt-4 space-y-2">
              {queries.map((query) => (
                <button
                  key={query.id}
                  className={[
                    "w-full rounded-xl border px-3 py-3 text-left transition",
                    query.id === selectedQuery?.id
                      ? "border-cyan-300 bg-cyan-50 dark:border-cyan-900/60 dark:bg-cyan-950/30"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40",
                  ].join(" ")}
                  onClick={() => setSelectedQueryId(query.id)}
                  type="button"
                >
                  <div className="font-semibold text-slate-950 dark:text-white">
                    {query.name}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {query.keywords.join(", ")}
                  </div>
                </button>
              ))}
              {queries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
                  Create a keyword query to start searching.
                </p>
              ) : null}
            </div>
            {selectedQuery ? (
              <button
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                disabled={isPending}
                onClick={() => runQuery(selectedQuery)}
                type="button"
              >
                <Play className="size-4" />
                Run selected query
              </button>
            ) : null}
          </aside>

          <section className="grid gap-4">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold dark:bg-slate-800">
                        {platformLabels[post.platform]}
                      </span>
                      <span>{post.author}</span>
                      <span>{formatDate(post.postedAt)}</span>
                      <span>{post.status}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold text-slate-950 dark:text-white">
                      {post.title}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {post.summary}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold dark:bg-slate-800">
                      <TrendingUp className="size-4 text-cyan-600 dark:text-cyan-300" />
                      {post.relevanceScore}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {formatNumber(post.metrics.views)} views
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {post.matchedKeywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-800"
                    onClick={() => updatePostStatus(post, "saved")}
                    type="button"
                  >
                    <Bookmark className="size-4" />
                    Save
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-800"
                    onClick={() => updatePostStatus(post, "ignored")}
                    type="button"
                  >
                    <EyeOff className="size-4" />
                    Ignore
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                    onClick={() => createResponseDraft(post)}
                    type="button"
                  >
                    <MessageSquarePlus className="size-4" />
                    Response draft
                  </button>
                </div>
              </article>
            ))}
            {posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                Run a query to collect normalized TrendPost results.
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
