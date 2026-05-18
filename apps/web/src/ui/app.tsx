import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/state/auth-context";
import { WorkspaceProvider } from "@/state/workspace-context";
import { AppShell } from "@/ui/layout/app-shell";
import { AuthPage } from "@/ui/pages/auth-page";
import { ConnectorsPage } from "@/ui/pages/connectors-page";
import { PublishPage } from "@/ui/pages/publish-page";
import { RepositoryPage } from "@/ui/pages/repository-page";
import { TrackingPage } from "@/ui/pages/tracking-page";
import { TrendsPage } from "@/ui/pages/trends-page";

export function App() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-300">
        Loading session
      </div>
    );
  }

  if (auth.mode === "supabase" && !auth.session) {
    return <AuthPage />;
  }

  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate replace to="/connectors" />} />
          <Route path="connectors" element={<ConnectorsPage />} />
          <Route path="repository" element={<RepositoryPage />} />
          <Route path="publish" element={<PublishPage />} />
          <Route path="tracking" element={<TrackingPage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}
