import { chromium } from "playwright";
import { createServer } from "vite";
import { SAMPLE_REPORT } from "../src/fixtures/sampleReport.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.OPENINGFIT_CONTRAST_PORT || 4178);
const BASE_URL = `http://${HOST}:${PORT}`;
const ROUTES = ["/", "/login", "/report", "/report/sample", "/repertoire", "/train", "/progress", "/account", "/premium", "/privacy", "/terms", "/guides", "/openings"];
const THEMES = ["dark", "light"];
const VIEWPORTS = [
  { name: "phone-compact", width: 320, height: 720 },
  { name: "phone", width: 360, height: 800 },
  { name: "phone-plus", width: 390, height: 844 },
  { name: "phone-tall", width: 412, height: 915 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

async function auditPageContrast(page) {
  return page.evaluate(() => {
    const parse = (value) => {
      const match = String(value || "").match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
    };
    const composite = (top, bottom) => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (alpha <= 0) return [0, 0, 0, 0];
      return [
        (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / alpha,
        (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / alpha,
        (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / alpha,
        alpha,
      ];
    };
    const luminance = (rgb) => {
      const channels = rgb.slice(0, 3).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const ratio = (one, two) => {
      const a = luminance(one);
      const b = luminance(two);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const selector = (element) => {
      const parts = [];
      let current = element;
      while (current && current !== document.body && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        if (current.id) part += `#${current.id}`;
        else if (current.classList.length) part += `.${[...current.classList].slice(0, 2).join(".")}`;
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(" > ");
    };
    const effectiveBackground = (element) => {
      const layers = [];
      let current = element;
      while (current) {
        const style = getComputedStyle(current);
        const colour = parse(style.backgroundColor);
        if (colour && colour[3] > 0) layers.push(colour);
        current = current.parentElement;
      }
      let result = document.documentElement.dataset.theme === "light" ? [248, 250, 252, 1] : [3, 8, 20, 1];
      for (const layer of layers.reverse()) result = composite(layer, result);
      return result;
    };
    const hasBackgroundImageAncestor = (element) => {
      let current = element;
      while (current && current !== document.documentElement) {
        const style = getComputedStyle(current);
        if (style.backgroundImage !== "none") return true;
        const colour = parse(style.backgroundColor);
        if (colour?.[3] >= 0.98) return false;
        current = current.parentElement;
      }
      return false;
    };

    const failures = [];
    const seen = new Set();
    for (const element of document.body.querySelectorAll("body *")) {
      if (["SCRIPT", "STYLE", "SVG", "PATH", "IMG", "CANVAS"].includes(element.tagName)) continue;
      const directText = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || "").join(" ").replace(/\s+/g, " ").trim();
      if (!directText) continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width < 1 || rect.height < 1 || style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.25) continue;
      // Gradient and image backgrounds need pixel sampling rather than CSS colour
      // composition, so they are covered by the visual regression sweep.
      if (hasBackgroundImageAncestor(element)) continue;
      const foreground = parse(style.color);
      if (!foreground) continue;
      const background = effectiveBackground(element);
      const renderedForeground = composite(foreground, background);
      const contrast = ratio(renderedForeground, background);
      const fontSize = Number.parseFloat(style.fontSize) || 16;
      const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
      const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const disabled = element.matches(":disabled,[aria-disabled='true']") || Boolean(element.closest(":disabled,[aria-disabled='true']"));
      const minimum = disabled ? 3 : largeText ? 3 : 4.5;
      if (contrast + 0.05 >= minimum) continue;
      const key = `${selector(element)}|${directText.slice(0, 80)}|${contrast.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures.push({
        selector: selector(element),
        text: directText.slice(0, 100),
        contrast: Number(contrast.toFixed(2)),
        minimum,
        foreground: style.color,
        background: `rgb(${background.slice(0, 3).map(Math.round).join(", ")})`,
      });
    }
    return failures;
  });
}

async function auditSemanticControls(page, theme, viewport) {
  await page.evaluate(() => {
    const fixture = document.createElement("section");
    fixture.className = "themeRegressionFixture appReportPage accountPanel";
    fixture.setAttribute("aria-label", "Theme control regression fixture");
    fixture.style.cssText = "position:fixed;inset:8px auto auto 8px;z-index:99999;padding:12px;background:var(--color-surface-raised);display:grid;gap:8px";
    fixture.innerHTML = [
      '<button class="emailSignInBtn" type="button">Save account</button>',
      '<button class="saveAccountBtn" type="button">Cloud Restore</button>',
      '<button class="signOutBtn" type="button">Sign out</button>',
      '<button class="accountDangerButton" type="button">Delete my account</button>',
      '<div class="boardThemeToggle"><button class="boardThemeToggleActive" type="button">Classic green</button><button type="button">Lichess brown</button><button type="button">Blue</button><button type="button">Grey</button><button type="button">High Contrast</button></div>',
      '<div class="practiceMoveList"><button class="practiceMoveChip done" type="button"><span>1.</span> d4</button><button class="practiceMoveChip current" type="button"><span>1...</span> ?</button><button class="practiceMoveChip critical" type="button"><span>2...</span> ? <small>Decision</small></button><button class="practiceMoveChip" type="button" disabled><span>3.</span> ?</button></div>',
      '<button class="secondaryBtn" type="button">View evidence and full report</button>',
      '<button class="secondaryBtn" type="button" disabled>View evidence and full report</button>',
      '<div class="practiceControls boardPracticeControls"><button type="button">Back</button><button type="button">Reset</button><button type="button">Hint</button><button class="primaryPracticeControl" type="button">Show move</button><button class="nextLineControl" type="button">Next line</button></div>',
      '<button class="practiceLineChoice active" type="button"><span>Line 1</span><strong>Queen\'s Pawn Opening practical line</strong></button>',
    ].join("");
    document.body.append(fixture);
  });
  const findings = await auditPageContrast(page);
  await page.evaluate(() => document.querySelector(".themeRegressionFixture")?.remove());
  return findings
    .filter((finding) => finding.selector.includes("themeRegressionFixture"))
    .map((finding) => ({ theme, viewport, route: "semantic-controls", ...finding }));
}

async function main() {
  const server = await createServer({ server: { host: HOST, port: PORT, strictPort: true }, logLevel: "error" });
  await server.listen();
  const browser = await chromium.launch();
  const findings = [];
  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const page = await browser.newPage({ viewport });
        await page.addInitScript(({ selectedTheme, report }) => {
          localStorage.setItem("openingFit:theme", selectedTheme);
          localStorage.setItem("openingFit:trainingPreferences:v1", JSON.stringify({ status: "skipped" }));
          localStorage.setItem("openingFit:lastAnalysis", JSON.stringify({ username: report.username || "Example Player — Sample", platform: report.platform || "example", savedAt: new Date().toISOString(), analysis: report }));
        }, { selectedTheme: theme, report: SAMPLE_REPORT });
        for (const route of ROUTES) {
          await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
          await page.locator("body").waitFor({ state: "visible", timeout: 10000 });
          await page.waitForTimeout(200);
          const routeFindings = await auditPageContrast(page);
          findings.push(...routeFindings.map((finding) => ({ theme, viewport: viewport.name, route, ...finding })));
        }
        findings.push(...await auditSemanticControls(page, theme, viewport.name));
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const deduped = [];
  const keys = new Set();
  for (const finding of findings.sort((a, b) => a.contrast - b.contrast)) {
    const key = `${finding.theme}|${finding.route}|${finding.selector}|${finding.text}|${finding.foreground}|${finding.background}`;
    if (keys.has(key)) continue;
    keys.add(key);
    deduped.push(finding);
  }
  if (deduped.length) {
    console.error(`OpeningFit colour contrast audit found ${deduped.length} unique failures:`);
    for (const finding of deduped.slice(0, 120)) {
      console.error(`[${finding.theme}/${finding.viewport} ${finding.route}] ${finding.contrast}:1 < ${finding.minimum}:1 ${finding.selector} — "${finding.text}" (${finding.foreground} on ${finding.background})`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`OpeningFit colour contrast audit passed ${THEMES.length} themes, ${VIEWPORTS.length} viewports, and ${ROUTES.length} routes.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
