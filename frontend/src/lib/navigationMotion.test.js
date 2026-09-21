import test from "node:test";
import assert from "node:assert/strict";
import { scrollToAppTarget } from "../appNavigation.js";

test("target navigation respects reduced motion, including explicitly smooth requests", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const target = { getBoundingClientRect: () => ({ top: 200 }) };
  const calls = [];
  let reduced = true;
  globalThis.window = { scrollY: 20, matchMedia: () => ({ matches: reduced }), scrollTo: value => calls.push(value) };
  globalThis.document = { getElementById: () => target, body: { contains: () => true } };
  try {
    assert.equal(scrollToAppTarget("report", { offset: 10, behavior: "smooth" }), true);
    assert.deepEqual(calls.pop(), { top: 210, behavior: "instant" });
    reduced = false;
    scrollToAppTarget("report", { offset: 10 });
    assert.equal(calls.pop().behavior, "smooth");
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});
