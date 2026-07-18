import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { DEMO_REPORT } from "../src/demoReportData.js";

const PORT = Number(process.env.OPENINGFIT_VISUAL_PORT || 4177);
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;
const TRAINING_OPPORTUNITY_FIXTURE = {
  opportunityId: "visual-opportunity-1",
  gameId: "visual-game-1",
  openingId: "italian-game",
  side: "white",
  positionFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  playedMove: "d4",
  recommendedMove: "e4",
  alternativeMoves: ["Nf3"],
  issueType: "intended_repertoire_move_missed",
  explanation: "Use the intended central move to reach the saved repertoire setup.",
  evidence: "This position is backed by the saved opening report.",
  confidence: 0.82,
  recurrenceCount: 2,
  source: "active_repertoire_line",
};
const FORCED_THEME = String(process.env.OPENINGFIT_VISUAL_THEME || "").trim();
const FORCED_QUERY = String(process.env.OPENINGFIT_VISUAL_QUERY || "").trim().replace(/^\?/, "");
const SCREENSHOT_DIR = path.resolve("test-screenshots");

const requestedRoutes = String(process.env.OPENINGFIT_VISUAL_ROUTES || "").split(",").map((route) => route.trim()).filter(Boolean);
const requestedViewports = new Set(String(process.env.OPENINGFIT_VISUAL_VIEWPORTS || "").split(",").map((name) => name.trim()).filter(Boolean));
const allRoutes = ["/", "/login", "/dashboard", "/report", "/repertoire", "/train", "/progress", "/account", "/journey", "/premium"];
const routes = requestedRoutes.length ? allRoutes.filter((route) => requestedRoutes.includes(route)) : allRoutes;
const allViewports = [
  { name: "phone-compact", width: 320, height: 568 },
  { name: "phone", width: 360, height: 800 },
  { name: "phone-plus", width: 390, height: 844 },
  { name: "phone-tall", width: 412, height: 915 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "tablet-lg", width: 820, height: 1180 },
  { name: "desktop", width: 1024, height: 768 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "laptop-wide", width: 1366, height: 768 },
  { name: "desktop-xl", width: 1440, height: 900 },
  { name: "desktop-1080p", width: 1920, height: 1080 },
];
const viewports = requestedViewports.size ? allViewports.filter((viewport) => requestedViewports.has(viewport.name)) : allViewports;

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

function isIgnorableConsoleError(text = "") {
  return /^Failed to load resource: net::ERR_(NETWORK_ACCESS_DENIED|CONNECTION_REFUSED)/.test(text);
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

async function assertIconControlAlignment(page, route) {
  const failures = await page.locator("button").evaluateAll((buttons) => buttons.flatMap((button) => {
    const buttonStyle = getComputedStyle(button);
    const buttonRect = button.getBoundingClientRect();
    if (buttonRect.width < 1 || buttonRect.height < 1 || buttonStyle.display === "none" || buttonStyle.visibility === "hidden") return [];

    const directText = [...button.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || "")
      .join("")
      .trim();
    const graphics = [...button.querySelectorAll("svg")].filter((svg) => {
      const rect = svg.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (directText || graphics.length !== 1) return [];

    const otherVisibleElements = [...button.children].filter((child) => {
      if (child === graphics[0] || child.contains(graphics[0])) return false;
      const rect = child.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(child).display !== "none";
    });
    if (otherVisibleElements.length) return [];

    const iconRect = graphics[0].getBoundingClientRect();
    const horizontalDelta = Math.abs((buttonRect.left + buttonRect.width / 2) - (iconRect.left + iconRect.width / 2));
    const verticalDelta = Math.abs((buttonRect.top + buttonRect.height / 2) - (iconRect.top + iconRect.height / 2));
    if (horizontalDelta <= 1 && verticalDelta <= 1) return [];

    return [{
      label: button.getAttribute("aria-label") || button.className || "unlabelled icon button",
      horizontalDelta: Number(horizontalDelta.toFixed(2)),
      verticalDelta: Number(verticalDelta.toFixed(2)),
    }];
  }));

  if (failures.length) {
    throw new Error(`Icon controls are not centred on ${route}:\n${failures.map((failure) => `- ${failure.label}: x ${failure.horizontalDelta}px, y ${failure.verticalDelta}px`).join("\n")}`);
  }
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

async function assertRouteLayout(page, route) {
  const failures = [];
  const viewport = page.viewportSize();

  const pageMetrics = await page.evaluate(() => {
    const documentElement = document.documentElement;
    const body = document.body;
    return {
      scrollWidth: Math.max(documentElement.scrollWidth, body?.scrollWidth || 0),
      clientWidth: documentElement.clientWidth,
      bodyScrollWidth: body?.scrollWidth || 0,
    };
  });

  if (pageMetrics.scrollWidth > pageMetrics.clientWidth + 2) {
    failures.push(
      `Horizontal overflow on ${route}: scrollWidth ${pageMetrics.scrollWidth}, clientWidth ${pageMetrics.clientWidth}.`
    );
  }

  if (viewport?.width <= 767) {
    const bottomNav = page.locator(".mobileBottomNav").first();
    if (await bottomNav.isVisible().catch(() => false)) {
      const navBox = await getBox(bottomNav);
      if (!navBox) {
        failures.push("Mobile bottom navigation is not measurable.");
      } else {
        if (navBox.width > viewport.width + 2) {
          failures.push(`Mobile bottom navigation is wider than the viewport (${Math.round(navBox.width)}px).`);
        }
        if (navBox.height < 60) {
          failures.push(`Mobile bottom navigation is too short for touch targets (${Math.round(navBox.height)}px).`);
        }
      }
    }
  }

  const clippedText = await page.locator("h1,h2,h3,p,a,button,label,strong,span").evaluateAll((nodes) => {
    const results = [];
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || rect.width <= 0 || rect.height <= 0) continue;
      const style = window.getComputedStyle(node);
      if (
        style.overflow === "hidden" &&
        node.scrollWidth > node.clientWidth + 4 &&
        text.length > 10 &&
        !["SPAN", "SVG"].includes(node.tagName)
      ) {
        results.push(`${text.slice(0, 64)} (${Math.round(rect.width)}px wide)`);
      }
    }
    return results.slice(0, 5);
  });

  if (clippedText.length) {
    failures.push(`Potential clipped text on ${route}: ${clippedText.join("; ")}`);
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
    if (FORCED_THEME === "light" || FORCED_THEME === "dark") {
      await page.addInitScript((theme) => {
        window.localStorage.setItem("openingFit:theme", theme);
      }, FORCED_THEME);
    }
    const consoleErrors = [];

    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (isIgnorableConsoleError(text)) return;
      consoleErrors.push(text);
    });

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of routes) {
        const url = `${BASE_URL}${route}${FORCED_QUERY ? `?${FORCED_QUERY}` : ""}`;
        // The app intentionally probes an external API during startup. Layout
        // readiness depends on the rendered shell, not that network probe.
        await page.goto(url, { waitUntil: "domcontentloaded" });
        if (route === "/report" || route === "/train") {
          await page.evaluate(({ report, includeOpportunity, opportunity }) => {
            const analysis = includeOpportunity ? { ...report, openingTrainingOpportunities: [opportunity], opening_training_opportunities: [opportunity] } : report;
            window.localStorage.setItem("openingFit:lastAnalysis", JSON.stringify({
              username: report.username || "DemoPlayer",
              platform: report.platform || "demo",
              savedAt: new Date().toISOString(),
              analysis,
            }));
          }, { report: DEMO_REPORT, includeOpportunity: route === "/train", opportunity: TRAINING_OPPORTUNITY_FIXTURE });
          await page.reload({ waitUntil: "domcontentloaded" });
        }
        await page.locator(".page, .seoPageShell").first().waitFor({ state: "visible", timeout: 10000 });
        if (route === "/train") {
          const opportunityButton = page.locator(".trainingSessionQueue li.isCurrent button").first();
          if (await opportunityButton.isVisible().catch(() => false)) {
            await opportunityButton.click();
            await page.locator(".openingOpportunityDrill").first().waitFor({ state: "visible", timeout: 10000 });
          }
        }
        await page.waitForTimeout(350);
        const routeName = route.replace(/^\//, "") || "home";
        const filename = `${routeName}-${viewport.name}-${viewport.width}x${viewport.height}.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);
        await page.screenshot({ path: filepath, fullPage: true });
        screenshots.push(filepath);

        await assertRouteLayout(page, route);
        await assertIconControlAlignment(page, route);

        if (route === "/report" || route === "/train") {
          await page.evaluate(() => window.localStorage.removeItem("openingFit:lastAnalysis"));
        }

        if (route === "/account") {
          await assertAccountLayout(page);
        }
      }
    }

    if (consoleErrors.length) {
      throw new Error(`Browser console errors detected:\n${consoleErrors.slice(0, 12).join("\n")}`);
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
