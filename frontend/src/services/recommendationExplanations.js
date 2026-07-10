function cleanText(value, fallback = "") {
  const text = String(value ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function titleCase(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  if (!Number.isFinite(number)) return fallback;
  return number >= 0 && number <= 1 ? Math.round(number * 100) : Math.round(number);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function openingName(item = {}, fallback = "this opening") {
  if (typeof item === "string") return item;
  return cleanText(
    item.name ||
      item.opening ||
      item.openingName ||
      item.opening_name ||
      item.ecoName ||
      item.eco_name,
    fallback
  );
}

function openingGames(item = {}) {
  return numberValue(item.games ?? item.games_played ?? item.gamesPlayed ?? item.count ?? item.total, 0);
}

function openingScore(item = {}) {
  return numberValue(
    item.fitScore ??
      item.fit_score ??
      item.openingFitScore ??
      item.opening_fit_score ??
      item.score ??
      item.winRate ??
      item.win_rate,
    null
  );
}

function confidenceFromGames(games) {
  if (games >= 12) return "High";
  if (games >= 5) return "Medium";
  if (games >= 1) return "Low";
  return "Needs games";
}

function getConfidence(item = {}) {
  return titleCase(
    item.confidence ||
      item.confidenceLabel ||
      item.confidence_label ||
      item.confidenceLevel ||
      item.confidence_level ||
      confidenceFromGames(openingGames(item))
  );
}

function getRecommendationText(item = {}) {
  return [
    item.recommendation_label,
    item.recommendationLabel,
    item.recommendation,
    item.label,
    item.verdict,
    item.fitVerdict,
    item.fit_verdict,
    item.upgrade_type,
    item.upgradeType,
    item.reason_label,
    item.reasonLabel,
    item.reason,
    item.short_reason,
    item.shortReason,
    item.risk_level,
    item.riskLevel,
    item.learning_cost,
    item.learningCost,
    item.theory_load,
    item.theoryLoad,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function activeOpeningCount(item = {}, report = {}, alternatives = []) {
  const direct = item.activeRepertoireCount ?? item.active_repertoire_count ?? report.activeRepertoireCount;
  const directNumber = numberValue(direct, null);
  if (directNumber !== null) return directNumber;

  const active = item.activeOpenings || item.active_openings || report.activeOpenings || report.repertoire;
  if (Array.isArray(active)) return active.length;
  return asArray(alternatives).filter(Boolean).length;
}

function normalizeCategory(value) {
  const text = cleanText(value).toLowerCase();
  if (!text) return "";
  if (/keep|strong|reliable|weapon/.test(text)) return "keep";
  if (/improve|repair|fix|weak|leak|train|needs/.test(text)) return "improve";
  if (/avoid|pause|park|replace|delay|not recommended|do not|don't|lower priority|not urgent/.test(text)) {
    return "temporary_focus";
  }
  if (/too little|not enough|low sample|sample|needs games|insufficient/.test(text)) return "not_enough_data";
  if (/explore|try|experiment/.test(text)) return "explore";
  if (/build next|next/.test(text)) return "build_next";
  if (/overload|too many|rotation/.test(text)) return "too_many_openings";
  if (/style|fit|level/.test(text)) return "style_mismatch";
  return text.replace(/\s+/g, "_");
}

function inferCategory(item = {}, context = {}) {
  const explicit = normalizeCategory(context.category || item.explanationCategory || item.explanation_category);
  const text = getRecommendationText(item);
  const games = openingGames(item);
  const score = openingScore(item);
  const activeCount = activeOpeningCount(item, context.report, context.alternatives);

  if (explicit && explicit !== "temporary_focus") return explicit;
  if (explicit === "temporary_focus") {
    if (games > 0 && games < 4) return "not_enough_data";
    if (/too little|not enough|low sample|sample/.test(text)) return "not_enough_data";
    if (activeCount >= 5 || /too many|overload|rotation|theory/.test(text)) return "too_many_openings";
    if (score !== null && score < 45) return "poor_results";
    if (/style|mismatch|fit/.test(text)) return "style_mismatch";
    return "temporary_focus";
  }

  if (games > 0 && games < 4) return "not_enough_data";
  if (/too little|not enough|low sample|sample/.test(text)) return "not_enough_data";
  if (/avoid|pause|replace|do not|don't|delay|lower priority|low priority|not urgent/.test(text)) {
    if (activeCount >= 5 || /too many|overload|rotation|theory/.test(text)) return "too_many_openings";
    if (score !== null && score < 45) return "poor_results";
    return "temporary_focus";
  }
  if (/explore|try|experiment|new recommendation|build next/.test(text)) return "explore";
  if (/improve|repair|fix|weak|leak|unstable|review/.test(text)) return "improve";
  if (score !== null && games >= 4 && score < 45) return "poor_results";
  if (activeCount >= 6) return "too_many_openings";
  return "keep";
}

function titleForCategory(category, name, item = {}) {
  const slot = cleanText(item.slotLabel || item.contextLabel || item.context || item.role);
  if (category === "keep") return `Keep building your ${name}`;
  if (category === "improve" || category === "poor_results") return `Strengthen your ${name}`;
  if (category === "too_many_openings") return `Narrow your choices around ${name}`;
  if (category === "style_mismatch") return `Keep ${name} as a side option`;
  if (category === "not_enough_data") return `Collect more games in ${name}`;
  if (category === "explore") return `Explore ${name} carefully`;
  if (category === "build_next") return `Build ${name} next`;
  if (category === "temporary_focus") return `Pause ${name} for now`;
  if (slot.toLowerCase().includes("d4")) return "Strengthen your response to 1.d4";
  if (slot.toLowerCase().includes("e4")) return "Strengthen your response to 1.e4";
  return `Build ${name} next`;
}

function reasonForCategory(category, name, item = {}) {
  const supplied =
    item.recommendationReason ||
    item.recommendation_reason ||
    item.short_reason ||
    item.shortReason ||
    item.reason;
  if (supplied && !/do not learn|objectively bad/i.test(String(supplied))) return cleanText(supplied);

  if (category === "keep") {
    return "This is one of your more reliable openings in the analysed games, so it is a good part of your current repertoire to keep stable.";
  }
  if (category === "improve") {
    return "Your results are usable but mixed here. One focused repair is likely more useful than switching to a new opening.";
  }
  if (category === "poor_results") {
    return "Your results are less stable here than in your main option, so this should be treated as a repair target rather than a permanent judgement.";
  }
  if (category === "too_many_openings") {
    return "You appear to have several alternatives in rotation. Focusing on one main choice should make improvement easier to measure.";
  }
  if (category === "style_mismatch") {
    return "The positions from this opening may not match where your recent results look most comfortable.";
  }
  if (category === "not_enough_data") {
    return "OpeningFit does not have enough games to judge this opening yet. Treat it as an early signal, not a big repertoire decision.";
  }
  if (category === "explore") {
    return "This can be tested as a controlled experiment, but it should not distract from your current priority opening.";
  }
  if (category === "build_next") {
    return "This looks like a sensible next addition once your current priority opening is stable enough to build from.";
  }
  if (category === "temporary_focus") {
    return "Your current training focus is elsewhere. Pause this opening for now and return when your main repertoire is more stable.";
  }
  return `${name} is relevant to this report, but the current data is not strong enough for a harsher verdict.`;
}

function actionForCategory(category) {
  if (category === "keep") return { label: "Keep using it and monitor progress", route: "practice" };
  if (category === "improve" || category === "poor_results") return { label: "Review common early mistakes", route: "report" };
  if (category === "too_many_openings") return { label: "Stick with one response for 10 games", route: "repertoire" };
  if (category === "style_mismatch") return { label: "Prioritise the better-fitting option first", route: "repertoire" };
  if (category === "not_enough_data") return { label: "Return once more games are analysed", route: "analyse" };
  if (category === "explore") return { label: "Practice the main line", route: "practice" };
  if (category === "build_next") return { label: "Build this after your current focus", route: "repertoire" };
  if (category === "temporary_focus") return { label: "Focus on the current priority opening", route: "training" };
  return { label: "View the evidence", route: "report" };
}

function toneForCategory(category) {
  if (category === "keep") return "positive";
  if (category === "explore" || category === "build_next") return "explore";
  if (category === "not_enough_data") return "neutral";
  if (category === "improve") return "repair";
  if (category === "poor_results" || category === "too_many_openings" || category === "style_mismatch" || category === "temporary_focus") {
    return "pause";
  }
  return "neutral";
}

function reasonCategoryLabel(category) {
  const labels = {
    keep: "Reliable current option",
    improve: "Repair target",
    poor_results: "Less stable results",
    too_many_openings: "Too many openings currently in rotation",
    style_mismatch: "Level or style fit issue",
    not_enough_data: "There is not enough data yet",
    explore: "Controlled experiment",
    build_next: "Build next",
    temporary_focus: "Current training focus is elsewhere",
  };
  return labels[category] || "Coaching priority";
}

function evidenceChips(item = {}, context = {}) {
  const chips = [];
  const games = openingGames(item);
  const score = openingScore(item);
  const wins = numberValue(item.wins ?? item.w, null);
  const draws = numberValue(item.draws ?? item.d, null);
  const losses = numberValue(item.losses ?? item.l, null);
  const earlyLosses = numberValue(item.earlyLosses ?? item.early_losses ?? item.openingLosses ?? item.opening_losses, null);
  const frequency = numberValue(item.frequency ?? item.frequencyPercent ?? item.frequency_percent, null);
  const consistency = numberValue(item.consistency ?? item.consistencyScore ?? item.consistency_score, null);
  const confidence = getConfidence(item);

  if (games) chips.push({ label: "Games", value: String(games) });
  if (score !== null) chips.push({ label: "Score", value: `${score}/100` });
  if (wins !== null || losses !== null) {
    chips.push({ label: "Result", value: `${wins ?? 0}-${draws ?? 0}-${losses ?? 0}` });
  }
  if (consistency !== null) chips.push({ label: "Consistency", value: `${consistency}/100` });
  if (frequency !== null) chips.push({ label: "Frequency", value: `${frequency}%` });
  if (earlyLosses !== null) chips.push({ label: "Early losses", value: String(earlyLosses) });
  if (confidence) chips.push({ label: "Confidence", value: confidence });

  const alternatives = asArray(context.alternatives).filter((alt) => openingName(alt, "") !== openingName(item, ""));
  const better = alternatives
    .map((alt) => ({ name: openingName(alt), score: openingScore(alt), games: openingGames(alt) }))
    .filter((alt) => alt.score !== null && alt.games >= 2)
    .sort((a, b) => b.score - a.score)[0];
  if (better && score !== null && better.score > score + 5) {
    chips.push({ label: "Better option", value: `${better.name} ${better.score}/100` });
  }

  return chips.slice(0, 6);
}

export function getRecommendationExplanation(input = {}) {
  const item = input.recommendation || input.opening || input.item || {};
  const report = input.report || {};
  const alternatives = input.alternatives || [];
  const name = openingName(item, "this opening");
  const category = inferCategory(item, { ...input, report, alternatives });
  const action = actionForCategory(category);

  return {
    title: titleForCategory(category, name, item),
    reason: reasonForCategory(category, name, item),
    reasonCategory: reasonCategoryLabel(category),
    evidence: evidenceChips(item, { report, alternatives }),
    confidence: getConfidence(item),
    actionLabel: cleanText(item.next_action || item.nextAction || item.recommendationReasonNextStep || item.recommendation_reason_next_step, action.label),
    actionRoute: input.actionRoute || action.route,
    tone: toneForCategory(category),
    category,
    coachingNote:
      "This is a coaching recommendation based on your analysed games. It is not saying an opening is objectively bad.",
  };
}

export const MOCK_RECOMMENDATION_EXPLANATION_EXAMPLES = [
  { recommendation: { name: "Vienna Game", games: 14, fitScore: 82, verdict: "Keep" } },
  { recommendation: { name: "London System", games: 8, fitScore: 56, verdict: "Improve" } },
  { recommendation: { name: "Sicilian Defence", games: 7, fitScore: 38, verdict: "Avoid" } },
  { recommendation: { name: "Scotch Game", games: 0, recommendation_label: "Explore" } },
  { recommendation: { name: "French Defence", games: 2, recommendation_label: "Too little data" } },
  { recommendation: { name: "King's Indian Defence", games: 5, recommendation_label: "Lower priority", activeRepertoireCount: 7 } },
];
