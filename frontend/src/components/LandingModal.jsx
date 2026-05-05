export default function LandingModal({ username, setUsername, platform, setPlatform, onImport, loading, onClose, theme, onThemeToggle }) {
  const handleImport = () => {
    onClose();
    onImport();
  };

  return (
    <div className="landingOverlay" onClick={onClose}>
      <div className="landingModal" onClick={(event) => event.stopPropagation()}>
        <button
          className="landingCloseBtn"
          type="button"
          onClick={onClose}
          aria-label="Close landing page"
        >
          ×
        </button>

        <div className="landingMiniBrand">
          <div className="landingMiniLogo">♞</div>
          <div>
            <p className="landingMiniTitle">Opening Fit</p>
            <p className="landingMiniSubtitle">
              Find openings that match your style
            </p>
          </div>
        </div>

        <div className="landingMiniCopy">
          <button
          className="landingModalThemeToggle"
          type="button"
          onClick={onThemeToggle}
          aria-label="Toggle light and dark mode"
        >
          {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
        </button>

        <h1>Analyse your openings in seconds.</h1>
          <p>
            Import your recent Chess.com or Lichess games and get a simple
            report showing your best openings, weak spots, and what to practise
            next.
          </p>
        </div>

        <div className="landingMiniSearch">
          <div className="landingMiniTabs">
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

          <div className="landingMiniInputRow">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={
                platform === "lichess"
                  ? "Enter your Lichess username"
                  : "Enter your Chess.com username"
              }
            />

            <button
              type="button"
              onClick={handleImport}
              disabled={loading || !String(username || "").trim()}
            >
              {loading ? "Analysing..." : "Import games"}
            </button>
          </div>

          <p>No sign-up needed. Just enter your public chess username.</p>
        </div>

        <button className="landingSkipBtn" type="button" onClick={onClose}>
          Continue without importing
        </button>
      </div>
    </div>
  );
}
