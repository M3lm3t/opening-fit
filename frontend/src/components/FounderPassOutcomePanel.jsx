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
        <h2>Unlock deeper reports and support early development.</h2>
        <p>
          Your free report shows the headline signals. Founder Pass is for players
          who want deeper history, saved reports, fuller opening tables, and future
          premium tools as Opening Fit improves.
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
            <strong>Deeper repertoire plan</strong>
            <span>See more context behind Keep / Improve / Avoid verdicts.</span>
          </li>
          <li>
            <strong>12 months of games</strong>
            <span>
              Analyse a bigger sample instead of only your most recent results.
            </span>
          </li>
          <li>
            <strong>Clearer opening verdicts</strong>
            <span>Know what to keep, improve, avoid, and study next.</span>
          </li>
          <li>
            <strong>Future premium upgrades</strong>
            <span>Includes planned saved history and deeper analysis tools.</span>
          </li>
        </ul>

        <button type="button" className="founderOutcome__cta" onClick={handleUpgrade}>
          Get Founder Pass
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
          Opening Fit is still improving. Founder Pass helps fund development and gives you early access to premium features.
        </p>
      </div>
    </section>
  );
}
