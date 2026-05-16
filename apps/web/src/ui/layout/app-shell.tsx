import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/sidebar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <Sidebar />
      <div className="min-h-screen pl-60">
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
