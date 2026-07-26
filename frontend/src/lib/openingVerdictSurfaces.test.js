import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("headline stays concise while detailed report surfaces use the shared verdict presentation", () => {
  const headline = source("../components/PrimaryReportSummary.jsx");
  assert.match(headline, /Why these decisions\?/);
  assert.match(headline, /<RecommendationEvidenceDisclosure/);
  assert.doesNotMatch(headline, /primaryReportProblem|primaryReportTraining/);
  assert.match(source("../components/ReportSnapshot.jsx"), /<OpeningVerdictSummary/);
  assert.match(source("../App.jsx"), /<OpeningVerdictSummary opening=\{\{ \.\.\.decision\.source/);
  assert.doesNotMatch(source("../App.jsx"), /Fit \$\{decision\.score\}\/100/);
});

test("recommended, sample and share output preserve separated verdict concepts", () => {
  assert.match(source("../components/RecommendedOpeningFit.jsx"), /<OpeningVerdictSummary/);
  assert.match(source("../components/ShareReport.jsx"), /formatOpeningVerdictText/);
  assert.match(source("../fixtures/sampleReport.js"), /fitScore: 68/);
});
