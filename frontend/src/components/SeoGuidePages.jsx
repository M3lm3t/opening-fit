import { useEffect, useState } from "react";
import OpeningLandingPage from "./OpeningLandingPage.jsx";
import { guideSeoPages } from "../content/seoPages.js";
import "./SeoLandingPage.css";

const GUIDE_RELATED_OPENINGS = [
  ["Vienna Game", "/openings/vienna-game"],
  ["Italian Game", "/openings/italian-game"],
  ["London System", "/openings/london-system"],
  ["Caro-Kann Defense", "/openings/caro-kann-defense"],
];

function SeoTopNav({ ThemeToggle, seoTheme, setSeoTheme }) {
  return (
    <nav className="seoTopNav" aria-label="OpeningFit navigation">
      <a className="seoBrandLink" href="/">
        <span>OF</span>
        OpeningFit
      </a>
      <div>
        <a href="/guides">Guides</a>
        <a href="/openings">Openings</a>
        <a href="/#app-dashboard">Analyse games</a>
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

export function SeoAnalysisCta({ title = "Find the openings that fit your own games" }) {
  return (
    <section className="seoBottomCta seoAnalysisCta seoAnalysisCtaCard">
      <p className="seoEyebrow">Personal analysis</p>
      <h2>{title}</h2>
      <p>
        Enter a public Chess.com or Lichess username and OpeningFit will turn recent games into a practical keep,
        improve, and study-next opening report.
      </p>
      <div className="seoHeroActions">
        <a className="seoPrimaryCta" href="/#app-dashboard">Analyse my games</a>
        <a className="seoSecondaryCta" href="/openingfit-sample-report">View sample report</a>
      </div>
    </section>
  );
}

function GuideLearnCard({ page }) {
  const learningPoints = page.sections.slice(0, 4).map((section) => section.heading);

  return (
    <aside className="seoGuideLearnCard" aria-label="What you'll learn">
      <span>What you'll learn</span>
      <strong>{page.h1}</strong>
      <ul>
        {learningPoints.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}

function SeoRelatedLinks({ page }) {
  const guideLinks = guideSeoPages
    .filter((item) => item.slug !== page.slug)
    .slice(0, 4)
    .map((item) => [item.h1, `/guides/${item.slug}`]);

  const openingLinks = (page.relatedLinks || [])
    .filter((link) => link.href.startsWith("/openings/"))
    .slice(0, 4)
    .map((link) => [link.label.replace(" guide", ""), link.href]);
  const finalOpeningLinks = openingLinks.length ? openingLinks : GUIDE_RELATED_OPENINGS;

  return (
    <section className="seoRelatedPanel" aria-label="Related chess opening content">
      <div>
        <p className="seoEyebrow">Related</p>
        <h2>Keep building a practical repertoire</h2>
      </div>
      <div className="seoRelatedColumns">
        <nav aria-label="Related opening pages">
          <strong>Opening pages</strong>
          {finalOpeningLinks.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <nav aria-label="Related guide pages">
          <strong>Guide pages</strong>
          {guideLinks.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}

export function SeoPageLayout({ children, ThemeToggle, Analytics }) {
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
          <SeoTopNav ThemeToggle={ThemeToggle} seoTheme={seoTheme} setSeoTheme={setSeoTheme} />
          {children}
        </main>
      </div>
      {Analytics ? <Analytics /> : null}
    </>
  );
}

export function SeoGuidePage({ page, ThemeToggle, Analytics }) {
  return (
    <SeoPageLayout ThemeToggle={ThemeToggle} Analytics={Analytics}>
      <section className="seoHero seoGuideHero">
        <div>
          <p className="seoEyebrow">Chess opening guide</p>
          <h1>{page.h1}</h1>
          <p>{page.intro}</p>
          <div className="seoHeroActions">
            <a className="seoPrimaryCta" href="/#app-dashboard">Analyse my games</a>
            <a className="seoSecondaryCta" href="/guides">Browse guides</a>
          </div>
        </div>
        <GuideLearnCard page={page} />
      </section>

      <section className="seoGuideSectionGrid" aria-label="Guide sections">
        {page.sections.map((section) => (
          <article className="seoGuideSectionCard" key={section.heading}>
            <span>Guide</span>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>

      <SeoRelatedLinks page={page} />

      <SeoAnalysisCta />
    </SeoPageLayout>
  );
}

export function GuidesHubPage({ ThemeToggle, Analytics }) {
  return (
    <SeoPageLayout ThemeToggle={ThemeToggle} Analytics={Analytics}>
      <section className="seoHero seoGuideHero">
        <div>
          <p className="seoEyebrow">OpeningFit guides</p>
          <h1>Chess Opening Guides</h1>
          <p>
            Browse opening-choice guides by rating, beginner needs, and style, then use your own games to confirm
            which openings actually fit.
          </p>
          <div className="seoHeroActions">
            <a className="seoPrimaryCta" href="/#app-dashboard">Analyse my games</a>
            <a className="seoSecondaryCta" href="/openings">Browse openings</a>
          </div>
        </div>
      </section>

      <section className="seoGuideCardGrid" aria-label="Popular chess opening guides">
        {guideSeoPages.map((page) => (
          <article className="seoGuideCard" key={page.slug}>
            <span>Guide</span>
            <h2>{page.h1}</h2>
            <p>{page.intro}</p>
            <a href={`/guides/${page.slug}`}>Read guide</a>
          </article>
        ))}
      </section>

      <section className="seoInternalLinks" aria-label="OpeningFit guide navigation">
        <div>
          <p className="seoEyebrow">Openings</p>
          <h2>Popular opening pages</h2>
        </div>
        <nav>
          <a href="/openings/vienna-game">Vienna Game</a>
          <a href="/openings/caro-kann-defense">Caro-Kann Defense</a>
          <a href="/openings/scandinavian-defense">Scandinavian Defense</a>
          <a href="/openings/london-system">London System</a>
          <a href="/openings/italian-game">Italian Game</a>
        </nav>
      </section>

      <SeoAnalysisCta />
    </SeoPageLayout>
  );
}

export function GuideNotFoundPage({ ThemeToggle, Analytics }) {
  return (
    <SeoPageLayout ThemeToggle={ThemeToggle} Analytics={Analytics}>
      <section className="seoBottomCta openingNotFound">
        <p className="seoEyebrow">Guide not found</p>
        <h1>No chess opening guide found</h1>
        <p>Browse the published OpeningFit guides or analyse your own games for opening recommendations.</p>
        <div className="seoHeroActions">
          <a className="seoPrimaryCta" href="/guides">Browse guides</a>
          <a className="seoSecondaryCta" href="/#app-dashboard">Analyse games</a>
        </div>
      </section>
    </SeoPageLayout>
  );
}

export function OpeningSeoPage(props) {
  return <OpeningLandingPage {...props} />;
}
