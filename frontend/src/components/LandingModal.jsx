export default function LandingModal({
  username,
  setUsername,
  platform,
  setPlatform,
  onImport,
  loading,
  onClose,
  theme,
  onThemeToggle,
  onDemoReport,
}) {
  const handleImport = () => {
    if (onClose) onClose();
    onImport();
  };

  const handleDemoReport = () => {
    if (onDemoReport) {
      onDemoReport();
      if (onClose) onClose();
      return;
    }

    setPlatform("chesscom");
    setUsername("DemoPlayer");

    setTimeout(() => {
      if (onClose) onClose();
      onImport();
    }, 80);
  };

  return (
    <div className="landingOverlay">
      <div className="landingModal landingModalPolished">
        <div className="landingTopBar">
          <div className="landingLogoMark">♞</div>

          <div className="landingTopActions">
            <button
              type="button"
              className="landingThemeBtn"
              onClick={onThemeToggle}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>

            {onClose ? (
              <button
                type="button"
                className="landingCloseBtn"
                onClick={onClose}
                aria-label="Close landing page"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        <section className="landingHeroCompact">
          <div className="landingBadge">Opening Fit beta</div>

          <h1>Find the openings that actually suit your games.</h1>

          <p className="landingSubcopy">
            Import your Chess.com or Lichess games and get a simple opening report:
            what to keep, what to improve, and what to avoid.
          </p>

          <div className="landingImportCard">
            <div className="landingInputRow">
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className="landingPlatformSelect"
                aria-label="Choose platform"
              >
                <option value="chesscom">Chess.com</option>
                <option value="lichess">Lichess</option>
              </select>

              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={
                  platform === "lichess"
                    ? "Enter Lichess username"
                    : "Enter Chess.com username"
                }
                className="landingUsernameInput"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && username.trim()) {
                    handleImport();
                  }
                }}
              />
            </div>

            <button
              type="button"
              className="landingPrimaryBtn"
              onClick={handleImport}
              disabled={loading || !username.trim()}
            >
              {loading ? "Analysing games..." : "Analyse my games"}
            </button>

            <button
              type="button"
              className="landingSecondaryBtn"
              onClick={handleDemoReport}
              disabled={loading}
            >
              View sample report
            </button>

            <p className="landingTrustLine">
              No password needed. Opening Fit only checks public game data.
            </p>
          </div>
        </section>

        <section className="landingPreviewGrid">
          <div className="landingPreviewCard keep">
            <span>Keep</span>
            <strong>Vienna Game</strong>
            <p>High score and strong practical results from your recent games.</p>
          </div>

          <div className="landingPreviewCard improve">
            <span>Improve</span>
            <strong>Scandinavian Defence</strong>
            <p>Playable, but your results suggest a few recurring problem positions.</p>
          </div>

          <div className="landingPreviewCard avoid">
            <span>Avoid</span>
            <strong>Risky sidelines</strong>
            <p>Low sample performance or positions that do not fit your style.</p>
          </div>
        </section>

        <section className="landingInfoGrid">
          <div className="landingInfoCard">
            <h2>How it works</h2>
            <ol>
              <li>Enter your Chess.com or Lichess username.</li>
              <li>Opening Fit checks your recent public games.</li>
              <li>You get opening stats, style patterns, and practical suggestions.</li>
            </ol>
          </div>

          <div className="landingInfoCard">
            <h2>What you get</h2>
            <ul>
              <li>Opening win-rate breakdowns</li>
              <li>Keep / Improve / Avoid verdicts</li>
              <li>Repertoire suggestions for White and Black</li>
              <li>Game replay and opening review</li>
            </ul>
          </div>
        </section>

        <section className="landingPremiumCard">
          <div>
            <span className="landingMiniLabel">Coming premium idea</span>
            <h2>Turn your games into a full repertoire plan.</h2>
            <p>
              Future premium features could include deeper reports, more imported
              games, saved progress, opponent prep, and PDF exports.
            </p>
          </div>
        </section>

        <section className="landingFaq">
          <h2>Quick questions</h2>

          <details>
            <summary>Do I need to log in?</summary>
            <p>No. Opening Fit works from public Chess.com and Lichess game data.</p>
          </details>

          <details>
            <summary>Is this for beginners?</summary>
            <p>
              Yes. It is built to make opening study clearer by showing what is
              already working in your own games.
            </p>
          </details>

          <details>
            <summary>Is Opening Fit finished?</summary>
            <p>
              It is currently in beta. Feedback is welcome while new features and
              polish are added.
            </p>
          </details>
        </section>

        <p className="landingCreatorNote">
          Built by a chess player trying to make opening study less confusing.
        </p>
      </div>
    </div>
  );
}
