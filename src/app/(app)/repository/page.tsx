import { RepositoryClient } from "@/components/repository-client";
import { listContentAssets } from "@/lib/content-server";

export default async function RepositoryPage() {
  const assets = await listContentAssets();

  return <RepositoryClient initialAssets={assets} />;
}
