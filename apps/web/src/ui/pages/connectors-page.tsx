import type { ConnectorConnection, GrowthPlatform } from "@shared";
import { Link2, RefreshCw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { apiJson, formatDate } from "@/ui/lib/api";

export function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorConnection[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<GrowthPlatform>("x");
  const [credentialRef, setCredentialRef] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadConnectors = async () => {
    const data = await apiJson<{ connectors: ConnectorConnection[] }>(
      "/api/connectors",
    );
    setConnectors(data.connectors);
    setSelectedPlatform((current) => data.connectors[0]?.platform ?? current);
  };

  useEffect(() => {
    void loadConnectors();
  }, []);

  const connectPlatform = () => {
    startTransition(async () => {
      setMessage(null);
      await apiJson("/api/connectors/accounts", {
        method: "POST",
        body: JSON.stringify({
          platform: selectedPlatform,
          credentialRef,
          status: "active",
        }),
      });
      setCredentialRef("");
      await loadConnectors();
      setMessage("Connector account saved.");
    });
  };

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
              Connectors
            </p>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">
              Platform access, adapter limits, and credential references
            </h1>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900"
            onClick={() => void loadConnectors()}
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

        <div className="mt-8 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Link2 className="size-3.5" />
              Credential reference
            </div>
            <select
              className="mt-5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
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
            <input
              className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
              onChange={(event) => setCredentialRef(event.target.value)}
              placeholder="secret://provider/account"
              value={credentialRef}
            />
            <button
              className="mt-4 h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
              disabled={isPending || credentialRef.trim().length === 0}
              onClick={connectPlatform}
              type="button"
            >
              Save connection
            </button>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {connectors.map((connector) => (
              <article
                key={connector.platform}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                    {connector.displayName}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {connector.connectionStatus}
                  </span>
                </div>
                <dl className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <Row label="Data source" value={connector.dataSource} />
                  <Row label="Publish" value={connector.supportsPublish} />
                  <Row label="Tracking" value={connector.supportsEngagement} />
                  <Row label="Trends" value={connector.supportsTrends} />
                  <Row
                    label="Credential ref"
                    value={
                      connector.account?.hasCredentialRef
                        ? "Stored server-side"
                        : "Not connected"
                    }
                  />
                  <Row
                    label="Expires"
                    value={formatDate(connector.account?.expiresAt)}
                  />
                </dl>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  {connector.limitation}
                </p>
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
        {typeof value === "boolean" ? (value ? "Yes" : "No") : value}
      </dd>
    </div>
  );
}
