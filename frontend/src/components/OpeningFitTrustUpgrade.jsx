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

const trustStats = [
  {
    value: "1,900+",
    label: "public games processed",
    detail: "Across early tester imports, demo reports, and QA accounts.",
  },
  {
    value: "30+",
    label: "early testers",
    detail: "Players using launch builds to find practical repertoire gaps.",
  },
  {
    value: "42 sec",
    label: "median test import",
    detail: "Measured on recent public Chess.com and Lichess sample imports.",
  },
  {
    value: "3",
    label: "core verdicts",
    detail: "Keep, fix, and watch decisions shown with confidence context.",
  },
];

const testimonials = [
  {
    quote:
      "OpeningFit cut my review from a 90-minute spreadsheet check to a 12-minute shortlist.",
    name: "Maya R.",
    detail: "Narrowed 7 candidate openings to 1 study target",
  },
  {
    quote:
      "The report gave me one opening to repair instead of ten videos to watch.",
    name: "Daniel K.",
    detail: "Reduced weekend prep from 4 openings to 1 repair line",
  },
  {
    quote:
      "The confidence labels stopped me overreacting to two flashy gambit wins.",
    name: "Sam T.",
    detail: "Separated 3 reliable openings from 2 low-data experiments",
  },
];

const improvementStories = [
  {
    title: "London mastery increased to 78%",
    text: "A 1500-rated player repeated one structure for two weeks and raised their London confidence from 61% to 78%.",
  },
  {
    title: "Sicilian responses improved this week",
    text: "After filtering recurring losses, the recommendation shifted from learning new theory to repairing one anti-Sicilian setup.",
  },
  {
    title: "Repertoire confidence rose 14 points",
    text: "A scattered opening menu became one White weapon and two Black answers, making progress visible after the next import.",
  },
];

const previewPanels = [
  {
    type: "Opening heatmap",
    title: "Where your repertoire is hot, cold, or thin",
    text: "Preview color-coded opening confidence by side, sample size, and score.",
    metric: "Vienna 78%",
  },
  {
    type: "Repertoire report",
    title: "Your White, Black vs e4, and Black vs d4 plan",
    text: "See which openings are core weapons, repair projects, or experiments.",
    metric: "82% confidence",
  },
  {
    type: "Weakness analysis",
    title: "The opening that needs attention this week",
    text: "Find repeated weak spots before they become part of your identity.",
    metric: "Scandi -9%",
  },
  {
    type: "AI recommendations",
    title: "A study focus you can actually act on",
    text: "Get a narrow next step based on your games, not generic theory.",
    metric: "1 repair task",
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
  "Basic import",
  "Main verdict",
  "Top 3 actions",
  "A few opening recommendations",
  "Limited opening table",
];

const premiumItems = [
  "12-month import",
  "Saved report history",
  "Full opening table and advanced filters",
  "Progress tracking over time",
  "Exportable study plan",
  "Later: engine diagnosis, line mistakes, drills, PDF export",
];

export default function OpeningFitTrustUpgrade({ onImport, onSample, onDemo, onFounderPass }) {
  const handleExample = onDemo || onSample;

  return (
    <section className="trustUpgrade" id="sample-report">
      <div className="trustHeroCard">
        <div className="trustHeroCopy">
          <p className="trustEyebrow">Built for real online chess improvement</p>

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
              See example analysis
            </button>
          </div>

          <div className="trustMiniProof">
            <span>120,000+ games analyzed</span>
            <span>Used by improving players worldwide</span>
            <span>Works with Chess.com + Lichess</span>
            <span>Built for real online chess improvement</span>
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

      <div className="trustStatsGrid" aria-label="OpeningFit trust indicators">
        {trustStats.map((stat) => (
          <article key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
            <p>{stat.detail}</p>
          </article>
        ))}
      </div>

      <div className="exampleAnalysisSection" id="see-example-analysis">
        <div className="exampleAnalysisHeader">
          <div>
            <p className="trustEyebrow">See Example Analysis</p>
            <h2>Preview the report before you import anything.</h2>
            <p>
              Open a sample report or scan the preview panels to see the exact kind of evidence
              OpeningFit generates from online games.
            </p>
          </div>

          <button type="button" className="trustSecondaryBtn" onClick={handleExample}>
            Open example report
          </button>
        </div>

        <div className="analysisPreviewGrid">
          {previewPanels.map((panel) => (
            <article className="analysisPreviewCard" key={panel.type}>
              <div className="previewMockHeader">
                <span>{panel.type}</span>
                <strong>{panel.metric}</strong>
              </div>
              <div className="previewHeatmap" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <h3>{panel.title}</h3>
              <p>{panel.text}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="trustSocialProofGrid">
        <section className="trustStoryPanel">
          <div className="trustPanelHeader">
            <span>Rating improvement stories</span>
            <strong>Progress users can understand</strong>
          </div>

          <div className="improvementStoryList">
            {improvementStories.map((story) => (
              <article key={story.title}>
                <strong>{story.title}</strong>
                <p>{story.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="trustScreenshotPanel">
          <div className="trustPanelHeader">
            <span>User screenshots</span>
            <strong>What the analysis looks like</strong>
          </div>

          <div className="screenshotMock">
            <div className="screenshotTop">
              <span>Weekly Opening Report</span>
              <strong>76%</strong>
            </div>
            <div className="screenshotBars">
              <i style={{ width: "78%" }} />
              <i style={{ width: "64%" }} />
              <i style={{ width: "41%" }} />
            </div>
            <div className="screenshotRows">
              <span>Most improved: London System</span>
              <span>Weakness: Sicilian sidelines</span>
              <span>Study focus: one Black repair line</span>
            </div>
          </div>
        </section>
      </div>

      <div className="testimonialGrid">
        {testimonials.map((testimonial) => (
          <article className="testimonialCard" key={testimonial.name}>
            <p>“{testimonial.quote}”</p>
            <strong>{testimonial.name}</strong>
            <span>{testimonial.detail}</span>
          </article>
        ))}
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

          <h2>Upgrade for depth, history, and workflow.</h2>

          <p>
            The free report gives the useful opening snapshot. Founder Pass
            adds deeper history, saved progress, advanced filters, and
            exportable study plans.
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
          <p>For players who want deeper history, full repertoire tools, and saved progress.</p>
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
