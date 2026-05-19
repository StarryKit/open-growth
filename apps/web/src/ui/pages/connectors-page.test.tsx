import { render, screen } from "@testing-library/react";
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
});
