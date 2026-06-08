import { useMemo } from "react";
import { getOpeningConfidence, getOpeningContext, getOpeningSignal } from "./OpeningEvidence";

const MIN_RELIABLE_GAMES = 5;

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    return Object.entries(value).map(([name, stats]) => ({
      name,
      ...(stats && typeof stats === "object" ? stats : {}),
    }));
  }
  return [];
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function openingName(item, fallback = "") {
  if (typeof item === "string") return item;

  return (
    item?.name ||
    item?.opening ||
    item?.opening_name ||
    item?.eco_name ||
    item?.ecoName ||
    item?.family ||
    item?.label ||
    fallback
  );
}

function isUsefulOpeningName(name) {
  const lower = normalizeName(name);
  return lower && !lower.includes("unknown") && !lower.includes("uncommon");
}

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace("%", ""));
  return Number.isFinite(number) ? number : fallback;
}

function games(item) {
  return numberValue(
    item?.games ?? item?.count ?? item?.total ?? item?.played ?? item?.sample,
    0
  );
}

function score(item) {
  const direct =
    item?.winRate ??
    item?.win_rate ??
    item?.scoreRate ??
    item?.score_rate ??
    item?.score ??
    item?.percentage ??
    item?.performance;

  const parsed = numberValue(direct);
  if (parsed !== null) return Math.round(parsed <= 1 ? parsed * 100 : parsed);

  const wins = numberValue(item?.wins ?? item?.won ?? item?.w, 0);
  const draws = numberValue(item?.draws ?? item?.drawn ?? item?.d, 0);
  const total = games(item);

  if (!total) return null;
  return Math.round(((wins + draws * 0.5) / total) * 100);
}

function side(item) {
  return String(
    item?.context ||
      item?.contextLabel ||
      item?.context_label ||
      item?.colour ||
      item?.color ||
      item?.side ||
      item?.as ||
      item?.player_color ||
      ""
  ).toLowerCase();
}

function verdict(item) {
  return (
    item?.fitVerdict ||
    item?.fit_verdict ||
    item?.verdict ||
    item?.recommendation ||
    item?.status ||
    ""
  );
}

function textField(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function confidence(item) {
  return getOpeningConfidence(item);
}

function colorSignal(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("white")) return "white";
  if (text.includes("black")) return "black";
  return "";
}

function firstMoveSignal(value) {
  const text = String(value || "").toLowerCase();
  if (
    text.includes("black_vs_e4") ||
    text.includes("blackvse4") ||
    text.includes("vs 1.e4") ||
    text.includes("vs e4")
  ) {
    return "e4";
  }
  if (
    text.includes("black_vs_d4") ||
    text.includes("blackvsd4") ||
    text.includes("vs 1.d4") ||
    text.includes("vs d4") ||
    text.includes("1.c4") ||
    text.includes("1.nf3")
  ) {
    return "d4";
  }
  return "";
}

function collectStats(data) {
  const sources = [
    data?.opening_stats,
    data?.openingStats,
    data?.top_openings,
    data?.topOpenings,
    data?.best_openings,
    data?.bestOpenings,
    data?.preferred_white,
    data?.preferredWhite,
    data?.preferred_black,
    data?.preferredBlack,
    data?.openings,
    data?.openingTable,
    data?.opening_table,
  ];

  const byName = new Map();

  sources.flatMap(asArray).forEach((item) => {
    const name = openingName(item);
    const key = normalizeName(name);
    if (!isUsefulOpeningName(name)) return;

    const row = {
      ...item,
      name,
      games: games(item),
      score: score(item),
      side: side(item),
      verdict: verdict(item),
    };
    byName.set(key, [...(byName.get(key) || []), row]);
  });

  return byName;
}

function statMatchesContext(stat, source, preferredSide = "") {
  const sourceSide = side(source);
  const statSide = side(stat);
  const sourceColor = colorSignal(sourceSide);
  const statColor = colorSignal(statSide);
  const wantedColor =
    preferredSide === "white" || preferredSide === "black"
      ? preferredSide
      : sourceColor ||
        (preferredSide === "e4" || preferredSide === "d4" ? "black" : "");

  if (wantedColor && statColor && statColor !== wantedColor) return false;
  if (sourceColor && statColor && sourceColor !== statColor) return false;

  const sourceMove = firstMoveSignal(sourceSide);
  const statMove = firstMoveSignal(statSide);
  const wantedMove =
    preferredSide === "e4" || preferredSide === "d4" ? preferredSide : sourceMove;

  if (wantedMove && statMove && statMove !== wantedMove) return false;
  if (sourceMove && statMove && sourceMove !== statMove) return false;

  return true;
}

function statContextScore(stat, source, preferredSide = "") {
  const statSide = side(stat);
  const sourceSide = side(source);
  const wantedColor =
    preferredSide === "white" || preferredSide === "black"
      ? preferredSide
      : colorSignal(sourceSide);
  const wantedMove =
    preferredSide === "e4" || preferredSide === "d4"
      ? preferredSide
      : firstMoveSignal(sourceSide);

  return (
    (wantedColor && colorSignal(statSide) === wantedColor ? 30 : 0) +
    (wantedMove && firstMoveSignal(statSide) === wantedMove ? 35 : 0) +
    (score(stat) !== null ? 12 : 0) +
    Math.min(games(stat), 20)
  );
}

function findStatForItem(source, statsByName, preferredSide = "") {
  const name = openingName(source);
  const stats = statsByName.get(normalizeName(name)) || [];

  if (!stats.length) return {};

  const compatible = stats.filter((stat) =>
    statMatchesContext(stat, source, preferredSide)
  );

  return [...compatible].sort((a, b) => {
    const byContext =
      statContextScore(b, source, preferredSide) -
      statContextScore(a, source, preferredSide);
    if (byContext !== 0) return byContext;
    return games(b) - games(a);
  })[0] || {};
}

function mergeWithStats(item, statsByName, context, preferredSide = "") {
  const source = typeof item === "string" ? { name: item } : item || {};
  const name = openingName(source);
  const stat = findStatForItem(source, statsByName, preferredSide);

  return {
    ...stat,
    ...source,
    name: name || openingName(stat),
    games: games(source) || games(stat),
    score: score(source) ?? score(stat),
    side: side(source) || side(stat),
    verdict: verdict(source) || verdict(stat),
    context,
    hasContextEvidence: Boolean(context && context !== "main_black_signal"),
    hasMetricEvidence: Boolean(
      games(source) ||
        games(stat) ||
        score(source) !== null ||
        score(stat) !== null
    ),
  };
}

function recommendationBuckets(data) {
  const rec =
    data?.opening_recommendations ||
    data?.openingRecommendations ||
    data?.recommendedOpenings ||
    {};

  return {
    white: [
      ...asArray(rec.white_repertoire),
      ...asArray(rec.whiteDetailed),
      ...asArray(rec.white),
      ...asArray(data?.preferred_white),
      ...asArray(data?.preferredWhite),
    ],
    blackVsE4: [
      ...asArray(rec.black_vs_e4),
      ...asArray(rec.blackVsE4Detailed),
      ...asArray(rec.blackVsE4),
    ],
    blackVsD4: [
      ...asArray(rec.black_vs_d4),
      ...asArray(rec.blackVsD4Detailed),
      ...asArray(rec.blackVsD4),
    ],
    blackVsOther: [
      ...asArray(rec.black_vs_other),
      ...asArray(rec.blackVsOtherDetailed),
      ...asArray(rec.blackVsOther),
    ],
    blackLegacyD4Other: [
      ...asArray(rec.black_vs_d4_other),
      ...asArray(rec.blackVsD4OtherDetailed),
      ...asArray(rec.blackVsD4Other),
    ],
    blackGeneral: [
      ...asArray(rec.blackDetailed),
      ...asArray(rec.black),
      ...asArray(data?.preferred_black),
      ...asArray(data?.preferredBlack),
    ],
  };
}

function candidateScore(item, preferredContext) {
  const count = games(item);
  const pct = score(item) ?? 50;
  const label = String(verdict(item)).toLowerCase();
  const explicitContext = side(item);
  const signal = getOpeningSignal(item);
  const contextBonus =
    preferredContext && explicitContext.includes(preferredContext) ? 35 : 0;
  const enoughGames = signal.tier === "strong" ? 26 : signal.tier === "medium" ? 14 : -30;
  const metricsBonus = item?.hasMetricEvidence ? 8 : -12;
  const verdictBonus =
    label.includes("keep") || label.includes("recommend") || label.includes("main")
      ? 15
      : label.includes("avoid")
        ? -18
        : label.includes("improve")
          ? 3
          : 0;

  return contextBonus + enoughGames + metricsBonus + Math.min(count, 20) + pct / 5 + verdictBonus;
}

function pickBest(items, statsByName, context, preferredSide = "") {
  const candidates = items
    .map((item) => mergeWithStats(item, statsByName, context, preferredSide))
    .filter((item) => isUsefulOpeningName(item.name));

  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    const byScore = candidateScore(b, preferredSide) - candidateScore(a, preferredSide);
    if (byScore !== 0) return byScore;
    return games(b) - games(a);
  })[0];
}

function sideAwareStats(statsByName, wantedSide) {
  return Array.from(statsByName.values()).flat().filter((item) => {
    return getOpeningContext(item).type === wantedSide;
  });
}

function deriveVerdict(item) {
  const existing = verdict(item);
  if (existing) return String(existing);

  const pct = score(item);

  if (!hasReliableEvidence(item)) return "Not enough data";
  if (pct === null) return "Evidence found";
  if (pct >= 58) return "Keep";
  if (pct >= 45) return "Improve";
  return "Review";
}

function metricLine(item) {
  if (!item) return "Needs more games";

  const parts = [];
  const count = games(item);
  const pct = score(item);

  if (count) parts.push(`${count} game${count === 1 ? "" : "s"}`);
  if (pct !== null) parts.push(`${pct}% score`);

  return parts.length ? parts.join(" · ") : "Metrics missing";
}

function hasReliableEvidence(item) {
  if (!item) return false;
  const context = getOpeningContext(item);
  return (
    context.isRepertoire &&
    (games(item) >= MIN_RELIABLE_GAMES ||
      (item.hasContextEvidence && score(item) !== null && getOpeningSignal(item).canBePrimary))
  );
}

function missingReason(slot) {
  if (slot === "white") {
    return "The import does not have enough clearly labelled White opening games yet.";
  }

  if (slot === "black-e4") {
    return "The current data does not reliably classify your Black games by opponent first move against 1.e4.";
  }

  return "The current data does not reliably isolate Black games against 1.d4, 1.c4, 1.Nf3, or related setups.";
}

function meaning(item, slot) {
  if (!hasReliableEvidence(item)) {
    return item
      ? `${openingName(item, "This opening")} appears in the report, but the sample is too thin or missing metrics, so treat it as a watch item.`
      : missingReason(slot);
  }

  const name = openingName(item, "this opening");
  const count = games(item);
  const pct = score(item);
  const explicitReason = textField(item, [
    "whatThisMeans",
    "what_this_means",
    "reason",
    "summary",
    "recommendationCopy",
  ]);

  if (explicitReason) return explicitReason;

  if (count < 3) return `${name} is visible in your games, but the sample is still too small to trust.`;
  if (getOpeningSignal(item).tier === "medium") return `${name} is a useful signal, but confirm it with a few more games before treating it as settled.`;
  if (pct !== null && pct >= 55) return `${name} is a practical direction to build around in your next game block.`;
  if (pct !== null && pct < 45) return `${name} is showing up often enough to review before you make it a core choice.`;
  return `${name} is a usable signal, but the report needs a bigger sample before treating it as settled.`;
}

function nextAction(item, slot) {
  const context = getOpeningContext(item || {});
  const explicitAction = textField(item, [
    "nextStudyAction",
    "next_study_action",
    "studyAction",
    "study_action",
    "action",
    "plan",
  ]);

  if (item && !context.canRecommend) {
    return context.type === "faced"
      ? `Review how you handled ${openingName(item, "this opening")}; do not add it to your repertoire unless your games also show you play it from your side.`
      : `Track ${openingName(item, "this opening")} by side/context before treating it as repertoire advice.`;
  }

  if (explicitAction) return explicitAction;

  if (!hasReliableEvidence(item)) {
    if (item) {
      return `Collect 5 more side-specific games with ${openingName(item, "this opening")} and re-import so the report can measure it properly.`;
    }

    if (slot === "white") return "Play 5 to 8 White games with one consistent first-move setup, then import again.";
    return "Play a small block as Black and keep the same response when the matching first move appears.";
  }

  const name = openingName(item, "this opening");
  const pct = score(item);

  if (pct !== null && pct < 45) {
    return `Replay your last 3 ${name} losses and mark the first repeated uncomfortable position.`;
  }

  return `Save one simple move-10 plan for ${name}, then use it for your next focused game block.`;
}

function buildPlan(data) {
  const statsByName = collectStats(data || {});
  const buckets = recommendationBuckets(data || {});
  const allStats = Array.from(statsByName.values()).flat();

  const white =
    pickBest(buckets.white, statsByName, "played_as_white", "white") ||
    pickBest(sideAwareStats(statsByName, "white"), statsByName, "played_as_white", "white");

  const blackVsE4 = pickBest(buckets.blackVsE4, statsByName, "black_vs_e4", "e4");
  const explicitD4 =
    pickBest(buckets.blackVsD4, statsByName, "black_vs_d4", "d4") ||
    pickBest(buckets.blackLegacyD4Other, statsByName, "black_vs_d4", "d4");
  const blackVsOther =
    pickBest(buckets.blackVsOther, statsByName, "black_vs_other", "black") ||
    pickBest(
      buckets.blackLegacyD4Other.filter((item) => !/queen|dutch|nimzo|king.?s indian|slav|benoni|benko|englund/i.test(String(item?.name || ""))),
      statsByName,
      "black_vs_other",
      "black"
    );
  const blackFallback =
    explicitD4 ||
    pickBest(
      [
        ...buckets.blackGeneral,
        ...sideAwareStats(statsByName, "black").filter(
          (item) => normalizeName(item.name) !== normalizeName(blackVsE4?.name)
        ),
      ],
      statsByName,
      "main_black_signal",
      "black"
    );

  const d4Cautious = !explicitD4 && blackFallback;
  const mixedSignals = allStats
    .filter((item) => {
      const type = getOpeningContext(item).type;
      return type === "mixed" || type === "faced";
    })
    .sort((a, b) => games(b) - games(a))
    .slice(0, 3);
  const actionSources = [
    { item: white, slot: "white" },
    { item: blackVsE4, slot: "black-e4" },
    { item: explicitD4 || blackFallback, slot: "black-d4" },
    { item: blackVsOther, slot: "black-other" },
  ];
  const actions = actionSources
    .map(({ item, slot }) => nextAction(item, slot))
    .filter(Boolean);

  while (actions.length < 3) {
    actions.push(
      actions.length === 0
        ? "Choose one White opening to repeat for a short focused block."
        : actions.length === 1
          ? "Keep one Black response consistent long enough for the report to measure it."
          : "Re-import after the focused block and compare whether the same opening problem repeats."
    );
  }

  return {
    white,
    blackVsE4,
    blackVsD4: explicitD4 || blackFallback,
    blackVsOther,
    mixedSignals,
    d4Cautious,
    actions: actions.slice(0, 3),
  };
}

function PlanCard({ title, item, slot, cautiousLabel }) {
  const reliable = hasReliableEvidence(item);
  const missing = !reliable;
  const displayName = missing ? "Not enough reliable data yet" : openingName(item);
  const context = getOpeningContext(item || {});

  return (
    <article className={`fitPlanCard ${missing ? "fitPlanCardMissing" : ""}`}>
      <div className="fitPlanCardTop">
        <span>{title}</span>
        <small>{missing ? "Needs sample" : confidence(item)}</small>
      </div>
      {cautiousLabel ? <div className="fitPlanContext">{cautiousLabel}</div> : null}
      <h3>{displayName}</h3>
      <div className="fitPlanContext">{context.label}</div>
      <dl>
        <div>
          <dt>Games / score</dt>
          <dd>{metricLine(item)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{confidence(item)}</dd>
        </div>
        <div>
          <dt>Verdict</dt>
          <dd>{missing ? "Not enough data" : deriveVerdict(item)}</dd>
        </div>
      </dl>
      <div className="fitPlanCopyGroup">
        <span>What this means</span>
        <p>{meaning(item, slot)}</p>
      </div>
      <div className="fitPlanCopyGroup">
        <span>Next study action</span>
        <strong>{nextAction(item, slot)}</strong>
      </div>
    </article>
  );
}

function MixedSignalsCard({ items }) {
  return (
    <article className="fitPlanCard fitPlanCardMissing">
      <div className="fitPlanCardTop">
        <span>Mixed / unclear signals</span>
        <small>Hold</small>
      </div>
      <h3>{items.length ? "Track before recommending" : "No mixed signals found"}</h3>
      <div className="fitPlanCopyGroup">
        <span>What this means</span>
        <p>
          {items.length
            ? "These openings appear in your games, but the current data is not clear enough to treat them as clean repertoire recommendations."
            : "The report did not find opponent-only or mixed-side signals that need separating."}
        </p>
      </div>
      {items.length ? (
        <ul className="fitPlanSignalList">
          {items.map((item) => (
            <li key={`${openingName(item)}-${getOpeningContext(item).label}`}>
              {openingName(item)} · {getOpeningContext(item).label} · {metricLine(item)}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export default function OpeningFitRepertoirePlan({ data }) {
  const plan = useMemo(() => buildPlan(data || {}), [data]);

  if (!data) return null;

  return (
    <section className="openingFitPlanShell" id="opening-fit-repertoire-plan">
      <div className="openingFitPlanHeader">
        <span>Opening Fit Repertoire Plan</span>
        <h2>Your Opening Fit Repertoire Plan</h2>
        <p>A practical repertoire plan from your imported games.</p>
      </div>

      <div className="openingFitPlanGrid">
        <PlanCard title="Your White plan" item={plan.white} slot="white" />
        <PlanCard title="Black vs 1.e4" item={plan.blackVsE4} slot="black-e4" />
        <PlanCard
          title="Black vs 1.d4"
          item={plan.blackVsD4}
          slot="black-d4"
          cautiousLabel={
            plan.d4Cautious
              ? "Closest available Black opening signal, not confirmed as 1.d4-specific."
              : null
          }
        />
        <PlanCard title="Black vs other first moves" item={plan.blackVsOther} slot="black-other" />
        <MixedSignalsCard items={plan.mixedSignals} />
        <article className="fitPlanCard fitPlanActionsCard">
          <div className="fitPlanCardTop">
            <span>Your next 3 study actions</span>
            <small>Next block</small>
          </div>
          <ol>
            {plan.actions.map((action, index) => (
              <li key={`${action}-${index}`}>{action}</li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}
