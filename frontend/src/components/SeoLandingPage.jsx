import { useEffect, useState } from "react";
import "./SeoLandingPage.css";

export const SITE_URL = "https://www.openingfit.com";
export const DEFAULT_SHARE_IMAGE = `${SITE_URL}/og-image.png`;
export const ORGANIZATION_NAME = "OpeningFit";

export const HOME_SEO = {
  title: "Find the Best Chess Opening for Your Playing Style | OpeningFit",
  description:
    "Analyse your Chess.com or Lichess games and discover which chess openings suit your rating, results and playing style. Build a simple opening repertoire for White and Black.",
  path: "/",
  h1: "Find the chess openings that fit your playing style",
};

export const SEO_LINKS = [
  ["Opening guides", "/openings"],
  ["Chess guides", "/guides"],
  ["Vienna Game", "/chess-openings/vienna-game"],
  ["Scandinavian Defense", "/chess-openings/scandinavian-defense"],
  ["Caro-Kann Defense", "/chess-openings/caro-kann-defense"],
  ["London System", "/chess-openings/london-system"],
  ["Sicilian Defense", "/chess-openings/sicilian-defense"],
  ["Which opening?", "/guides/which-chess-opening-should-i-play"],
  ["Beginner openings", "/guides/best-chess-openings-for-beginners"],
  ["1000 rated openings", "/guides/best-chess-openings-for-1000-rated-players"],
  ["Repertoire builder", "/chess-opening-repertoire-builder"],
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
    "Keep means an opening is currently reliable, Improve means a line or pattern needs repair, and Watch means the sample is too noisy for a firm opening call.",
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

const styleOpeningPages = {
  aggressive: [
    ["Sicilian Defence", "/openings/sicilian-defence"],
    ["King's Indian Defence", "/openings/kings-indian-defence"],
    ["Dutch Defence", "/openings/dutch-defence"],
  ],
  positional: [
    ["Queen's Gambit", "/openings/queens-gambit"],
    ["Ruy Lopez", "/openings/ruy-lopez"],
    ["Nimzo-Indian Defence", "/openings/nimzo-indian-defence"],
  ],
  beginner: [
    ["London System", "/openings/london-system"],
    ["Italian Game", "/openings/italian-game"],
    ["Caro-Kann Defence", "/openings/caro-kann"],
  ],
  tactical: [
    ["Scotch Game", "/openings/scotch-game"],
    ["Vienna Game", "/openings/vienna-game"],
    ["Sicilian Defence", "/openings/sicilian-defence"],
  ],
  chooser: [
    ["London System", "/openings/london-system"],
    ["Caro-Kann Defence", "/openings/caro-kann"],
    ["Queen's Gambit", "/openings/queens-gambit"],
    ["Sicilian Defence", "/openings/sicilian-defence"],
  ],
};

const stylePageFaqs = [
  [
    "Should I choose openings by style or rating?",
    "Use both, but do not stop there. Your best opening depends on your actual games, not just your rating.",
  ],
  [
    "Can OpeningFit confirm whether a style suits me?",
    "Yes. OpeningFit reviews your recent public games and shows which openings are already producing positions you handle well.",
  ],
  ...sharedFaqs,
];

export const SEO_PAGES = {
  "/best-chess-openings-for-aggressive-players": {
    title: "Best Chess Openings for Aggressive Players | OpeningFit",
    description:
      "Find aggressive chess openings such as the Sicilian Defence, King's Indian Defence, and Dutch Defence, then analyse your games to see what fits.",
    h1: "Best chess openings for aggressive players",
    eyebrow: "Aggressive openings",
    intro:
      "Aggressive players usually want imbalance, initiative, and real winning chances. The right opening should give you active plans without asking you to gamble every game.",
    problemTitle: "Aggression works best when it matches your real decisions.",
    problem:
      "A sharp opening can look exciting in a guide, but your own games may show that you attack well from some structures and overpress in others.",
    solutionTitle: "OpeningFit checks the evidence in your games.",
    solution:
      "Analyse your games to see whether aggressive openings are giving you useful counterplay, or whether one line is creating avoidable trouble.",
    recommendationsTitle: "Recommended openings for aggressive players",
    recommendations: [
      {
        name: "Sicilian Defence",
        href: "/openings/sicilian-defence",
        why: "Creates asymmetrical positions against 1.e4 and gives Black active counterplay instead of early symmetry.",
      },
      {
        name: "King's Indian Defence",
        href: "/openings/kings-indian-defence",
        why: "Suits players who enjoy counterattacking chances, kingside plans, and dynamic tension against 1.d4.",
      },
      {
        name: "Dutch Defence",
        href: "/openings/dutch-defence",
        why: "Gives Black an assertive kingside structure and immediate imbalance against quieter 1.d4 players.",
      },
    ],
    mistakes: [
      "Choosing only sharp openings and then neglecting development or king safety.",
      "Switching between many aggressive systems before learning one set of plans.",
      "Assuming every attacking opening fits you without checking your own results.",
    ],
    openingLinks: styleOpeningPages.aggressive,
    faq: stylePageFaqs,
  },
  "/best-chess-openings-for-positional-players": {
    title: "Best Chess Openings for Positional Players | OpeningFit",
    description:
      "Explore positional chess openings including the Queen's Gambit, Ruy Lopez, and Nimzo-Indian Defence, with OpeningFit game analysis.",
    h1: "Best chess openings for positional players",
    eyebrow: "Positional openings",
    intro:
      "Positional players often want stable structures, long-term pressure, and decisions that reward planning. Good openings for this style should create small advantages you understand how to improve.",
    problemTitle: "A positional opening still needs practical pressure.",
    problem:
      "Quiet openings can become harmless if you only develop pieces without creating targets, tension, or useful pawn breaks.",
    solutionTitle: "OpeningFit shows whether the structure suits you.",
    solution:
      "Your best opening depends on your actual games, not just your rating. OpeningFit can show whether your positional choices are producing repeatable, comfortable middlegames.",
    recommendationsTitle: "Recommended openings for positional players",
    recommendations: [
      {
        name: "Queen's Gambit",
        href: "/openings/queens-gambit",
        why: "Builds central pressure and teaches useful themes around tension, structure, and patient improvement.",
      },
      {
        name: "Ruy Lopez",
        href: "/openings/ruy-lopez",
        why: "Creates rich manoeuvring positions where small improvements and long-term plans matter.",
      },
      {
        name: "Nimzo-Indian Defence",
        href: "/openings/nimzo-indian-defence",
        why: "Lets Black create structural questions early while staying flexible against White's centre.",
      },
    ],
    mistakes: [
      "Choosing a quiet setup and then playing without a plan for pressure.",
      "Trading pieces automatically before understanding which structure favours you.",
      "Ignoring your game history when deciding whether positional openings actually suit your habits.",
    ],
    openingLinks: styleOpeningPages.positional,
    faq: stylePageFaqs,
  },
  "/best-chess-openings-for-beginners": {
    title: "Best Chess Openings for Beginners | OpeningFit",
    description:
      "Discover beginner-friendly chess openings such as the London System, Italian Game, and Caro-Kann Defence, then analyse your own games.",
    h1: "Best chess openings for beginners",
    eyebrow: "Beginner-friendly openings",
    intro:
      "Beginner-friendly openings should help you develop pieces, protect your king, and reach positions with clear plans. The aim is not engine-perfect theory; it is getting playable middlegames you understand.",
    problemTitle: "Beginners are often given too much theory too soon.",
    problem:
      "Memorising long lines can hide the real issue: whether the opening leads to positions you can play confidently after move ten.",
    solutionTitle: "OpeningFit keeps the choice personal and practical.",
    solution:
      "Your best opening depends on your actual games, not just your rating. OpeningFit can reveal which simple openings are already working and which ones need a clearer plan.",
    recommendationsTitle: "Recommended openings for beginners",
    recommendations: [
      {
        name: "London System",
        href: "/openings/london-system",
        why: "Offers a repeatable White setup with clear development and lower memorisation pressure.",
      },
      {
        name: "Italian Game",
        href: "/openings/italian-game",
        why: "Teaches fast development, central control, castling, and natural attacking patterns.",
      },
      {
        name: "Caro-Kann Defence",
        href: "/openings/caro-kann",
        why: "Gives Black a solid answer to 1.e4 with clear structure and practical defensive plans.",
      },
    ],
    mistakes: [
      "Learning too many openings before one basic repertoire is stable.",
      "Copying traps instead of understanding development and king safety.",
      "Assuming the easiest opening is best without checking how your own games go.",
    ],
    openingLinks: styleOpeningPages.beginner,
    faq: stylePageFaqs,
  },
  "/best-chess-openings-for-tactical-players": {
    title: "Best Chess Openings for Tactical Players | OpeningFit",
    description:
      "Find tactical chess openings like the Scotch Game, Vienna Game, and Sicilian Defence, then use OpeningFit to test your practical fit.",
    h1: "Best chess openings for tactical players",
    eyebrow: "Tactical openings",
    intro:
      "Tactical players often want open lines, forcing decisions, and chances to calculate. The best tactical opening still needs a sound base so your tactics come from activity, not desperation.",
    problemTitle: "Tactical openings can punish both sides.",
    problem:
      "Open positions reward calculation, but they also expose loose pieces, unsafe kings, and rushed attacks.",
    solutionTitle: "OpeningFit checks whether tactics are helping your results.",
    solution:
      "Your best opening depends on your actual games, not just your rating. OpeningFit can show whether tactical openings are creating chances you convert or chaos you cannot control.",
    recommendationsTitle: "Recommended openings for tactical players",
    recommendations: [
      {
        name: "Scotch Game",
        href: "/openings/scotch-game",
        why: "Opens the centre early and creates direct piece activity for White.",
      },
      {
        name: "Vienna Game",
        href: "/openings/vienna-game",
        why: "Gives White flexible attacking choices and practical surprise value against 1...e5.",
      },
      {
        name: "Sicilian Defence",
        href: "/openings/sicilian-defence",
        why: "Creates unbalanced positions where calculation, timing, and initiative matter.",
      },
    ],
    mistakes: [
      "Forcing tactics before development is complete.",
      "Choosing gambit-style positions without reviewing the recurring defensive resources.",
      "Ignoring whether your tactical openings actually score well in your own games.",
    ],
    openingLinks: styleOpeningPages.tactical,
    faq: stylePageFaqs,
  },
  "/what-chess-opening-should-i-play": {
    title: "What Chess Opening Should I Play? | OpeningFit",
    description:
      "Choose a chess opening by playing style, practical plans, and your own game history with OpeningFit's personalised opening analysis.",
    h1: "What chess opening should I play?",
    eyebrow: "Opening fit",
    intro:
      "The honest answer is that your best opening depends on your actual games, not just your rating. A good choice should match your style, your memory load, and the positions you already handle well.",
    problemTitle: "Generic opening advice cannot see your game history.",
    problem:
      "Two players at the same rating can need completely different openings because they win, lose, and make decisions in different kinds of positions.",
    solutionTitle: "OpeningFit turns your games into a personalised shortlist.",
    solution:
      "Analyse your Chess.com or Lichess games to find which openings fit your current strengths, which lines need repair, and which new choices are worth testing.",
    recommendationsTitle: "Good starting points by style",
    recommendations: [
      {
        name: "London System",
        href: "/openings/london-system",
        why: "A practical option if you want a repeatable White setup with clear plans.",
      },
      {
        name: "Caro-Kann Defence",
        href: "/openings/caro-kann",
        why: "A solid Black choice if you prefer structure before counterattack.",
      },
      {
        name: "Queen's Gambit",
        href: "/openings/queens-gambit",
        why: "A strong fit if you like central control and positional pressure.",
      },
      {
        name: "Sicilian Defence",
        href: "/openings/sicilian-defence",
        why: "A better fit if you enjoy imbalance, calculation, and active counterplay.",
      },
    ],
    mistakes: [
      "Choosing an opening only because a stronger player recommends it.",
      "Changing your repertoire after one bad game instead of checking repeat patterns.",
      "Ignoring whether the opening fits your real results, time control, and decision-making style.",
    ],
    openingLinks: styleOpeningPages.chooser,
    faq: stylePageFaqs,
  },
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
  const baseGraph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: ORGANIZATION_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icons/openingfit-icon.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: ORGANIZATION_NAME,
      url: `${SITE_URL}/`,
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?username={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapplication`,
      name: ORGANIZATION_NAME,
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
      url: `${SITE_URL}/`,
      description: HOME_SEO.description,
      image: DEFAULT_SHARE_IMAGE,
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "GBP",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: ORGANIZATION_NAME,
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
      url: `${SITE_URL}/`,
      description: HOME_SEO.description,
      image: DEFAULT_SHARE_IMAGE,
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "GBP",
      },
    },
  ];

  if (!page?.path || page.path === "/") {
    return {
      "@context": "https://schema.org",
      "@graph": baseGraph,
    };
  }

  const graph = [
    ...baseGraph,
    {
      "@type": "WebPage",
      "@id": `${page.url}#webpage`,
      name: page.title,
      url: page.url,
      description: page.description,
      isPartOf: {
        "@id": `${SITE_URL}/#website`,
      },
      about: {
        "@id": `${SITE_URL}/#software`,
      },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${page.url}#breadcrumb`,
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
          name: page.path?.startsWith("/guides") ? "Chess Opening Guides" : page.h1 || page.title,
          item: page.path?.startsWith("/guides") ? `${SITE_URL}/guides` : page.url,
        },
        ...(page.path?.startsWith("/guides/") ? [
          {
            "@type": "ListItem",
            position: 3,
            name: page.h1 || page.title,
            item: page.url,
          },
        ] : []),
      ],
    },
  ];

  if (page.path?.startsWith("/guides/")) {
    graph.push({
      "@type": "Article",
      "@id": `${page.url}#article`,
      headline: page.h1 || page.title,
      name: page.title,
      url: page.url,
      description: page.description,
      mainEntityOfPage: page.url,
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
    });
  }

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

function StyleRecommendations({ page }) {
  if (!Array.isArray(page.recommendations) || !page.recommendations.length) return null;

  return (
    <section className="seoStyleSection" aria-label="Recommended chess openings">
      <div className="seoSectionHeading">
        <p className="seoEyebrow">Recommendations</p>
        <h2>{page.recommendationsTitle || "Recommended openings"}</h2>
        <p>Use your games, not just your rating.</p>
      </div>

      <div className="seoStyleCardGrid">
        {page.recommendations.map((opening) => (
          <article className="seoStyleCard" key={opening.name}>
            <span>Fit note</span>
            <h3>{opening.name}</h3>
            <p>{opening.why}</p>
            <a href={opening.href}>Read the {opening.name} guide</a>
          </article>
        ))}
      </div>
    </section>
  );
}

function StyleMistakes({ page }) {
  if (!Array.isArray(page.mistakes) || !page.mistakes.length) return null;

  return (
    <section className="seoProblemSolution seoStyleMistakes" aria-label="Mistakes to avoid">
      <article>
        <span>Mistakes to avoid</span>
        <h2>Do not choose by label alone</h2>
        <ul className="seoStyleList">
          {page.mistakes.map((mistake) => (
            <li key={mistake}>{mistake}</li>
          ))}
        </ul>
      </article>
      <article>
        <span>OpeningFit check</span>
        <h2>Analyse the positions you actually reach</h2>
        <p>
          OpeningFit connects opening choice back to your own results, so a style recommendation becomes a practical repertoire decision instead of a guess.
        </p>
      </article>
    </section>
  );
}

function StyleOpeningLinks({ page }) {
  if (!Array.isArray(page.openingLinks) || !page.openingLinks.length) return null;

  return (
    <section className="seoInternalLinks seoOpeningGuideLinks" aria-label="Relevant opening guides">
      <div>
        <p className="seoEyebrow">Opening guides</p>
        <h2>Compare the recommended openings</h2>
      </div>
      <nav>
        {page.openingLinks.map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
    </section>
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

          <StyleRecommendations page={page} />

          <StyleMistakes page={page} />

          <StyleOpeningLinks page={page} />

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
            <p>Import your games and turn your opening history into a cleaner, personalised repertoire plan.</p>
            <a className="seoPrimaryCta" href="/#app-dashboard">Go to the import flow</a>
          </section>
        </main>
      </div>
      {Analytics ? <Analytics /> : null}
    </>
  );
}
