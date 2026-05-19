import {
  getDatabaseOAuthAppConfig,
  type StoreContext,
  upsertDatabaseOAuthAppConfig,
} from "../../../../packages/db/src/database-store.js";
import type { GrowthPlatform } from "../../../../packages/shared/src/index.js";
import { getDeploymentSettings } from "./deployment-settings.js";

export type OAuthAppConfigInput = {
  platform: GrowthPlatform;
  clientId: string;
  clientSecret?: string;
  context?: StoreContext;
};

export type OAuthAppConfig = {
  platform: GrowthPlatform;
  clientId: string;
  clientSecret?: string;
  hasClientSecret: boolean;
  publicBaseUrl?: string;
  redirectBaseUrl?: string;
  redirectUri: string;
  updatedAt?: string;
};

export const oauthAppPlatforms = ["x", "reddit"] as const;

export function isOAuthAppPlatform(
  value: string,
): value is (typeof oauthAppPlatforms)[number] {
  return oauthAppPlatforms.includes(value as never);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function oauthRedirectUri(input: {
  platform: GrowthPlatform;
  redirectBaseUrl: string;
}) {
  return `${trimTrailingSlash(input.redirectBaseUrl)}/api/connectors/oauth/${input.platform}/callback`;
}

export async function getOAuthAppConfig(platform: GrowthPlatform) {
  if (!isOAuthAppPlatform(platform)) {
    return null;
  }

  const [saved, deploymentSettings] = await Promise.all([
    getDatabaseOAuthAppConfig(platform),
    getDeploymentSettings(),
  ]);
  const clientId = saved?.clientId ?? "";
  const clientSecret = saved?.clientSecret;
  const publicBaseUrl = trimTrailingSlash(deploymentSettings.publicBaseUrl);
  const redirectBaseUrl = trimTrailingSlash(deploymentSettings.redirectBaseUrl);

  return {
    platform,
    clientId,
    clientSecret,
    hasClientSecret: Boolean(clientSecret),
    publicBaseUrl,
    redirectBaseUrl,
    redirectUri: oauthRedirectUri({ platform, redirectBaseUrl }),
    updatedAt: saved?.updatedAt,
  };
}

export async function listOAuthAppConfigs(): Promise<OAuthAppConfig[]> {
  const deploymentSettings = await getDeploymentSettings();
  const redirectBaseUrl = trimTrailingSlash(deploymentSettings.redirectBaseUrl);
  const publicBaseUrl = trimTrailingSlash(deploymentSettings.publicBaseUrl);

  return Promise.all(
    oauthAppPlatforms.map(async (platform) => {
      const saved = await getDatabaseOAuthAppConfig(platform);
      return {
        platform,
        clientId: saved?.clientId ?? "",
        hasClientSecret: Boolean(saved?.clientSecret),
        publicBaseUrl,
        redirectBaseUrl,
        redirectUri: oauthRedirectUri({
          platform,
          redirectBaseUrl,
        }),
        updatedAt: saved?.updatedAt,
      };
    }),
  );
}

export async function saveOAuthAppConfig(input: OAuthAppConfigInput) {
  if (!isOAuthAppPlatform(input.platform)) {
    throw new Error("OAuth app platform is not supported.");
  }

  const existing = await getDatabaseOAuthAppConfig(input.platform);
  const clientSecret = input.clientSecret?.trim() || existing?.clientSecret;

  if (!input.clientId.trim() || !clientSecret?.trim()) {
    throw new Error("Client ID and client secret are required.");
  }

  const config = await upsertDatabaseOAuthAppConfig(
    {
      platform: input.platform,
      clientId: input.clientId.trim(),
      clientSecret: clientSecret.trim(),
    },
    input.context,
  );
  if (!config) {
    throw new Error("Supabase OAuth app configuration is not available.");
  }
  const deploymentSettings = await getDeploymentSettings();
  const redirectBaseUrl = trimTrailingSlash(deploymentSettings.redirectBaseUrl);
  return {
    ...config,
    publicBaseUrl: trimTrailingSlash(deploymentSettings.publicBaseUrl),
    redirectBaseUrl,
    redirectUri: oauthRedirectUri({
      platform: input.platform,
      redirectBaseUrl,
    }),
  };
}

export async function requireOAuthAppRuntimeConfig(platform: GrowthPlatform) {
  const config = await getOAuthAppConfig(platform);
  if (!config?.clientId) {
    throw new Error(`${platform} OAuth app is not configured.`);
  }
  return {
    ...config,
    clientId: config.clientId,
  } satisfies OAuthAppConfig & { clientId: string };
}
