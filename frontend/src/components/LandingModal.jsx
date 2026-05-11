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
  const fillDemo = () => {
    setPlatform("chesscom");
    setUsername("Hikaru");
  };

  const handleImport = () => {
    onClose();
    onImport();
  };

  return (
    <div className="landingOverlay" onClick={onClose}>
      <div className="landingModal landingModalPremium" onClick={(event) => event.stopPropagation()}>
        <button
          className="landingCloseBtn"
          type="button"
          onClick={onClose}
          aria-label="Close landing modal"
        >
          ×
        </button>

        <div className="landingHeroPremium">
          <div className="landingBadge">Personal opening report</div>

          <h1>Find the openings that actually fit your chess</h1>

          <p className="landingLead">
            Opening Fit analyses your recent games and shows what to keep,
            improve, and avoid — based on your own results.
          </p>
        </div>

        <div className="landingActionCard">
          <div className="landingInputGrid">
            <label>
              <span>Platform</span>
              <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
                <option value="chesscom">Chess.com</option>
                <option value="lichess">Lichess</option>
              </select>
            </label>

            <label>
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={platform === "lichess" ? "Lichess username" : "Chess.com username"}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && username.trim() && !loading) {
                    handleImport();
                  }
                }}
              />
            </label>
          </div>

          <button
            className="landingPrimaryBtn"
            type="button"
            onClick={handleImport}
            disabled={loading || !username.trim()}
          >
            {loading ? "Analysing games..." : "Analyse my games"}
          </button>

          <div className="landingSecondaryRow">
            <button type="button" onClick={fillDemo}>
              Try demo username
            </button>

            <button type="button" onClick={onThemeToggle}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>

          <p className="landingTrustText">
            No password needed. Uses public game data only.
          </p>
        </div>

        <div className="landingPreviewGrid">
          <div className="landingPreviewCard landingPreviewCardStrong">
            <span>Keep</span>
            <h3>Vienna Game</h3>
            <p>Strong results in tactical e4 positions. Keep building this into your main White weapon.</p>
          </div>

          <div className="landingPreviewCard">
            <span>Improve</span>
            <h3>Caro-Kann Defence</h3>
            <p>Good structure, but your middlegame plans need sharpening after the opening phase.</p>
          </div>

          <div className="landingPreviewCard">
            <span>Avoid for now</span>
            <h3>Scandinavian Defence</h3>
            <p>Recent games show early development problems and lower scoring positions.</p>
          </div>
        </div>

        <div className="landingMiniRoadmap">
          <div>
            <strong>1</strong>
            Import games
          </div>
          <div>
            <strong>2</strong>
            Get opening verdicts
          </div>
          <div>
            <strong>3</strong>
            Build your repertoire
          </div>
        </div>
      </div>
    </div>
  );
}
