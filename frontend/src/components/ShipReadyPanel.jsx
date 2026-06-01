function scrollToTarget(targetId) {
  const target = document.getElementById(targetId);

  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function ShipReadyPanel({ data, onViewChange }) {
  if (!data) return null;

  const goFeedback = () => {
    if (typeof onViewChange === "function") {
      onViewChange("feedback");
    }

    setTimeout(() => scrollToTarget("feedback"), 80);
  };

  const goReports = () => {
    if (typeof onViewChange === "function") {
      onViewChange("profile");
    }

    setTimeout(() => scrollToTarget("report-history"), 80);
  };

  return (
    <section className="shipReadyPanel" id="ship-ready">
      <div className="shipReadyHeader">
        <div>
          <p className="eyebrow">Launch readiness</p>
          <h2>Opening Fit is in public beta</h2>
          <p>
            This app is ready for early users, feedback, and real testing. The goal is
            to make opening improvement practical by using your own games rather than
            generic theory.
          </p>
        </div>

        <div className="betaBadge">
          <strong>Beta</strong>
          <span>Actively improving</span>
        </div>
      </div>

      <div className="shipReadyGrid">
        <article>
          <span>Privacy</span>
          <h3>Only public chess data</h3>
          <p>
            Opening Fit works from public Chess.com/Lichess-style game data. Users should
            not enter passwords or private account details.
          </p>
        </article>

        <article>
          <span>Reliability</span>
          <h3>Crash-safe experience</h3>
          <p>
            If a display error happens, users now get a recovery screen instead of a blank
            app. That makes the product safer to share.
          </p>
        </article>

        <article>
          <span>Feedback</span>
          <h3>Built for early testers</h3>
          <p>
            The best next data is real user feedback: confusing sections, wrong opening
            labels, import issues, and features people would pay for.
          </p>
        </article>
      </div>

      <div className="shipReadyActions">
        <button type="button" onClick={goFeedback}>
          Leave feedback
        </button>

        <button type="button" onClick={goReports}>
          Save this report
        </button>

        <a href="mailto:m3lm3t@gmail.com?subject=Opening%20Fit%20feedback">
          Email bug report
        </a>
      </div>

      <div className="shipReadyChecklist">
        <strong>Before bigger promotion:</strong>
        <span>test 10 usernames</span>
        <span>check mobile layout</span>
        <span>save one report</span>
        <span>confirm feedback works</span>
        <span>push latest build</span>
      </div>
    </section>
  );
}
