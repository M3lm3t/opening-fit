import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { SAMPLE_REPORT } from "../src/fixtures/sampleReport.js";

const USER_REPORT_FIXTURE = Object.freeze({
  ...SAMPLE_REPORT,
  sampleMode: false,
  sample_mode: false,
  sampleLabel: undefined,
  source: "visual_user_fixture",
  isDemo: false,
  username: "Visual Test Player",
  playerName: "Visual Test Player",
  platform: "chess.com",
  importPlatform: "chess.com",
});

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
const allRoutes = ["/", "/login", "/dashboard", "/report", "/report/sample", "/repertoire", "/train", "/progress", "/account", "/journey", "/premium"];
const routes = requestedRoutes.length ? allRoutes.filter((route) => requestedRoutes.includes(route)) : allRoutes;
const allViewports = [
  { name: "phone-compact", width: 320, height: 568 },
  { name: "phone-standard", width: 375, height: 667 },
  { name: "phone", width: 360, height: 800 },
  { name: "phone-plus", width: 390, height: 844 },
  { name: "phone-tall", width: 412, height: 915 },
  { name: "phone-large", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "tablet-lg", width: 820, height: 1180 },
  { name: "desktop", width: 1024, height: 768 },
  { name: "laptop-short", width: 1280, height: 720 },
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
  if (await locator.count() === 0) return null;
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

async function installAuthenticatedAccountFixture(page) {
  await page.evaluate(() => {
    document.body.innerHTML = `
      <header class="appPrimaryNav"><a href="/" aria-label="OpeningFit home">OpeningFit</a><nav aria-label="Primary"><a href="/dashboard">Home</a><a href="/report">Report</a><a href="/train">Train</a><a href="/account" aria-current="page">Account</a></nav></header>
      <main class="page">
      <div class="accountHub profileDashboard profileDashboardSimple">
        <header class="accountHubHeader">
          <div><p class="eyebrow">Account</p><h1>Alex Morgan</h1><p>AlexMorganChess · Chess.com</p><small>alex@example.test</small></div>
          <span class="accountMembershipBadge accountMembershipBadge--free">Free</span>
        </header>
        <div class="accountSectionNav" role="tablist" aria-label="Account sections">
          <button id="account-tab-profile" type="button" role="tab" aria-selected="true">Profile</button>
          <button type="button" role="tab" aria-selected="false">Preferences</button>
          <button type="button" role="tab" aria-selected="false">Membership</button>
          <button type="button" role="tab" aria-selected="false">Data &amp; support</button>
        </div>
        <section id="account-panel-profile" role="tabpanel" aria-labelledby="account-tab-profile">
          <div class="simpleProfileGrid">
            <article class="simpleProfileCard">
              <div><p class="eyebrow">Profile</p><h2>Account</h2><p>Manage the identity and chess account used for your reports.</p></div>
              <details class="simpleProfileNestedDetails" open>
                <summary>Account details</summary>
                <div class="accountPanelShell accountPanelShell--profile">
                  <div class="accountPanel accountPanel--screen accountPanel--profile">
                    <div class="accountProfileStack">
                      <label>Display name<input type="text" value="Alex Morgan" readonly></label>
                      <label>Email address<input type="email" value="alex@example.test" readonly></label>
                      <label>Chess.com username<input type="text" value="AlexMorganChess" readonly></label>
                      <label>Rating goal<input type="text" value="1800" readonly></label>
                      <p>Your reports and training history restore from your OpeningFit account.</p>
                      <div class="accountActions"><button type="button">Save changes</button><button type="button">Restore cloud data</button></div>
                    </div>
                  </div>
                </div>
              </details>
            </article>
            <article class="simpleProfileCard">
              <div><p class="eyebrow">Progress</p><h2>Stats</h2></div>
              <dl><div><dt>Reports saved</dt><dd>12</dd></div><div><dt>Training completed</dt><dd>28</dd></div><div><dt>Current rating</dt><dd>1642</dd></div></dl>
              <div class="accountActions"><button type="button">Open Today</button><button type="button">Training history</button></div>
            </article>
          </div>
        </section>
      </div>
      </main>
      <footer class="homepageFooter"><span>OpeningFit</span></footer>`;
  });
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
  const accountHub = page.locator(".accountHub").first();
  const accountHeading = accountHub.locator(".accountHubHeader h1").first();
  const activePanel = accountHub.locator('[role="tabpanel"]:visible').first();
  const appHeader = page.locator(".appPrimaryNav, .appHeader, header.siteHeader").first();
  const footer = page.locator(".appStoreReadinessFooter, .homepageFooter").last();

  await accountCard.waitFor({ state: "visible", timeout: 10000 });

  const accountBox = await getBox(accountCard);
  const subscriptionBox = await getBox(subscriptionCard);
  const panelBox = await getBox(accountPanel);

  if (!accountBox) failures.push("Account card is not visible.");
  if (!panelBox) failures.push("AccountPanel screen box is not visible.");

  const headingBox = await getBox(accountHeading);
  const headerBox = await getBox(appHeader);
  if (headingBox && headerBox && headingBox.top < headerBox.bottom - 2) {
    failures.push("Account heading begins underneath the application header.");
  }

  const activePanelContainment = await activePanel.evaluate((panel) => {
    const panelRect = panel.getBoundingClientRect();
    const visible = [...panel.querySelectorAll("*")].filter((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    const lastBottom = visible.reduce((bottom, node) => Math.max(bottom, node.getBoundingClientRect().bottom), panelRect.top);
    return { panelBottom: panelRect.bottom, lastBottom, scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight };
  });
  if (activePanelContainment.lastBottom > activePanelContainment.panelBottom + 2) {
    failures.push("Active Account tab panel does not contain its last visible child.");
  }

  const openDetails = activePanel.locator("details[open]").first();
  if (await openDetails.count()) {
    const growth = await openDetails.evaluate(async (details) => {
      const measure = () => ({ documentHeight: document.documentElement.scrollHeight, panelHeight: details.closest('[role="tabpanel"]')?.getBoundingClientRect().height || 0 });
      const expanded = measure();
      details.open = false;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const collapsed = measure();
      details.open = true;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { expanded, collapsed };
    });
    if (growth.expanded.panelHeight <= growth.collapsed.panelHeight + 2 || growth.expanded.documentHeight < growth.collapsed.documentHeight) {
      failures.push("Account document flow does not grow with expanded Profile content.");
    }
  }

  if (await accountHub.locator('.accountLegalLinks, .accountDangerZone, a[href="/privacy"], a[href="/terms"]').count()) {
    failures.push("Data & support content is mounted while Profile is active.");
  }

  if (await accountHub.locator('[role="tabpanel"][hidden]').count()) {
    failures.push("Hidden Account tab panels remain mounted in layout.");
  }

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

    const visibleCardBoxes = await majorCards.evaluateAll((cards) => cards
      .filter((card) => {
        const rect = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((card) => ({ label: card.querySelector("h2")?.textContent?.trim() || "card", ...card.getBoundingClientRect().toJSON() })));
    for (let left = 0; left < visibleCardBoxes.length; left += 1) {
      for (let right = left + 1; right < visibleCardBoxes.length; right += 1) {
        if (boxesOverlap(visibleCardBoxes[left], visibleCardBoxes[right])) {
          failures.push(`${visibleCardBoxes[left].label} overlaps ${visibleCardBoxes[right].label}.`);
        }
      }
    }
  }

  const escapedButtons = await activePanel.locator("button:visible").evaluateAll((buttons, panelSelector) => buttons.flatMap((button) => {
    const owner = button.closest(panelSelector);
    if (!owner) return [button.textContent?.trim() || "button"];
    const buttonRect = button.getBoundingClientRect();
    const ownerRect = owner.getBoundingClientRect();
    return buttonRect.left < ownerRect.left - 2 || buttonRect.right > ownerRect.right + 2 || buttonRect.top < ownerRect.top - 2 || buttonRect.bottom > ownerRect.bottom + 2
      ? [button.textContent?.trim() || "button"]
      : [];
  }), '[role="tabpanel"]');
  if (escapedButtons.length) failures.push(`Buttons escape the active Account panel: ${escapedButtons.slice(0, 5).join(", ")}.`);

  const hubBox = await getBox(accountHub);
  const footerBox = await getBox(footer);
  if (hubBox && footerBox && footerBox.top < hubBox.bottom - 2) {
    failures.push("Global footer begins before Account content ends.");
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

  if (route === "/") {
    const sampleLinks = page.locator('a[href="/report/sample"]');
    if (await sampleLinks.count() !== 2) failures.push("Homepage must expose exactly two sample-report CTAs.");
    for (const trustClaim of ["No password required", "First report free", "Uses public game data"]) {
      const visibleClaimCount = await page.getByText(trustClaim, { exact: true }).evaluateAll((nodes) => nodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }).length);
      if (visibleClaimCount !== 1) failures.push(`Homepage must show ${trustClaim} once near the form.`);
    }
    if (viewport?.width <= 760 && await page.locator(".homepageSamplePreview").isVisible().catch(() => false)) {
      failures.push("Homepage sample preview competes with the analysis form on mobile.");
    }
  }

  if (route === "/report/sample") {
    const sampleNotice = page.locator(".sampleReportNotice").first();
    if (!(await sampleNotice.isVisible().catch(() => false))) failures.push("Example report notice is not visible.");
    const pageText = await page.locator("body").innerText();
    for (const requiredText of ["Illustrative example", "Fictional data", "Analyse your games", "72 games", "fictional player"]) {
      if (!pageText.includes(requiredText)) failures.push(`Example report is missing required text: ${requiredText}.`);
    }
    const reportNavigation = page.getByRole("tablist", { name: "Report sections" });
    if (!(await reportNavigation.isVisible().catch(() => false))) failures.push("Example report is missing the four-view report navigation.");
    if (await reportNavigation.getByRole("tab").count() !== 4) failures.push("Example report must expose exactly four report views.");
    const persistedReport = await page.evaluate(() => window.localStorage.getItem("openingFit:lastAnalysis"));
    if (persistedReport !== null) failures.push("Direct sample route persisted data as the visitor's report.");
  }

  if (route === "/report" || route === "/report/sample") {
    const visibleDialogs = await page.locator('[role="dialog"]:visible').count();
    if (visibleDialogs > 0) failures.push("Report route opened an automatic dialog.");
  }

  if (route === "/login") {
    const pageText = await page.locator("body").innerText();
    for (const forbiddenText of ["Total games analysed", "Reports saved", "Training completed", "Opening progress markers", "Manage subscription", "Privacy Policy"]) {
      if (pageText.includes(forbiddenText)) failures.push(`Signed-out login rendered authenticated account content: ${forbiddenText}.`);
    }
    if (!pageText.includes("Log in or create account")) failures.push("Signed-out login heading is missing.");
    const loginHeadings = page.getByRole("heading", { name: "Log in or create account", exact: true });
    if (await loginHeadings.count() !== 1) failures.push("Signed-out login must have one clear page heading.");
  }

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

    if (route === "/report") {
      if (!(await bottomNav.isVisible().catch(() => false))) failures.push("Canonical mobile navigation is missing.");
      if (await page.getByRole("button", { name: "Open OpeningFit menu" }).isVisible().catch(() => false)) {
        failures.push("Phone layout shows both bottom navigation and a redundant hamburger.");
      }
      const navText = await bottomNav.innerText();
      for (const label of ["Home", "Report", "Train", "Account"]) {
        if (!navText.includes(label)) failures.push(`Canonical mobile navigation is missing ${label}.`);
      }
      if (/Pricing|Premium|Upgrade|Repertoire|Progress/.test(navText)) failures.push("Mobile navigation contains a retired primary destination.");
    } else if (["/", "/login"].includes(route)) {
      if (await bottomNav.isVisible().catch(() => false)) failures.push("Marketing route shows the application bottom navigation.");
      if (!(await page.getByRole("button", { name: "Open OpeningFit menu" }).isVisible().catch(() => false))) {
        failures.push("Marketing route is missing its responsive menu.");
      }
    }
  }

  const clippedText = await page.locator("h1,h2,h3,p,a,button,label,strong,span").evaluateAll((nodes) => {
    const results = [];
    for (const node of nodes) {
      if (node.matches(".reportPageTitle,.sr-only")) continue;
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
              username: report.username || "Example Player — Sample",
              platform: report.platform || "example",
              savedAt: new Date().toISOString(),
              analysis,
            }));
          }, { report: USER_REPORT_FIXTURE, includeOpportunity: route === "/train", opportunity: TRAINING_OPPORTUNITY_FIXTURE });
          await page.reload({ waitUntil: "domcontentloaded" });
        }
        await page.locator(".page, .seoPageShell").first().waitFor({ state: "visible", timeout: 10000 });
        if (route === "/report/sample") {
          await page.locator(".sampleReportNotice").first().waitFor({ state: "visible", timeout: 10000 });
        }
        if (route === "/train") {
          const opportunityButton = page.locator(".trainingSessionQueue li.isCurrent button").first();
          if (await opportunityButton.isVisible().catch(() => false)) {
            await opportunityButton.click();
            await page.locator(".openingOpportunityDrill").first().waitFor({ state: "visible", timeout: 10000 });
          }
        }
        await page.waitForTimeout(350);
        if (route === "/account" && new URLSearchParams(FORCED_QUERY).get("accountFixture") === "authenticated") {
          await installAuthenticatedAccountFixture(page);
        }
        const routeName = route.replace(/^\//, "").replaceAll("/", "-") || "home";
        const themeName = FORCED_THEME === "light" || FORCED_THEME === "dark" ? `-${FORCED_THEME}` : "";
        const filename = `${routeName}${themeName}-${viewport.name}-${viewport.width}x${viewport.height}.png`;
        const filepath = path.join(SCREENSHOT_DIR, filename);
        await page.screenshot({ path: filepath, fullPage: true });
        screenshots.push(filepath);

        await assertRouteLayout(page, route);
        await assertIconControlAlignment(page, route);

        if (route === "/report/sample") {
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.locator(".sampleReportNotice").first().waitFor({ state: "visible", timeout: 10000 });
          await assertRouteLayout(page, route);
        }

        if (route === "/report") {
          const reportViews = [
            ["Summary", "#report-summary-view"],
            ["Priorities", "#report-priorities-view"],
            ["Repertoire", "#report-repertoire-view"],
            ["Evidence", "#report-evidence-view"],
          ];
          const reportNavigation = page.getByRole("tablist", { name: "Report sections" });
          for (const [label, selector] of reportViews) {
            const reportButton = reportNavigation.getByRole("tab", { name: label, exact: true });
            if (label !== "Summary") await reportButton.click();
            const opened = await page.locator(selector).waitFor({ state: "visible", timeout: 3000 }).then(() => true).catch(() => false);
            if (!opened) {
              const active = await reportNavigation.locator('[aria-selected="true"]').allTextContents();
              throw new Error(`Report view ${label} did not open (${page.url()}; active: ${active.join(", ") || "none"}).`);
            }
            await assertRouteLayout(page, route);
          }
          if (await page.locator('[role="dialog"]:visible').count() > 0) {
            throw new Error("Report navigation opened a paywall or another dialog.");
          }
        }

        if (route === "/report" || route === "/train") {
          await page.evaluate(() => window.localStorage.removeItem("openingFit:lastAnalysis"));
        }

        if (route === "/account") {
          const authenticatedAccountCard = page.locator(".simpleProfileCard", { hasText: "Account" }).first();
          if (await authenticatedAccountCard.isVisible().catch(() => false)) {
            await assertAccountLayout(page);
          } else {
            const pageText = await page.locator("body").innerText();
            if (!pageText.includes("Log in or create account")) {
              throw new Error("Signed-out account route rendered neither the login surface nor the authenticated dashboard.");
            }
          }
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
