import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPage } from "./dashboard-page";

describe("DashboardPage", () => {
  it("renders the product heading and stack labels", () => {
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: /open growth/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Fastify")).toBeInTheDocument();
    expect(screen.getByText("Vite")).toBeInTheDocument();
  });
});
