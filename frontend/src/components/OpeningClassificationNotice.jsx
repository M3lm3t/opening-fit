import {
  collectOpenings,
  getBackendOpeningClassification,
  getOpeningGames,
  getSmartPlayerLevelProfile,
  safeNumber,
} from "./playerLevelLogic";

export default function OpeningClassificationNotice({ data }) {
  if (!data) return null;

  const profile = getSmartPlayerLevelProfile(data);
  const backendClassification = getBackendOpeningClassification(data);

  const openings = collectOpenings(data, { includeUnknown: true });
  const unknown = openings.filter((item) => item.isUnknownOpening);

  const backendUnknownCount =
    safeNumber(backendClassification?.unclassified_openings, null) ??
    safeNumber(backendClassification?.unclassifiedOpenings, null);

  const backendUnknownGames =
    safeNumber(backendClassification?.unclassified_games, null) ??
    safeNumber(backendClassification?.unclassifiedGames, null);

  const unknownCount = backendUnknownCount ?? unknown.length;
  const totalGames =
    backendUnknownGames ??
    unknown.reduce((sum, item) => sum + getOpeningGames(item), 0);

  if (!unknownCount) return null;

  const label =
    backendClassification?.display_label ||
    backendClassification?.displayLabel ||
    profile.openingUnknownLabel;

  const explanation =
    backendClassification?.explanation ||
    profile.unknownExplanation;

  return (
    <section className="classificationNotice">
      <div>
        <span>{label}</span>
        <h2>Some openings could not be cleanly classified.</h2>
        <p>{explanation}</p>
      </div>

      <div className="classificationNoticeStat">
        <strong>{unknownCount}</strong>
        <span>
          item{unknownCount === 1 ? "" : "s"}
          {totalGames ? ` · ${totalGames} game${totalGames === 1 ? "" : "s"}` : ""}
        </span>
      </div>
    </section>
  );
}
