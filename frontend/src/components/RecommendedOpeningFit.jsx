import { useMemo } from "react";
import InfoHint from "./InfoHint";
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

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    ...groups.white.map((item) => ({ ...item, slotLabel: "White repertoire" })),
    ...groups.blackVsE4.map((item) => ({ ...item, slotLabel: "Black vs 1.e4" })),
    ...groups.blackVsD4.map((item) => ({ ...item, slotLabel: "Black vs 1.d4" })),
  ];
  if (modern.length) return modern;

  const legacy = data?.opening_recommendations || data?.openingRecommendations || {};
  return [
    ...asArray(legacy.white_repertoire || legacy.whiteDetailed).map((item) => ({ ...item, slotLabel: "White repertoire", currently_played: true, upgrade_type: "improve" })),
    ...asArray(legacy.black_vs_e4 || legacy.blackVsE4Detailed).map((item) => ({ ...item, slotLabel: "Black vs 1.e4", upgrade_type: "new_recommendation" })),
    ...asArray(legacy.black_vs_d4 || legacy.blackVsD4Detailed).map((item) => ({ ...item, slotLabel: "Black vs 1.d4", upgrade_type: "new_recommendation" })),
    ...asArray(legacy.experimental_rare || legacy.experimentalRare).map((item) => ({
      ...item,
      slotLabel: item.contextLabel || "Experimental line",
      upgrade_type: "avoid",
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
      confidence: item.confidence || "medium",
      learning_cost: "medium",
      risk_level: "medium",
      reason: `You already have useful practical experience here, so the next gains should come from cleaner plans rather than a full repertoire reset.`,
      watch_out: ["Do not judge it from one noisy game. Review the first recurring position where your plan becomes unclear."],
      currently_played: true,
      upgrade_type: "improve",
    }));
}

function chooseRecommendations(data) {
  const all = getAllRecommendations(data);
  const isCurrentlyPlayed = (item) =>
    item.currently_played || item.currentlyPlayed || item.upgrade_type === "keep" || item.upgradeType === "keep";
  const isDelayCandidate = (item) => {
    const risk = String(item.risk_level || item.riskLevel || "").toLowerCase();
    const learning = String(item.learning_cost || item.learningCost || "").toLowerCase();
    const theory = String(item.theory_load || item.theoryLoad || "").toLowerCase();
    const upgrade = String(item.upgrade_type || item.upgradeType || "").toLowerCase();
    return upgrade === "avoid" || risk === "high" || learning === "high" || theory === "high";
  };
  const existing = all
    .filter(isCurrentlyPlayed)
    .sort((a, b) => clamp(b.fit_score ?? b.fitScore) - clamp(a.fit_score ?? a.fitScore));
  const newIdeas = all
    .filter((item) => (item.upgrade_type || item.upgradeType) === "new_recommendation" && !isDelayCandidate(item))
    .sort((a, b) => clamp(b.fit_score ?? b.fitScore) - clamp(a.fit_score ?? a.fitScore));
  const delay = all
    .filter((item) => isDelayCandidate(item) && !isCurrentlyPlayed(item))
    .sort((a, b) => clamp(b.fit_score ?? b.fitScore) - clamp(a.fit_score ?? a.fitScore));

  return {
    existing: (existing.length ? existing : getBestExistingFallback(data)).slice(0, 2),
    newIdeas: newIdeas.slice(0, 3),
    delay: delay.slice(0, 2),
  };
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
    return "Your report says the next jump is practical: castle earlier, keep the centre under control, then choose active plans.";
  }
  return "Your fingerprint is balanced enough to build a repertoire around repeatable plans instead of memorising everything.";
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
    return `This gives you a repeatable structure, useful when the report says consistency matters more than adding theory.`;
  }
  return reason || `This is here because your recent games give it enough style overlap to study without rebuilding everything.`;
}

function delayReason(item, traits) {
  const name = openingName(item);
  const learning = String(item.learning_cost || item.learningCost || "medium").toLowerCase();
  const risk = String(item.risk_level || item.riskLevel || "medium").toLowerCase();
  const theory = String(item.theory_load || item.theoryLoad || "").toLowerCase();
  const kingSafety = clamp(traits.king_safety_risk);

  if (/grunfeld|gruenfeld|king's indian/i.test(name) || theory === "high") {
    return "High theory load and sharp pawn breaks mean one missed detail can decide the game before your plans settle.";
  }
  if (risk === "high" && kingSafety >= 55) {
    return "The positions can open around your king quickly, so delay it until castling and centre control are more automatic.";
  }
  if (learning === "high") {
    return "The learning cost is high enough that it may steal study time from openings already closer to your current strengths.";
  }
  return "Keep it on the watchlist, but learn the cleaner fits first so your next games produce clearer feedback.";
}

function watchOut(item) {
  const watch = asArray(item.watch_out || item.watchOut);
  if (watch.length) return watch.slice(0, 2);

  const risk = String(item.risk_level || item.riskLevel || "medium").toLowerCase();
  if (risk === "high") return ["Do not expand the repertoire before you know the common traps and decline lines."];
  return ["Review your first uncomfortable position after move 8 and keep the study version narrow."];
}

function firstLines(name) {
  const key = normalizeName(name);
  return STUDY_LINES[key] || [
    "Main line setup through move 5",
    "Most common opponent reply",
    "One safe sideline for blitz and rapid",
  ];
}

function RecommendationCard({ item, label, tone, traits }) {
  const name = openingName(item);
  const fit = clamp(item.fit_score ?? item.fitScore ?? item.score ?? 60);
  const confidence = titleCase(item.confidence || "medium");
  const learning = titleCase(item.learning_cost || item.learningCost || "medium");
  const risk = titleCase(item.risk_level || item.riskLevel || "medium");
  const why = tone === "delay" ? delayReason(item, traits) : coachReason(item, traits);
  const lines = firstLines(name);

  return (
    <article className={`recommendedOpeningCard ${tone}`}>
      <div className="recommendedOpeningCardHeader">
        <div>
          <span>{label}</span>
          <h3>{name}</h3>
        </div>
        <strong>
          <span>
            Fit score
            <InfoHint label="Fit score details">
              Fit score blends results, sample size, style match, risk, and learning cost. It should guide study order, not overrule your repertoire by itself.
            </InfoHint>
          </span>
          {fit}
        </strong>
      </div>

      <div className="recommendedOpeningMetrics" aria-label={`${name} recommendation metrics`}>
        <span>Confidence: {confidence}</span>
        <span>Learning: {learning}</span>
        <span>Risk: {risk}</span>
      </div>

      <div className="recommendedOpeningWhy">
        <h4>Why it fits</h4>
        <p>{why}</p>
      </div>

      <div className="recommendedOpeningDetailGrid">
        <div>
          <h4>Watch out</h4>
          <ul>
            {watchOut(item).map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>First 3 lines to learn</h4>
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

export default function RecommendedOpeningFit({ data }) {
  const fingerprint = getStyleFingerprint(data);
  const traits = fingerprint.traits || {};
  const recommendations = useMemo(() => chooseRecommendations(data || {}), [data]);
  const hasAny =
    recommendations.existing.length || recommendations.newIdeas.length || recommendations.delay.length;

  if (!data || !hasAny) return null;

  return (
    <section className="recommendedOpeningFit" id="recommended-opening-fit" aria-labelledby="recommended-opening-fit-title">
      <div className="recommendedOpeningFitHeader">
        <div>
          <p className="eyebrow">OpeningFit recommendations</p>
          <div className="recommendedOpeningFitTitleRow">
            <h2 id="recommended-opening-fit-title">{styleHeadline(fingerprint)}</h2>
            <InfoHint label="Style fingerprint details">
              Your style fingerprint is inferred from recurring patterns in your games, such as open positions, tactics, development speed, and king safety.
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

      {recommendations.existing.length ? (
        <div className="recommendedOpeningGroup">
          <div className="recommendedOpeningGroupHeader">
            <span>Best openings you already play</span>
            <h3>Keep improving what is already working.</h3>
          </div>
          <div className="recommendedOpeningCardGrid">
            {recommendations.existing.map((item) => (
              <RecommendationCard
                key={`existing-${openingName(item)}`}
                item={item}
                label={`Keep improving${item.slotLabel ? `: ${item.slotLabel}` : ""}`}
                tone="keep"
                traits={traits}
              />
            ))}
          </div>
        </div>
      ) : null}

      {recommendations.newIdeas.length ? (
        <div className="recommendedOpeningGroup">
          <div className="recommendedOpeningGroupHeader">
            <span>New openings to consider</span>
            <h3>Try these before adding more theory.</h3>
          </div>
          <div className="recommendedOpeningCardGrid">
            {recommendations.newIdeas.map((item) => (
              <RecommendationCard
                key={`new-${openingName(item)}`}
                item={item}
                label={`Try next${item.slotLabel ? `: ${item.slotLabel}` : ""}`}
                tone="try"
                traits={traits}
              />
            ))}
          </div>
        </div>
      ) : null}

      {recommendations.delay.length ? (
        <div className="recommendedOpeningGroup">
          <div className="recommendedOpeningGroupHeader">
            <span>Openings to avoid or delay</span>
            <h3>Keep these on the bench for now.</h3>
          </div>
          <div className="recommendedOpeningCardGrid">
            {recommendations.delay.map((item) => (
              <RecommendationCard
                key={`delay-${openingName(item)}`}
                item={item}
                label={`Delay for now${item.slotLabel ? `: ${item.slotLabel}` : ""}`}
                tone="delay"
                traits={traits}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
