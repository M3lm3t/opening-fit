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
  return opening?.fitVerdict || opening?.verdict || opening?.recommendation || "";
}

function isBadVerdict(opening) {
  const verdict = String(getVerdict(opening)).toLowerCase();
  return verdict.includes("avoid");
}

export default function OpeningSnapshot({ openings = [], onSelectOpening }) {
  const usableOpenings = openings
    .filter(Boolean)
    .filter((opening) => !getName(opening).toLowerCase().includes("unknown"));

  if (!usableOpenings.length) return null;

  const repeatedOpenings = usableOpenings.filter((opening) => getGames(opening) >= 2);

  const reliableOpenings = repeatedOpenings.length ? repeatedOpenings : usableOpenings;

  const strongestCandidates = reliableOpenings.filter((opening) => !isBadVerdict(opening));

  const strongest =
    (strongestCandidates.length ? strongestCandidates : reliableOpenings)
      .slice()
      .sort((a, b) => getFitScore(b) - getFitScore(a))[0];

  const mostPlayed = [...usableOpenings].sort((a, b) => getGames(b) - getGames(a))[0];

  const weakest =
    [...reliableOpenings]
      .sort((a, b) => getFitScore(a) - getFitScore(b))[0];

  const firstFocus = weakest && weakest !== strongest ? weakest : mostPlayed;

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
            <small>{getGames(mostPlayed)} games</small>
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

      {firstFocus ? (
        <div className="snapshotAdvice">
          <strong>Focus first:</strong>{" "}
          {isBadVerdict(firstFocus)
            ? `review or simplify your ${getName(firstFocus)} lines. Your current results suggest this opening needs attention.`
            : `review your games in ${getName(firstFocus)}. This is likely the quickest place to improve your results.`}
        </div>
      ) : null}
    </section>
  );
}
