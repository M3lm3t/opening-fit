import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const methodology = readFileSync(new URL("../components/PublicTrustPage.jsx", import.meta.url), "utf8");
const pricing = readFileSync(new URL("../components/PremiumPanel.jsx", import.meta.url), "utf8");
const score = readFileSync(new URL("../components/OpeningFitScoreDisclosure.jsx", import.meta.url), "utf8");
const counts = readFileSync(new URL("../components/ReportGameCountSummary.jsx", import.meta.url), "utf8");
const sample = readFileSync(new URL("../components/PrimaryReportSummary.jsx", import.meta.url), "utf8");

test("homepage metric uses the guarded public component without embedded totals", () => {
  assert.match(app, /PublicGamesAnalysedMetric/);
  assert.doesNotMatch(app, /\d[\d,]*\+ games analysed|OpeningFit has analysed/);
  assert.doesNotMatch(app, /credibilityTestimonials|credibilityCaseStudies|Social proof|Early launch metrics/);
});

test("homepage examples are labelled as fictional and never as visitor results", () => {
  assert.match(app, /Example report/);
  assert.match(app, /Illustrative example using fictional data/);
  assert.match(sample, /Example report .* Fictional data/);
});

test("methodology covers the current pipeline and non-capabilities", () => {
  for (const phrase of ["Fetch", "Filter", "Limit", "Classify", "opening score rate", "wins plus half of draws", "transpositions", "does not provide full-game engine analysis", "formula version"]) {
    assert.match(methodology.toLowerCase(), new RegExp(phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("methodology is linked from score, counts, pricing and sample report", () => {
  for (const source of [score, counts, pricing, sample]) assert.match(source, /href="\/how-it-works"/);
});

test("commercial copy uses exact implemented limits and read-only previews", () => {
  assert.match(pricing, /publicFeatureComparison/);
  assert.match(pricing, /Illustrative example .* Read-only/);
  assert.match(pricing, /does not create or save a report/);
  assert.doesNotMatch(pricing, /fair-use|automatic or on demand|Save every report/i);
});
