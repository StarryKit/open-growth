import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepositoryClient } from "./repository-client";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ asset: null }),
    })),
  );
});

describe("RepositoryClient", () => {
  it("filters assets by search text, type, and tag OR selection", async () => {
    const user = userEvent.setup();
    render(
      <RepositoryClient
        activeProject={null}
        initialAssets={[
          {
            id: "asset-1",
            filename: "launch-brief.md",
            path: "content/launch-brief.md",
            kind: "text",
            type: "text",
            size: 100,
            updatedAt: "2026-05-17T00:00:00.000Z",
            preview: "Launch positioning",
            tags: ["launch"],
          },
          {
            id: "asset-2",
            filename: "logo.png",
            path: "content/logo.png",
            kind: "image",
            type: "image",
            size: 200,
            updatedAt: "2026-05-16T00:00:00.000Z",
            tags: ["brand"],
          },
        ]}
      />,
    );

    expect(screen.getAllByText("launch-brief.md").length).toBeGreaterThan(0);
    expect(screen.getAllByText("logo.png").length).toBeGreaterThan(0);

    await user.selectOptions(
      screen.getByLabelText("Filter asset type"),
      "text",
    );
    expect(screen.getAllByText("launch-brief.md").length).toBeGreaterThan(0);
    expect(screen.queryByText("logo.png")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter asset type"), "all");
    await user.click(screen.getByRole("button", { name: "brand" }));
    expect(screen.getAllByText("logo.png").length).toBeGreaterThan(0);
    expect(screen.queryByText("launch-brief.md")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "launch" }));
    expect(screen.getAllByText("logo.png").length).toBeGreaterThan(0);
    expect(screen.getAllByText("launch-brief.md").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /clear/i }));
    await user.type(screen.getByLabelText("Search assets"), "positioning");
    expect(screen.getAllByText("launch-brief.md").length).toBeGreaterThan(0);
    expect(screen.queryByText("logo.png")).not.toBeInTheDocument();
  });

  it("creates a text snippet from the Add content menu", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        asset: {
          id: "asset-text",
          filename: "Untitled snippet.md",
          path: "",
          kind: "text",
          type: "text",
          size: 0,
          updatedAt: "2026-05-19T00:00:00.000Z",
          title: "Untitled snippet",
          body: "",
          bodyPreview: "",
          tags: [],
          status: "ready",
        },
      }),
    }));
    vi.stubGlobal("fetch", fetch);

    const user = userEvent.setup();
    render(<RepositoryClient activeProject={null} initialAssets={[]} />);

    await user.click(screen.getByRole("button", { name: /add content/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /text snippet/i }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/content-assets/text-snippets",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText("Untitled snippet")).toBeInTheDocument();
  });
});
