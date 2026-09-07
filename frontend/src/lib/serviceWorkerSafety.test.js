import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");

test("service worker keeps every API request network-only", () => {
  const apiBranch = source.slice(source.indexOf('if (requestUrl.pathname.startsWith("/api/"))'), source.indexOf("const isNavigation"));
  assert.match(apiBranch, /event\.respondWith\(fetch\(event\.request\)\)/);
  assert.doesNotMatch(apiBranch, /caches\.|clone\(/);
});

test("cacheable responses are cloned synchronously before asynchronous cache work", () => {
  assert.match(source, /CACHE_NAME = "opening-fit-v6"/);
  assert.equal((source.match(/const copy = response\.clone\(\)/g) || []).length, 3);
  assert.doesNotMatch(source, /cache\.put\(event\.request, response\.clone\(\)\)/);
  assert.equal((source.match(/cache\.put\(event\.request, copy\)/g) || []).length, 3);
});
