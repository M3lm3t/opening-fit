import test from "node:test";
import assert from "node:assert/strict";
import { canUseFeature, featureLimit, OPENINGFIT_FEATURES, resolvePremiumEntitlement } from "./premiumEntitlement.js";

const now = Date.parse("2026-07-17T12:00:00.000Z");

test("free access is returned without a protected entitlement", () => {
  assert.deepEqual(resolvePremiumEntitlement([], { now }), {
    hasPremiumAccess: false,
    accessType: "free",
    status: "expired",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });
});

test("lifetime access always takes precedence over subscription state", () => {
  const result = resolvePremiumEntitlement([
    { access_type: "monthly_subscription", status: "past_due" },
    { access_type: "lifetime", status: "expired", expires_at: "2020-01-01T00:00:00Z", is_grandfathered_lifetime: true },
  ], { now });
  assert.equal(result.hasPremiumAccess, true);
  assert.equal(result.accessType, "lifetime");
  assert.equal(result.status, "active");
  assert.equal(result.currentPeriodEnd, null);
});

test("legacy active non-expiring entitlements remain grandfathered lifetime access", () => {
  const legacy = resolvePremiumEntitlement([{
    status: "active",
    expires_at: null,
    stripe_subscription_id: null,
  }], { now });
  assert.equal(legacy.hasPremiumAccess, true);
  assert.equal(legacy.accessType, "lifetime");

  const ambiguousSubscription = resolvePremiumEntitlement([{
    status: "active",
    expires_at: null,
    stripe_subscription_id: "sub_legacy",
  }], { now });
  assert.equal(ambiguousSubscription.hasPremiumAccess, false);
});

test("a non-grandfathered refunded lifetime purchase is expired", () => {
  const result = resolvePremiumEntitlement([{
    access_type: "lifetime",
    status: "refunded",
  }], { now });
  assert.equal(result.hasPremiumAccess, false);
  assert.equal(result.status, "expired");
});

test("a canceled subscription retains access through its current period", () => {
  const active = resolvePremiumEntitlement([{
    access_type: "annual_subscription",
    status: "canceled",
    current_period_end: "2026-08-17T12:00:00Z",
    cancel_at_period_end: true,
  }], { now });
  assert.equal(active.hasPremiumAccess, true);
  assert.equal(active.cancelAtPeriodEnd, true);

  const expired = resolvePremiumEntitlement([{
    access_type: "annual_subscription",
    status: "canceled",
    current_period_end: "2026-06-17T12:00:00Z",
  }], { now });
  assert.equal(expired.hasPremiumAccess, false);
});

test("past due access is not removed inside an already-paid period", () => {
  const result = resolvePremiumEntitlement([{
    access_type: "monthly_subscription",
    status: "past_due",
    premium_since: "2026-06-17T12:00:00Z",
    current_period_end: "2026-07-20T12:00:00Z",
  }], { now });
  assert.equal(result.hasPremiumAccess, true);
});

test("an incomplete subscription without prior activation does not grant access", () => {
  const result = resolvePremiumEntitlement([{
    access_type: "monthly_subscription",
    status: "incomplete",
    current_period_end: "2026-07-20T12:00:00Z",
  }], { now });
  assert.equal(result.hasPremiumAccess, false);
});

test("anonymous and authenticated free users retain a useful report but not paid features", () => {
  const authenticatedFree = resolvePremiumEntitlement([], { now });
  for (const entitlement of [null, authenticatedFree]) {
    assert.equal(canUseFeature(entitlement, OPENINGFIT_FEATURES.BASIC_SCORE), true);
    assert.equal(canUseFeature(entitlement, OPENINGFIT_FEATURES.STYLE_PROFILE), true);
    assert.equal(canUseFeature(entitlement, OPENINGFIT_FEATURES.NEXT_ACTION), true);
    assert.equal(canUseFeature(entitlement, OPENINGFIT_FEATURES.REPORT_COMPARISON), false);
    assert.equal(featureLimit(entitlement, OPENINGFIT_FEATURES.GAME_HISTORY, "months"), 3);
    assert.equal(featureLimit(entitlement, OPENINGFIT_FEATURES.REPORT_REFRESH, "minimumMinutesBetweenRefreshes"), 60);
  }
});

test("monthly, annual, canceled-current and lifetime entitlements share one paid feature set", () => {
  const rows = [
    { access_type: "monthly_subscription", status: "active" },
    { access_type: "annual_subscription", status: "active" },
    { access_type: "annual_subscription", status: "canceled", current_period_end: "2026-08-17T12:00:00Z" },
    { access_type: "lifetime", status: "active" },
  ];
  rows.forEach((row) => {
    const entitlement = resolvePremiumEntitlement([row], { now });
    assert.equal(canUseFeature(entitlement, OPENINGFIT_FEATURES.FULL_REPERTOIRE), true);
    assert.equal(canUseFeature(entitlement, OPENINGFIT_FEATURES.OWN_GAME_DRILLS), true);
    assert.equal(featureLimit(entitlement, OPENINGFIT_FEATURES.GAME_HISTORY, "months"), 12);
    assert.equal(featureLimit(entitlement, OPENINGFIT_FEATURES.REPORT_REFRESH, "minimumMinutesBetweenRefreshes"), 5);
  });
});

test("expired access falls back to free capabilities", () => {
  const entitlement = resolvePremiumEntitlement([{ access_type: "monthly_subscription", status: "expired", current_period_end: "2026-06-01T00:00:00Z" }], { now });
  assert.equal(canUseFeature(entitlement, OPENINGFIT_FEATURES.INITIAL_REPORT), true);
  assert.equal(canUseFeature(entitlement, OPENINGFIT_FEATURES.WEEKLY_PLAN), false);
  assert.equal(canUseFeature(entitlement, "unknown_feature"), false);
});
