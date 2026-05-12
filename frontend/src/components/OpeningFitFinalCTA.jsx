export default function OpeningFitFinalCTA({ data, username, onJump }) {
  if (!data) return null;

  const displayName = username || data?.username || "your report";

  return (
    <section className="ofFinalCTA" id="final-cta">
      <div className="ofFinalCTACopy">
        <div className="ofEyebrow">Ship-ready next step</div>

        <h2>Turn {displayName} into a repeatable improvement plan.</h2>

        <p>
          Your report should not just be interesting. It should tell you what to study next,
          what to stop wasting time on, and which openings are already working.
        </p>
      </div>

      <div className="ofFinalCTAStack">
        <article>
          <span>Best next action</span>
          <strong>Pick one opening to improve this week</strong>
          <p>
            Choose one White opening or one Black defence from your report and focus there first.
          </p>
        </article>

        <div className="ofFinalCTAButtons">
          <button type="button" onClick={() => onJump?.("training-plan")}>
            View training plan
          </button>

          <button type="button" className="secondary" onClick={() => onJump?.("feedback")}>
            Leave feedback
          </button>
        </div>
      </div>
    </section>
  );
}
