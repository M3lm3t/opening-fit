import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SAMPLE_REPORT } from "../fixtures/sampleReport.js";
import { buildReportDecisionModel } from "./reportDecisionModel.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";

const files = async () => ({
  summary: await readFile(new URL("../components/PrimaryReportSummary.jsx", import.meta.url), "utf8"),
  score: await readFile(new URL("../components/OpeningFitScoreDisclosure.jsx", import.meta.url), "utf8"),
  command: await readFile(new URL("../components/ReportCommandBar.jsx", import.meta.url), "utf8"),
  primitive: await readFile(new URL("../components/ui/UiPrimitives.jsx", import.meta.url), "utf8"),
  app: await readFile(new URL("../App.jsx", import.meta.url), "utf8"),
  css: await readFile(new URL("../components/PrimaryReportSummary.css", import.meta.url), "utf8"),
});

test("Overview mounts one canonical command centre with one primary action", async () => {
  const { summary, app } = await files();
  const flow = app.slice(app.indexOf("function FinalReportFlow"), app.indexOf("function NextBestTrainingActionCard"));
  assert.equal((flow.match(/<PrimaryReportSummary/g) || []).length, 1);
  assert.equal((summary.match(/data-report-command-centre/g) || []).length, 1);
  assert.equal((summary.match(/data-command-role="keep"/g) || []).length, 1);
  assert.equal((summary.match(/data-command-role="repair"/g) || []).length, 1);
  assert.equal((summary.match(/data-command-role="train-next"/g) || []).length, 1);
  assert.equal((summary.match(/className="primaryBtn"/g) || []).length, 1);
  assert.doesNotMatch(summary, /primaryReportNextAction|primaryReportDecisions|This week’s focus|current priority/i);
  assert.ok(flow.indexOf("<ReportCommandBar") < flow.indexOf('<section className="reportViewPanel" id="report-summary-view"'));
});

test("canonical decision and diagnosis identity survive into the command-centre CTA", async () => {
  const { summary } = await files();
  const diagnosis = { diagnosisId: "diagnosis:command-centre", opening: "Queen Pawn Game", repertoireRole: "white", supportingGameIds: ["sample-game-1", "sample-game-2"], userFacingDiagnosis: "A repeated player-turn position is available.", confidenceReason: "Two matching games support this review." };
  const report = { ...SAMPLE_REPORT, reportDecision: { ...SAMPLE_REPORT.reportDecision, decisionId: "decision:command-centre", trainingPriority: { priorityId: "priority:command-centre", diagnosisId: diagnosis.diagnosisId, openingName: diagnosis.opening, openingDiagnosis: diagnosis, estimatedDurationMinutes: 10, successCheck: "Complete two reviews." } } };
  const model = buildReportDecisionModel(report);
  const view = buildPrimaryReportSummary(model, report);
  assert.equal(view.decisionId, model.authoritative.decisionId);
  assert.equal(view.diagnosisId, model.authoritative.trainingPriority.diagnosisId);
  assert.equal(view.keep.opening, model.authoritative.establishedStrength.opening);
  assert.equal(view.repair.opening, model.authoritative.trainingPriority.openingDiagnosis.opening);
  assert.equal(view.trainNext.successCheck, model.authoritative.trainingPriority.successCheck);
  assert.match(summary, /data-decision-id=\{view\.decisionId/);
  assert.match(summary, /data-diagnosis-id=\{view\.diagnosisId/);
});

test("secondary report features remain in their existing views rather than hidden Overview trees", async () => {
  const { summary, app } = await files();
  const flow = app.slice(app.indexOf("function FinalReportFlow"), app.indexOf("function NextBestTrainingActionCard"));
  assert.doesNotMatch(summary, /ReportGameCountSummary|RecommendationEvidenceDisclosure|primaryReportRepertoire/);
  for (const component of ["DecisionRepertoireMap", "FocusedRepertoireSection", "FiniteTrainingSession", "ReportGameCountSummary", "EvidenceTableSection", "ReportExportAndHistory", "ReportComparisonSection"]) assert.match(flow, new RegExp(`<${component}`));
  assert.match(flow, /<ImportQualitySummary/);
  assert.match(flow, /path: "\/train\?start=report-task"/);
});

test("premium continuation follows free value and is hidden for authoritative paid access", async () => {
  const { app } = await files();
  const flow = app.slice(app.indexOf("function FinalReportFlow"), app.indexOf("function NextBestTrainingActionCard"));
  assert.ok(flow.indexOf("<PrimaryReportSummary") < flow.indexOf("reportOverviewPlusContinuation"));
  assert.match(flow, /!isPremium && entitlement\?\.hasPremiumAccess === false/);
  assert.match(flow, /Full weekly plan.*Own-game drills.*Saved progress.*Repertoire workspace/s);
  assert.doesNotMatch(flow, /Future Stockfish analysis/i);
});

test("report tabs, methodology and informational context expose accessible semantics", async () => {
  const { score, command, primitive, app } = await files();
  const flow = app.slice(app.indexOf("function FinalReportFlow"), app.indexOf("function NextBestTrainingActionCard"));
  assert.match(command, /semanticTabs/);
  assert.match(primitive, /role=\{semanticTabs \? "tablist"/);
  assert.match(primitive, /aria-selected=\{semanticTabs \? isActive/);
  assert.match(primitive, /ArrowLeft.*ArrowRight.*Home.*End/s);
  assert.match(score, /aria-expanded=\{open\}/);
  assert.match(score, /aria-controls="repertoire-health-methodology"/);
  assert.match(score, /role="region"/);
  assert.match(flow, /role="tabpanel"/);
  assert.match(command, /reportCommandBar__context/);
  assert.match(command, /buildReportGameCounts\(data\)/);
  assert.match(command, /counts\.fetchedGames/);
  assert.match(command, /counts\.usedForOpeningStats/);
  assert.match(command, /counts\.excludedGames/);
  assert.match(command, /sufficient: "Sufficient evidence"/);
  assert.doesNotMatch(command, /model\?\.health\?\.confidence \|\| "Unavailable"/);
  assert.doesNotMatch(command, /reportCommandBar__context[\s\S]*?<button/);
});

test("mobile and desktop share decisions while mobile prioritises Repair then Train next", async () => {
  const { summary, css } = await files();
  assert.equal((summary.match(/data-command-role=/g) || []).length, 3);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*primaryReportCommand--repair \{ order: 1; \}[\s\S]*primaryReportCommand--train \{ order: 2; \}[\s\S]*primaryReportCommand--keep \{ order: 3; \}/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.doesNotMatch(css, /display:\s*none[^}]*primaryReportCommand/);
});
