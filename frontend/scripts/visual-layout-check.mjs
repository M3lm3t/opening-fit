import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const PORT = Number(process.env.OPENINGFIT_VISUAL_PORT || 4177);
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;
const SCREENSHOT_DIR = path.resolve("test-screenshots");

const routes = ["/account", "/login", "/report", "/train", "/history"];
const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 390, height: 844 },
];

async function startVite() {
  const server = await createServer({
    server: {
      host: HOST,
      port: PORT,
      strictPort: true,
    },
    logLevel: "warn",
  });
  await server.listen();
  return server;
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  throw new Error(`Timed out waiting for ${BASE_URL}. ${lastError?.message || ""}`);
}

function boxesOverlap(a, b) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function getBox(locator) {
  const box = await locator.boundingBox();
  if (!box) return null;
  return {
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height,
  };
}

async function assertAccountLayout(page) {
  const failures = [];
  const accountCard = page.locator(".simpleProfileCard", { hasText: "Account" }).first();
  const subscriptionCard = page.locator(".simpleProfileCard", { hasText: "Subscription" }).first();
  const accountPanel = accountCard.locator(".accountPanel--screen").first();
  const formControls = accountCard.locator("input, button, form");
  const majorCards = page.locator(".simpleProfileCard");

  await accountCard.waitFor({ state: "visible", timeout: 10000 });

  const accountBox = await getBox(accountCard);
  const subscriptionBox = await getBox(subscriptionCard);
  const panelBox = await getBox(accountPanel);

  if (!accountBox) failures.push("Account card is not visible.");
  if (!panelBox) failures.push("AccountPanel screen box is not visible.");

  if (accountBox && panelBox) {
    const tolerance = 2;
    if (
      panelBox.left < accountBox.left - tolerance ||
      panelBox.right > accountBox.right + tolerance ||
      panelBox.top < accountBox.top - tolerance ||
      panelBox.bottom > accountBox.bottom + tolerance
    ) {
      failures.push("AccountPanel bounding box escapes the Account card.");
    }
  }

  if (panelBox && subscriptionBox && boxesOverlap(panelBox, subscriptionBox)) {
    failures.push("AccountPanel overlaps the Subscription card.");
  }

  const controlCount = await formControls.count();
  for (let index = 0; index < controlCount; index += 1) {
    const control = formControls.nth(index);
    if (!(await control.isVisible().catch(() => false))) continue;
    const box = await getBox(control);
    if (!box || !accountBox) continue;
    const tolerance = 2;
    if (
      box.left < accountBox.left - tolerance ||
      box.right > accountBox.right + tolerance ||
      box.top < accountBox.top - tolerance ||
      box.bottom > accountBox.bottom + tolerance
    ) {
      failures.push("A login form control escapes the Account card.");
      break;
    }
  }

  const desktop = page.viewportSize()?.width >= 900;
  if (desktop) {
    const cardCount = await majorCards.count();
    for (let index = 0; index < cardCount; index += 1) {
      const card = majorCards.nth(index);
      if (!(await card.isVisible().catch(() => false))) continue;
      const box = await getBox(card);
      if (box && box.width < 240) {
        const label = (await card.locator("h2").first().textContent().catch(() => "card"))?.trim() || "card";
        failures.push(`${label} card is ${Math.round(box.width)}px wide on desktop.`);
      }
    }
  }

  const stackedText = await page.locator(".profileDashboardSimple h1, .profileDashboardSimple h2, .profileDashboardSimple h3, .profileDashboardSimple p, .profileDashboardSimple span, .profileDashboardSimple strong, .profileDashboardSimple small, .profileDashboardSimple button, .profileDashboardSimple label").evaluateAll((nodes) => {
    const results = [];
    for (const node of nodes) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 8) continue;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const looksStacked = rect.width < 84 && rect.height > rect.width * 1.45 && text.includes(" ");
      const forcedBadWrap = style.wordBreak === "break-all" || style.writingMode.startsWith("vertical");
      if (looksStacked || forcedBadWrap) {
        results.push({
          text: text.slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          wordBreak: style.wordBreak,
          writingMode: style.writingMode,
        });
      }
    }
    return results;
  });

  if (stackedText.length) {
    failures.push(
      `Potential letter-stacked text: ${stackedText
        .slice(0, 5)
        .map((item) => `"${item.text}" (${item.width}x${item.height}, ${item.wordBreak}, ${item.writingMode})`)
        .join("; ")}`
    );
  }

  const badScrollContainers = await page.locator(".profileDashboardSimple .simpleProfileCard, .profileDashboardSimple .accountPanel--screen, .profileDashboardSimple .simpleProfileNestedDetails").evaluateAll((nodes) => {
    const results = [];
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const style = window.getComputedStyle(node);
      const hasHorizontalScroll = node.scrollWidth > node.clientWidth + 2 && ["auto", "scroll"].includes(style.overflowX);
      const hasVerticalScroll = node.scrollHeight > node.clientHeight + 2 && ["auto", "scroll"].includes(style.overflowY);
      if (hasHorizontalScroll || hasVerticalScroll) {
        const label = node.querySelector("h2,h3,summary")?.textContent?.replace(/\s+/g, " ").trim() || node.className || node.tagName;
        results.push(`${label}: scroll ${node.scrollWidth}x${node.scrollHeight}, client ${node.clientWidth}x${node.clientHeight}, overflow ${style.overflow}/${style.overflowY}`);
      }
    }
    return results;
  });

  if (badScrollContainers.length) {
    failures.push(`Unexpected account internal scroll/overflow: ${badScrollContainers.slice(0, 5).join("; ")}`);
  }

  if (failures.length) {
    throw new Error(failures.join("\n"));
  }
}

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const server = await startVite();
  let browser;
  const screenshots = [];

  try {
    await waitForServer();
    browser = await chromium.launch();
    const page = await browser.newPage();

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of routes) {
        const url = `${BASE_URL}${route}`;
        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForTimeout(500);
        const routeName = route.replace(/^\//, "") || "home";
        const filename = `${routeName}-${viewport.name}-${viewport.width}x${viewport.height}.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);
        await page.screenshot({ path: filepath, fullPage: true });
        screenshots.push(filepath);

        if (route === "/account") {
          await assertAccountLayout(page);
        }
      }
    }
  } finally {
    await browser?.close();
    await server?.close();
  }

  console.log("OpeningFit layout screenshots created:");
  for (const screenshot of screenshots) {
    console.log(`- ${path.relative(process.cwd(), screenshot)}`);
  }
}

main().catch((error) => {
  console.error("OpeningFit visual layout check failed:");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
