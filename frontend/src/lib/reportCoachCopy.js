const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const count = (value) => Math.max(0, Math.round(Number(value) || 0));
const plural = (value, singular, pluralWord = `${singular}s`) => `${value} ${value === 1 ? singular : pluralWord}`;

function sampleFor(recommendation = {}) {
  return recommendation.sample && typeof recommendation.sample === "object" ? recommendation.sample : recommendation;
}

function openingFor(recommendation = {}) {
  return clean(recommendation.openingName || recommendation.opening || recommendation.name) || "this opening";
}

function colourFor(recommendation = {}) {
  const role = clean(recommendation.role || recommendation.openingRole || recommendation.opening_role).toLowerCase();
  return role.endsWith("white") ? "White" : role.endsWith("black") ? "Black" : "your side";
}

export function formatRecommendationConfidence(recommendation = {}) {
  const sample = sampleFor(recommendation);
  const games = count(sample.games ?? recommendation.games);
  const level = clean(recommendation.confidence?.level || recommendation.confidence).toLowerCase();
  const recency = clean(recommendation.confidence?.recency);
  const recencyTime = Date.parse(recency);
  const old = Number.isFinite(recencyTime) && Date.now() - recencyTime > 180 * 24 * 60 * 60 * 1000;
  const basis = `${games} ${old ? "older" : recency ? "recent" : "relevant"} game${games === 1 ? "" : "s"}`;
  const ageNote = old ? " The sample is well supported but may not reflect your current play." : "";
  if (!games) return "Confidence unavailable — no relevant games were found.";
  if (level.includes("high")) return `High confidence — based on ${basis}.${ageNote}`;
  if (level.includes("medium")) return `Medium confidence — based on ${basis}.${ageNote}`;
  return `Low confidence — only ${basis} ${games === 1 ? "was" : "were"} found.${ageNote}`;
}

export function formatChessScore(recommendation = {}) {
  const sample = sampleFor(recommendation);
  const raw = sample.scoreRate ?? recommendation.scoreRate ?? recommendation.score;
  const score = Number(raw);
  return Number.isFinite(score)
    ? `Score: ${Math.round(score * 10) / 10}% — wins count as 1 point and draws as half a point.`
    : "Score unavailable — the result breakdown is incomplete.";
}

export const REPORT_COACH_TEMPLATES = Object.freeze({
  noStrength: "We do not have enough consistent results to name your strongest opening yet.",
  noWeakness: "No reliable opening weakness was found yet. Keep your current repertoire and check again after more games.",
  mixedRepertoire: "Your results are mixed across several openings. Keep the repertoire stable and review one repeated problem at a time.",
  noEligibleGames: "No games matched the selected date and time-control filters. Adjust the filters or import a different period.",
  noOpeningInformation: "The imported games did not contain enough opening information to make a reliable recommendation.",
  oldData: "These games are older, so use this as a reference rather than a current repertoire verdict.",
});

export function missingSlotCopy(slot) {
  if (slot === "white") return "No White opening has enough correctly attributed games yet.";
  if (slot === "black_e4") return "No Black defence against 1.e4 has enough correctly attributed games yet.";
  if (slot === "black_d4") return "No Black defence against 1.d4 has enough correctly attributed games yet.";
  return "This repertoire slot needs more correctly attributed games.";
}

export function recommendationCopy(recommendation, kind = "explore") {
  if (!recommendation) return kind === "repair" ? REPORT_COACH_TEMPLATES.noWeakness : REPORT_COACH_TEMPLATES.noStrength;
  const opening = openingFor(recommendation);
  const sample = sampleFor(recommendation);
  const games = count(sample.games ?? recommendation.games);
  const score = Number(sample.scoreRate ?? recommendation.scoreRate ?? recommendation.score);
  const role = clean(recommendation.role).toLowerCase();
  const slot = clean(recommendation.repertoireSlot).toLowerCase();
  if (recommendation.sampleSizeStatus === "insufficient_data" || games < 5) {
    const positive = Number.isFinite(score) && score >= 50 ? " Your results were positive, so this is not an established weakness." : "";
    return `Early signal — only ${plural(games, `${opening} game`)} ${games === 1 ? "was" : "were"} found.${positive} Play more games before changing your repertoire.`;
  }
  if (kind === "keep") {
    if (role === "played_as_black" && slot === "black_vs_e4") return `Keep playing ${opening}. It is your most reliable defence against 1.e4 based on ${plural(games, "recent game")}.`;
    if (role === "played_as_black" && slot === "black_vs_d4") return `Keep playing ${opening}. It is your most reliable defence against 1.d4 based on ${plural(games, "recent game")}.`;
    if (role === "played_as_white") return `Keep playing ${opening}. It is your most reliable White opening based on ${plural(games, "recent game")}.`;
    return `Keep playing ${opening}; ${plural(games, "recent game")} support that choice.`;
  }
  if (kind === "repair") return `${opening} is the recurring opening problem most worth fixing first. This comes from ${plural(games, "relevant game")}, not your overall report size.`;
  if (role.startsWith("faced_")) return `Prepare against ${opening}. You faced it as ${colourFor(recommendation)} in ${plural(games, "recent game")}.`;
  return `Keep watching ${opening}. The current sample is useful, but it does not support a firm keep-or-repair verdict yet.`;
}

export function trainingActionCopy(action = {}, recommendation = null) {
  const target = recommendation || {};
  const hasCanonicalTarget = Boolean(recommendation);
  const opening = openingFor(target.opening ? target : action);
  const sample = sampleFor(target.sample ? target : action);
  const games = count(sample.games ?? action.sample?.games);
  const issue = target.issue && typeof target.issue === "object" ? target.issue : null;
  const variation = clean(hasCanonicalTarget ? target.variationName : action.variationName);
  const line = clean(hasCanonicalTarget ? issue?.positionOrMoveSequence : action.lineOrPosition);
  const concept = clean(action.concept || issue?.description);
  const exercise = clean(action.exercise);
  const completion = clean(action.completionTarget?.label || action.completionTarget);
  const title = hasCanonicalTarget
    ? clean(target.trainingAction?.title) || `Review ${opening}`
    : clean(action.title || action.label) || (opening === "this opening" ? "Review your latest opening games" : `Review ${opening}`);
  const evidence = line
    ? `${issue?.occurrences || games || "Several"} recent game${Number(issue?.occurrences || games) === 1 ? "" : "s"} reached ${line}${variation ? ` in the ${variation}` : ""}.`
    : games
      ? `Use the ${plural(games, "relevant game")} in this report.`
      : "Use your latest relevant games.";
  const honestExercise = exercise || (opening === "this opening"
    ? "Review three recent opening losses and mark the first move where you left a familiar plan."
    : `Review three recent ${opening} losses and mark the first move where you left a familiar plan.`);
  return {
    title,
    explanation: [evidence, concept, honestExercise, completion].filter(Boolean).join(" "),
    variation: variation || null,
    line: line || null,
  };
}

export function coachVerdict({ strength = null, problem = null, action = null } = {}) {
  const strengthGames = count(sampleFor(strength || {}).games);
  const problemGames = count(sampleFor(problem || {}).games);
  if (strength && problem) return `Keep playing ${openingFor(strength)} based on ${plural(strengthGames, "relevant game")}; fix ${openingFor(problem)} first because it is the clearest recurring problem across ${plural(problemGames, "relevant game")}.`;
  if (strength) return `Keep playing ${openingFor(strength)} based on ${plural(strengthGames, "relevant game")}; no reliable opening weakness was found yet.`;
  if (problem) return `We do not have enough consistent results to name your strongest opening yet; fix ${openingFor(problem)} first because it is the clearest recurring problem across ${plural(problemGames, "relevant game")}.`;
  if (action?.type === "prepare_against") return `You face the ${openingFor(action)} as ${colourFor(action)} in ${plural(count(action.sample?.games), "relevant game")}; prepare one clear response before your next game.`;
  return "We do not have enough consistent results to name your strongest opening or a reliable opening weakness yet.";
}

export function analysedGameSentence(games) {
  const value = count(games);
  return `${plural(value, "game")} contained enough opening information to analyse.`;
}
