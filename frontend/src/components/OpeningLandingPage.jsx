import { useEffect, useState } from "react";
import { openingSeoPages, getOpeningSeoPage } from "../data/openingSeoPages.js";
import { SITE_URL } from "./SeoLandingPage.jsx";
import "./SeoLandingPage.css";

function OpeningTopNav({ ThemeToggle, seoTheme, setSeoTheme }) {
  return (
    <nav className="seoTopNav" aria-label="OpeningFit navigation">
      <a className="seoBrandLink" href="/">
        <span>OF</span>
        OpeningFit
      </a>
      <div>
        <a href="/openings">Openings</a>
        <a href="/#app-dashboard">Analyze games</a>
        <a href="/openingfit-sample-report">Sample report</a>
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

function OpeningList({ items }) {
  return (
    <ul className="openingSeoList">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function RelatedOpeningLinks({ opening }) {
  const related = (opening.relatedOpenings || [])
    .map((slug) => getOpeningSeoPage(slug))
    .filter(Boolean);

  if (!related.length) return null;

  return (
    <section className="seoInternalLinks openingRelatedLinks" aria-label="Related chess openings">
      <div>
        <p className="seoEyebrow">Related openings</p>
        <h2>Compare nearby repertoire choices</h2>
      </div>
      <nav>
        {related.map((item) => (
          <a key={item.slug} href={`/openings/${item.slug}`}>
            {item.name}
          </a>
        ))}
      </nav>
    </section>
  );
}

export function OpeningHubPage({ ThemeToggle, Analytics }) {
  const [seoTheme, setSeoTheme] = useState(() => localStorage.getItem("openingFit:theme") || "dark");

  useEffect(() => {
    localStorage.setItem("openingFit:theme", seoTheme);
    document.documentElement.setAttribute("data-theme", seoTheme);
    document.body.classList.remove("light", "dark");
    document.body.classList.add(seoTheme);
  }, [seoTheme]);

  return (
    <>
      <div className={`page ${seoTheme} publicLandingPage seoPage`} data-theme={seoTheme}>
        <main className="seoPageShell">
          <OpeningTopNav ThemeToggle={ThemeToggle} seoTheme={seoTheme} setSeoTheme={setSeoTheme} />

          <section className="seoHero openingSeoHero">
            <div>
              <p className="seoEyebrow">Opening guides</p>
              <h1>Chess opening guides for real online games</h1>
              <p>
                Learn the core ideas behind popular openings, then use OpeningFit to check whether those openings actually fit your Chess.com or Lichess results.
              </p>
              <div className="seoHeroActions">
                <a className="seoPrimaryCta" href="/#app-dashboard">Analyze my games</a>
                <a className="seoSecondaryCta" href="/openingfit-sample-report">View sample report</a>
              </div>
            </div>
          </section>

          <section className="openingSeoCardGrid" aria-label="Opening guide pages">
            {openingSeoPages.map((opening) => (
              <article className="openingSeoCard" key={opening.slug}>
                <span>Opening guide</span>
                <h2>{opening.name}</h2>
                <p>{opening.intro}</p>
                <a href={`/openings/${opening.slug}`}>Read guide</a>
              </article>
            ))}
          </section>
        </main>
      </div>
      {Analytics ? <Analytics /> : null}
    </>
  );
}

export function OpeningNotFoundPage({ slug, ThemeToggle, Analytics }) {
  const [seoTheme, setSeoTheme] = useState(() => localStorage.getItem("openingFit:theme") || "dark");

  useEffect(() => {
    localStorage.setItem("openingFit:theme", seoTheme);
    document.documentElement.setAttribute("data-theme", seoTheme);
    document.body.classList.remove("light", "dark");
    document.body.classList.add(seoTheme);
  }, [seoTheme]);

  return (
    <>
      <div className={`page ${seoTheme} publicLandingPage seoPage`} data-theme={seoTheme}>
        <main className="seoPageShell">
          <OpeningTopNav ThemeToggle={ThemeToggle} seoTheme={seoTheme} setSeoTheme={setSeoTheme} />
          <section className="seoBottomCta openingNotFound">
            <p className="seoEyebrow">Opening not found</p>
            <h1>No opening guide for {slug || "that page"} yet</h1>
            <p>
              This opening page has not been published yet. Browse the available opening guides or analyze your games to find your current repertoire signals.
            </p>
            <div className="seoHeroActions">
              <a className="seoPrimaryCta" href="/openings">Browse openings</a>
              <a className="seoSecondaryCta" href="/#app-dashboard">Analyze games</a>
            </div>
          </section>
        </main>
      </div>
      {Analytics ? <Analytics /> : null}
    </>
  );
}

export default function OpeningLandingPage({ opening, ThemeToggle, Analytics }) {
  const [seoTheme, setSeoTheme] = useState(() => localStorage.getItem("openingFit:theme") || "dark");

  useEffect(() => {
    localStorage.setItem("openingFit:theme", seoTheme);
    document.documentElement.setAttribute("data-theme", seoTheme);
    document.body.classList.remove("light", "dark");
    document.body.classList.add(seoTheme);
  }, [seoTheme]);

  return (
    <>
      <div className={`page ${seoTheme} publicLandingPage seoPage`} data-theme={seoTheme}>
        <main className="seoPageShell openingSeoPage">
          <OpeningTopNav ThemeToggle={ThemeToggle} seoTheme={seoTheme} setSeoTheme={setSeoTheme} />

          <section className="seoHero openingSeoHero">
            <div>
              <p className="seoEyebrow">Chess opening guide</p>
              <h1>{opening.name}</h1>
              <p>{opening.intro}</p>
              <div className="seoHeroActions">
                <a className="seoPrimaryCta" href="/#app-dashboard">Analyze my games</a>
                <a className="seoSecondaryCta" href="/openings">Browse openings</a>
              </div>
            </div>
            <div className="openingMoveCard" aria-label={`${opening.name} sample move order`}>
              <span>Sample move order</span>
              <strong>{opening.sampleMoves.join(" ")}</strong>
            </div>
          </section>

          <section className="openingSeoTwoColumn">
            <article>
              <span>Main ideas</span>
              <OpeningList items={opening.mainIdeas} />
            </article>
            <article>
              <span>Who it suits</span>
              <OpeningList items={opening.whoItSuits} />
            </article>
          </section>

          <section className="openingSeoTwoColumn">
            <article>
              <span>Strengths</span>
              <OpeningList items={opening.strengths} />
            </article>
            <article>
              <span>Weaknesses</span>
              <OpeningList items={opening.weaknesses} />
            </article>
          </section>

          <section className="seoMiniReport openingMistakesSection">
            <div>
              <p className="seoEyebrow">Common mistakes</p>
              <h2>What to watch before you play it</h2>
            </div>
            <OpeningList items={opening.commonMistakes} />
          </section>

          <RelatedOpeningLinks opening={opening} />

          <section className="seoBottomCta">
            <h2>Does {opening.name} fit your games?</h2>
            <p>{opening.callToActionText}</p>
            <a className="seoPrimaryCta" href="/#app-dashboard">Analyze games with OpeningFit</a>
          </section>
        </main>
      </div>
      {Analytics ? <Analytics /> : null}
    </>
  );
}

export function getOpeningPageJsonLd(opening) {
  const url = `${SITE_URL}/openings/${opening.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: opening.seoTitle,
    name: opening.name,
    description: opening.seoDescription,
    url,
    mainEntityOfPage: url,
    publisher: {
      "@type": "Organization",
      name: "OpeningFit",
      url: SITE_URL,
    },
    about: opening.name,
  };
}
