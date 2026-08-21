import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildMobileNavigationItems, isMobileNavigationItemActive } from "./mobileNavigation.js";
import { getAppSection } from "../appNavigation.js";
import { canonicalAppDestination } from "./reportViews.js";

const labels = (options) => buildMobileNavigationItems(options).map((item) => item.label);

test("web and native navigation always use the same four primary destinations", () => {
  for (const options of [
    {},
    { nativeApp: true, authenticated: false, entitlementState: "loading" },
    { nativeApp: true, authenticated: true, entitlement: { hasPremiumAccess: true }, entitlementState: "ready" },
    { authenticated: true, entitlement: { hasPremiumAccess: false }, entitlementState: "error" },
  ]) {
    assert.deepEqual(labels(options), ["Home", "Report", "Train", "Account"]);
  }
});

test("removed destinations resolve inside Report or Account", () => {
  assert.deepEqual(canonicalAppDestination("repertoire"), {
    key: "repertoire", view: "report", path: "/report", reportView: "repertoire", target: "report-repertoire-view",
  });
  assert.equal(canonicalAppDestination("progress").path, "/account");
  assert.equal(canonicalAppDestination("progress").target, "account-progress");
  assert.equal(getAppSection("repertoire"), "report");
  assert.equal(getAppSection("progress"), "profile");
});

test("Account owns progress, history and membership active states", () => {
  const account = buildMobileNavigationItems().find((item) => item.key === "account");
  for (const view of ["account", "profile", "login", "history", "progress", "premium", "upgrade"]) {
    assert.equal(isMobileNavigationItemActive(account, view, getAppSection(view)), true);
  }
});

test("the bottom navigation consumes canonical destinations without duplicate account UI", () => {
  const component = fs.readFileSync(fileURLToPath(new URL("../components/MobileBottomNav.jsx", import.meta.url)), "utf8");
  assert.match(component, /buildMobileNavigationItems/);
  assert.match(component, /canonicalAppDestination/);
  assert.doesNotMatch(component, /AccountPanel/);
  assert.doesNotMatch(component, /key === "repertoire"|key === "progress"|key === "premium"/);
});
