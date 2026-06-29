import "./OpeningFitVerdict.css";

const VERDICT_ORDER = ["Keep", "Improve", "Avoid for now", "Try next"];

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [];
}

function openingName(item) {
  if (typeof item === "string") return item;
  return item?.name || item?.opening || item?.openingName || item?.displayName || "Opening";
}

function numberValue(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function gameCount(item) {
  return numberValue(item?.games ?? item?.games_played ?? item?.gamesPlayed ?? item?.count ?? item?.total, 0);
}

function scoreValue(item) {
  const direct = item?.score ?? item?.winRate ?? item?.win_rate ?? item?.percentage ?? item?.fit_score ?? item?.fitScore;
  if (direct === undefined || direct === null || direct === "") return null;
  const number = numberValue(direct, null);
  if (number === null) return null;
  return number <= 1 ? Math.round(number * 100) : Math.round(number);
}

function confidenceFromGames(games) {
  if (games >= 10) return "High";
  if (games >= 4) return "Medium";
  if (games >= 1) return "Low";
  return "None";
}

function coachInsights(data = {}) {
  const value = data.openingCoachInsights || data.opening_coach_insights;
  return value && typeof value === "object" ? value : null;
}

function normaliseName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function coachDiagnosticFor(data, name) {
  const diagnostics = coachInsights(data)?.openingDiagnostics;
  if (!Array.isArray(diagnostics)) return null;
  const key = normaliseName(name);
  return diagnostics.find((item) => normaliseName(item?.openingName || item?.name) === key) || null;
}

function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function issueLabel(issueType) {
  if (issueType === "opening") return "Opening issue";
  if (issueType === "transition") return "Transition issue";
  if (issueType === "middlegame") return "Later-game issue";
  if (issueType === "mixed") return "Mixed issue";
  if (issueType === "insufficient_data") return "Too little repeated data";
  return "Report signal";
}

function friendlyLabel(label, diagnostic) {
  const raw = String(diagnostic?.verdict || label || "").toLowerCase();
  if (raw.includes("avoid")) return "Park for now";
  if (raw.includes("keep")) return "Keep";
  if (raw.includes("improve")) return "Improve";
  if (raw.includes("watch")) return "Watch";
  return label === "Avoid for now" ? "Park for now" : label;
}

function normaliseLabel(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("avoid") || text.includes("replace") || text.includes("delay")) return "Avoid for now";
  if (text.includes("improve") || text.includes("repair") || text.includes("review") || text.includes("fix")) return "Improve";
  if (text.includes("try") || text.includes("next") || text.includes("experiment") || text.includes("recommend")) return "Try next";
  if (text.includes("keep") || text.includes("strong") || text.includes("main weapon") || text.includes("reliable")) return "Keep";
  return "";
}

function inferredLabel(item) {
  const explicit = normaliseLabel(
    item?.recommendation_label ||
      item?.recommendationLabel ||
      item?.label ||
      item?.verdict ||
      item?.fitVerdict ||
      item?.upgrade_type ||
      item?.upgradeType
  );
  if (explicit) return explicit;

  const games = gameCount(item);
  const score = scoreValue(item);
  if (!games) return "Try next";
  if (games <= 3) return "Try next";
  if (score === null) return "Improve";
  if (score >= 55) return "Keep";
  if (score >= 40) return "Improve";
  return "Avoid for now";
}

function shortReason(item, label) {
  const direct = item?.short_reason || item?.shortReason || item?.reason || item?.confidence_reason || item?.confidenceReason;
  if (direct) return direct;
  if (label === "Keep") return "This is the clearest opening to keep in your current plan.";
  if (label === "Improve") return "This opening is playable, but the early plan needs cleaner handling.";
  if (label === "Avoid for now") return "Park this as a main focus until the evidence is clearer or the repeated issue is fixed.";
  return "This is worth a small test before you commit study time.";
}

function nextAction(item, label) {
  const direct = item?.next_action || item?.nextAction || item?.recommendationReasonNextStep || item?.nextStep;
  if (direct) return direct;
  if (label === "Keep") return "Keep it in the repertoire and polish the common replies.";
  if (label === "Improve") return "Review one repeated branch before adding more theory.";
  if (label === "Avoid for now") return "Use a simpler line until the results stabilise.";
  return "Try a narrow starter line, then check the next 4-6 games.";
}

function decorate(item) {
  const label = inferredLabel(item);
  const games = gameCount(item);
  const confidence = item?.confidence || item?.confidence_label || item?.confidenceLabel || confidenceFromGames(games);
  return {
    item,
    label,
    name: openingName(item),
    games,
    confidence,
    reason: shortReason(item, label),
    action: nextAction(item, label),
    score: scoreValue(item),
  };
}

function explainAvoidReason(card, diagnostic) {
  const reasonText = `${card.reason} ${diagnostic?.explanation || ""}`.toLowerCase();
  if ((diagnostic?.issueType || "") === "insufficient_data" || card.games < 5) return "too little data";
  if ((diagnostic?.issueType || "") === "middlegame") return "a wider non-opening problem";
  if (/too many|overload|spread/.test(reasonText)) return "too many current openings";
  if (/style|mismatch|repertoire/.test(reasonText)) return "mismatch with your current repertoire";
  return "poor early results";
}

function collectRecommendations(data, fitData) {
  const groups = data?.recommendedOpeningsByStyle || data?.recommended_openings || {};
  const legacy = data?.opening_recommendations || data?.openingRecommendations || {};
  const simple = data?.recommendations || {};

  return [
    ...asArray(groups.white),
    ...asArray(groups.black_vs_e4 || groups.blackVsE4),
    ...asArray(groups.black_vs_d4 || groups.blackVsD4),
    ...asArray(legacy.white_repertoire || legacy.whiteDetailed),
    ...asArray(legacy.black_vs_e4 || legacy.blackVsE4Detailed),
    ...asArray(legacy.black_vs_d4 || legacy.blackVsD4Detailed),
    ...asArray(legacy.black_vs_other || legacy.blackVsOtherDetailed),
    ...asArray(legacy.experimental_rare || legacy.experimentalRare),
    ...asArray(legacy.too_little_data || legacy.tooLittleData),
    ...asArray(simple.white),
    ...asArray(simple.black),
    ...asArray(data?.best_openings || data?.bestOpenings || data?.top_openings || data?.topOpenings),
    ...asArray(fitData?.scoredOpenings),
  ].filter((item) => openingName(item) && !/unknown opening/i.test(openingName(item)));
}

function buildVerdictCards(data, fitData) {
  const used = new Set();
  const decorated = collectRecommendations(data, fitData)
    .map(decorate)
    .filter((card) => card.name && !/unknown|unclassified|unclear transposition/i.test(card.name))
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return (b.score ?? -1) - (a.score ?? -1);
    });

  return VERDICT_ORDER.map((label) => {
    const card = decorated.find((candidate) => candidate.label === label && !used.has(candidate.name.toLowerCase()));
    if (!card) return null;
    used.add(card.name.toLowerCase());
    return card;
  }).filter(Boolean);
}

export default function OpeningFitVerdict({ data, fitData, onPractice }) {
  const cards = buildVerdictCards(data || {}, fitData || {});
  if (!data || !cards.length) return null;

  return (
    <section className="openingFitVerdict" id="openingfit-verdict" aria-labelledby="openingfit-verdict-heading">
      <div className="openingFitVerdictHeader">
        <p className="eyebrow">OpeningFit verdict</p>
        <h2 id="openingfit-verdict-heading">Your simplest opening plan</h2>
        <p>Based on your recent games, here is the simplest opening plan to focus on.</p>
      </div>

      <div className="openingFitVerdictGrid">
        {cards.map((card) => {
          const diagnostic = coachDiagnosticFor(data, card.name);
          const label = friendlyLabel(card.label, diagnostic);
          const confidence = titleCase(diagnostic?.confidence || card.confidence);
          const issue = issueLabel(diagnostic?.issueType);
          const why = diagnostic?.explanation || card.reason;
          const action = diagnostic?.recommendation || card.action;
          const avoidReason = label === "Park for now" ? explainAvoidReason(card, diagnostic) : null;

          return (
          <article className="openingFitVerdictItem" key={`${card.label}-${card.name}`}>
            <span>{label}</span>
            <h3>{card.name}</h3>
            <p>{why}</p>
            <small>
              {confidence} confidence
              {card.games ? ` - ${card.games} game${card.games === 1 ? "" : "s"}` : " - no opening-specific games"}
            </small>
            <strong>{action}</strong>
            <details className="openingFitVerdictWhy">
              <summary aria-label={`Why ${card.name} is labelled ${label}`}>Why?</summary>
              <div>
                <p><b>Games analysed:</b> {diagnostic?.games || card.games || "Not enough opening-specific games"}</p>
                <p><b>Issue type:</b> {issue}</p>
                <p><b>Verdict reason:</b> {why}</p>
                {avoidReason ? <p><b>Park reason:</b> {avoidReason}.</p> : null}
                <p><b>Next action:</b> {action}</p>
              </div>
            </details>
            {onPractice ? (
              <button type="button" onClick={() => onPractice(card.item)}>
                Train This Line
              </button>
            ) : null}
          </article>
          );
        })}
      </div>
    </section>
  );
}
