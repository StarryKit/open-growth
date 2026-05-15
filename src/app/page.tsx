export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Open{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Growth
          </span>
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
          社交媒体运营与推广工具集 — 数据驱动的内容增长引擎
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-500/20">
            Next.js 16
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-500/20">
            TypeScript
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700 ring-1 ring-inset ring-cyan-600/20 dark:bg-cyan-950 dark:text-cyan-300 dark:ring-cyan-500/20">
            Tailwind CSS 4
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-950 dark:text-purple-300 dark:ring-purple-500/20">
            OpenCLI
          </span>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { title: "内容引擎", desc: "AI 辅助内容生成与多平台适配" },
            { title: "数据分析", desc: "跨平台数据聚合与增长洞察" },
            { title: "智能排期", desc: "最佳发布时间优化与自动化" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
