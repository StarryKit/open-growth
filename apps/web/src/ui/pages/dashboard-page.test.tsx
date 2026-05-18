import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/state/auth-context";
import { WorkspaceProvider } from "@/state/workspace-context";
import { DashboardPage } from "./dashboard-page";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.endsWith("/api/connectors")) {
        return {
          ok: true,
          json: async () => ({ connectors: [] }),
        };
      }

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
    }),
  );
});

describe("DashboardPage", () => {
  it("renders the workspace workflow entry points", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <DashboardPage />
          </WorkspaceProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /manage content/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Repository")).toBeInTheDocument();
    expect(screen.getByText("Publish")).toBeInTheDocument();
    expect(screen.getByText("Tracking")).toBeInTheDocument();
    expect(screen.getByText("Trends")).toBeInTheDocument();
    expect(await screen.findByText("Launch Lab")).toBeInTheDocument();
  });
});
