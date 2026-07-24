import { expect, test } from "playwright/test";

const appUrl = process.env.OPENINGFIT_E2E_URL;
test.skip(!appUrl, "Set OPENINGFIT_E2E_URL to a configured preview or production deployment.");

test("burger menu uses solid, readable surfaces in dark and light mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("openingFit:theme", "dark"));
  await page.goto(`${appUrl}/login`, { waitUntil: "domcontentloaded" });

  const menuTrigger = page.getByRole("button", { name: "Open OpeningFit menu" });
  await menuTrigger.click();
  const panel = page.locator(".appPrimaryMobilePanel");
  const backdrop = page.locator(".appPrimaryMobileBackdrop");
  await expect(panel).toBeVisible();
  await expect(backdrop).toBeVisible();

  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(11, 18, 32)");
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).color))
    .toBe("rgb(248, 250, 252)");

  await panel.getByRole("button", { name: /Dark mode Switch to light/i }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(255, 255, 255)");
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).color))
    .toBe("rgb(15, 23, 42)");

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(menuTrigger).toBeFocused();
});
