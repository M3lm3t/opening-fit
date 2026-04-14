import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

function Section({ title, isOpen, onToggle, children, badge = null }) {
  return (
    <section className="card collapsibleCard">
      <button className="sectionToggle" onClick={onToggle}>
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

function AuthModal({
  isOpen,
  mode,
  onClose,
  onSwitchMode,
  loginForm,
  signupForm,
  onLoginChange,
  onSignupChange,
  onLoginSubmit,
  onSignupSubmit,
  authMessage,
}) {
  if (!isOpen) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="authModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Authentication"
      >
        <div className="authModalTop">
          <div>
            <p className="authEyebrow">Opening Fit</p>
            <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          </div>

          <button className="authCloseBtn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="authTabs">
          <button
            type="button"
            className={`authTab ${mode === "login" ? "authTabActive" : ""}`}
            onClick={() => onSwitchMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={`authTab ${mode === "signup" ? "authTabActive" : ""}`}
            onClick={() => onSwitchMode("signup")}
          >
            Sign up
          </button>
        </div>

        {mode === "login" ? (
          <form className="authForm" onSubmit={onLoginSubmit}>
            <label>
              Email
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => onLoginChange("email", e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => onLoginChange("password", e.target.value)}
                placeholder="Enter your password"
                required
              />
            </label>

            <button type="submit" className="authSubmitBtn">
              Log in
            </button>
          </form>
        ) : (
          <form className="authForm" onSubmit={onSignupSubmit}>
            <label>
              Name
              <input
                type="text"
                value={signupForm.name}
                onChange={(e) => onSignupChange("name", e.target.value)}
                placeholder="Your name"
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={signupForm.email}
                onChange={(e) => onSignupChange("email", e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={signupForm.password}
                onChange={(e) => onSignupChange("password", e.target.value)}
                placeholder="Create a password"
                required
              />
            </label>

            <button type="submit" className="authSubmitBtn">
              Create account
            </button>
          </form>
        )}

        {authMessage ? <div className="authMessage">{authMessage}</div> : null}
      </div>
    </div>
  );
}

function LandingSection({
  onOpenLogin,
  onOpenSignup,
  currentUser,
  authLoading,
  handleLogout,
}) {
  const features = [
    {
      icon: "♟️",
      title: "Import Your Games",
      text: "Pull in your recent Chess.com games and instantly see the openings you actually play.",
    },
    {
      icon: "📊",
      title: "Understand Your Style",
      text: "See whether your results come from tactical attacks, practical setups, or calmer positional plans.",
    },
    {
      icon: "🎯",
      title: "Get Opening Recommendations",
      text: "Receive opening ideas based on your real games instead of generic theory dumps.",
    },
    {
      icon: "🚀",
      title: "Train With Purpose",
      text: "Use keep, improve, and avoid guidance to build a repertoire around your strengths.",
    },
  ];

  const steps = [
    "Import your Chess.com games",
    "See your opening trends and win rates",
    "Get a personalised opening fit report",
    "Build a simple repertoire around your strengths",
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

          <div className="landingNavRight">
            <nav className="landingNavLinks">
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href="#premium">Premium</a>
              <a href="#app-dashboard">App</a>
            </nav>

            <div className="landingAuthButtons">
              {authLoading ? null : currentUser ? (
                <>
                  <div className="userBadge">{currentUser.email}</div>
                  <button
                    className="landingLoginBtn"
                    type="button"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="landingLoginBtn"
                    type="button"
                    onClick={onOpenLogin}
                  >
                    Log in
                  </button>
                  <button
                    className="landingSignupBtn"
                    type="button"
                    onClick={onOpenSignup}
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="landingHeroGrid">
          <div className="landingHeroCopy">
            <div className="landingPill">
              <span>New</span>
              <span className="landingDot">•</span>
              <span>Personalised chess opening recommendations</span>
            </div>

            <h1>Build a repertoire that actually fits how you play.</h1>

            <p className="landingSubtext">
              Opening Fit analyses your real games, shows the openings you use
              most, and recommends better choices based on your style, results,
              and improvement areas.
            </p>

            <div className="landingActions">
              <a className="landingPrimaryBtn" href="#app-dashboard">
                Import Chess.com Games
              </a>
              <a className="landingSecondaryBtn" href="#sample-report">
                See sample report
              </a>
            </div>

            <div className="landingStats">
              <div className="landingStatCard">
                <strong>3 mins</strong>
                <span>to get started</span>
              </div>
              <div className="landingStatCard">
                <strong>1 click</strong>
                <span>to import games</span>
              </div>
              <div className="landingStatCard">
                <strong>Built for</strong>
                <span>club players</span>
              </div>
            </div>
          </div>

          <div className="landingPreviewCard" id="sample-report">
            <div className="landingPreviewTop">
              <div>
                <p className="landingMiniLabel">Style Profile</p>
                <h3>Aggressive counterpuncher</h3>
              </div>
              <span className="landingFitBadge">62% fit</span>
            </div>

            <div className="landingPreviewGrid">
              <div className="landingInfoCard">
                <p className="landingMiniLabel">Best with White</p>
                <h4>Vienna Game</h4>
                <p>Strong attacking chances, easy plans, lower theory load.</p>
              </div>

              <div className="landingInfoCard">
                <p className="landingMiniLabel">Best with Black</p>
                <h4>Scandinavian Defence</h4>
                <p>
                  Direct positions, practical ideas, and clear club-level plans.
                </p>
              </div>
            </div>

            <div className="landingInfoCard">
              <div className="landingCardHeader">
                <div>
                  <h4>Keep / Improve / Avoid</h4>
                  <p className="landingMiniLabel">Last 3 months</p>
                </div>
              </div>

              <div className="landingVerdictList">
                <div className="landingVerdictRow">
                  <div>
                    <strong>Vienna Game</strong>
                    <span>Win rate 72%</span>
                  </div>
                  <span className="verdict keep">Keep</span>
                </div>

                <div className="landingVerdictRow">
                  <div>
                    <strong>Scandinavian Defence</strong>
                    <span>Win rate 64%</span>
                  </div>
                  <span className="verdict keep">Keep</span>
                </div>

                <div className="landingVerdictRow">
                  <div>
                    <strong>Italian Game</strong>
                    <span>Win rate 48%</span>
                  </div>
                  <span className="verdict improve">Improve</span>
                </div>

                <div className="landingVerdictRow">
                  <div>
                    <strong>Random sideline setups</strong>
                    <span>Win rate 31%</span>
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
          <h2>Less theory overload. More useful recommendations.</h2>
          <p>
            Most players do not need a giant opening encyclopedia. They need
            clear advice based on their own games.
          </p>
        </div>

        <div className="landingFeatureGrid">
          {features.map((feature) => (
            <article className="landingFeatureCard" key={feature.title}>
              <div className="landingFeatureIcon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landingContentSection" id="how-it-works">
        <div className="landingHowItWorks">
          <div className="landingSectionHeading">
            <p className="landingEyebrow">How it works</p>
            <h2>A simple workflow for improving faster</h2>
            <p>
              Designed for everyday players who want practical opening help
              without drowning in theory.
            </p>
          </div>

          <div className="landingStepsList">
            {steps.map((step, index) => (
              <div className="landingStepCard" key={step}>
                <div className="landingStepNumber">{index + 1}</div>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landingContentSection" id="premium">
        <div className="landingPricingGrid">
          <article className="landingPriceCard">
            <p className="landingMiniLabel">Free</p>
            <h3>Get the essentials</h3>
            <p>
              Perfect for trying the app and understanding your core opening
              habits.
            </p>
            <ul>
              <li>Import recent Chess.com games</li>
              <li>View style profile summary</li>
              <li>See top openings and win rates</li>
              <li>Basic opening suggestions</li>
            </ul>
          </article>

          <article className="landingPriceCard landingPriceCardPremium">
            <div className="landingPriceTop">
              <div>
                <p className="landingMiniLabel">Premium</p>
                <h3>Go deeper with your repertoire</h3>
              </div>
              <span className="landingPriceBadge">£8 once-off</span>
            </div>

            <p>
              For players who want stronger recommendations and a more serious
              training roadmap.
            </p>

            <ul>
              <li>Keep / Improve / Avoid verdicts</li>
              <li>Premium opening families matched to your style</li>
              <li>More detailed training plans</li>
              <li>Future repertoire tools and deeper breakdowns</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="landingContentSection">
        <div className="landingFinalCta">
          <div>
            <p className="landingEyebrow dark">Start now</p>
            <h2>Stop guessing which openings suit you.</h2>
            <p>
              Import your games, understand your patterns, and build a repertoire
              that feels natural at the board.
            </p>
          </div>

          <div className="landingFinalActions">
            <a className="landingDarkBtn" href="#app-dashboard">
              Launch app
            </a>
            <a className="landingLightBtn" href="#sample-report">
              View example
            </a>
          </div>
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
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);

  const [openSections, setOpenSections] = useState({
    style: true,
    chart: true,
    training: false,
    recommendations: false,
    verdicts: true,
    replay: false,
    preferred: false,
    top: false,
  });

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const openOnly = (key) => {
    setOpenSections({
      style: false,
      chart: false,
      training: false,
      recommendations: false,
      verdicts: false,
      replay: false,
      preferred: false,
      top: false,
      [key]: true,
    });
  };

  const openLoginModal = () => {
    setAuthMode("login");
    setAuthMessage("");
    setAuthOpen(true);
  };

  const openSignupModal = () => {
    setAuthMode("signup");
    setAuthMessage("");
    setAuthOpen(true);
  };

  const closeAuthModal = () => {
    setAuthOpen(false);
    setAuthMessage("");
  };

  const handleLoginChange = (field, value) => {
    setLoginForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignupChange = (field, value) => {
    setSignupForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogout = () => {
    setAuthMode("login");
    setAuthMessage("Authentication is temporarily disabled while testing.");
    setAuthOpen(true);
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
        typeof item === "string"
          ? item
          : item?.name || item?.opening || "";

      return !isUnknownOpening(name);
    });
  };

  const importGames = async () => {
    setLoading(true);
    setError("");
    setData(null);
    setSelectedGameIndex(0);
    setCurrentMoveIndex(0);

    try {
      const res = await fetch(
        `${API_BASE}/import/chesscom/${encodeURIComponent(username)}?months=3`
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.detail || "Could not import games");
      }

      setData(json);

      setTimeout(() => {
        const el = document.getElementById("app-results");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      setError(err.message || "Something went wrong");
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

  const selectedGame = filteredRecentGames?.[selectedGameIndex] || null;

  useEffect(() => {
    setSelectedGameIndex(0);
    setCurrentMoveIndex(0);
  }, [showUnknownOpenings]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        closeAuthModal();
      }
    };

    if (authOpen) {
      window.addEventListener("keydown", handleEscape);
    }

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [authOpen]);

  useEffect(() => {
    setCurrentUser(null);
    setAuthLoading(false);
  }, []);

  const replayData = useMemo(() => {
    if (!selectedGame?.pgn) {
      return {
        fen: "start",
        history: [],
        movesForDisplay: [],
      };
    }

    try {
      const base = new Chess();
      base.loadPgn(selectedGame.pgn);

      const historyVerbose = base.history({ verbose: true });

      const replay = new Chess();
      for (let i = 0; i < currentMoveIndex; i += 1) {
        replay.move(historyVerbose[i]);
      }

      const movesForDisplay = [];
      for (let i = 0; i < historyVerbose.length; i += 2) {
        const whiteMove = historyVerbose[i];
        const blackMove = historyVerbose[i + 1];

        movesForDisplay.push({
          moveNumber: Math.floor(i / 2) + 1,
          white: whiteMove?.san || "",
          black: blackMove?.san || "",
        });
      }

      return {
        fen: replay.fen(),
        history: historyVerbose,
        movesForDisplay,
      };
    } catch {
      return {
        fen: "start",
        history: [],
        movesForDisplay: [],
      };
    }
  }, [selectedGame, currentMoveIndex]);

  useEffect(() => {
    setCurrentMoveIndex(0);
  }, [selectedGameIndex]);

  const totalMoves = replayData.history.length;

  const goToStart = () => setCurrentMoveIndex(0);
  const goBack = () => setCurrentMoveIndex((n) => Math.max(0, n - 1));
  const goForward = () => setCurrentMoveIndex((n) => Math.min(totalMoves, n + 1));
  const goToEnd = () => setCurrentMoveIndex(totalMoves);

  const chartData = useMemo(() => {
    return filteredTopOpenings.slice(0, 6);
  }, [filteredTopOpenings]);

  const lichessUrl = `https://lichess.org/@/${encodeURIComponent(username)}`;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthMessage("Login is temporarily disabled while testing the live site.");
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setAuthMessage("Sign up is temporarily disabled while testing the live site.");
  };

  return (
    <div className="page">
      <LandingSection
        onOpenLogin={openLoginModal}
        onOpenSignup={openSignupModal}
        currentUser={currentUser}
        authLoading={authLoading}
        handleLogout={handleLogout}
      />

      <AuthModal
        isOpen={authOpen}
        mode={authMode}
        onClose={closeAuthModal}
        onSwitchMode={setAuthMode}
        loginForm={loginForm}
        signupForm={signupForm}
        onLoginChange={handleLoginChange}
        onSignupChange={handleSignupChange}
        onLoginSubmit={handleLoginSubmit}
        onSignupSubmit={handleSignupSubmit}
        authMessage={authMessage}
      />

      <div className="container" id="app-dashboard">
        <header className="hero">
          <p className="eyebrow">Opening Fit</p>
          <h1>Find openings that match your style</h1>
          <p className="subtext">
            Import your Chess.com games and explore your style profile, opening
            verdicts, training plan, personalised repertoire ideas, and game
            replay.
          </p>

          <div className="searchRow">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Chess.com username"
            />
            <button onClick={importGames} disabled={loading || !username.trim()}>
              {loading ? "Importing..." : "Import Chess.com Games"}
            </button>
            <a
              className="secondaryButton"
              href={lichessUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Lichess Profile
            </a>

            {authLoading ? null : currentUser ? (
              <>
                <div className="userBadge">{currentUser.email}</div>
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={openLoginModal}
                >
                  Log in
                </button>
                <button
                  className="signupButton"
                  type="button"
                  onClick={openSignupModal}
                >
                  Sign up
                </button>
              </>
            )}
          </div>

          <div
            style={{
              marginTop: "14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              <input
                type="checkbox"
                checked={showUnknownOpenings}
                onChange={(e) => setShowUnknownOpenings(e.target.checked)}
              />
              Show unknown openings
            </label>
          </div>

          <p className="helper">
            Backend: <code>{API_BASE}</code>
          </p>
        </header>

        {error && <div className="errorBox">{error}</div>}

        {!data && !loading && !error && (
          <section className="placeholderGrid">
            <div className="card">
              <h3>Cleaner dashboard</h3>
              <p>Open only the sections you want to view.</p>
            </div>
            <div className="card">
              <h3>Replay board</h3>
              <p>Step through moves without cluttering the screen.</p>
            </div>
            <div className="card">
              <h3>Quick navigation</h3>
              <p>Jump straight to charts, verdicts, training, or game replay.</p>
            </div>
          </section>
        )}

        {data && (
          <div id="app-results">
            <section className="statsGrid">
              <div className="card statCard">
                <span className="statLabel">Username</span>
                <span className="statValue">{data.username}</span>
              </div>
              <div className="card statCard">
                <span className="statLabel">Games Imported</span>
                <span className="statValue">{data.total_games}</span>
              </div>
              <div className="card statCard">
                <span className="statLabel">Months Checked</span>
                <span className="statValue">{data.months_checked}</span>
              </div>
            </section>

            <section className="card quickNavCard">
              <h2>Quick View</h2>
              <div className="quickNavGrid">
                <button className="quickNavBtn" onClick={() => openOnly("style")}>
                  Style Profile
                </button>
                <button className="quickNavBtn" onClick={() => openOnly("chart")}>
                  Opening Win Rate
                </button>
                <button className="quickNavBtn" onClick={() => openOnly("verdicts")}>
                  Keep / Improve / Avoid
                </button>
                <button className="quickNavBtn" onClick={() => openOnly("training")}>
                  Training Plan
                </button>
                <button
                  className="quickNavBtn"
                  onClick={() => openOnly("recommendations")}
                >
                  Opening Suggestions
                </button>
                <button className="quickNavBtn" onClick={() => openOnly("replay")}>
                  Game Replay
                </button>
                <button className="quickNavBtn" onClick={() => openOnly("preferred")}>
                  Preferred Openings
                </button>
                <button className="quickNavBtn" onClick={() => openOnly("top")}>
                  Top Openings Table
                </button>
              </div>
            </section>

            <Section
              title="Style Profile"
              isOpen={openSections.style}
              onToggle={() => toggleSection("style")}
              badge={filterUnknownOpenings(data.style_profile?.labels || []).join(
                " · "
              )}
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

                  <p className="profileSummary">{data.style_profile.summary}</p>

                  <h3>Top Opening Families</h3>
                  <div className="list">
                    {filterUnknownOpenings(
                      data.style_profile?.top_opening_families || []
                    ).map((item, index) => (
                      <div className="listItem" key={index}>
                        <strong>{item}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="premiumMiniCard">
                  <p className="premiumLabel">Premium Preview</p>
                  <h3>Best Openings For You</h3>
                  <div className="list">
                    {filterUnknownOpenings(
                      data.premium_preview.best_opening_for_you
                    ).map((item, index) => (
                      <div className="listItem" key={index}>
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
                      </div>
                    ))}
                  </div>
                </div>
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
                  <div className="chartRow" key={index}>
                    <div className="chartLabel">{item.name}</div>
                    <div className="chartBarWrap">
                      <div
                        className="chartBar"
                        style={{ width: `${Math.max(item.win_rate, 2)}%` }}
                      />
                    </div>
                    <div className="chartValue">{item.win_rate}%</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="Training Plan"
              isOpen={openSections.training}
              onToggle={() => toggleSection("training")}
              badge={`${data.training_plan.length} steps`}
            >
              <div className="list">
                {data.training_plan.map((item, index) => (
                  <div className="listItem" key={index}>
                    {index + 1}. {item}
                  </div>
                ))}
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
                    {filterUnknownOpenings(data.opening_recommendations.white).map(
                      (item, index) => (
                        <div className="listItem" key={index}>
                          <strong>{item}</strong>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <h3>Recommended as Black</h3>
                  <div className="list">
                    {filterUnknownOpenings(data.opening_recommendations.black).map(
                      (item, index) => (
                        <div className="listItem" key={index}>
                          <strong>{item}</strong>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="spacerTop">
                <h3>Recommendations Summary</h3>
                <div className="list">
                  {data.recommendations.map((item, index) => (
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
                  <div className="listItem" key={index}>
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
              <div className="analysisGrid">
                <div>
                  <h3>Recent Games</h3>
                  <div className="gamePickerList">
                    {filteredRecentGames.map((game, index) => (
                      <button
                        key={index}
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
                  {selectedGame ? (
                    <>
                      <div className="boardMeta">
                        <div>
                          <strong>Opening:</strong> {selectedGame.opening}
                        </div>
                        <div>
                          <strong>Result:</strong> {selectedGame.result}
                        </div>
                        <div>
                          <strong>Players:</strong> {selectedGame.white_username} vs{" "}
                          {selectedGame.black_username}
                        </div>
                      </div>

                      <div className="boardWrap">
                        <Chessboard
                          id="opening-fit-board"
                          position={replayData.fen}
                          arePiecesDraggable={false}
                          boardWidth={420}
                        />
                      </div>

                      <div className="boardControls">
                        <button onClick={goToStart} disabled={currentMoveIndex === 0}>
                          ⏮
                        </button>
                        <button onClick={goBack} disabled={currentMoveIndex === 0}>
                          ◀
                        </button>
                        <button
                          onClick={goForward}
                          disabled={currentMoveIndex === totalMoves}
                        >
                          ▶
                        </button>
                        <button
                          onClick={goToEnd}
                          disabled={currentMoveIndex === totalMoves}
                        >
                          ⏭
                        </button>
                      </div>

                      <div className="moveCounter">
                        Move step {currentMoveIndex} / {totalMoves}
                      </div>

                      <div className="movesTable">
                        {replayData.movesForDisplay.map((row) => {
                          const whitePly = row.moveNumber * 2 - 1;
                          const blackPly = row.moveNumber * 2;

                          return (
                            <div className="movesRow" key={row.moveNumber}>
                              <div className="moveNumber">{row.moveNumber}.</div>
                              <button
                                className={`moveCell ${
                                  currentMoveIndex === whitePly
                                    ? "moveCellActive"
                                    : ""
                                }`}
                                onClick={() => setCurrentMoveIndex(whitePly)}
                              >
                                {row.white || "-"}
                              </button>
                              <button
                                className={`moveCell ${
                                  currentMoveIndex === blackPly
                                    ? "moveCellActive"
                                    : ""
                                }`}
                                onClick={() => setCurrentMoveIndex(blackPly)}
                              >
                                {row.black || "-"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p>No game selected.</p>
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
                      <div className="listItem" key={index}>
                        <strong>{item.name}</strong>
                        <span>{item.games} games</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3>Preferred as Black</h3>
                  <div className="list">
                    {filteredPreferredBlack.map((item, index) => (
                      <div className="listItem" key={index}>
                        <strong>{item.name}</strong>
                        <span>{item.games} games</span>
                      </div>
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
                        <td>{opening.name}</td>
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
      </div>
    </div>
  );
}