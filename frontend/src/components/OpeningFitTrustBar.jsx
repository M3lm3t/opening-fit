export default function OpeningFitTrustBar({ data }) {
  if (!data) return null;

  return (
    <section className="ofTrustBar" id="trust-bar">
      <div className="ofTrustBarMain">
        <div>
          <span>Beta transparency</span>
          <strong>OpeningFit is designed to guide study, not replace your chess judgement.</strong>
          <p>
            Use the recommendations as a practical starting point. The best reports come from
            a decent sample of recent games and honest feedback when something feels wrong.
          </p>
        </div>

        <div className="ofTrustBarStats">
          <article>
            <strong>Public games</strong>
            <span>Free account saves reports</span>
          </article>

          <article>
            <strong>Practical output</strong>
            <span>Keep / Improve / Avoid</span>
          </article>

          <article>
            <strong>Early beta</strong>
            <span>Feedback improves it</span>
          </article>
        </div>
      </div>
    </section>
  );
}
