import type { ConnectorConnection, GrowthPlatform } from "@shared";
import { Check, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { apiJson, formatDate } from "@/ui/lib/api";

const platformLogo: Record<GrowthPlatform, string> = {
  x: "X",
  reddit: "R",
  "hacker-news": "HN",
  xiaohongshu: "RED",
  wechat: "WX",
};

export function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorConnection[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<GrowthPlatform>("x");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedConnector = useMemo(
    () =>
      connectors.find((connector) => connector.platform === selectedPlatform) ??
      connectors[0],
    [connectors, selectedPlatform],
  );

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

  const connectPublishingIdentity = () => {
    if (!selectedConnector?.supportsPublish) return;

    startTransition(async () => {
      setMessage(null);
      const data = await apiJson<{ account: { id: string } }>(
        "/api/connectors/publishing-identities",
        {
          method: "POST",
          body: JSON.stringify({
            platform: selectedPlatform,
            displayName:
              displayName.trim() || `${selectedConnector.displayName} account`,
          }),
        },
      );
      await apiJson("/api/connectors/workspace-publishing-identities", {
        method: "POST",
        body: JSON.stringify({
          connectorAccountId: data.account.id,
          enabled: true,
        }),
      });
      setDisplayName("");
      await loadConnectors();
      setMessage("Publishing identity connected and enabled.");
    });
  };

  const setEnabled = (connectorAccountId: string, enabled: boolean) => {
    startTransition(async () => {
      setMessage(null);
      await apiJson("/api/connectors/workspace-publishing-identities", {
        method: "POST",
        body: JSON.stringify({ connectorAccountId, enabled }),
      });
      await loadConnectors();
      setMessage(
        enabled
          ? "Publishing identity enabled."
          : "Publishing identity disabled.",
      );
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
              Publishing access
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Connect platform accounts to your user identity, then enable the
              identities this Workspace can use for publishing and replies.
            </p>
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

        <section className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {connectors.map((connector) => {
            const isSelected = connector.platform === selectedPlatform;
            return (
              <button
                className={[
                  "min-h-36 rounded-xl border bg-white p-4 text-left shadow-sm transition dark:bg-slate-900",
                  isSelected
                    ? "border-cyan-400 ring-2 ring-cyan-200 dark:ring-cyan-900"
                    : "border-slate-200 hover:border-cyan-300 dark:border-slate-800",
                ].join(" ")}
                key={connector.platform}
                onClick={() => setSelectedPlatform(connector.platform)}
                type="button"
              >
                <span className="grid size-12 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white dark:bg-white dark:text-slate-950">
                  {platformLogo[connector.platform]}
                </span>
                <span className="mt-4 block text-lg font-bold text-slate-950 dark:text-white">
                  {connector.displayName}
                </span>
                <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {connector.publishingStatus}
                </span>
              </button>
            );
          })}
        </section>

        {selectedConnector ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Link2 className="size-3.5" />
                Connect identity
              </div>
              <h2 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">
                {selectedConnector.displayName}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {selectedConnector.supportsPublish
                  ? "Authorize a platform account for publishing and replies. This creates a user-owned identity."
                  : "Publishing is not available for this platform."}
              </p>
              <input
                className="mt-5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                disabled={!selectedConnector.supportsPublish}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={`${selectedConnector.displayName} account label`}
                value={displayName}
              />
              <button
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
                disabled={
                  isPending ||
                  !selectedConnector.supportsPublish ||
                  selectedConnector.status !== "oauth-required"
                }
                onClick={connectPublishingIdentity}
                type="button"
              >
                <ShieldCheck className="size-4" />
                Connect publishing identity
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
                      {connector.publishingStatus}
                    </span>
                  </div>
                  <dl className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <Row label="Publish" value={connector.supportsPublish} />
                    <Row
                      label="Reply"
                      value={connector.supportedUseCases.includes("reply")}
                    />
                    <Row
                      label="Tracking"
                      value={connector.supportsEngagement}
                    />
                    <Row
                      label="Enabled identities"
                      value={connector.enabledPublishingIdentities.length}
                    />
                  </dl>

                  <div className="mt-4 space-y-2">
                    {connector.publishingIdentities.map((identity) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                        key={identity.id}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950 dark:text-white">
                            {identity.displayName ?? connector.displayName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {identity.status} · expires{" "}
                            {formatDate(identity.expiresAt)}
                          </p>
                        </div>
                        <button
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold disabled:opacity-60 dark:border-slate-800"
                          disabled={isPending}
                          onClick={() =>
                            setEnabled(
                              identity.id,
                              !identity.enabledForWorkspace,
                            )
                          }
                          type="button"
                        >
                          {identity.enabledForWorkspace ? (
                            <>
                              <Check className="size-3.5" />
                              Enabled
                            </>
                          ) : (
                            "Enable"
                          )}
                        </button>
                      </div>
                    ))}
                    {connector.publishingIdentities.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No user publishing identity connected.
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | boolean | number;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
        {typeof value === "boolean" ? (value ? "Yes" : "No") : value}
      </dd>
    </div>
  );
}
