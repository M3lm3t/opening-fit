import "./OpeningFitTrustUpgrade.css";

const sampleRows = [
  {
    verdict: "Keep",
    opening: "Vienna Game",
    score: "58%",
    detail: "Strong results as White. Keep it as your main attacking weapon.",
  },
  {
    verdict: "Improve",
    opening: "Scandinavian Defence",
    score: "43%",
    detail: "Playable, but losses are repeating early. Train the first 8 moves.",
  },
  {
    verdict: "Avoid",
    opening: "Englund Gambit",
    score: "31%",
    detail: "Fun, but currently costing rating points. Replace with something steadier.",
  },
];

const checks = [
  "Your real Chess.com and Lichess games",
  "Opening win rates by colour",
  "Repeated early-game problems",
  "White and Black repertoire gaps",
  "Practical next study priorities",
];

const freeItems = [
  "Recent game import",
  "Basic style profile",
  "Top opening stats",
  "3 Keep / Improve / Avoid recommendations",
];

const premiumItems = [
  "More months of games",
  "Full opening history",
  "Deeper repertoire review",
  "Progress tracking over time",
  "Future premium upgrades",
];

export default function OpeningFitTrustUpgrade({ onImport, onSample, onDemo, onFounderPass }) {
  return (
    <section className="trustUpgrade" id="sample-report">
      <div className="trustHeroCard">
        <div className="trustHeroCopy">
          <p className="trustEyebrow">Built for practical chess improvement</p>

          <h1>Find the openings that are quietly costing you rating points.</h1>

          <p className="trustSubtext">
            Import your Chess.com or Lichess games and OpeningFit shows which openings to keep,
            improve, or avoid — based on your real results, not generic theory.
          </p>

          <div className="trustActions">
            <button type="button" className="trustPrimaryBtn" onClick={onImport}>
              Analyse my games
            </button>

            <button type="button" className="trustSecondaryBtn" onClick={onDemo || onSample}>
              Try demo report
            </button>
          </div>

          <div className="trustMiniProof">
            <span>Best for 800–1800 rated players</span>
            <span>Works with Chess.com + Lichess</span>
            <span>No huge opening course needed</span>
          </div>
        </div>

        <div className="sampleReportCard">
          <div className="sampleReportHeader">
            <div>
              <p>Sample report</p>
              <h2>1300 Chess.com player</h2>
            </div>
            <span className="sampleBadge">Example</span>
          </div>

          <div className="sampleRows">
            {sampleRows.map((row) => (
              <div className={`sampleRow sampleRow--${row.verdict.toLowerCase()}`} key={row.opening}>
                <div className="sampleVerdict">
                  <span>{row.verdict}</span>
                  <strong>{row.score}</strong>
                </div>

                <div>
                  <h3>{row.opening}</h3>
                  <p>{row.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="nextStudyBox">
            <span>Next study session</span>
            <strong>Train your Vienna response when Black plays ...Nf6.</strong>
          </div>
        </div>
      </div>

      <div className="trustGrid">
        <article className="trustInfoCard">
          <h2>What OpeningFit checks</h2>
          <ul>
            {checks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="trustInfoCard">
          <h2>Who it is for</h2>
          <p>
            OpeningFit is for club-level players who want a simple repertoire based on their own
            games, not a 20-hour theory course they will never finish.
          </p>

          <div className="audiencePills">
            <span>Casual improvers</span>
            <span>Online grinders</span>
            <span>Returning players</span>
            <span>Opening dabblers</span>
          </div>
        </article>

        <article className="founderPassCard">
          <div className="founderTopline">
            <span>Founder Pass</span>
            <strong>£8</strong>
          </div>

          <h2>Unlock your full repertoire audit.</h2>

          <p>
            Founder Pass turns your recent games into better opening decisions:
            what to keep, what to improve, and what to drop.
          </p>

          <button type="button" className="founderButton" onClick={onFounderPass}>
            Unlock Founder Pass
          </button>
        </article>
      </div>

      <div className="tierComparison">
        <div className="tierCard">
          <h2>Free</h2>
          <p>Enough to see whether OpeningFit is useful for your games.</p>
          <ul>
            {freeItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="tierCard tierCard--premium">
          <h2>Founder Pass</h2>
          <p>For players who want the full repertoire report and future premium tools.</p>
          <ul>
            {premiumItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
