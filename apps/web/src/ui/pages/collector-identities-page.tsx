import type {
  ConnectorAccount,
  ConnectorAuthMode,
  ConnectorConnection,
  ConnectorUseCase,
  GrowthPlatform,
} from "@shared";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { apiJson, formatDate } from "@/ui/lib/api";

const collectorModes: ConnectorAuthMode[] = [
  "public",
  "api_key",
  "vendor",
  "browser_profile",
];

const collectorUseCases: ConnectorUseCase[] = ["trends", "read", "engagement"];

export function CollectorIdentitiesPage() {
  const [connectors, setConnectors] = useState<ConnectorConnection[]>([]);
  const [collectorIdentities, setCollectorIdentities] = useState<
    ConnectorAccount[]
  >([]);
  const [selectedPlatform, setSelectedPlatform] = useState<GrowthPlatform>("x");
  const [authMode, setAuthMode] = useState<ConnectorAuthMode>("api_key");
  const [credentialRef, setCredentialRef] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
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

  const loadData = async () => {
    const [connectorData, collectorData] = await Promise.all([
      apiJson<{ connectors: ConnectorConnection[] }>("/api/connectors"),
      apiJson<{ collectorIdentities: ConnectorAccount[] }>(
        "/api/admin/collector-identities",
      ),
    ]);
    setConnectors(connectorData.connectors);
    setCollectorIdentities(collectorData.collectorIdentities);
    setSelectedPlatform(
      (current) => connectorData.connectors[0]?.platform ?? current,
    );
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
        await loadData();
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
            Collector identities are managed only by users listed in the
            server-side admin allowlist.
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
              Collector identities
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Configure official, public, vendor, or controlled OpenCLI access
              for Trends collection. These identities are never used for user
              publishing.
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

        <div className="mt-8 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
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
                  isPending || (authMode !== "public" && !credentialRef.trim())
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
                    <Row label="Mode" value={identity?.authMode ?? "Not set"} />
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
      </div>
    </div>
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
