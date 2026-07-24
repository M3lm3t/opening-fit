import test from "node:test";
import assert from "node:assert/strict";
import { OPENINGFIT_FEATURES } from "./premiumEntitlement.js";
import { completedAnalysisJourney, premiumFeatureJourney, restoredReportJourney, viewFullReportJourney } from "./postAnalysisJourney.js";
import { activateAccessibleDialog, getActiveDialogId, releaseExclusiveDialog, requestExclusiveDialog, subscribeExclusiveDialog } from "./dialogAccessibility.js";

test("successful analysis opens the report without a verdict or personalisation dialog", () => {
  assert.deepEqual(completedAnalysisJourney(), { view: "report", path: "/report", reportMode: "summary", dialog: null, personalisationOpen: false, source: "analysis_completed" });
});

test("view full report reveals report detail and never requests an upgrade", () => {
  assert.deepEqual(viewFullReportJourney(), { view: "report", path: "/report", reportMode: "full", target: "full-report-details", dialog: null, upgrade: false });
});

test("an intentional paid feature opens upgrade for free users", () => {
  assert.equal(premiumFeatureJourney({ feature: OPENINGFIT_FEATURES.OWN_GAME_DRILLS, entitlement: { hasPremiumAccess: false }, intentional: true }).upgrade, true);
});

test("premium and lifetime access never receive an incorrect paywall", () => {
  for (const accessType of ["monthly_subscription", "lifetime"]) {
    assert.equal(premiumFeatureJourney({ feature: OPENINGFIT_FEATURES.OWN_GAME_DRILLS, entitlement: { hasPremiumAccess: true, accessType }, intentional: true }).upgrade, false);
  }
});

test("free report actions and accidental triggers do not open upgrade", () => {
  assert.equal(premiumFeatureJourney({ feature: OPENINGFIT_FEATURES.INITIAL_REPORT, entitlement: { hasPremiumAccess: false }, intentional: true }).upgrade, false);
  assert.equal(premiumFeatureJourney({ feature: OPENINGFIT_FEATURES.OWN_GAME_DRILLS, entitlement: { hasPremiumAccess: false }, intentional: false }).upgrade, false);
});

test("exclusive dialog requests replace rather than stack", () => {
  const observed = [];
  const unsubscribe = subscribeExclusiveDialog((dialog) => observed.push(dialog));
  requestExclusiveDialog("checkout");
  requestExclusiveDialog("personalisation");
  assert.equal(getActiveDialogId(), "personalisation");
  assert.deepEqual(observed.slice(-2), ["checkout", "personalisation"]);
  releaseExclusiveDialog("personalisation");
  unsubscribe();
});

test("restored reports use the same interruption-free report journey", () => {
  assert.deepEqual(restoredReportJourney(), { view: "report", path: "/report", reportMode: "summary", dialog: null, personalisationOpen: false, source: "report_restored" });
});

test("dialog Escape closes and cleanup restores focus and background", () => {
  const attributes = new Map();
  const background = { setAttribute: (key, value) => attributes.set(key, value), removeAttribute: (key) => attributes.delete(key) };
  let triggerFocused = 0;
  let firstFocused = 0;
  let closed = 0;
  let keydown;
  const trigger = { focus: () => { triggerFocused += 1; } };
  const first = { focus: () => { firstFocused += 1; } };
  const documentRef = { activeElement: trigger, body: { style: { overflow: "auto" } }, querySelectorAll: () => [background], contains: () => true };
  const windowRef = { setTimeout: (fn) => { fn(); return 1; }, clearTimeout: () => {}, addEventListener: (_name, fn) => { keydown = fn; }, removeEventListener: () => {} };
  const cleanup = activateAccessibleDialog({ dialog: { querySelectorAll: () => [first] }, onClose: () => { closed += 1; }, documentRef, windowRef });
  assert.equal(firstFocused, 1);
  assert.equal(documentRef.body.style.overflow, "hidden");
  keydown({ key: "Escape", preventDefault() {} });
  assert.equal(closed, 1);
  cleanup();
  assert.equal(triggerFocused, 1);
  assert.equal(documentRef.body.style.overflow, "auto");
  assert.equal(attributes.size, 0);
});
