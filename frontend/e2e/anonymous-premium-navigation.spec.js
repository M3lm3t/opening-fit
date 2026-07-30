import { expect, test } from "playwright/test";

const appUrl = process.env.OPENINGFIT_E2E_URL;
test.skip(!appUrl, "Set OPENINGFIT_E2E_URL to a configured preview or production deployment.");
test.use({ serviceWorkers: "block" });

test("a signed-out visitor deliberately choosing OpeningFit Plus reaches login", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/*", (route) => {
    if (!new URL(route.request().url()).pathname.includes("/api/billing/config")) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        monthly: { available: true, configured: true, amount: 4.99, currency: "GBP" },
        annual: { available: true, configured: true, amount: 39.99, currency: "GBP" },
        foundingOffer: { enabled: false, firstYearAmount: null, renewsAtAmount: null },
        subscriptionsEnabled: true,
        checkoutReady: true,
        checkoutStatus: "available",
        unavailableReasons: [],
        lifetimeMembersRetainAccess: true,
      }),
    });
  });
  await page.goto(`${appUrl}/premium`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Turn each report into useful weekly training." })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Monthly.*£4\.99/ })).toBeChecked();
  await expect(page.getByRole("heading", { name: "£4.99 per month" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to subscribe" })).toBeVisible();
  await page.getByRole("radio", { name: /Annual.*£39\.99/ }).check();
  await expect(page.getByRole("heading", { name: "£39.99 per year" })).toBeVisible();
  await expect(page.getByText("£39.99 billed annually · equivalent to £3.33/month.")).toBeVisible();
  await expect(page.getByText("Save £19.89", { exact: true })).toBeVisible();
  await expect(page.getByText(/Recurring billing\. Cancel through account settings\./)).toBeVisible();
  await page.getByRole("button", { name: "Sign in to subscribe" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Log in or create account" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("openingFit:selectedBillingInterval"))).toBe("annual");
});
