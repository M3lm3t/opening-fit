import { expect, test } from "playwright/test";

const appUrl = process.env.OPENINGFIT_E2E_URL;

test.skip(!appUrl, "Set OPENINGFIT_E2E_URL to a configured preview or production deployment.");

for (const viewport of [
  { name: "desktop", width: 1280, height: 720 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} login controls are clickable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${appUrl}/login`, { waitUntil: "domcontentloaded" });

    await page.getByLabel("Email").fill("auth-layout@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("not-a-real-password");
    const submit = page.locator('button[type="submit"]', { hasText: "Log in" });

    await expect(submit).toBeVisible();
    await submit.click();
    await expect(page.locator("body")).toBeVisible();
  });
}
