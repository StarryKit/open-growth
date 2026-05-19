import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/state/auth-context";
import { WorkspaceProvider } from "@/state/workspace-context";
import { ConnectorsPage } from "./connectors-page";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.endsWith("/api/projects")) {
        return {
          ok: true,
          json: async () => ({
            projects: [
              {
                id: "project-1",
                name: "Launch Lab",
                rootDir: "/tmp/launch-lab",
                createdAt: new Date().toISOString(),
              },
            ],
            activeProject: {
              id: "project-1",
              name: "Launch Lab",
              rootDir: "/tmp/launch-lab",
              createdAt: new Date().toISOString(),
            },
          }),
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
                limitation: "Requires user OAuth credentials.",
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

      return {
        ok: true,
        json: async () => ({ ok: true }),
      };
    }),
  );
});

describe("ConnectorsPage", () => {
  it("renders connector capability and status information", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <ConnectorsPage />
          </WorkspaceProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /publishing access/i,
      }),
    ).toBeInTheDocument();
    expect(await screen.findAllByText("X")).not.toHaveLength(0);
    expect(await screen.findAllByText("needs-auth")).not.toHaveLength(0);
    expect(
      await screen.findByText(/no user publishing identity connected/i),
    ).toBeInTheDocument();
  });

  it("starts publishing OAuth when connecting an identity", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.endsWith("/api/connectors/publishing-identities/start")) {
        return {
          ok: true,
          json: async () => ({
            authorizationUrl: "https://platform.example/oauth",
          }),
        } as Response;
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
                limitation: "Requires user OAuth credentials.",
                connectionStatus: "needs-auth",
                publishingStatus: "needs-auth",
                collectorStatus: "not-configured",
                publishingIdentities: [],
                enabledPublishingIdentities: [],
              },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response;
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <ConnectorsPage navigate={navigate} />
          </WorkspaceProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /connect publishing identity/i,
      }),
    );

    expect(navigate).toHaveBeenCalledWith("https://platform.example/oauth");
  });
});
