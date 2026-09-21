import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixturePlugin } from './fixtures/account-fixture-plugin.mjs';
import { MELMET_REGRESSION_FIXTURE } from '../src/lib/fixtures/melmetRegressionFixture.js';

const output = path.resolve('../.release-build/ui-stage3');
await mkdir(output, { recursive: true });
const before = process.env.REPORT_BEFORE === '1';
const server = await createServer({ plugins: [fixturePlugin], server: { host: '127.0.0.1', port: 4188, strictPort: true }, logLevel: 'error' });
await server.listen();
const origin = 'http://127.0.0.1:4188';
const browser = await chromium.launch({ headless: true });
const pendingReleases = new Set();
async function openPage({ width = 1280, theme = 'dark', report = null, plan = 'free', entry = '/report/sample', slow = false, fail = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  pendingReleases.add(release);
  let requested = 0;
  let failRequest = fail;
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(origin)) return route.abort();
    if (url.includes('/components/MyRepertoire.jsx')) {
      requested++;
      if (slow) await pending;
      if (failRequest) return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(({ theme, report, plan }) => {
    window.__accountFixture = { plan };
    localStorage.setItem('openingFit:theme', theme);
    if (report) localStorage.setItem('openingFit:lastAnalysis', JSON.stringify({ analysis: report, username: report.username, platform: 'chess.com' }));
  }, { theme, report, plan });
  await page.goto(`${origin}${entry}`, { waitUntil: slow ? 'commit' : 'domcontentloaded' });
  return { page, errors, release, recover: () => { failRequest = false; }, requests: () => requested };
}
try {
  const { page, release, requests } = await openPage({ slow: true });
  await page.locator('.primaryReportHealth').waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(output, before ? 'before-summary.png' : 'after-summary.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Repertoire', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.routeLoadingFallback,.contentLoadingState'));
  const rootFallback = await page.locator('.routeLoadingFallback').isVisible();
  await page.screenshot({ path: path.join(output, before ? 'before-loading.png' : 'after-loading.png'), fullPage: true });
  await writeFile(path.join(output, before ? 'before-loading.json' : 'after-loading.json'), JSON.stringify({ rootFallback, lazyRequests: requests() }));
  assert.equal(rootFallback, before, 'Ordinary report navigation must retain the app shell after the fix');
  if (!before) {
    assert.equal(await page.locator('.appPrimaryNav').isVisible(), true);
    assert.equal(await page.getByRole('tab', { name: 'Summary', exact: true }).isVisible(), true);
    await page.locator('.reportRepertoireManagement summary').click();
    await page.locator('.contentLoadingState').waitFor();
    await page.screenshot({ path: path.join(output, 'after-local-loading.png'), fullPage: true });
  }
  release();
  await page.locator('#report-repertoire-view').waitFor();
  await page.getByRole('tab', { name: 'Evidence', exact: true }).click();
  await page.locator('.compactEvidenceTable').waitFor();
  await page.screenshot({ path: path.join(output, before ? 'before-evidence.png' : 'after-evidence.png'), fullPage: true });
  await page.close();
  console.log(`${before ? 'REPRODUCED' : 'PASS'} slow lazy repertoire navigation: root fallback=${rootFallback}, requests=${requests()}`);
  if (!before) {
    const results = [];
    async function checkLayout(page, label) {
      const issues = await page.locator('.of-report-layout').evaluate(root => {
        const viewport = document.documentElement.clientWidth;
        return [...root.querySelectorAll('h1,h2,h3,p,button,select,summary')].filter(el => el.checkVisibility() && !el.closest('.compactEvidenceTableWrap')).flatMap(el => {
          const r = el.getBoundingClientRect();
          return r.width && (r.left < -1 || r.right > viewport + 1) ? [`${el.tagName}.${el.className} ${el.textContent.slice(0, 30)}: ${r.left}..${r.right}`] : [];
        });
      });
      assert.deepEqual(issues, [], label);
      results.push(label);
    }
    for (const theme of (process.env.REPORT_QUICK ? ['dark'] : ['dark', 'light'])) for (const width of (process.env.REPORT_QUICK ? [390] : [360, 390, 768, 1280, 1440])) for (const kind of ['sample-free', 'real-paid']) {
      const { page, errors } = await openPage({ width, theme, report: kind === 'real-paid' ? MELMET_REGRESSION_FIXTURE : null, plan: kind === 'real-paid' ? 'monthly_subscription' : 'free', entry: kind === 'real-paid' ? '/report' : '/report/sample' });
      await page.locator('.primaryReportHealth').waitFor();
      assert.ok((await page.locator('.reportPageTitle').boundingBox()).height > 20, 'Player identity is visible');
      if (kind === 'sample-free') assert.match(await page.locator('.primaryReportHealth').innerText(), /83\/100/);
      const cta = page.locator('[data-primary-training-cta="true"]');
      const action = await cta.count() ? await cta.innerText() : null;
      if (width >= 1280 && action) assert.ok((await cta.boundingBox()).y < 900, 'Next action starts in the desktop viewport');
      for (const tab of ['Summary', 'Priorities', 'Repertoire', 'Evidence']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await page.locator(`#report-${tab.toLowerCase()}-view`).waitFor();
        await page.screenshot({ path: path.join(output, `${theme}-${width}-${kind}-${tab}.png`), fullPage: true });
        await checkLayout(page, `${theme}/${width}/${kind}/${tab}`);
        assert.equal(await page.locator('.routeLoadingFallback').count(), 0);
        if (tab === 'Priorities' && action) assert.equal(await page.locator('[data-primary-training-cta="true"]').innerText(), action, 'Same training handoff in both views');
        if (tab === 'Evidence') {
          const table = page.locator('.compactEvidenceTableWrap');
          if (await table.count()) {
            assert.equal(await table.getAttribute('tabindex'), '0');
            assert.ok((await table.locator('thead').boundingBox()).height > 20, 'Table column headers remain visible');
            assert.ok((await table.locator('tbody tr').first().boundingBox()).height < 200, 'Rows stay content-driven without stretched empty panels');
            if (width < 768) assert.ok(await table.evaluate(el => el.scrollWidth > el.clientWidth), 'Mobile table has intentional horizontal scrolling');
          }
        }
      }
      await page.goBack();
      await page.locator('#report-repertoire-view').waitFor();
      await page.goForward();
      await page.locator('#report-evidence-view').waitFor();
      await page.reload();
      await page.locator('#report-evidence-view').waitFor();
      await page.locator('.reportToolsDisclosure > summary').click();
      await page.locator('#share-report pre').waitFor();
      const share = await page.locator('#share-report pre').textContent();
      if (kind === 'sample-free') assert.match(share, /Fictional data/);
      else assert.doesNotMatch(share, /Fictional data|Example Player/);
      await checkLayout(page, `${theme}/${width}/${kind}/report-tools`);
      assert.deepEqual(errors, []);
      await page.close();
    }
    const low = { analysisCompleted: true, username: 'Limited sample', totalGames: 3, gamesAnalysed: 3, topOpenings: [{ name: 'Vienna Game', games: 3, wins: 1, draws: 1, losses: 1 }] };
    const long = structuredClone(MELMET_REGRESSION_FIXTURE);
    long.username = 'Alexandra-Margaret With A Long Player Name';
    for (const row of long.reportDecision.recommendations) { row.openingName = row.opening = `${row.openingName || row.opening} with a very long recorded variation and descriptive continuation`; }
    for (const theme of ['dark', 'light']) for (const report of [low, long]) {
      const { page, errors } = await openPage({ report, entry: '/report#report-repertoire', theme, width: 390 });
      await page.locator('#report-repertoire-view').waitFor();
      await checkLayout(page, `${theme}/${report.username}/direct-entry`);
      await page.getByRole('tab', { name: 'Summary', exact: true }).click();
      await checkLayout(page, `${theme}/${report.username}/summary`);
      await page.getByRole('tab', { name: 'Priorities', exact: true }).click();
      await checkLayout(page, `${theme}/${report.username}/priorities`);
      assert.deepEqual(errors, []);
      await page.close();
    }
    const failed = await openPage({ fail: true });
    console.log('Checking failed-module recovery');
    await failed.page.locator('.primaryReportHealth').waitFor();
    await failed.page.getByRole('tab', { name: 'Repertoire', exact: true }).click();
    await failed.page.locator('.reportRepertoireManagement summary').click();
    await failed.page.locator('.contentLoadError').waitFor();
    assert.equal(await failed.page.locator('.appPrimaryNav').isVisible(), true);
    assert.equal(await failed.page.locator('.appCrashFallback').count(), 0);
    assert.equal(failed.requests(), 1, 'Failed module is not requested repeatedly');
    failed.recover();
    await failed.page.screenshot({ path: path.join(output, 'failed-local-module.png'), fullPage: true });
    await failed.page.getByRole('button', { name: 'Reload this page', exact: true }).click();
    await failed.page.locator('#report-repertoire-view').waitFor();
    await failed.page.locator('.reportRepertoireManagement summary').click();
    await failed.page.locator('.contentLoadError').waitFor({ state: 'detached' });
    await failed.page.locator('.contentLoadingState').waitFor({ state: 'detached' });
    console.log('PASS explicit reload recovered the failed module');
    await failed.page.getByRole('tab', { name: 'Summary', exact: true }).click();
    await failed.page.locator('.primaryReportHealth').waitFor();
    assert.equal(failed.requests(), 2, 'Explicit reload makes one new module request');
    await failed.page.close();
    results.push('Failed lazy request: local recovery and functioning report tabs');
    const direct = await openPage({ slow: true, entry: '/report/sample#report-repertoire' });
    console.log('Checking slow direct entry');
    await direct.page.locator('#report-repertoire-view').waitFor();
    assert.equal(await direct.page.locator('.appPrimaryNav').isVisible(), true);
    assert.equal(await direct.page.locator('.routeLoadingFallback').count(), 0);
    direct.release();
    await direct.page.getByRole('tab', { name: 'Evidence', exact: true }).click();
    await direct.page.locator('#report-evidence-view').waitFor();
    await writeFile(path.join(output, 'filter-controls.json'), JSON.stringify(await direct.page.locator('select').evaluateAll(els => els.map(el => ({ label: el.closest('label')?.textContent, ariaLabel: el.getAttribute('aria-label'), options: [...el.options].map(o => o.value) }))), null, 2));
    await direct.page.getByLabel('Colour', { exact: true }).selectOption('white');
    await direct.page.getByRole('tab', { name: 'Summary', exact: true }).click();
    await direct.page.getByRole('tab', { name: 'Evidence', exact: true }).click();
    assert.equal(await direct.page.getByLabel('Colour', { exact: true }).inputValue(), 'white');
    assert.equal(direct.requests(), 1);
    await direct.page.close();
    results.push('Slow direct entry retains shell; filter selection survives tab changes');
    const priority = await openPage();
    await priority.page.locator('.primaryReportHealth').waitFor();
    for (const width of [390, 1280]) {
      await priority.page.setViewportSize({ width, height: 900 });
      for (const count of [1, 2, 3]) {
        await priority.page.evaluate(async count => (await import('/scripts/fixtures/priority-cards.jsx')).renderPriorityCards(count), count);
        await priority.page.waitForFunction(count => document.querySelectorAll('.priorityLayoutFixture .primaryReportCommandGrid > article').length === count, count);
        const grid = priority.page.locator('.priorityLayoutFixture .primaryReportCommandGrid');
        const gridBox = await grid.boundingBox();
        const cards = await grid.locator(':scope > article').all();
        const lastBox = await cards.at(-1).boundingBox();
        assert.ok(Math.abs(lastBox.x + lastBox.width - gridBox.x - gridBox.width) < 2, 'No unused grid column');
        assert.equal(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').filter(track => parseFloat(track) > 0).length), width < 768 ? 1 : count);
        results.push(`${width}px/${count} genuine component priority cards`);
      }
    }
    await priority.page.close();
    await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(`PASS ${results.length} report layout, state, history and loading checks`);
  }
} catch (error) { console.error(error); throw error; }
finally { for (const release of pendingReleases) release(); await browser.close(); await server.close(); }
