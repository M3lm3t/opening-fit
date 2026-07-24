import test from "node:test";
import assert from "node:assert/strict";
import { analysisConfidence, evidenceBasedReason, fitBand, fitEvidence, saveRecommendationFeedback } from "./fitTrustModel.js";

test("high score with a tiny sample remains low confidence", () => {
  const confidence = analysisConfidence({ games: 2 });
  assert.equal(confidence.level, "low");
  assert.equal(fitBand(92, confidence), "Excellent fit");
  assert.match(confidence.explanation, /too small/);
});
test("twelve opening-specific games have medium confidence", () => {
  const confidence = analysisConfidence({ games: 12 });
  assert.equal(confidence.level, "medium");
  assert.equal(fitBand(58, confidence), "Mixed fit");
});
test("high confidence requires fifteen opening-specific games", () => assert.equal(analysisConfidence({ games: 15 }).level, "high"));
test("zero games is insufficient evidence", () => assert.equal(analysisConfidence({ games: 0 }).label, "Insufficient evidence"));
test("no-loss tiny sample is described as a watch signal", () => assert.match(evidenceBasedReason({ games: 2, wins: 2, losses: 0 }), /watch signal/));
test("only genuine explanation inputs are exposed", () => assert.deepEqual(fitEvidence({ games: 4, planClarityScore: 61 }).map(([name]) => name), ["Performance", "Move-order consistency"]));
test("missing recommendation explanation fails safely", () => assert.match(evidenceBasedReason({}), /does not contain enough/));
test("feedback supports anonymous and authenticated analytics senders", async () => {
  assert.equal(await saveRecommendationFeedback(async () => true, { feedback: "helpful" }), true);
  assert.equal(await saveRecommendationFeedback(async () => false, { feedback: "helpful", authenticated: true }), false);
  assert.equal(await saveRecommendationFeedback(async () => { throw new Error("offline"); }, {}), false);
});
