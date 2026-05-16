import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/ui/layout/app-shell";
import { DashboardPage } from "@/ui/pages/dashboard-page";
import { PublishPage } from "@/ui/pages/publish-page";
import { RepositoryPage } from "@/ui/pages/repository-page";
import { TrackingPage } from "@/ui/pages/tracking-page";
import { TrendsPage } from "@/ui/pages/trends-page";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="repository" element={<RepositoryPage />} />
        <Route path="publish" element={<PublishPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="trends" element={<TrendsPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
