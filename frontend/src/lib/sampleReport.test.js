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
import { buildReportGameCounts } from "./reportGameCounts.js";

test("both full-sample landing CTAs use the fixed sample entry", () => {
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const actionRouterSource = readFileSync(new URL("../components/AppActionRouter.jsx", import.meta.url), "utf8");
  assert.match(appSource, /onSampleReport\?\.\(SAMPLE_REPORT_CTA_SOURCES\.landingStory\)/);
  assert.match(appSource, /loadDemoReport\(SAMPLE_REPORT_CTA_SOURCES\.importHero\)/);
  assert.equal((appSource.match(/href=\{SAMPLE_REPORT_PATH\}/g) || []).length, 2);
  for (const interceptedLabel of ["view example report", "view sample report", "try demo", "example report", "sample report"]) {
    assert.doesNotMatch(actionRouterSource, new RegExp(`"${interceptedLabel}"\\s*:`));
  }
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
  assert.equal(SAMPLE_REPORT.sampleLabel, "Illustrative example");
  assert.match(SAMPLE_REPORT.username, /Example Player.*Sample/);
  assert.doesNotMatch(SAMPLE_REPORT.username, /chess\.com|lichess/i);
});

test("sample fixture renders the complete existing report model", () => {
  const names = SAMPLE_REPORT.best_openings.map((opening) => opening.name);
  assert.match(`${SAMPLE_REPORT.styleProfile?.primary} ${SAMPLE_REPORT.styleProfile?.labels?.join(" ")}`, /active|practical|development/i);
  assert.equal(typeof SAMPLE_REPORT.openingFitScore, "number");
  assert.ok(names.includes("Vienna Game"));
  assert.ok(names.includes("Caro-Kann Defence"));
  assert.ok(names.includes("Queen's Gambit Declined"));
  assert.equal(SAMPLE_REPORT.next_training_actions.length, 1);
});

test("sample fixture has one reconciled count funnel backed by unique classified games", () => {
  const counts = buildReportGameCounts(SAMPLE_REPORT);
  assert.equal(counts.countStatus, "canonical");
  assert.deepEqual([
    counts.fetchedGames, counts.eligibleGames, counts.pgnAvailableGames, counts.parsedGames,
    counts.attributedGames, counts.classifiedGames, counts.usedForOpeningStats,
  ], [72, 72, 72, 72, 72, 72, 72]);
  assert.equal(counts.excludedGames, 0);
  assert.equal(SAMPLE_REPORT.games.length, 72);
  assert.equal(new Set(SAMPLE_REPORT.games.map((game) => game.gameId)).size, 72);
  assert.equal(SAMPLE_REPORT.games.filter((game) => game.pgn).length, 72);
  assert.equal(SAMPLE_REPORT.best_openings.reduce((sum, opening) => sum + opening.games, 0), 72);
  assert.ok(SAMPLE_REPORT.games.every((game) => ["played_by_user", "faced_by_user"].includes(game.relationship)));
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
  const repair = model.decisions.find((decision) => decision.type === "repair");
  assert.equal(repair.presentation.fit.label, "Strong");
  assert.equal(repair.presentation.performance.label, "Struggling");
  assert.notEqual(repair.presentation.fit.score, repair.presentation.performance.score);
  assert.equal(SAMPLE_REPORT.next_training_actions.length, 1);
  assert.equal(model.authoritative.baseline.comparisonClaimsAllowed, false);
  assert.doesNotMatch(JSON.stringify(SAMPLE_REPORT), /most improved|weekly improvement|has improved/i);
});

test("sample reports cannot enter local or cloud report persistence", () => {
  assert.equal(canPersistReport(SAMPLE_REPORT), false);
  assert.equal(canPersistReport({ analysisCompleted: true, username: "real-user" }), true);
});

test("sample UI prevents save, training and completion mutations", () => {
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /if \(isSampleReport\(data\) && requestedSection === "train"\) \{\s*exitSampleReport\(\);\s*return;/);
  assert.match(appSource, /if \(sampleMode\) \{\s*exitSampleReport\(\);\s*return;/);
  assert.match(appSource, /if \(isSampleReport\(data\)\) \{[\s\S]*This example stays separate from your report history/);
});

test("sample navigation is path-specific and mobile shares the same destination", () => {
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /if \(item\.key === "example"\) return isSampleReportPath\(currentPath\);/);
  assert.doesNotMatch(appSource, /example:\s*\["report"/);
  assert.match(appSource, /\[\.\.\.items, accountAction\]\.map/);
  assert.match(appSource, /key: "example", label: "Example report", path: SAMPLE_REPORT_PATH/);
});

test("sample entry preserves a genuine in-memory or local report", () => {
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /genuineReportBeforeSampleRef\.current = data/);
  assert.match(appSource, /localStorage\.getItem\(STORAGE_KEY\)[\s\S]*genuineReportBeforeSampleRef\.current = storedReport/);
  assert.match(appSource, /path === "\/report" \? genuineReportBeforeSampleRef\.current : null/);
});

test("sample route and genuine empty report remain distinct", () => {
  assert.equal(reportForInitialPath(SAMPLE_REPORT_PATH), SAMPLE_REPORT);
  assert.equal(reportForInitialPath("/report"), null);
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /Your opening profile starts with one import\./);
});

test("visible sample labels use the fictional example contract", () => {
  const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const summarySource = readFileSync(new URL("../components/PrimaryReportSummary.jsx", import.meta.url), "utf8");
  const commandBarSource = readFileSync(new URL("../components/ReportCommandBar.jsx", import.meta.url), "utf8");
  const countSummarySource = readFileSync(new URL("../components/ReportGameCountSummary.jsx", import.meta.url), "utf8");
  const countContractSource = readFileSync(new URL("./reportGameCounts.js", import.meta.url), "utf8");
  for (const source of [appSource, summarySource, commandBarSource]) {
    assert.match(source, /Illustrative example/);
    assert.match(source, /Fictional data/);
  }
  assert.match(appSource, />Analyse your games<\/button>/);
  assert.match(countContractSource, /Example only · Not saved/);
  assert.match(countSummarySource, /isSampleReport\(report\)/);
  assert.match(appSource, /reportData && !isSampleReport\(reportData\) && cloudSaveStatus/);
});

test("sample analytics are distinguishable from user-report analytics", () => {
  assert.deepEqual(sampleAnalyticsContext("direct_sample_url"), { sample: true, reportKind: "sample", source: "direct_sample_url" });
});

test("Analyse my games exits sample mode to the real import form", () => {
  assert.deepEqual(sampleReportExit(), { path: "/analyse", view: "analyse", report: null, target: "import" });
});
