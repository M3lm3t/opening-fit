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
}) {
  const cleanUsername = String(username || "").trim();

  const handleImport = () => {
    if (!cleanUsername || loading) return;
    onClose();
    onImport();
  };

  const handleSampleReport = () => {
    if (loading) return;

    // Uses a reliable public Chess.com account as an instant product demo.
    setPlatform("chesscom");
    setUsername("hikaru");

    setTimeout(() => {
      onClose();
      onImport();
    }, 0);
  };

  return (
    <div className="landingOverlay" onClick={onClose}>
      <div className="landingModal landingModal--beta" onClick={(event) => event.stopPropagation()}>
        <button
          className="landingCloseBtn"
          type="button"
          onClick={onClose}
          aria-label="Close landing panel"
        >
          ×
        </button>

        <div className="landingBetaPill">Beta version</div>

        <div className="landingHeroCopy">
          <h1>Find the chess openings that actually fit your games.</h1>
          <p>
            OpeningFit looks at your recent games, spots which openings are working,
            and turns them into a simple repertoire and study plan.
          </p>
        </div>

        <div className="landingValueGrid">
          <div className="landingValueCard">
            <span>01</span>
            <strong>Opening profile</strong>
            <p>See the opening families that match your current playing style.</p>
          </div>

          <div className="landingValueCard">
            <span>02</span>
            <strong>Win-rate breakdown</strong>
            <p>Find which openings are helping you score and which need work.</p>
          </div>

          <div className="landingValueCard">
            <span>03</span>
            <strong>Study plan</strong>
            <p>Get clear next steps instead of staring at a long list of games.</p>
          </div>
        </div>

        <div className="landingImportPanel">
          <div className="landingImportHeader">
            <h2>Import your games</h2>
            <p>No account needed. Enter a public Chess.com username to generate a report.</p>
          </div>

          <div className="landingPlatformTabs" role="tablist" aria-label="Choose platform">
            <button
              type="button"
              className={`landingPlatformTab ${platform === "chesscom" ? "is-active" : ""}`}
              onClick={() => setPlatform("chesscom")}
            >
              Chess.com
            </button>

            <button
              type="button"
              className={`landingPlatformTab ${platform === "lichess" ? "is-active" : ""}`}
              onClick={() => setPlatform("lichess")}
              title="Lichess import is coming soon"
            >
              Lichess <small>soon</small>
            </button>
          </div>

          {platform === "lichess" ? (
            <div className="landingComingSoon">
              Lichess import is next on the roadmap. For now, use Chess.com or view the sample report.
            </div>
          ) : null}

          <div className="landingInputRow">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleImport();
              }}
              placeholder={platform === "lichess" ? "Lichess coming soon" : "Chess.com username"}
              disabled={loading || platform === "lichess"}
              autoComplete="off"
            />

            <button
              type="button"
              className="landingPrimaryBtn"
              onClick={handleImport}
              disabled={loading || platform === "lichess" || !cleanUsername}
            >
              {loading ? "Analysing..." : "Import games"}
            </button>
          </div>

          <button
            type="button"
            className="landingSampleBtn"
            onClick={handleSampleReport}
            disabled={loading}
          >
            View sample report
          </button>
        </div>

        <div className="landingTrustRow">
          <span>Built for club players</span>
          <span>Uses public game data</span>
          <span>Free beta access</span>
        </div>

        <button
          type="button"
          className="landingThemeToggle"
          onClick={onThemeToggle}
        >
          {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        </button>
      </div>
    </div>
  );
}
