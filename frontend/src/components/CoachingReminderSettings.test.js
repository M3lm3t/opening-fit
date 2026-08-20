import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./CoachingReminderSettings.jsx", import.meta.url), "utf8");
test("permission is requested only from an explicit enable action after meaningful activity", () => {
  assert.match(source, /eligibleToAsk/);
  assert.match(source, /requestPermission\(\)/);
  assert.match(source, /onChange=.*enable/);
  assert.ok(source.indexOf("const enable = async") < source.indexOf("requestPermission()"));
});
test("reminders explain scope, privacy, quiet hours and have an off switch", () => {
  assert.match(source, /at most one reminder per day/);
  assert.match(source, /never includes your chess username/);
  assert.match(source, /Quiet hours/);
  assert.match(source, /Enable reminders/);
});
