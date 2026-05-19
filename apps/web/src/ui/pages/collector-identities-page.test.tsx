import { render, screen } from "@testing-library/react";
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
                platform: "hacker-news",
                displayName: "Hacker News",
                status: "adapter-required",
                supportsPublish: false,
                supportsEngagement: true,
                supportsTrends: true,
                supportedAuthModes: ["public"],
                supportedUseCases: ["engagement", "trends", "read"],
                collectorModes: ["public"],
                dataSource: "Hacker News Firebase/API adapter",
                limitation: "Public data only.",
                connectionStatus: "public-available",
                publishingStatus: "unsupported",
                collectorStatus: "public-available",
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

      return {
        ok: true,
        json: async () => ({ ok: true }),
      };
    }),
  );
});

describe("CollectorIdentitiesPage", () => {
  it("renders admin collector configuration", async () => {
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
      await screen.findByRole("heading", { name: /collector identities/i }),
    ).toBeInTheDocument();
    expect(await screen.findAllByText("Hacker News")).not.toHaveLength(0);
    expect(await screen.findByText("public-available")).toBeInTheDocument();
  });
});
