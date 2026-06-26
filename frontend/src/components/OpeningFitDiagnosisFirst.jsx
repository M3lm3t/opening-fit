import OpeningScoreInfo from "./OpeningScoreInfo";

function getOpeningName(opening) {
  return (
    opening?.name ||
    opening?.opening ||
    opening?.eco ||
    "Unknown opening"
  );
}

function getGames(opening) {
  return Number(opening?.games ?? opening?.count ?? opening?.total ?? 0);
}

function getWinRate(opening) {
  const raw =
    opening?.winRate ??
    opening?.win_rate ??
    opening?.score ??
    opening?.performance;

  if (raw === undefined || raw === null || raw === "") return null;

  const n = Number(raw);
  if (!Number.isFinite(n)) return null;

  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normaliseOpenings(data) {
  const candidates = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ];

  const byName = new Map();

  candidates.forEach((opening) => {
    const name = getOpeningName(opening);
    if (!name || name === "Unknown opening") return;

    const existing = byName.get(name);
    const games = getGames(opening);
    const winRate = getWinRate(opening);

    if (!existing || games > existing.games) {
      byName.set(name, {
        ...opening,
        name,
        games,
        winRate,
      });
    }
  });

  return Array.from(byName.values()).sort((a, b) => b.games - a.games);
}

function scoreOpening(opening) {
  const games = getGames(opening);
  const winRate = getWinRate(opening);

  if (winRate === null) return 50;

  const volumeBonus = clamp(games, 0, 20) * 0.8;
  const winComponent = winRate;
  return clamp(Math.round(winComponent + volumeBonus - 8), 0, 100);
}

function getDiagnosis(data) {
  const openings = normaliseOpenings(data);

  const scored = openings
    .filter((opening) => getGames(opening) > 0)
    .map((opening) => ({
      ...opening,
      fitScore: scoreOpening(opening),
    }))
    .sort((a, b) => b.fitScore - a.fitScore);

  const keep = scored.find((opening) => getGames(opening) >= 3) || scored[0];
  const fix =
    [...scored]
      .filter((opening) => getGames(opening) >= 3)
      .sort((a, b) => a.fitScore - b.fitScore)[0] || scored[scored.length - 1];

  const totalGames =
    Number(data?.games_analyzed ?? data?.gamesImported ?? data?.total_games ?? 0) ||
    openings.reduce((sum, opening) => sum + getGames(opening), 0);

  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, opening) => sum + opening.fitScore, 0) / scored.length)
    : 58;

  const fitScore = clamp(
    Number(data?.openingFitScore ?? data?.fit_score ?? averageScore),
    0,
    100
  );

  let verdict = "Your repertoire is usable, but it needs a cleaner plan.";
  let tone = "steady";

  if (fitScore >= 75) {
    verdict = "Your repertoire has a clear strength. Build around it.";
    tone = "strong";
  } else if (fitScore < 55) {
    verdict = "Your repertoire is leaking points. Tighten the weakest openings first.";
    tone = "risky";
  }

  const replacement =
    scored.find(
      (opening) =>
        opening.name !== keep?.name &&
        opening.name !== fix?.name &&
        opening.fitScore >= 58
    ) || keep;

  return {
    openings,
    scored,
    keep,
    fix,
    replacement,
    fitScore,
    verdict,
    tone,
    totalGames,
  };
}

export default function OpeningFitDiagnosisFirst({
  data,
  isPremium,
  onUpgrade,
  onViewChange,
}) {
  if (!data) return null;

  const diagnosis = getDiagnosis(data);
  const { keep, fix, replacement, fitScore, verdict, tone, totalGames } = diagnosis;

  const keepWin = getWinRate(keep);
  const fixWin = getWinRate(fix);
  const replacementWin = getWinRate(replacement);

  const handleUpgrade = () => {
    if (typeof onUpgrade === "function") {
      onUpgrade();
      return;
    }

    const el = document.getElementById("premium");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openTraining = () => {
    if (typeof onViewChange === "function") {
      onViewChange("train");
      setTimeout(() => {
        const el = document.getElementById("app-results") || document.getElementById("training");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

  return (
    <section className={`diagnosisFirst diagnosisFirst--${tone}`} id="opening-diagnosis">
      <div className="diagnosisFirst__hero">
        <div>
          <p className="diagnosisFirst__eyebrow">Your 30-second opening diagnosis</p>
          <h2>{verdict}</h2>
          <p className="diagnosisFirst__sub">
            Based on {totalGames || "your recent"} imported games. Analyse public games instantly, then create a free account to save reports and sync across devices.
          </p>
        </div>

        <div className="diagnosisFirst__scoreCard" aria-label="Opening Fit Score">
          <span>
            Opening Fit Score{" "}
            <OpeningScoreInfo
              opening={{
                name: "Opening Fit Score",
                games: totalGames,
                fitScore,
                confidence: totalGames >= 10 ? "Useful confidence" : "Limited confidence",
                nextAction: `Review 3 losses in ${getOpeningName(fix)} and find the first uncomfortable position.`,
              }}
              score={fitScore}
            />
          </span>
          <strong>{fitScore}</strong>
          <em>/100</em>
        </div>
      </div>

      <div className="diagnosisFirst__grid">
        <article className="diagnosisFirst__card diagnosisFirst__card--keep">
          <span className="diagnosisFirst__label">Keep</span>
          <h3>{getOpeningName(keep)}</h3>
          <p>
            This looks like your strongest base. Keep playing it and build your repertoire around the positions you already score well in.
          </p>
          <small>
            {getGames(keep)} games{keepWin !== null ? ` · ${keepWin}% score` : ""}
          </small>
        </article>

        <article className="diagnosisFirst__card diagnosisFirst__card--fix">
          <span className="diagnosisFirst__label">Fix first</span>
          <h3>{getOpeningName(fix)}</h3>
          <p>
            This is the first leak to repair. Do not study everything — patch this opening before adding more theory.
          </p>
          <small>
            {getGames(fix)} games{fixWin !== null ? ` · ${fixWin}% score` : ""}
          </small>
        </article>

        <article className="diagnosisFirst__card diagnosisFirst__card--try">
          <span className="diagnosisFirst__label">Try next</span>
          <h3>{getOpeningName(replacement)}</h3>
          <p>
            This is a sensible direction for your next repertoire improvement because it already appears to fit your results better.
          </p>
          <small>
            {getGames(replacement)} games{replacementWin !== null ? ` · ${replacementWin}% score` : ""}
          </small>
        </article>
      </div>

      <div className="diagnosisFirst__plan">
        <div>
          <p className="diagnosisFirst__eyebrow">Your next 3 study actions</p>
          <ol>
            <li>Keep playing <strong>{getOpeningName(keep)}</strong> and save the common positions you reach.</li>
            <li>Review 3 losses in <strong>{getOpeningName(fix)}</strong> and find the move where the position became uncomfortable.</li>
            <li>Spend one short session building a simple response plan instead of memorising long engine lines.</li>
          </ol>
        </div>

        <div className="diagnosisFirst__actions">
          <button type="button" className="diagnosisFirst__primary" onClick={openTraining}>
            Show my study plan
          </button>

          {!isPremium ? (
            <button type="button" className="diagnosisFirst__secondary" onClick={handleUpgrade}>
              Unlock full repertoire diagnosis
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
