import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildMobileNavigationItems, isMobileNavigationItemActive } from "./mobileNavigation.js";
import { APP_NAV_ROUTES, getAppSection, resolveOwnedProductRoute } from "../appNavigation.js";
import { resolvePremiumEntitlement } from "./premiumEntitlement.js";

const labels = (options) => buildMobileNavigationItems(options).map((item) => item.label);
const ready = (entitlement, authenticated = true) => ({ authenticated, entitlement, entitlementState: "ready" });

test("logged-out navigation offers Pricing only after auth resolution", () => {
  assert.deepEqual(labels(ready(resolvePremiumEntitlement(), false)), ["Report", "Repertoire", "Train", "Progress", "Pricing"]);
});

test("native logged-out navigation exposes Account and discovers Pricing after auth resolution", () => {
  assert.deepEqual(
    labels({ authenticated: false, entitlementState: "loading", nativeApp: true }),
    ["Report", "Repertoire", "Train", "Progress", "Account"],
  );
  assert.deepEqual(
    labels({ ...ready(resolvePremiumEntitlement(), false), nativeApp: true }),
    ["Report", "Repertoire", "Train", "Progress", "Account", "Pricing"],
  );
});

test("native paid navigation keeps Account without advertising an upgrade", () => {
  const premium = resolvePremiumEntitlement([{ access_type: "lifetime", status: "active" }]);
  assert.deepEqual(labels({ ...ready(premium), nativeApp: true }), ["Report", "Repertoire", "Train", "Progress", "Account"]);
});

test("native free navigation keeps Account and makes Plus explicit", () => {
  assert.deepEqual(
    labels({ ...ready(resolvePremiumEntitlement()), nativeApp: true }),
    ["Report", "Repertoire", "Train", "Progress", "Account", "Plus"],
  );
});

test("web and native Progress share the canonical progress route", () => {
  assert.deepEqual(APP_NAV_ROUTES.progress, { view: "progress", path: "/progress", target: "openingfit-progress", fallbackIds: ["profile"] });
  assert.equal(getAppSection("progress"), "progress");
  assert.equal(resolveOwnedProductRoute("/progress").view, "progress");
  for (const nativeApp of [false, true]) {
    const items = buildMobileNavigationItems({ ...ready(resolvePremiumEntitlement(), false), nativeApp });
    assert.equal(items.find((item) => item.key === "progress")?.label, "Progress");
  }
});

test("Progress and Account active states remain mutually exclusive", () => {
  const items = buildMobileNavigationItems({ ...ready(resolvePremiumEntitlement(), false), nativeApp: true });
  const progress = items.find((item) => item.key === "progress");
  const account = items.find((item) => item.key === "account");
  assert.equal(isMobileNavigationItemActive(progress, "progress", getAppSection("progress")), true);
  assert.equal(isMobileNavigationItemActive(account, "progress", getAppSection("progress")), false);
  assert.equal(isMobileNavigationItemActive(account, "account", getAppSection("account")), true);
  assert.equal(isMobileNavigationItemActive(progress, "account", getAppSection("account")), false);
});

test("a logged-in free user receives Plus and expired access returns to Plus", () => {
  assert.equal(labels(ready(resolvePremiumEntitlement())).at(-1), "Plus");
  const expired = resolvePremiumEntitlement([{ access_type: "annual_subscription", status: "expired", current_period_end: "2025-01-01T00:00:00Z" }]);
  assert.equal(expired.hasPremiumAccess, false);
  assert.equal(labels(ready(expired)).at(-1), "Plus");
});

test("active monthly and annual members receive Account instead of an upgrade", () => {
  for (const accessType of ["monthly_subscription", "annual_subscription"]) {
    const entitlement = resolvePremiumEntitlement([{ access_type: accessType, status: "active" }]);
    assert.equal(labels(ready(entitlement)).at(-1), "Account");
    assert.doesNotMatch(labels(ready(entitlement)).join(" "), /Plus|Premium|Upgrade|Pricing/);
  }
});

test("lifetime ownership receives Access without subscription wording", () => {
  const entitlement = resolvePremiumEntitlement([{ access_type: "lifetime", status: "active" }]);
  assert.equal(labels(ready(entitlement)).at(-1), "Access");
  assert.doesNotMatch(labels(ready(entitlement)).join(" "), /plan|subscription|upgrade|premium/i);
});

test("cancelled members remain members until authoritative access expires", () => {
  const now = Date.parse("2026-07-26T12:00:00Z");
  const current = resolvePremiumEntitlement([{ access_type: "annual_subscription", status: "canceled", current_period_end: "2026-08-01T00:00:00Z" }], { now });
  const ended = resolvePremiumEntitlement([{ access_type: "annual_subscription", status: "canceled", current_period_end: "2026-07-01T00:00:00Z" }], { now });
  assert.equal(labels(ready(current)).at(-1), "Account");
  assert.equal(labels(ready(ended)).at(-1), "Plus");
});

test("past-due navigation follows the canonical entitlement resolver", () => {
  const now = Date.parse("2026-07-26T12:00:00Z");
  const entitled = resolvePremiumEntitlement([{ access_type: "monthly_subscription", status: "past_due", premium_since: "2026-01-01T00:00:00Z", current_period_end: "2026-08-01T00:00:00Z" }], { now });
  const notEntitled = resolvePremiumEntitlement([{ access_type: "monthly_subscription", status: "past_due", current_period_end: "2026-08-01T00:00:00Z" }], { now });
  assert.equal(labels(ready(entitled)).at(-1), "Account");
  assert.equal(labels(ready(notEntitled)).at(-1), "Plus");
});

test("loading and failed entitlement requests never flash an upgrade destination", () => {
  for (const entitlementState of ["loading", "error"]) {
    assert.deepEqual(labels({ authenticated: true, entitlementState }), ["Report", "Repertoire", "Train", "Progress"]);
    assert.deepEqual(labels({ authenticated: false, entitlementState }), ["Report", "Repertoire", "Train", "Progress"]);
  }
});

test("a development preview flag cannot grant navigation entitlement", () => {
  const freeEntitlement = resolvePremiumEntitlement();
  const options = ready(freeEntitlement);
  options.isPremiumPreview = true;
  options.sessionPreview = true;
  assert.equal(labels(options).at(-1), "Plus");
});

test("the app passes protected entitlement state without preview access", () => {
  const app = fs.readFileSync(fileURLToPath(new URL("../App.jsx", import.meta.url)), "utf8");
  const component = fs.readFileSync(fileURLToPath(new URL("../components/MobileBottomNav.jsx", import.meta.url)), "utf8");
  const renderStart = app.indexOf("<MobileBottomNav");
  const render = app.slice(renderStart, app.indexOf("/>", renderStart) + 2);
  assert.match(render, /entitlement=\{entitlement\}/);
  assert.match(render, /entitlementState=\{mobileEntitlementState\}/);
  assert.doesNotMatch(render, /isPremium|Preview/);
  assert.match(app, /profileError \|\| restoreError\s*\? "error"/);
  assert.match(component, /buildMobileNavigationItems/);
  assert.match(component, /nativeApp: isNativeApp\(\)/);
  assert.match(component, /canonicalAppDestination/);
  assert.doesNotMatch(component, /view: "report", path: "\/report"/);
  assert.match(app, /<AccountPanel variant="screen"/);
  assert.equal((component.match(/AccountPanel/g) || []).length, 0);
});
