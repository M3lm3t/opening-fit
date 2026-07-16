import { expect, test } from "playwright/test";

const appUrl = process.env.OPENINGFIT_E2E_URL;
test.skip(!appUrl, "Set OPENINGFIT_E2E_URL to a configured preview or production deployment.");

for (const viewport of [
  { name: "compact", width: 360, height: 800 },
  { name: "standard", width: 390, height: 844 },
]) {
  test(`${viewport.name} mobile bottom menu is centred`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const nav = document.createElement("nav");
      nav.className = "mobileBottomNav of-mobile-bottom-nav";
      nav.setAttribute("aria-label", "Mobile app navigation test");
      ["Report", "Repertoire", "Train", "Progress"].forEach((label) => {
        const button = document.createElement("button");
        button.textContent = label;
        nav.appendChild(button);
      });
      document.body.appendChild(nav);
    });

    const nav = page.getByRole("navigation", { name: "Mobile app navigation test" });
    await expect(nav).toBeVisible();
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box.x + box.width / 2) - viewport.width / 2)).toBeLessThanOrEqual(1);
    await expect(nav.locator("button")).toHaveCount(4);
  });
}
