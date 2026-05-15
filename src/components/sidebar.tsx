"use client";

import {
  BarChart3,
  Folder,
  Home,
  Send,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Content Repository", href: "/repository", icon: Folder },
  { label: "Publish", href: "/publish", icon: Send },
  { label: "Tracking", href: "/tracking", icon: BarChart3 },
  { label: "Trends", href: "/trends", icon: TrendingUp },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-white/10 bg-slate-950 text-slate-100">
      <div className="flex h-20 items-center gap-3 px-6">
        <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30">
          OG
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
            Open
          </p>
          <h1 className="text-xl font-bold tracking-tight">Growth</h1>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
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
                  isActive ? "text-slate-950" : "text-cyan-200/70 group-hover:text-cyan-100",
                ].join(" ")}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          Growth OS
        </p>
        <p className="mt-2 text-sm text-slate-300">Content, signals, and publishing in one workspace.</p>
      </div>
    </aside>
  );
}
