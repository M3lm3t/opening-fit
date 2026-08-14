import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_REPORT } from "../fixtures/sampleReport.js";
import { buildReportGameCounts } from "./reportGameCounts.js";
import { buildReportDecisionModel } from "./reportDecisionModel.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";
import { resolveTrainingPriority } from "./trainingPriority.js";

const source = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("release fixture reconciles counts, results, health and the authoritative training target", () => {
  const counts = buildReportGameCounts(SAMPLE_REPORT);
  assert.equal(counts.fetchedGames, 72);
  assert.equal(counts.analysedGames, 72);
  assert.equal(counts.excludedGames, 0);
  assert.equal(SAMPLE_REPORT.best_openings.reduce((sum, opening) => sum + opening.games, 0), counts.analysedGames);

  const gameIds = new Set(SAMPLE_REPORT.games.map((game) => game.gameId));
  for (const finding of [SAMPLE_REPORT.reportDecision.establishedStrength, SAMPLE_REPORT.reportDecision.primaryProblem]) {
    assert.equal(finding.sample.wins + finding.sample.draws + finding.sample.losses, finding.sample.games);
    assert.ok(finding.sample.gameIds.every((id) => gameIds.has(id)));
    assert.equal(finding.sample.gameIds.length, finding.sample.games);
  }

  for (const opening of SAMPLE_REPORT.best_openings) {
    const games = SAMPLE_REPORT.games.filter((game) => game.opening === opening.name);
    const wins = games.filter((game) => game.playerResult === "win").length;
    const draws = games.filter((game) => game.playerResult === "draw").length;
    assert.equal(wins, opening.wins);
    assert.equal(draws, opening.draws);
    assert.equal(Number(((wins / games.length) * 100).toFixed(1)), opening.winRate);
    assert.equal(Number((((wins + draws / 2) / games.length) * 100).toFixed(1)), opening.scoreRate);
  }

  const health = SAMPLE_REPORT.repertoireHealth;
  assert.equal(health.formulaVersion, "repertoire_health_v2");
  assert.equal(health, SAMPLE_REPORT.repertoire_health);
  assert.equal(health, SAMPLE_REPORT.repertoireCoverageScore);
  assert.ok(Math.abs(health.score - health.components.reduce((sum, component) => sum + component.contribution, 0)) < 1e-9);
  assert.equal(health.score, SAMPLE_REPORT.openingFitScore);
  assert.equal(health.confidence.scope, "repertoire_health");

  const model = buildReportDecisionModel(SAMPLE_REPORT);
  const summary = buildPrimaryReportSummary(model, SAMPLE_REPORT);
  const priority = resolveTrainingPriority(SAMPLE_REPORT, { decision: model });
  assert.equal(model.primaryAction.opening, "Queen's Gambit Declined");
  assert.equal(summary.trainingPriority.openingName, model.primaryAction.opening);
  assert.equal(priority.openingName, model.primaryAction.opening);
  assert.equal(priority.decisionId, model.decisionId);
  assert.notEqual(model.health.score, model.primaryAction.performanceScore);
});

test("release metadata publishes exact pricing and only intended public routes", () => {
  const app = source("../App.jsx");
  const seo = source("../components/SeoLandingPage.jsx");
  for (const expected of ["OpeningFit Free", "OpeningFit Plus Monthly", "OpeningFit Plus Annual", 'price: "0"', 'price: "4.99"', 'price: "39.99"', 'priceCurrency: "GBP"', 'availability: "https://schema.org/InStock"']) assert.match(seo, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal((seo.match(/offers: PUBLIC_PRICING_OFFERS/g) || []).length, 2);

  const html = source("../../index.html");
  const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(jsonLd["@graph"].find((item) => item["@type"] === "SoftwareApplication").offers.map((offer) => offer.price), ["0", "4.99", "39.99"]);
  assert.match(html, /https:\/\/www\.openingfit\.com\/og-image\.png/);

  const sitemap = source("../../public/sitemap.xml");
  const robots = source("../../public/robots.txt");
  for (const route of ["/premium", "/about", "/how-it-works", "/privacy", "/delete-account", "/terms", "/changelog"]) assert.match(sitemap, new RegExp(`<loc>https://www\\.openingfit\\.com${route.replaceAll("-", "\\-")}<\\/loc>`));
  assert.doesNotMatch(sitemap, /\/(account|admin|report|profile|train|dashboard)<\/loc>/);
  assert.doesNotMatch(sitemap, /https:\/\/openingfit\.com/);
  assert.match(robots, /Sitemap: https:\/\/www\.openingfit\.com\/sitemap\.xml/);
  assert.match(app, /currentPath === "\/pricing"[\s\S]*?`\$\{SITE_URL\}\/premium`/);
  assert.match(app, /isPrivateSeoPath[\s\S]*?"\/pricing"/);
});

test("release trust, progress and premium copy stay honest and accessible", () => {
  const trust = source("../components/PublicTrustPage.jsx");
  for (const phrase of ["deterministic analysis", "Repertoire Health", "Observed Performance", "Opening Score Rate", "Opening Suitability", "Evidence Confidence", "Zero-game suggestions", "not affiliated with Chess.com or Lichess", "objective engine move quality"]) assert.match(trust, new RegExp(phrase));

  const overlay = source("../components/ImportLoadingOverlay.jsx");
  for (const stage of ["Finding your games", "Choosing suitable games", "Understanding your openings", "Building your recommendations", "Preparing your report"]) assert.match(overlay, new RegExp(stage));
  assert.match(overlay, /role="status"[\s\S]*aria-live="polite"[\s\S]*aria-busy=/);
  assert.match(overlay, /importLoadingProgress--indeterminate/);
  assert.doesNotMatch(overlay, /setInterval|Math\.random|fake/i);

  const premium = source("../components/PremiumPanel.jsx");
  const billing = source("./premiumExperience.js");
  assert.doesNotMatch(premium, /Future Stockfish|guaranteed improvement|engine-powered/i);
  assert.match(premium, /loadBillingConfiguration/);
  assert.match(billing, /monthly: \{ available: false, configured: false, amount: 4\.99, currency: "GBP" \}/);
  assert.match(billing, /annual: \{ available: false, configured: false, amount: 39\.99, currency: "GBP" \}/);
});
