import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthDataProvider";
import GameReplayBoard from "./GameReplayBoard";
import NextBestAction from "./NextBestAction";
import { buildGameReviewMission, buildOpeningEvidence, completionSet } from "../services/gameReviewMissions";
import { xpForEvent } from "../services/xpProgress";
import "./OpeningDetailPanel.css";

function numberValue(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace("%", ""));
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed >= 0 && parsed <= 1) return Math.round(parsed * 100);
  return Math.round(parsed);
}

function openingName(opening = {}) {
  if (typeof opening === "string") return opening;
  return opening.name || opening.opening || opening.openingName || opening.opening_name || "Opening";
}

function record(opening = {}) {
  const games = numberValue(opening.games ?? opening.count ?? opening.total, 0);
  const wins = numberValue(opening.wins ?? opening.w, 0);
  const draws = numberValue(opening.draws ?? opening.d, 0);
  const losses = numberValue(opening.losses ?? opening.l, 0);
  if (wins || draws || losses) return `${wins}/${draws}/${losses}`;
  return games ? `${games} games` : "No record";
}

function classification(opening = {}, fallback = "Review") {
  const raw = String(opening.verdict || opening.recommendation_label || opening.recommendationLabel || fallback);
  if (/avoid|park|pause/i.test(raw)) return "Avoid for now";
  if (/keep|weapon|main/i.test(raw)) return "Keep";
  if (/improve|repair|review/i.test(raw)) return "Improve";
  if (/explore|try/i.test(raw)) return "Explore";
  if (/reduce/i.test(raw)) return "Reduce";
  return raw;
}

function gameLabel(game = {}) {
  return [
    game.result || game.outcome || "Result unknown",
    game.opponentRating || game.opponent_rating ? `opp ${game.opponentRating || game.opponent_rating}` : "",
    game.date || game.end_time || game.playedAt || "",
  ].filter(Boolean).join(" - ");
}

export default function OpeningDetailPanel({
  opening,
  report,
  category,
  onPractice,
  onReturn,
  onSessionComplete,
}) {
  const { user, history, recordActivity } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState("");
  const completedIds = useMemo(() => completionSet(history), [history]);
  const evidence = useMemo(() => buildOpeningEvidence(report || {}, opening), [report, opening]);
  const mission = useMemo(
    () => buildGameReviewMission(report || {}, opening, completedIds),
    [report, opening, completedIds]
  );
  const name = openingName(opening);
  const games = numberValue(opening.games ?? opening.count ?? opening.total, evidence.games.length);
  const score = numberValue(opening.fitScore ?? opening.fit_score ?? opening.score ?? opening.winRate ?? opening.win_rate, null);
  const selectedGame = mission.games[selectedIndex] || null;
  const orientation = String(opening.side || opening.colour || opening.color || selectedGame?.player_color || "").toLowerCase().includes("black")
    ? "black"
    : "white";

  const markReviewed = async () => {
    if (!mission.available || mission.completed) return;
    const payload = {
      mission_id: mission.id,
      opening: name,
      games_reviewed: mission.games.length,
      points: xpForEvent("game_review_mission_completed"),
      dedupe_key: `game_review_mission_completed:${mission.id}`,
    };

    try {
      await recordActivity?.("game_review_mission_completed", payload);
      setStatus("Mission complete. This now counts toward Today and your streak.");
      onSessionComplete?.({
        title: "Today's progress",
        lines: [`${mission.games.length} game${mission.games.length === 1 ? "" : "s"} reviewed`, `${payload.points} XP earned`],
      });
    } catch (error) {
      console.warn("OpeningFit could not save game-review completion.", error);
      setStatus(user?.id ? "Reviewed locally, but cloud save failed." : "Reviewed locally. Log in to sync progress.");
    }
  };

  return (
    <section className="openingDetailPanel" aria-label={`${name} opening details`}>
      <div className="openingDetailHeader">
        <div>
          <p className="eyebrow">Opening detail</p>
          <h3>{name}</h3>
          <p>{opening.short_reason || opening.shortReason || opening.reason || "Evidence from your analysed games."}</p>
        </div>
        <button type="button" className="secondaryBtn" onClick={onReturn}>Return to report</button>
      </div>

      <div className="openingDetailStats">
        <span>Classification <strong>{classification(opening, category)}</strong></span>
        <span>Score <strong>{score ?? "Low data"}</strong></span>
        <span>Games <strong>{games}</strong></span>
        <span>Record <strong>{record(opening)}</strong></span>
      </div>

      <details className="openingReasonDetails">
        <summary>Why am I seeing this?</summary>
        <p>
          This is a coaching recommendation based on your analysed games. Avoid for now means pause or deprioritise,
          not that the opening is objectively bad.
        </p>
      </details>

      <div className="openingEvidenceGrid">
        <article>
          <span>Recent wins</span>
          <strong>{evidence.wins.length || "None found"}</strong>
        </article>
        <article>
          <span>Recent losses</span>
          <strong>{evidence.losses.length || "None found"}</strong>
        </article>
        <article>
          <span>Replayable games</span>
          <strong>{evidence.replayable.length}</strong>
        </article>
      </div>

      <div className="gameReviewMission">
        <div className="openingDetailHeader">
          <div>
            <p className="eyebrow">Review your games</p>
            <h4>{mission.title}</h4>
            <p>{mission.why}</p>
          </div>
          <strong>{mission.estimatedTime}</strong>
        </div>

        {mission.games.length ? (
          <>
            <div className="missionGameTabs" role="tablist" aria-label="Mission games">
              {mission.games.map((game, index) => (
                <button
                  key={game.id || game.url || index}
                  type="button"
                  className={index === selectedIndex ? "isActive" : ""}
                  onClick={() => setSelectedIndex(index)}
                >
                  Game {index + 1}
                  <span>{gameLabel(game)}</span>
                </button>
              ))}
            </div>
            <GameReplayBoard
              game={selectedGame}
              title={selectedGame ? `${name} review` : "Game review"}
              initialOrientation={orientation}
            />
          </>
        ) : (
          <div className="replayWarning">
            This report does not include replayable games for {name}. Open the original game link if available, or refresh analysis after more games.
          </div>
        )}

        <div className="openingDetailActions">
          <button type="button" className="primaryBtn" disabled={!mission.available || mission.completed} onClick={markReviewed}>
            {mission.completed ? "Mission complete" : "Mark reviewed"}
          </button>
          <button type="button" className="secondaryBtn" disabled={!onPractice} onClick={() => onPractice?.(opening)}>
            Practise this opening
          </button>
        </div>
        {status ? <p className="openingDetailStatus">{status}</p> : null}
      </div>

      <NextBestAction
        title={mission.completed ? "Return to Today or practise the line" : "Finish the review mission"}
        detail={mission.completed ? "You have reviewed this opening evidence. The next useful step is short practice." : "Mark the mission complete after you have reviewed the included games."}
        primary={{
          label: mission.completed ? "Practise this opening" : "Mark reviewed",
          onClick: mission.completed ? () => onPractice?.(opening) : markReviewed,
          disabled: !mission.completed && !mission.available,
        }}
        secondary={[
          { label: "Return to report", onClick: onReturn },
          { label: "Practise", onClick: () => onPractice?.(opening), disabled: !onPractice },
        ]}
      />
    </section>
  );
}
