import test from "node:test";
import assert from "node:assert/strict";
import { restoreWithRetry } from "./userDataRestore.js";

test("authoritative entitlement restore retries a transient failure", async () => {
  let calls = 0;
  const rows = [{ status: "active", expires_at: null, stripe_subscription_id: null }];

  const restored = await restoreWithRetry(async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary Supabase failure");
    return rows;
  }, { attempts: 2, timeoutMs: 50, label: "entitlement restore" });

  assert.equal(calls, 2);
  assert.deepEqual(restored, rows);
});

test("restore does not fabricate access after all attempts fail", async () => {
  let calls = 0;

  await assert.rejects(
    restoreWithRetry(async () => {
      calls += 1;
      throw new Error("Supabase unavailable");
    }, { attempts: 2, timeoutMs: 50, label: "entitlement restore" }),
    /Supabase unavailable/
  );

  assert.equal(calls, 2);
});

test("restore retries a timed-out entitlement request", async () => {
  let calls = 0;

  const restored = await restoreWithRetry(() => {
    calls += 1;
    if (calls === 1) return new Promise(() => {});
    return Promise.resolve([{ access_type: "lifetime", status: "active" }]);
  }, { attempts: 2, timeoutMs: 5, label: "entitlement restore" });

  assert.equal(calls, 2);
  assert.equal(restored[0].access_type, "lifetime");
});
