"""Failure-isolated orchestration for durable Missions after a trusted report."""

from __future__ import annotations

import hashlib
import io
from datetime import datetime, timezone
from typing import Any, Mapping

import chess
import chess.pgn

from .classified_game import record_is_used_for_opening_stats
from .mission_candidates import build_mission_candidates, exact_position_key
from .mission_lifecycle import EncounterEvidence, evidence_transition, summarise_verification_evidence
from .mission_persistence import MissionPersistenceService

ASSIGNABLE_CONFIDENCE = 70.0
VERIFYING_STATUSES = frozenset({"awaiting_evidence", "improving"})


def _dt(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _games(report: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    rows = report.get("opening_games") or report.get("openingGames") or []
    return [row for row in rows if isinstance(row, Mapping)]


def _identity(game: Mapping[str, Any]) -> str:
    return str(game.get("gameId") or game.get("game_id") or game.get("id") or game.get("url") or "").strip()


def _trusted_corrections(report: Mapping[str, Any], games: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    roles: dict[tuple[str, str], set[str]] = {}
    for game in games:
        if not record_is_used_for_opening_stats(game) or game.get("roleAttributionTrusted") is not True:
            continue
        opening = str(game.get("canonicalOpeningId") or game.get("canonical_opening_id") or "").strip()
        side = str(game.get("playerColour") or "").strip().lower()
        role = str(game.get("playerRole") or game.get("repertoireRole") or "").strip()
        if opening and side and role:
            roles.setdefault((opening, side), set()).add(role)
    contracts: list[dict[str, Any]] = []
    for row in report.get("openingTrainingOpportunities") or []:
        if not isinstance(row, Mapping):
            continue
        source = str(row.get("source") or "").strip().lower()
        opening = str(row.get("openingId") or row.get("canonicalOpeningId") or "").strip()
        side = str(row.get("side") or "").strip().lower()
        provenance = str(row.get("opportunityId") or row.get("analysisId") or "").strip()
        move = row.get("recommendedMove")
        for role in sorted(roles.get((opening, side), set())):
            contracts.append({"source": source, "provenance": provenance, "positionFen": row.get("positionFen"),
                              "role": role, "openingId": opening, "acceptedMoves": [move]})
    return contracts


def _encounter(game: Mapping[str, Any], mission: Mapping[str, Any]) -> tuple[str, str] | None:
    if not record_is_used_for_opening_stats(game) or game.get("roleAttributionTrusted") is not True:
        return None
    if str(game.get("playerRole") or game.get("repertoireRole") or "") != str(mission.get("role") or ""):
        return None
    colour_name = str(game.get("playerColour") or "").lower()
    if colour_name not in {"white", "black"}:
        return None
    raw = str(game.get("pgn") or game.get("rawPgn") or game.get("raw_pgn") or "")
    try:
        parsed = chess.pgn.read_game(io.StringIO(raw))
    except Exception:
        return None
    if not parsed:
        return None
    colour = chess.WHITE if colour_name == "white" else chess.BLACK
    board = parsed.board()
    target = str(mission.get("exact_position_key") or "")
    for move in parsed.mainline_moves():
        if board.fullmove_number <= 12 and board.turn == colour and exact_position_key(board) == target:
            return move.uci(), board.san(move)
        board.push(move)
    return None


def _evaluate_lifecycle(user_id: str, repository: Any) -> None:
    service = MissionPersistenceService(repository)
    for mission in repository.list_verifying(user_id, limit=10):
        cutoff = _dt(mission.get("training_completed_at") or mission.get("awaiting_evidence_at") or mission.get("baseline_cutoff_at"))
        if not cutoff:
            continue
        evidence = []
        for row in repository.list_encounters(user_id, mission["id"], limit=100):
            played = _dt(row.get("played_at"))
            if played and row.get("qualifies_for_verification"):
                evidence.append(EncounterEvidence(str(row.get("id")), str(row.get("classification")), played))
        summary = summarise_verification_evidence(evidence, cutoff)
        target = evidence_transition(str(mission["status"]), summary)
        if target:
            counts = {"correct": summary.correct, "repeatedMistake": summary.repeated_mistake,
                      "otherLegal": summary.other_legal, "qualifying": summary.qualifying}
            key = f"encounter-policy:{mission['id']}:{target}:{summary.correct}:{summary.repeated_mistake}:{summary.qualifying}"
            service.transition_mission(user_id=user_id, mission_id=mission["id"], target_status=target,
                                       cause_type="future_game_evidence", idempotency_key=key, evidence_summary=counts)


def process_completed_analysis(*, user_id: str, platform: str, username: str,
                               report: Mapping[str, Any], repository: Any) -> dict[str, int]:
    """Process old missions first, then persist/assign candidates from this report."""
    games = _games(report)
    service = MissionPersistenceService(repository)
    scope = hashlib.sha256(f"{platform.lower()}:{username.strip().lower()}".encode()).hexdigest()[:24]
    encounters = 0
    # Snapshot verifying missions before candidate assignment: baseline imports cannot verify themselves.
    verifying = repository.list_verifying(user_id, limit=10)
    for mission in verifying:
        for game in sorted(games, key=_identity):
            played_at = _dt(game.get("playedAt") or game.get("played_at"))
            game_id = _identity(game)
            found = _encounter(game, mission)
            if found and played_at and game_id:
                service.record_encounter(user_id=user_id, mission_id=mission["id"], platform=platform,
                                         account_scope=scope, game_id=game_id, played_at=played_at,
                                         exact_position_key=mission["exact_position_key"], observed_move_uci=found[0],
                                         observed_move_san=found[1], source_report_id=str(report.get("reportId") or "") or None)
                encounters += 1
    _evaluate_lifecycle(user_id, repository)

    result = build_mission_candidates(games, _trusted_corrections(report, games))
    persisted = []
    cutoff = max((_dt(g.get("playedAt") or g.get("played_at")) for g in games), default=None,
                 key=lambda item: item or datetime.min.replace(tzinfo=timezone.utc))
    for candidate in result["candidates"]:
        persisted.append(service.persist_candidate(user_id=user_id, candidate=candidate,
                                                   references={"source_report_id": report.get("reportId"), "baseline_cutoff_at": cutoff}))
    assigned = 0
    if not service.get_current_mission(user_id):
        candidates = [row for row in repository.list_candidates(user_id, limit=20)
                      if float((row.get("confidence") or {}).get("score") or 0) >= ASSIGNABLE_CONFIDENCE]
        if candidates:
            chosen = candidates[0]
            service.assign_primary_mission(user_id=user_id, mission_id=chosen["id"],
                                           idempotency_key=f"auto-assign:{chosen['candidate_key']}:{chosen['generation']}")
            assigned = 1
    return {"encounters": encounters, "candidates": len(persisted), "assigned": assigned}
