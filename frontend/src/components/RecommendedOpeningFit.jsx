import { useMemo } from "react";
import InfoHint from "./InfoHint";
import { OPENING_COPY, getOpeningRecommendationReason } from "./openingCopy";
import RecommendationReasonHint, { recommendationReasonDetails } from "./RecommendationReasonHint";
import "./RecommendedOpeningFit.css";

const TRAIT_CONFIG = [
  ["open_position_preference", "Open positions"],
  ["tactical_tendency", "Tactical play"],
  ["gambit_comfort", "Gambit comfort"],
  ["king_safety_risk", "King safety", true],
  ["endgame_conversion", "Endgame conversion"],
  ["theory_tolerance", "Theory tolerance"],
];

const STUDY_LINES = {
  "vienna game": ["1.e4 e5 2.Nc3 Nf6 3.f4", "1.e4 e5 2.Nc3 Nc6 3.Bc4", "1.e4 e5 2.Nc3 Nf6 3.g3"],
  "vienna gambit": ["1.e4 e5 2.Nc3 Nf6 3.f4", "1.e4 e5 2.Nc3 Nc6 3.f4", "1.e4 e5 2.Nc3 Bc5 3.f4"],
  "italian game": ["1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5", "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6", "1.e4 e5 2.Nf3 Nc6 3.Bc4 Be7"],
  "scotch game": ["1.e4 e5 2.Nf3 Nc6 3.d4", "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4", "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Bc4"],
  "evans gambit": ["1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4", "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4", "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bb6"],
  "queen's gambit": ["1.d4 d5 2.c4", "1.d4 d5 2.c4 e6 3.Nc3", "1.d4 d5 2.c4 dxc4 3.Nf3"],
  "london system": ["1.d4 d5 2.Bf4", "1.d4 Nf6 2.Bf4", "1.d4 d5 2.Nf3 Nf6 3.Bf4"],
  "jobava london": ["1.d4 d5 2.Nc3 Nf6 3.Bf4", "1.d4 Nf6 2.Nc3 d5 3.Bf4", "1.d4 d5 2.Nc3 e6 3.Bf4"],
  "english opening": ["1.c4 e5 2.Nc3", "1.c4 Nf6 2.Nc3", "1.c4 c5 2.Nf3"],
  "caro-kann defence": ["1.e4 c6 2.d4 d5", "1.e4 c6 2.Nc3 d5", "1.e4 c6 2.d4 d5 3.e5 Bf5"],
  "french defence": ["1.e4 e6 2.d4 d5", "1.e4 e6 2.d4 d5 3.Nc3", "1.e4 e6 2.d4 d5 3.e5 c5"],
  "sicilian defence": ["1.e4 c5", "1.e4 c5 2.Nf3 d6", "1.e4 c5 2.Nf3 Nc6"],
  "scandinavian defence": ["1.e4 d5", "1.e4 d5 2.exd5 Qxd5", "1.e4 d5 2.exd5 Nf6"],
  "nimzo-indian defence": ["1.d4 Nf6 2.c4 e6 3.Nc3 Bb4", "1.d4 Nf6 2.c4 e6 3.Nf3", "1.d4 Nf6 2.c4 e6 3.g3"],
  "grunfeld defence": ["1.d4 Nf6 2.c4 g6 3.Nc3 d5", "1.d4 Nf6 2.c4 g6 3.g3 d5", "1.d4 Nf6 2.c4 g6 3.f3 d5"],
  "gruenfeld defence": ["1.d4 Nf6 2.c4 g6 3.Nc3 d5", "1.d4 Nf6 2.c4 g6 3.g3 d5", "1.d4 Nf6 2.c4 g6 3.f3 d5"],
  "king's indian defence": ["1.d4 Nf6 2.c4 g6 3.Nc3 Bg7", "1.d4 Nf6 2.c4 g6 3.Nf3 Bg7", "1.d4 Nf6 2.c4 g6 3.g3 Bg7"],
};

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [];
}

function clamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\u00fc/g, "u")
    .replace("grunfeld", "gruenfeld")
    .trim();
}

function openingName(item) {
  if (typeof item === "string") return item;
  return item?.name || item?.opening || "Recommended opening";
}

function displayValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function confidenceFromGames(games) {
  if (games >= 10) return "High";
  if (games >= 4) return "Medium";
  if (games >= 1) return "Low";
  return "None";
}

function fallbackVerdictLabel(tone, item, games) {
  const upgrade = String(item.upgrade_type || item.upgradeType || "").toLowerCase();
  if (games > 0 && games <= 3) return "Too little data";
  if (tone === "delay" || upgrade === "replace" || upgrade === "avoid") return "Avoid for now";
  if (tone === "try" || upgrade === "new_recommendation" || upgrade === "experiment") return "Try next";
  if (upgrade === "fix") return "Improve";
  return "Keep";
}

function fallbackReasonLabel(verdictLabel) {
  if (verdictLabel === "Too little data") return "Too little data";
  if (verdictLabel === "Avoid for now") return "Not urgent";
  if (verdictLabel === "Improve") return "Needs repair";
  if (verdictLabel === "Try next") return "Too little data";
  return "Strong fit";
}

function getStyleFingerprint(data) {
  const direct = data?.styleFingerprint || data?.style_fingerprint;
  if (direct?.traits) return direct;

  const profile = data?.styleProfile || data?.style_profile || {};
  const primary = profile.primary || profile.primaryStyle || "Balanced Practical Player";
  const summary = String(profile.summary || "").toLowerCase();
  const attacking = /attack|active|tactical/.test(summary) || (profile.labels || []).some((label) => /attack|tactical/i.test(label));

  return {
    primaryStyle: attacking ? "Tactical Attacker" : primary,
    secondaryStyle: /risk|gambit|cost/.test(summary) ? "Practical Improver" : "Practical Improver",
    sampleSize: data?.gamesImported || data?.totalGames || data?.games_imported || 0,
    traits: {
      open_position_preference: attacking ? 72 : 54,
      tactical_tendency: attacking ? 76 : 54,
      gambit_comfort: /gambit/.test(summary) ? 42 : 50,
      king_safety_risk: /risk|cost|queen/.test(summary) ? 58 : 45,
      endgame_conversion: 50,
      development_speed: attacking ? 68 : 54,
    },
  };
}

function getRecommendedGroups(data) {
  const groups = data?.recommendedOpeningsByStyle || data?.recommended_openings || {};
  return {
    white: asArray(groups.white),
    blackVsE4: asArray(groups.black_vs_e4 || groups.blackVsE4),
    blackVsD4: asArray(groups.black_vs_d4 || groups.blackVsD4),
  };
}

function getAllRecommendations(data) {
  const groups = getRecommendedGroups(data);
  const modern = [
    ...groups.white.map((item) => ({ ...item, slotLabel: "White repertoire", slotKey: "white" })),
    ...groups.blackVsE4.map((item) => ({ ...item, slotLabel: "Black vs 1.e4", slotKey: "black_vs_e4" })),
    ...groups.blackVsD4.map((item) => ({ ...item, slotLabel: "Black vs 1.d4", slotKey: "black_vs_d4" })),
  ];
  if (modern.length) return modern;

  const legacy = data?.opening_recommendations || data?.openingRecommendations || {};
  return [
    ...asArray(legacy.white_repertoire || legacy.whiteDetailed).map((item) => ({ ...item, slotLabel: "White repertoire", slotKey: "white", currently_played: true, upgrade_type: "fix" })),
    ...asArray(legacy.black_vs_e4 || legacy.blackVsE4Detailed).map((item) => ({ ...item, slotLabel: "Black vs 1.e4", slotKey: "black_vs_e4", upgrade_type: "experiment" })),
    ...asArray(legacy.black_vs_d4 || legacy.blackVsD4Detailed).map((item) => ({ ...item, slotLabel: "Black vs 1.d4", slotKey: "black_vs_d4", upgrade_type: "experiment" })),
    ...asArray(legacy.black_vs_other || legacy.blackVsOtherDetailed || legacy.blackVsD4Other).map((item) => ({
      ...item,
      slotLabel: "Black vs 1.d4 / 1.c4 / 1.Nf3",
      slotKey: "black_vs_d4_other",
      upgrade_type: "experiment",
    })),
    ...asArray(legacy.experimental_rare || legacy.experimentalRare).map((item) => ({
      ...item,
      slotLabel: item.contextLabel || "Experimental line",
      slotKey: "other",
      upgrade_type: "replace",
      risk_level: "high",
      learning_cost: "medium",
    })),
  ];
}

function getBestExistingFallback(data) {
  return asArray(data?.best_openings || data?.bestOpenings || data?.top_openings || data?.topOpenings || data?.opening_stats || data?.openingStats)
    .filter((item) => openingName(item) && !/unknown/i.test(openingName(item)))
    .slice(0, 2)
    .map((item) => ({
      name: openingName(item),
      fit_score: item.fitScore || item.openingFitScore || item.score || item.winRate || item.win_rate || 60,
      games: item.games ?? item.games_played ?? item.gamesPlayed ?? item.count ?? 0,
      confidence:
        item.confidence ||
        confidenceFromGames(item.games ?? item.games_played ?? item.gamesPlayed ?? item.count ?? 0),
      confidence_level: item.confidence_level || item.confidenceLevel || "medium",
      recommendation_label: item.recommendation_label || item.recommendationLabel || "Improve",
      reason_label: item.reason_label || item.reasonLabel || "Needs repair",
      short_reason:
        item.short_reason ||
        item.shortReason ||
        "You already have practical experience here, but the next gain is a cleaner plan.",
      next_action:
        item.next_action ||
        item.nextAction ||
        "Review the first recurring position where your plan becomes unclear.",
      learning_cost: "medium",
      risk_level: "medium",
      reason: "You already have practical experience here. The next gain is a cleaner plan, not a full repertoire reset.",
      watch_out: ["Review the first recurring position where your plan becomes unclear before judging the whole opening."],
      currently_played: true,
      upgrade_type: "fix",
    }));
}

function toneForRecommendation(item) {
  const label = String(item.recommendation_label || item.recommendationLabel || item.label || "").toLowerCase();
  const upgrade = String(item.upgrade_type || item.upgradeType || "").toLowerCase();
  const risk = String(item.risk_level || item.riskLevel || "").toLowerCase();
  const learning = String(item.learning_cost || item.learningCost || "").toLowerCase();
  const theory = String(item.theory_load || item.theoryLoad || "").toLowerCase();

  if (label.includes("avoid") || upgrade === "replace" || upgrade === "avoid" || risk === "high" || learning === "high" || theory === "high") {
    return "delay";
  }
  if (label.includes("try") || upgrade === "experiment" || upgrade === "new_recommendation" || upgrade === "experimental") {
    return "try";
  }
  return "keep";
}

function slotText(item) {
  return [
    item.slotKey,
    item.slotLabel,
    item.contextLabel,
    item.context,
    item.repertoireContext,
    item.colour,
    item.color,
    item.against,
    item.side,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sectionKeyForRecommendation(item) {
  const text = slotText(item);

  if (text.includes("white")) return "white";
  if (text.includes("black") && (text.includes("1.e4") || text.includes("e4"))) return "blackVsE4";
  if (
    text.includes("black") &&
    (text.includes("1.d4") ||
      text.includes("d4") ||
      text.includes("1.c4") ||
      text.includes("c4") ||
      text.includes("1.nf3") ||
      text.includes("nf3") ||
      text.includes("other"))
  ) {
    return "blackVsD4Other";
  }
  if (text.includes("black")) return "blackOther";
  return "other";
}

function buildRepertoireSections(data) {
  const all = getAllRecommendations(data);
  const source = all.length
    ? all
    : getBestExistingFallback(data).map((item) => ({ ...item, slotKey: "other", slotLabel: "Other / unclear" }));
  const sections = {
    white: [],
    blackVsE4: [],
    blackVsD4Other: [],
    blackOther: [],
    other: [],
  };

  source.forEach((item) => {
    const sectionKey = sectionKeyForRecommendation(item);
    sections[sectionKey].push({
      ...item,
      displayTone: toneForRecommendation(item),
    });
  });

  return [
    {
      key: "white",
      eyebrow: "White openings",
      title: "Your White repertoire",
      copy: "Start here when you want one clear plan with the White pieces.",
      items: sections.white,
    },
    {
      key: "blackVsE4",
      eyebrow: "Black openings",
      title: "Black vs 1.e4",
      copy: "Use this as your main answer to White's most direct first move.",
      items: sections.blackVsE4,
    },
    {
      key: "blackVsD4Other",
      eyebrow: "Black openings",
      title: "Black vs 1.d4 / 1.c4 / 1.Nf3",
      copy: "Keep this part narrow so queen-pawn and flank games do not sprawl.",
      items: [...sections.blackVsD4Other, ...sections.blackOther],
    },
    {
      key: "other",
      eyebrow: "Other openings",
      title: "Other / unclear",
      copy: "These need more context before OpeningFit can place them cleanly.",
      items: sections.other,
    },
  ].filter((section) => section.items.length);
}

function traitValue(traits, key, invert = false) {
  if (key === "theory_tolerance") {
    return clamp(100 - Number(traits.king_safety_risk ?? 50));
  }
  const value = clamp(traits[key]);
  return invert ? clamp(100 - value) : value;
}

function styleHeadline(fingerprint) {
  const primary = fingerprint.primaryStyle || fingerprint.primary_style || "Developing Player";
  const secondary = fingerprint.secondaryStyle || fingerprint.secondary_style || "Practical Improver";
  return `${primary} / ${secondary}`;
}

function styleCoachCopy(fingerprint) {
  const traits = fingerprint.traits || {};
  const open = traitValue(traits, "open_position_preference");
  const tactical = traitValue(traits, "tactical_tendency");
  const kingSafety = traitValue(traits, "king_safety_risk", true);

  if (open >= 62 && tactical >= 62) {
    return "Your wins point toward open centres, forcing development, and positions where activity matters quickly.";
  }
  if (kingSafety < 45) {
    return "Your next opening gain is practical: castle on time, keep the centre under control, then choose active plans.";
  }
  return "Your games point toward a repertoire built around repeatable plans, not memorising every branch.";
}

function coachReason(item, traits) {
  const tags = new Set(asArray(item.style_tags || item.styleTags).map((tag) => String(tag).toLowerCase()));
  const reason = item.reason || "";
  const open = traitValue(traits, "open_position_preference");
  const tactical = traitValue(traits, "tactical_tendency");
  const development = traitValue(traits, "development_speed");
  const kingSafetyRisk = clamp(traits.king_safety_risk);

  if (tags.has("open") && tags.has("tactical") && open >= 58 && tactical >= 58) {
    return `This fits because your wins often come from open centres and forcing development, not slow manoeuvring positions.`;
  }
  if (tags.has("development") && development >= 58) {
    return `This fits because your better games show fast piece development, so you get clear plans before the middlegame gets messy.`;
  }
  if (tags.has("gambit")) {
    return kingSafetyRisk >= 55
      ? `This is tempting, but only if you keep the first version narrow because your king safety still needs discipline.`
      : `This fits your initiative streak, especially when you use the gambit to speed development rather than chase tricks.`;
  }
  if (tags.has("solid") || tags.has("system")) {
    return "This gives you a repeatable structure, useful when consistency matters more than adding theory.";
  }
  return reason || `This is here because your recent games give it enough style overlap to study without rebuilding everything.`;
}

function watchOut(item) {
  const watch = asArray(item.watch_out || item.watchOut);
  if (watch.length) return watch.slice(0, 2);

  const risk = String(item.risk_level || item.riskLevel || "medium").toLowerCase();
  if (risk === "high") return ["Do not expand the repertoire before you know the common traps and decline lines."];
  return ["Review your first uncomfortable position after move 8 and keep the study version narrow."];
}

function fitScoreTooltip({ name, fit, confidence, learning, risk, tone }) {
  const action =
    tone === "delay"
      ? "Use this to decide whether the line should stay outside your main repertoire for now."
      : tone === "existing"
        ? "Use this to decide whether an opening you already play should stay in the repertoire."
        : "Use this to decide whether this is worth a small trial before committing it to your repertoire.";
  return `${name} scores ${fit}/100 for your current game sample. Confidence is ${confidence}, learning cost is ${learning}, and risk is ${risk}. ${action}`;
}

function styleFingerprintTooltip(fingerprint) {
  const traits = fingerprint.traits || {};
  const sample = fingerprint.sampleSize || fingerprint.sample_size || "your current";
  const tactical = clamp(traits.tactical_tendency);
  const theory = clamp(traits.theory_tolerance);
  const kingSafety = clamp(traits.king_safety_risk);
  return `This explains the recommendation bias. OpeningFit read ${sample} games and saw tactical tendency ${tactical}/100, theory tolerance ${theory}/100, and king-safety risk ${kingSafety}/100. Use it to understand why some openings are suggested even if they are not the trendiest choices.`;
}

function firstLines(name) {
  const key = normalizeName(name);
  return STUDY_LINES[key] || [
    "Main line setup through move 5",
    "Most common opponent reply",
    "One safe sideline for blitz and rapid",
  ];
}

function RecommendationCard({ item, label, tone, traits, playerProfile, alternatives, onPractice }) {
  const name = openingName(item);
  const fit = clamp(item.fit_score ?? item.fitScore ?? item.score ?? 60);
  const priorityReason =
    tone === "delay"
      ? getOpeningRecommendationReason(item, item, playerProfile, { alternatives })
      : null;
  const games = Number(displayValue(item.games, item.games_played, item.gamesPlayed, item.count, 0)) || 0;
  const confidence = titleCase(displayValue(item.confidence, item.confidence_label, item.confidenceLabel, confidenceFromGames(games)));
  const verdictLabel = displayValue(
    item.recommendation_label,
    item.recommendationLabel,
    fallbackVerdictLabel(tone, item, games)
  );
  const reasonLabel = displayValue(item.reason_label, item.reasonLabel, fallbackReasonLabel(verdictLabel));
  const shortReason = displayValue(item.short_reason, item.shortReason, item.confidence_reason, item.confidenceReason, coachReason(item, traits));
  const nextAction = displayValue(item.next_action, item.nextAction, priorityReason?.action, "Review one narrow starter line before changing your repertoire.");
  const mappedReason = recommendationReasonDetails({ ...item, activeOpenings: alternatives }, verdictLabel);
  const useMappedReason =
    tone === "delay" ||
    verdictLabel === "Avoid for now" ||
    ["Poor results", "Too little data", "Style mismatch", "Repertoire overload", "Needs repair", "Not urgent"].includes(reasonLabel);
  const displayReasonLabel = useMappedReason ? mappedReason.title : reasonLabel;
  const displayReason = useMappedReason ? mappedReason.message : shortReason;
  const displayAction = useMappedReason ? mappedReason.nextStep : nextAction;
  const learning = titleCase(item.learning_cost || item.learningCost || "medium");
  const risk = titleCase(item.risk_level || item.riskLevel || "medium");
  const lines = firstLines(name);

  return (
    <article className={`recommendedOpeningCard ${tone}`}>
      <div className="recommendedOpeningCardHeader">
        <div>
          <span>{item.slotLabel || label}</span>
          <h3>{name}</h3>
        </div>
        <strong>
          <span>
            Fit score
            <InfoHint label={`Why ${name} has this fit score`}>
              {fitScoreTooltip({ name, fit, confidence, learning, risk, tone })}
            </InfoHint>
          </span>
          {fit}
        </strong>
      </div>

      <div className="recommendedOpeningVerdict">
        <strong>{verdictLabel}</strong>
        <span>{displayReasonLabel}</span>
      </div>

      <div className="recommendedOpeningMetrics" aria-label={`${name} recommendation metrics`}>
        <span>Confidence: {confidence}</span>
        <span>Games: {games}</span>
        <span>Learning: {learning}</span>
        <span>Risk: {risk}</span>
      </div>

      <div className="recommendedOpeningWhy">
        <h4>
          {displayReasonLabel}
          {useMappedReason ? (
            <RecommendationReasonHint item={{ ...item, activeOpenings: alternatives }} label={verdictLabel} />
          ) : null}
        </h4>
        <p>{displayReason}</p>
        <small>{displayAction}</small>
      </div>

      {onPractice ? (
        <button
          className="recommendedOpeningPracticeBtn"
          type="button"
          onClick={() => onPractice(item)}
        >
          Train This Line
        </button>
      ) : null}

      <div className="recommendedOpeningDetailGrid">
        <div>
          <h4>Check first</h4>
          <ul>
            {watchOut(item).map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>First lines to learn</h4>
          <ol>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  );
}

export default function RecommendedOpeningFit({ data, onPractice }) {
  const fingerprint = getStyleFingerprint(data);
  const traits = fingerprint.traits || {};
  const sections = useMemo(() => buildRepertoireSections(data || {}), [data]);
  const playerProfile = data?.styleProfile || data?.style_profile || fingerprint;
  const alternatives = sections.flatMap((section) => section.items);
  const hasAny = sections.length;

  if (!data || !hasAny) return null;

  return (
    <section className="recommendedOpeningFit" id="recommended-opening-fit" aria-labelledby="recommended-opening-fit-title">
      <div className="recommendedOpeningFitHeader">
        <div>
          <p className="eyebrow">OpeningFit recommendations</p>
          <div className="recommendedOpeningFitTitleRow">
            <h2 id="recommended-opening-fit-title">{styleHeadline(fingerprint)}</h2>
            <InfoHint label="How OpeningFit chose these openings">
              {styleFingerprintTooltip(fingerprint)} {OPENING_COPY.styleFingerprint}
            </InfoHint>
          </div>
          <p>{styleCoachCopy(fingerprint)}</p>
        </div>
        <div className="recommendedOpeningFitBadge">
          <span>Sample</span>
          <strong>{fingerprint.sampleSize || fingerprint.sample_size || data.gamesImported || data.totalGames || "New"}</strong>
        </div>
      </div>

      <div className="styleTraitGrid">
        {TRAIT_CONFIG.map(([key, label, invert]) => {
          const value = traitValue(traits, key, invert);
          return (
            <div className="styleTraitBar" key={key}>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
              <progress value={value} max="100" aria-label={`${label} ${value} out of 100`} />
            </div>
          );
        })}
      </div>

      {sections.map((section) => (
        <div className="recommendedOpeningGroup" key={section.key}>
          <div className="recommendedOpeningGroupHeader">
            <div>
              <span>{section.eyebrow}</span>
              <h3>{section.title}</h3>
            </div>
            <p>{section.copy}</p>
          </div>
          <div className="recommendedOpeningCardGrid">
            {section.items.map((item, index) => (
              <RecommendationCard
                key={`${section.key}-${openingName(item)}-${index}`}
                item={item}
                label={section.title}
                tone={item.displayTone}
                traits={traits}
                playerProfile={playerProfile}
                alternatives={alternatives}
                onPractice={onPractice}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
