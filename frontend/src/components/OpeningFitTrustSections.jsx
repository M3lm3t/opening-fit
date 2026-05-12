export default function OpeningFitTrustSections() {
  return (
    <section className="ofTrustWrap" id="how-it-works">
      <div className="ofTrustHeader">
        <div className="ofEyebrow">Built for practical improvement</div>
        <h2>Not another giant opening database.</h2>
        <p>
          OpeningFit is designed for players who want a clear answer:
          which openings are helping, which need work, and what to study next.
        </p>
      </div>

      <div className="ofTrustGrid">
        <article>
          <span>01</span>
          <strong>Import your games</strong>
          <p>Use your public Chess.com username to analyse recent games quickly.</p>
        </article>

        <article>
          <span>02</span>
          <strong>Find opening patterns</strong>
          <p>See your results by opening, colour, and practical performance.</p>
        </article>

        <article>
          <span>03</span>
          <strong>Get a repertoire direction</strong>
          <p>Turn your real games into a keep, improve, or avoid study plan.</p>
        </article>
      </div>

      <div className="ofAudienceCard">
        <div>
          <h3>Who it is for</h3>
          <p>
            Best for improving Chess.com players around 800–1800 who want a simple,
            personal opening plan instead of memorising endless theory.
          </p>
        </div>

        <div className="ofAudienceTags">
          <span>Club players</span>
          <span>Chess.com users</span>
          <span>Opening improvers</span>
          <span>Beta testers</span>
        </div>
      </div>
    </section>
  );
}
