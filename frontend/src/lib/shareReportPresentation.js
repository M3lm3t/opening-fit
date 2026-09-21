import { buildReportDecisionModel } from "./reportDecisionModel.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";
import { buildReportGameCounts } from "./reportGameCounts.js";
import { formatOpeningVerdictText } from "./fitTrustModel.js";
import { isSampleReport } from "../fixtures/sampleReport.js";

export function buildShareReportModel(data) {
  if (!data) return null;
  const model = buildReportDecisionModel(data);
  const summary = buildPrimaryReportSummary(model, data);
  const sample = isSampleReport(data);
  const username = model.header.username || model.header.displayName;
  const gamesImported = buildReportGameCounts(data).analysedGames;
  const style = data.styleProfile?.primary || data.style_profile?.primary || "Style unavailable";
  const card = (entry) => entry.available ? { name: entry.opening, games: entry.observed.games, source: entry.source } : null;
  const best = card(summary.keep);
  const weakest = card(summary.repair);
  const training = { title: summary.trainNext.title, explanation: summary.trainNext.reason };
  const evidence = (entry) => [entry.observed.gamesLabel, entry.observed.results, entry.observed.scoreRate].filter(Boolean).join(" · ");
  const text = `${sample ? "OpeningFit sample report — Illustrative example · Fictional data" : "My OpeningFit report"}

Player: ${username}
Games analysed: ${gamesImported ?? "Unavailable"}
Style: ${style}
Repertoire Health: ${summary.health.scoreDisplayLabel}
Role coverage: ${summary.completenessLabel}
${summary.confidence}

Keep: ${summary.keep.opening}
${best ? `${evidence(summary.keep)}\n${formatOpeningVerdictText(best.source, { verdict: "keep" })}` : summary.keep.reason}

Repair: ${summary.repair.opening}
${weakest ? `${evidence(summary.repair)}\n${formatOpeningVerdictText(weakest.source, { verdict: "repair" })}` : summary.repair.diagnosis}

Next training action:
${training.title}. ${training.explanation}

Try it: https://www.openingfit.com`;
  return { username, gamesImported, style, best, weakest, training, trainingPriority: summary.trainingPriority, nextAction: model.nextTrainingAction, sample, text };
}
