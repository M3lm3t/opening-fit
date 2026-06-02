const { chromium } = require("playwright");

const widths = [320, 360, 390, 430, 768, 1280];
const height = 900;
const baseUrl = "http://127.0.0.1:5173/";

async function auditPage(page, label) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);

  return await page.evaluate((label) => {
    const vw = document.documentElement.clientWidth;
    const docScroll = Math.max(
      document.documentElement.scrollWidth,
      document.body ? document.body.scrollWidth : 0
    );
    const overflows = [];
    const smallTapTargets = [];
    const clippedText = [];
    const fixedElements = [];

    const isVisible = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
    };

    document.querySelectorAll("body *").forEach((el) => {
      if (!isVisible(el)) return;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const name =
        el.id ||
        el.getAttribute("aria-label") ||
        el.className?.toString()?.split(/\s+/).slice(0, 3).join(".") ||
        el.tagName.toLowerCase();

      if (r.right > vw + 1 || r.left < -1) {
        overflows.push({ name, tag: el.tagName.toLowerCase(), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) });
      }

      if (["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) || el.getAttribute("role") === "button") {
        if (r.width < 40 || r.height < 40) {
          smallTapTargets.push({ name, tag: el.tagName.toLowerCase(), width: Math.round(r.width), height: Math.round(r.height), text: (el.innerText || el.value || "").slice(0, 60) });
        }
      }

      if (el.scrollWidth > el.clientWidth + 1 && !["BODY", "HTML"].includes(el.tagName)) {
        const text = (el.innerText || "").trim();
        if (text && cs.overflowX !== "auto" && cs.overflowX !== "scroll") {
          clippedText.push({ name, tag: el.tagName.toLowerCase(), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, text: text.slice(0, 80) });
        }
      }

      if (cs.position === "fixed" || cs.position === "sticky") {
        fixedElements.push({ name, tag: el.tagName.toLowerCase(), pos: cs.position, top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) });
      }
    });

    return {
      label,
      viewport: vw,
      scrollWidth: docScroll,
      hasHorizontalScroll: docScroll > vw + 1,
      overflows: overflows.slice(0, 20),
      smallTapTargets: smallTapTargets.slice(0, 20),
      clippedText: clippedText.slice(0, 20),
      fixedElements: fixedElements.slice(0, 15),
      title: document.title,
      path: location.pathname + location.hash,
    };
  }, label);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 768, hasTouch: width < 768 });
    await page.goto(baseUrl, { waitUntil: "commit", timeout: 30000 });
    await page.waitForTimeout(2500);
    results.push(await auditPage(page, `${width}-landing`));

    await page.locator('a[href="#app-dashboard"]').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    results.push(await auditPage(page, `${width}-app`));

    for (const text of ["Report", "Train", "Profile"]) {
      await page.getByRole("button", { name: text }).first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(350);
      results.push(await auditPage(page, `${width}-${text.toLowerCase()}`));
    }

    await page.screenshot({ path: `/tmp/openingfit-${width}.png`, fullPage: true }).catch(() => {});
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
