import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixturePlugin } from './fixtures/account-fixture-plugin.mjs';
import { auditPageContrast } from './fixtures/contrast-audit.mjs';
import { MELMET_REGRESSION_FIXTURE } from '../src/lib/fixtures/melmetRegressionFixture.js';
import { openingSeoPages } from '../src/data/openingSeoPages.js';
import { chessOpeningSeoPages } from '../src/data/chessOpeningSeoPages.js';
import { guideSeoPages } from '../src/content/seoPages.js';
import { DEFAULT_BILLING_CONFIGURATION } from '../src/lib/premiumExperience.js';
import { DEFAULT_PUBLIC_ANALYSIS_CONTRACT } from '../src/lib/productTransparency.js';

const out = path.resolve(process.env.ACCEPTANCE_OUTPUT || '../.release-build/ui-stage5');
await mkdir(out, { recursive: true });
const sitemap = await readFile('public/sitemap.xml', 'utf8');
const seoSource = await readFile('src/components/SeoLandingPage.jsx', 'utf8');
const seoRoutes = [...seoSource.matchAll(/^  "(\/[^"]+)": \{/gm)].map(m => m[1]);
const publicRoutes = [...new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => new URL(m[1]).pathname).concat(openingSeoPages.map(x => '/openings/' + x.slug), chessOpeningSeoPages.map(x => '/chess-openings/' + x.slug), guideSeoPages.map(x => '/guides/' + x.slug), seoRoutes, ['/analyse', '/login', '/pricing', '/guides/not-a-guide', '/openings/not-an-opening', '/chess-openings/not-an-opening']))];
const appRoutes = ['/dashboard', '/report', '/train', '/account', '/profile', '/repertoire', '/progress', '/journey', '/upgrade'];
const port = Number(process.env.ACCEPTANCE_PORT || 4192);
const server = await createServer({ plugins: [fixturePlugin], server: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'error' });
await server.listen();
const origin = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const results = [];
const findings = [];
const quick = process.env.ACCEPTANCE_QUICK === '1';
const widths = process.env.ACCEPTANCE_WIDTHS ? process.env.ACCEPTANCE_WIDTHS.split(',').map(Number) : quick ? [390, 1280] : [360, 390, 768, 1280, 1440];
const routeFilter = process.env.ACCEPTANCE_ROUTES?.split(',');
async function inspect(page, label) {
  // Theme colours transition independently. Measure their settled colours,
  // not an intermediate frame with the new background and old foreground.
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(animation =>
      animation.effect?.getComputedTiming().iterations !== Infinity
    ).map(animation => animation.finished.catch(() => {})));
  });
  const issues = await page.evaluate(() => {
    const issues = [];
    const shown = el => el.checkVisibility() && el.getBoundingClientRect().width > 0;
    const viewport = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > viewport + 1) issues.push({ type: 'page-overflow', width: document.documentElement.scrollWidth, viewport });
    if (document.querySelector('.appCrashFallback')) issues.push({ type: 'runtime-fallback' });
    for (const el of document.querySelectorAll('h1,h2,h3,button,input,select,textarea,summary,.chessPositionBoard')) {
      if (!shown(el) || el.closest('.compactEvidenceTableWrap,[hidden],.appPrimaryMobilePanel:not(.appPrimaryMobilePanelOpen)')) continue;
      const r = el.getBoundingClientRect();
      if (r.right > viewport + 2 || r.left < -2) issues.push({ type: 'outside-viewport', selector: el.tagName + '.' + el.className, text: el.textContent.slice(0, 70) });
      if (/^H[123]$/.test(el.tagName) && el.scrollHeight > el.clientHeight + 3 && ['hidden', 'clip'].includes(getComputedStyle(el).overflowY)) issues.push({ type: 'clipped-heading', text: el.textContent });
      if (el.matches('.chessPositionBoard') && (Math.abs(r.width - r.height) > 3 || r.width < 180)) issues.push({ type: 'board-size', width: r.width, height: r.height });
      if (el.matches('button') && !(el.textContent.trim() || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('aria-labelledby'))) issues.push({ type: 'unlabelled-button', selector: el.className });
      if (el.matches('input:not([type=hidden]),select,textarea') && !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) issues.push({ type: 'unlabelled-field', selector: el.className });
    }
    const theme = document.documentElement.dataset.theme;
    const pageTheme = document.querySelector('.page[data-theme]')?.dataset.theme;
    if (pageTheme && theme !== pageTheme) issues.push({ type: 'theme-mismatch', theme, pageTheme });
    return issues;
  });
  const contrast = await auditPageContrast(page);
  findings.push(...issues.map(issue => ({ label, ...issue })), ...contrast.map(issue => ({ label, type: 'contrast', ...issue })));
  results.push(label);
  await writeFile(path.join(out, 'findings.json'), JSON.stringify(findings, null, 2));
}
async function makePage(theme, width, authenticated) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(12000);
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('/api/billing/config')) return route.fulfill({ json: DEFAULT_BILLING_CONFIGURATION });
    if (url.includes('/api/public/analysis-contract')) return route.fulfill({ json: DEFAULT_PUBLIC_ANALYSIS_CONTRACT });
    if (url.includes('/api/readiness')) return route.fulfill({ json: { status: 'ready', missions: 'disabled' } });
    if (url.includes('/api/health')) return route.fulfill({ json: { status: 'ok' } });
    return url.startsWith(origin) ? route.continue() : route.abort();
  });
  await page.addInitScript(({ theme, authenticated, report }) => {
    window.__accountFixture = { signedOut: !authenticated, plan: 'monthly_subscription', long: true, history: true };
    localStorage.setItem('openingFit:theme', theme);
    localStorage.setItem('openingFit:trainingPreferences:v1', JSON.stringify({ status: 'skipped' }));
    if (authenticated) localStorage.setItem('openingFit:lastAnalysis', JSON.stringify({ analysis: report, username: report.username, platform: 'chess.com' }));
  }, { theme, authenticated, report: MELMET_REGRESSION_FIXTURE });
  return page;
}
try {
  for (const authenticated of [false, true]) for (const theme of ['dark', 'light']) for (const width of widths) {
    const page = await makePage(theme, width, authenticated);
    const routes = (authenticated ? appRoutes : publicRoutes).filter(route => !routeFilter || routeFilter.includes(route));
    for (const route of routes) {
      const label = `${authenticated ? 'paid' : 'public'} ${route} ${theme} ${width}`;
      console.log(label);
      const errors = [];
      const onError = error => errors.push(error.message);
      page.on('pageerror', onError);
      try {
        await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.locator('.appPrimaryNav').waitFor();
        await page.waitForTimeout(120);
        const redirects = { '/repertoire': '/report', '/progress': '/account', '/journey': '/account', '/upgrade': '/account' };
        const expectedPath = redirects[route] || route;
        if (new URL(page.url()).pathname !== expectedPath) findings.push({ label, type: 'unexpected-route', expectedPath, actualPath: new URL(page.url()).pathname });
        await inspect(page, label);
        if (width === 390 || width === 1280) await page.screenshot({ path: path.join(out, `${authenticated ? 'paid' : 'public'}-${theme}-${width}-${route.replaceAll('/', '_') || 'home'}.png`), fullPage: true });
        if (route === '/report') {
          for (const tab of ['Priorities', 'Repertoire', 'Evidence']) {
            await page.getByRole('tab', { name: tab, exact: true }).click();
            await inspect(page, `${label}/${tab}`);
          }
        }
        if (!authenticated && width === 1280) {
          const nextTheme = await page.evaluate(() => document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
          await page.locator('.appPrimaryTheme button').click();
          await page.waitForFunction(theme => document.documentElement.dataset.theme === theme && [...document.querySelectorAll('.page[data-theme]')].every(el => el.dataset.theme === theme), nextTheme);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await inspect(page, `${label}/theme-toggle`);
        }
        // Keyboard focus must be visible without relying on a mouse hover.
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => { const el = document.activeElement; const s = el && getComputedStyle(el); return !el || el === document.body || s.outlineStyle === 'none' && s.boxShadow === 'none'; });
        if (focus) findings.push({ label, type: 'focus-indicator-review' });
        findings.push(...errors.map(message => ({ label, type: 'runtime-error', message })));
      } catch (error) { findings.push({ label, type: 'check-error', message: error.message }); }
      page.off('pageerror', onError);
    }
    await page.close();
  }
  await writeFile(path.join(out, 'routes.json'), JSON.stringify({ publicRoutes, appRoutes }, null, 2));
  await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await writeFile(path.join(out, 'findings.json'), JSON.stringify(findings, null, 2));
  console.log(`Audited ${results.length} route/layout states; ${findings.length} findings require review`);
  if (findings.length) process.exitCode = 1;
} finally { await browser.close(); await server.close(); }
