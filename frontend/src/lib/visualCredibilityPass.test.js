import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const foundation = read("../styles/uiFoundation.css");
const theme = read("../ThemePolish.css");
const summary = read("../components/PrimaryReportSummary.css");
const report = read("../styles/reportExperience.css");
const shell = read("../components/ProductAppShell.css");
const component = read("../components/PrimaryReportSummary.jsx");

test("active app pages use a flat foundation instead of decorative background glows", () => {
  assert.match(foundation, /body,\s*\.page\s*\{[^}]*background:\s*var\(--of-color-page\)/s);
  assert.doesNotMatch(foundation, /body,\s*\.page\s*\{[^}]*radial-gradient/s);
  assert.match(theme, /body:not\(\.light\) \{\s*background: var\(--ds-bg-0\) !important;/);
  assert.match(shell, /\.appReportPage \{[^}]*background: var\(--of-shell-bg\);/s);
});

test("report evidence reads as text rather than decorative metadata pills", () => {
  assert.match(report, /\.currentReportMetaInline span[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;/);
  assert.match(shell, /\.reportDecisionEvidence span \{ padding: 2px 0;/);
  assert.doesNotMatch(shell, /\.reportDecisionEvidence span \{[^}]*border-radius:\s*999px/);
  assert.match(summary, /\.reportGameCountCompact > span \{ padding: 2px 0;/);
});

test("Keep Repair and Train retain restrained semantic indicators", () => {
  assert.match(summary, /\.primaryReportCommand--keep \{ border-left-color: var\(--of-success/);
  assert.match(summary, /\.primaryReportCommand--repair\.isActionable \{ border-left-color: var\(--of-warning/);
  assert.match(summary, /\.primaryReportCommand--train \{ border-left-color: var\(--of-accent/);
  assert.match(component, /data-command-role="keep"/);
  assert.match(component, /data-command-role="repair"/);
  assert.match(component, /data-command-role="train-next"/);
});

test("responsive report hierarchy and accessible evidence labels remain intact", () => {
  assert.match(summary, /@media \(max-width: 900px\)[\s\S]*?\.primaryReportCommand--repair \{ order: 1; \}[\s\S]*?\.primaryReportCommand--train \{ order: 2; \}[\s\S]*?\.primaryReportCommand--keep \{ order: 3; \}/);
  assert.match(summary, /@media \(max-width: 520px\)[\s\S]*?\.primaryReportCommand button,[\s\S]*?width: 100%;/);
  assert.match(component, /aria-label="Decision evidence"/);
  assert.match(component, /aria-label="Repair, keep and optional experiment"/);
  assert.match(component, /data-primary-training-cta="true"/);
});

test("repertoire coverage cards collapse to readable single-column mobile geometry", () => {
  assert.match(shell, /@media \(max-width: 640px\)[\s\S]*?\.decisionRepertoireMap \.repertoireCoverageGrid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(shell, /\.decisionRepertoireMap \.repertoireCoverageGrid article \{ min-width: 0; grid-template-columns: minmax\(0, 1fr\); width: 100%; overflow: hidden; \}/);
  assert.match(shell, /\.repertoireCoverageStatus \{ justify-self: start; \}/);
});
