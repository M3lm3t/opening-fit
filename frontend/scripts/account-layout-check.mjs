import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { fixturePlugin } from "./fixtures/account-fixture-plugin.mjs";
const output = path.resolve('../.release-build/ui-stage2');
await mkdir(output, { recursive: true });
const server = await createServer({ plugins: [fixturePlugin], server: { host: '127.0.0.1', port: 4186, strictPort: true }, logLevel: 'error' });
await server.listen();
const origin = 'http://127.0.0.1:4186';
const browser = await chromium.launch({ headless: true });
const baseline = process.env.ACCOUNT_BASELINE === '1';
try {
  const results = [];
  async function openFixture(config, theme = 'dark', width = 1280) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.addInitScript(({ config, theme }) => {
      window.__accountFixture = config;
      localStorage.setItem('openingFit:theme', theme);
    }, { config, theme });
    await page.goto(`${origin}/account`);
    await page.locator(config.signedOut ? '.accountAuthStack' : '.accountHub').waitFor({ timeout: 30000 });
    return { page, errors };
  }
  async function checkLayout(page, label) {
    const issues = await page.locator('.accountHub').evaluate(root => {
      const failures = [];
      const viewport = document.documentElement.clientWidth;
      for (const el of root.querySelectorAll('h1,h2,p,label,input,button,small,strong,summary,fieldset')) {
        if (!el.getClientRects().length) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width && (rect.left < -1 || rect.right > viewport + 1)) failures.push(`${el.tagName}.${el.className}: outside viewport (${rect.left},${rect.right})`);
      }
      return failures;
    });
    if (issues.length) await writeFile(path.join(output, 'overflow.json'), JSON.stringify(await page.locator('.accountHub').evaluate(root => [...root.querySelectorAll('h2')].map(el => {
      const nodes = []; let node = el;
      while (node) { const css = getComputedStyle(node); nodes.push({ tag: node.tagName, classes: node.className, width: css.width, minWidth: css.minWidth, padding: css.padding, boxSizing: css.boxSizing, grid: css.gridTemplateColumns, rect: node.getBoundingClientRect().toJSON() }); node = node.parentElement; }
      return nodes;
    })), null, 2));
    assert.deepEqual(issues, [], label);
    const contrast = await page.locator('.accountHub').evaluate(root => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const rgba = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); const c = [...ctx.getImageData(0, 0, 1, 1).data]; c[3] /= 255; return c; };
      const luminance = rgb => rgb.slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
      return [...root.querySelectorAll('.accountIdentity p:not(.eyebrow),.accountIdentity small,.simpleProfileCard > p,.accountLabel,.accountLoginStatusCard small,.accountSectionNav button')].filter(el => el.getClientRects().length).map(el => {
        const ancestors = []; for (let node = el; node; node = node.parentElement) ancestors.unshift(node);
        const bg = ancestors.reduce((base, node) => { const c = rgba(getComputedStyle(node).backgroundColor); return c.slice(0, 3).map((v, i) => v * c[3] + base[i] * (1 - c[3])); }, [255, 255, 255]);
        const fg = rgba(getComputedStyle(el).color);
        const a = luminance(fg), b = luminance(bg);
        return { text: el.textContent.slice(0, 45), ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), color: getComputedStyle(el).color, bg };
      }).filter(row => row.ratio < 4.5);
    });
    assert.deepEqual(contrast, [], `${label}: important text contrast`);
    results.push(label);
  }
  if (!baseline) {
    for (const theme of (process.env.ACCOUNT_QUICK ? ['dark'] : ['dark', 'light'])) {
      for (const width of (process.env.ACCOUNT_QUICK ? [768] : [360, 390, 768, 1280, 1440])) {
        for (const variant of ['empty-free', 'long-paid']) {
          const { page, errors } = await openFixture({ empty: variant === 'empty-free', long: variant === 'long-paid', plan: variant === 'long-paid' ? 'monthly_subscription' : 'free' }, theme, width);
          await page.getByLabel('Chess.com username', { exact: true }).waitFor();
          assert.equal(await page.locator('.accountHub h1').innerText(), 'Account');
          assert.equal(await page.locator('.simpleProfileSideColumn').count(), 0, 'No stretched empty stats');
          const padding = await page.locator('.simpleProfileCard').evaluate(el => parseFloat(getComputedStyle(el).paddingLeft));
          assert.equal(padding, width < 768 ? 18 : 24);
          if (variant === 'long-paid') assert.match(await page.locator('.accountIdentity').innerText(), /Chess.com: Alexandra/);
          for (const tab of ['Profile', 'Preferences', 'Membership', 'Data & support']) {
            await page.getByRole('tab', { name: tab, exact: true }).click();
            await page.locator('[role="tabpanel"]', { has: page.locator(':visible') }).first().waitFor();
            await page.screenshot({ path: path.join(output, `${theme}-${width}-${variant}-${tab.replaceAll(/[^a-z]/gi, '')}.png`), fullPage: true });
            await checkLayout(page, `${theme}/${width}/${variant}/${tab}`);
          }
          await page.getByRole('tab', { name: 'Profile', exact: true }).click();
          if (width >= 1280) {
            // Browser zoom halves the CSS layout viewport; CSS `zoom` alone does
            // not update media queries and is not an equivalent responsive test.
            await page.setViewportSize({ width: width / 2, height: 450 });
            for (const tab of ['Profile', 'Preferences', 'Membership', 'Data & support']) {
              await page.getByRole('tab', { name: tab, exact: true }).click();
              await checkLayout(page, `${theme}/${width}/${variant}/${tab}/200-percent-zoom`);
            }
          }
          assert.deepEqual(errors, []);
          await page.close();
        }
      }
    }
    const { page, errors } = await openFixture({ plan: 'free', empty: true });
    const chess = page.getByLabel('Chess.com username', { exact: true });
    await chess.fill('  MyChessName  ');
    await page.getByText('Unsaved changes', { exact: true }).waitFor();
    await page.evaluate(() => window.__accountTest.refresh());
    assert.equal(await chess.inputValue(), '  MyChessName  ', 'Cloud refresh must not erase edits');
    await page.evaluate(() => { window.__accountTest.holdSave = true; });
    await page.getByRole('button', { name: 'Save account', exact: true }).click();
    await page.waitForFunction(() => Boolean(window.__accountTest.releaseSave));
    assert.equal(await chess.isDisabled(), true);
    await page.evaluate(() => { window.__accountTest.holdSave = false; window.__accountTest.releaseSave(); });
    await page.getByText('Account saved.', { exact: true }).waitFor();
    assert.equal(await chess.inputValue(), 'MyChessName');
    assert.equal(await page.evaluate(() => window.__accountTest.writes.at(-1).patch.chesscom_username), 'MyChessName');
    await chess.fill('RetryName');
    assert.equal(await page.getByText('Account saved.', { exact: true }).count(), 0);
    await page.evaluate(() => { window.__accountTest.failSave = true; });
    await page.getByRole('button', { name: 'Save account', exact: true }).click();
    await page.getByText('Fixture save failed. Your changes have not been saved.', { exact: true }).waitFor();
    assert.equal(await chess.inputValue(), 'RetryName');
    await page.evaluate(() => { window.__accountTest.failSave = false; window.__accountTest.failRefresh = true; });
    await page.getByRole('button', { name: 'Save account', exact: true }).click();
    await page.getByText(/Your usernames were sent, but the cloud refresh/).waitFor();
    assert.equal(await page.getByText('Account saved.', { exact: true }).count(), 0);
    await page.evaluate(() => { window.__accountTest.failRefresh = false; });
    await page.getByRole('button', { name: 'Save account', exact: true }).click();
    await page.getByText('Account saved.', { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Preferences', exact: true }).click();
    await page.locator('.coachingReminderSettings summary').click();
    await page.evaluate(() => {
      window.Notification.requestPermission = async () => 'granted';
      window.__accountTest.failSave = true;
    });
    await page.getByLabel('Enable reminders', { exact: true }).check();
    await page.getByRole('button', { name: 'Retry reminder save' }).waitFor();
    assert.equal(await page.getByText('Reminders enabled.', { exact: true }).count(), 0);
    await page.evaluate(() => { window.__accountTest.failSave = false; });
    await page.getByRole('button', { name: 'Retry reminder save' }).click();
    await page.getByText('Reminder preferences saved.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Enable reminders', { exact: true }).isChecked(), true);
    assert.ok(await page.evaluate(() => window.__accountTest.writes.at(-1).patch.permission_requested_at), 'Retry preserves permission request timestamp');
    await page.getByLabel('Weekly plan', { exact: true }).uncheck();
    await page.getByText('Reminder preferences saved.', { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Data & support', exact: true }).click();
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete my account', exact: true }).click();
    assert.equal(await page.locator('.accountHub').count(), 1, 'Canceled deletion retains account');
    assert.deepEqual(errors, []);
    results.push('save: draft/refresh/pending/success/failure/retry; reminder failure/retry; canceled deletion');
    await page.close();
    for (const config of [{ loading: true }, { error: true }, { history: true }, { ineligible: true }, { plan: 'lifetime' }, { plan: 'annual_subscription' }, { signedOut: true }]) {
      const { page, errors } = await openFixture(config);
      if (config.signedOut) assert.equal(await page.locator('.accountHub').count(), 0);
      else {
        if (config.history) {
          await page.locator('.simpleProfileSideColumn').waitFor();
          assert.match(await page.locator('.simpleProfileCard--stats').innerText(), /Training completed\s+1/i);
          const [form, stats] = await Promise.all([page.locator('.simpleProfileCard--account').boundingBox(), page.locator('.simpleProfileCard--stats').boundingBox()]);
          assert.ok(stats.x > form.x + form.width, 'History supports two desktop columns');
          await page.setViewportSize({ width: 360, height: 900 });
          const mobileForm = await page.locator('.simpleProfileCard--account').boundingBox();
          const mobileStats = await page.locator('.simpleProfileCard--stats').boundingBox();
          assert.ok(mobileStats.y >= mobileForm.y + mobileForm.height, 'History stacks on mobile');
        }
        if (config.ineligible) {
          await page.getByRole('tab', { name: 'Preferences', exact: true }).click();
          assert.equal(await page.locator('.coachingReminderSettings').count(), 0, 'No reminder prompt before eligibility');
        }
        if (config.loading) assert.equal(await page.getByLabel('Chess.com username', { exact: true }).isDisabled(), true);
        if (config.error) await page.getByText('Profile loaded with limited cloud data').waitFor();
        if (config.plan) {
          await page.getByRole('tab', { name: 'Membership', exact: true }).click();
          await page.locator('.accountSubscriptionCard').waitFor();
          assert.match(await page.locator('.accountSubscriptionCard').innerText(), config.plan === 'lifetime' ? /Lifetime/ : /Annual/i);
        }
        await checkLayout(page, JSON.stringify(config));
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(`PASS ${results.length} layout/state checks using actual React components and isolated services`);
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.addInitScript(() => { window.__accountFixture = { long: true, plan: 'free' }; localStorage.setItem('openingFit:theme', 'dark'); });
  await page.goto(`${origin}/account`);
  await page.getByLabel('Chess.com username', { exact: true }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(output, baseline ? 'baseline-desktop.png' : 'desktop.png'), fullPage: true });
  await writeFile(path.join(output, 'account-dom.txt'), await page.locator('.accountHub').innerText());
  await writeFile(path.join(output, 'styles.json'), JSON.stringify(await page.locator('.accountHub').evaluate(el => [el,el.parentElement,el.querySelector('h1'),el.querySelector('.simpleProfileCard')].map(node => ({classes:node.className,rules:[...document.styleSheets].flatMap(sheet=>{try{return [...sheet.cssRules]}catch{return []}}).flatMap(rule=>rule.cssRules?.length?[...rule.cssRules]:[rule]).filter(rule=>{try{return rule.selectorText&&node.matches(rule.selectorText)}catch{return false}}).map(rule=>rule.cssText)}))),null,2));
  assert.deepEqual(errors, []);
  console.log('PASS real Account/Profile components rendered with isolated local service fixtures');
} finally { await browser.close(); await server.close(); }
