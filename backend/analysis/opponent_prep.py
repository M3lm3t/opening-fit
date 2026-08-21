"""Opponent-preparation summary from canonical public-game evidence only."""

from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from typing import Any, Iterable, Mapping

import chess

from analysis.opening_training_opportunities import (
    OPENING_PHASE_END_MOVE,
    _game_from_pgn,
    _game_id,
    _opening_name,
    _snapshots,
    _text,
    _user_colour,
)


def _games(report: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    seen = set()
    rows = []
    for key in ("analysis_game_index", "analysisGameIndex", "opening_games", "openingGames", "recent_games", "recentGames"):
        for row in report.get(key) or []:
            if not isinstance(row, Mapping):
                continue
            identity = _text(row.get("gameId") or row.get("game_id") or row.get("id") or row.get("url"))
            if identity and identity in seen:
                continue
            if identity:
                seen.add(identity)
            rows.append(row)
    return rows


def _role(colour: bool, parsed: Any) -> str | None:
    if colour == chess.WHITE:
        return "white"
    first = next(iter(parsed.mainline_moves()), None)
    if first:
        san = parsed.board().san(first)
        if san in {"e4", "d4"}:
            return f"black_vs_{san}"
    return None


def build_opponent_prep(report: Mapping[str, Any], *, username: str, platform: str, own_opening_ids: Iterable[str] = ()) -> dict[str, Any]:
    own_ids = {_text(value) for value in own_opening_ids if _text(value)}
    history = report.get("repertoireHistory") or report.get("repertoire_history") or {}
    history_rows = [row for row in history.get("openings", []) if isinstance(row, Mapping)]
    by_role = defaultdict(list)
    for row in history_rows:
        role = _text(row.get("repertoireRole"))
        if role in {"white", "black_vs_e4", "black_vs_d4"}:
            total = max(0, int(row.get("totalEligibleGames") or 0))
            by_role[role].append({
                "canonicalOpeningId": row.get("canonicalOpeningId"), "opening": row.get("opening"),
                "games": total, "frequency": row.get("recentFrequency") if row.get("recentGames") else row.get("historicalFrequency"),
                "recentGames": max(0, int(row.get("recentGames") or 0)),
                "historicalGames": max(0, int(row.get("historicalGames") or 0)),
                "firstSeen": row.get("firstSeen"), "lastSeen": row.get("lastSeen"),
                "intersectsUserRepertoire": _text(row.get("canonicalOpeningId")) in own_ids,
            })
    for rows in by_role.values():
        rows.sort(key=lambda row: (not row["intersectsUserRepertoire"], -row["games"], _text(row["opening"])))

    positions = defaultdict(list)
    for raw in _games(report):
        pgn = _text(raw.get("pgn") or raw.get("rawPgn") or raw.get("raw_pgn"))
        parsed = _game_from_pgn(pgn)
        if not parsed:
            continue
        colour = _user_colour(dict(raw), parsed, username)
        if colour is None:
            continue
        role = _role(colour, parsed)
        opening_id = _text(raw.get("canonicalOpeningId") or raw.get("canonical_opening_id") or raw.get("openingId") or raw.get("opening_id"))
        if role is None or not opening_id:
            continue
        snapshots, sans = _snapshots(parsed, colour)
        opening = _opening_name(dict(raw), parsed, sans)
        for snapshot in snapshots:
            if snapshot["moveNumber"] > OPENING_PHASE_END_MOVE:
                continue
            positions[(role, opening_id, snapshot["positionKey"])].append({
                "gameId": _game_id(dict(raw), pgn), "opening": opening,
                "positionFen": snapshot["positionFen"], "playedMove": snapshot["playedMove"],
            })
    tendencies = []
    for (role, opening_id, position_id), rows in positions.items():
        unique = {row["gameId"]: row for row in rows}
        occurrences = list(unique.values())
        if len(occurrences) < 3:
            continue
        choices = Counter(row["playedMove"] for row in occurrences)
        move, count = choices.most_common(1)[0]
        if count < 2:
            continue
        digest = hashlib.sha256(f"{role}|{position_id}".encode()).hexdigest()[:16]
        representative = sorted(occurrences, key=lambda row: row["gameId"])[0]
        tendencies.append({
            "positionIdentity": position_id, "positionFen": representative["positionFen"],
            "role": role, "canonicalOpeningId": opening_id, "opening": representative["opening"],
            "playedMove": move, "occurrenceCount": count, "eligibleOccurrenceCount": len(occurrences),
            "frequency": round(count / len(occurrences), 4),
            "gameReferences": sorted(row["gameId"] for row in occurrences if row["playedMove"] == move),
            "trainingSubjectId": f"opponent-position:{role}:{digest}",
            "intersectsUserRepertoire": opening_id in own_ids,
            "recommendedMove": None, "engineEvaluationAvailable": False,
        })
    tendencies.sort(key=lambda row: (not row["intersectsUserRepertoire"], -row["occurrenceCount"], row["trainingSubjectId"]))
    analysed = int(report.get("gamesAnalysed") or report.get("gamesAnalyzed") or report.get("gamesImported") or 0)
    return {
        "version": "opponent_prep_v1", "username": username, "platform": platform,
        "gamesAnalysed": analysed, "analysisWindowMonths": int(report.get("monthsChecked") or report.get("months_checked") or 3),
        "likelyWhiteOpenings": by_role["white"][:3],
        "likelyBlackVsE4": by_role["black_vs_e4"][:3],
        "likelyBlackVsD4": by_role["black_vs_d4"][:3],
        "repeatedMoveTendencies": tendencies[:8], "candidatePreparationPositions": tendencies[:3],
        "prioritisedByUserRepertoire": bool(own_ids),
        "engineAnalysisRan": False,
        "methodology": "Public games were classified with OpeningFit's canonical opening and position contracts. No engine preparation was claimed or generated.",
    }
