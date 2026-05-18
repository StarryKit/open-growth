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
  it("filters assets by search text, type, and tag", async () => {
    const user = userEvent.setup();
    render(
      <RepositoryClient
        activeProject={null}
        initialAssets={[
          {
            id: "asset-1",
            filename: "launch-brief.md",
            path: "content/launch-brief.md",
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
    await user.selectOptions(
      screen.getByLabelText("Filter asset tag"),
      "brand",
    );
    expect(screen.getAllByText("logo.png").length).toBeGreaterThan(0);
    expect(screen.queryByText("launch-brief.md")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter asset tag"), "all");
    await user.type(screen.getByLabelText("Search assets"), "positioning");
    expect(screen.getAllByText("launch-brief.md").length).toBeGreaterThan(0);
    expect(screen.queryByText("logo.png")).not.toBeInTheDocument();
  });
});
