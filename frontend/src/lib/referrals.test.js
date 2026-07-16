import test from "node:test";
import assert from "node:assert/strict";
import {
  REFERRAL_STORAGE_KEY,
  REFERRAL_TTL_MS,
  attachStoredReferralToAuthenticatedUser,
  captureReferralCode,
  captureReferralFromUrl,
  clearExpiredReferral,
  getStoredReferral,
  normalizeReferralCode,
} from "./referrals.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function validRpc(calls = []) {
  return async (name, args) => {
    calls.push({ name, args });
    if (name === "validate_referral_code") {
      return { data: [{ valid: true, normalized_code: args.input_code, partner_display_name: "Chess Coach" }], error: null };
    }
    if (name === "attach_referral_to_user") {
      return { data: [{ success: true, code: args.input_code, status: "registered" }], error: null };
    }
    return { data: true, error: null };
  };
}

test("valid code capture normalizes and stores a 30-day first touch", async () => {
  const storage = memoryStorage();
  const now = Date.parse("2026-07-12T12:00:00Z");
  const calls = [];
  const result = await captureReferralCode("  Coach_One  ", {
    storage,
    now,
    rpc: validRpc(calls),
    visitorIdFactory: () => "visitor-1",
  });

  assert.equal(result.success, true);
  assert.equal(result.referral.code, "coach_one");
  assert.equal(result.referral.partnerName, "Chess Coach");
  assert.equal(Date.parse(result.referral.expiresAt) - now, REFERRAL_TTL_MS);
  assert.equal(calls.filter((call) => call.name === "record_referral_visit").length, 1);
});

test("invalid referral formats and missing codes are rejected", async () => {
  assert.equal(normalizeReferralCode("bad code!"), "");
  assert.equal(normalizeReferralCode("a".repeat(51)), "");
  const result = await captureReferralCode("bad code!", { storage: memoryStorage(), rpc: validRpc() });
  assert.deepEqual(result, { success: false, reason: "invalid-format" });
  const missing = await captureReferralCode("well-formed", {
    storage: memoryStorage(),
    rpc: async () => ({ data: [{ valid: false, normalized_code: "well-formed", partner_display_name: null }], error: null }),
  });
  assert.deepEqual(missing, { success: false, reason: "invalid-code" });
});

test("expired referral is removed", () => {
  const storage = memoryStorage();
  storage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({
    code: "old-code",
    partnerName: "Old Partner",
    visitorId: "visitor-old",
    capturedAt: "2026-05-01T00:00:00.000Z",
    expiresAt: "2026-06-01T00:00:00.000Z",
  }));
  assert.equal(clearExpiredReferral({ storage, now: Date.parse("2026-07-12T00:00:00Z") }), true);
  assert.equal(getStoredReferral({ storage }), null);
});

test("a different code cannot overwrite an unexpired first touch", async () => {
  const storage = memoryStorage();
  const now = Date.parse("2026-07-12T00:00:00Z");
  await captureReferralCode("first", { storage, now, rpc: validRpc(), visitorIdFactory: () => "visitor-1" });
  const calls = [];
  const result = await captureReferralCode("second", { storage, now: now + 1000, rpc: validRpc(calls) });
  assert.equal(result.reason, "first-touch-preserved");
  assert.equal(result.referral.code, "first");
  assert.equal(calls.length, 0);
});

test("stored referral attaches after authentication", async () => {
  const storage = memoryStorage();
  const now = Date.parse("2026-07-12T00:00:00Z");
  await captureReferralCode("coach", { storage, now, rpc: validRpc(), visitorIdFactory: () => "visitor-2" });
  const calls = [];
  const result = await attachStoredReferralToAuthenticatedUser({ storage, now, rpc: validRpc(calls) });
  assert.equal(result.success, true);
  assert.equal(calls[0].name, "attach_referral_to_user");
  assert.equal(calls[0].args.input_visitor_id, "visitor-2");
});

test("referral attachment failure resolves without blocking authentication", async () => {
  const storage = memoryStorage();
  const now = Date.parse("2026-07-12T00:00:00Z");
  await captureReferralCode("coach", { storage, now, rpc: validRpc(), visitorIdFactory: () => "visitor-3" });
  let logged = false;
  const result = await attachStoredReferralToAuthenticatedUser({
    storage,
    now,
    rpc: async () => { throw new Error("network unavailable"); },
    onError: () => { logged = true; },
  });
  assert.deepEqual(result, { success: false, reason: "attach-failed" });
  assert.equal(logged, true);
});

test("successful URL capture removes both supported referral parameters", async () => {
  const storage = memoryStorage();
  let replacedWith = "";
  const history = { state: { page: 1 }, replaceState: (_state, _title, next) => { replacedWith = next; } };
  const result = await captureReferralFromUrl({
    href: "https://www.openingfit.com/pricing?ref=coach&referral=other&utm_source=test#offer",
    history,
    storage,
    rpc: validRpc(),
    visitorIdFactory: () => "visitor-4",
  });
  assert.equal(result.success, true);
  assert.equal(replacedWith, "/pricing?utm_source=test#offer");
});
