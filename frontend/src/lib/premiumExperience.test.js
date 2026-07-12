import test from "node:test";
import assert from "node:assert/strict";
import { canStartCheckout, canUsePremiumPreview, checkoutReturnState, confirmEntitlementWithRetry, premiumFeatureStructure } from "./premiumExperience.js";
test("production preview flags cannot grant access", () => { assert.equal(canUsePremiumPreview({ isDevelopment: false, requested: true }), false); assert.equal(canUsePremiumPreview({ isDevelopment: true, requested: true }), true); });
test("premium copy excludes unbuilt email and engine promises", () => { const model = premiumFeatureStructure(); assert.match(model.free.join(" "), /Initial report/); assert.match(model.premium.join(" "), /Progress comparisons/); assert.doesNotMatch(model.premium.join(" "), /email|engine/i); });
test("delayed entitlement retries successfully", async () => { let calls = 0; const result = await confirmEntitlementWithRetry(async () => ++calls === 2, { delay: async () => {} }); assert.deepEqual(result, { confirmed: true, attempts: 2 }); });
test("failed entitlement does not ask for repurchase", async () => { assert.equal((await confirmEntitlementWithRetry(async () => false, { attempts: 2 })).confirmed, false); assert.equal(checkoutReturnState("delayed").repurchase, false); });
test("cancelled checkout returns safely", () => assert.equal(checkoutReturnState("cancelled").state, "cancelled"));
test("signed-out checkout is rejected", () => { assert.equal(canStartCheckout(null), false); assert.equal(canStartCheckout({ id: "user" }), true); });
