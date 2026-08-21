"""Canonical repeated opening-position decisions over trusted saved analysis."""

from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from typing import Any, Iterable, Mapping

import chess

from analysis.opening_perspective import perspective_from_item
from analysis.opening_training_opportunities import (
    OPENING_PHASE_END_MOVE,
    _clean_san,
    _game_from_pgn,
    _game_id,
    _legal_san,
    _normalised_position,
    _opening_name,
    _snapshots,
    _text,
    _user_colour,
)

MIN_POSITION_OCCURRENCES = 4
MIN_REPEATED_MOVE_OCCURRENCES = 3
MIN_ANALYSED_MOVE_OCCURRENCES = 2


def _number(value: Any) -> float | None:
    try:
        return float(value) if value is not None and value != "" else None
    except (TypeError, ValueError):
        return None


def _role(game: Mapping[str, Any], colour: bool, parsed: Any) -> str | None:
    canonical = str(perspective_from_item(game).get("repertoireRole") or "")
    if canonical in {"white", "black_vs_e4", "black_vs_d4"}:
        return canonical
    if colour == chess.WHITE:
        return "white"
    first = next(iter(parsed.mainline_moves()), None)
    if first:
        san = parsed.board().san(first)
        if san in {"e4", "d4"}:
            return f"black_vs_{san}"
    return None


def _analysis_rows(game: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    for key in ("moveAnalysis", "move_analysis", "openingMoveAnalysis", "opening_move_analysis"):
        value = game.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, Mapping)]
    return []


def _reliable(row: Mapping[str, Any]) -> bool:
    explicit = row.get("trusted") if "trusted" in row else row.get("evaluationTrusted") or row.get("evaluation_trusted")
    if explicit is False:
        return False
    confidence = _number(row.get("confidence"))
    if confidence is not None and confidence > 1:
        confidence /= 100
    source = _text(row.get("source")).lower()
    return bool(explicit is True or (confidence is not None and confidence >= 0.65) or any(token in source for token in ("engine", "book", "repertoire", "opening_reference")))


def _evaluation_change(row: Mapping[str, Any]) -> float | None:
    for key in ("playerEvaluationChangeCp", "player_evaluation_change_cp"):
        value = _number(row.get(key))
        if value is not None:
            return value
    perspective = _text(row.get("evaluationPerspective") or row.get("evaluation_perspective")).lower()
    player_relative = row.get("evaluationChangePlayerRelative") is True or row.get("evaluation_change_player_relative") is True
    if perspective in {"player", "user", "player_pov"} or player_relative:
        for key in ("evaluationChangeCp", "evaluation_change_cp", "evalChangeCp", "eval_change_cp"):
            value = _number(row.get(key))
            if value is not None:
                return value
    for key in ("centipawnLoss", "centipawn_loss", "cpLoss", "cp_loss"):
        value = _number(row.get(key))
        if value is not None:
            return -abs(value)
    return None


def detect_recurring_opening_habits(games: Iterable[Mapping[str, Any]], *, user_id: str, username: str = "", limit: int = 12) -> list[dict[str, Any]]:
    positions: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for raw in games:
        if not isinstance(raw, Mapping):
            continue
        pgn = _text(raw.get("pgn") or raw.get("rawPgn") or raw.get("raw_pgn"))
        parsed = _game_from_pgn(pgn)
        if not parsed:
            continue
        colour = _user_colour(dict(raw), parsed, username)
        if colour is None:
            continue
        role = _role(raw, colour, parsed)
        if role is None:
            continue
        snapshots, sans = _snapshots(parsed, colour)
        opening = _opening_name(dict(raw), parsed, sans)
        opening_id = _text(raw.get("canonicalOpeningId") or raw.get("canonical_opening_id") or raw.get("openingId") or raw.get("opening_id"))
        if not opening_id:
            continue
        analysis_by_position = defaultdict(list)
        for row in _analysis_rows(raw):
            key = _normalised_position(row.get("positionFen") or row.get("position_fen"))
            if key and len(key.split()) == 4 and _reliable(row):
                analysis_by_position[key].append(row)
        for snapshot in snapshots:
            if snapshot["moveNumber"] > OPENING_PHASE_END_MOVE:
                continue
            key = snapshot["positionKey"]
            evidence = analysis_by_position.get(key, [])
            recommended = []
            changes = []
            for row in evidence:
                legal = _legal_san(snapshot["board"], row.get("recommendedMove") or row.get("recommended_move"))
                if legal:
                    recommended.append(legal)
                change = _evaluation_change(row)
                if change is not None:
                    changes.append(change)
            positions[(role, key)].append({
                "gameId": _game_id(dict(raw), pgn), "opening": opening, "openingId": opening_id,
                "role": role, "positionIdentity": key, "positionFen": snapshot["positionFen"],
                "moveNumber": snapshot["moveNumber"], "playedMove": snapshot["playedMove"],
                "recommendedMoves": recommended, "evaluationChanges": changes,
                "analysisTrusted": bool(evidence),
            })

    habits = []
    for (role, position_identity), rows in positions.items():
        unique = {row["gameId"]: row for row in rows}
        occurrences = list(unique.values())
        eligible = len(occurrences)
        if eligible < MIN_POSITION_OCCURRENCES:
            continue
        choices = Counter(row["playedMove"] for row in occurrences)
        played_move, occurrence_count = choices.most_common(1)[0]
        mixed = len(choices) >= 2 and choices.most_common(2)[1][1] >= 2 and occurrence_count / eligible < 0.75
        if not mixed and occurrence_count < MIN_REPEATED_MOVE_OCCURRENCES:
            continue
        selected = [row for row in occurrences if row["playedMove"] == played_move]
        analysed = [row for row in selected if row["analysisTrusted"]]
        all_analysed = [row for row in occurrences if row["analysisTrusted"]]
        if len(all_analysed if mixed else analysed) < MIN_ANALYSED_MOVE_OCCURRENCES:
            continue
        recommendations = Counter(move for row in (all_analysed if mixed else analysed) for move in row["recommendedMoves"])
        recommended_move = recommendations.most_common(1)[0][0] if recommendations else None
        changes = [change for row in analysed for change in row["evaluationChanges"]]
        average_change = round(sum(changes) / len(changes), 1) if changes else None
        if mixed:
            habit_type = "MIXED"
        elif average_change is not None and average_change <= -100:
            habit_type = "RECURRING_MISTAKE"
        elif average_change is not None and average_change <= -35:
            habit_type = "RECURRING_INACCURACY"
        elif recommended_move and _clean_san(played_move) != _clean_san(recommended_move):
            habit_type = "RECURRING_INACCURACY"
        elif (recommended_move and _clean_san(played_move) == _clean_san(recommended_move)) or (average_change is not None and average_change >= -20):
            habit_type = "GOOD_HABIT"
        else:
            continue
        representative = sorted(occurrences, key=lambda row: row["gameId"])[0]
        digest = hashlib.sha256(f"{user_id}|{role}|{position_identity}|{played_move}".encode()).hexdigest()[:20]
        evidence_ratio = len(all_analysed if mixed else analysed) / eligible
        confidence_score = round(min(0.95, 0.55 + min(0.2, occurrence_count * 0.025) + min(0.2, evidence_ratio * 0.2)), 2)
        habits.append({
            "habitId": f"opening-habit-{digest}", "habitType": habit_type,
            "positionIdentity": position_identity, "positionFen": representative["positionFen"],
            "role": role, "opening": representative["opening"], "canonicalOpeningId": representative["openingId"],
            "playedMove": played_move, "recommendedMove": recommended_move,
            "occurrenceCount": occurrence_count, "eligibleOccurrenceCount": eligible,
            "averageEvaluationChangeCp": average_change,
            "gameReferences": sorted(row["gameId"] for row in selected),
            "confidence": {"level": "high" if confidence_score >= 0.8 else "moderate", "score": confidence_score, "analysedOccurrences": len(all_analysed if mixed else analysed)},
            "trainingSubjectId": f"opening-position:{role}:{hashlib.sha256(position_identity.encode()).hexdigest()[:16]}",
            "source": "trusted_saved_opening_analysis", "engineEvaluationAvailable": bool(changes),
        })
    priority = {"RECURRING_MISTAKE": 0, "RECURRING_INACCURACY": 1, "MIXED": 2, "GOOD_HABIT": 3}
    habits.sort(key=lambda row: (priority[row["habitType"]], -row["occurrenceCount"], row["trainingSubjectId"]))
    return habits[:max(1, min(30, int(limit or 12)))]
