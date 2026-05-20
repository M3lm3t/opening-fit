function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function openingName(item, fallback = "Unknown opening") {
  return item?.name || item?.opening || item?.eco_name || item?.label || fallback;
}

function openingScore(item) {
  return pct(item?.win_rate ?? item?.score ?? item?.performance ?? item?.winRate);
}

function pickTopOpenings(data) {
  const pools = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ];

  const clean = pools
    .filter(Boolean)
    .filter((item) => {
      const name = openingName(item, "").toLowerCase();
      return name && !name.includes("unknown") && !name.includes("uncommon");
    });

  const sorted = [...clean].sort((a, b) => {
    const aScore = openingScore(a) ?? -1;
    const bScore = openingScore(b) ?? -1;
    const aGames = Number(a?.games ?? a?.total ?? 0);
    const bGames = Number(b?.games ?? b?.total ?? 0);
    return bScore - aScore || bGames - aGames;
  });

  return sorted.slice(0, 5);
}

function findWeakOpening(data) {
  const pools = [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ];

  return pools
    .filter(Boolean)
    .filter((item) => {
      const name = openingName(item, "").toLowerCase();
      const games = Number(item?.games ?? item?.total ?? 0);
      const score = openingScore(item);
      return name && !name.includes("unknown") && games >= 2 && score !== null;
    })
    .sort((a, b) => (openingScore(a) ?? 100) - (openingScore(b) ?? 100))[0];
}

function guessWhiteOpening(data) {
  const section = data?.opening_recommendations?.white_repertoire?.[0];
  if (section?.name) return section.name;
  const detailed = data?.opening_recommendations?.whiteDetailed?.[0];
  if (detailed?.name) return detailed.name;
  const top = pickTopOpenings(data);
  const whiteTop = top.find((item) => {
    const colour = String(item?.colour || item?.color || "").toLowerCase();
    return colour.includes("white");
  });
  return whiteTop?.name || whiteTop?.opening || data?.recommended_white?.[0]?.name || "Needs more White games";
}

function guessBlackOpening(data) {
  const vsE4 = data?.opening_recommendations?.black_vs_e4?.[0];
  if (vsE4?.name) return `${vsE4.name} vs 1.e4`;
  const vsD4 = data?.opening_recommendations?.black_vs_d4_other?.[0];
  if (vsD4?.name) return `${vsD4.name} vs 1.d4 / 1.c4 / 1.Nf3`;

  const blackTop = pickTopOpenings(data).find((item) => {
    const colour = String(item?.colour || item?.color || "").toLowerCase();
    return colour.includes("black");
  });

  return blackTop ? openingName(blackTop) : "Needs more Black games";
}

export function LandingSampleReport() {
  return (
    <section className="productPolish landingSampleReport" aria-label="Sample OpeningFit report">
      <div className="productPolishEyebrow">Example report</div>
      <h2>See what OpeningFit gives you before you import.</h2>
      <p>
        OpeningFit turns your recent games into a simple opening diagnosis: what to keep,
        what to improve, and what to stop wasting rating points on.
      </p>

      <div className="sampleReportGrid">
        <article className="sampleReportCard sampleReportCard--good">
          <span>Best fit</span>
          <strong>Vienna Game</strong>
          <p>62% score from recent games. Keep it as your main White weapon.</p>
        </article>

        <article className="sampleReportCard sampleReportCard--warn">
          <span>Biggest leak</span>
          <strong>Black vs 1.e4</strong>
          <p>Too many early losses. Use a simpler setup before adding sharp theory.</p>
        </article>

        <article className="sampleReportCard sampleReportCard--plan">
          <span>Next session</span>
          <strong>15-minute fix</strong>
          <p>Review two losses, learn one setup, then play five focused games.</p>
        </article>
      </div>

      <div className="trustStrip">
        <span>No password needed</span>
        <span>Uses public games</span>
        <span>Built for club players</span>
        <span>Free report first</span>
      </div>
    </section>
  );
}

export function CoachVerdict({ data }) {
  if (!data) return null;

  const top = pickTopOpenings(data);
  const best = top[0];
  const weak = findWeakOpening(data);
  const games =
    data?.games_imported ??
    data?.gamesImported ??
    data?.total_games ??
    data?.game_count ??
    data?.games?.length;

  const bestName = best ? openingName(best) : "your most consistent opening";
  const weakName = weak ? openingName(weak) : "your least stable opening";
  const bestScore = best ? openingScore(best) : null;
  const weakScore = weak ? openingScore(weak) : null;

  return (
    <section className="productPolish coachVerdict" id="coach-verdict">
      <div className="coachVerdictHeader">
        <div>
          <div className="productPolishEyebrow">Coach verdict</div>
          <h2>Your opening diagnosis</h2>
        </div>
        {games ? <span className="coachVerdictBadge">{games} games checked</span> : null}
      </div>

      <p className="coachVerdictLead">
        {best
          ? `Keep leaning into ${bestName}${bestScore !== null ? ` — it is currently scoring around ${bestScore}% for you` : ""}.`
          : "OpeningFit has enough to give you a practical direction, but more imported games will make the verdict sharper."}{" "}
        {weak
          ? `Your biggest leak looks like ${weakName}${weakScore !== null ? ` at around ${weakScore}%` : ""}, so treat that as the next study target.`
          : "For now, focus on building one reliable White opening and one simple Black response."}
      </p>

      <div className="coachActionGrid">
        <article>
          <span>Keep</span>
          <strong>{bestName}</strong>
          <p>Do not rebuild everything. Start by doubling down on what already works.</p>
        </article>
        <article>
          <span>Improve</span>
          <strong>{weakName}</strong>
          <p>Review early move choices and look for the first position where games go wrong.</p>
        </article>
        <article>
          <span>Next move</span>
          <strong>Train one line only</strong>
          <p>Pick one practical setup and use it for your next 5–10 games.</p>
        </article>
      </div>
    </section>
  );
}

export function RecommendedRepertoire({ data }) {
  if (!data) return null;

  const white = guessWhiteOpening(data);
  const black = guessBlackOpening(data);
  const weak = findWeakOpening(data);
  const weakName = weak ? openingName(weak) : "messy unknown setups";

  return (
    <section className="productPolish recommendedRepertoire" id="recommended-repertoire">
      <div className="productPolishEyebrow">Recommended repertoire</div>
      <h2>Your simple opening plan</h2>
      <p>
        This is the practical version of your report: White choices stay separate
        from Black defences, and ambiguous patterns are held back from confident advice.
      </p>

      <div className="repertoireGrid">
        <article>
          <span>White repertoire</span>
          <strong>{white}</strong>
          <p>Use this only for games where you are playing White.</p>
        </article>

        <article>
          <span>Black repertoire</span>
          <strong>{black}</strong>
          <p>Choose a reliable defence for the first move context shown.</p>
        </article>

        <article>
          <span>Reduce</span>
          <strong>{weakName}</strong>
          <p>Do not delete it forever — just stop bleeding points while you repair it.</p>
        </article>
      </div>
    </section>
  );
}

export function PremiumPath() {
  return (
    <section className="productPolish premiumPath" id="premium-path">
      <div>
        <div className="productPolishEyebrow">Premium direction</div>
        <h2>Free report first. Full repertoire later.</h2>
        <p>
          The free version should give players the “aha” moment. Premium should turn that
          report into saved progress, deeper imports, PDF export, and a weekly training path.
        </p>
      </div>

      <div className="premiumPathCards">
        <article>
          <span>Free</span>
          <strong>Opening diagnosis</strong>
          <p>Import games, see top openings, leaks, and a basic study recommendation.</p>
        </article>
        <article>
          <span>Premium</span>
          <strong>Build the repertoire</strong>
          <p>Saved reports, full history, deeper colour splits, PDF export, and progress tracking.</p>
        </article>
      </div>
    </section>
  );
}
