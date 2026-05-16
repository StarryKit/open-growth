import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /open growth/i }),
  ).toBeVisible();
  await expect(page.getByText("React")).toBeVisible();
});
