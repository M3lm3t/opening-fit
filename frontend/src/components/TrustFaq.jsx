export default function TrustFaq() {
  return (
    <section className="trustFaqShell" id="trust-faq">
      <div className="trustFaqHero">
        <div>
          <div className="trustFaqEyebrow">Before you import</div>
          <h2>OpeningFit only needs your public chess username.</h2>
          <p>
            No Chess.com password. No Lichess password. Just enter a public username and
            OpeningFit analyses recent games to suggest openings, weaknesses and a simple
            study plan.
          </p>
        </div>

        <div className="trustFaqChecklist">
          <div>
            <strong>✓ No chess password needed</strong>
            <span>OpeningFit does not ask for your Chess.com or Lichess login.</span>
          </div>

          <div>
            <strong>✓ Public games only</strong>
            <span>The app analyses publicly available game data from your username.</span>
          </div>

          <div>
            <strong>✓ Free to try</strong>
            <span>Import games, view your summary, save progress and share your report.</span>
          </div>
        </div>
      </div>

      <div className="trustFaqGrid">
        <div className="trustFaqCard">
          <span>What does OpeningFit do?</span>
          <p>
            It looks at your recent games and turns your openings into a clearer plan:
            what to keep, what to improve, what to avoid, and what to study next.
          </p>
        </div>

        <div className="trustFaqCard">
          <span>Is it free?</span>
          <p>
            Yes. The core app is free to try. Premium is being tested as an optional upgrade
            for deeper coach plans, repertoire tools and future saved history.
          </p>
        </div>

        <div className="trustFaqCard">
          <span>Why sign in?</span>
          <p>
            Sign-in is optional. You can use the app without an account. Later, sign-in will
            help save your progress and repertoire across devices.
          </p>
        </div>

        <div className="trustFaqCard">
          <span>Why might Google show Supabase?</span>
          <p>
            OpeningFit uses Supabase as its secure beta login provider. On the free setup,
            Google may show the Supabase auth URL during sign-in.
          </p>
        </div>

        <div className="trustFaqCard">
          <span>Who is it for?</span>
          <p>
            Club players, casual improvers and online chess players who want practical
            opening guidance from their own games instead of generic theory.
          </p>
        </div>

        <div className="trustFaqCard">
          <span>Is it finished?</span>
          <p>
            Not fully. OpeningFit is in active beta, so feedback is welcome. The goal is to
            make the app more useful before turning on real payments.
          </p>
        </div>
      </div>
    </section>
  );
}
