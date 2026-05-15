import "./EvidenceBackedOpeningDiagnosis.css";

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

function getVerdict(item, average) {
  const explicit = String(item?.verdict || item?.recommendation || "").toLowerCase();

  if (explicit.includes("keep")) return "Keep";
  if (explicit.includes("avoid")) return "Avoid for now";
  if (explicit.includes("improve")) return "Improve";

  const games = getGames(item);
  const score = getScore(item);

  if (games >= 6 && score >= Math.max(55, average + 5)) return "Keep";
  if (games >= 6 && score <= Math.min(42, average - 8)) return "Avoid for now";

  return "Improve";
}

function getConfidence(games) {
  if (games >= 25) return "High confidence — enough games to trust the pattern.";
  if (games >= 10) return "Medium confidence — useful signal, worth checking again later.";
  if (games >= 4) return "Early signal — helpful, but still sample-size sensitive.";
  return "Low confidence — not enough games for a hard verdict yet.";
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

  if (verdict === "Keep") {
    return {
      title: `${name} is earning its place.`,
      body: `You are scoring ${score}% over ${games} games ${getSide(item)}, which is ${comparison}. The record behind that is ${record}, so this looks like a genuine practical strength rather than one lucky result.`,
      action: "Keep it in your main repertoire. Study the reply that currently makes the position least comfortable instead of replacing the opening.",
    };
  }

  if (verdict === "Avoid for now") {
    return {
      title: `${name} is currently costing points.`,
      body: `You are scoring ${score}% over ${games} games ${getSide(item)}, which is ${comparison}. The record behind that is ${record}, so this is worth treating as a practical problem, not just bad luck.`,
      action: "Pause it for now. Use a steadier option for your next block of games, then come back to it once the rest of the repertoire is cleaner.",
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
            helping, repairable, or quietly costing points.
          </p>
        </div>

        <div className="evidenceAverageCard">
          <span>Your opening average</span>
          <strong>{average}%</strong>
          <small>weighted by games played</small>
        </div>
      </div>

      <div className="evidenceDiagnosisList">
        {openings.map((opening) => {
          const name = getOpeningName(opening);
          const games = getGames(opening);
          const score = getScore(opening);
          const verdict = getVerdict(opening, average);
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
