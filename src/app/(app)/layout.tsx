import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <Sidebar />
      <div className="min-h-screen pl-60">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
