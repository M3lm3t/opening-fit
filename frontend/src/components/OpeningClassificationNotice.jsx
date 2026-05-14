import {
  collectOpenings,
  getOpeningGames,
  getPlayerLevelProfile,
} from "./playerLevelLogic";

export default function OpeningClassificationNotice({ data }) {
  if (!data) return null;

  const profile = getPlayerLevelProfile(data);
  const openings = collectOpenings(data, { includeUnknown: true });
  const unknown = openings.filter((item) => item.isUnknownOpening);

  if (!unknown.length) return null;

  const totalGames = unknown.reduce((sum, item) => sum + getOpeningGames(item), 0);

  return (
    <section className="classificationNotice">
      <div>
        <span>{profile.openingUnknownLabel}</span>
        <h2>Some openings could not be cleanly classified.</h2>
        <p>{profile.unknownExplanation}</p>
      </div>

      <div className="classificationNoticeStat">
        <strong>{unknown.length}</strong>
        <span>
          item{unknown.length === 1 ? "" : "s"}
          {totalGames ? ` · ${totalGames} game${totalGames === 1 ? "" : "s"}` : ""}
        </span>
      </div>
    </section>
  );
}
