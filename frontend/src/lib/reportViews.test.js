import test from "node:test";
import assert from "node:assert/strict";
import { REPORT_VIEWS, normaliseReportView, reportViewFromLocation, reportViewHash, reportViewHeadingId } from "./reportViews.js";

test("the report exposes exactly five stable top-level views", () => {
  assert.deepEqual(REPORT_VIEWS.map((view) => view.label), ["Summary", "Repertoire", "Problems", "Train", "Evidence"]);
  assert.equal(new Set(REPORT_VIEWS.map((view) => view.key)).size, 5);
});

test("report hashes support direct links and safe fallbacks", () => {
  assert.equal(reportViewFromLocation({ hash: "#report-problems" }), "problems");
  assert.equal(normaliseReportView("train"), "train");
  assert.equal(normaliseReportView("unknown"), "summary");
  assert.equal(reportViewHash("evidence"), "#report-evidence");
  assert.equal(reportViewHeadingId("train"), "report-train-view-title");
});

test("the report uses one accessible navigation model with history support", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const command = await readFile(new URL("../components/ReportCommandBar.jsx", import.meta.url), "utf8");
  const actionRouter = await readFile(new URL("../components/AppActionRouter.jsx", import.meta.url), "utf8");
  const primitives = await readFile(new URL("../components/ui/UiPrimitives.jsx", import.meta.url), "utf8");
  const flow = app.slice(app.indexOf("function FinalReportFlow"), app.indexOf("function NextBestTrainingActionCard"));
  assert.match(command, /REPORT_VIEWS/);
  assert.match(command, /activeKey=\{activeSection\}/);
  assert.match(command, /data-app-action-router-ignore="true"/);
  assert.match(actionRouter, /data-app-action-router-ignore/);
  assert.match(flow, /window\.history\.pushState/);
  assert.match(flow, /window\.addEventListener\("popstate"/);
  assert.match(flow, /reportViewHeadingId\(next\).*focus\(\)/s);
  assert.match(flow, /<h1 className="reportPageTitle"/);
  assert.match(primitives, /ArrowLeft.*ArrowRight.*Home.*End/);
  assert.doesNotMatch(flow, />Full report<|>Supporting evidence<|>Advanced recommendations<|>Progress and details</);
});

test("existing report content is mapped across the five views", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const flow = app.slice(app.indexOf("function FinalReportFlow"), app.indexOf("function NextBestTrainingActionCard"));
  for (const id of ["report-summary-view", "report-repertoire-view", "report-problems-view", "report-train-view", "report-evidence-view"]) assert.match(flow, new RegExp(id));
  for (const component of ["PrimaryReportSummary", "FocusedRepertoireSection", "CostlyIssuesSection", "FiniteTrainingSession", "EvidenceTableSection", "ReportExportAndHistory"]) assert.match(flow, new RegExp(`<${component}`));
});
