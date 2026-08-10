import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("share-report routes to the dedicated canonical sharing experience, not history", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(app, /"share-report": \{ view: "report", path: "\/report", target: "share-report", reportMode: "table" \}/);
  assert.doesNotMatch(app, /"share-report": \{ view: "profile", target: "report-history" \}/);
  assert.match(app, /<ShareReport data=\{data\} \/>/);
});

test("canonical and authenticated restored report data build the same share model", () => {
  const share = readFileSync(new URL("../components/ShareReport.jsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(share, /normaliseReportDecision\(data\.reportDecision \|\| data\.report_decision, data\)/);
  assert.match(share, /buildReportGameCounts\(data\)\.analysedGames/);
  assert.match(share, /selectAuthoritativeCoachingPriority\(data/);
  assert.match(app, /onLoadReport=\{\(report\) => \{[\s\S]*setData\(report\);[\s\S]*handleAppNavigate\("report"\)/);
});

test("missing report fails safely and existing clipboard fallback remains wired", () => {
  const source = readFileSync(new URL("../components/ShareReport.jsx", import.meta.url), "utf8");
  assert.match(source, /function buildShareReportModel\(data\) \{\s*if \(!data\) return null/);
  assert.match(source, /if \(!data \|\| !report\) return null/);
  assert.match(source, /navigator\.clipboard\.writeText\(report\.text\)/);
  assert.match(source, /Could not copy automatically/);
});
