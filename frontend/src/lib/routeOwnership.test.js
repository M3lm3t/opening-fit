import assert from "node:assert/strict";
import test from "node:test";
import { APP_NAV_ROUTES, resolveOwnedProductRoute } from "../appNavigation.js";

test("canonical direct routes have one owner and explicit hydration policy", () => {
  assert.deepEqual(resolveOwnedProductRoute("/"), { view: "home", kind: "landing", hydrateReport: false });
  assert.deepEqual(resolveOwnedProductRoute("/analyse"), { view: "analyse", kind: "analysis", hydrateReport: false });
  assert.deepEqual(resolveOwnedProductRoute("/report"), { view: "report", kind: "report", hydrateReport: true });
  assert.deepEqual(resolveOwnedProductRoute("/train"), { view: "train", kind: "training", hydrateReport: true });
  assert.deepEqual(resolveOwnedProductRoute("/progress"), { view: "progress", kind: "progress", hydrateReport: true });
  assert.deepEqual(resolveOwnedProductRoute("/report/sample"), { view: "report", kind: "sample", hydrateReport: false });
  assert.equal(APP_NAV_ROUTES.analyse.path, "/analyse");
  assert.equal(APP_NAV_ROUTES.home.path, "/");
});

test("route resolution is stable across refresh-style queries and trailing slashes", () => {
  assert.equal(resolveOwnedProductRoute("/report/?view=evidence").kind, "report");
  assert.equal(resolveOwnedProductRoute("/train?start=report-task").kind, "training");
  assert.equal(resolveOwnedProductRoute("/unknown"), null);
});
