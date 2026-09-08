import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");

test("service worker keeps every API request network-only", () => {
  const apiBranch = source.slice(source.indexOf('if (requestUrl.pathname.startsWith("/api/"))'), source.indexOf("const isNavigation"));
  assert.match(apiBranch, /event\.respondWith\(fetch\(event\.request\)\)/);
  assert.doesNotMatch(apiBranch, /caches\.|clone\(/);
  assert.doesNotMatch(apiBranch, /new Request|headers\.(?:set|delete)|Authorization/i);
});

test("Vercel proxies API requests directly without an application handler that can rewrite authorization", async () => {
  const config = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8"));
  const apiRewrite = config.rewrites.find((rule) => rule.source === "/api/:path*");
  assert.deepEqual(apiRewrite, {
    source: "/api/:path*",
    destination: "https://opening-fit.onrender.com/api/:path*",
  });
});

test("cacheable responses are cloned synchronously before asynchronous cache work", () => {
  assert.match(source, /CACHE_NAME = "opening-fit-v6"/);
  assert.equal((source.match(/const copy = response\.clone\(\)/g) || []).length, 3);
  assert.doesNotMatch(source, /cache\.put\(event\.request, response\.clone\(\)\)/);
  assert.equal((source.match(/cache\.put\(event\.request, copy\)/g) || []).length, 3);
});
