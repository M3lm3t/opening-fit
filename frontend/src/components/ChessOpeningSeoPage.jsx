import { useEffect, useState } from "react";
import { chessOpeningSeoPages } from "../data/chessOpeningSeoPages.js";
import { SITE_URL } from "./SeoLandingPage.jsx";
import "./SeoLandingPage.css";

function ChessOpeningTopNav({ ThemeToggle, seoTheme, setSeoTheme }) {
  return (
    <nav className="seoTopNav" aria-label="OpeningFit navigation">
      <a className="seoBrandLink" href="/">
        <span>OF</span>
        OpeningFit
      </a>
      <div>
        <a href="/chess-openings/vienna-game">Openings</a>
        <a href="/#app-dashboard">Analyse games</a>
        <a href="/openings">Opening library</a>
      </div>
      {ThemeToggle ? (
        <ThemeToggle
          theme={seoTheme}
          onToggle={() => setSeoTheme((current) => (current === "dark" ? "light" : "dark"))}
        />
      ) : null}
    </nav>
  );
}

function ChessOpeningList({ items }) {
  return (
    <ul className="openingSeoList">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ChessOpeningSection({ title, children }) {
  return (
    <section className="seoStyleSection">
      <div className="seoSectionHeading">
        <p className="seoEyebrow">Opening guide</p>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function getChessOpeningPageJsonLd(opening, pageUrl) {
  if (!opening) return null;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${opening.name}: does it fit your chess style?`,
    description: opening.shortDescription || opening.description,
    url: pageUrl || `${SITE_URL}/chess-openings/${opening.slug}`,
    publisher: {
      "@type": "Organization",
      name: "OpeningFit",
      url: SITE_URL,
    },
    mainEntityOfPage: pageUrl || `${SITE_URL}/chess-openings/${opening.slug}`,
  };
}

export function ChessOpeningNotFoundPage({ ThemeToggle, Analytics }) {
  const fallback = chessOpeningSeoPages[0];

  return (
    <div className="seoPage" data-theme="dark">
      <div className="seoPageShell">
        <ChessOpeningTopNav ThemeToggle={ThemeToggle} seoTheme="dark" setSeoTheme={() => {}} />
        <section className="seoHero">
          <div>
            <p className="seoEyebrow">Opening guide</p>
            <h1>That opening page is not published yet.</h1>
            <p>Try one of the current OpeningFit opening guides, or analyse your games to build a personal report.</p>
            <div className="seoHeroActions">
              <a className="seoPrimaryCta" href={`/chess-openings/${fallback.slug}`}>
                Browse Vienna Game
              </a>
              <a className="seoSecondaryCta" href="/#app-dashboard">
                Analyse your games
              </a>
            </div>
          </div>
        </section>
      </div>
      {Analytics ? <Analytics /> : null}
    </div>
  );
}

export default function ChessOpeningSeoPage({ opening, ThemeToggle, Analytics }) {
  const [seoTheme, setSeoTheme] = useState(() => {
    try {
      return localStorage.getItem("openingFit:theme") || "dark";
    } catch {
      return "dark";
    }
  });
  const relatedOpenings = chessOpeningSeoPages.filter((item) => item.slug !== opening.slug);

  useEffect(() => {
    document.documentElement.dataset.theme = seoTheme;
    document.body.dataset.theme = seoTheme;
    try {
      localStorage.setItem("openingFit:theme", seoTheme);
    } catch {
      // Ignore storage failures.
    }
  }, [seoTheme]);

  return (
    <div className="seoPage" data-theme={seoTheme}>
      <div className="seoPageShell">
        <ChessOpeningTopNav ThemeToggle={ThemeToggle} seoTheme={seoTheme} setSeoTheme={setSeoTheme} />

        <section className="seoHero">
          <div>
            <p className="seoEyebrow">Chess opening fit</p>
            <h1>{opening.name}: does it fit your chess style?</h1>
            <p>{opening.shortDescription || opening.description}</p>
            <div className="seoHeroActions">
              <a className="seoPrimaryCta" href="/#app-dashboard">
                {opening.callToAction}
              </a>
              <a className="seoSecondaryCta" href="/openings">
                Browse opening library
              </a>
            </div>
          </div>
          <aside className="seoMiniReport" aria-label={`${opening.name} quick fit notes`}>
            <h2>Quick fit check</h2>
            <div className="seoReportRows">
              <div>
                <span>Best for</span>
                <strong>{opening.whoItSuits[0]}</strong>
              </div>
              <div>
                <span>Main plan</span>
                <strong>{opening.commonPlans[0]}</strong>
              </div>
              <div>
                <span>Watch out</span>
                <strong>{opening.commonMistake}</strong>
              </div>
            </div>
          </aside>
        </section>

        <div className="seoProblemSolution">
          <article>
            <span>Who this opening suits</span>
            <ChessOpeningList items={opening.whoItSuits} />
          </article>
          <article>
            <span>Common plans</span>
            <ChessOpeningList items={opening.commonPlans} />
          </article>
        </div>

        <ChessOpeningSection title="Common mistakes">
          <p>{opening.commonMistake}</p>
        </ChessOpeningSection>

        <section className="seoInternalLinks" aria-label="Related opening pages">
          <h2>Related opening pages</h2>
          <div>
            {relatedOpenings.map((item) => (
              <a key={item.slug} href={`/chess-openings/${item.slug}`}>
                {item.name}
              </a>
            ))}
            <a href="/#app-dashboard">Analyse your games</a>
          </div>
        </section>

        <section className="seoBottomCta">
          <h2>{opening.callToAction}</h2>
          <p>OpeningFit checks your recent games and turns them into a practical opening report.</p>
          <a className="seoPrimaryCta" href="/#app-dashboard">
            Start your report
          </a>
        </section>
      </div>
      {Analytics ? <Analytics /> : null}
    </div>
  );
}
