import type {
  ConnectorAccount,
  ConnectorAuthMode,
  ConnectorConnection,
  ConnectorUseCase,
  GrowthPlatform,
} from "@shared";
import { Globe2, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { apiJson, formatDate } from "@/ui/lib/api";

type OAuthAppConfig = {
  platform: GrowthPlatform;
  clientId: string;
  hasClientSecret: boolean;
  publicBaseUrl?: string;
  redirectBaseUrl?: string;
  redirectUri: string;
  updatedAt?: string;
};

type DeploymentSettings = {
  publicBaseUrl: string;
  redirectBaseUrl: string;
  updatedAt?: string;
};

const collectorModes: ConnectorAuthMode[] = [
  "public",
  "api_key",
  "vendor",
  "browser_profile",
];

const collectorUseCases: ConnectorUseCase[] = ["trends", "read", "engagement"];
const supportedPlatforms = new Set<GrowthPlatform>(["x", "reddit"]);
const oauthAppPlatforms = ["x", "reddit"] as GrowthPlatform[];
type AdminPanelTab = "deployment" | "oauth" | "collectors";

export function CollectorIdentitiesPage() {
  const [connectors, setConnectors] = useState<ConnectorConnection[]>([]);
  const [collectorIdentities, setCollectorIdentities] = useState<
    ConnectorAccount[]
  >([]);
  const [oauthApps, setOauthApps] = useState<OAuthAppConfig[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<GrowthPlatform>("x");
  const [authMode, setAuthMode] = useState<ConnectorAuthMode>("api_key");
  const [credentialRef, setCredentialRef] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [oauthPlatform, setOauthPlatform] = useState<GrowthPlatform>("x");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("http://localhost:5173");
  const [redirectBaseUrl, setRedirectBaseUrl] = useState(
    "http://localhost:3001",
  );
  const [deploymentUpdatedAt, setDeploymentUpdatedAt] = useState<
    string | undefined
  >();
  const [activeTab, setActiveTab] = useState<AdminPanelTab>("deployment");
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<
    "loading" | "allowed" | "denied"
  >("loading");
  const [isPending, startTransition] = useTransition();

  const selectedConnector = useMemo(
    () =>
      connectors.find((connector) => connector.platform === selectedPlatform) ??
      connectors[0],
    [connectors, selectedPlatform],
  );

  const selectedOauthApp = useMemo(
    () => oauthApps.find((app) => app.platform === oauthPlatform),
    [oauthApps, oauthPlatform],
  );

  const loadData = async () => {
    setLoadError(null);
    const [connectorData, collectorData, oauthData, deploymentData] =
      await Promise.all([
        apiJson<{ connectors: ConnectorConnection[] }>("/api/connectors"),
        apiJson<{ collectorIdentities: ConnectorAccount[] }>(
          "/api/admin/collector-identities",
        ),
        apiJson<{ oauthApps: OAuthAppConfig[] }>("/api/admin/oauth-apps"),
        apiJson<{ deploymentSettings: DeploymentSettings }>(
          "/api/admin/deployment-settings",
        ),
      ]);
    const visibleConnectors = connectorData.connectors.filter((connector) =>
      supportedPlatforms.has(connector.platform),
    );
    setConnectors(visibleConnectors);
    setCollectorIdentities(collectorData.collectorIdentities);
    setOauthApps(oauthData.oauthApps);
    setPublicBaseUrl(deploymentData.deploymentSettings.publicBaseUrl);
    setRedirectBaseUrl(deploymentData.deploymentSettings.redirectBaseUrl);
    setDeploymentUpdatedAt(deploymentData.deploymentSettings.updatedAt);
    setSelectedPlatform((current) => visibleConnectors[0]?.platform ?? current);
    const firstOauthApp = oauthData.oauthApps[0];
    if (firstOauthApp) {
      setOauthPlatform(firstOauthApp.platform);
      setClientId(firstOauthApp.clientId);
    }
  };

  useEffect(() => {
    let mounted = true;

    void apiJson<{ isAdmin: boolean }>("/api/admin/status")
      .then(async (data) => {
        if (!mounted) return;

        if (!data.isAdmin) {
          setAdminStatus("denied");
          return;
        }

        setAdminStatus("allowed");
        try {
          await loadData();
        } catch (loadError) {
          if (mounted) {
            setLoadError(
              loadError instanceof Error
                ? loadError.message
                : "Unable to load collector identities.",
            );
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setAdminStatus("denied");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const saveCollector = (endpoint: "save" | "test") => {
    startTransition(async () => {
      setMessage(null);
      const path =
        endpoint === "test"
          ? "/api/admin/collector-identities/test"
          : "/api/admin/collector-identities";
      await apiJson(path, {
        method: "POST",
        body: JSON.stringify({
          platform: selectedPlatform,
          authMode,
          credentialRef: credentialRef.trim() || undefined,
          displayName: displayName.trim() || undefined,
          ownerScope: "workspace",
          adapterBackend:
            authMode === "public"
              ? "public_api"
              : authMode === "browser_profile"
                ? "opencli"
                : authMode === "vendor"
                  ? "vendor"
                  : "official_api",
          useCases: collectorUseCases.filter((useCase) =>
            selectedConnector?.supportedUseCases.includes(useCase),
          ),
        }),
      });
      await loadData();
      setMessage(
        endpoint === "test"
          ? "Collector identity tested."
          : "Collector identity saved.",
      );
    });
  };

  const saveOAuthApp = () => {
    startTransition(async () => {
      setMessage(null);
      await apiJson("/api/admin/oauth-apps", {
        method: "POST",
        body: JSON.stringify({
          platform: oauthPlatform,
          clientId,
          clientSecret: clientSecret.trim() || undefined,
        }),
      });
      setClientSecret("");
      await loadData();
      setMessage("OAuth app saved.");
    });
  };

  const saveDeployment = () => {
    startTransition(async () => {
      setMessage(null);
      await apiJson("/api/admin/deployment-settings", {
        method: "POST",
        body: JSON.stringify({
          publicBaseUrl,
          redirectBaseUrl,
        }),
      });
      await loadData();
      setMessage("Deployment settings saved.");
    });
  };

  if (adminStatus === "loading") {
    return (
      <div className="grid min-h-screen place-items-center px-8 py-8 text-sm text-slate-500">
        Checking admin access
      </div>
    );
  }

  if (adminStatus === "denied") {
    return (
      <div className="grid min-h-screen place-items-center px-8 py-8">
        <div className="max-w-md text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
            Admin
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
            Admin access is required
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Admin settings are managed only by users listed in the server-side
            admin allowlist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
              Admin
            </p>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">
              Admin
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Configure publishing OAuth apps and collector identities for the
              supported platforms. Secrets are stored server-side and never
              returned to the browser.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900"
            onClick={() => void loadData()}
            type="button"
          >
            <RefreshCw className="size-4" />
            Refresh
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/50 dark:text-cyan-100">
            {message}
          </p>
        ) : null}
        {loadError ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-100">
            {loadError}
          </p>
        ) : null}

        <div
          aria-label="Admin sections"
          className="mt-8 grid gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:inline-grid sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900"
          role="tablist"
        >
          <TabButton
            active={activeTab === "deployment"}
            icon={<Globe2 className="size-4" />}
            label="Deployment"
            onClick={() => setActiveTab("deployment")}
          />
          <TabButton
            active={activeTab === "oauth"}
            icon={<KeyRound className="size-4" />}
            label="OAuth Apps"
            onClick={() => setActiveTab("oauth")}
          />
          <TabButton
            active={activeTab === "collectors"}
            icon={<ShieldCheck className="size-4" />}
            label="Collectors"
            onClick={() => setActiveTab("collectors")}
          />
        </div>

        {activeTab === "deployment" ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Globe2 className="size-3.5" />
                Deployment
              </div>

              <label
                className="mt-5 block text-sm font-semibold"
                htmlFor="deployment-public-url"
              >
                App URL
              </label>
              <input
                id="deployment-public-url"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                onChange={(event) => setPublicBaseUrl(event.target.value)}
                value={publicBaseUrl}
              />

              <label
                className="mt-4 block text-sm font-semibold"
                htmlFor="deployment-redirect-base"
              >
                OAuth callback base URL
              </label>
              <input
                id="deployment-redirect-base"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                onChange={(event) => setRedirectBaseUrl(event.target.value)}
                value={redirectBaseUrl}
              />

              <button
                className="mt-5 h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
                disabled={
                  isPending || !publicBaseUrl.trim() || !redirectBaseUrl.trim()
                }
                onClick={saveDeployment}
                type="button"
              >
                Save deployment
              </button>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                  Runtime URLs
                </h2>
                <dl className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <Row label="App URL" value={publicBaseUrl} />
                  <Row label="Callback base" value={redirectBaseUrl} />
                  <Row
                    label="Updated"
                    value={formatDate(deploymentUpdatedAt)}
                  />
                </dl>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                  OAuth callbacks
                </h2>
                <div className="mt-4 space-y-3">
                  {oauthAppPlatforms.map((platform) => (
                    <p
                      className="break-all rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      key={`deployment-callback-${platform}`}
                    >
                      {`${redirectBaseUrl.replace(/\/$/, "")}/api/connectors/oauth/${platform}/callback`}
                    </p>
                  ))}
                </div>
              </article>
            </section>
          </div>
        ) : activeTab === "oauth" ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <KeyRound className="size-3.5" />
                Publishing OAuth app
              </div>

              <label
                className="mt-5 block text-sm font-semibold"
                htmlFor="oauth-platform"
              >
                Platform
              </label>
              <select
                id="oauth-platform"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                onChange={(event) => {
                  const platform = event.target.value as GrowthPlatform;
                  const existing = oauthApps.find(
                    (app) => app.platform === platform,
                  );
                  setOauthPlatform(platform);
                  setClientId(existing?.clientId ?? "");
                  setClientSecret("");
                }}
                value={oauthPlatform}
              >
                {oauthAppPlatforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform === "x" ? "X" : "Reddit"}
                  </option>
                ))}
              </select>

              <label
                className="mt-4 block text-sm font-semibold"
                htmlFor="oauth-client-id"
              >
                Client ID
              </label>
              <input
                id="oauth-client-id"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                onChange={(event) => setClientId(event.target.value)}
                placeholder="OAuth client id"
                value={clientId}
              />

              <label
                className="mt-4 block text-sm font-semibold"
                htmlFor="oauth-client-secret"
              >
                Client secret
              </label>
              <input
                id="oauth-client-secret"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                onChange={(event) => setClientSecret(event.target.value)}
                placeholder={
                  selectedOauthApp?.hasClientSecret
                    ? "Stored; enter a new secret to replace"
                    : "OAuth client secret"
                }
                type="password"
                value={clientSecret}
              />

              <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {selectedOauthApp?.redirectUri ??
                  `${redirectBaseUrl.replace(/\/$/, "")}/api/connectors/oauth/${oauthPlatform}/callback`}
              </p>

              <button
                className="mt-5 h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
                disabled={
                  isPending ||
                  !clientId.trim() ||
                  (!selectedOauthApp?.hasClientSecret && !clientSecret.trim())
                }
                onClick={saveOAuthApp}
                type="button"
              >
                Save OAuth app
              </button>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              {oauthApps.map((app) => (
                <article
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  key={`oauth-${app.platform}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                      {app.platform === "x" ? "X OAuth" : "Reddit OAuth"}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {app.clientId && app.hasClientSecret
                        ? "configured"
                        : "missing"}
                    </span>
                  </div>
                  <dl className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <Row
                      label="Client ID"
                      value={app.clientId ? "Stored" : "Missing"}
                    />
                    <Row
                      label="Client secret"
                      value={
                        app.hasClientSecret ? "Stored server-side" : "Missing"
                      }
                    />
                    <Row label="Updated" value={formatDate(app.updatedAt)} />
                  </dl>
                  <p className="mt-4 break-all rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {app.redirectUri}
                  </p>
                </article>
              ))}
            </section>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <ShieldCheck className="size-3.5" />
                Collector setup
              </div>

              <label
                className="mt-5 block text-sm font-semibold"
                htmlFor="collector-platform"
              >
                Platform
              </label>
              <select
                id="collector-platform"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                onChange={(event) =>
                  setSelectedPlatform(event.target.value as GrowthPlatform)
                }
                value={selectedPlatform}
              >
                {connectors.map((connector) => (
                  <option key={connector.platform} value={connector.platform}>
                    {connector.displayName}
                  </option>
                ))}
              </select>

              <label
                className="mt-4 block text-sm font-semibold"
                htmlFor="collector-auth-mode"
              >
                Mode
              </label>
              <select
                id="collector-auth-mode"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                onChange={(event) =>
                  setAuthMode(event.target.value as ConnectorAuthMode)
                }
                value={authMode}
              >
                {collectorModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>

              <label
                className="mt-4 block text-sm font-semibold"
                htmlFor="collector-label"
              >
                Label
              </label>
              <input
                id="collector-label"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="X collector"
                value={displayName}
              />

              <label
                className="mt-4 block text-sm font-semibold"
                htmlFor="collector-secret-ref"
              >
                Secret reference
              </label>
              <input
                id="collector-secret-ref"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950"
                disabled={authMode === "public"}
                onChange={(event) => setCredentialRef(event.target.value)}
                placeholder="secret://platform/x-collector-prod"
                value={credentialRef}
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold disabled:opacity-60 dark:border-slate-800"
                  disabled={isPending}
                  onClick={() => saveCollector("test")}
                  type="button"
                >
                  Test collector
                </button>
                <button
                  className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
                  disabled={
                    isPending ||
                    (authMode !== "public" && !credentialRef.trim())
                  }
                  onClick={() => saveCollector("save")}
                  type="button"
                >
                  Save
                </button>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              {connectors.map((connector) => {
                const identity =
                  collectorIdentities.find(
                    (candidate) => candidate.platform === connector.platform,
                  ) ?? connector.collectorIdentity;

                return (
                  <article
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    key={connector.platform}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                        {connector.displayName}
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {identity?.status ?? connector.collectorStatus}
                      </span>
                    </div>
                    <dl className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                      <Row
                        label="Mode"
                        value={identity?.authMode ?? "Not set"}
                      />
                      <Row
                        label="Adapter"
                        value={identity?.adapterBackend ?? "Not set"}
                      />
                      <Row
                        label="Credential"
                        value={
                          identity?.hasCredentialRef
                            ? "Stored server-side"
                            : "Not required"
                        }
                      />
                      <Row
                        label="Last checked"
                        value={formatDate(identity?.lastVerifiedAt)}
                      />
                    </dl>
                    {identity?.lastError ? (
                      <p className="mt-4 text-sm text-rose-600">
                        {identity.lastError}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={[
        "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition",
        active
          ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
      ].join(" ")}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}
