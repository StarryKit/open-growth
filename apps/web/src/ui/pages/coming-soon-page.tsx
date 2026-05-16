import type { LucideIcon } from "lucide-react";

export function ComingSoonPage({
  title,
  icon: Icon,
}: {
  title: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-5xl place-items-center px-8 py-12">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid size-16 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-950">
          <Icon aria-hidden="true" className="size-8" />
        </div>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
          Coming soon
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-4 max-w-xl text-slate-600 dark:text-slate-400">
          This workspace module is reserved for the next Open Growth workflow.
        </p>
      </section>
    </div>
  );
}
