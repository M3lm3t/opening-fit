import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MELMET_REGRESSION_FIXTURE } from '../src/lib/fixtures/melmetRegressionFixture.js';

const root = path.resolve('dist');
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, `.${pathname.includes('.') ? pathname : '/index.html'}`);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const bytes = await readFile(file);
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(`${origin}/report/sample`);
    await page.locator('.primaryReportHealth').waitFor();
    const health = await page.locator('.primaryReportHealth').innerText();
    assert.match(health, /83\/100/);
    assert.match(health, /All core roles covered/);
    assert.match(health, /Overall Evidence Confidence: Sufficient evidence/);
    assert.doesNotMatch(health, /need more qualifying games|performing well overall/);
    await page.getByRole('tab', { name: 'Priorities', exact: true }).click();
    await page.locator('.primaryReportPriorities').waitFor();
    assert.match(await page.locator('[data-command-role="keep"]').innerText(), /66.7% score/);
    assert.match(await page.locator('[data-command-role="repair"]').innerText(), /37.5% score/);
    await page.getByRole('tab', { name: 'Repertoire', exact: true }).click();
    await page.locator('#report-repertoire-view').waitFor();
    assert.match(await page.locator('#report-repertoire-view').innerText(), /Queen.s Gambit Declined/);
    await page.getByRole('tab', { name: 'Evidence', exact: true }).click();
    const vienna = page.locator('.compactEvidenceTable tbody tr').filter({ hasText: 'Vienna Game' });
    await vienna.waitFor();
    assert.match(await vienna.innerText(), /66.7%/);
    await page.locator('.reportHistoryDisclosure > summary').click();
    assert.doesNotMatch(await page.locator('.openingScoreBreakdown').innerText(), /72%/);
    assert.match(await page.locator('.openingScoreBreakdown').innerText(), /66.7% opening score across 18 games/);
    await page.locator('.reportToolsDisclosure > summary').click();
    assert.match(await page.locator('#share-report pre').textContent(), /Illustrative example.*Fictional data/);
    assert.match(await page.locator('#share-report pre').textContent(), /Verdict: Repair/);
    assert.doesNotMatch(await page.locator('body').innerText(), /canonical report decision|Legacy fit estimate|repertoire_health_v2/);
    await page.getByRole('button', { name: 'View evidence for Vienna Game', exact: false }).click();
    await page.getByRole('region', { name: 'Requested opening evidence' }).waitFor();
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('.appCrashFallback').count(), 0);
    console.log(`PASS sample report: Summary, Priorities, Repertoire, Evidence, share and evidence handoff (${width}px)`);
    await page.close();
  }
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.addInitScript(report => localStorage.setItem('openingFit:lastAnalysis', JSON.stringify({ analysis: report, username: report.username, platform: 'chess.com' })), MELMET_REGRESSION_FIXTURE);
  await page.goto(`${origin}/report#report-evidence`);
  await page.locator('.reportToolsDisclosure > summary').click();
  await page.locator('#share-report pre').waitFor();
  assert.doesNotMatch(await page.locator('#share-report pre').textContent(), /Fictional data|Example Player/);
  assert.equal(await page.locator('.appCrashFallback').count(), 0);
  console.log('PASS restored real-report fixture: share stays separate from sample');
  await page.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
