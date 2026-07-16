import { expect, test } from "playwright/test";

const appUrl = process.env.OPENINGFIT_E2E_URL;

test.skip(!appUrl, "Set OPENINGFIT_E2E_URL to a configured preview or production deployment.");

test("referral validation RPC is deployed", async ({ page }) => {
  const validationResponse = page.waitForResponse(
    (response) => response.url().includes("/rpc/validate_referral_code"),
    { timeout: 15_000 }
  );

  await page.goto(`${appUrl}/?ref=openingfit-deployment-smoke`, {
    waitUntil: "domcontentloaded",
  });

  const response = await validationResponse;
  expect(response.status()).toBe(200);
});
