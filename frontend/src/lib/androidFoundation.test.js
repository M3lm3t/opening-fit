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
  assert.match(shell, /getLaunchUrl/);
  assert.match(shell, /if \(launch\?\.url\) await openAppUrl\(launch\.url\)/);
  assert.match(shell, /isAuthCallbackUrl/);
  assert.match(main, /await initializeNativeAppShell\(\)/);
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

test("production web assets associate the account callback with debug and Play-signed Android apps", async () => {
  const statements = JSON.parse(await read("../../public/.well-known/assetlinks.json"));
  const app = statements.find((statement) => statement?.target?.package_name === "com.openingfit.app");
  assert.deepEqual(app?.relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(app?.target?.namespace, "android_app");
  assert.deepEqual(app?.target?.sha256_cert_fingerprints, [
    "F1:6E:3F:28:75:D7:D0:2E:C4:59:B9:DF:61:DE:1F:74:28:12:44:A0:02:3A:01:58:48:FB:04:72:EB:22:86:AD",
    "AB:10:AF:11:49:4B:09:3A:9B:EE:67:03:C9:57:7F:0B:CB:C0:01:0D:56:73:51:7C:86:C7:5B:B3:4D:CB:F4:64",
  ]);
});
