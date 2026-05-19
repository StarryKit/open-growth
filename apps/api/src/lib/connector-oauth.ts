import { createHash, randomBytes } from "node:crypto";
import {
  consumeDatabaseConnectorOAuthAuthorization,
  insertDatabaseConnectorOAuthAuthorization,
  type StoreContext,
  saveDatabaseOAuthTokenSecret,
} from "../../../../packages/db/src/database-store.js";
import type {
  ConnectorUseCase,
  GrowthPlatform,
} from "../../../../packages/shared/src/index.js";
import { getDeploymentSettings } from "./deployment-settings.js";
import { upsertPublishingIdentity } from "./domain-store.js";
import { requireOAuthAppRuntimeConfig } from "./oauth-app-config.js";

type OAuthProviderConfig = {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  useCases: ConnectorUseCase[];
  pkce: boolean;
};

const providerConfigs: Partial<Record<GrowthPlatform, OAuthProviderConfig>> = {
  x: {
    authorizationUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    useCases: ["publish", "reply", "engagement"],
    pkce: true,
  },
  reddit: {
    authorizationUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    scopes: ["identity", "submit", "read", "edit", "history"],
    useCases: ["publish", "reply", "engagement"],
    pkce: false,
  },
};

function base64Url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function codeChallenge(verifier: string) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

function providerFor(platform: GrowthPlatform) {
  const provider = providerConfigs[platform];
  if (!provider) {
    throw new Error(`${platform} does not have a publishing OAuth flow yet.`);
  }
  return provider;
}

export async function beginPublishingOAuth(input: {
  platform: GrowthPlatform;
  redirectTo?: string;
  context: StoreContext;
}) {
  const provider = providerFor(input.platform);
  const appConfig = await requireOAuthAppRuntimeConfig(input.platform);
  const state = base64Url(randomBytes(32));
  const codeVerifier = provider.pkce ? base64Url(randomBytes(32)) : undefined;
  const safeRedirectTo = input.redirectTo?.startsWith("/")
    ? input.redirectTo
    : "/connectors";

  await insertDatabaseConnectorOAuthAuthorization(
    {
      platform: input.platform,
      state,
      codeVerifier,
      redirectTo: safeRedirectTo,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
    input.context,
  );

  const authorizationUrl = new URL(provider.authorizationUrl);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", appConfig.clientId);
  authorizationUrl.searchParams.set("redirect_uri", appConfig.redirectUri);
  authorizationUrl.searchParams.set("scope", provider.scopes.join(" "));
  authorizationUrl.searchParams.set("state", state);
  if (input.platform === "reddit") {
    authorizationUrl.searchParams.set("duration", "permanent");
  }
  if (codeVerifier) {
    authorizationUrl.searchParams.set(
      "code_challenge",
      codeChallenge(codeVerifier),
    );
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
  }

  return {
    authorizationUrl: authorizationUrl.toString(),
    state,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

async function exchangeCode(input: {
  platform: GrowthPlatform;
  code: string;
  codeVerifier?: string;
}) {
  const provider = providerFor(input.platform);
  const appConfig = await requireOAuthAppRuntimeConfig(input.platform);
  const clientSecret = appConfig.clientSecret;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: appConfig.redirectUri,
  });

  if (input.codeVerifier) {
    body.set("code_verifier", input.codeVerifier);
  }

  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "open-growth/0.1",
  });

  if (input.platform === "reddit" && clientSecret) {
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${appConfig.clientId}:${clientSecret}`).toString("base64")}`,
    );
  } else {
    body.set("client_id", appConfig.clientId);
    if (clientSecret) {
      body.set("client_secret", clientSecret);
    }
  }

  const response = await fetch(provider.tokenUrl, {
    method: "POST",
    headers,
    body,
  });
  const token = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!response.ok || typeof token?.access_token !== "string") {
    const description =
      typeof token?.error_description === "string"
        ? token.error_description
        : typeof token?.error === "string"
          ? token.error
          : "OAuth token exchange failed.";
    throw new Error(description);
  }

  return token as Record<string, unknown> & { access_token: string };
}

export async function completePublishingOAuth(input: {
  platform: GrowthPlatform;
  code: string;
  state: string;
}) {
  const provider = providerFor(input.platform);
  const authorization = await consumeDatabaseConnectorOAuthAuthorization({
    platform: input.platform,
    state: input.state,
  });

  if (!authorization) {
    throw new Error("OAuth authorization state is invalid or expired.");
  }
  const context = {
    userId: authorization.userId,
    workspaceId: authorization.workspaceId,
  } satisfies StoreContext;

  const token = await exchangeCode({
    platform: input.platform,
    code: input.code,
    codeVerifier: authorization.codeVerifier,
  });
  const expiresIn =
    typeof token.expires_in === "number" ? token.expires_in : undefined;
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : undefined;
  const scope = typeof token.scope === "string" ? token.scope : undefined;
  const platformAccountId =
    typeof token.user_id === "string"
      ? token.user_id
      : typeof token.refresh_token === "string"
        ? undefined
        : undefined;

  const credentialRef = await saveDatabaseOAuthTokenSecret({
    name: `open-growth/oauth-token/${authorization.userId}/${input.platform}`,
    description: `Open Growth OAuth token for ${input.platform}`,
    secret: JSON.stringify({
      platform: input.platform,
      platformAccountId,
      accessToken: token.access_token,
      refreshToken:
        typeof token.refresh_token === "string"
          ? token.refresh_token
          : undefined,
      tokenType:
        typeof token.token_type === "string" ? token.token_type : undefined,
      scope,
      expiresAt,
      raw: token,
    }),
  });

  if (!credentialRef) {
    throw new Error("Unable to store OAuth token secret.");
  }

  const account = await upsertPublishingIdentity(
    {
      platform: input.platform,
      credentialRef,
      displayName: `${input.platform} account`,
      platformAccountId,
      authMode: "oauth",
      useCases: provider.useCases,
      status: "active",
      expiresAt,
    },
    context,
  );

  return {
    account,
    redirectTo: authorization.redirectTo ?? "/connectors",
  };
}

export async function connectorOAuthFailureUrl(
  message: string,
  _platform?: GrowthPlatform,
) {
  const deploymentSettings = await getDeploymentSettings();
  const url = new URL("/connectors", deploymentSettings.publicBaseUrl);
  url.searchParams.set("connector_error", message);
  return url.toString();
}

export async function connectorOAuthSuccessUrl(input: {
  redirectTo?: string | null;
  platform: GrowthPlatform;
}) {
  const deploymentSettings = await getDeploymentSettings();
  const url = new URL(
    input.redirectTo || "/connectors",
    deploymentSettings.publicBaseUrl,
  );
  url.searchParams.set("connector_connected", input.platform);
  return url.toString();
}
