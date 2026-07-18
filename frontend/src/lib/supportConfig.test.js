import assert from "node:assert/strict";
import test from "node:test";

import { SUPPORT_EMAIL, supportMailto } from "./supportConfig.js";

test("support contact uses one frontend-safe configured value", () => {
  assert.match(SUPPORT_EMAIL, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.equal(supportMailto("Payment support"), `mailto:${SUPPORT_EMAIL}?subject=Payment%20support`);
});
