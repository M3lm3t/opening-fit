import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("command centre stays concise while detailed evidence remains in its report view", () => {
  const headline = source("../components/PrimaryReportSummary.jsx");
  const app = source("../App.jsx");
  assert.match(headline, /data-report-command-centre/);
  assert.match(headline, /View supporting games/);
  assert.doesNotMatch(headline, /RecommendationEvidenceDisclosure|primaryReportProblem|primaryReportTraining|primaryReportDecisions/);
  assert.match(app, /<EvidenceTableSection/);
  assert.match(app, /<ReportGameCountSummary/);
  assert.match(source("../components/ReportSnapshot.jsx"), /<OpeningVerdictSummary/);
  assert.match(app, /<OpeningVerdictSummary opening=\{\{ \.\.\.decision\.source/);
  assert.doesNotMatch(app, /Fit \$\{decision\.score\}\/100/);
});

test("recommended, sample and share output preserve separated verdict concepts", () => {
  assert.match(source("../components/RecommendedOpeningFit.jsx"), /<OpeningVerdictSummary/);
  assert.match(source("../components/ShareReport.jsx"), /formatOpeningVerdictText/);
  assert.match(source("../fixtures/sampleReport.js"), /fitScore: 68/);
});
