import { LandingSampleReport } from "./ProductPolish";
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
    if (!username?.trim() || loading) return;
    onClose?.();
    onImport?.();
  };

  return (
    <div className="landingOverlay polishedLandingOverlay shipLandingOverlay" onClick={onClose}>
      <section className="landingModal polishedLandingModal shipLandingModal" onClick={(event) => event.stopPropagation()}>
        <button
          className="landingCloseBtn polishedLandingClose shipLandingClose"
          type="button"
          onClick={onClose}
          aria-label="Close landing panel"
        >
          ×
        </button>

        <div className="shipLandingContent">
          <div className="shipLandingHero">
            <div className="polishedEyebrow shipLandingEyebrow">OpeningFit Beta</div>

            <h1>Find the openings that fit how you actually play.</h1>

            <p>
              Import your recent Chess.com games and get a practical opening report:
              what to keep, what to improve, and what to avoid.
            </p>
          </div>

          <div className="shipImportCard">
            <label htmlFor="landingUsername">Chess.com username</label>

            <div className="shipInputRow">
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
                {loading ? "Analysing..." : "Analyse games"}
              </button>
            </div>

            <div className="shipPlatformRow" aria-label="Platform selector">
              <button
                type="button"
                className={platform === "chesscom" ? "active" : ""}
                onClick={() => setPlatform?.("chesscom")}
              >
                Chess.com
              </button>

              <button
                type="button"
                className="comingSoon"
                onClick={() => {
                setPlatform?.("chesscom");
                window.dispatchEvent(new CustomEvent("openingfit-toast", { detail: "Lichess import is coming soon. Use Chess.com for now." }));
              }}
              >
                Lichess soon
              </button>

              <button
                type="button"
                className="shipThemeBtn"
                onClick={onThemeToggle}
              >
                {theme === "light" ? "Dark" : "Light"}
              </button>
            </div>
          </div>

          <div className="shipValueGrid">
            <article>
              <strong>Personal report</strong>
              <span>Based on your games</span>
            </article>

            <article>
              <strong>Clear verdicts</strong>
              <span>Keep / Improve / Avoid</span>
            </article>

            <article>
              <strong>Study direction</strong>
              <span>Know what to fix first</span>
            </article>
          </div>

          <div className="landingSampleReportMount">
            <LandingSampleReport />
          </div>

          <div className="shipBetaNote">
            Built for improving club players. OpeningFit is still in beta, so your feedback helps shape the next version.
          </div>
        </div>
      </section>
    </div>
  );
}
