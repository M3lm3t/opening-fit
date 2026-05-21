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
      onViewChange("training");
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
        <p className="founderOutcome__eyebrow">Founder Pass</p>
        <h2>Unlock your full repertoire audit.</h2>
        <p>
          Your free report shows the headline patterns. Founder Pass unlocks
          the full colour-split repertoire review, confidence-scored verdicts,
          weak spot diagnosis, and a practical training plan.
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
            <strong>Full repertoire audit</strong>
            <span>White/Black split with confidence-scored verdicts.</span>
          </li>
          <li>
            <strong>12 months of games</strong>
            <span>
              Analyse a bigger sample instead of only your most recent results.
            </span>
          </li>
          <li>
            <strong>Better opening decisions</strong>
            <span>Know what to keep, improve, drop, and study next.</span>
          </li>
          <li>
            <strong>Future deeper analysis</strong>
            <span>Includes planned saved history and deeper analysis tools.</span>
          </li>
        </ul>

        <button type="button" className="founderOutcome__cta" onClick={handleUpgrade}>
          Unlock Founder Pass
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
          Founder Pass turns the snapshot into a practical repertoire audit.
        </p>
      </div>
    </section>
  );
}
