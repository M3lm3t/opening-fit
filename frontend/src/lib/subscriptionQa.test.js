import test from "node:test";
import assert from "node:assert/strict";
import { resolvePremiumEntitlement } from "./premiumEntitlement.js";

const now = Date.parse("2026-07-18T12:00:00Z");
const activeAnnual = { access_type: "annual_subscription", status: "active", stripe_customer_id: "cus_test", stripe_subscription_id: "sub_test", current_period_end: "2027-07-18T12:00:00Z" };

test("refresh and another device restore access from the same protected row", () => {
  const restoredAfterRefresh = JSON.parse(JSON.stringify([activeAnnual]));
  const restoredOnOtherDevice = JSON.parse(JSON.stringify([activeAnnual]));
  assert.equal(resolvePremiumEntitlement(restoredAfterRefresh, { now }).hasPremiumAccess, true);
  assert.deepEqual(resolvePremiumEntitlement(restoredOnOtherDevice, { now }), resolvePremiumEntitlement(restoredAfterRefresh, { now }));
});

test("webhook-before-return and return-before-webhook both remain premium", () => {
  const checkoutReturn = { access_type: "monthly_subscription", status: "active", stripe_checkout_session_id: "cs_test" };
  const webhook = { ...checkoutReturn, stripe_customer_id: "cus_test", stripe_subscription_id: "sub_test", current_period_end: "2026-08-18T12:00:00Z" };
  for (const orderedRows of [[webhook, checkoutReturn], [checkoutReturn, webhook]]) {
    assert.equal(resolvePremiumEntitlement([orderedRows.at(-1)], { now }).hasPremiumAccess, true);
  }
});

test("expired subscriptions lose access while legacy lifetime users remain active", () => {
  const expired = resolvePremiumEntitlement([{ access_type: "monthly_subscription", status: "expired", current_period_end: "2026-07-01T00:00:00Z" }], { now });
  const legacy = resolvePremiumEntitlement([{ access_type: "lifetime", status: "expired", is_grandfathered_lifetime: true }], { now });
  assert.equal(expired.hasPremiumAccess, false);
  assert.equal(legacy.hasPremiumAccess, true);
  assert.equal(legacy.accessType, "lifetime");
});
