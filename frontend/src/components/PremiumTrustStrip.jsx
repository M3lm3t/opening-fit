export default function PremiumTrustStrip() {
  return (
    <section className="premiumTrustStrip" id="premium-roadmap">
      <div className="premiumTrustCard">
        <span>Why Premium exists</span>
        <h3>Premium should save study time, not just unlock more charts.</h3>
        <p>
          The paid version of OpeningFit should help players make one clear decision:
          what to play next, what to stop playing, and how to build a simple repertoire
          from their own games.
        </p>
      </div>

      <div className="premiumRoadmapCard">
        <span>Premium roadmap</span>
        <h3>What paying users should get next</h3>

        <div className="premiumRoadmapList">
          <div>
            <strong>Saved repertoire</strong>
            <small>Live</small>
          </div>

          <div>
            <strong>7-day coach plan</strong>
            <small>Live</small>
          </div>

          <div>
            <strong>Monthly progress tracking</strong>
            <small>Next</small>
          </div>

          <div>
            <strong>Stripe checkout</strong>
            <small>After feedback</small>
          </div>
        </div>
      </div>
    </section>
  );
}
