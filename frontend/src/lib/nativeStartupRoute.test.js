import assert from "node:assert/strict";
import test from "node:test";
import { nativeLogoutRoute, resolveNativeStartupRoute } from "./nativeStartupRoute.js";

const resolve = (overrides = {}) => resolveNativeStartupRoute({ native: true, authResolved: true, currentPath: "/", ...overrides });

test("native auth loading does not redirect", () => {
  assert.deepEqual(resolve({ authResolved: false, authenticated: true }), { handled: false, destination: null });
});

test("native signed-out root remains public", () => {
  assert.deepEqual(resolve(), { handled: true, destination: null });
});

test("native returning user with a saved report opens Report", () => {
  assert.deepEqual(resolve({ authenticated: true, reportAvailable: true }), { handled: true, destination: "/report" });
});

test("native returning user without a saved report opens Account", () => {
  assert.deepEqual(resolve({ authenticated: true }), { handled: true, destination: "/account" });
});

test("native deep links are preserved for Progress and Report", () => {
  for (const currentPath of ["/progress", "/report"]) {
    assert.deepEqual(resolve({ authenticated: true, currentPath }), { handled: true, destination: null });
  }
  assert.deepEqual(resolve({ authenticated: true, launchPath: "/progress" }), { handled: true, destination: null });
});

test("web root startup remains unchanged", () => {
  assert.deepEqual(resolve({ native: false, authenticated: true }), { handled: false, destination: null });
});

test("a handled startup does not redirect again on resume", () => {
  assert.deepEqual(resolve({ authenticated: true, handled: true }), { handled: true, destination: null });
});

test("native explicit logout returns to the public root only after a real user transition", () => {
  assert.equal(nativeLogoutRoute({ native: true, hadUser: true, authenticated: false }), "/");
  assert.equal(nativeLogoutRoute({ native: true, hadUser: false, authenticated: false }), null);
  assert.equal(nativeLogoutRoute({ native: false, hadUser: true, authenticated: false }), null);
});
