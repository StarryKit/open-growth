import { expect, test } from "@playwright/test";

test("runs the core open growth workflow", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /manage content/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /workspace/i }).click();
  await page.getByRole("button", { name: /new project/i }).click();
  await page.getByLabel(/project name/i).fill("E2E Launch");
  await page.getByRole("button", { name: /^create$/i }).click();
  await expect(
    page.getByRole("heading", { name: /E2E Launch/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: /new draft/i }).click();
  await expect(page.getByText("Draft created.")).toBeVisible();
  await page.getByLabel("Draft title").fill("Edited launch draft");
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText("Draft updated.")).toBeVisible();
  await page.getByRole("button", { name: /duplicate/i }).click();
  await expect(page.getByText("Draft duplicated.")).toBeVisible();
  const publishResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/published-content/") &&
      response.url().endsWith("/publish"),
  );
  await page.getByRole("button", { name: /publish now/i }).click();
  const publishResult = await publishResponse;
  expect(publishResult.ok(), await publishResult.text()).toBe(true);
  await expect(page.getByText("published").first()).toBeVisible();

  await page.getByRole("link", { name: "Tracking", exact: true }).click();
  await expect(page.getByText(/engagement tracking/i)).toBeVisible();
  await expect(
    page.getByText("Published targets", { exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Trends", exact: true }).click();
  await page.getByRole("button", { name: /save query/i }).click();
  await expect(page.getByText("Trend query created.")).toBeVisible();
  await page.getByRole("button", { name: /run selected query/i }).click();
  await expect(page.getByText(/posts found/i)).toBeVisible();
  await page
    .getByRole("button", { name: /response draft/i })
    .first()
    .click();
  await expect(
    page.getByText("Response draft created in Publish."),
  ).toBeVisible();
});
