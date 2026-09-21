import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixturePlugin } from './fixtures/account-fixture-plugin.mjs';
import { MELMET_REGRESSION_FIXTURE } from '../src/lib/fixtures/melmetRegressionFixture.js';
import { DEFAULT_BILLING_CONFIGURATION } from '../src/lib/premiumExperience.js';
import { DEFAULT_PUBLIC_ANALYSIS_CONTRACT } from '../src/lib/productTransparency.js';

const out = path.resolve('../.release-build/ui-stage5');
await mkdir(out, { recursive: true });
const server = await createServer({ plugins: [fixturePlugin], server: { host: '127.0.0.1', port: 4193, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const origin = 'http://127.0.0.1:4193';
const results = [], issues = [];
const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const mission = { id: 'local-mission', status: 'learning', opening_name: 'A long opening name with a recurring exact position and a verified response', role: 'white_repertoire', position_fen: fen, player_turn: 'white', repeated_played_move_san: 'd4', accepted_correction_moves: [{ san: 'e4', uci: 'e2e4' }], baseline_evidence_count: 3, correction_source: 'active_repertoire_line', confidence: { level: 'high' } };
const session = { id: 'local-session', status: 'active', exerciseCount: 1, progress: { solvedCount: 0 }, currentExercise: { exerciseId: 'local-exercise', fen, sideToMove: 'white', boardOrientation: 'white', prompt: 'Find your prepared central move from this test position.' } };
async function pageFor({ width = 390, theme = 'dark', native = false, state = 'normal', entry = '/train', signedOut = false, report = true } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(12000);
  const errors = [];
  let historyRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (state.startsWith('mission') && url.includes('/api/')) console.log(`Fixture request: ${url.split('?')[0]}`);
    if (url.includes('/api/billing/config')) return route.fulfill({ json: DEFAULT_BILLING_CONFIGURATION });
    if (url.includes('/api/public/analysis-contract')) return route.fulfill({ json: DEFAULT_PUBLIC_ANALYSIS_CONTRACT });
    if (url.includes('/api/readiness')) return route.fulfill({ json: { status: 'ready', missions: state.startsWith('mission') ? 'enabled' : 'disabled' } });
    if (url.includes('/api/features/missions/eligibility')) return route.fulfill({ json: { enabled: true } });
    if (url.includes('/api/v1/missions/current')) return route.fulfill({ json: state === 'mission-empty' ? { reasonCode: 'no_trusted_candidate' } : state === 'mission-unavailable' ? { reasonCode: 'temporarily_unavailable' } : { mission } });
    if (url.includes('/api/v1/missions?')) {
      const failed = state === 'mission-history-error' && historyRequests++ === 0;
      return route.fulfill({ status: failed ? 503 : 200, json: failed ? { reasonCode: 'temporarily_unavailable' } : { missions: [], nextCursor: null } });
    }
    if (url.includes('/training/sessions/current')) return route.fulfill({ json: { session } });
    if (url.includes('/attempts')) return route.fulfill({ status: 503, json: { reasonCode: 'temporarily_unavailable' } });
    if (url.includes('/api/health')) return route.fulfill({ json: { status: 'ok' } });
    return url.startsWith(origin) ? route.continue() : route.abort();
  });
  await page.addInitScript(({ theme, native, state, signedOut, report }) => {
    window.__accountFixture = { signedOut, plan: 'monthly_subscription', long: true, empty: !report, mission: state.startsWith('mission') };
    localStorage.setItem('openingFit:theme', theme);
    localStorage.setItem('openingFit:trainingPreferences:v1', JSON.stringify({ status: 'skipped' }));
    if (report) localStorage.setItem('openingFit:lastAnalysis', JSON.stringify({ analysis: report, username: report.username, platform: 'chess.com' }));
    if (native) {
      window.CapacitorCustomPlatform = { name: 'android' };
      window.Capacitor = { PluginHeaders: [
        { name: 'App', methods: [{ name: 'getLaunchUrl', rtype: 'promise' }, { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] },
        { name: 'StatusBar', methods: ['setOverlaysWebView', 'setStyle', 'setBackgroundColor'].map(name => ({ name, rtype: 'promise' })) },
        { name: 'SplashScreen', methods: [{ name: 'hide', rtype: 'promise' }] }
      ], nativePromise: async () => ({}), nativeCallback: () => 'local-listener' };
    }
  }, { theme, native, state, signedOut, report: report ? MELMET_REGRESSION_FIXTURE : null });
  if (native) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 24, bottom: 24, left: 8, right: 8 } });
  }
  await page.goto(origin + entry, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('.appPrimaryNav').waitFor();
  return { page, errors };
}
async function layout(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label);
  assert.equal(await page.locator('.appPrimaryNav').count(), 1, 'One primary header');
  const animation = await page.evaluate(() => [...document.querySelectorAll('*')].filter(el => el.checkVisibility()).filter(el => getComputedStyle(el).animationName !== 'none' && getComputedStyle(el).animationDuration.split(',').some(n => parseFloat(n) > 0.001)).map(el => el.className));
  assert.deepEqual(animation, [], 'Reduced motion suppresses animations');
  results.push(label);
}
try {
  const widths = process.env.STATES_QUICK ? [390, 1280] : [360, 390, 768, 1280, 1440];
  for (const theme of ['dark', 'light']) for (const width of widths) {
    console.log(`Mission board ${theme}/${width}`);
    const { page, errors } = await pageFor({ theme, width, state: 'mission' });
    try { await page.locator('.missionBoard .chessPositionBoard').waitFor(); }
    catch (error) { await page.screenshot({ path: path.join(out, 'mission-missing.png'), fullPage: true }); console.log(await page.locator('body').innerText()); throw error; }
    const board = await page.locator('.missionBoard .chessPositionBoard').boundingBox();
    assert.ok(board.width >= 240 && Math.abs(board.width - board.height) < 3, 'Usable square mission board');
    await layout(page, `Mission board ${theme}/${width}`);
    const pawn = page.locator('.missionBoard').getByRole('button', { name: 'White pawn on e2', exact: true });
    await pawn.focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'White pawn on f2');
    await pawn.press('Enter');
    await page.locator('.missionBoard').getByRole('button', { name: 'Empty square e4', exact: true }).press('Enter');
    await page.locator('.missionError[role=alert]').waitFor();
    assert.equal(await page.getByText('Training complete', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(out, `mission-${theme}-${width}.png`), fullPage: true });
    await page.close();
  }
  for (const state of ['mission-empty', 'mission-unavailable', 'mission-history-error']) {
    const { page, errors } = await pageFor({ state, entry: state === 'mission-history-error' ? '/report' : '/dashboard' });
    if (state === 'mission-history-error') {
      await page.locator('.missionEvidencePanel').waitFor();
      await page.locator('.missionEvidencePanel').getByRole('button', { name: 'Past Missions', exact: true }).click();
      await page.locator('.missionEvidencePanel [role=alert]').waitFor();
      assert.deepEqual(errors, [], 'History failure is handled');
      assert.equal(await page.getByText('No past Missions yet.', { exact: true }).count(), 0, 'A failure is not an empty success');
      await page.getByRole('button', { name: 'Retry past Missions', exact: true }).click();
      await page.getByText('No past Missions yet.', { exact: true }).waitFor();
      assert.equal(await page.locator('.missionEvidencePanel [role=alert]').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Load more past Missions', exact: true }).count(), 0, 'No pagination without a cursor');
    } else await page.locator('.missionCard').first().waitFor();
    await layout(page, state);
    await page.close();
  }
  for (const theme of ['dark', 'light']) for (const width of widths) for (const entry of ['/analyse', '/report', '/train', '/account', '/premium']) {
    console.log(`Native bridge ${entry}/${theme}/${width}`);
    const { page, errors } = await pageFor({ theme, width, native: true, entry });
    await page.waitForTimeout(100);
    await layout(page, `Native bridge ${entry}/${theme}/${width}`);
    assert.equal(await page.locator('html.of-native-app').count(), 1);
    assert.ok(await page.locator('.mobileBottomNav').count() <= 1);
    if (width < 768 && await page.locator('.mobileBottomNav').isVisible()) assert.ok(await page.locator('.mobileBottomNav').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom)) >= 24, 'Simulated safe-area inset is retained');
    assert.deepEqual(errors, []);
    if (entry === '/analyse' && width === 390) {
      await page.setViewportSize({ width, height: 420 });
      const input = page.locator('.heroUsernameField input');
      await input.focus();
      await input.scrollIntoViewIfNeeded();
      const field = await input.boundingBox();
      const nav = await page.locator('.mobileBottomNav').boundingBox();
      if (nav && field.y + field.height > nav.y) issues.push({ state: `native-keyboard-${theme}`, issue: 'Focused input overlaps bottom navigation in reduced viewport', field, nav });
      await page.screenshot({ path: path.join(out, `native-keyboard-${theme}.png`), fullPage: false });
    }
    await page.close();
  }
  for (const width of [384, 640, 720]) for (const entry of ['/dashboard', '/train', '/report', '/account', '/login']) {
    const { page } = await pageFor({ width, entry, signedOut: entry === '/login' });
    await layout(page, `200% layout equivalent ${width * 2}px desktop/${entry}`);
    await page.close();
  }
  await writeFile(path.join(out, 'state-results.json'), JSON.stringify({ results, issues }, null, 2));
  console.log(`PASS ${results.length} state/native/reflow checks; ${issues.length} issues for review`);
  if (issues.length) process.exitCode = 1;
} finally { await browser.close(); await server.close(); }
