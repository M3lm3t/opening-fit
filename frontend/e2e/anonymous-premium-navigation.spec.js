import { expect, test } from "playwright/test";

const appUrl = process.env.OPENINGFIT_E2E_URL;
test.skip(!appUrl, "Set OPENINGFIT_E2E_URL to a configured preview or production deployment.");

test("signed-out mobile visitors can see the app menu and find OpeningFit Plus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/\/api\/billing\/config$/, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      monthly: { available: true, amount: 4.99, currency: "GBP" },
      annual: { available: true, amount: 39.99, currency: "GBP" },
      foundingOffer: { enabled: false, firstYearAmount: null, renewsAtAmount: null },
      lifetimeMembersRetainAccess: true,
    }),
  }));
  await page.goto(`${appUrl}/login`, { waitUntil: "domcontentloaded" });

  const nav = page.getByRole("navigation", { name: "Mobile app navigation" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button")).toHaveCount(5);
  await nav.getByRole("button", { name: "Premium" }).click();

  await expect(page).toHaveURL(/\/premium/);
  await expect(page.getByRole("heading", { name: "Keep improving after the first report." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose annual billing/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Choose annual billing/ }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/Sign in or create account|Secure sign-in/i).first()).toBeVisible();
});
