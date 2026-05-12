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

  if (verdict.includes("keep")) return "Keep";
  if (verdict.includes("improve")) return "Improve";
  if (verdict.includes("avoid")) return "Avoid";

  const winRate = getWinRate(item);

  if (winRate === null) return "Review";
  if (winRate >= 58) return "Keep";
  if (winRate >= 45) return "Improve";
  return "Avoid";
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
  const keep = pick(openings, "Keep", 0);
  const improve = pick(openings, "Improve", 1);
  const avoid = pick(openings, "Avoid", 2);

  const games =
    data?.games_imported ||
    data?.games_analyzed ||
    data?.gamesAnalysed ||
    data?.total_games ||
    data?.summary?.games ||
    0;

  const displayName = username || data?.username || "my Chess.com account";

  const shortSummary = `My OpeningFit report for ${displayName}: keep ${openingName(keep)}, improve ${openingName(improve, "my weaker openings")}, and review ${openingName(avoid, "low-performing openings")}.`;

  const forumPost = `I've been testing OpeningFit, a chess opening analyser that looks at your own Chess.com games and suggests what openings to keep, improve, or avoid.

My latest report:
- Keep: ${openingName(keep)}
- Improve: ${openingName(improve, "my weaker openings")}
- Review: ${openingName(avoid, "low-performing openings")}
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
          <p>
            Your report is most useful when it becomes a study plan. Copy the summary,
            save it as a PDF, or send feedback while the results are fresh.
          </p>
        </div>
      </div>

      <div className="ofActionCardGrid">
        <article className="ofActionCard primary">
          <span>Share</span>
          <strong>Copy a quick result summary</strong>
          <p>Useful for Discord, Chess.com messages, Reddit, or sending to a coach.</p>
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
          <p>A ready-made friendly post for asking other chess players what they think.</p>
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
          <p>Keep your current report as a simple study snapshot before re-analysing.</p>
          <button type="button" onClick={handlePrint}>
            Print / save PDF
          </button>
        </article>

        <article className="ofActionCard">
          <span>Improve</span>
          <strong>Tell us what felt wrong</strong>
          <p>OpeningFit is still improving. Bad recommendations are the most useful feedback.</p>
          <button type="button" onClick={() => onJump?.("feedback")}>
            Leave feedback
          </button>
        </article>
      </div>

      <div className="ofBetaRoadmap">
        <div>
          <strong>Beta roadmap</strong>
          <p>
            Next targets: cleaner mobile report flow, stronger opening confidence scoring,
            account history, and sharper premium/free separation.
          </p>
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
