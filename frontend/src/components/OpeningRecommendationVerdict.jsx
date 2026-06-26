import { useMemo } from "react";
import { buildOpeningRecommendationVerdict } from "../services/openingRecommendationVerdicts";
import InfoHint from "./InfoHint";
import "./OpeningRecommendationVerdict.css";

export default function OpeningRecommendationVerdict({ item, alternatives }) {
  const verdict = useMemo(
    () => buildOpeningRecommendationVerdict(item, alternatives),
    [item, alternatives]
  );

  return (
    <div className={`openingRecommendationVerdict openingRecommendationVerdict--${verdict.verdict.toLowerCase()}`}>
      <div className="openingRecommendationVerdictTopline">
        <span className="openingRecommendationVerdictBadge">{verdict.label}</span>
        <InfoHint label={`About the ${verdict.label} recommendation`}>
          This is a practical recommendation for your next training decision, not a permanent verdict on the opening.
          It uses only this report's games, score, repair flags, and existing alternatives.
        </InfoHint>
      </div>
      <p>{verdict.evidence}</p>
      <small>{verdict.action}</small>
    </div>
  );
}
