import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Capacitor uses the bundled Vite output and production OpeningFit identity", async () => {
  const config = JSON.parse(await read("../../capacitor.config.json"));
  assert.equal(config.appId, "com.openingfit.app");
  assert.equal(config.appName, "OpeningFit");
  assert.equal(config.webDir, "dist");
  assert.equal(config.server?.url, undefined);
  assert.equal(config.server?.cleartext, false);
});

test("native API and authentication use secure production URLs", async () => {
  const api = await read("./apiBase.js");
  const auth = await read("./authRedirect.js");
  assert.match(api, /NATIVE_API_BASE_URL = "https:\/\/www\.openingfit\.com"/);
  assert.match(api, /if \(isNativeApp\(\)\) return NATIVE_API_BASE_URL/);
  assert.match(auth, /PRODUCTION_AUTH_ORIGIN = "https:\/\/www\.openingfit\.com"/);
  assert.match(auth, /exchangeCodeForSession/);
  assert.match(auth, /setSession/);
  assert.doesNotMatch(auth, /service.?role/i);
});

test("native landing keeps the mobile navigation available", async () => {
  const app = await read("../App.jsx");
  assert.match(app, /\(!isPublicLanding \|\| isNativeApp\(\)\)/);
  assert.match(app, /showMobileBottomNavigation \? <MobileBottomNav/);
});

test("native shell owns back handling, deep links, external links and the PWA guard", async () => {
  const shell = await read("./nativeAppShell.js");
  const external = await read("./externalNavigation.js");
  const main = await read("../main.jsx");
  assert.match(shell, /addListener\("backButton"/);
  assert.match(shell, /closeVisibleDialog/);
  assert.match(shell, /window\.history\.back\(\)/);
  assert.match(shell, /addListener\("appUrlOpen"/);
  assert.match(external, /Browser\.open/);
  assert.match(main, /isWebApp\(\).*serviceWorker/);
});

test("billing retains the canonical API and delegates only URL opening", async () => {
  const accountApi = await read("../accountApi.js");
  const billing = await read("./billingNavigation.js");
  assert.match(accountApi, /\/api\/account\/create-checkout-session/);
  assert.match(accountApi, /openSubscriptionCheckout\(data\.url\)/);
  assert.match(billing, /openExternalUrl/);
  assert.doesNotMatch(billing, /entitlement|premium.*flag|price/i);
});

test("Android release foundation stays HTTPS-only and permission-minimal", async () => {
  const manifest = await read("../../android/app/src/main/AndroidManifest.xml");
  const variables = await read("../../android/variables.gradle");
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(manifest, /android:host="www\.openingfit\.com"/);
  assert.deepEqual([...manifest.matchAll(/<uses-permission/g)].length, 1);
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(variables, /minSdkVersion = 24/);
  assert.match(variables, /compileSdkVersion = 36/);
  assert.match(variables, /targetSdkVersion = 36/);
});
