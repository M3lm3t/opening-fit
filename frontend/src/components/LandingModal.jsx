export default function LandingModal({
  username,
  setUsername,
  platform,
  setPlatform,
  onImport,
  loading,
  onClose,
  theme = "dark",
  onThemeToggle,
  onDemoImport,
}) {
  const handleImport = () => {
    if (onClose) onClose();
    if (onImport) onImport();
  };

  const handleDemo = () => {
    if (onClose) onClose();

    if (onDemoImport) {
      onDemoImport();
      return;
    }

    setUsername("Hikaru");
    setPlatform("chesscom");
    setTimeout(() => {
      if (onImport) onImport();
    }, 50);
  };

  return (
    <div className="landingOverlay" onClick={onClose}>
      <div className="landingModal landingHero" onClick={(event) => event.stopPropagation()}>
        <nav className="landingNav">
          <div className="landingBrand">
            <div className="landingBrandIcon">♟</div>
            <div>
              <p className="landingBrandTitle">OpeningFit</p>
              <p className="landingBrandSubtitle">Personal chess opening coach</p>
            </div>
          </div>

          <div className="landingNavLinks">
            <a href="#sample">Sample</a>
            <a href="#trust">Privacy</a>
            <button
              type="button"
              className="ghostButton landingThemeBtn"
              onClick={onThemeToggle}
              aria-label="Toggle dark and light mode"
            >
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
          </div>
        </nav>

        <div className="landingHeroGrid">
          <section className="landingHeroCopy">
            <div className="landingBadge">Free beta · Chess.com & Lichess</div>

            <h1>Stop guessing your openings.</h1>

            <p className="landingLead">
              OpeningFit shows which openings are working for you, which ones are
              costing you points, and what to study next.
            </p>

            <div className="landingImportCard">
              <div className="platformToggle">
                <button
                  type="button"
                  className={platform === "chesscom" ? "active" : ""}
                  onClick={() => setPlatform("chesscom")}
                >
                  Chess.com
                </button>
                <button
                  type="button"
                  className={platform === "lichess" ? "active" : ""}
                  onClick={() => setPlatform("lichess")}
                >
                  Lichess
                </button>
              </div>

              <div className="landingInputRow">
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={
                    platform === "lichess"
                      ? "Enter your Lichess username"
                      : "Enter your Chess.com username"
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleImport();
                  }}
                />

                <button
                  type="button"
                  className="landingPrimaryBtn"
                  onClick={handleImport}
                  disabled={loading || !username?.trim()}
                >
                  {loading ? "Importing..." : "Import games"}
                </button>
              </div>

              <p className="landingTrustLine">
                No password needed — OpeningFit only uses public game data.
              </p>

              <div className="landingActionRow">
                <button
                  type="button"
                  className="landingSecondaryBtn"
                  onClick={handleDemo}
                  disabled={loading}
                >
                  View sample report
                </button>

                <a className="landingTextLink" href="#how-it-works">
                  See what you get
                </a>
              </div>
            </div>
          </section>

          <aside className="landingPreviewPanel" id="sample">
            <div className="previewTopLine">
              <span>Sample OpeningFit Report</span>
              <strong>Beta</strong>
            </div>

            <div className="previewScoreCard">
              <p>Your style</p>
              <h2>Tactical Attacker</h2>
              <span>You score best when games open up early.</span>
            </div>

            <div className="previewVerdictGrid">
              <div>
                <span className="verdictPill keep">Keep</span>
                <strong>Vienna Game</strong>
                <p>Good results and suits your style.</p>
              </div>

              <div>
                <span className="verdictPill improve">Improve</span>
                <strong>Scandinavian</strong>
                <p>Playable, but your results dip after the opening.</p>
              </div>

              <div>
                <span className="verdictPill avoid">Avoid</span>
                <strong>Early queen attacks</strong>
                <p>Fun, but currently costing points.</p>
              </div>
            </div>
          </aside>
        </div>

        <section className="landingFeatureGrid" id="how-it-works">
          <div className="landingFeatureCard">
            <span>01</span>
            <h3>Style profile</h3>
            <p>
              See whether your games point towards attacking, solid, tactical,
              positional, or system-based openings.
            </p>
          </div>

          <div className="landingFeatureCard">
            <span>02</span>
            <h3>Best openings</h3>
            <p>
              Find the openings where you already perform well instead of
              guessing from generic course recommendations.
            </p>
          </div>

          <div className="landingFeatureCard">
            <span>03</span>
            <h3>Training plan</h3>
            <p>
              Get simple next steps based on your own results: what to keep,
              improve, and avoid.
            </p>
          </div>
        </section>

        <section className="landingTrustGrid" id="trust">
          <div className="landingInfoCard">
            <h3>Built for normal chess players</h3>
            <p>
              OpeningFit is made for players who want a clear opening plan
              without memorising endless theory.
            </p>
          </div>

          <div className="landingInfoCard">
            <h3>Public games only</h3>
            <p>
              You never enter a password. The app only reads public Chess.com
              or Lichess game data.
            </p>
          </div>

          <div className="landingInfoCard">
            <h3>Beta with feedback</h3>
            <p>
              OpeningFit is still improving. Feedback helps shape the next
              features, reports, and training tools.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
