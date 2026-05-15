import { RepositoryClient } from "@/components/repository-client";
import { listContentAssets } from "@/lib/content-server";
import { getActiveProject } from "@/lib/project-store";

export default async function RepositoryPage() {
  const [assets, activeProject] = await Promise.all([
    listContentAssets(),
    getActiveProject(),
  ]);

  return (
    <RepositoryClient
      key={activeProject?.id ?? "default"}
      activeProject={activeProject}
      initialAssets={assets}
    />
  );
}
