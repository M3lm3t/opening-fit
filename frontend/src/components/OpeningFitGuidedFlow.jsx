function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getOpenings(data) {
  return [
    ...(Array.isArray(data?.top_openings) ? data.top_openings : []),
    ...(Array.isArray(data?.opening_stats) ? data.opening_stats : []),
    ...(Array.isArray(data?.openings) ? data.openings : []),
  ];
}

function openingName(item, fallback = "your current repertoire") {
  return item?.name || item?.opening || item?.eco_name || item?.label || fallback;
}

function getGames(data) {
  return (
    safeNumber(data?.games_imported) ||
    safeNumber(data?.games_analyzed) ||
    safeNumber(data?.gamesAnalysed) ||
    safeNumber(data?.total_games) ||
    safeNumber(data?.summary?.games)
  );
}

function getStyle(data) {
  return (
    data?.style_profile?.label ||
    data?.style?.label ||
    data?.style ||
    data?.player_style ||
    "Your practical playing style"
  );
}

export default function OpeningFitGuidedFlow({ data, onJump, activeView, onViewChange }) {
  if (!data) return null;

  const openings = getOpenings(data);
  const topOpening = openings[0];
  const games = getGames(data);
  const style = getStyle(data);

  const steps = [
    {
      number: "01",
      label: "Style",
      title: "Understand your playing style",
      text: `OpeningFit currently reads you as: ${style}. Use this to choose openings that suit how you naturally win games.`,
      action: "View style profile",
      target: "style-profile",
      view: "overview",
    },
    {
      number: "02",
      label: "Repertoire",
      title: "Decide what to keep, improve, or avoid",
      text: `${openingName(topOpening)} looks like one of the main signals in your current opening profile.`,
      action: "View opening verdicts",
      target: "keep-improve-avoid",
      view: "recommendations",
    },
    {
      number: "03",
      label: "Training",
      title: "Turn the report into a study plan",
      text: "Do not try to study everything. Pick one White opening and one Black defence to improve first.",
      action: "View training plan",
      target: "training-plan",
      view: "training",
    },
    {
      number: "04",
      label: "Games",
      title: "Replay the evidence",
      text: "Use your own games to check whether the recommendation feels right in real positions.",
      action: "Open game replay",
      target: "game-replay",
      view: "games",
    },
    {
      number: "05",
      label: "Stats",
      title: "Check the detailed numbers",
      text: "Use the tables and charts as supporting evidence, not as the first thing you read.",
      action: "View detailed stats",
      target: "top-openings-table",
      view: "data",
    },
  ];

  const handleJump = (step) => {
    if (step.view && onViewChange) {
      onViewChange(step.view);
    }

    setTimeout(() => {
      onJump?.(step.target);
    }, 80);
  };

  return (
    <section className="ofGuidedFlow" id="guided-report-flow">
      <div className="ofGuidedFlowHeader">
        <div>
          <div className="ofEyebrow">Guided report</div>
          <h2>Read your report in the right order.</h2>
          <p>
            {games ? `Based on ${games} imported games, ` : ""}
            this flow helps you turn the analysis into a simple opening improvement plan.
          </p>
        </div>

        <div className="ofGuidedMiniCard">
          <span>Recommended first action</span>
          <strong>Pick one opening to improve</strong>
          <p>One focused fix is more useful than ten vague recommendations.</p>
        </div>
      </div>

      <div className="ofGuidedSteps">
        {steps.map((step) => (
          <article
            key={step.number}
            className={activeView === step.view ? "active" : ""}
          >
            <div className="ofGuidedStepTop">
              <span>{step.number}</span>
              <small>{step.label}</small>
            </div>

            <strong>{step.title}</strong>
            <p>{step.text}</p>

            <button type="button" onClick={() => handleJump(step)}>
              {step.action}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
