import {
  getDatabaseDeploymentSettings,
  type StoreContext,
  upsertDatabaseDeploymentSettings,
} from "../../../../packages/db/src/database-store.js";

export type DeploymentSettings = {
  publicBaseUrl: string;
  redirectBaseUrl: string;
  updatedAt?: string;
};

function defaultPublicBaseUrl() {
  return "http://localhost:5173";
}

function defaultRedirectBaseUrl() {
  return "http://localhost:3001";
}

export async function getDeploymentSettings(): Promise<DeploymentSettings> {
  const saved = await getDatabaseDeploymentSettings();
  return {
    publicBaseUrl: saved?.publicBaseUrl ?? defaultPublicBaseUrl(),
    redirectBaseUrl: saved?.redirectBaseUrl ?? defaultRedirectBaseUrl(),
    updatedAt: saved?.updatedAt,
  };
}

export async function saveDeploymentSettings(input: {
  publicBaseUrl: string;
  redirectBaseUrl: string;
  context?: StoreContext;
}) {
  const config = await upsertDatabaseDeploymentSettings(
    {
      publicBaseUrl: input.publicBaseUrl.trim(),
      redirectBaseUrl: input.redirectBaseUrl.trim(),
    },
    input.context,
  );

  if (!config) {
    throw new Error("Supabase deployment settings are not available.");
  }

  return config;
}
