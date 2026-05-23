import { useEffect, useState } from "react";
import "./SeoLandingPage.css";

export const SITE_URL = "https://www.openingfit.com";

export const HOME_SEO = {
  title: "Opening Fit | Chess Opening Analysis & Repertoire Builder",
  description:
    "Import your Chess.com or Lichess games and get a practical chess opening repertoire plan based on how you actually play.",
  path: "/",
  h1: "Find the chess openings that fit how you actually play",
};

export const SEO_LINKS = [
  ["Repertoire builder", "/chess-opening-repertoire-builder"],
  ["Which opening?", "/which-chess-opening-should-i-play"],
  ["Chess.com analysis", "/chess-com-opening-analysis"],
  ["Lichess analysis", "/lichess-opening-analysis"],
  ["Sample report", "/openingfit-sample-report"],
];

const sharedFaqs = [
  [
    "Is OpeningFit an engine?",
    "No. OpeningFit is a practical opening report. It uses your game history to spot repertoire patterns, not to replace engine analysis.",
  ],
  [
    "Do I need to log in?",
    "No login is required for the basic flow. OpeningFit works from public Chess.com or Lichess games by username.",
  ],
  [
    "What does Keep, Improve, and Watch mean?",
    "Keep means an opening is currently reliable, Improve means a line or pattern needs repair, and Watch means the sample is too noisy for a hard verdict.",
  ],
];

const exampleCards = [
  {
    verdict: "Keep",
    opening: "Caro-Kann Defence",
    detail: "Black repertoire signal",
    metric: "Stable results from repeat structures",
  },
  {
    verdict: "Improve",
    opening: "Italian Game",
    detail: "White repair target",
    metric: "Good starts, weaker after early exchanges",
  },
  {
    verdict: "Watch",
    opening: "Gambit experiments",
    detail: "Low-confidence sample",
    metric: "Fun games, but too little evidence",
  },
];

export const SEO_PAGES = {
  "/chess-opening-repertoire-builder": {
    title: "Chess Opening Repertoire Builder | OpeningFit",
    description:
      "Build a practical chess opening repertoire from your real Chess.com or Lichess games with colour-aware OpeningFit recommendations.",
    h1: "Chess opening repertoire builder for real online games",
    eyebrow: "Repertoire builder",
    intro:
      "OpeningFit helps you build a chess opening repertoire from the games you actually play, so your White and Black choices are based on evidence rather than random theory lists.",
    problemTitle: "Most repertoire advice starts too far from your games.",
    problem:
      "Generic opening courses can be useful, but they often assume a style, rating range, and memory load that may not fit you.",
    solutionTitle: "OpeningFit starts with your own results.",
    solution:
      "Import recent games, separate White and Black patterns, then turn the report into keep, improve, and watch decisions for your repertoire.",
    faq: [
      ["How does the repertoire builder work?", "OpeningFit reviews your common openings, score patterns, side, sample size, and practical fit before suggesting what to keep or repair."],
      ["Can it suggest openings for White and Black?", "Yes. The report separates White choices, Black choices, and openings you only faced as an opponent."],
      ...sharedFaqs,
    ],
  },
  "/which-chess-opening-should-i-play": {
    title: "Which Chess Opening Should I Play? | OpeningFit",
    description:
      "Use OpeningFit to choose chess openings from your real games, style, and results instead of guessing from generic opening quizzes.",
    h1: "Which chess opening should I play?",
    eyebrow: "Opening choice",
    intro:
      "The best opening for you is the one that repeatedly gives you positions you understand. OpeningFit uses your games to show which choices are already working and which ones need a simpler plan.",
    problemTitle: "Opening quizzes can miss the positions you actually reach.",
    problem:
      "You might like attacking chess in theory, but your games may show that you score better from solid structures, open centres, or specific move orders.",
    solutionTitle: "Use your own games as the opening quiz.",
    solution:
      "OpeningFit turns your Chess.com or Lichess history into practical recommendations, confidence labels, and one next study action.",
    faq: [
      ["Can OpeningFit pick one opening for me?", "It can highlight your best current fits and weaker repeat choices, then suggest a practical direction for your next study block."],
      ["Does rating matter when choosing openings?", "Yes. A good opening choice should fit your rating, memory load, and common opponent mistakes."],
      ...sharedFaqs,
    ],
  },
  "/chess-com-opening-analysis": {
    title: "Chess.com Opening Analysis | OpeningFit",
    description:
      "Import public Chess.com games and analyse your openings by colour, result, confidence, and practical study priority.",
    h1: "Chess.com opening analysis from your public games",
    eyebrow: "Chess.com analysis",
    intro:
      "Enter a Chess.com username and OpeningFit turns recent public games into a clean opening report: what works, what needs repair, and what to practise next.",
    problemTitle: "Chess.com game history contains useful opening signals.",
    problem:
      "Those signals are hard to read manually when openings are mixed across colours, time controls, and one-game experiments.",
    solutionTitle: "OpeningFit turns Chess.com games into a repertoire report.",
    solution:
      "The report groups openings, adds sample-size guardrails, and gives you practical keep, improve, and watch decisions.",
    faq: [
      ["Does OpeningFit need my Chess.com password?", "No. Use a public Chess.com username. OpeningFit does not need your password for the basic report."],
      ["Can it analyse recent Chess.com games?", "Yes. Choose an import window and OpeningFit reviews recent public games for opening patterns."],
      ...sharedFaqs,
    ],
  },
  "/lichess-opening-analysis": {
    title: "Lichess Opening Analysis | OpeningFit",
    description:
      "Analyse public Lichess games with OpeningFit to find opening patterns, repertoire fits, weak lines, and study priorities.",
    h1: "Lichess opening analysis for practical repertoire choices",
    eyebrow: "Lichess analysis",
    intro:
      "OpeningFit reads public Lichess games and turns your opening history into a mobile-friendly report for repertoire decisions and study planning.",
    problemTitle: "Lichess studies and exports can be too broad for quick decisions.",
    problem:
      "If you only have twenty minutes to study, you need to know which opening pattern deserves attention first.",
    solutionTitle: "OpeningFit prioritises the practical next action.",
    solution:
      "Import public games, review colour-aware opening cards, and focus on the line or structure that is most affecting your results.",
    faq: [
      ["Does OpeningFit work with Lichess usernames?", "Yes. Use a public Lichess username to create an opening report from recent public games."],
      ["Can it help build a Lichess repertoire?", "Yes. It can separate reliable choices from repair targets so you know what to keep and what to study."],
      ...sharedFaqs,
    ],
  },
  "/openingfit-sample-report": {
    title: "OpeningFit Sample Report | Chess Opening Analysis Example",
    description:
      "See an example OpeningFit chess opening report with keep, improve, and watch cards for repertoire planning.",
    h1: "OpeningFit sample report",
    eyebrow: "Sample report",
    intro:
      "Preview the kind of opening report OpeningFit creates from real online games: clean result cards, confidence-aware verdicts, and practical study direction.",
    problemTitle: "A useful report should be easy to act on.",
    problem:
      "Long PGN dumps and raw opening tables can make it hard to decide what to study before your next games.",
    solutionTitle: "OpeningFit keeps the report focused.",
    solution:
      "The sample cards show how the app frames openings as keep, improve, or watch, then connects each result to an action.",
    faq: [
      ["Is the sample report real data?", "It is demo-style sample data designed to show the report format without exposing a real player's history."],
      ["Can I generate my own report?", "Yes. Go back to the main import flow and enter a Chess.com or Lichess username."],
      ...sharedFaqs,
    ],
  },
};

export function getSeoData(path) {
  const cleanPath = path && path.length > 1 ? path.replace(/\/+$/, "") : "/";
  const page = SEO_PAGES[cleanPath];
  if (!page) return { ...HOME_SEO, url: `${SITE_URL}/` };
  return { ...page, path: cleanPath, url: `${SITE_URL}${cleanPath}` };
}

export function getSeoJsonLd(page) {
  if (!page?.path || page.path === "/") return null;

  const graph = [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "OpeningFit",
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
      url: `${SITE_URL}/`,
      description: HOME_SEO.description,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "GBP",
      },
    },
    {
      "@type": "WebPage",
      "@id": `${page.url}#webpage`,
      name: page.title,
      url: page.url,
      description: page.description,
      isPartOf: {
        "@type": "WebSite",
        name: "OpeningFit",
        url: `${SITE_URL}/`,
      },
      about: {
        "@id": `${SITE_URL}/#software`,
      },
    },
  ];

  if (Array.isArray(page.faq) && page.faq.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${page.url}#faq`,
      mainEntity: page.faq.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function SeoExampleCards() {
  return (
    <div className="seoExampleCards" aria-label="Example OpeningFit result cards">
      {exampleCards.map((card) => (
        <article className={`seoExampleCard seoExampleCard${card.verdict}`} key={card.opening}>
          <span>{card.verdict}</span>
          <h3>{card.opening}</h3>
          <p>{card.detail}</p>
          <strong>{card.metric}</strong>
        </article>
      ))}
    </div>
  );
}

export default function SeoLandingPage({ page, ThemeToggle, Analytics }) {
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
        {ThemeToggle ? (
          <ThemeToggle
            theme={seoTheme}
            onToggle={() => setSeoTheme((current) => (current === "dark" ? "light" : "dark"))}
          />
        ) : null}

        <main className="seoPageShell">
          <nav className="seoTopNav" aria-label="OpeningFit navigation">
            <a className="seoBrandLink" href="/">
              <span>OF</span>
              OpeningFit
            </a>
            <div>
              <a href="/">Import games</a>
              <a href="/openingfit-sample-report">Sample report</a>
            </div>
          </nav>

          <section className="seoHero">
            <div>
              <p className="seoEyebrow">{page.eyebrow || "OpeningFit"}</p>
              <h1>{page.h1}</h1>
              <p>{page.intro}</p>
              <div className="seoHeroActions">
                <a className="seoPrimaryCta" href="/#app-dashboard">Start a free opening report</a>
                <a className="seoSecondaryCta" href="/openingfit-sample-report">View sample report</a>
              </div>
            </div>
            <SeoExampleCards />
          </section>

          <section className="seoProblemSolution" aria-label="Problem and solution">
            <article>
              <span>Problem</span>
              <h2>{page.problemTitle}</h2>
              <p>{page.problem}</p>
            </article>
            <article>
              <span>Solution</span>
              <h2>{page.solutionTitle}</h2>
              <p>{page.solution}</p>
            </article>
          </section>

          <section className="seoMiniReport" aria-label="OpeningFit report example">
            <div>
              <p className="seoEyebrow">Example result</p>
              <h2>What an OpeningFit result looks like</h2>
              <p>
                The report stays compact: opening name, side, confidence, practical verdict, and the next action worth studying.
              </p>
            </div>
            <div className="seoReportRows">
              <div><span>White</span><strong>Italian Game</strong><small>Improve one exchange line</small></div>
              <div><span>Black vs e4</span><strong>Caro-Kann Defence</strong><small>Keep as a stable base</small></div>
              <div><span>Low sample</span><strong>Gambit experiments</strong><small>Watch before replacing repertoire</small></div>
            </div>
          </section>

          <section className="seoFaq" aria-label="FAQ">
            <div className="seoSectionHeading">
              <p className="seoEyebrow">FAQ</p>
              <h2>Common questions</h2>
            </div>
            <div className="seoFaqGrid">
              {page.faq.map(([question, answer]) => (
                <article key={question}>
                  <h3>{question}</h3>
                  <p>{answer}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="seoInternalLinks" aria-label="Related OpeningFit pages">
            <div>
              <p className="seoEyebrow">Explore</p>
              <h2>More OpeningFit pages</h2>
            </div>
            <nav>
              {SEO_LINKS.map(([label, href]) => (
                <a className={page.path === href ? "active" : ""} key={href} href={href}>
                  {label}
                </a>
              ))}
            </nav>
          </section>

          <section className="seoBottomCta">
            <h2>Ready to analyse your openings?</h2>
            <p>Import your games and turn your opening history into a cleaner repertoire plan.</p>
            <a className="seoPrimaryCta" href="/#app-dashboard">Go to the import flow</a>
          </section>
        </main>
      </div>
      {Analytics ? <Analytics /> : null}
    </>
  );
}
