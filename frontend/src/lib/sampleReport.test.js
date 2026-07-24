import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SAMPLE_REPORT,
  SAMPLE_REPORT_CTA_SOURCES,
  SAMPLE_REPORT_PATH,
  canPersistReport,
  isSampleReport,
  reportForInitialPath,
  sampleAnalyticsContext,
  sampleReportEntry,
  sampleReportExit,
} from "../fixtures/sampleReport.js";
import { buildReportDecisionModel } from "./reportDecisionModel.js";

test("both full-sample landing CTAs use the fixed sample entry", () => {
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /onSampleReport\?\.\(SAMPLE_REPORT_CTA_SOURCES\.landingStory\)/);
  assert.match(appSource, /loadDemoReport\(SAMPLE_REPORT_CTA_SOURCES\.importHero\)/);
  for (const source of Object.values(SAMPLE_REPORT_CTA_SOURCES)) {
    const entry = sampleReportEntry(source);
    assert.equal(entry.path, SAMPLE_REPORT_PATH);
    assert.equal(entry.report, SAMPLE_REPORT);
    assert.equal(entry.analytics.source, source);
  }
});

test("direct sample URL and refresh load the deterministic fixture", () => {
  const first = reportForInitialPath("/report/sample");
  const refreshed = reportForInitialPath("/report/sample/");
  assert.equal(first, SAMPLE_REPORT);
  assert.equal(refreshed, SAMPLE_REPORT);
  assert.equal(JSON.stringify(first), JSON.stringify(refreshed));
  assert.equal(reportForInitialPath("/report"), null);
});

test("sample is clearly labelled and uses a fictional example player", () => {
  assert.equal(isSampleReport(SAMPLE_REPORT), true);
  assert.equal(SAMPLE_REPORT.sampleLabel, "Sample report");
  assert.match(SAMPLE_REPORT.username, /Example Player.*Sample/);
  assert.doesNotMatch(SAMPLE_REPORT.username, /chess\.com|lichess/i);
});

test("sample ownership and faced-opening roles are internally consistent", () => {
  const byName = Object.fromEntries(SAMPLE_REPORT.best_openings.map((opening) => [opening.name, opening]));
  assert.equal(byName["Vienna Game"].openingRole, "played_as_white");
  assert.equal(byName["Vienna Game"].repertoireOwned, true);
  assert.equal(byName["Caro-Kann Defence"].openingRole, "played_as_black");
  assert.equal(byName["Queen's Gambit Declined"].repertoireSlot, "black_vs_d4");
  assert.equal(byName["French Defence"].openingRole, "faced_as_white");
  assert.equal(byName["French Defence"].repertoireOwned, false);
  assert.equal(byName["English Opening"].openingRole, "faced_as_black");
});

test("sample has one coherent strength, problem and next action without progress claims", () => {
  const model = buildReportDecisionModel(SAMPLE_REPORT, null, []);
  assert.equal(model.authoritative.establishedStrength.opening, "Vienna Game");
  assert.equal(model.authoritative.primaryProblem.opening, "Queen's Gambit Declined");
  assert.equal(model.authoritative.nextTrainingAction.opening, "Queen's Gambit Declined");
  assert.equal(SAMPLE_REPORT.next_training_actions.length, 1);
  assert.equal(model.authoritative.baseline.comparisonClaimsAllowed, false);
  assert.doesNotMatch(JSON.stringify(SAMPLE_REPORT), /most improved|weekly improvement|has improved/i);
});

test("sample reports cannot enter local or cloud report persistence", () => {
  assert.equal(canPersistReport(SAMPLE_REPORT), false);
  assert.equal(canPersistReport({ analysisCompleted: true, username: "real-user" }), true);
});

test("sample analytics are distinguishable from user-report analytics", () => {
  assert.deepEqual(sampleAnalyticsContext("direct_sample_url"), { sample: true, reportKind: "sample", source: "direct_sample_url" });
});

test("Analyse my games exits sample mode to the real import form", () => {
  assert.deepEqual(sampleReportExit(), { path: "/", view: "analyse", report: null, target: "import" });
});
