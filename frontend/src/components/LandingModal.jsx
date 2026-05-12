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
  const handleImport = () => {
    onClose?.();
    onImport?.();
  };

  return (
    <div className="landingOverlay polishedLandingOverlay" onClick={onClose}>
      <section className="landingModal polishedLandingModal" onClick={(event) => event.stopPropagation()}>
        <div className="polishedLandingGlow" />

        <button
          className="landingCloseBtn polishedLandingClose"
          type="button"
          onClick={onClose}
          aria-label="Close landing panel"
        >
          ×
        </button>

        <div className="polishedLandingHero">
          <div className="polishedEyebrow">OpeningFit Beta</div>

          <h1>Find the openings that fit how you actually play.</h1>

          <p>
            OpeningFit reviews your recent games, spots your strongest opening patterns,
            and gives you a practical keep, improve, or avoid repertoire plan.
          </p>
        </div>

        <div className="polishedImportCard">
          <div>
            <label htmlFor="landingUsername">Chess.com username</label>
            <div className="polishedInputRow">
              <input
                id="landingUsername"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleImport();
                }}
                placeholder="e.g. Hikaru"
                autoComplete="off"
              />

              <button type="button" onClick={handleImport} disabled={loading || !username?.trim()}>
                {loading ? "Analysing..." : "Analyse my games"}
              </button>
            </div>
          </div>

          <div className="polishedPlatformRow" aria-label="Platform selector">
            <button
              type="button"
              className={platform === "chesscom" ? "active" : ""}
              onClick={() => setPlatform?.("chesscom")}
            >
              Chess.com
            </button>
            <button
              type="button"
              className={platform === "lichess" ? "active" : ""}
              onClick={() => setPlatform?.("lichess")}
            >
              Lichess soon
            </button>
          </div>
        </div>

        <div className="polishedTrustTiles">
          <article>
            <strong>Personalised</strong>
            <span>Built from your own games, not generic theory.</span>
          </article>

          <article>
            <strong>Practical</strong>
            <span>See what to keep, improve, and avoid.</span>
          </article>

          <article>
            <strong>Fast</strong>
            <span>Get a usable study direction in minutes.</span>
          </article>
        </div>

        <div className="polishedHowItWorks">
          <h2>How it works</h2>

          <div className="polishedSteps">
            <div>
              <span>1</span>
              <strong>Import games</strong>
              <p>Enter your public Chess.com username.</p>
            </div>

            <div>
              <span>2</span>
              <strong>Detect patterns</strong>
              <p>OpeningFit reviews results by opening, colour, and style.</p>
            </div>

            <div>
              <span>3</span>
              <strong>Get a plan</strong>
              <p>Turn your games into a practical repertoire direction.</p>
            </div>
          </div>
        </div>

        <div className="polishedBetaNote">
          Built for improving club players. Still in beta, so early feedback helps shape the next version.
        </div>

        <button
          type="button"
          className="polishedThemeToggle"
          onClick={onThemeToggle}
        >
          {theme === "light" ? "Dark mode" : "Light mode"}
        </button>
      </section>
    </div>
  );
}
