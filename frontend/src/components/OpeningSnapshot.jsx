function getName(opening) {
  return opening?.name || opening?.opening || opening?.label || "Unknown opening";
}

function getGames(opening) {
  return Number(opening?.games ?? opening?.count ?? opening?.total ?? 0);
}

function getWinRate(opening) {
  return Number(opening?.win_rate ?? opening?.winRate ?? opening?.score ?? 0);
}

export default function OpeningSnapshot({ openings = [], onSelectOpening }) {
  const usableOpenings = openings
    .filter(Boolean)
    .filter((opening) => !getName(opening).toLowerCase().includes("unknown"));

  if (!usableOpenings.length) return null;

  const mostPlayed = [...usableOpenings].sort((a, b) => getGames(b) - getGames(a))[0];

  const repeatedOpenings = usableOpenings.filter((opening) => getGames(opening) >= 3);

  const strongest =
    repeatedOpenings.length > 0
      ? [...repeatedOpenings].sort((a, b) => getWinRate(b) - getWinRate(a))[0]
      : [...usableOpenings].sort((a, b) => getWinRate(b) - getWinRate(a))[0];

  const weakest =
    repeatedOpenings.length > 0
      ? [...repeatedOpenings].sort((a, b) => getWinRate(a) - getWinRate(b))[0]
      : [...usableOpenings].sort((a, b) => getWinRate(a) - getWinRate(b))[0];

  const firstFocus = weakest || mostPlayed;

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
            <small>{getWinRate(strongest).toFixed(0)}% score</small>
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
            <small>{getWinRate(weakest).toFixed(0)}% score</small>
          </button>
        ) : null}
      </div>

      {firstFocus ? (
        <div className="snapshotAdvice">
          <strong>Focus first:</strong> review your games in {getName(firstFocus)}. This is likely the quickest place to improve your results.
        </div>
      ) : null}
    </section>
  );
}
