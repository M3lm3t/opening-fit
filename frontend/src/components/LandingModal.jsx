export default function LandingModal({
  username,
  setUsername,
  platform,
  setPlatform,
  onImport,
  onDemoReport,
  loading,
  onClose,
  theme,
  onThemeToggle,
}) {
  const cleanUsername = String(username || "").trim();

  const handleImport = () => {
    if (!cleanUsername || loading) return;
    onImport(cleanUsername, platform);
  };

  const handleSampleReport = () => {
    if (loading) return;
    onDemoReport?.();
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
            >
              Lichess
            </button>
          </div>

          {platform === "lichess" ? (
            <div className="landingComingSoon">
              Lichess import is now in beta. Enter a public Lichess username to generate a report.
            </div>
          ) : null}

          <div className="landingInputRow">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleImport();
              }}
              placeholder={platform === "lichess" ? "Lichess username" : "Chess.com username"}
              disabled={loading}
              autoComplete="off"
            />

            <button
              type="button"
              className="landingPrimaryBtn"
              onClick={handleImport}
              disabled={loading || !cleanUsername}
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
