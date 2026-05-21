import "./EvidenceBackedOpeningDiagnosis.css";
import { getPlayerLevelText } from "./playerLevelLogic";
import { getOpeningConfidence, getOpeningSignal } from "./OpeningEvidence";

function toArray(value) {
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

function number(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getOpeningName(item) {
  if (typeof item === "string") return item;

  return (
    item?.name ||
    item?.opening ||
    item?.opening_name ||
    item?.eco_name ||
    item?.family ||
    "Unknown opening"
  );
}

function getGames(item) {
  return number(item?.games ?? item?.total ?? item?.count ?? item?.played ?? 0);
}

function getWins(item) {
  return number(item?.wins ?? item?.w ?? item?.won ?? 0);
}

function getDraws(item) {
  return number(item?.draws ?? item?.d ?? item?.drawn ?? 0);
}

function getLosses(item) {
  return number(item?.losses ?? item?.l ?? item?.lost ?? 0);
}

function getScore(item) {
  const raw =
    item?.win_rate ??
    item?.winRate ??
    item?.score ??
    item?.scoreRate ??
    item?.score_rate ??
    item?.percentage;

  if (raw !== undefined && raw !== null && raw !== "") {
    const parsed = number(raw);
    return parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed);
  }

  const games = getGames(item);
  if (!games) return 0;

  return Math.round(((getWins(item) + getDraws(item) * 0.5) / games) * 100);
}

function getSide(item) {
  const side = String(
    item?.colour || item?.color || item?.side || item?.player_color || ""
  ).toLowerCase();

  if (side.includes("white")) return "as White";
  if (side.includes("black")) return "as Black";

  return "in your games";
}

function getPlayerTier(data) {
  const rating = number(
    data?.rating ??
      data?.chesscomRating ??
      data?.chesscom_rating ??
      data?.lichessRating ??
      data?.lichess_rating ??
      data?.rapidRating ??
      data?.rapid_rating ??
      data?.blitzRating ??
      data?.blitz_rating ??
      data?.bulletRating ??
      data?.bullet_rating ??
      data?.player_level?.rating ??
      data?.playerLevel?.rating ??
      0
  );
  const level = getPlayerLevelText(data).toLowerCase();
  const title = String(
    data?.title ??
      data?.chessTitle ??
      data?.chess_title ??
      data?.fideTitle ??
      data?.fide_title ??
      data?.playerTitle ??
      data?.player_title ??
      data?.profile?.title ??
      ""
  )
    .trim()
    .toLowerCase();
  const titledPlayer = ["gm", "im", "fm", "cm", "wgm", "wim", "wfm", "wcm"].includes(title);

  if (rating >= 2400 || titledPlayer || level.includes("master") || level.includes("elite")) {
    return "elite";
  }

  if (rating >= 2200 || level.includes("expert")) return "strong";
  if (rating >= 1800 || level.includes("advanced")) return "club";
  return "developing";
}

function isPublicMode(data) {
  const mode = data?.reportMode || data?.report_mode;
  if (mode && mode !== "normal_user") return true;
  const tier = getPlayerTier(data);
  return tier === "elite" || tier === "strong";
}

function collectOpenings(data) {
  const sources = [
    data?.opening_stats,
    data?.openingStats,
    data?.top_openings,
    data?.topOpenings,
    data?.best_openings,
    data?.bestOpenings,
    data?.openings,
    data?.opening_table,
    data?.openingTable,
  ];

  const merged = new Map();

  sources.flatMap(toArray).forEach((item) => {
    const name = getOpeningName(item);
    const key = String(name).toLowerCase().trim();

    if (!key || key.includes("unknown") || key.includes("uncommon")) return;

    const existing = merged.get(key);

    if (!existing || getGames(item) > getGames(existing)) {
      merged.set(key, {
        ...item,
        name,
      });
    }
  });

  return Array.from(merged.values())
    .filter((item) => getGames(item) > 0)
    .sort((a, b) => getGames(b) - getGames(a))
    .slice(0, 6);
}

function getAverage(openings) {
  const total = openings.reduce(
    (acc, item) => {
      const games = getGames(item);
      const score = getScore(item);

      if (!games) return acc;

      return {
        games: acc.games + games,
        points: acc.points + games * score,
      };
    },
    { games: 0, points: 0 }
  );

  return total.games ? Math.round(total.points / total.games) : 50;
}

function getVerdict(item, average, data, index = 0) {
  const explicit = String(
    item?.fitVerdict || item?.fit_verdict || item?.verdict || item?.recommendation || ""
  ).toLowerCase();
  const tier = getPlayerTier(data);
  const publicMode = isPublicMode(data);
  const games = getGames(item);
  const score = getScore(item);
  const signal = getOpeningSignal(item);
  const mainOpening = index <= 2 && signal.tier === "strong";

  if (publicMode && !signal.canBePrimary) return "Not enough context to judge";
  if (publicMode && (explicit.includes("avoid") || explicit.includes("review"))) return "Recent underperformer";
  if (publicMode && (explicit.includes("improve") || explicit.includes("promising"))) return "Lower-scoring sample";
  if (publicMode && (explicit.includes("keep") || explicit.includes("reliable"))) return "Recent strength";

  if (explicit.includes("main weapon") || explicit.includes("core") || explicit.includes("trusted")) return "Main weapon";
  if (explicit.includes("keep") || explicit.includes("reliable")) return "Reliable choice";
  if (explicit.includes("promising") || explicit.includes("fine") || explicit.includes("improve")) return "Promising but unstable";
  if (explicit.includes("review") || explicit.includes("performance") || explicit.includes("avoid")) return "Needs review";

  if (signal.tier === "none") return "No reliable data";
  if (signal.tier === "low") return "Too few games";

  if (tier === "elite") {
    if (mainOpening && score >= 45) return publicMode ? "Recent strength" : "Main weapon";
    if (mainOpening) return publicMode ? "Lower-scoring sample" : "Needs review";
    if (games >= 20 && score < 25) return publicMode ? "Recent underperformer" : "Needs review";
    if (score < 45) return publicMode ? "Lower-scoring sample" : "Promising but unstable";
    return publicMode ? "Recent strength" : "Reliable choice";
  }

  if (tier === "strong") {
    if (mainOpening && score >= 45) return "Main weapon";
    if (mainOpening && score >= 35) return "Promising but unstable";
    if (score < 40) return "Needs review";
    return "Reliable choice";
  }

  if (games >= 6 && score >= Math.max(55, average + 5)) return "Reliable choice";
  if (games >= 6 && score <= Math.min(42, average - 8)) return "Needs review";

  return "Promising but unstable";
}

function getConfidence(games) {
  const label = getOpeningConfidence({ games, score: 50 });
  if (label === "High confidence") return "High confidence: repeated enough to treat as a reliable pattern.";
  if (label === "Medium confidence") return "Medium confidence: useful, but still worth confirming with more games.";
  if (label === "Insufficient data") return "Insufficient data: import games before making a verdict.";
  return "Low confidence: too few games for a hard verdict yet.";
}

function getOpeningRead(name) {
  const lower = String(name).toLowerCase();

  if (lower.includes("vienna")) {
    return "This is usually about active development, fast kingside pressure, and knowing what to do when Black hits the centre early.";
  }

  if (lower.includes("scandinavian")) {
    return "This often comes down to whether the queen move sequence is automatic or whether you are losing tempi before the middlegame starts.";
  }

  if (lower.includes("caro")) {
    return "This tends to reward solid structure, but it can become too passive if you defend without using the right pawn breaks.";
  }

  if (lower.includes("sicilian")) {
    return "This creates real winning chances, but it punishes mixed systems and vague move orders very quickly.";
  }

  if (lower.includes("london")) {
    return "This gives repeatable development, but the results suffer if you play the setup without reacting to Black’s structure.";
  }

  if (lower.includes("gambit") || lower.includes("englund")) {
    return "This can create tactical chances, but the downside is brutal when the attack does not land.";
  }

  return "The useful question is not only the opening name. It is where your first uncomfortable middlegame position appears.";
}

function buildReason(item, average, verdict) {
  const name = getOpeningName(item);
  const games = getGames(item);
  const score = getScore(item);
  const wins = getWins(item);
  const draws = getDraws(item);
  const losses = getLosses(item);
  const diff = Math.round(score - average);

  const comparison =
    diff > 7
      ? `${diff}% above your current opening average`
      : diff < -7
        ? `${Math.abs(diff)}% below your current opening average`
        : "roughly in line with your current opening average";

  const record =
    wins || draws || losses
      ? `${wins} wins, ${draws} draws and ${losses} losses`
      : `${games} games reviewed`;

  if (["Recent strength", "Main weapon", "Reliable choice"].includes(verdict)) {
    return {
      title:
        verdict === "Recent strength"
          ? `${name} is a recent strength sample.`
          : verdict === "Main weapon"
          ? `${name} looks like a main weapon in this side/context.`
          : `${name} is earning its place.`,
      body:
        verdict === "Recent strength"
          ? `This imported online sample scores ${score}% over ${games} games ${getSide(item)}, which is ${comparison}. The record behind that is ${record}, so this is a recent trend signal only.`
          : `You are scoring ${score}% over ${games} games ${getSide(item)}, which is ${comparison}. The record behind that is ${record}, so this looks like a meaningful repertoire signal rather than one isolated result.`,
      action:
        verdict === "Recent strength"
          ? "Compare this against time control, opponent pool, and event context before drawing broader repertoire conclusions."
          : "Keep it in the repertoire only for the side/context shown here. Review the reply or structure that currently makes the position least comfortable instead of replacing the opening.",
    };
  }

  if (["Recent underperformer", "Lower-scoring sample", "Needs review", "Promising but unstable"].includes(verdict)) {
    return {
      title:
        verdict === "Recent underperformer" || verdict === "Lower-scoring sample"
          ? `${name} is a lower-scoring recent sample.`
          : `${name} deserves targeted review.`,
      body:
        verdict === "Recent underperformer" || verdict === "Lower-scoring sample"
          ? `This imported online sample scores ${score}% over ${games} games ${getSide(item)}, which is ${comparison}. The record behind that is ${record}, but this should not be treated as a judgement of actual opening knowledge.`
          : `You are scoring ${score}% over ${games} games ${getSide(item)}, which is ${comparison}. The record behind that is ${record}, so this is worth treating as a practical problem, not just bad luck.`,
      action:
        verdict === "Recent underperformer" || verdict === "Lower-scoring sample"
          ? "Check time control, opponent pool, colour/context, and whether these games were experimental before making claims."
          : "Look for repeated loss patterns, move-order issues, or middlegame structures before making a repertoire change.",
    };
  }

  return {
    title: `${name} sits in the repair zone.`,
    body: `You are scoring ${score}% over ${games} games ${getSide(item)}, which is ${comparison}. The record behind that is ${record}, so the opening looks playable but not automatic yet.`,
    action: "Do not drop it yet. Give it one focused study session, then re-import after another 10–20 games.",
  };
}

export default function EvidenceBackedOpeningDiagnosis({ data, onPractice }) {
  const openings = collectOpenings(data);

  if (!data || openings.length === 0) return null;

  const average = getAverage(openings);
  const tier = getPlayerTier(data);
  const strongProfile = tier === "elite" || tier === "strong";

  return (
    <section className="evidenceDiagnosisShell" id="opening-evidence">
      <div className="evidenceDiagnosisHeader">
        <div>
          <p className="evidenceEyebrow">Evidence, not vibes</p>
          <h2>Why these openings got their verdicts</h2>
          <p>
            OpeningFit is comparing each opening against your own results, not a generic
            list of fashionable openings. Your current opening average is{" "}
            <strong>{average}%</strong>, so the key question is whether each opening is
            {strongProfile
              ? " a trusted weapon, a review target, or too small a sample to judge."
              : " helping, repairable, or quietly costing points."}
          </p>
        </div>

        <div className="evidenceAverageCard">
          <span>Your opening average</span>
          <strong>{average}%</strong>
          <small>weighted by games played</small>
        </div>
      </div>

      <div className="evidenceDiagnosisList">
        {openings.map((opening, index) => {
          const name = getOpeningName(opening);
          const games = getGames(opening);
          const score = getScore(opening);
          const verdict = getVerdict(opening, average, data, index);
          const reason = buildReason(opening, average, verdict);
          const diff = Math.round(score - average);

          return (
            <article
              className={`evidenceCard evidenceCard--${verdict
                .toLowerCase()
                .replaceAll(" ", "-")}`}
              key={`${name}-${games}-${score}`}
            >
              <div className="evidenceCardTop">
                <div>
                  <span className="evidenceOpeningSide">{getSide(opening)}</span>
                  <h3>{name}</h3>
                </div>

                <div className="evidenceVerdictStack">
                  <span className="evidenceScore">{score}%</span>
                  <span className="evidenceVerdict">{verdict}</span>
                </div>
              </div>

              <div className="evidenceMetaGrid">
                <div>
                  <span>Games</span>
                  <strong>{games}</strong>
                </div>

                <div>
                  <span>Vs average</span>
                  <strong>
                    {diff > 0 ? "+" : ""}
                    {diff}%
                  </strong>
                </div>

                <div>
                  <span>Confidence</span>
                  <strong>{getConfidence(games)}</strong>
                </div>
              </div>

              <div className="evidenceReasonBlock">
                <h4>{reason.title}</h4>
                <p>{reason.body}</p>
                <p>{getOpeningRead(name)}</p>
              </div>

              <div className="evidenceNextAction">
                <div>
                  <span>Next action</span>
                  <p>{reason.action}</p>
                </div>

                {onPractice ? (
                  <button type="button" onClick={() => onPractice(name)}>
                    Practise this
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
