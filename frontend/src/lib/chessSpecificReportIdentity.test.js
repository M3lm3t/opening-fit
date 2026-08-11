import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { Chess } from "chess.js";
import { buildPrimaryReportSummary } from "./primaryReportSummary.js";

const component = fs.readFileSync(new URL("../components/PrimaryReportSummary.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../components/PrimaryReportSummary.css", import.meta.url), "utf8");

function reportModel(overrides = {}) {
  const position = new Chess();
  position.move("e4");
  position.move("c6");
  return {
    health: { score: 74, games: 38, confidence: "Strong" },
    repertoire: [],
    decisions: [],
    authoritative: {
      nextTrainingAction: { type: "practice", opening: "Caro-Kann Defence", sample: { games: 12 } },
      trainingPriority: {
        openingName: "Caro-Kann Defence",
        repertoireRole: "black_vs_e4",
        playerColour: "black",
        positionFen: position.fen(),
        recognisedLine: "1. e4 c6",
        estimatedDurationMinutes: 10,
      },
    },
    training: { opening: "Caro-Kann Defence", type: "practice" },
    ...overrides,
  };
}

test("canonical Train next FEN and line reach the existing board presentation", () => {
  const view = buildPrimaryReportSummary(reportModel(), {});
  assert.equal(view.trainNext.chessEvidence.orientation, "black");
  assert.equal(view.trainNext.chessEvidence.moveLine, "1. e4 c6");
  assert.match(view.trainNext.chessEvidence.positionFen, /^rnbqkbnr\/pp1ppppp/);
  assert.match(component, /<ChessPositionBoard position=\{view\.trainNext\.chessEvidence\.positionFen\}/);
  assert.match(component, />Position to train</);
});

test("invalid or absent positions never render a fake board", () => {
  const invalid = reportModel();
  invalid.authoritative.trainingPriority.positionFen = "not-a-fen";
  invalid.authoritative.trainingPriority.recognisedLine = null;
  const view = buildPrimaryReportSummary(invalid, {});
  assert.equal(view.trainNext.chessEvidence, null);
  assert.match(component, /view\.trainNext\.chessEvidence\?\.positionFen \?/);
});

test("repair uses a concise recorded branch and WDL uses chess-native separators", () => {
  const base = reportModel();
  const model = reportModel({
    authoritative: {
      ...base.authoritative,
      primaryProblem: { opening: "Scandinavian Defence", repertoireRole: "black_vs_e4", sample: { games: 12, wins: 4, draws: 2, losses: 6, knownResults: 12, scoreRate: 41.7 }, confidence: { label: "Strong" } },
      trainingPriority: {
        ...base.authoritative.trainingPriority,
        openingDiagnosis: { opening: "Scandinavian Defence", commonMovePrefix: { san: "1. e4 d5 2. exd5" } },
      },
    },
  });
  const view = buildPrimaryReportSummary(model, {});
  assert.equal(view.repair.chessEvidence.moveLine, "1. e4 d5 2. exd5");
  assert.equal(view.repair.observed.results, "4 W · 2 D · 6 L");
  assert.match(component, />Recorded branch</);
});

test("mobile board presentation remains bounded and CTAs retain full width", () => {
  assert.match(styles, /\.primaryReportPosition \.chessPositionBoard \{ width: min\(100%, 250px\); aspect-ratio: 1; \}/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*?\.primaryReportPosition,[\s\S]*?grid-template-columns: 1fr;/);
  assert.match(styles, /\.primaryReportCommand button,[\s\S]*?width: 100%;/);
});
