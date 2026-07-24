import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { accountExperienceState, subscriptionPresentation } from "./accountExperience.js";
import { HOME_NAVIGATION } from "../appNavigation.js";

const read = (relative) => fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

test("account experience separates loading, signed-out and authenticated states", () => {
  assert.equal(accountExperienceState({ authLoading: true }), "checking_session");
  assert.equal(accountExperienceState({ authHydrated: false }), "checking_session");
  assert.equal(accountExperienceState({ user: { id: "user-1" }, profileLoading: true }), "restoring_account");
  assert.equal(accountExperienceState({ user: null }), "signed_out");
  assert.equal(accountExperienceState({ user: { id: "user-1" } }), "authenticated");
});

test("free, subscription and grandfathered lifetime terminology is stable", () => {
  assert.equal(subscriptionPresentation({ accessType: "free" }).planName, "OpeningFit Free");
  assert.deepEqual(
    [subscriptionPresentation({ accessType: "monthly_subscription" }).planName, subscriptionPresentation({ accessType: "annual_subscription" }).planName],
    ["OpeningFit Plus", "OpeningFit Plus"],
  );
  assert.match(subscriptionPresentation({ accessType: "monthly_subscription" }).billingDescription, /renews each month until cancelled/i);
  assert.match(subscriptionPresentation({ accessType: "annual_subscription" }).billingDescription, /renews each year until cancelled/i);
  const lifetime = subscriptionPresentation({ accessType: "lifetime" });
  assert.equal(lifetime.kind, "lifetime");
  assert.match(lifetime.accessLabel, /grandfathered lifetime access/i);
  assert.match(lifetime.billingDescription, /no recurring subscription/i);
});

test("signed-out profile route returns the auth surface before dashboard widgets", () => {
  const app = read("../App.jsx");
  const signedOutBoundary = app.indexOf('if (accountState === "signed_out")');
  const dashboardStart = app.indexOf("const hasStoredProgress =", signedOutBoundary);
  assert.ok(signedOutBoundary > -1 && dashboardStart > signedOutBoundary);
  const boundary = app.slice(signedOutBoundary, dashboardStart);
  assert.match(boundary, /profileSignedOutAuth/);
  assert.match(boundary, /<AccountPanel variant="screen"/);
  assert.doesNotMatch(boundary, /ProfileStatsSimpleCard|OpeningMilestones|ProfileSubscriptionSimpleCard/);
});

test("login copy contains operational methods without beta or dashboard language", () => {
  const account = read("../components/AccountPanel.jsx");
  assert.match(account, /Continue with Google/);
  assert.match(account, /Send login link/);
  assert.match(account, /\bLog in\b/);
  assert.match(account, /\bCreate account\b/);
  assert.doesNotMatch(account, /Beta note/i);
  assert.match(account, /aria-selected=\{authMode === "login"\}/);
});

test("inner-page brand navigation is a native semantic homepage link", () => {
  assert.deepEqual(HOME_NAVIGATION, { key: "home", label: "OpeningFit homepage", path: "/", native: true });
  const app = read("../App.jsx");
  assert.match(app, /className="appPrimaryBrand" href=\{HOME_NAVIGATION\.path\}/);
  assert.doesNotMatch(app, /className="appPrimaryBrand" href="#app-dashboard"/);
});
