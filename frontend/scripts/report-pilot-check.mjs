// Local-only component acceptance. All account/API traffic is intercepted.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const session = { user: { id: "11111111-1111-4111-8111-111111111111", email: "pilot@example.invalid" }, access_token: "local-test-token" };
const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import ReportPilot from '/src/components/ReportPilot.jsx';
import {supabase} from '/src/lib/supabaseClient.js';
supabase.auth.getSession = async () => ({data:{session:${JSON.stringify(session)}}});
supabase.auth.onAuthStateChange = (callback) => { window.pilotAuthChange = callback; return {data:{subscription:{unsubscribe(){}}}}; };
supabase.from = () => { throw Error('Pilot touched a direct legacy table'); };
supabase.rpc = () => { throw Error('Pilot invoked a legacy RPC'); };
createRoot(document.getElementById('root')).render(React.createElement(ReportPilot));`;
const server = await createServer({
  server: { host: "127.0.0.1", port: 5196, strictPort: true },
  define: { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://pilot.invalid"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("local-test-public-key"),
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://127.0.0.1:5196") },
  plugins: [{ name: "local-pilot-fixture",
    resolveId(id) { if (id === "/__pilot-fixture.js") return "\0pilot-fixture"; },
    load(id) { if (id === "\0pilot-fixture") return fixture; },
    configureServer(dev) {
    dev.middlewares.use(async (req, res, next) => {
      if (req.url === "/__pilot-fixture") {
        res.setHeader("Content-Type", "text/html");
        res.end(await dev.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/__pilot-fixture.js"></script>'));
      } else next();
    });
  } }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  let allowed = true, creationEnabled = true, failHistory = false, failImport = false;
  let rows = [], jobs = 0, mutationCalls = 0;
  const report = { analysisId: "pilot-job", reportGeneration: "stage6_v1", gamesImported: 12,
    repertoireHealth: { version: "repertoire_health_v4", score: 61 } };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const request = route.request();
    assert.equal(request.headers()["x-openingfit-report-client"], "web-report-pilot-v1");
    let body;
    if (url.pathname === "/api/report-pilot") body = { userId: session.user.id, allowed, creationEnabled, scope: "reports-only" };
    else if (url.pathname === "/api/v2/report-store/query") {
      assert.equal(request.postDataJSON().operation, "select");
      if (failHistory) return route.fulfill({ status: 503, json: { detail: "History verification unavailable" } });
      body = { data: rows, error: null };
    } else if (url.pathname === "/api/v2/analysis/jobs") {
      jobs++;
      if (failImport) return route.fulfill({ status: 503, json: { detail: "New report creation is disabled" } });
      body = { jobId: "pilot-job", generation: "stage6_v1" };
    } else if (url.pathname === "/api/v2/analysis/jobs/pilot-job") {
      rows = [{ id: "saved-id", user_id: session.user.id, analysis_id: "pilot-job", report, username: "Player" }];
      body = { status: "completed", generation: "stage6_v1", result: report };
    } else { mutationCalls++; throw Error(`Unexpected pilot request: ${url.pathname}`); }
    return route.fulfill({ status: 200, json: body });
  });
  const open = () => page.goto("http://127.0.0.1:5196/__pilot-fixture");
  await open();
  await page.getByText("No saved reports yet.").waitFor();
  await page.getByLabel("Chess username").fill("Player");
  await page.getByRole("button", { name: "Import last month" }).click();
  await page.getByText("Report saved to your private pilot history.").waitFor();
  assert.equal(await page.getByRole("button", { name: /save plan|complete|start training|mission/i }).count(), 0);
  assert.match(await page.locator("main").innerText(), /training completion are unavailable/);
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter((key) => /report|analysis|training|settings/i.test(key))), []);

  failImport = true;
  await page.getByRole("button", { name: "Import last month" }).click();
  await page.getByRole("alert").filter({ hasText: "creation is disabled" }).waitFor();
  assert.equal(await page.getByText("Report saved to your private pilot history.").count(), 0);
  failImport = false; failHistory = true;
  await page.getByRole("button", { name: "Import last month" }).click();
  await page.getByRole("alert").filter({ hasText: "History verification unavailable" }).waitFor();
  assert.equal(await page.getByText("Report saved to your private pilot history.").count(), 0);

  await page.evaluate(() => window.pilotAuthChange("SIGNED_OUT", null));
  await page.getByText("Sign in through the standard app, then return to /report-pilot.").waitFor();
  assert.equal(await page.getByLabel("Saved reports").count(), 0);
  failHistory = false; allowed = false;
  await open();
  await page.getByText("This account is not enabled for the pilot.", { exact: false }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Import last month" }).count(), 0);
  allowed = true; creationEnabled = false;
  await open();
  await page.getByText("Saved reports loaded.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Import last month" }).isDisabled(), true);
  assert.equal(jobs, 3); assert.equal(mutationCalls, 0); assert.deepEqual(errors, []);
  console.log("PASS: confirmed saves, import/storage failure states, report-only UI, no legacy writes/caches, sign-out, denied accounts and rollback reads (8 scenarios).");
} finally { await browser?.close(); await server.close(); }
