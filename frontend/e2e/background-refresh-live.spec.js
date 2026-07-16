import { expect, test } from "playwright/test";

const appUrl = process.env.OPENINGFIT_E2E_URL;
test.skip(!appUrl, "Set OPENINGFIT_E2E_URL to a configured preview or production deployment.");

test("a refresh keeps an existing report usable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("openingFit:lastAnalysis", JSON.stringify({
      username: "ExistingPlayer",
      platform: "chesscom",
      savedAt: new Date().toISOString(),
      analysis: { username: "ExistingPlayer", platform: "chesscom", gamesImported: 1, openings: [] },
    }));
    localStorage.setItem("openingFit:lastUsername", "ExistingPlayer");
    localStorage.setItem("openingFit:lastPlatform", "chesscom");
  });
  await page.route(/\/api\/analysis\/jobs(?:\/.*)?$/, async (route) => {
    const isStart = route.request().method() === "POST";
    await route.fulfill({
      status: isStart ? 202 : 200,
      contentType: "application/json",
      body: JSON.stringify(isStart
        ? { jobId: "00000000-0000-0000-0000-000000000001", status: "queued" }
        : { jobId: "00000000-0000-0000-0000-000000000001", status: "running" }),
    });
  });
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/report/);
  await page.getByText("Analyse", { exact: true }).first().click();
  await page.getByLabel(/Chess\.com username/i).fill("ExamplePlayer");
  await page.getByRole("button", { name: "Get my opening report" }).click();
  await expect(page.getByText("Refreshing your report in the background")).toBeVisible();
  await expect(page.getByText("You can keep browsing.")).toBeVisible();
  await expect(page.locator(".importLoadingOverlay")).toHaveCount(0);
});
