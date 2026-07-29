import { OPENING_EVIDENCE_THRESHOLDS } from "./fitTrustModel.js";
import { formatResultCounts } from "./reportGameCounts.js";

export const MISSING_RECOMMENDATION_EVIDENCE =
  "There is not enough detailed evidence to explain this recommendation yet.";

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value) {
  const parsed = finite(value);
  return parsed === null || parsed < 0 ? null : Math.round(parsed);
}

function sampleFor(entry = {}) {
  return entry.sample && typeof entry.sample === "object" ? entry.sample : entry;
}

function resultEvidence(entry = {}, games) {
  const sample = sampleFor(entry);
  const supplied = [sample.wins ?? entry.wins, sample.draws ?? entry.draws, sample.losses ?? entry.losses];
  if (supplied.some((value) => value === null || value === undefined || value === "")) return null;
  const [wins, draws, losses] = supplied.map(integer);
  if ([wins, draws, losses].some((value) => value === null) || games === null || wins + draws + losses !== games) return null;
  return { wins, draws, losses, scoreRate: Math.round(((wins + draws * 0.5) / games) * 1000) / 10 };
}

function confidenceFor(entry = {}, games) {
  const raw = entry.confidence;
  const level = clean(typeof raw === "object" ? raw.level || raw.label : raw).toLowerCase();
  if (!level) return null;
  const sampleSize = typeof raw === "object" ? integer(raw.sampleSize ?? raw.sample_size) : null;
  if (sampleSize !== null && games !== null && sampleSize !== games) return null;
  if (level.includes("insufficient")) return "Insufficient data";
  if (games === null) return null;
  const suppliedRank = level.includes("high") ? 3 : level.includes("medium") ? 2 : level.includes("low") ? 1 : 0;
  if (!suppliedRank) return null;
  const maximumRank = games >= OPENING_EVIDENCE_THRESHOLDS.high ? 3 : games >= OPENING_EVIDENCE_THRESHOLDS.moderate ? 2 : 1;
  return ["", "Low confidence", "Moderate confidence", "High confidence"][Math.min(suppliedRank, maximumRank)];
}

function roleLabel(entry = {}) {
  const role = clean(entry.role || entry.openingRole || entry.opening_role || entry.perspective?.role).toLowerCase();
  const labels = {
    played_as_white: "Played by you as White",
    played_as_black: "Played by you as Black",
    faced_as_white: "Faced by you as White",
    faced_as_black: "Faced by you as Black",
  };
  return labels[role] || "";
}

function recurringIssue(entry = {}) {
  const issue = entry.recurringIssue || entry.recurring_issue || entry.issue;
  if (!issue || typeof issue !== "object") return null;
  const occurrences = integer(issue.occurrences ?? issue.games ?? issue.count);
  const description = clean(issue.description || issue.summary || issue.explanation);
  const position = clean(issue.positionOrMoveSequence || issue.position_or_move_sequence || issue.moveLine || issue.move_line);
  if (!description || !position || occurrences === null || occurrences < 2) return null;
  return `${description} It appeared ${occurrences} times around ${position}.`;
}

function interpretationFor(entry = {}, explicit = "") {
  return clean(
    explicit ||
      entry.interpretation ||
      entry.trainingAction?.explanation ||
      entry.training_action?.explanation ||
      entry.reason ||
      entry.shortReason ||
      entry.short_reason
  );
}

/** Builds display-only evidence. It deliberately rejects unreconciled or ambiguous values. */
export function buildRecommendationExplanation(entry = {}, options = {}) {
  const sample = sampleFor(entry);
  const games = integer(sample.games ?? entry.games ?? entry.gamesPlayed ?? entry.games_played);
  const results = resultEvidence(entry, games);
  const hasSuppliedResults = [sample.wins ?? entry.wins, sample.draws ?? entry.draws, sample.losses ?? entry.losses]
    .some((value) => value !== null && value !== undefined && value !== "");
  const rows = [];

  if (games !== null && games > 0) rows.push({ key: "games", label: "Relevant games", value: `${games} game${games === 1 ? "" : "s"}` });
  if (results) {
    rows.push({ key: "results", label: "Results", value: formatResultCounts(results) });
    rows.push({ key: "score", label: "Chess score", value: `${results.scoreRate}%` });
  } else if (!hasSuppliedResults) {
    const suppliedScore = finite(sample.scoreRate ?? sample.score_rate ?? entry.scoreRate ?? entry.score_rate);
    if (games !== null && games > 0 && suppliedScore !== null && suppliedScore >= 0 && suppliedScore <= 100) {
      rows.push({ key: "score", label: "Chess score", value: `${Math.round(suppliedScore * 10) / 10}%` });
    }
  }

  const totalGames = integer(options.totalGames);
  if (games !== null && games > 0 && totalGames !== null && totalGames >= games) {
    rows.push({ key: "frequency", label: "Opening frequency", value: `${Math.round((games / totalGames) * 1000) / 10}% of eligible games` });
  }
  const role = roleLabel(entry);
  if (role) rows.push({ key: "colour", label: "Colour and role", value: role });
  const issue = recurringIssue(entry);
  if (issue) rows.push({ key: "issue", label: "Recurring early issue", value: issue });
  const confidence = confidenceFor(entry, games);
  if (confidence) rows.push({ key: "confidence", label: "Confidence", value: confidence });

  const warning = games !== null && games > 0 && games < OPENING_EVIDENCE_THRESHOLDS.minimum
    ? `${games === 1 ? "One game is" : `${games} games are`} too small a sample for a firm recommendation.`
    : "";
  const interpretation = interpretationFor(entry, options.interpretation);

  return {
    rows,
    interpretation,
    warning,
    illustrative: Boolean(options.illustrative),
    hasEvidence: rows.length > 0,
    fallback: rows.length ? "" : MISSING_RECOMMENDATION_EVIDENCE,
  };
}
