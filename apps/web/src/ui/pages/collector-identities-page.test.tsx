import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/state/auth-context";
import { WorkspaceProvider } from "@/state/workspace-context";
import { CollectorIdentitiesPage } from "./collector-identities-page";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.endsWith("/api/projects")) {
        return {
          ok: true,
          json: async () => ({
            projects: [],
            activeProject: null,
          }),
        };
      }

      if (url.endsWith("/api/admin/status")) {
        return {
          ok: true,
          json: async () => ({ isAdmin: true }),
        };
      }

      if (url.endsWith("/api/connectors")) {
        return {
          ok: true,
          json: async () => ({
            connectors: [
              {
                platform: "x",
                displayName: "X",
                status: "oauth-required",
                supportsPublish: true,
                supportsEngagement: true,
                supportsTrends: true,
                supportedAuthModes: ["oauth", "api_key"],
                supportedUseCases: ["publish", "reply", "engagement", "trends"],
                collectorModes: ["api_key"],
                dataSource: "X API adapter",
                limitation: "Requires OAuth.",
                connectionStatus: "needs-auth",
                publishingStatus: "needs-auth",
                collectorStatus: "not-configured",
                publishingIdentities: [],
                enabledPublishingIdentities: [],
              },
            ],
          }),
        };
      }

      if (url.endsWith("/api/admin/collector-identities")) {
        return {
          ok: true,
          json: async () => ({
            collectorIdentities: [],
          }),
        };
      }

      if (url.endsWith("/api/admin/oauth-apps")) {
        return {
          ok: true,
          json: async () => ({
            oauthApps: [
              {
                platform: "x",
                clientId: "",
                hasClientSecret: false,
                redirectUri:
                  "http://localhost:3001/api/connectors/oauth/x/callback",
              },
              {
                platform: "reddit",
                clientId: "",
                hasClientSecret: false,
                redirectUri:
                  "http://localhost:3001/api/connectors/oauth/reddit/callback",
              },
            ],
          }),
        };
      }

      if (url.endsWith("/api/admin/deployment-settings")) {
        return {
          ok: true,
          json: async () => ({
            deploymentSettings: {
              publicBaseUrl: "http://localhost:5173",
              redirectBaseUrl: "http://localhost:3001",
            },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({ ok: true }),
      };
    }),
  );
});

describe("CollectorIdentitiesPage", () => {
  it("renders admin collector configuration", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <CollectorIdentitiesPage />
          </WorkspaceProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /^admin$/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Runtime URLs")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /oauth apps/i }));
    expect(await screen.findAllByText("X")).not.toHaveLength(0);
    expect(await screen.findByText("X OAuth")).toBeInTheDocument();
    expect(await screen.findAllByText("missing")).not.toHaveLength(0);

    await user.click(screen.getByRole("tab", { name: /collectors/i }));
    expect(await screen.findByText("Collector setup")).toBeInTheDocument();
  });

  it("shows load errors instead of denying admin access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();

        if (url.endsWith("/api/projects")) {
          return {
            ok: true,
            json: async () => ({
              projects: [],
              activeProject: null,
            }),
          };
        }

        if (url.endsWith("/api/admin/status")) {
          return {
            ok: true,
            json: async () => ({ isAdmin: true }),
          };
        }

        if (url.endsWith("/api/connectors")) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: "Unable to read connectors." }),
          };
        }

        if (url.endsWith("/api/admin/oauth-apps")) {
          return {
            ok: true,
            json: async () => ({ oauthApps: [] }),
          };
        }

        if (url.endsWith("/api/admin/deployment-settings")) {
          return {
            ok: true,
            json: async () => ({
              deploymentSettings: {
                publicBaseUrl: "http://localhost:5173",
                redirectBaseUrl: "http://localhost:3001",
              },
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <CollectorIdentitiesPage />
          </WorkspaceProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/unable to read connectors/i),
    ).toBeInTheDocument();
  });

  it("shows save errors instead of blanking the page", async () => {
    const user = userEvent.setup();
    let deploymentSettingsCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();

        if (url.endsWith("/api/projects")) {
          return {
            ok: true,
            json: async () => ({
              projects: [],
              activeProject: null,
            }),
          };
        }

        if (url.endsWith("/api/admin/status")) {
          return {
            ok: true,
            json: async () => ({ isAdmin: true }),
          };
        }

        if (url.endsWith("/api/connectors")) {
          return {
            ok: true,
            json: async () => ({
              connectors: [
                {
                  platform: "x",
                  displayName: "X",
                  status: "oauth-required",
                  supportsPublish: true,
                  supportsEngagement: true,
                  supportsTrends: true,
                  supportedAuthModes: ["oauth", "api_key"],
                  supportedUseCases: [
                    "publish",
                    "reply",
                    "engagement",
                    "trends",
                  ],
                  collectorModes: ["api_key"],
                  dataSource: "X API adapter",
                  limitation: "Requires OAuth.",
                  connectionStatus: "needs-auth",
                  publishingStatus: "needs-auth",
                  collectorStatus: "not-configured",
                  publishingIdentities: [],
                  enabledPublishingIdentities: [],
                },
              ],
            }),
          };
        }

        if (url.endsWith("/api/admin/collector-identities")) {
          return {
            ok: true,
            json: async () => ({
              collectorIdentities: [],
            }),
          };
        }

        if (url.endsWith("/api/admin/oauth-apps")) {
          return {
            ok: true,
            json: async () => ({
              oauthApps: [],
            }),
          };
        }

        if (url.endsWith("/api/admin/deployment-settings")) {
          deploymentSettingsCalls += 1;
          if (deploymentSettingsCalls === 2) {
            return {
              ok: false,
              status: 500,
              json: async () => ({
                error: "Unable to save deployment settings.",
              }),
            };
          }

          return {
            ok: true,
            json: async () => ({
              deploymentSettings: {
                publicBaseUrl: "http://localhost:5173",
                redirectBaseUrl: "http://localhost:3001",
              },
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <CollectorIdentitiesPage />
          </WorkspaceProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    await screen.findByText("Runtime URLs");
    await user.click(screen.getByRole("button", { name: /save deployment/i }));

    expect(
      await screen.findByText(/unable to save deployment settings/i),
    ).toBeInTheDocument();
  });
});
