"""Deterministic Phase 1 OpeningFit Mission candidates.

The generator accepts canonical classified-game records carrying PGN evidence and
explicit trusted correction contracts.  It never infers player colour or role,
uses the first four FEN fields as exact legal-position identity, and validates
every correction with python-chess.  Phase 1 is intentionally limited to
move-level repairs and repertoire deviations; population claims, strategic-plan
missions, database state, HTTP concerns, and unsourced engine advice are outside
this module.
"""

from __future__ import annotations

import hashlib
import io
import json
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Iterable, Mapping, Sequence, TypedDict

import chess
import chess.pgn

try:
    from analysis.classified_game import record_is_used_for_opening_stats
    from analysis.opening_training_opportunities import OPENING_PHASE_END_MOVE, _normalised_position
except ModuleNotFoundError:  # pragma: no cover - package-style imports
    from backend.analysis.classified_game import record_is_used_for_opening_stats
    from backend.analysis.opening_training_opportunities import OPENING_PHASE_END_MOVE, _normalised_position


MISSIONS_CANDIDATE_ALGORITHM_VERSION = "missions_candidate_v1"
TRUSTED_CORRECTION_SOURCES = frozenset({
    "active_repertoire_line",
    "opening_reference_line",
    "opening_pack_continuation",
    "canonical_report_decision",
})


class MissionCandidate(TypedDict):
    candidateId: str
    candidateKey: str
    algorithmVersion: str
    missionType: str
    role: str
    canonicalOpeningId: str
    openingName: str
    exactPositionKey: str
    positionFen: str
    playerTurn: str
    repeatedPlayedMove: dict[str, str]
    acceptedCorrectionMoves: list[dict[str, str]]
    correctionSource: str
    correctionProvenance: list[dict[str, str]]
    distinctEvidenceGameIds: list[str]
    evidenceCount: int
    firstSeenAt: str | None
    lastSeenAt: str | None
    score: float
    scoreComponents: dict[str, float]
    confidence: dict[str, Any]
    confidenceReasonCodes: list[str]
    conflicts: list[str]
    eligibility: str
    ineligibilityReasonCodes: list[str]


class MissionCandidateResult(TypedDict):
    algorithmVersion: str
    candidates: list[MissionCandidate]
    excludedCandidates: list[dict[str, Any]]
    exclusionReasons: dict[str, int]
    accounting: dict[str, int]


def exact_position_key(board_or_fen: chess.Board | str) -> str:
    """Return piece/turn/castling/legal-en-passant identity, excluding clocks."""
    return _normalised_position(board_or_fen)


def _text(value: Any) -> str:
    return str(value or "").strip()


def _parse_time(value: Any) -> tuple[float, str] | None:
    raw = _text(value)
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.timestamp(), raw
    except (TypeError, ValueError):
        return None


def _game_id(game: Mapping[str, Any]) -> str:
    return _text(game.get("gameId") or game.get("game_id") or game.get("id") or game.get("url"))


def _role(game: Mapping[str, Any]) -> str:
    return _text(game.get("playerRole") or game.get("repertoireRole"))


def _opening_id(game: Mapping[str, Any]) -> str:
    return _text(game.get("canonicalOpeningId") or game.get("canonical_opening_id"))


def _trusted_record(game: Mapping[str, Any]) -> tuple[bool, str | None]:
    if not record_is_used_for_opening_stats(game):
        return False, "canonical_record_ineligible"
    if game.get("roleAttributionTrusted") is not True:
        return False, "role_attribution_untrusted"
    role = _role(game)
    if not role or role == "unknown" or _text(game.get("repertoireRoleEligibility")) in {"", "ineligible"}:
        return False, "repertoire_role_untrusted"
    if game.get("classificationConflictReason"):
        return False, "classification_conflict"
    return True, None


def _observations(game: Mapping[str, Any]) -> list[dict[str, Any]]:
    pgn = _text(game.get("pgn") or game.get("rawPgn") or game.get("raw_pgn"))
    colour_name = _text(game.get("playerColour")).lower()
    if not pgn or colour_name not in {"white", "black"}:
        return []
    try:
        parsed = chess.pgn.read_game(io.StringIO(pgn))
    except Exception:
        return []
    if not parsed:
        return []
    colour = chess.WHITE if colour_name == "white" else chess.BLACK
    board = parsed.board()
    rows: list[dict[str, Any]] = []
    for ply, move in enumerate(parsed.mainline_moves()):
        if board.turn == colour and board.fullmove_number <= OPENING_PHASE_END_MOVE:
            rows.append({
                "gameId": _game_id(game),
                "role": _role(game),
                "openingId": _opening_id(game),
                "openingName": _text(game.get("openingDisplayName") or game.get("openingFamily")),
                "positionKey": exact_position_key(board),
                "positionFen": board.fen(),
                "playerTurn": colour_name,
                "playedSan": board.san(move),
                "playedUci": move.uci(),
                "fullmove": board.fullmove_number,
                "playedAt": _parse_time(game.get("playedAt") or game.get("played_at")),
                "classificationConfidence": max(0.0, min(1.0, float(game.get("classificationConfidence") or 0.0))),
            })
        board.push(move)
    return rows


def _source_contracts(sources: Iterable[Mapping[str, Any]]) -> dict[tuple[str, str, str], list[dict[str, Any]]]:
    indexed: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for raw in sources or []:
        source = _text(raw.get("source") or raw.get("correctionSource")).lower()
        provenance = _text(raw.get("provenance") or raw.get("correctionProvenance"))
        position_key = exact_position_key(_text(raw.get("exactPositionKey") or raw.get("positionKey") or raw.get("positionFen")))
        role = _text(raw.get("role") or raw.get("repertoireRole"))
        opening_id = _text(raw.get("canonicalOpeningId") or raw.get("openingId"))
        moves = raw.get("acceptedMoves") or raw.get("acceptedCorrectionMoves") or raw.get("moves") or []
        if isinstance(moves, str):
            moves = [moves]
        if source not in TRUSTED_CORRECTION_SOURCES or not provenance or not position_key or not role or not opening_id:
            continue
        try:
            board = chess.Board(_text(raw.get("positionFen")) or position_key + " 0 1")
        except ValueError:
            continue
        legal: list[dict[str, str]] = []
        for value in moves if isinstance(moves, Sequence) else []:
            supplied = _text(value.get("uci") or value.get("san")) if isinstance(value, Mapping) else _text(value)
            try:
                move = chess.Move.from_uci(supplied) if len(supplied) in {4, 5} else board.parse_san(supplied)
                if move not in board.legal_moves:
                    continue
                item = {"uci": move.uci(), "san": board.san(move)}
                if item not in legal:
                    legal.append(item)
            except (ValueError, AssertionError):
                continue
        if legal:
            indexed[(role, opening_id, position_key)].append({
                "source": source,
                "provenance": provenance,
                "moves": sorted(legal, key=lambda row: (row["uci"], row["san"])),
            })
    return indexed


def _stable_identity(payload: Mapping[str, Any]) -> tuple[str, str]:
    serialised = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    digest = hashlib.sha256(serialised.encode("utf-8")).hexdigest()
    return f"{MISSIONS_CANDIDATE_ALGORITHM_VERSION}:{digest}", f"mission-candidate-{digest[:20]}"


def _bounded(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)


def _score_components(rows: list[dict[str, Any]], role_opening_games: int, source: str) -> tuple[dict[str, float], list[str]]:
    count = len(rows)
    frequency = _bounded(count * 100 / 8)
    severity = _bounded((70 if source == "active_repertoire_line" else 60) + min(15, max(0, count - 2) * 5))
    dated = sorted({datetime.fromtimestamp(row["playedAt"][0]).strftime("%Y-%m") for row in rows if row["playedAt"]})
    recurrence = _bounded(count * 12.5 + max(0, len(dated) - 1) * 10)
    future_likelihood = _bounded(count * 100 / max(1, role_opening_games))
    classification = sum(row["classificationConfidence"] for row in rows) * 100 / count
    source_quality = {"active_repertoire_line": 100, "opening_pack_continuation": 92, "opening_reference_line": 88, "canonical_report_decision": 90}[source]
    sample = min(100, count * 20)
    confidence = _bounded(0.25 * 100 + 0.20 * classification + 0.20 * 100 + 0.20 * source_quality + 0.15 * sample)
    reasons = ["canonical_attribution_trusted", "exact_position_match", f"trusted_source:{source}"]
    reasons.append("minimum_distinct_evidence" if count == 2 else "repeated_distinct_evidence")
    if not dated:
        reasons.append("timestamps_unavailable")
    return {
        "frequency": frequency,
        "severity": severity,
        "recurrence": recurrence,
        "futureLikelihood": future_likelihood,
        "confidence": confidence,
    }, reasons


def build_mission_candidates(
    canonical_games: Iterable[Mapping[str, Any]],
    trusted_corrections: Iterable[Mapping[str, Any]],
    *,
    systemic_failure: bool = False,
) -> MissionCandidateResult:
    """Build ranked Phase 1 candidates without IO or mutable global state."""
    received = [game for game in canonical_games or [] if isinstance(game, Mapping)]
    reasons: Counter[str] = Counter()
    duplicate_buckets: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for game in received:
        identity = _game_id(game)
        if not identity:
            reasons["missing_game_identity"] += 1
            continue
        duplicate_buckets[identity].append(game)
    unique: dict[str, Mapping[str, Any]] = {}
    for identity, rows in duplicate_buckets.items():
        if len(rows) > 1:
            reasons["duplicate_game_identity"] += len(rows) - 1
        # Duplicate platform IDs are one game.  Select a representation by
        # canonical content rather than arrival order so permutations agree.
        unique[identity] = min(
            rows,
            key=lambda row: json.dumps(dict(row), sort_keys=True, separators=(",", ":"), default=str),
        )

    eligible_games: list[Mapping[str, Any]] = []
    for game in unique.values():
        trusted, reason = _trusted_record(game)
        if systemic_failure:
            trusted, reason = False, "systemic_attribution_failure"
        if trusted:
            eligible_games.append(game)
        else:
            reasons[reason or "canonical_record_ineligible"] += 1

    observations = [row for game in eligible_games for row in _observations(game)]
    positions = defaultdict(list)
    for row in observations:
        positions[(row["role"], row["openingId"], row["positionKey"], row["playedUci"])].append(row)
    role_opening_counts = Counter((_role(game), _opening_id(game)) for game in eligible_games)
    corrections = _source_contracts(trusted_corrections)
    candidates: list[MissionCandidate] = []
    excluded: list[dict[str, Any]] = []
    repeated_position_keys = {key[:3] for key, rows in positions.items() if len({row["gameId"] for row in rows}) >= 2}

    for group_key in sorted(positions):
        role, opening_id, position_key, played_uci = group_key
        rows_by_game = {row["gameId"]: row for row in positions[group_key]}
        rows = [rows_by_game[key] for key in sorted(rows_by_game)]
        if len(rows) < 2:
            continue
        contracts = corrections.get((role, opening_id, position_key), [])
        exclusion_codes: list[str] = []
        if not contracts:
            exclusion_codes.append("trusted_correction_missing")
        move_sets = {tuple(move["uci"] for move in contract["moves"]) for contract in contracts}
        if len(move_sets) > 1:
            exclusion_codes.append("trusted_correction_conflict")
        accepted = contracts[0]["moves"] if contracts and len(move_sets) == 1 else []
        if any(move["uci"] == played_uci for move in accepted):
            exclusion_codes.append("played_move_matches_correction")
        if exclusion_codes:
            for code in exclusion_codes:
                reasons[code] += 1
            excluded.append({
                "role": role, "canonicalOpeningId": opening_id, "exactPositionKey": position_key,
                "evidenceCount": len(rows), "reasonCodes": sorted(exclusion_codes),
            })
            continue

        source_names = sorted({contract["source"] for contract in contracts})
        primary_source = "active_repertoire_line" if "active_repertoire_line" in source_names else source_names[0]
        mission_type = "repertoire_deviation" if primary_source == "active_repertoire_line" else "concrete_move_repair"
        identity_payload = {
            "algorithmVersion": MISSIONS_CANDIDATE_ALGORITHM_VERSION,
            "missionType": mission_type,
            "role": role,
            "positionKey": position_key,
            "playedMoveUci": played_uci,
            "acceptedMoveUcis": sorted(move["uci"] for move in accepted),
            "correctionSources": source_names,
        }
        candidate_key, candidate_id = _stable_identity(identity_payload)
        components, confidence_reasons = _score_components(rows, role_opening_counts[(role, opening_id)], primary_source)
        score = _bounded(
            0.30 * components["frequency"] + 0.25 * components["severity"]
            + 0.15 * components["recurrence"] + 0.15 * components["futureLikelihood"]
            + 0.15 * components["confidence"]
        )
        dates = sorted((row["playedAt"] for row in rows if row["playedAt"]), key=lambda item: item[0])
        candidate: MissionCandidate = {
            "candidateId": candidate_id,
            "candidateKey": candidate_key,
            "algorithmVersion": MISSIONS_CANDIDATE_ALGORITHM_VERSION,
            "missionType": mission_type,
            "role": role,
            "canonicalOpeningId": opening_id,
            "openingName": rows[0]["openingName"],
            "exactPositionKey": position_key,
            "positionFen": rows[0]["positionFen"],
            "playerTurn": rows[0]["playerTurn"],
            "repeatedPlayedMove": {"uci": played_uci, "san": rows[0]["playedSan"]},
            "acceptedCorrectionMoves": accepted,
            "correctionSource": primary_source,
            "correctionProvenance": sorted(
                ({"source": contract["source"], "provenance": contract["provenance"]} for contract in contracts),
                key=lambda item: (item["source"], item["provenance"]),
            ),
            "distinctEvidenceGameIds": sorted(rows_by_game),
            "evidenceCount": len(rows),
            "firstSeenAt": dates[0][1] if dates else None,
            "lastSeenAt": dates[-1][1] if dates else None,
            "score": score,
            "scoreComponents": components,
            "confidence": {
                "score": components["confidence"],
                "level": "low" if len(rows) == 2 else "high" if components["confidence"] >= 85 and len(rows) >= 5 else "medium",
            },
            "confidenceReasonCodes": confidence_reasons,
            "conflicts": [],
            "eligibility": "eligible",
            "ineligibilityReasonCodes": [],
        }
        candidates.append(candidate)

    candidates.sort(key=lambda row: (
        -float(row["scoreComponents"]["confidence"]),
        -row["evidenceCount"],
        -(float(_parse_time(row["lastSeenAt"])[0]) if row["lastSeenAt"] and _parse_time(row["lastSeenAt"]) else float("-inf")),
        row["candidateKey"],
    ))
    return {
        "algorithmVersion": MISSIONS_CANDIDATE_ALGORITHM_VERSION,
        "candidates": candidates,
        "excludedCandidates": sorted(excluded, key=lambda row: (row["role"], row["canonicalOpeningId"], row["exactPositionKey"])),
        "exclusionReasons": dict(sorted(reasons.items())),
        "accounting": {
            "canonicalRecordsReceived": len(received),
            "uniqueCanonicalRecords": len(unique),
            "recordsWithoutIdentity": reasons["missing_game_identity"],
            "eligibleAttributedRecords": len(eligible_games),
            "excludedRecords": len(unique) - len(eligible_games),
            "duplicateIdentities": reasons["duplicate_game_identity"],
            "positionsExamined": len({(row["role"], row["openingId"], row["positionKey"]) for row in observations}),
            "repeatedPositionGroups": len(repeated_position_keys),
            "candidatesGenerated": len(candidates),
            "candidatesExcluded": len(excluded),
        },
    }
