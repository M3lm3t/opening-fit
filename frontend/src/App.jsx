import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import "./App.css";
import GameReplayBoard from "./components/GameReplayBoard";
import OpeningPracticeBoard from "./components/OpeningPracticeBoard";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

const STORAGE_KEY = "openingFit:lastAnalysis";
const USERNAME_KEY = "openingFit:lastUsername";
const PREMIUM_KEY = "openingFit:isPremiumDemo";

const closedSections = {
  style: false,
  recommendations: false,
  verdicts: false,
  chart: false,
  training: false,
  replay: false,
  preferred: false,
  top: false,
};

const premiumFeatures = [
  "12 months of game history",
  "Full opening table",
  "Keep / Improve / Avoid verdicts",
  "Advanced personal training plan",
  "Saved import history",
  "Future Stockfish analysis",
];

function getMovesFromPgn(pgnText) {
  if (!pgnText) return [];

  try {
    const chess = new Chess();
    chess.loadPgn(pgnText);
    return chess.history();
  } catch {
    return [];
  }
}

function safeDate(value) {
  if (!value) return "Today";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Today";
  }
}

function Section({ title, isOpen, onToggle, children, badge = null }) {
  return (
    <section className="card collapsibleCard">
      <button className="sectionToggle" onClick={onToggle} type="button">
        <div className="sectionToggleLeft">
          <span className="sectionArrow">{isOpen ? "▾" : "▸"}</span>
          <h2>{title}</h2>
        </div>

        {badge ? <span className="sectionBadge">{badge}</span> : null}
      </button>

      {isOpen && <div className="sectionBody">{children}</div>}
    </section>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="emptyState">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function LockedPremiumCard({ title, text }) {
  return (
    <div className="premiumLockedInline">
      <div>
        <span className="premiumBadge">Premium</span>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <span className="lockIcon">🔒</span>
    </div>
  );
}

function AboutSection() {
  return (
    <section className="landingContentSection aboutSection" id="about">
      <div className="landingSectionHeading">
        <p className="landingEyebrow">Who it is for</p>
        <h2>Built for beginner and club players.</h2>
        <p>
          Opening Fit is designed for players who want practical opening advice
          without memorising huge theory files. It looks at what you already
          play, finds patterns in your results, and helps you build a simple
          repertoire that fits your style.
        </p>
      </div>

      <div className="aboutGrid">
        <article className="aboutCard">
          <h3>Not an engine report</h3>
          <p>
            The goal is not to overwhelm you with computer lines. The goal is to
            help you understand which openings feel natural and which ones need
            attention.
          </p>
        </article>

        <article className="aboutCard">
          <h3>Made for practical training</h3>
          <p>
            Use the report to decide what to keep, what to repair, and what to
            practise next on the board.
          </p>
        </article>

        <article className="aboutCard">
          <h3>Simple repertoire building</h3>
          <p>
            Start with a few openings you trust, learn the first moves, then add
            plans over time instead of chasing every sideline.
          </p>
        </article>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="siteFooter">
      <div>
        <div className="landingBrand footerBrand">
          <div className="landingBrandIcon">♞</div>
          <div>
            <p className="landingBrandTitle">Opening Fit</p>
            <p className="landingBrandSubtitle">
              Practical chess opening advice for club players
            </p>
          </div>
        </div>

        <p className="footerDisclaimer">
          Opening popularity and rating-range suggestions are general guides.
          They can vary by platform, time control, region, and current chess
          trends. Opening Fit is for training guidance, not guaranteed results.
        </p>
      </div>

      <div className="footerLinks">
        <a href="#app-dashboard">Launch app</a>
        <a href="#rating-openings">Rating ranges</a>
        <a href="#premium">Premium</a>
      </div>
    </footer>
  );
}

function RatingOpeningGuide({ onOpeningClick }) {
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);

  const ratingRanges = [
    {
      range: "Under 800",
      label: "Beginner",
      description:
        "Players often use simple development openings, early queen moves, and direct attacks.",
      white: ["Italian Game", "Four Knights Game", "Queen's Pawn Opening"],
      black: ["Scandinavian Defence", "French Defence", "King's Pawn Game"],
    },
    {
      range: "800–1200",
      label: "Improving player",
      description:
        "Openings become more recognisable, but simple plans still perform best.",
      white: ["London System", "Italian Game", "Vienna Game"],
      black: ["Caro-Kann Defence", "Scandinavian Defence", "Sicilian Defence"],
    },
    {
      range: "1200–1600",
      label: "Club player",
      description:
        "Players start choosing openings based on style and familiar middlegame plans.",
      white: ["Vienna Game", "Queen's Gambit", "Ruy Lopez"],
      black: ["Caro-Kann Defence", "Sicilian Defence", "King's Indian Defence"],
    },
    {
      range: "1600–2000",
      label: "Strong club player",
      description:
        "Opening choices become more structured, with more preparation and fewer random sidelines.",
      white: ["Ruy Lopez", "Queen's Gambit", "English Opening"],
      black: ["Sicilian Defence", "Nimzo-Indian Defence", "Caro-Kann Defence"],
    },
    {
      range: "2000+",
      label: "Advanced",
      description:
        "Players usually have prepared repertoires and choose openings to create specific structures.",
      white: ["Ruy Lopez", "Catalan Opening", "Queen's Gambit"],
      black: ["Sicilian Najdorf", "Nimzo-Indian Defence", "Grünfeld Defence"],
    },
  ];

  return (
    <section
      className={`ratingGuideSection ${
        mobileGuideOpen ? "ratingGuideOpen" : "ratingGuideClosed"
      }`}
      id="rating-openings"
    >
      <div className="landingSectionHeading ratingGuideHeading">
        <p className="landingEyebrow">Opening trends</p>
        <h2>Popular openings by rating range.</h2>
        <p>
          A quick guide to the openings players commonly choose at different
          levels. Click any opening to practise a supported main line.
        </p>

        <button
          className="mobileSectionRevealBtn"
          type="button"
          onClick={() => setMobileGuideOpen((prev) => !prev)}
        >
          {mobileGuideOpen ? "Hide rating guide" : "Show rating guide"}
        </button>
      </div>

      <div className="ratingGuideBody">
        <div className="ratingGuideGrid">
          {ratingRanges.map((item) => (
            <article className="ratingGuideCard" key={item.range}>
              <div className="ratingGuideTop">
                <h3>{item.range}</h3>
                <p>{item.label}</p>
              </div>

              <p className="ratingGuideDescription">{item.description}</p>

              <div className="ratingOpeningColumns">
                <div>
                  <h4>Common as White</h4>
                  <div className="ratingOpeningList">
                    {item.white.map((opening) => (
                      <button
                        key={opening}
                        type="button"
                        className="ratingOpeningBtn"
                        onClick={() => onOpeningClick(opening)}
                      >
                        {opening}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4>Common as Black</h4>
                  <div className="ratingOpeningList">
                    {item.black.map((opening) => (
                      <button
                        key={opening}
                        type="button"
                        className="ratingOpeningBtn"
                        onClick={() => onOpeningClick(opening)}
                      >
                        {opening}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingSection({ onOpeningClick }) {
  const features = [
    {
      icon: "♟️",
      title: "Import your games",
      text: "Enter your Chess.com username and analyse your recent games.",
    },
    {
      icon: "📊",
      title: "Find your patterns",
      text: "See which openings you play most and where your results are strongest.",
    },
    {
      icon: "🎯",
      title: "Get opening ideas",
      text: "Receive simple repertoire suggestions based on your real games.",
    },
    {
      icon: "🚀",
      title: "Train smarter",
      text: "Get a personal plan based on your strongest openings and weak spots.",
    },
  ];

  const steps = [
    {
      title: "Enter username",
      text: "Add your Chess.com username.",
    },
    {
      title: "Import games",
      text: "Opening Fit reviews your recent games.",
    },
    {
      title: "View your report",
      text: "See your style profile, win rates, and opening trends.",
    },
    {
      title: "Train your repertoire",
      text: "Keep what works, improve weak areas, and practise main lines.",
    },
  ];

  return (
    <div className="landingWrap">
      <header className="landingHero">
        <div className="landingNav">
          <div className="landingBrand">
            <div className="landingBrandIcon">♞</div>
            <div>
              <p className="landingBrandTitle">Opening Fit</p>
              <p className="landingBrandSubtitle">
                Find openings that match your style
              </p>
            </div>
          </div>

          <nav className="landingNavLinks">
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#how-it-works">How it works</a>
            <a href="#rating-openings">Rating ranges</a>
            <a href="#premium">Premium</a>
            <a href="#app-dashboard">Launch app</a>
          </nav>
        </div>

        <div className="landingHeroGrid">
          <div className="landingHeroCopy">
            <div className="landingPill">
              <span>New</span>
              <span className="landingDot">•</span>
              <span>Personalised chess opening recommendations</span>
            </div>

            <h1>Build a chess repertoire that fits how you actually play.</h1>

            <p className="landingSubtext">
              Opening Fit reviews your recent Chess.com games, finds your
              strongest opening patterns, and recommends practical repertoire
              ideas based on your own results.
            </p>

            <div className="landingHeroActions">
              <a className="landingPrimaryBtn" href="#app-dashboard">
                Import games
              </a>
              <a className="landingSecondaryBtn" href="#rating-openings">
                Browse rating ranges
              </a>
            </div>

            <div className="landingStats">
              <div className="landingStatCard">
                <strong>Fast</strong>
                <span>game import</span>
              </div>

              <div className="landingStatCard">
                <strong>Simple</strong>
                <span>opening advice</span>
              </div>

              <div className="landingStatCard">
                <strong>Practice</strong>
                <span>main lines</span>
              </div>
            </div>
          </div>

          <div className="landingPreviewCard" id="sample-report">
            <div className="landingPreviewTop">
              <div>
                <p className="landingMiniLabel">Sample Style Profile</p>
                <h3>Aggressive counterpuncher</h3>
              </div>

              <span className="landingFitBadge">Strong fit</span>
            </div>

            <div className="landingPreviewGrid">
              <div className="landingInfoCard">
                <p className="landingMiniLabel">White repertoire</p>
                <button
                  className="landingOpeningBtn"
                  type="button"
                  onClick={() => onOpeningClick("Vienna Game")}
                >
                  Vienna Game
                </button>
                <p>Active development, attacking chances, and clear plans.</p>
              </div>

              <div className="landingInfoCard">
                <p className="landingMiniLabel">Black repertoire</p>
                <button
                  className="landingOpeningBtn"
                  type="button"
                  onClick={() => onOpeningClick("Scandinavian Defence")}
                >
                  Scandinavian Defence
                </button>
                <p>Direct positions with practical club-level ideas.</p>
              </div>
            </div>

            <div className="landingInfoCard">
              <p className="landingMiniLabel">Opening verdicts</p>
              <h4>Keep / Improve / Avoid</h4>

              <div className="landingVerdictList">
                <div className="landingVerdictRow">
                  <div>
                    <button
                      className="inlineOpeningBtn"
                      type="button"
                      onClick={() => onOpeningClick("Vienna Game")}
                    >
                      Vienna Game
                    </button>
                    <span>Strong recent results</span>
                  </div>
                  <span className="verdict keep">Keep</span>
                </div>

                <div className="landingVerdictRow">
                  <div>
                    <button
                      className="inlineOpeningBtn"
                      type="button"
                      onClick={() => onOpeningClick("Italian Game")}
                    >
                      Italian Game
                    </button>
                    <span>Playable, but needs work</span>
                  </div>
                  <span className="verdict improve">Improve</span>
                </div>

                <div className="landingVerdictRow">
                  <div>
                    <strong>Random sidelines</strong>
                    <span>Low consistency</span>
                  </div>
                  <span className="verdict avoid">Avoid</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="landingContentSection" id="features">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">Why it works</p>
          <h2>Clear opening advice without theory overload.</h2>
          <p>
            Most improving players do not need hundreds of opening lines. They
            need simple choices based on what is already happening in their
            games.
          </p>
        </div>

        <div className="landingFeatureGrid">
          {features.map((feature) => (
            <article className="landingFeatureCard" key={feature.title}>
              <div className="landingFeatureIcon">{feature.icon}</div>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <AboutSection />

      <section className="landingContentSection" id="how-it-works">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">How it works</p>
          <h2>From games to repertoire in four steps.</h2>
        </div>

        <div className="landingStepsList">
          {steps.map((step, index) => (
            <div className="landingStepCard" key={step.title}>
              <div className="landingStepNumber">{index + 1}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <RatingOpeningGuide onOpeningClick={onOpeningClick} />

      <section className="landingContentSection" id="premium">
        <div className="landingSectionHeading">
          <p className="landingEyebrow">Pricing</p>
          <h2>Start free. Upgrade when you want deeper analysis.</h2>
        </div>

        <div className="landingPricingGrid">
          <article className="landingPriceCard">
            <p className="landingMiniLabel">Free</p>
            <h3>Opening snapshot</h3>
            <p>Good for trying the app and seeing your main opening trends.</p>

            <ul>
              <li>Import recent Chess.com games</li>
              <li>View your style profile</li>
              <li>See top openings and win rates</li>
              <li>Basic opening suggestions</li>
              <li>Practise supported opening lines</li>
              <li>Popular openings by rating range</li>
            </ul>
          </article>

          <article className="landingPriceCard landingPriceCardPremium">
            <div className="landingPriceTop">
              <div>
                <p className="landingMiniLabel">Premium</p>
                <h3>Full repertoire builder</h3>
              </div>

              <span className="landingPriceBadge">£8 once-off</span>
            </div>

            <p>
              For players who want clearer verdicts, stronger recommendations,
              and a more useful training plan.
            </p>

            <ul>
              <li>Longer game import history</li>
              <li>Full opening history and trend tracking</li>
              <li>More practice lines and repertoire tools</li>
              <li>Deeper personal training plans</li>
              <li>Save reports and favourite openings</li>
              <li>Future PDF export and progress tracking</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [showUnknownOpenings, setShowUnknownOpenings] = useState(false);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [practiceOpening, setPracticeOpening] = useState(null);
  const [openSections, setOpenSections] = useState(closedSections);
  const [savedProfileMessage, setSavedProfileMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [localSavedAt, setLocalSavedAt] = useState("");
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem(USERNAME_KEY);
    const savedPremium = localStorage.getItem(PREMIUM_KEY);
    const savedAnalysis = localStorage.getItem(STORAGE_KEY);

    if (savedUsername) setUsername(savedUsername);
    if (savedPremium === "true") setIsPremium(true);

    if (savedAnalysis) {
      try {
        const parsed = JSON.parse(savedAnalysis);

        if (parsed?.analysis) {
          setLocalSavedAt(parsed.savedAt || "");
          setSavedProfileMessage(
            `Saved local report found${
              parsed.username ? ` for ${parsed.username}` : ""
            }. Click Load Saved Profile to open it.`
          );
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PREMIUM_KEY, String(isPremium));
  }, [isPremium]);

  async function trackEvent(event, eventData = {}) {
    try {
      await fetch(`${API_BASE}/api/analytics/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event,
          data: eventData,
        }),
      });
    } catch {
      // Analytics should never break the app.
    }
  }

  function getFriendlyError(errorText) {
    if (!errorText) {
      return "Something went wrong. Please try again.";
    }

    const lower = String(errorText).toLowerCase();

    if (lower.includes("no saved profile")) {
      return "No saved backend profile found yet. I will still check your local browser save if one exists.";
    }

    if (lower.includes("demo profile could not be loaded")) {
      return "Demo could not be loaded. Your live backend may not be deployed or your frontend may not be pointing to the backend URL.";
    }

    if (lower.includes("not found") || lower.includes("could not find")) {
      return "Could not find that Chess.com username. Check the spelling and try again.";
    }

    if (lower.includes("no games")) {
      return "This profile exists, but no recent public games were found.";
    }

    if (lower.includes("rate limiting") || lower.includes("429")) {
      return "Chess.com is temporarily limiting requests. Try again in a minute.";
    }

    if (
      lower.includes("failed to fetch") ||
      lower.includes("connection refused") ||
      lower.includes("could not connect")
    ) {
      return "Could not connect to the backend. Make sure FastAPI is running.";
    }

    try {
      const parsed = JSON.parse(errorText);
      return parsed.detail || parsed.message || errorText;
    } catch {
      return errorText;
    }
  }

  const normaliseData = (incoming) => {
    if (!incoming) return incoming;

    return {
      ...incoming,
      total_games:
        incoming.total_games ?? incoming.totalGames ?? incoming.gamesImported ?? 0,
      months_checked: incoming.months_checked ?? incoming.monthsChecked ?? 0,
      top_openings: incoming.top_openings ?? incoming.topOpenings ?? [],
      best_openings: incoming.best_openings ?? incoming.bestOpenings ?? [],
      preferred_white: incoming.preferred_white ?? incoming.preferredWhite ?? [],
      preferred_black: incoming.preferred_black ?? incoming.preferredBlack ?? [],
      recent_games: incoming.recent_games ?? incoming.recentGames ?? [],
      style_profile: incoming.style_profile ?? incoming.styleProfile ?? {},
      opening_recommendations:
        incoming.opening_recommendations ??
        incoming.openingRecommendations ??
        incoming.recommendedOpenings ??
        {},
      training_plan: incoming.training_plan ?? incoming.trainingPlan ?? [],
      premium_preview: incoming.premium_preview ?? incoming.premiumPreview ?? {},
      recommendations: incoming.recommendations ?? [],
      lockedFeatures: incoming.lockedFeatures ?? [],
      lastUpdated:
        incoming.lastUpdated ??
        incoming.last_updated ??
        incoming.savedProfile?.lastUpdated ??
        new Date().toISOString(),
    };
  };

  const saveLocalAnalysis = (analysis, cleanUsername) => {
    const savedAt = new Date().toISOString();

    const payload = {
      username: cleanUsername,
      savedAt,
      analysis: {
        ...analysis,
        lastUpdated: analysis.lastUpdated || savedAt,
      },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(USERNAME_KEY, cleanUsername);
    setLocalSavedAt(savedAt);
  };

  const loadLocalAnalysis = () => {
    const savedAnalysis = localStorage.getItem(STORAGE_KEY);

    if (!savedAnalysis) {
      return false;
    }

    try {
      const parsed = JSON.parse(savedAnalysis);

      if (!parsed?.analysis) {
        return false;
      }

      const cleanData = normaliseData(parsed.analysis);

      setData(cleanData);
      setUsername(parsed.username || cleanData.username || "");
      setSelectedGameIndex(0);
      setPracticeOpening(null);
      setOpenSections(closedSections);
      setLocalSavedAt(parsed.savedAt || "");

      setSavedProfileMessage(
        `Loaded local saved report${
          parsed.username ? ` for ${parsed.username}` : ""
        }. Saved: ${safeDate(parsed.savedAt)}`
      );

      scrollToResults();
      return true;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
  };

  const clearLocalAnalysis = () => {
    localStorage.removeItem(STORAGE_KEY);
    setLocalSavedAt("");
    setSavedProfileMessage("Local saved report cleared.");
  };

  const scrollToResults = () => {
    setTimeout(() => {
      const el = document.getElementById("app-results");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const toggleSection = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const openOnly = (key) => {
    setOpenSections({
      ...closedSections,
      [key]: true,
    });

    setTimeout(() => {
      const el = document.getElementById(`section-${key}`);

      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);
  };

  const startOpeningPractice = (openingName) => {
    if (!openingName) return;

    setPracticeOpening(openingName);

    setTimeout(() => {
      const el = document.getElementById("opening-practice");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const isUnknownOpening = (name) => {
    const normalized = (name || "").toLowerCase().trim();

    return (
      normalized === "" ||
      normalized === "unknown" ||
      normalized === "unknown opening" ||
      normalized === "uncommon opening" ||
      normalized.includes("unknown")
    );
  };

  const filterUnknownOpenings = (items) => {
    if (!Array.isArray(items)) return [];
    if (showUnknownOpenings) return items;

    return items.filter((item) => {
      const name =
        typeof item === "string" ? item : item?.name || item?.opening || "";

      return !isUnknownOpening(name);
    });
  };

  const monthsToImport = isPremium ? 12 : 3;

  const importGames = async () => {
    setLoading(true);
    setLoadingStep("Finding your recent Chess.com games...");
    setError("");
    setSavedProfileMessage("");
    setFeedbackStatus("");
    setData(null);
    setSelectedGameIndex(0);
    setPracticeOpening(null);
    setOpenSections(closedSections);

    const cleanUsername = username.trim();

    try {
      if (!cleanUsername) {
        throw new Error("Please enter a Chess.com username.");
      }

      localStorage.setItem(USERNAME_KEY, cleanUsername);

      await trackEvent("frontend_import_started", {
        username: cleanUsername,
        months: monthsToImport,
        premiumDemo: isPremium,
      });

      setLoadingStep(
        isPremium
          ? "Fetching up to 12 months of Chess.com games..."
          : "Fetching your recent Chess.com games..."
      );

      const res = await fetch(
        `${API_BASE}/api/import/chesscom/${encodeURIComponent(
          cleanUsername
        )}?months=${monthsToImport}`
      );

      const text = await res.text();
      let json = null;

      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok || !json) {
        throw new Error(
          json?.detail ||
            text ||
            "We could not import those games right now. Please check the username and try again."
        );
      }

      setLoadingStep("Detecting your opening patterns...");
      await new Promise((resolve) => setTimeout(resolve, 250));

      setLoadingStep("Building your style profile and recommendations...");
      await new Promise((resolve) => setTimeout(resolve, 250));

      const cleanData = normaliseData(json);
      setData(cleanData);
      saveLocalAnalysis(cleanData, cleanUsername);

      setSavedProfileMessage(
        `Import complete for ${cleanData.username || cleanUsername}. Saved locally so you can load it next time.`
      );

      await trackEvent("frontend_import_completed", {
        username: cleanUsername,
        gamesImported: cleanData.gamesImported ?? cleanData.total_games,
        months: monthsToImport,
      });

      scrollToResults();
    } catch (err) {
      setError(getFriendlyError(err.message));
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const loadSavedProfile = async () => {
    const cleanUsername = username.trim();

    setError("");
    setSavedProfileMessage("");
    setFeedbackStatus("");

    if (!cleanUsername) {
      const loadedLocal = loadLocalAnalysis();

      if (!loadedLocal) {
        setError("Enter a Chess.com username first, or import games once.");
      }

      return;
    }

    if (cleanUsername.toLowerCase() === "demoplayer") {
      setError("");
      setSavedProfileMessage(
        "DemoPlayer is a demo account, not a saved profile. Use Try Demo Account instead."
      );
      return;
    }

    setLoading(true);
    setLoadingStep("Looking for your saved Opening Fit profile...");

    try {
      const response = await fetch(
        `${API_BASE}/api/profile/${encodeURIComponent(cleanUsername)}`
      );

      const text = await response.text();
      let profile = null;

      try {
        profile = JSON.parse(text);
      } catch {
        profile = null;
      }

      if (!response.ok || !profile) {
        const loadedLocal = loadLocalAnalysis();

        if (loadedLocal) {
          return;
        }

        throw new Error(
          profile?.detail ||
            "No saved profile found yet. Import this Chess.com username first, then you can load it next time."
        );
      }

      const latestResult = normaliseData(profile.latestResult);

      if (!latestResult) {
        const loadedLocal = loadLocalAnalysis();

        if (loadedLocal) {
          return;
        }

        throw new Error(
          "Saved profile found, but it did not contain any saved analysis. Import games again to refresh it."
        );
      }

      setData(latestResult);
      saveLocalAnalysis(latestResult, profile.username || cleanUsername);
      setOpenSections(closedSections);
      setSelectedGameIndex(0);
      setPracticeOpening(null);

      setSavedProfileMessage(
        `Loaded saved backend profile for ${profile.username}. Last updated: ${safeDate(
          profile.lastUpdated
        )}`
      );

      await trackEvent("frontend_saved_profile_loaded", {
        username: cleanUsername,
      });

      scrollToResults();
    } catch (err) {
      setError(getFriendlyError(err.message));
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const loadDemoAccount = async () => {
    setError("");
    setSavedProfileMessage("");
    setFeedbackStatus("");
    setLoading(true);
    setLoadingStep("Loading demo profile so you can preview Opening Fit...");

    try {
      const response = await fetch(`${API_BASE}/api/demo`);
      const text = await response.text();

      let demoData = null;

      try {
        demoData = JSON.parse(text);
      } catch {
        demoData = null;
      }

      if (!response.ok || !demoData) {
        throw new Error(
          text ||
            "Demo profile could not be loaded. The live backend may not have the /api/demo route deployed yet."
        );
      }

      const cleanDemoData = normaliseData(demoData);

      setData(cleanDemoData);
      setUsername("DemoPlayer");
      setSelectedGameIndex(0);
      setPracticeOpening(null);
      setOpenSections(closedSections);
      setSavedProfileMessage(
        "Demo profile loaded. This is sample data, so use Import Chess.com Games for your real saved profile."
      );

      await trackEvent("frontend_demo_loaded", {
        username: "DemoPlayer",
      });

      scrollToResults();
    } catch (err) {
      setError(getFriendlyError(err.message));
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const submitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      setFeedbackStatus("Please type a message first.");
      return;
    }

    setFeedbackStatus("Sending feedback...");

    try {
      const response = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: feedbackMessage.trim(),
          contact: feedbackContact.trim() || null,
          username: username.trim() || null,
        }),
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(text);
      }

      setFeedbackMessage("");
      setFeedbackContact("");
      setFeedbackStatus("Thanks — feedback saved.");
    } catch (err) {
      setFeedbackStatus(getFriendlyError(err.message));
    }
  };

  const verdictClass = (verdict) => {
    if (verdict === "Keep") return "verdict keep";
    if (verdict === "Improve") return "verdict improve";
    if (verdict === "Avoid") return "verdict avoid";
    return "verdict test";
  };

  const filteredTopOpenings = useMemo(() => {
    return filterUnknownOpenings(data?.top_openings || []);
  }, [data, showUnknownOpenings]);

  const filteredBestOpenings = useMemo(() => {
    return filterUnknownOpenings(data?.best_openings || []);
  }, [data, showUnknownOpenings]);

  const filteredPreferredWhite = useMemo(() => {
    return filterUnknownOpenings(data?.preferred_white || []);
  }, [data, showUnknownOpenings]);

  const filteredPreferredBlack = useMemo(() => {
    return filterUnknownOpenings(data?.preferred_black || []);
  }, [data, showUnknownOpenings]);

  const filteredRecentGames = useMemo(() => {
    return filterUnknownOpenings(data?.recent_games || []);
  }, [data, showUnknownOpenings]);

  const chartData = useMemo(() => {
    return filteredTopOpenings.slice(0, isPremium ? 10 : 6);
  }, [filteredTopOpenings, isPremium]);

  const whiteDetailedRecommendations = useMemo(() => {
    return filterUnknownOpenings(
      data?.opening_recommendations?.whiteDetailed ||
        data?.recommendedOpenings?.whiteDetailed ||
        []
    );
  }, [data, showUnknownOpenings]);

  const blackDetailedRecommendations = useMemo(() => {
    return filterUnknownOpenings(
      data?.opening_recommendations?.blackDetailed ||
        data?.recommendedOpenings?.blackDetailed ||
        []
    );
  }, [data, showUnknownOpenings]);

  const smartRecommendationSummary = useMemo(() => {
    const summary = [];

    const top = filteredTopOpenings[0];
    const best = [...filteredBestOpenings].sort(
      (a, b) => (b.win_rate ?? b.winRate ?? 0) - (a.win_rate ?? a.winRate ?? 0)
    )[0];
    const weak = [...filteredBestOpenings]
      .filter((item) => (item.games || 0) >= 3)
      .sort(
        (a, b) => (a.win_rate ?? a.winRate ?? 0) - (b.win_rate ?? b.winRate ?? 0)
      )[0];

    if (top) {
      summary.push(
        `Your most common opening is ${top.name}. Because it appears often, improving this opening should give you the biggest overall return.`
      );
    }

    if (best) {
      summary.push(
        `${best.name} looks like one of your best fits. You score ${
          best.win_rate ?? best.winRate ?? 0
        }% from ${best.games} games, so this is worth keeping in your repertoire.`
      );
    }

    if (weak && weak.name !== best?.name) {
      summary.push(
        `${weak.name} may need attention. Your current score is ${
          weak.win_rate ?? weak.winRate ?? 0
        }% from ${weak.games} games, so review the first few moves and common plans.`
      );
    }

    if (summary.length === 0) {
      summary.push(
        "Import more games to unlock a stronger personalised recommendation summary."
      );
    }

    return summary;
  }, [filteredTopOpenings, filteredBestOpenings]);

  const personalTrainingPlan = useMemo(() => {
    const plan = [];

    const best = [...filteredBestOpenings]
      .filter((item) => (item.games || 0) >= 3)
      .sort(
        (a, b) =>
          (b.win_rate || b.winRate || 0) - (a.win_rate || a.winRate || 0)
      );

    const weakest = [...filteredBestOpenings]
      .filter((item) => (item.games || 0) >= 3)
      .sort(
        (a, b) =>
          (a.win_rate || a.winRate || 0) - (b.win_rate || b.winRate || 0)
      );

    const mostPlayed = [...filteredTopOpenings]
      .filter((item) => (item.games || 0) >= 3)
      .sort((a, b) => (b.games || 0) - (a.games || 0));

    const bestOpening = best[0];
    const weakOpening = weakest[0];
    const mainOpening = mostPlayed[0];
    const whitePick = filteredPreferredWhite?.[0];
    const blackPick = filteredPreferredBlack?.[0];

    if (mainOpening) {
      plan.push({
        title: `Make ${mainOpening.name} your main focus`,
        text: `You have played this ${mainOpening.games} times, so small improvements here will affect a lot of your games. Review the first 6 moves and the main middlegame plan.`,
        action: `Practise ${mainOpening.name}`,
        opening: mainOpening.name,
      });
    }

    if (bestOpening) {
      const rate = bestOpening.win_rate ?? bestOpening.winRate ?? 0;

      plan.push({
        title: `Keep using ${bestOpening.name}`,
        text: `This is one of your strongest openings with a ${rate}% win rate from ${bestOpening.games} games. Keep it in your repertoire and learn one extra idea rather than replacing it.`,
        action: `Reinforce ${bestOpening.name}`,
        opening: bestOpening.name,
      });
    }

    if (weakOpening && weakOpening.name !== bestOpening?.name) {
      const rate = weakOpening.win_rate ?? weakOpening.winRate ?? 0;

      plan.push({
        title: `Repair your ${weakOpening.name}`,
        text: `This opening is currently scoring ${rate}% from ${weakOpening.games} games. Do not drop it immediately — first check whether you are losing in the opening or later in the middlegame.`,
        action: `Practise ${weakOpening.name}`,
        opening: weakOpening.name,
      });
    }

    if (whitePick) {
      plan.push({
        title: `Build your White repertoire around ${whitePick.name}`,
        text: `This appears often in your White games. Learn the first 6 moves, then one simple plan for what to do after development.`,
        action: "Practise as White",
        opening: whitePick.name,
      });
    }

    if (blackPick) {
      plan.push({
        title: `Tighten your Black repertoire with ${blackPick.name}`,
        text: `This is one of your regular Black openings. Focus on reaching a familiar setup instead of memorising too many sidelines.`,
        action: "Practise as Black",
        opening: blackPick.name,
      });
    }

    if (Array.isArray(data?.training_plan) && data.training_plan.length) {
      data.training_plan.forEach((step, index) => {
        if (typeof step === "string") {
          plan.push({
            title: `Backend suggestion ${index + 1}`,
            text: step,
            action: null,
            opening: null,
          });
        }
      });
    }

    if (plan.length === 0) {
      return [
        {
          title: "Import more games to unlock a personal plan",
          text: "Once Opening Fit has enough games, it will identify your strongest openings, weak spots, and training priorities.",
          action: null,
          opening: null,
        },
      ];
    }

    const uniquePlan = [];
    const seenTitles = new Set();

    plan.forEach((item) => {
      if (!seenTitles.has(item.title)) {
        seenTitles.add(item.title);
        uniquePlan.push(item);
      }
    });

    return uniquePlan.slice(0, isPremium ? 8 : 4);
  }, [
    data,
    filteredBestOpenings,
    filteredTopOpenings,
    filteredPreferredWhite,
    filteredPreferredBlack,
    isPremium,
  ]);

  const selectedGame = filteredRecentGames?.[selectedGameIndex] || null;

  const selectedReplayGame = useMemo(() => {
    if (!selectedGame) return null;

    const parsedMoves =
      Array.isArray(selectedGame.moves) && selectedGame.moves.length
        ? selectedGame.moves
        : getMovesFromPgn(selectedGame.pgn);

    return {
      id: selectedGame.url || selectedGame.pgn || `${selectedGameIndex}`,
      white:
        selectedGame.white_username ||
        selectedGame.whiteUsername ||
        selectedGame.white ||
        "White",
      black:
        selectedGame.black_username ||
        selectedGame.blackUsername ||
        selectedGame.black ||
        "Black",
      result: selectedGame.result || "",
      moves: parsedMoves,
    };
  }, [selectedGame, selectedGameIndex]);

  useEffect(() => {
    setSelectedGameIndex(0);
  }, [showUnknownOpenings]);

  return (
    <div className="page">
      <LandingSection onOpeningClick={startOpeningPractice} />

      <main className="container appShell" id="app-dashboard">
        <header className="hero heroCard">
          <div className="heroTop">
            <div className="heroTitleWrap">
              <p className="eyebrow">Opening Fit App</p>
              <h1>Analyse your Chess.com openings</h1>
              <p className="subtext">
                Import your recent games and get a clean report showing your
                playing style, best openings, weak spots, and simple repertoire
                suggestions.
              </p>
            </div>
          </div>

          <div className="searchRow topBar appActionPanel">
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Chess.com username"
            />

            <div className="appActionButtons">
              <button
                className="primaryBtn"
                type="button"
                onClick={importGames}
                disabled={loading || !username.trim()}
              >
                {loading
                  ? "Working..."
                  : isPremium
                  ? "Import 12 Months"
                  : "Import Chess.com Games"}
              </button>

              <button
                className="secondaryButton savedProfileButton"
                type="button"
                onClick={loadSavedProfile}
                disabled={loading}
              >
                Load Saved Profile
              </button>

              <button
                className="ghostButton demoAccountButton"
                type="button"
                onClick={loadDemoAccount}
                disabled={loading}
              >
                Try Demo Account
              </button>

              <button
                className="ghostButton"
                type="button"
                onClick={importGames}
                disabled={loading || !username.trim()}
              >
                Refresh Games
              </button>
            </div>
          </div>

          <div className="filtersRow">
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={showUnknownOpenings}
                onChange={(e) => setShowUnknownOpenings(e.target.checked)}
              />
              <span>Show unclassified openings</span>
            </label>

            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={isPremium}
                onChange={(e) => setIsPremium(e.target.checked)}
              />
              <span>Premium demo mode</span>
            </label>
          </div>

          {localSavedAt ? (
            <div className="savedHistoryRow">
              <span>Local saved report: {safeDate(localSavedAt)}</span>
              <button className="ghostButton" type="button" onClick={clearLocalAnalysis}>
                Clear local save
              </button>
            </div>
          ) : null}

          {loadingStep ? <p className="statusMessage">{loadingStep}</p> : null}

          {savedProfileMessage ? (
            <p className="successMessage">{savedProfileMessage}</p>
          ) : null}
        </header>

        {loading && (
          <section className="card loadingCard">
            <div className="loadingSpinner" />
            <div>
              <h3>Preparing your report</h3>
              <p>{loadingStep || "Opening Fit is working..."}</p>
            </div>
          </section>
        )}

        {practiceOpening && (
          <div id="opening-practice">
            <OpeningPracticeBoard
              openingName={practiceOpening}
              onClose={() => setPracticeOpening(null)}
            />
          </div>
        )}

        {error && <div className="errorBox">{error}</div>}

        {!data && !loading && !error && (
          <section className="placeholderGrid grid3">
            <div className="card smallCard">
              <h3>Style profile</h3>
              <p>
                Discover whether your games are tactical, solid, direct, or
                positional.
              </p>
            </div>

            <div className="card smallCard">
              <h3>Opening verdicts</h3>
              <p>See which openings to keep, improve, or avoid.</p>
            </div>

            <div className="card smallCard">
              <h3>Personal plan</h3>
              <p>
                Get training steps based on the openings you actually play.
              </p>
            </div>
          </section>
        )}

        {data && (
          <div id="app-results">
            <section className="statsGrid">
              <div className="card statCard">
                <span className="statLabel">Player</span>
                <span className="statValue">{data.username}</span>
              </div>

              <div className="card statCard">
                <span className="statLabel">Games analysed</span>
                <span className="statValue">{data.total_games}</span>
              </div>

              <div className="card statCard">
                <span className="statLabel">Recent activity</span>
                <span className="statValue">
                  {data.months_checked || monthsToImport} month
                  {(data.months_checked || monthsToImport) === 1 ? "" : "s"}
                </span>
              </div>

              <div className="card statCard">
                <span className="statLabel">Plan</span>
                <span className="statValue smallStatValue">
                  {isPremium ? "Premium demo" : "Free"}
                </span>
              </div>

              <div className="card statCard">
                <span className="statLabel">Last updated</span>
                <span className="statValue smallStatValue">
                  {data.lastUpdated
                    ? new Date(data.lastUpdated).toLocaleDateString()
                    : "Today"}
                </span>
              </div>
            </section>

            <section className="card quickNavCard">
              <h2>Quick View</h2>

              <div className="quickNavGrid">
                <button
                  className="quickNavBtn secondaryBtn"
                  type="button"
                  onClick={() => openOnly("style")}
                >
                  Style Profile
                </button>
                <button
                  className="quickNavBtn secondaryBtn"
                  type="button"
                  onClick={() => openOnly("recommendations")}
                >
                  Opening Suggestions
                </button>
                <button
                  className="quickNavBtn secondaryBtn"
                  type="button"
                  onClick={() => openOnly("verdicts")}
                >
                  Keep / Improve / Avoid
                </button>
                <button
                  className="quickNavBtn secondaryBtn"
                  type="button"
                  onClick={() => openOnly("chart")}
                >
                  Win Rate Chart
                </button>
                <button
                  className="quickNavBtn secondaryBtn"
                  type="button"
                  onClick={() => openOnly("training")}
                >
                  Personal Plan
                </button>
                <button
                  className="quickNavBtn secondaryBtn"
                  type="button"
                  onClick={() => openOnly("replay")}
                >
                  Game Replay
                </button>
              </div>
            </section>

            {!isPremium ? (
              <section className="card premiumCard">
                <div className="premiumHeader">
                  <span className="premiumBadge">Premium Preview</span>
                  <h2>Unlock the full Opening Fit report</h2>
                </div>

                <p>
                  You are viewing the free version. Premium will unlock deeper
                  opening stats, longer imports, advanced training plans and
                  future Stockfish analysis.
                </p>

                <div className="lockedFeatureGrid">
                  {premiumFeatures.map((feature) => (
                    <div className="lockedFeature" key={feature}>
                      🔒 {feature}
                    </div>
                  ))}
                </div>

                <button
                  className="primaryBtn"
                  type="button"
                  onClick={() => setIsPremium(true)}
                >
                  Preview Premium Mode
                </button>
              </section>
            ) : null}

            <div id="section-style">
              <Section
                title="Style Profile"
                isOpen={openSections.style}
                onToggle={() => toggleSection("style")}
                badge={filterUnknownOpenings(
                  data.style_profile?.labels || []
                ).join(" · ")}
              >
                <div className="twoCol">
                  <div>
                    <div className="chips">
                      {filterUnknownOpenings(
                        data.style_profile?.labels || []
                      ).map((label, index) => (
                        <span className="chip" key={index}>
                          {label}
                        </span>
                      ))}
                    </div>

                    <p className="profileSummary">
                      {data.style_profile?.summary ||
                        "Your style profile will appear here once enough games are analysed."}
                    </p>

                    <h3>Top Opening Families</h3>

                    <div className="list">
                      {filterUnknownOpenings(
                        data.style_profile?.top_opening_families || []
                      ).length ? (
                        filterUnknownOpenings(
                          data.style_profile?.top_opening_families || []
                        ).map((item, index) => (
                          <button
                            className="listItem openingPracticeLink"
                            key={index}
                            type="button"
                            onClick={() => startOpeningPractice(item)}
                          >
                            <strong>{item}</strong>
                            <span>Practice</span>
                          </button>
                        ))
                      ) : (
                        <EmptyState
                          title="No opening families yet"
                          text="Import more games to detect your most common opening families."
                        />
                      )}
                    </div>
                  </div>

                  <div className="premiumMiniCard">
                    <p className="premiumLabel">
                      {isPremium ? "Premium Active" : "Premium Preview"}
                    </p>
                    <h3>Best Openings For You</h3>

                    <div className="list">
                      {filterUnknownOpenings(
                        data.premium_preview?.best_opening_for_you || []
                      ).length ? (
                        filterUnknownOpenings(
                          data.premium_preview?.best_opening_for_you || []
                        ).map((item, index) => {
                          const rate = item.win_rate ?? item.winRate ?? 0;

                          return (
                            <button
                              className="listItem openingPracticeLink"
                              key={index}
                              type="button"
                              onClick={() => startOpeningPractice(item.name)}
                            >
                              <div>
                                <strong>{item.name}</strong>
                                <div className="smallText">
                                  {item.games} games
                                </div>
                              </div>

                              <div className="rightStat">
                                <div>{rate}%</div>
                                <div className={verdictClass(item.verdict)}>
                                  {item.verdict}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <EmptyState
                          title="No premium preview yet"
                          text="Once there are enough recognised openings, your best-fit openings will appear here."
                        />
                      )}
                    </div>
                  </div>
                </div>
              </Section>
            </div>

            <div id="section-recommendations">
              <Section
                title="Opening Suggestions"
                isOpen={openSections.recommendations}
                onToggle={() => toggleSection("recommendations")}
              >
                <div className="twoCol">
                  <div>
                    <h3>Recommended as White</h3>
                    <div className="list">
                      {filterUnknownOpenings(
                        data.opening_recommendations?.white || []
                      ).length ? (
                        filterUnknownOpenings(
                          data.opening_recommendations?.white || []
                        ).map((item, index) => (
                          <button
                            className="listItem openingPracticeLink"
                            key={index}
                            type="button"
                            onClick={() => startOpeningPractice(item)}
                          >
                            <strong>{item}</strong>
                            <span>Practice</span>
                          </button>
                        ))
                      ) : (
                        <EmptyState
                          title="No White suggestions yet"
                          text="Import more games to unlock stronger White repertoire suggestions."
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <h3>Recommended as Black</h3>
                    <div className="list">
                      {filterUnknownOpenings(
                        data.opening_recommendations?.black || []
                      ).length ? (
                        filterUnknownOpenings(
                          data.opening_recommendations?.black || []
                        ).map((item, index) => (
                          <button
                            className="listItem openingPracticeLink"
                            key={index}
                            type="button"
                            onClick={() => startOpeningPractice(item)}
                          >
                            <strong>{item}</strong>
                            <span>Practice</span>
                          </button>
                        ))
                      ) : (
                        <EmptyState
                          title="No Black suggestions yet"
                          text="Import more games to unlock stronger Black repertoire suggestions."
                        />
                      )}
                    </div>
                  </div>
                </div>

                {isPremium && whiteDetailedRecommendations.length ? (
                  <div className="recommendationDetails">
                    <h3>Why these openings fit you as White</h3>

                    <div className="openingExplainGrid">
                      {whiteDetailedRecommendations.map((opening) => (
                        <article
                          className="openingExplainCard"
                          key={opening.name}
                        >
                          <h4>{opening.name}</h4>
                          <p>{opening.reason}</p>
                          <p>
                            <strong>Simple plan:</strong> {opening.plan}
                          </p>
                          <p>
                            <strong>Avoid:</strong> {opening.mistakeToAvoid}
                          </p>
                          <span>{opening.difficulty}</span>

                          <button
                            className="secondaryBtn explainPracticeBtn"
                            type="button"
                            onClick={() => startOpeningPractice(opening.name)}
                          >
                            Practise
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : !isPremium ? (
                  <LockedPremiumCard
                    title="Detailed opening explanations are premium"
                    text="Free shows basic suggestions. Premium explains why each opening fits you and what mistakes to avoid."
                  />
                ) : null}

                {isPremium && blackDetailedRecommendations.length ? (
                  <div className="recommendationDetails">
                    <h3>Why these openings fit you as Black</h3>

                    <div className="openingExplainGrid">
                      {blackDetailedRecommendations.map((opening) => (
                        <article
                          className="openingExplainCard"
                          key={opening.name}
                        >
                          <h4>{opening.name}</h4>
                          <p>{opening.reason}</p>
                          <p>
                            <strong>Simple plan:</strong> {opening.plan}
                          </p>
                          <p>
                            <strong>Avoid:</strong> {opening.mistakeToAvoid}
                          </p>
                          <span>{opening.difficulty}</span>

                          <button
                            className="secondaryBtn explainPracticeBtn"
                            type="button"
                            onClick={() => startOpeningPractice(opening.name)}
                          >
                            Practise
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="spacerTop">
                  <h3>Summary</h3>
                  <div className="list">
                    {smartRecommendationSummary.map((item, index) => (
                      <div className="listItem" key={index}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </div>

            <div id="section-verdicts">
              <Section
                title="Keep / Improve / Avoid"
                isOpen={openSections.verdicts}
                onToggle={() => toggleSection("verdicts")}
                badge={`${filteredBestOpenings.length} tracked`}
              >
                <div className="list">
                  {filteredBestOpenings.length ? (
                    filteredBestOpenings.map((item, index) => {
                      const rate = item.win_rate ?? item.winRate ?? 0;

                      return (
                        <button
                          className="listItem openingPracticeLink"
                          key={index}
                          type="button"
                          onClick={() => startOpeningPractice(item.name)}
                        >
                          <div>
                            <strong>{item.name}</strong>
                            <div className="smallText">
                              {item.games} games · {item.wins}W / {item.draws}D
                              / {item.losses}L
                            </div>
                          </div>

                          <div className="rightStat">
                            <div>{rate}%</div>
                            <div className={verdictClass(item.verdict)}>
                              {item.verdict}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyState
                      title="No opening verdicts yet"
                      text="Verdicts appear once you have enough recognised openings in your imported games."
                    />
                  )}
                </div>
              </Section>
            </div>

            <div id="section-chart">
              <Section
                title="Opening Win Rate"
                isOpen={openSections.chart}
                onToggle={() => toggleSection("chart")}
                badge={`${chartData.length} openings`}
              >
                <div className="chartList">
                  {chartData.length ? (
                    chartData.map((item, index) => {
                      const rate = item.win_rate ?? item.winRate ?? 0;

                      return (
                        <button
                          className="chartRow openingChartPracticeLink"
                          key={index}
                          type="button"
                          onClick={() => startOpeningPractice(item.name)}
                        >
                          <div className="chartLabel">{item.name}</div>

                          <div className="chartBarWrap">
                            <div
                              className="chartBar"
                              style={{ width: `${Math.max(rate || 0, 2)}%` }}
                            />
                          </div>

                          <div className="chartValue">{rate}%</div>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyState
                      title="No chart data yet"
                      text="Win-rate charts appear after Opening Fit finds recognised openings in your games."
                    />
                  )}
                </div>
              </Section>
            </div>

            <div id="section-training">
              <Section
                title="Personal Training Plan"
                isOpen={openSections.training}
                onToggle={() => toggleSection("training")}
                badge={`${personalTrainingPlan.length} steps`}
              >
                <div className="trainingPlanList">
                  {personalTrainingPlan.map((item, index) => (
                    <div className="trainingPlanItem" key={index}>
                      <div className="trainingStepNumber">{index + 1}</div>

                      <div className="trainingStepContent">
                        <h3>{item.title}</h3>
                        <p>{item.text}</p>

                        {item.opening ? (
                          <button
                            className="secondaryBtn trainingPracticeBtn"
                            type="button"
                            onClick={() => startOpeningPractice(item.opening)}
                          >
                            {item.action || "Practice opening"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {!isPremium ? (
                  <LockedPremiumCard
                    title="Advanced training plan locked"
                    text="Premium will show more steps, deeper weaknesses, and longer import history."
                  />
                ) : null}
              </Section>
            </div>

            <div id="section-replay">
              <Section
                title="Game Replay"
                isOpen={openSections.replay}
                onToggle={() => toggleSection("replay")}
                badge={selectedGame ? selectedGame.opening : null}
              >
                <div className="analysisGrid boardSection">
                  <div className="movesPanel">
                    <h3>Recent Games</h3>

                    <div className="gamePickerList">
                      {filteredRecentGames.length ? (
                        filteredRecentGames.map((game, index) => (
                          <button
                            key={index}
                            type="button"
                            className={`gamePickerButton ${
                              selectedGameIndex === index
                                ? "gamePickerButtonActive"
                                : ""
                            }`}
                            onClick={() => setSelectedGameIndex(index)}
                          >
                            <div className="gamePickerTop">
                              <strong>{game.opening}</strong>
                              <span>{game.result}</span>
                            </div>

                            <div className="smallText">
                              {game.white_username || game.whiteUsername} vs{" "}
                              {game.black_username || game.blackUsername} ·{" "}
                              {game.time_class || game.timeClass || "-"}
                            </div>
                          </button>
                        ))
                      ) : (
                        <EmptyState
                          title="No replay games found"
                          text="Recent games will appear here when the import includes PGN or move data."
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    {selectedGame && selectedReplayGame ? (
                      <>
                        <div className="boardMeta">
                          <div>
                            <strong>Opening:</strong>{" "}
                            <button
                              className="tableOpeningBtn"
                              type="button"
                              onClick={() =>
                                startOpeningPractice(selectedGame.opening)
                              }
                            >
                              {selectedGame.opening}
                            </button>
                          </div>

                          <div>
                            <strong>Result:</strong> {selectedGame.result}
                          </div>

                          <div>
                            <strong>Players:</strong>{" "}
                            {selectedGame.white_username ||
                              selectedGame.whiteUsername}{" "}
                            vs{" "}
                            {selectedGame.black_username ||
                              selectedGame.blackUsername}
                          </div>
                        </div>

                        <GameReplayBoard
                          game={selectedReplayGame}
                          title="Game Replay"
                          initialOrientation="white"
                        />
                      </>
                    ) : (
                      <EmptyState
                        title="No game selected"
                        text="Choose a recent game from the list to replay it."
                      />
                    )}
                  </div>
                </div>
              </Section>
            </div>

            <div id="section-preferred">
              <Section
                title="Preferred Openings"
                isOpen={openSections.preferred}
                onToggle={() => toggleSection("preferred")}
              >
                <div className="twoCol">
                  <div>
                    <h3>Preferred as White</h3>
                    <div className="list">
                      {filteredPreferredWhite.length ? (
                        filteredPreferredWhite.map((item, index) => (
                          <button
                            className="listItem openingPracticeLink"
                            key={index}
                            type="button"
                            onClick={() => startOpeningPractice(item.name)}
                          >
                            <strong>{item.name}</strong>
                            <span>{item.games} games</span>
                          </button>
                        ))
                      ) : (
                        <EmptyState
                          title="No preferred White openings yet"
                          text="Import more games to detect your most common White openings."
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <h3>Preferred as Black</h3>
                    <div className="list">
                      {filteredPreferredBlack.length ? (
                        filteredPreferredBlack.map((item, index) => (
                          <button
                            className="listItem openingPracticeLink"
                            key={index}
                            type="button"
                            onClick={() => startOpeningPractice(item.name)}
                          >
                            <strong>{item.name}</strong>
                            <span>{item.games} games</span>
                          </button>
                        ))
                      ) : (
                        <EmptyState
                          title="No preferred Black openings yet"
                          text="Import more games to detect your most common Black openings."
                        />
                      )}
                    </div>
                  </div>
                </div>
              </Section>
            </div>

            <div id="section-top">
              <Section
                title="Top Openings Table"
                isOpen={openSections.top}
                onToggle={() => toggleSection("top")}
                badge={`${filteredTopOpenings.length} rows`}
              >
                {filteredTopOpenings.length ? (
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Opening</th>
                          <th>Games</th>
                          <th>W</th>
                          <th>D</th>
                          <th>L</th>
                          <th>Win %</th>
                        </tr>
                      </thead>

                      <tbody>
                        {(isPremium
                          ? filteredTopOpenings
                          : filteredTopOpenings.slice(0, 8)
                        ).map((opening, index) => {
                          const rate = opening.win_rate ?? opening.winRate ?? 0;

                          return (
                            <tr key={index}>
                              <td>
                                <button
                                  className="tableOpeningBtn"
                                  type="button"
                                  onClick={() =>
                                    startOpeningPractice(opening.name)
                                  }
                                >
                                  {opening.name}
                                </button>
                              </td>
                              <td>{opening.games}</td>
                              <td>{opening.wins}</td>
                              <td>{opening.draws}</td>
                              <td>{opening.losses}</td>
                              <td>{rate}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {!isPremium && filteredTopOpenings.length > 8 ? (
                      <LockedPremiumCard
                        title="Full opening table locked"
                        text={`Free shows your top 8 rows. Premium would show all ${filteredTopOpenings.length} tracked openings.`}
                      />
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    title="No top openings yet"
                    text="Opening table data appears once recognised openings are found in your imported games."
                  />
                )}
              </Section>
            </div>
          </div>
        )}

        <section className="card feedbackCard">
          <h2>Help improve Opening Fit</h2>
          <p>
            Found a bug, confusing result, or feature idea? Send quick feedback
            before launch.
          </p>

          <textarea
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            placeholder="What should be improved?"
            rows={4}
          />

          <input
            value={feedbackContact}
            onChange={(e) => setFeedbackContact(e.target.value)}
            placeholder="Email or TikTok username optional"
          />

          <button
            className="secondaryButton"
            type="button"
            onClick={submitFeedback}
          >
            Send Feedback
          </button>

          {feedbackStatus ? (
            <p className="statusMessage">{feedbackStatus}</p>
          ) : null}
        </section>
      </main>

      <div className="landingWrap">
        <Footer />
      </div>
    </div>
  );
}