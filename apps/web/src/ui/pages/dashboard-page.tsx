export function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-8 py-12">
      <div className="max-w-2xl space-y-6 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Open{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Growth
          </span>
        </h1>
        <p className="mx-auto max-w-lg text-lg text-gray-500 dark:text-gray-400">
          社交媒体运营与推广工具集 — 数据驱动的内容增长引擎
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-500/20">
            React
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-500/20">
            Fastify
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700 ring-1 ring-inset ring-cyan-600/20 dark:bg-cyan-950 dark:text-cyan-300 dark:ring-cyan-500/20">
            Vite
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-950 dark:text-purple-300 dark:ring-purple-500/20">
            OpenLoomi
          </span>
        </div>
      </div>
    </div>
  );
}
