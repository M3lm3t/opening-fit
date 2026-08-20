import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("weekly reviews are stable per owner and week and owner-private", () => {
  const migration = fs.readFileSync(new URL("../../../supabase/migrations/202608200005_weekly_coaching_reviews_and_reminders.sql", import.meta.url), "utf8");
  assert.match(migration, /unique \(user_id, week_start\)/);
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /reminders_enabled boolean not null default false/);
});
