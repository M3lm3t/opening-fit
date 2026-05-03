function getName(opening) {
  return opening?.name || opening?.opening || opening?.label || "Unknown opening";
}

function getGames(opening) {
  return Number(opening?.games ?? opening?.count ?? opening?.total ?? 0);
}

function getWinRate(opening) {
  return Number(opening?.win_rate ?? opening?.winRate ?? opening?.score ?? 0);
}

function getFitScore(opening) {
  return Number(opening?.fitScore ?? opening?.fit_score ?? getWinRate(opening));
}

function getVerdict(opening) {
  return opening?.fitVerdict || opening?.fit_verdict || opening?.verdict || "";
}

function isAvoid(opening) {
  return String(getVerdict(opening)).toLowerCase().includes("avoid");
}

function isKeep(opening) {
  return String(getVerdict(opening)).toLowerCase().includes("keep");
}

function isImprove(opening) {
  return String(getVerdict(opening)).toLowerCase().includes("improve");
}

export default function OpeningSnapshot({ openings = [], onSelectOpening }) {
  const usableOpenings = openings
    .filter(Boolean)
    .filter((opening) => !getName(opening).toLowerCase().includes("unknown"));

  if (!usableOpenings.length) return null;

  const reliableOpenings = usableOpenings.filter((opening) => getGames(opening) >= 2);
  const pool = reliableOpenings.length ? reliableOpenings : usableOpenings;

  const keepOpenings = pool.filter(isKeep);
  const improveOpenings = pool.filter(isImprove);
  const avoidOpenings = pool.filter(isAvoid);

  const strongest =
    (keepOpenings.length ? keepOpenings : improveOpenings.length ? improveOpenings : pool.filter((opening) => !isAvoid(opening)))
      .slice()
      .sort((a, b) => getFitScore(b) - getFitScore(a))[0] || null;

  const mostPlayed = [...usableOpenings].sort((a, b) => getGames(b) - getGames(a))[0];

  const weakest =
    (avoidOpenings.length ? avoidOpenings : pool)
      .slice()
      .sort((a, b) => getFitScore(a) - getFitScore(b))[0] || null;

  const focusOpening =
    weakest && getName(weakest) !== getName(strongest)
      ? weakest
      : improveOpenings[0] || mostPlayed;

  return (
    <section className="card openingSnapshotCard">
      <div className="snapshotHeader">
        <div>
          <p className="eyebrow">Quick summary</p>
          <h2>Your opening snapshot</h2>
        </div>
      </div>

      <div className="snapshotGrid">
        {strongest ? (
          <button
            className="snapshotTile"
            type="button"
            onClick={() => onSelectOpening?.(strongest)}
          >
            <span>Strongest opening</span>
            <strong>{getName(strongest)}</strong>
            <small>
              Fit {getFitScore(strongest).toFixed(0)}/100
              {getVerdict(strongest) ? ` · ${getVerdict(strongest)}` : ""}
            </small>
          </button>
        ) : null}

        {mostPlayed ? (
          <button
            className="snapshotTile"
            type="button"
            onClick={() => onSelectOpening?.(mostPlayed)}
          >
            <span>Most played</span>
            <strong>{getName(mostPlayed)}</strong>
            <small>
              {getGames(mostPlayed)} games
              {getVerdict(mostPlayed) ? ` · ${getVerdict(mostPlayed)}` : ""}
            </small>
          </button>
        ) : null}

        {weakest ? (
          <button
            className="snapshotTile"
            type="button"
            onClick={() => onSelectOpening?.(weakest)}
          >
            <span>Needs review</span>
            <strong>{getName(weakest)}</strong>
            <small>
              Fit {getFitScore(weakest).toFixed(0)}/100
              {getVerdict(weakest) ? ` · ${getVerdict(weakest)}` : ""}
            </small>
          </button>
        ) : null}
      </div>

      {focusOpening ? (
        <div className="snapshotAdvice">
          <strong>Focus first:</strong>{" "}
          {isAvoid(focusOpening)
            ? `review or replace ${getName(focusOpening)} because your current Opening Fit verdict says ${getVerdict(focusOpening)}.`
            : `review ${getName(focusOpening)} next because it is one of your most useful openings to improve.`}
        </div>
      ) : null}
    </section>
  );
}
