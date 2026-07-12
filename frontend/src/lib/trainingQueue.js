import { Chess } from "chess.js";
import { buildTrainingRecommendations } from "../services/trainingRecommendations.js";

export const TRAINING_SESSION_KEY = "openingFit:activeTrainingSession:v1";
export const TRAINING_TASK_COMPLETED_EVENT = "openingfit:training-task-completed";
const array = (value) => Array.isArray(value) ? value : [];
const name = (item = {}) => item.opening || item.name || item.openingName || "Opening line";

export function buildTrainingQueue(report = {}, repertoire = null, outcomes = []) {
  const recommendations = buildTrainingRecommendations(report);
  const weak = recommendations.recommendations.map((row, index) => ({ id: `weak:${name(row)}:${index}`, priority: 1000 - index * 50, type: row.type === "weak-line" ? "Repeated opening weakness" : "Low-confidence familiarity", title: name(row), reason: row.why, target: row.trainingTarget }));
  const mistakes = array(report.recentOpeningMistakes || report.recent_opening_mistakes || report.openingMistakes || report.opening_mistakes).slice(0, 2).map((row, index) => ({ id: `mistake:${row.gameId || row.game_id || index}`, priority: 900 - index, type: "Recent opening mistake", title: name(row), reason: row.explanation || row.reason || "Review the first move where the game left the intended repertoire.", target: row }));
  const selected = array(repertoire?.items).filter((item) => ["Learning", "Considering"].includes(item.status)).slice(0, 2).map((item, index) => ({ id: `repertoire:${item.id}`, priority: 700 - index, type: "New repertoire line", title: item.name, reason: "Build familiarity with a line you selected for your repertoire.", target: item.opening || item }));
  const failedIds = new Set(array(outcomes).filter((row) => row.result === "repeated_failure" || row.result === "revealed").map((row) => row.taskId));
  return [...weak, ...mistakes, ...selected].map((task) => failedIds.has(task.id) ? { ...task, priority: task.priority + 200, type: "Repeat a failed line" } : task).sort((a, b) => b.priority - a.priority).filter((task, index, rows) => rows.findIndex((row) => row.id === task.id) === index).slice(0, 4);
}

export function buildFiniteSession(queue = []) {
  const tasks = queue.slice(0, 3).map((task, index) => ({ ...task, exercise: index === 0 ? "Recall the next move" : index === 1 ? "Continue the short line" : "Review the practical plan" }));
  return { id: `session:${tasks.map((task) => task.id).join("|")}`, tasks, objective: tasks[0] ? `Reach the intended ${tasks[0].title} structure in your next game.` : "Play one game with a stable repertoire choice." };
}

export function evaluateTrainingMove({ fen = new Chess().fen(), attempted, expected, alternatives = [] }) {
  const game = new Chess(fen);
  let move;
  try { move = game.move(attempted); } catch { return { accepted: false, reason: "illegal" }; }
  if (!move) return { accepted: false, reason: "illegal" };
  const allowed = [expected, ...alternatives].filter(Boolean).map(String);
  for (const candidate of allowed) {
    const check = new Chess(fen); let accepted;
    try { accepted = check.move(candidate); } catch { accepted = null; }
    if (accepted && accepted.from === move.from && accepted.to === move.to && accepted.promotion === move.promotion) return { accepted: true, san: move.san, alternative: candidate !== expected };
  }
  return { accepted: false, reason: "wrong", san: move.san };
}

export function trainingOutcome({ attempts = 0, revealed = false }) {
  if (revealed) return "revealed";
  if (attempts <= 1) return "correct_first_attempt";
  if (attempts >= 4) return "repeated_failure";
  return "correct_after_retry";
}
