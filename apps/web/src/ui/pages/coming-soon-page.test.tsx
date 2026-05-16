import { render, screen } from "@testing-library/react";
import { Send } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ComingSoonPage } from "./coming-soon-page";

describe("ComingSoonPage", () => {
  it("renders the provided title and description", () => {
    render(<ComingSoonPage icon={Send} title="Publish" />);

    expect(
      screen.getByRole("heading", { name: "Publish" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(
      screen.getByText(/reserved for the next open growth workflow/i),
    ).toBeInTheDocument();
  });
});
