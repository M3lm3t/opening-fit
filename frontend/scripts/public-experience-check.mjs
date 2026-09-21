import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixturePlugin } from './fixtures/account-fixture-plugin.mjs';
import { DEFAULT_BILLING_CONFIGURATION } from '../src/lib/premiumExperience.js';
import { guideSeoPages } from '../src/content/seoPages.js';

const output = path.resolve('../.release-build/ui-stage4');
await mkdir(output, { recursive: true });
const server = await createServer({ plugins: [fixturePlugin], server: { host: '127.0.0.1', port: 4189, strictPort: true }, logLevel: 'error' });
await server.listen();
const origin = 'http://127.0.0.1:4189';
const browser = await chromium.launch();
const results = [];
async function open(route, width, theme, plan = null) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.setDefaultTimeout(12000);
  await page.addInitScript(({ theme, plan }) => { window.__accountFixture = { signedOut: !plan, plan: plan || 'free' }; localStorage.setItem('openingFit:theme', theme); }, { theme, plan });
  await page.route('**/*', request => {
    const url = request.request().url();
    if (url.includes('/api/billing/config')) return request.fulfill({ json: DEFAULT_BILLING_CONFIGURATION });
    if (!url.startsWith(origin)) return request.abort();
    return request.continue();
  });
  await page.goto(origin + route);
  await page.locator('h1').first().waitFor();
  return page;
}
try {
  const widths = process.env.PUBLIC_QUICK ? [390, 1280] : [360, 390, 768, 1280, 1440];
  const routes = process.env.PUBLIC_LOGIN_ONLY ? ['/login'] : ['/', '/login', '/premium', '/pricing', '/how-it-works', '/about', '/guides'];
  for (const theme of ['dark', 'light']) for (const width of widths) for (const route of routes) {
    console.log(`Checking ${route}/${theme}/${width}`);
    const page = await open(route, width, theme);
    await page.waitForTimeout(150);
    assert.equal(new URL(page.url()).pathname, route, 'Public destination remains accessible');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, `${route}/${theme}/${width}: overflow`);
    assert.equal(await page.locator('.publicFooter').count(), 1);
    if (route === '/') {
      assert.equal(await page.locator('.homepageSampleDisclaimer').isVisible(), true);
      assert.equal(await page.locator('.publicGamesAnalysedMetric').count(), 0);
      const field = await page.locator('.heroUsernameField input').boundingBox();
      await page.screenshot({ path: path.join(output, `${theme}-${width}-home.png`), fullPage: true });
      assert.ok(field.y < 900, 'Username is near the top');
      await page.locator('.landingAdvancedOptions summary').click();
      await page.getByLabel('Months to import').selectOption('1');
      assert.match(await page.locator('.landingAdvancedOptions summary').innerText(), /30 days/);
      assert.equal(await page.getByLabel('Months to import').locator('option[value="12"]').isDisabled(), true);
      await page.getByRole('button', { name: 'Lichess', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Lichess', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: 'Analyse games', exact: true }).click();
      await page.locator('.importStatusBox[role=alert]').waitFor();
      assert.match(await page.locator('.importStatusBox').innerText(), /username/i);
    }
    if (route === '/login') {
      await page.locator('.accountAuthStack').waitFor();
      const heading = await page.locator('.accountPanelHeader').boundingBox();
      const authForm = await page.locator('.accountAuthStack').boundingBox();
      assert.ok(authForm.y >= heading.y + heading.height, 'Login uses a readable single column at every width');
      assert.equal(await page.getByRole('button', { name: 'Continue with Google' }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Email me a passwordless login link' }).count(), 1);
      await page.getByRole('button', { name: 'Email me a passwordless login link' }).click();
      assert.match(await page.locator('.accountAuthStatus').innerText(), /Enter your email first/);
      await page.getByRole('tab', { name: 'Create account' }).click();
      await page.getByLabel('Confirm password', { exact: true }).waitFor();
      assert.equal(await page.locator('form form').count(), 0);
      await page.screenshot({ path: path.join(output, `${theme}-${width}-login.png`), fullPage: true });
    }
    if (route === '/premium') {
      await page.getByRole('button', { name: 'Subscription checkout unavailable' }).waitFor();
      assert.match(await page.locator('.publicPricingContent').innerText(), /4.99/);
      assert.equal(await page.getByRole('button', { name: 'Subscription checkout unavailable' }).isDisabled(), true);
    }
    if (['/premium', '/about', '/guides', '/how-it-works'].includes(route)) await page.screenshot({ path: path.join(output, `${theme}-${width}-${route.slice(1)}.png`), fullPage: true });
    if (width === 390) {
      const trigger = page.getByRole('button', { name: 'Open OpeningFit menu' });
      await trigger.click();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement?.classList.contains('appPrimaryMenuToggle'));
      await trigger.click();
      await page.locator('.appPrimaryMobileTheme').click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme === 'dark' ? 'light' : 'dark');
      await page.keyboard.press('Escape');

    }
    if (width === 1280) {
      await page.locator('.appPrimaryTheme button').click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme === 'dark' ? 'light' : 'dark');
      assert.equal(await page.locator('.appPrimaryTheme button').evaluate(el => getComputedStyle(el).position), 'static');
    }
    results.push(`${route}/${theme}/${width}`);

    await page.close();
  }
  if (!process.env.PUBLIC_LOGIN_ONLY) {
  for (const theme of ['dark', 'light']) {
    for (const width of [390, 640, 720, 1280]) {
      const page = await open(`/guides/${guideSeoPages[0].slug}`, width, theme);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.match(await page.locator('link[rel=canonical]').getAttribute('href'), new RegExp(`/guides/${guideSeoPages[0].slug}$`));
      await page.screenshot({ path: path.join(output, `${theme}-${width}-guide.png`), fullPage: true });
      results.push(`Guide article/${theme}/${width}`);
      await page.close();
    }
    for (const plan of ['free', 'monthly_subscription', 'annual_subscription', 'lifetime']) {
      const page = await open('/premium', 390, theme, plan);
      await page.locator('.subscriptionPlanGrid').first().waitFor();
      assert.match(await page.locator('.publicPricingContent').innerText(), plan === 'lifetime' ? /Lifetime access active/ : plan !== 'free' ? /OpeningFit Plus active/ : /Subscription checkout unavailable/);
      assert.equal(await page.locator('.premiumCheckoutBtn').isDisabled(), true);
      results.push(`Pricing ${plan}/${theme}`);
      await page.close();
    }
  }
  for (const platform of ['Chess.com', 'Lichess']) {
    const page = await open('/', 390, 'dark');
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    await page.route('**/api/analysis/jobs', async route => {
      await pending;
      return route.fulfill({ status: 422, json: { detail: 'No public games found for this username.' } });
    });
    await page.getByRole('button', { name: platform, exact: true }).click();
    await page.locator('.heroUsernameField input').fill('FixtureMissingGames');
    await page.getByRole('button', { name: 'Analyse games', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`Analysing ${platform}`) }).waitFor();
    assert.equal(await page.locator('.heroUsernameField input').isDisabled(), true);
    release();
    await page.locator('.importStatusBox[role=alert]').waitFor();
    assert.equal(await page.locator('.heroUsernameField input').isDisabled(), false);
    assert.equal(await page.locator('.primaryReportSummary').count(), 0);
    results.push(`${platform} pending and failed import, no false report`);
    await page.close();
  }
  }
  await writeFile(path.join(output, process.env.PUBLIC_LOGIN_ONLY ? 'login-results.json' : 'results.json'), JSON.stringify(results, null, 2));
  console.log(`PASS ${results.length} public route/theme/layout checks plus import, keyboard, login and unavailable checkout checks`);
} finally { await browser.close(); await server.close(); }
