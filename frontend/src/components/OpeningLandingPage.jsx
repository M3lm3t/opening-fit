import { useEffect, useState } from "react";
import { openingSeoPages, getOpeningSeoPage } from "../data/openingSeoPages.js";
import { SITE_URL } from "./SeoLandingPage.jsx";
import "./SeoLandingPage.css";

const OPENING_STYLE_TAGS = {
  "london-system": "Beginner-friendly",
  "caro-kann": "Solid",
  "kings-indian-defence": "Aggressive",
  "queens-gambit": "Positional",
  "sicilian-defence": "Tactical",
  "french-defence": "Strategic",
  "vienna-game": "Attacking",
  "scotch-game": "Tactical",
  "english-opening": "Flexible",
  "ruy-lopez": "Classical",
  "italian-game": "Beginner-friendly",
  "queens-indian-defence": "Positional",
  "nimzo-indian-defence": "Strategic",
  "grunfeld-defence": "Dynamic",
  "slav-defence": "Solid",
  "scandinavian-defence": "Practical",
  "pirc-defence": "Counterattacking",
  "modern-defence": "Flexible",
  "dutch-defence": "Aggressive",
  "benko-gambit": "Pressure",
};

const OPENING_HUB_GROUPS = [
  {
    title: "Beginner-friendly",
    text: "Simple openings with clear plans and lower early blunder risk.",
    links: [
      ["Italian Game", "/openings/italian-game"],
      ["London System", "/openings/london-system"],
      ["Caro-Kann Defense", "/openings/caro-kann-defense"],
      ["Beginner guide", "/guides/best-chess-openings-for-beginners"],
    ],
  },
  {
    title: "White openings",
    text: "Opening choices for active, solid, or system-based White repertoires.",
    links: [
      ["Vienna Game", "/openings/vienna-game"],
      ["Italian Game", "/openings/italian-game"],
      ["London System", "/openings/london-system"],
      ["Queen's Gambit", "/openings/queens-gambit"],
    ],
  },
  {
    title: "Black against 1.e4",
    text: "Defenses for players who want structure, direct play, or counterattack.",
    links: [
      ["Caro-Kann Defense", "/openings/caro-kann-defense"],
      ["Scandinavian Defense", "/openings/scandinavian-defense"],
      ["French Defence", "/openings/french-defence"],
      ["Sicilian Defence", "/openings/sicilian-defence"],
    ],
  },
  {
    title: "Black against 1.d4",
    text: "Solid and ambitious setups for Queen's Pawn games.",
    links: [
      ["Slav Defence", "/openings/slav-defence"],
      ["King's Indian Defence", "/openings/kings-indian-defence"],
      ["Nimzo-Indian Defence", "/openings/nimzo-indian-defence"],
      ["Dutch Defence", "/openings/dutch-defence"],
    ],
  },
  {
    title: "Tactical",
    text: "For players who like initiative, active pieces, and tactical pressure.",
    links: [
      ["Vienna Game", "/openings/vienna-game"],
      ["Scotch Game", "/openings/scotch-game"],
      ["Sicilian Defence", "/openings/sicilian-defence"],
      ["Benko Gambit", "/openings/benko-gambit"],
    ],
  },
  {
    title: "Solid",
    text: "For players who want repeatable structures before expanding theory.",
    links: [
      ["London System", "/openings/london-system"],
      ["Caro-Kann Defense", "/openings/caro-kann-defense"],
      ["Queen's Gambit", "/openings/queens-gambit"],
      ["Slav Defence", "/openings/slav-defence"],
    ],
  },
];

const OPENING_RELATED_GUIDES = [
  ["Which opening should I play?", "/guides/which-chess-opening-should-i-play"],
  ["Best beginner openings", "/guides/best-chess-openings-for-beginners"],
  ["1000 rated openings", "/guides/best-chess-openings-for-1000-rated-players"],
  ["1200 rated openings", "/guides/best-chess-openings-for-1200-rated-players"],
];

function getOpeningPublicHref(opening) {
  const slug = typeof opening === "string" ? opening : opening?.slug;
  const publicSlug =
    {
      "caro-kann": "caro-kann-defense",
      "scandinavian-defence": "scandinavian-defense",
    }[slug] || slug;

  return `/openings/${publicSlug}`;
}

function getOpeningHubDescription(opening) {
  return opening.seoDescription || opening.intro;
}

function OpeningTopNav({ ThemeToggle, seoTheme, setSeoTheme }) {
  return (
    <nav className="seoTopNav" aria-label="OpeningFit navigation">
      <a className="seoBrandLink" href="/">
        <span>OF</span>
        OpeningFit
      </a>
      <div>
        <a href="/openings">Openings</a>
        <a href="/#app-dashboard">Analyse your games</a>
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

function SeoVisualCard({ eyebrow, title, text, children, tone = "neutral" }) {
  return (
    <article className={`seoVisualCard seoVisualCard-${tone}`}>
      <span>{eyebrow}</span>
      {title ? <h2>{title}</h2> : null}
      {text ? <p>{text}</p> : null}
      {children}
    </article>
  );
}

function getOpeningRatingRange(opening) {
  if (opening.ratingRange) return opening.ratingRange;
  if (["london-system", "italian-game", "vienna-game", "caro-kann", "scandinavian-defence"].includes(opening.slug)) {
    return "800-1800";
  }
  return "1000-1800";
}

function getOpeningDifficulty(opening) {
  if (opening.difficulty) return opening.difficulty;
  if (["london-system", "italian-game", "scandinavian-defence"].includes(opening.slug)) return "Beginner-friendly";
  if (["vienna-game", "caro-kann", "slav-defence", "french-defence"].includes(opening.slug)) return "Easy to medium";
  return "Medium";
}

function getOpeningBestFor(opening) {
  if (opening.bestFor) return opening.bestFor;
  return opening.goodFor || opening.whoItSuits?.[0] || "Players who want a practical opening with clear plans.";
}

function OpeningFitProfileCard({ opening }) {
  const profileRows = [
    ["Style fit", opening.styleFit || OPENING_STYLE_TAGS[opening.slug] || "Practical repertoire choice"],
    ["Rating range", getOpeningRatingRange(opening)],
    ["Difficulty", getOpeningDifficulty(opening)],
    ["Best for", getOpeningBestFor(opening)],
    ["Be careful if", opening.beCarefulIf || opening.weaknesses?.[0] || "The positions do not match how you like to play."],
    ["First moves", opening.basicMoves || opening.sampleMoves.join(" ")],
  ];

  return (
    <aside className="openingFitProfileCard" aria-label={`${opening.name} opening fit profile`}>
      <span>Opening fit profile</span>
      <strong>{opening.name}</strong>
      <dl>
        {profileRows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function OpeningFitNotes({ opening }) {
  const fitCards = [
    opening.styleFit ? ["Fit summary", "Style fit", opening.styleFit, "fit"] : null,
    opening.goodFor ? ["Good for", "Best use", opening.goodFor, "good"] : null,
    opening.beCarefulIf ? ["Be careful if", "Watch the risk", opening.beCarefulIf, "careful"] : null,
    opening.openingFitRecommend ? ["OpeningFit recommendation", "When the app may recommend it", opening.openingFitRecommend, "recommend"] : null,
    opening.openingFitAlternative ? ["Simpler option", "When OpeningFit may simplify", opening.openingFitAlternative, "careful"] : null,
  ].filter(Boolean);

  if (!fitCards.length) return null;

  return (
    <section className="openingSeoFitGrid" aria-label={`${opening.name} player fit`}>
      {fitCards.map(([eyebrow, title, text, tone]) => (
        <SeoVisualCard key={eyebrow} eyebrow={eyebrow} title={title} text={text} tone={tone} />
      ))}
    </section>
  );
}

function OpeningRelatedSeoLinks({ opening }) {
  const relatedOpenings = (opening.relatedOpenings || [])
    .map((slug) => getOpeningSeoPage(slug))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <section className="seoRelatedPanel" aria-label="Related chess opening guides">
      <div>
        <p className="seoEyebrow">Related</p>
        <h2>Keep exploring openings that fit your games</h2>
      </div>
      <div className="seoRelatedColumns">
        <nav aria-label="Related opening pages">
          <strong>Opening pages</strong>
          {(relatedOpenings.length ? relatedOpenings : openingSeoPages.filter((item) => item.slug !== opening.slug).slice(0, 3)).map((item) => (
            <a key={item.slug} href={getOpeningPublicHref(item)}>
              {item.name}
            </a>
          ))}
        </nav>
        <nav aria-label="Related guide pages">
          <strong>Guide pages</strong>
          {OPENING_RELATED_GUIDES.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </div>
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
              <h1>Chess Openings That Fit Your Playing Style</h1>
              <p>
                Browse practical chess openings by role and style, then analyse your own Chess.com or Lichess games
                to see which choices actually fit.
              </p>
              <div className="seoHeroActions">
                <a className="seoPrimaryCta" href="/#app-dashboard">Analyse your games</a>
                <a className="seoSecondaryCta" href="/">OpeningFit home</a>
              </div>
            </div>
          </section>

          <section className="seoInternalLinks openingHubLinks" aria-label="OpeningFit opening guide navigation">
            <div>
              <p className="seoEyebrow">Start here</p>
              <h2>Browse by guide or style</h2>
            </div>
            <nav>
              <a href="/">Homepage</a>
              <a href="/#app-dashboard">Analysis page</a>
              <a href="/best-chess-openings-for-aggressive-players">Aggressive style</a>
              <a href="/best-chess-openings-for-positional-players">Positional style</a>
              <a href="/guides/best-chess-openings-for-beginners">Beginner style</a>
              <a href="/best-chess-openings-for-tactical-players">Tactical style</a>
              <a href="/guides">Chess opening guides</a>
            </nav>
          </section>

          <section className="openingHubCategoryGrid" aria-label="Chess opening categories">
            {OPENING_HUB_GROUPS.map((group) => (
              <article className="openingSeoCard" key={group.title}>
                <span>Opening category</span>
                <h2>{group.title}</h2>
                <p>{group.text}</p>
                <nav>
                  {group.links.map(([label, href]) => (
                    <a key={href} href={href}>
                      {label}
                    </a>
                  ))}
                </nav>
              </article>
            ))}
          </section>

          <section className="openingSeoCardGrid" aria-label="Opening guide pages">
            {openingSeoPages.map((opening) => (
              <article className="openingSeoCard" key={opening.slug}>
                <span>{OPENING_STYLE_TAGS[opening.slug] || "Opening guide"}</span>
                <h2>{opening.name}</h2>
                <p>{getOpeningHubDescription(opening)}</p>
                <a href={getOpeningPublicHref(opening)}>Read guide</a>
              </article>
            ))}
          </section>

          <section className="seoBottomCta seoAnalysisCtaCard">
            <p className="seoEyebrow">Personal opening fit</p>
            <h2>Find the openings that fit your own games</h2>
            <p>
              Opening guides help you choose candidates. OpeningFit checks your real Chess.com or Lichess results
              and shows what to keep, improve, or avoid.
            </p>
            <a className="seoPrimaryCta" href="/#app-dashboard">Analyse your games</a>
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
              Browse available guides or analyse your games for repertoire signals.
            </p>
            <div className="seoHeroActions">
              <a className="seoPrimaryCta" href="/openings">Browse openings</a>
              <a className="seoSecondaryCta" href="/#app-dashboard">Analyse your games</a>
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
              <h1>{opening.h1 || opening.name}</h1>
              <p>{opening.intro}</p>
              <div className="seoHeroActions">
                <a className="seoPrimaryCta" href="/#app-dashboard">Analyse your games</a>
                <a className="seoSecondaryCta" href="/openings">Browse openings</a>
              </div>
            </div>
            <OpeningFitProfileCard opening={opening} />
          </section>

          <OpeningFitNotes opening={opening} />

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

          <SeoVisualCard
            eyebrow="Common mistakes"
            title="What to watch before you play it"
            tone="mistakes"
          >
            <OpeningList items={opening.commonMistakes} />
          </SeoVisualCard>

          <OpeningRelatedSeoLinks opening={opening} />

          <section className="seoBottomCta seoAnalysisCtaCard">
            <h2>Does {opening.name} fit your games?</h2>
            <p>{opening.callToActionText}</p>
            <a className="seoPrimaryCta" href="/#app-dashboard">Analyse your games</a>
          </section>
        </main>
      </div>
      {Analytics ? <Analytics /> : null}
    </>
  );
}

export function getOpeningPageJsonLd(opening, pageUrl = "") {
  const url = pageUrl || `${SITE_URL}${getOpeningPublicHref(opening)}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: opening.h1 || opening.seoTitle,
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
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "OpeningFit",
            item: `${SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Chess Openings",
            item: `${SITE_URL}/openings`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: opening.name,
            item: url,
          },
        ],
      },
    ],
  };
}
