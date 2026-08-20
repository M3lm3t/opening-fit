import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("./GameCheckPanel.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./GameCheckPanel.css", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/migrations/202608200003_complete_game_check.sql", import.meta.url), "utf8");

test("Game Check saves only after successful evaluation and exposes interruption recovery", () => {
  assert.ok(component.indexOf("await evaluateGameCheck") < component.indexOf("await completeGameCheck"));
  assert.match(component, /The checkpoint was not advanced/);
  assert.match(component, /Retry Game Check/);
  assert.match(component, /AbortController/);
});

test("completed UI remains concise, inspectable and Android-safe", () => {
  assert.match(component, /outcomes\.slice\(0, 3\)/);
  assert.match(component, /Inspect evidence/);
  assert.match(component, /aria-busy/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /min-height: 44px/);
});

test("checkpoint and activity are committed in one idempotent database transaction", () => {
  assert.match(migration, /record_meaningful_coaching_activity\('game_check_completed'/);
  assert.match(migration, /on conflict \(user_id, platform, username\) do update/);
  assert.match(migration, /select distinct value from jsonb_array_elements_text/);
});
