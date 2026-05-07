export default function LaunchReadySections() {
  return (
    <section className="landingContentSection launchReadySection" id="launch-info">
      <div className="landingSectionHeading">
        <p className="landingEyebrow">Launch notes</p>
        <h2>Built as an early public beta.</h2>
        <p>
          Opening Fit is still improving. The goal is to give practical opening
          guidance from your real games, then improve the report with feedback
          from chess players.
        </p>
      </div>

      <div className="launchTileGrid">
        <article className="launchTile" id="how-it-works-detail">
          <span>01</span>
          <h3>How it works</h3>
          <p>
            Enter a public Chess.com or Lichess username. Opening Fit imports
            recent games, groups opening results, estimates your playing style,
            and suggests what to keep, improve, or avoid.
          </p>
        </article>

        <article className="launchTile" id="roadmap">
          <span>02</span>
          <h3>Roadmap</h3>
          <p>
            Next planned upgrades include saved cloud profiles, better game
            review notes, deeper repertoire tracking, more opening practice
            lines, and future engine-assisted analysis.
          </p>
        </article>

        <article className="launchTile" id="privacy">
          <span>03</span>
          <h3>Privacy</h3>
          <p>
            Opening Fit works from public chess game data. Local preferences such
            as favourites, goals, and repertoire choices are currently saved in
            your browser unless cloud saving is added later.
          </p>
        </article>

        <article className="launchTile" id="contact">
          <span>04</span>
          <h3>Contact and feedback</h3>
          <p>
            Use the feedback form on the site to report bugs, confusing results,
            or feature ideas. Early feedback helps shape what gets built next.
          </p>
        </article>
      </div>
    </section>
  );
}
