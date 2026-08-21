import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { SAMPLE_REPORT } from "../fixtures/sampleReport.js";
import { buildReportDecisionModel } from "./reportDecisionModel.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";
import { buildRepertoireCoverage } from "./repertoireCoverage.js";
import { normaliseReportView, reportViewFromLocation } from "./reportViews.js";

test("the completed Report exposes exactly one primary training CTA", () => {
  const summary = fs.readFileSync(fileURLToPath(new URL("../components/PrimaryReportSummary.jsx", import.meta.url)), "utf8");
  assert.equal((summary.match(/data-primary-training-cta="true"/g) || []).length, 1);
});

test("Priorities renders one canonical repair instead of repeated diagnosis cards", () => {
  const summary = fs.readFileSync(fileURLToPath(new URL("../components/PrimaryReportSummary.jsx", import.meta.url)), "utf8");
  assert.equal((summary.match(/data-command-role="repair"/g) || []).length, 1);
  assert.doesNotMatch(summary, /CostlyIssuesSection|OpeningFitDiagnosisFirst|RecommendationEvidenceDisclosure/);
});

test("summary and repertoire consume identical canonical role evidence", () => {
  const model = buildReportDecisionModel(SAMPLE_REPORT);
  const summary = buildPrimaryReportSummary(model, SAMPLE_REPORT);
  const coverage = buildRepertoireCoverage(model);
  for (const role of coverage.roles) {
    const slot = summary.slots.find((item) => item.key === role.key);
    assert.equal(role.source, model.repertoire.find((item) => item.key === role.key));
    assert.equal(slot.games, role.games);
    assert.equal(slot.opening, role.opening === "Limited evidence" || role.opening === "No established response" ? slot.opening : role.opening);
  }
  assert.equal(summary.decisionId, model.authoritative.decisionId);
});

test("legacy report hashes and saved report entry points remain compatible", () => {
  assert.equal(reportViewFromLocation({ hash: "#report-problems" }), "priorities");
  assert.equal(reportViewFromLocation({ hash: "#report-train" }), "summary");
  assert.equal(normaliseReportView("repertoire"), "repertoire");
  const app = fs.readFileSync(fileURLToPath(new URL("../App.jsx", import.meta.url)), "utf8");
  assert.match(app, /onLoadReport={onLoadReport}/);
  assert.match(app, /ReportExportAndHistory/);
  assert.match(app, /readPersistedReport/);
});
