import { expect, test } from "playwright/test";

const appUrl = process.env.OPENINGFIT_E2E_URL;
const authEnabled = process.env.OPENINGFIT_E2E_AUTH === "true";

test.skip(!appUrl || !authEnabled, "Set OPENINGFIT_E2E_URL and OPENINGFIT_E2E_AUTH=true for a Supabase-configured deployment.");

for (const viewport of [
  { name: "desktop", width: 1280, height: 720 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} login controls are clickable`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto(`${appUrl}/login`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Log in or create account", exact: true })).toHaveCount(1);
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(2);

    await page.getByLabel("Email").fill("auth-layout@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("not-a-real-password");
    const submit = page.locator('button[type="submit"]', { hasText: "Log in" });

    await expect(submit).toBeVisible();
    const submitBox = await submit.boundingBox();
    expect(submitBox).not.toBeNull();
    expect(submitBox.x).toBeGreaterThanOrEqual(0);
    expect(submitBox.x + submitBox.width).toBeLessThanOrEqual(viewport.width);
    await submit.click();
    await expect(submit).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator("body")).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}
