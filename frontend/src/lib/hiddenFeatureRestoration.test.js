import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRatingGoalModel } from "../services/todayRetention.js";

test("target rating remains a persisted tracking goal with imported current-rating evidence", () => {
  const model = buildRatingGoalModel({
    settings: { preferences: { ratingGoal: { currentRating: 1350, startRating: 1300, targetRating: 1600 } } },
    data: { currentRating: 1400, ratingSource: "chess.com", ratingTimeControl: "rapid" },
  });
  assert.equal(model.hasGoal, true);
  assert.equal(model.current, 1400);
  assert.equal(model.target, 1600);
  assert.equal(model.progress, 33);
});

test("Profile restores the existing goal editor without claiming recommendation effects", async () => {
  const component = await readFile(new URL("../components/RatingGoalCard.jsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const coach = await readFile(new URL("../components/CoachDashboard.jsx", import.meta.url), "utf8");
  assert.match(component, /This is a tracking goal\. It does not change analysis or guarantee rating gains\./);
  assert.match(component, /Current rating/);
  assert.match(component, /Target rating/);
  assert.doesNotMatch(component, /shape your training|guarantee.*reach/i);
  assert.match(app, /<RatingGoalCard goal=\{ratingGoal\} onSaveGoal=\{saveRatingGoal\}/);
  assert.match(app, /onSaveSettings=\{saveCloudSettings\}/);
  assert.match(app, /onRecordActivity=\{recordCloudActivity\}/);
  assert.match(coach, /import RatingGoalCard from "\.\/RatingGoalCard\.jsx"/);
});

test("Today and entitled training history are discoverable from Profile without expanding primary navigation", async () => {
  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const mobile = await readFile(new URL("./mobileNavigation.js", import.meta.url), "utf8");
  assert.match(app, />Open Today<\/button>/);
  assert.match(app, />Training history<\/button>/);
  assert.match(app, /onJourney=\{canUseFeature\(entitlement, OPENINGFIT_FEATURES\.TRAINING_HISTORY\)/);
  assert.doesNotMatch(mobile, /key: "dashboard"|key: "journey"/);
});
