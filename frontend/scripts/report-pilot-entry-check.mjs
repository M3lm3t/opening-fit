// Exercise the real production entry bundle, not a component-only Vite fixture.
// No hosted authentication or database requests are made.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { MELMET_REGRESSION_FIXTURE } from "../src/lib/fixtures/melmetRegressionFixture.js";

const root = path.resolve(process.argv[2] || "dist");
const expectation = process.argv[3] || "enabled";
assert.ok(["enabled", "disabled", "reproduce-homepage"].includes(expectation));
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = path.resolve(root, `.${pathname.includes(".") ? pathname : "/index.html"}`);
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  try {
    const data = await readFile(file);
    response.setHeader("Content-Type", ({ ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml" })[path.extname(file)] || "application/octet-stream");
    response.end(data);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const user = { id: "11111111-1111-4111-8111-111111111111", email: "route-test@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const expires = Math.floor(Date.now() / 1000) + 3600;
const session = { user, access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: expires, role: "authenticated" })}.local-test-signature`,
  refresh_token: "local-test-refresh", token_type: "bearer", expires_at: expires, expires_in: 3600 };
let checks = 0;
try {
  const paths = expectation === "reproduce-homepage" ? ["/report-pilot"] : ["/report-pilot", "/report-pilot/"];
  for (const signedIn of (expectation === "reproduce-homepage" ? [false] : [false, true])) for (const pathname of paths) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addInitScript(({ session, report }) => {
      if (session) localStorage.setItem("openingfit:supabase.auth", JSON.stringify(session));
      // A saved report and return path must not steal pilot navigation.
      if (session) {
        localStorage.setItem("openingFit:lastAnalysis", JSON.stringify({ analysis: report, username: report.username, platform: "chess.com" }));
        localStorage.setItem("openingFit:authReturnPath", "/report");
      }
    }, { session: signedIn ? session : null, report: MELMET_REGRESSION_FIXTURE });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/rest/v1/")) requests.push(url.pathname);
      if (url.pathname === "/api/report-pilot") return route.fulfill({ json: { userId: user.id, allowed: false, creationEnabled: false, scope: "reports-only" } });
      if (url.pathname === "/auth/v1/user") return route.fulfill({ json: user });
      if (url.pathname.startsWith("/rest/v1/")) return route.fulfill({ json: [] });
      if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { enabled: false } });
      return url.origin === origin ? route.continue() : route.abort();
    });
    await page.goto(origin + pathname);
    for (const phase of ["direct", "refresh"]) {
      if (phase === "refresh") await page.reload();
      if (expectation === "reproduce-homepage") {
        await page.locator(".homepageSampleDisclaimer").waitFor();
        assert.equal(await page.locator(".reportPilot").count(), 0);
      } else {
        await page.getByRole("heading", { name: "OpeningFit report pilot", exact: true }).waitFor();
        const message = expectation === "disabled" ? "The report pilot is unavailable in this web build."
          : signedIn ? "This account is not enabled for the pilot." : "Sign in through the standard app";
        await page.getByText(message, { exact: false }).waitFor();
        assert.equal(await page.locator(".homepageSampleDisclaimer").count(), 0);
        assert.equal(await page.getByRole("button", { name: "Import last month" }).count(), 0);
        assert.ok(requests.every((request) => request === "/api/report-pilot"), "Legacy auth/report restoration must not mount on the pilot route");
      }
      assert.equal(new URL(page.url()).pathname, pathname);
      assert.deepEqual(errors, []);
      checks++;
    }
    if (expectation === "enabled" && signedIn) assert.ok(requests.includes("/api/report-pilot"));
    if (expectation === "disabled") assert.deepEqual(requests, []);
    await context.close();
  }
  if (expectation !== "reproduce-homepage") for (const pathname of ["/", "/login", "/report/sample"]) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { enabled: false } });
      return url.origin === origin ? route.continue() : route.abort();
    });
    await page.goto(origin + pathname);
    if (pathname === "/") await page.locator(".homepageSampleDisclaimer").waitFor();
    else if (pathname === "/report/sample") await page.locator(".primaryReportHealth").waitFor();
    else await page.getByRole("textbox").first().waitFor();
    assert.equal(await page.locator(".reportPilot").count(), 0);
    assert.equal(new URL(page.url()).pathname, pathname);
    assert.deepEqual(errors, []);
    checks++;
    await context.close();
  }
  console.log(`PASS production entry (${expectation}): ${checks} route/state checks; no real API/database requests.`);
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
