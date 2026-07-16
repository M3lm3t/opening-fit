import { expect, test } from "playwright/test";

const appUrl = process.env.OPENINGFIT_E2E_URL;
test.skip(!appUrl, "Set OPENINGFIT_E2E_URL to a configured preview or production deployment.");

function overlaps(first, second) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

for (const viewport of [
  { name: "desktop", width: 900, height: 535 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} verdict score row does not overlap`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const overlay = document.createElement("div");
      overlay.className = "analysisVerdictOverlay";
      overlay.innerHTML = `
        <section class="analysisVerdictModal">
          <div class="analysisVerdictScoreRow">
            <div class="analysisVerdictScoreLabel"><span>OpeningScore</span></div>
            <strong>63/100</strong>
            <em>Clear progress path: simplify, then strengthen.</em>
            <button class="analysisVerdictInfo" type="button"><span>i</span>Score details</button>
          </div>
        </section>`;
      document.body.appendChild(overlay);
    });

    const row = page.locator(".analysisVerdictScoreRow");
    await expect(row).toBeVisible();
    const boxes = await Promise.all([
      row.locator(".analysisVerdictScoreLabel").boundingBox(),
      row.locator(":scope > strong").boundingBox(),
      row.locator(":scope > em").boundingBox(),
      row.locator(".analysisVerdictInfo").boundingBox(),
    ]);

    for (const box of boxes) expect(box).not.toBeNull();
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        expect(overlaps(boxes[first], boxes[second])).toBe(false);
      }
    }
  });
}
