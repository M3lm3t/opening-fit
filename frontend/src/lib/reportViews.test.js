import test from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_APP_DESTINATIONS, REPORT_ACTION_INVENTORY, REPORT_VIEWS, canonicalDestinationUrl, canonicalReportAction, isCanonicalDestinationActive, normaliseReportView, reportActionForPriority, reportActionFromLocation, reportActionUrl, reportViewFromLocation, reportViewHash, reportViewHeadingId } from "./reportViews.js";

test("report tabs and bottom navigation share one canonical destination registry", () => {
  assert.equal(canonicalDestinationUrl("report", { pathname: "/", search: "", hash: "" }), "/report#report-summary");
  assert.equal(canonicalDestinationUrl("repertoire", { pathname: "/report", search: "?decision=1", hash: "#report-train" }), "/report?decision=1#report-repertoire");
  assert.equal(canonicalDestinationUrl("train", { pathname: "/report", search: "", hash: "#report-summary" }), "/train");
  assert.equal(CANONICAL_APP_DESTINATIONS.progress.path, "/account");
  assert.equal(CANONICAL_APP_DESTINATIONS.account.path, "/account");
  assert.equal(isCanonicalDestinationActive("repertoire", { pathname: "/report", hash: "#report-repertoire" }), true);
  assert.equal(isCanonicalDestinationActive("train", { pathname: "/report", hash: "#report-repertoire" }), false);
});

test("the report exposes exactly four stable top-level views", () => {
  assert.deepEqual(REPORT_VIEWS.map((view) => view.label), ["Summary", "Priorities", "Repertoire", "Evidence"]);
  assert.equal(new Set(REPORT_VIEWS.map((view) => view.key)).size, 4);
});

test("report hashes support direct links and safe fallbacks", () => {
  assert.equal(reportViewFromLocation({ hash: "#report-problems" }), "priorities");
  assert.equal(normaliseReportView("train"), "summary");
  assert.equal(normaliseReportView("unknown"), "summary");
  assert.equal(reportViewHash("evidence"), "#report-evidence");
  assert.equal(reportViewHeadingId("train"), "primary-report-title");
});

test("every report tab has a synchronized hash, heading and tabpanel", () => {
  for (const view of REPORT_VIEWS) {
    assert.equal(reportViewFromLocation({ hash: `#${view.hash}` }), view.key);
    assert.equal(reportViewHash(view.key), `#${view.hash}`);
    assert.ok(reportViewHeadingId(view.key));
  }
});

test("canonical report actions retain decision context in explicit destinations", () => {
  const action = canonicalReportAction({
    actionType: "open_evidence", sourceSection: "repertoire", destinationSection: "evidence",
    decisionId: "opening-decision:scandinavian", openingId: "scandinavian-defence", repertoireRole: "black_vs_e4", focusTarget: "evidence-table",
  });
  const url = reportActionUrl(action, { pathname: "/report", search: "?unrelated=kept" });
  assert.equal(url, "/report?unrelated=kept&reportAction=open_evidence&decision=opening-decision%3Ascandinavian&opening=scandinavian-defence&role=black_vs_e4&focus=evidence-table&source=repertoire#report-evidence");
  const restored = reportActionFromLocation({ pathname: "/report", search: url.slice(url.indexOf("?"), url.indexOf("#")), hash: "#report-evidence" });
  assert.equal(restored.destinationSection, "evidence");
  assert.equal(restored.decisionId, "opening-decision:scandinavian");
  assert.equal(restored.repertoireRole, "black_vs_e4");
});

test("priority routing selects visible report content instead of the repertoire workspace", () => {
  const diagnosed = reportActionForPriority({ type: "repair_repertoire", findingType: "branch_weakness", decisionId: "decision-1", diagnosisId: "diagnosis-1" });
  const roleGap = reportActionForPriority({ type: "fill_repertoire_gap", findingType: "repertoire_gap", decisionId: "decision-2", repertoireRole: "black_vs_d4" });
  const training = reportActionForPriority({ type: "consolidate_strength", findingType: "stable_strength", decisionId: "decision-3", taskId: "task-3" });
  assert.deepEqual([diagnosed.destinationSection, roleGap.destinationSection, training.destinationSection], ["priorities", "repertoire", "summary"]);
  for (const action of [diagnosed, roleGap, training]) assert.equal(action.destinationRoute, "/report");
  assert.equal(diagnosed.diagnosisId, "diagnosis-1");
  assert.equal(roleGap.repertoireRole, "black_vs_d4");
  assert.equal(training.trainingTaskId, "task-3");
});

test("the report action inventory covers the rendered CTA families", () => {
  const labels = REPORT_ACTION_INVENTORY.map((item) => item.label).join(" | ");
  for (const label of ["View evidence and full report", "Go to priority", "Start 10-minute practice", "Practise this response", "Report tabs / mobile report navigation"]) assert.match(labels, new RegExp(label));
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
  assert.match(flow, /setReportActionContext\(reportActionFromLocation\(\)\)/);
  assert.match(flow, /reportViewHeadingId\(next\).*focus\(\)/s);
  assert.match(flow, /<h1 className="reportPageTitle"/);
  assert.match(primitives, /ArrowLeft.*ArrowRight.*Home.*End/);
  assert.doesNotMatch(flow, />Full report<|>Supporting evidence<|>Advanced recommendations<|>Progress and details</);
});

test("rendered report CTAs use canonical report destinations and retain safe fallbacks", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const summary = await readFile(new URL("../components/PrimaryReportSummary.jsx", import.meta.url), "utf8");
  const flow = app.slice(app.indexOf("function FinalReportFlow"), app.indexOf("function NextBestTrainingActionCard"));
  assert.match(summary, /View evidence and methodology/);
  assert.match(flow, /openFullReport[\s\S]*destinationSection: "evidence"/);
  assert.match(flow, /openOpeningBreakdown[\s\S]*decisionId:[\s\S]*destinationSection: "evidence"/);
  assert.match(flow, /source = \{ \.\.\.\(target\?\.source \|\| \{\}\), \.\.\.\(target \|\| \{\}\) \}/);
  assert.match(flow, /reportActionForPriority/);
  assert.doesNotMatch(flow, /onAction=\{\(route\) => onNavigate\?\.\(route\)\}/);
  assert.match(flow, /The requested report context is no longer available/);
  assert.match(flow, /path: "\/train\?start=report-task"/);
  assert.match(app, /function EvidenceTableSection\(\{ data, fitData, entitlement = null, onEvidence \}\)/);
  assert.match(app, /evidenceSource = opening\.source \|\| opening/);
  assert.match(app, /onClick=\{\(\) => onEvidence\?\.\(evidenceSource\)\}/);
  assert.match(flow, /<EvidenceTableSection[^>]*onEvidence=\{openOpeningBreakdown\}/);
});

test("existing report content is mapped across the four views", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const flow = app.slice(app.indexOf("function FinalReportFlow"), app.indexOf("function NextBestTrainingActionCard"));
  for (const id of ["report-summary-view", "report-priorities-view", "report-repertoire-view", "report-evidence-view"]) assert.match(flow, new RegExp(id));
  for (const component of ["PrimaryReportSummary", "DecisionRepertoireMap", "ReportGameCountSummary", "EvidenceTableSection", "ReportExportAndHistory"]) assert.match(flow, new RegExp(`<${component}`));
});
