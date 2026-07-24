function getTotalGames(data) {
  return (
    Number(data?.games_analyzed) ||
    Number(data?.gamesImported) ||
    Number(data?.total_games) ||
    0
  );
}

export default function FounderPassOutcomePanel({
  data,
  isPremium,
  onUpgrade,
  onViewChange,
}) {
  if (!data || isPremium) return null;

  const totalGames = getTotalGames(data);

  const handleUpgrade = () => {
    if (typeof onUpgrade === "function") {
      onUpgrade();
      return;
    }

    const el = document.getElementById("premium");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleTraining = () => {
    if (typeof onViewChange === "function") {
      onViewChange("train");
      setTimeout(() => {
        const el =
          document.getElementById("app-results") ||
          document.getElementById("training");

        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

  return (
    <section className="founderOutcome" id="founder-pass-outcome">
      <div className="founderOutcome__copy">
        <p className="founderOutcome__eyebrow">OpeningFit Plus</p>
        <h2>Upgrade when you want to track progress.</h2>
        <p>
          Your free report already gives the headline verdict, top actions, and
          a useful opening snapshot. OpeningFit Plus adds saved reports, weak-line
          tracking, progress comparisons, and exportable study plans.
        </p>

        <div className="founderOutcome__trust">
          <span>Early lifetime access</span>
          <span>One-off payment</span>
          <span>Supports development</span>
        </div>
      </div>

      <div className="founderOutcome__card">
        <div className="founderOutcome__priceRow">
          <div>
            <span className="founderOutcome__mini">Early supporter price</span>
            <strong>£8</strong>
          </div>
          <em>lifetime</em>
        </div>

        <ul>
          <li>
            <strong>Personal repertoire plan</strong>
            <span>Repertoire map, full opening table, and colour-split recommendations.</span>
          </li>
          <li>
            <strong>Weak-line tracking</strong>
            <span>See repeated opening lines that need repair over time.</span>
          </li>
          <li>
            <strong>Saved progress</strong>
            <span>Save every report and compare whether your repertoire is improving.</span>
          </li>
          <li>
            <strong>Coming soon</strong>
            <span>Weekly review email, engine-assisted diagnosis, PDF export, and deeper drills.</span>
          </li>
        </ul>

        <button type="button" className="founderOutcome__cta" onClick={handleUpgrade}>
          Pricing
        </button>

        <button
          type="button"
          className="founderOutcome__ghost"
          onClick={handleTraining}
        >
          Continue with free study plan
        </button>

        <p className="founderOutcome__note">
          {totalGames
            ? `Your current report is based on ${totalGames} imported games.`
            : "Your current report is based on your imported games."}{" "}
          OpeningFit Plus turns the snapshot into progress you can compare.
        </p>
      </div>
    </section>
  );
}
