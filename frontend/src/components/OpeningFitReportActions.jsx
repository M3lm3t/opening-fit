function getArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function openingName(item, fallback = "your main opening") {
  return item?.name || item?.opening || item?.eco_name || item?.label || fallback;
}

function getWinRate(item) {
  const raw = item?.win_rate ?? item?.winRate ?? item?.score ?? item?.percentage;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function verdictFor(item) {
  const verdict = String(item?.verdict || "").toLowerCase();

  if (verdict.includes("keep") || verdict.includes("weapon") || verdict.includes("reliable")) {
    return "Reliable choice";
  }
  if (verdict.includes("improve") || verdict.includes("promising")) {
    return "Promising but unstable";
  }
  if (verdict.includes("avoid") || verdict.includes("review")) return "Needs review";

  const winRate = getWinRate(item);

  if (winRate === null) return "Needs review";
  if (winRate >= 58) return "Reliable choice";
  if (winRate >= 45) return "Promising but unstable";
  return "Needs review";
}

function pick(openings, verdict, fallbackIndex) {
  return openings.find((item) => verdictFor(item) === verdict) || openings[fallbackIndex];
}

function copyText(text, successMessage) {
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      window.dispatchEvent(new CustomEvent("openingfit-toast", { detail: successMessage }));
    }).catch(() => {
      alert(text);
    });
    return;
  }

  alert(text);
}

export default function OpeningFitReportActions({ data, username, onJump }) {
  if (!data) return null;

  const openings = getArray(data?.top_openings, data?.opening_stats, data?.openings);
  const reliable = pick(openings, "Reliable choice", 0);
  const promising = pick(openings, "Promising but unstable", 1);
  const review = pick(openings, "Needs review", 2);

  const games =
    data?.games_imported ||
    data?.games_analyzed ||
    data?.gamesAnalysed ||
    data?.total_games ||
    data?.summary?.games ||
    0;

  const displayName = username || data?.username || "my Chess.com account";

  const shortSummary = `My OpeningFit report for ${displayName}: rely on ${openingName(reliable)}, track ${openingName(promising, "my unstable openings")}, and review ${openingName(review, "low-confidence openings")}.`;

  const forumPost = `I've been testing OpeningFit, a chess opening analyser that looks at your own Chess.com games and suggests which openings look reliable, unstable, or worth reviewing.

My latest report:
- Reliable choice: ${openingName(reliable)}
- Promising but unstable: ${openingName(promising, "my weaker openings")}
- Needs review: ${openingName(review, "low-performing openings")}
${games ? `- Games analysed: ${games}` : ""}

Would be interested to hear what other players think of the idea and whether the recommendations feel useful.`;

  const handlePrint = () => {
    window.dispatchEvent(new CustomEvent("openingfit-toast", { detail: "Opening print view." }));
    setTimeout(() => window.print(), 250);
  };

  return (
    <section className="ofReportActions" id="report-actions">
      <div className="ofReportActionsHeader">
        <div>
          <div className="ofEyebrow">Next steps</div>
          <h2>Save, share, or improve your report.</h2>
          <p>Turn this report into one useful next step.</p>
        </div>
      </div>

      <div className="ofActionCardGrid">
        <article className="ofActionCard primary">
          <span>Share</span>
          <strong>Copy a quick result summary</strong>
          <p>Short enough to share anywhere.</p>
          <button
            type="button"
            onClick={() => copyText(shortSummary, "Share summary copied.")}
          >
            Copy summary
          </button>
        </article>

        <article className="ofActionCard">
          <span>Feedback</span>
          <strong>Copy a forum feedback post</strong>
          <p>Ask other players for a second opinion.</p>
          <button
            type="button"
            onClick={() => copyText(forumPost, "Forum post copied.")}
          >
            Copy forum post
          </button>
        </article>

        <article className="ofActionCard">
          <span>Save</span>
          <strong>Print or save as PDF</strong>
          <p>Keep a study snapshot.</p>
          <button type="button" onClick={handlePrint}>
            Print / save PDF
          </button>
        </article>

        <article className="ofActionCard">
          <span>Improve</span>
          <strong>Tell us what felt wrong</strong>
          <p>Flag anything that felt off.</p>
          <button type="button" onClick={() => onJump?.("feedback")}>
            Leave feedback
          </button>
        </article>
      </div>

      <div className="ofBetaRoadmap">
        <div>
          <strong>Beta roadmap</strong>
          <p>Next: mobile polish, confidence scoring, history, and premium clarity.</p>
        </div>

        <div className="ofBetaRoadmapTags">
          <span>Mobile polish</span>
          <span>Report history</span>
          <span>Premium preview</span>
          <span>Lichess later</span>
        </div>
      </div>
    </section>
  );
}
