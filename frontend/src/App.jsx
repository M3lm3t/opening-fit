import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import "./App.css";

const API_BASE = "http://127.0.0.1:8001";

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

export default function App() {
  const [username, setUsername] = useState("Hikaru");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

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

  const selectedGame = data?.recent_games?.[selectedGameIndex] || null;

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
    if (!data?.top_openings) return [];
    return data.top_openings.slice(0, 6);
  }, [data]);

  const lichessUrl = `https://lichess.org/@/${encodeURIComponent(username)}`;

  return (
    <div className="page">
      <div className="container">
        <header className="hero">
          <p className="eyebrow">Opening Fit</p>
          <h1>Find openings that match your style</h1>
          <p className="subtext">
            Import your Chess.com games and explore your style profile, opening
            verdicts, training plan, personalised repertoire ideas, and game replay.
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
          </div>

          <p className="helper">
            Backend: <code>http://127.0.0.1:8001</code>
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
          <>
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
                <button className="quickNavBtn" onClick={() => openOnly("recommendations")}>
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
              badge={data.style_profile?.labels?.join(" · ")}
            >
              <div className="twoCol">
                <div>
                  <div className="chips">
                    {data.style_profile.labels.map((label, index) => (
                      <span className="chip" key={index}>
                        {label}
                      </span>
                    ))}
                  </div>

                  <p className="profileSummary">{data.style_profile.summary}</p>

                  <h3>Top Opening Families</h3>
                  <div className="list">
                    {data.style_profile.top_opening_families.map((item, index) => (
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
                    {data.premium_preview.best_opening_for_you.map((item, index) => (
                      <div className="listItem" key={index}>
                        <div>
                          <strong>{item.name}</strong>
                          <div className="smallText">{item.games} games</div>
                        </div>
                        <div className="rightStat">
                          <div>{item.win_rate}%</div>
                          <div className={verdictClass(item.verdict)}>{item.verdict}</div>
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
                    {data.opening_recommendations.white.map((item, index) => (
                      <div className="listItem" key={index}>
                        <strong>{item}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3>Recommended as Black</h3>
                  <div className="list">
                    {data.opening_recommendations.black.map((item, index) => (
                      <div className="listItem" key={index}>
                        <strong>{item}</strong>
                      </div>
                    ))}
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
              badge={`${data.best_openings.length} tracked`}
            >
              <div className="list">
                {data.best_openings.map((item, index) => (
                  <div className="listItem" key={index}>
                    <div>
                      <strong>{item.name}</strong>
                      <div className="smallText">
                        {item.games} games · {item.wins}W / {item.draws}D / {item.losses}L
                      </div>
                    </div>
                    <div className="rightStat">
                      <div>{item.win_rate}%</div>
                      <div className={verdictClass(item.verdict)}>{item.verdict}</div>
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
                    {data.recent_games.map((game, index) => (
                      <button
                        key={index}
                        className={`gamePickerButton ${
                          selectedGameIndex === index ? "gamePickerButtonActive" : ""
                        }`}
                        onClick={() => setSelectedGameIndex(index)}
                      >
                        <div className="gamePickerTop">
                          <strong>{game.opening}</strong>
                          <span>{game.result}</span>
                        </div>
                        <div className="smallText">
                          {game.white_username} vs {game.black_username} · {game.time_class || "-"}
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
                        <button onClick={goForward} disabled={currentMoveIndex === totalMoves}>
                          ▶
                        </button>
                        <button onClick={goToEnd} disabled={currentMoveIndex === totalMoves}>
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
                                  currentMoveIndex === whitePly ? "moveCellActive" : ""
                                }`}
                                onClick={() => setCurrentMoveIndex(whitePly)}
                              >
                                {row.white || "-"}
                              </button>
                              <button
                                className={`moveCell ${
                                  currentMoveIndex === blackPly ? "moveCellActive" : ""
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
                    {data.preferred_white.map((item, index) => (
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
                    {data.preferred_black.map((item, index) => (
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
              badge={`${data.top_openings.length} rows`}
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
                    {data.top_openings.map((opening, index) => (
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
          </>
        )}
      </div>
    </div>
  );
}