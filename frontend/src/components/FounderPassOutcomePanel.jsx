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
        <p className="founderOutcome__eyebrow">Founder Pass</p>
        <h2>Upgrade when you want to go deeper.</h2>
        <p>
          Your free report already gives the headline verdict, top actions, and
          a useful opening snapshot. Founder Pass adds the deeper workflow:
          longer history, better filters, saved progress, and exportable study
          plans.
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
            <strong>Full repertoire tools</strong>
            <span>Repertoire map, full opening table, and advanced filters.</span>
          </li>
          <li>
            <strong>12 months of games</strong>
            <span>
              Analyse a bigger sample instead of only your most recent results.
            </span>
          </li>
          <li>
            <strong>Saved progress</strong>
            <span>Save reports and compare whether your repertoire is improving.</span>
          </li>
          <li>
            <strong>Later premium tools</strong>
            <span>Stockfish diagnosis, line mistakes, custom repertoire builder, PDF export, and drills.</span>
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
          Founder Pass turns the snapshot into a deeper repertoire workflow.
        </p>
      </div>
    </section>
  );
}
