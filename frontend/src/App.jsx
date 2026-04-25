import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import "./App.css";
import GameReplayBoard from "./components/GameReplayBoard";
import OpeningPracticeBoard from "./components/OpeningPracticeBoard";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

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

function LandingSection() {
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
            <a href="#how-it-works">How it works</a>
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
              <a className="landingSecondaryBtn" href="#sample-report">
                See example
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
                <h4>Vienna Game</h4>
                <p>Active development, attacking chances, and clear plans.</p>
              </div>

              <div className="landingInfoCard">
                <p className="landingMiniLabel">Black repertoire</p>
                <h4>Scandinavian Defence</h4>
                <p>Direct positions with practical club-level ideas.</p>
              </div>
            </div>

            <div className="landingInfoCard">
              <p className="landingMiniLabel">Opening verdicts</p>
              <h4>Keep / Improve / Avoid</h4>

              <div className="landingVerdictList">
                <div className="landingVerdictRow">
                  <div>
                    <strong>Vienna Game</strong>
                    <span>Strong recent results</span>
                  </div>
                  <span className="verdict keep">Keep</span>
                </div>

                <div className="landingVerdictRow">
                  <div>
                    <strong>Italian Game</strong>
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
              <li>Keep / Improve / Avoid verdicts</li>
              <li>Opening families matched to your style</li>
              <li>Detailed personal training plans</li>
              <li>Future repertoire tools</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState("Hikaru");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [showUnknownOpenings, setShowUnknownOpenings] = useState(false);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [practiceOpening, setPracticeOpening] = useState(null);

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

const [openSections, setOpenSections] = useState(closedSections);

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

  const importGames = async () => {
    setLoading(true);
    setError("");
    setData(null);
    setSelectedGameIndex(0);
    setPracticeOpening(null);
    setOpenSections(closedSections);

    const cleanUsername = username.trim();

    try {
      if (!cleanUsername) {
        throw new Error("Please enter a Chess.com username.");
      }

      const res = await fetch(
        `${API_BASE}/api/import/chesscom/${encodeURIComponent(
          cleanUsername
        )}?months=3`
      );

      let json = null;

      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok || !json) {
        throw new Error(
          json?.detail ||
            "We could not import those games right now. Please check the username and try again."
        );
      }

      setData(json);

      setTimeout(() => {
        const el = document.getElementById("app-results");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      if (err.name === "TypeError") {
        setError(
          "We could not connect to the app server. Please make sure the backend is running, then try again."
        );
      } else {
        setError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
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
    return filteredTopOpenings.slice(0, 6);
  }, [filteredTopOpenings]);

  const personalTrainingPlan = useMemo(() => {
    const plan = [];

    const best = [...filteredBestOpenings]
      .filter((item) => (item.games || 0) >= 3)
      .sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0));

    const weakest = [...filteredBestOpenings]
      .filter((item) => (item.games || 0) >= 3)
      .sort((a, b) => (a.win_rate || 0) - (b.win_rate || 0));

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
      plan.push({
        title: `Keep using ${bestOpening.name}`,
        text: `This is one of your strongest openings with a ${bestOpening.win_rate}% win rate from ${bestOpening.games} games. Keep it in your repertoire and learn one extra idea rather than replacing it.`,
        action: `Reinforce ${bestOpening.name}`,
        opening: bestOpening.name,
      });
    }

    if (weakOpening && weakOpening.name !== bestOpening?.name) {
      plan.push({
        title: `Repair your ${weakOpening.name}`,
        text: `This opening is currently scoring ${weakOpening.win_rate}% from ${weakOpening.games} games. Do not drop it immediately — first check whether you are losing in the opening or later in the middlegame.`,
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

    return uniquePlan.slice(0, 5);
  }, [
    filteredBestOpenings,
    filteredTopOpenings,
    filteredPreferredWhite,
    filteredPreferredBlack,
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
      white: selectedGame.white_username || selectedGame.white || "White",
      black: selectedGame.black_username || selectedGame.black || "Black",
      result: selectedGame.result || "",
      moves: parsedMoves,
    };
  }, [selectedGame, selectedGameIndex]);

  useEffect(() => {
    setSelectedGameIndex(0);
  }, [showUnknownOpenings]);

  return (
    <div className="page">
      <LandingSection />

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

          <div className="searchRow topBar">
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Chess.com username"
            />

            <button
              className="primaryBtn"
              type="button"
              onClick={importGames}
              disabled={loading || !username.trim()}
            >
              {loading ? "Importing games..." : "Import Chess.com Games"}
            </button>
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
          </div>
        </header>

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
                  {data.months_checked} month
                  {data.months_checked === 1 ? "" : "s"}
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

            {practiceOpening && (
              <div id="opening-practice">
                <OpeningPracticeBoard
                  openingName={practiceOpening}
                  onClose={() => setPracticeOpening(null)}
                />
              </div>
            )}

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
                    {filterUnknownOpenings(data.style_profile?.labels || []).map(
                      (label, index) => (
                        <span className="chip" key={index}>
                          {label}
                        </span>
                      )
                    )}
                  </div>

                  <p className="profileSummary">
                    {data.style_profile?.summary ||
                      "Your style profile will appear here once enough games are analysed."}
                  </p>

                  <h3>Top Opening Families</h3>

                  <div className="list">
                    {filterUnknownOpenings(
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
                    ))}
                  </div>
                </div>

                <div className="premiumMiniCard">
                  <p className="premiumLabel">Premium Preview</p>
                  <h3>Best Openings For You</h3>

                  <div className="list">
                    {filterUnknownOpenings(
                      data.premium_preview?.best_opening_for_you || []
                    ).map((item, index) => (
                      <button
                        className="listItem openingPracticeLink"
                        key={index}
                        type="button"
                        onClick={() => startOpeningPractice(item.name)}
                      >
                        <div>
                          <strong>{item.name}</strong>
                          <div className="smallText">{item.games} games</div>
                        </div>

                        <div className="rightStat">
                          <div>{item.win_rate}%</div>
                          <div className={verdictClass(item.verdict)}>
                            {item.verdict}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

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
                    ))}
                  </div>
                </div>

                <div>
                  <h3>Recommended as Black</h3>

                  <div className="list">
                    {filterUnknownOpenings(
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
                    ))}
                  </div>
                </div>
              </div>

              <div className="spacerTop">
                <h3>Summary</h3>

                <div className="list">
                  {(data.recommendations || []).map((item, index) => (
                    <div className="listItem" key={index}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Section
              title="Keep / Improve / Avoid"
              isOpen={openSections.verdicts}
              onToggle={() => toggleSection("verdicts")}
              badge={`${filteredBestOpenings.length} tracked`}
            >
              <div className="list">
                {filteredBestOpenings.map((item, index) => (
                  <button
                    className="listItem openingPracticeLink"
                    key={index}
                    type="button"
                    onClick={() => startOpeningPractice(item.name)}
                  >
                    <div>
                      <strong>{item.name}</strong>
                      <div className="smallText">
                        {item.games} games · {item.wins}W / {item.draws}D /{" "}
                        {item.losses}L
                      </div>
                    </div>

                    <div className="rightStat">
                      <div>{item.win_rate}%</div>
                      <div className={verdictClass(item.verdict)}>
                        {item.verdict}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            <Section
              title="Opening Win Rate"
              isOpen={openSections.chart}
              onToggle={() => toggleSection("chart")}
              badge={`${chartData.length} openings`}
            >
              <div className="chartList">
                {chartData.map((item, index) => (
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
                        style={{
                          width: `${Math.max(item.win_rate || 0, 2)}%`,
                        }}
                      />
                    </div>

                    <div className="chartValue">{item.win_rate}%</div>
                  </button>
                ))}
              </div>
            </Section>

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
            </Section>

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
                    {filteredRecentGames.map((game, index) => (
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
                          {game.white_username} vs {game.black_username} ·{" "}
                          {game.time_class || "-"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  {selectedGame && selectedReplayGame ? (
                    <>
                      <div className="boardMeta">
                        <div>
                          <strong>Opening:</strong> {selectedGame.opening}
                        </div>

                        <div>
                          <strong>Result:</strong> {selectedGame.result}
                        </div>

                        <div>
                          <strong>Players:</strong>{" "}
                          {selectedGame.white_username} vs{" "}
                          {selectedGame.black_username}
                        </div>
                      </div>

                      <GameReplayBoard
                        game={selectedReplayGame}
                        title="Game Replay"
                        initialOrientation="white"
                      />
                    </>
                  ) : (
                    <p>No recent games available.</p>
                  )}
                </div>
              </div>
            </Section>

            <Section
              title="Preferred Openings"
              isOpen={openSections.preferred}
              onToggle={() => toggleSection("preferred")}
            >
              <div className="twoCol">
                <div>
                  <h3>Preferred as White</h3>

                  <div className="list">
                    {filteredPreferredWhite.map((item, index) => (
                      <button
                        className="listItem openingPracticeLink"
                        key={index}
                        type="button"
                        onClick={() => startOpeningPractice(item.name)}
                      >
                        <strong>{item.name}</strong>
                        <span>{item.games} games</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3>Preferred as Black</h3>

                  <div className="list">
                    {filteredPreferredBlack.map((item, index) => (
                      <button
                        className="listItem openingPracticeLink"
                        key={index}
                        type="button"
                        onClick={() => startOpeningPractice(item.name)}
                      >
                        <strong>{item.name}</strong>
                        <span>{item.games} games</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            <Section
              title="Top Openings Table"
              isOpen={openSections.top}
              onToggle={() => toggleSection("top")}
              badge={`${filteredTopOpenings.length} rows`}
            >
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
                    {filteredTopOpenings.map((opening, index) => (
                      <tr key={index}>
                        <td>
                          <button
                            className="tableOpeningBtn"
                            type="button"
                            onClick={() => startOpeningPractice(opening.name)}
                          >
                            {opening.name}
                          </button>
                        </td>
                        <td>{opening.games}</td>
                        <td>{opening.wins}</td>
                        <td>{opening.draws}</td>
                        <td>{opening.losses}</td>
                        <td>{opening.win_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}