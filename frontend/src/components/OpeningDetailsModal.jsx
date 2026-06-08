import { useEffect } from "react";
import { getOpeningConfidence, getOpeningContext, getOpeningSignal } from "./OpeningEvidence";
import { sampleSizeCopy } from "./openingCopy";

export default function OpeningDetailsModal({ opening, onClose, onReview, onPracticeLines }) {
  useEffect(() => {
    if (!opening) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [opening, onClose]);

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
  const context = getOpeningContext(opening);
  const signal = getOpeningSignal(opening);
  const confidenceLabel =
    opening.confidenceLabel ||
    opening.confidence_label ||
    getOpeningConfidence(opening);
  const comparisonText =
    opening.comparisonText ||
    opening.comparison_text ||
    "Average comparison unavailable.";
  const verdictReason =
    opening.verdictReason ||
    opening.verdict_reason ||
    opening.confidenceReason ||
    opening.confidence_reason;

  const verdict =
    signal.tier === "none"
      ? "No reliable data"
      : signal.tier === "low"
        ? "Too few games"
        : opening.fitVerdict ||
            opening.verdict ||
            opening.recommendation ||
            getVerdict(winRate, games);

  function getVerdict(rate, gameCount) {
    const n = Number(rate) || 0;

    const localSignal = getOpeningSignal({ ...opening, games: gameCount, winRate: rate });
    if (localSignal.tier === "none") return "No reliable data";
    if (localSignal.tier === "low") return "Too few games";
    if (n >= 60) return "Reliable choice";
    if (n >= 45) return "Promising but unstable";
    return "Needs review";
  }

  function getMeaning() {
    const v = String(verdict).toLowerCase();

    if (!context.canRecommend) {
      return context.type === "faced"
        ? "You mostly faced this opening from the opponent side. Review how you handled it, but do not add it to your repertoire from this data alone."
        : "This opening appears in mixed or unclear contexts. Separate it by colour before treating it as a repertoire choice.";
    }

    if (v.includes("keep") || v.includes("main weapon") || v.includes("reliable choice")) {
      return "Your results support keeping this opening. The next step is to make the main plan more repeatable.";
    }

    if (v.includes("promising") || v.includes("review")) {
      return "There is enough here to review. Check the recurring branch before deciding whether the opening or the move order is the issue.";
    }

    if (v.includes("low-confidence") || v.includes("experimental") || v.includes("too little") || v.includes("too few") || v.includes("no reliable") || v.includes("emerging") || v.includes("needs more games")) {
      return `${sampleSizeCopy(games)} Treat this as a trend to watch, not a recommendation.`;
    }

    return "Your results are under pressure here. Review the losses before deciding whether the opening, move order, or first plan is the issue.";
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
            <span>Context</span>
            <strong>{context.label || colour}</strong>
          </div>

          <div>
            <span>Confidence</span>
            <strong>{confidenceLabel}</strong>
          </div>
        </div>

        <div className={`openingVerdict openingVerdict${verdictClass}`}>
          {verdict}
        </div>

        <div className="openingMeaningBox">
          <h3>What this means</h3>
          <p>{verdictReason || opening.fitExplanation || getMeaning()}</p>
          <p>{comparisonText}</p>
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
            <li>Most common move order and transpositions</li>
            <li>Replacement idea only if the repeated line stays poor</li>
            <li>Training plan for this exact opening family</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
