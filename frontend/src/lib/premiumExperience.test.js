import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { annualEffectiveMonthly, annualSavings, canStartCheckout, canUsePremiumPreview, checkoutReturnState, checkoutUnavailableMessage, confirmEntitlementWithRetry, formatGbp, normaliseBillingConfiguration, normaliseBillingInterval, premiumFeatureStructure } from "./premiumExperience.js";
test("production preview flags cannot grant access", () => { assert.equal(canUsePremiumPreview({ isDevelopment: false, requested: true }), false); assert.equal(canUsePremiumPreview({ isDevelopment: true, requested: true }), true); });
test("paid copy includes only implemented outcomes", () => { const model = premiumFeatureStructure(); assert.match(model.free.join(" "), /Useful first report/); assert.match(model.free.join(" "), /when supported by evidence/i); assert.match(model.free.join(" "), /One next training action/i); assert.doesNotMatch(model.free.join(" "), /One Keep recommendation|One Repair recommendation/i); assert.match(model.premium.join(" "), /Comparable-report progress/); assert.match(model.premium.join(" "), /Living three-role repertoire/); assert.match(model.premium.join(" "), /source-game reviews when recoverable/i); assert.match(model.premium.join(" "), /general setups otherwise/i); assert.doesNotMatch(model.premium.join(" "), /email|engine|course library|guaranteed/i); });
test("delayed entitlement retries successfully", async () => { let calls = 0; const result = await confirmEntitlementWithRetry(async () => ++calls === 2, { delay: async () => {} }); assert.deepEqual(result, { confirmed: true, attempts: 2 }); });
test("failed entitlement does not ask for repurchase", async () => { assert.equal((await confirmEntitlementWithRetry(async () => false, { attempts: 2 })).confirmed, false); assert.equal(checkoutReturnState("delayed").repurchase, false); });
test("cancelled checkout returns safely", () => assert.equal(checkoutReturnState("cancelled").state, "cancelled"));
test("signed-out checkout is rejected", () => { assert.equal(canStartCheckout(null), false); assert.equal(canStartCheckout({ id: "user" }), true); });
test("subscription prices, annual equivalent and saving are transparent", () => { const config = normaliseBillingConfiguration({ monthly: { available: true, amount: 4.99 }, annual: { available: true, amount: 39.99 } }); assert.equal(formatGbp(config.monthly.amount), "£4.99"); assert.equal(annualEffectiveMonthly(config), 3.33); assert.equal(annualSavings(config), 19.89); });
test("founding offer cannot appear without enabled server configuration", () => { assert.equal(normaliseBillingConfiguration({ annual: { available: true }, foundingOffer: { enabled: false, firstYearAmount: 29.99 } }).foundingOffer.enabled, false); assert.equal(normaliseBillingConfiguration({ annual: { available: false }, foundingOffer: { enabled: true, firstYearAmount: 29.99 } }).foundingOffer.enabled, false); });
test("pricing selection drives the visible price and checkout interval together", () => {
  const component = fs.readFileSync(fileURLToPath(new URL("../components/PremiumPanel.jsx", import.meta.url)), "utf8");
  assert.match(component, /const selected = configuration\[interval\]/);
  assert.match(component, /onFounderPass\?\.\("pricing_page", interval\)/);
  assert.match(component, /`Continue with \$\{interval\} billing`/);
  assert.match(component, /Monthly · \{formatGbp\(monthlyAmount\)\} billed monthly/);
  assert.match(component, /Annual · \{formatGbp\(annualAmount\)\} billed annually/);
  assert.match(component, /Sign in to subscribe/);
  assert.match(component, /BILLING_INTERVAL_STORAGE_KEY/);
  assert.match(component, /Keep and repair verdicts when supported by your evidence/);
  assert.match(component, /general setup drills when no game position is recoverable/i);
  assert.doesNotMatch(component, /disabled=\{!monthlyAvailable\}|disabled=\{!annualAvailable\}/);
});

test("monthly is the default and only a valid saved annual selection changes it", () => {
  assert.equal(normaliseBillingInterval(undefined), "monthly");
  assert.equal(normaliseBillingInterval("price_client_value"), "monthly");
  assert.equal(normaliseBillingInterval("annual"), "annual");
});

test("unavailable checkout gives an actionable safe reason", () => {
  assert.match(checkoutUnavailableMessage({ unavailableReasons: ["subscriptions_disabled"] }), /not open yet/i);
  assert.match(checkoutUnavailableMessage({ unavailableReasons: ["annual_price_missing"] }), /annual checkout is not configured/i);
  assert.match(checkoutUnavailableMessage({ unavailableReasons: ["billing_schema_not_ready"] }), /account storage/i);
  assert.match(checkoutUnavailableMessage({}, "error"), /payment service could not be reached/i);
});

test("checkout click locking and server-selected interval are retained", () => {
  const app = fs.readFileSync(fileURLToPath(new URL("../App.jsx", import.meta.url)), "utf8");
  const api = fs.readFileSync(fileURLToPath(new URL("../accountApi.js", import.meta.url)), "utf8");
  assert.match(app, /premiumCheckoutInFlightRef\.current/);
  assert.match(app, /if \(isPremium \|\| premiumCheckoutInFlightRef\.current\) return/);
  assert.match(api, /\[.*"monthly".*"annual".*\]\.includes\(billingInterval\)/s);
  assert.match(api, /billingInterval: interval/);
  assert.doesNotMatch(api, /priceId:\s|stripePriceId:\s/);
  assert.match(app, /localStorage\.setItem\(AUTH_RETURN_PATH_KEY, "\/premium"\)/);
});
