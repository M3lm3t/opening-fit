export default function OpeningDetailsModal({ opening, onClose, onReview, onPracticeLines }) {
  if (!opening) return null;

  const name =
    opening.name ||
    opening.opening ||
    opening.label ||
    opening.openingName ||
    "Unknown opening";

  const games = Number(opening.games ?? opening.count ?? opening.total ?? 0);
  const wins = Number(opening.wins ?? opening.win ?? opening.w ?? 0);
  const draws = Number(opening.draws ?? opening.draw ?? opening.d ?? 0);
  const losses = Number(opening.losses ?? opening.loss ?? opening.l ?? 0);

  const winRate = Number(
    opening.win_rate ??
      opening.winRate ??
      opening.score ??
      (games ? Math.round(((wins + draws * 0.5) / games) * 100) : 0)
  );

  const colour = opening.colour || opening.color || opening.side || "Mixed";

  const verdict =
    opening.fitVerdict ||
    opening.verdict ||
    opening.recommendation ||
    getVerdict(winRate, games);

  function getVerdict(rate, gameCount) {
    const n = Number(rate) || 0;

    if (gameCount < 3) return "Experimental / not enough data";
    if (gameCount < 8) return "Low-confidence sample";
    if (n >= 60) return "Reliable choice";
    if (n >= 45) return "Promising but unstable";
    return "Needs review";
  }

  function getMeaning() {
    const v = String(verdict).toLowerCase();

    if (v.includes("keep") || v.includes("main weapon") || v.includes("reliable choice")) {
      return "You are scoring well with this opening, so it should probably stay in your repertoire.";
    }

    if (v.includes("promising") || v.includes("review")) {
      return "You play this opening enough to review it properly. The results are useful, but the sample points to recurring positions worth checking.";
    }

    if (v.includes("low-confidence") || v.includes("experimental")) {
      return "There is not enough reliable data yet. Play more games with this opening before making a final decision.";
    }

    return "Your results are currently under pressure with this opening. Review the losses before deciding whether the opening itself is the issue.";
  }

  const verdictClass = String(verdict).replace(/\s+/g, "");

  return (
    <div className="openingModalOverlay" onClick={onClose}>
      <div className="openingModal" onClick={(event) => event.stopPropagation()}>
        <div className="openingModalHeader">
          <div>
            <p className="eyebrow">Opening details</p>
            <h2>{name}</h2>
          </div>

          <button className="modalCloseButton" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="openingModalStats">
          <div>
            <span>Games</span>
            <strong>{games}</strong>
          </div>

          <div>
            <span>Score</span>
            <strong>{Number(winRate).toFixed(0)}%</strong>
          </div>

          <div>
            <span>Record</span>
            <strong>{wins}/{draws}/{losses}</strong>
          </div>

          <div>
            <span>Side</span>
            <strong>{colour}</strong>
          </div>
        </div>

        <div className={`openingVerdict openingVerdict${verdictClass}`}>
          {verdict}
        </div>

        <div className="openingMeaningBox">
          <h3>What this means</h3>
          <p>{opening.fitExplanation || getMeaning()}</p>
        </div>

        <div className="openingModalActions">
          <button
            className="practiceLinesButton"
            type="button"
            onClick={() => {
              onClose?.();
              onPracticeLines?.(opening);
            }}
          >
            Practice 3 main lines
          </button>

          <button
            className="reviewOpeningButton"
            type="button"
            onClick={() => {
              onClose?.();
              onReview?.(name);
            }}
          >
            Review this opening
          </button>
        </div>

        <div className="openingPremiumPreview">
          <p className="eyebrow">Future premium detail</p>
          <ul>
            <li>Example games from your own imports</li>
            <li>Most common move order</li>
            <li>Suggested replacement opening</li>
            <li>Training plan for this exact opening</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
