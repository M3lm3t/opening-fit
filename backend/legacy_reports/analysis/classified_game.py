from __future__ import annotations

import re
from typing import Any, Mapping, TypedDict


DRAW_RESULTS = frozenset({"1/2-1/2", "draw", "agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"})
LOSS_RESULTS = frozenset({"loss", "lose", "checkmated", "resigned", "timeout"})


def canonical_player_result(game: Mapping[str, Any], player_colour: str) -> str:
    """Return a completed result from the analysed player's perspective."""
    colour = str(player_colour or "").strip().lower()
    if colour not in {"white", "black"}:
        return "unknown"
    direct = str(game.get("playerResult") or game.get("player_result") or "").strip().lower()
    if direct in {"win", "draw", "loss"}:
        return direct
    result = str(game.get("result") or game.get("Result") or "").strip().lower()
    if result in DRAW_RESULTS:
        return "draw"
    if result in {"1-0", "0-1"}:
        return "win" if (result == "1-0") == (colour == "white") else "loss"
    winner = str(game.get("winner") or game.get("winnerColour") or game.get("winner_color") or "").strip().lower()
    if winner in {"white", "black"}:
        return "win" if winner == colour else "loss"
    side = game.get(colour)
    side_result = str(side.get("result") if isinstance(side, Mapping) else "").strip().lower()
    if side_result == "win":
        return "win"
    if side_result in DRAW_RESULTS:
        return "draw"
    if side_result in LOSS_RESULTS:
        return "loss"
    return "unknown"


class ClassifiedGameRecord(TypedDict, total=False):
    gameId: str
    url: str
    playerColour: str
    playerResult: str
    timeControl: str
    playedAt: str | None
    eco: str | None
    openingFamily: str
    variation: str | None
    classificationPly: int | None
    playerRole: str
    relationship: str
    exclusionReason: str | None
    canonicalOpeningId: str
    openingDisplayName: str
    classificationSource: str
    matchedOpeningRuleId: str | None
    matchedPlyDepth: int
    matchedMoves: list[str]
    classificationConfidence: float
    firstWhiteMove: str | None
    firstBlackMove: str | None
    ownership: str
    repertoireRoleEligibility: str
    canonicalContextId: str
    classificationContractVersion: int
    classificationConflictReason: str | None


def _slug(value: str, fallback: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-") or fallback


def canonical_player_role(perspective: Mapping[str, Any]) -> str:
    repertoire_role = str(perspective.get("repertoireRole") or "")
    if repertoire_role == "white":
        return "white_repertoire"
    if repertoire_role in {"black_vs_e4", "black_vs_d4"}:
        return repertoire_role
    if str(perspective.get("userColour") or "") == "black":
        return "black_other"
    return "unknown"


def canonical_relationship(perspective: Mapping[str, Any]) -> str:
    relationship = str(perspective.get("relationship") or "")
    if relationship == "played":
        return "played_by_user"
    if relationship == "faced":
        return "faced_by_user"
    return "unknown"


def build_classified_game_record(
    *,
    game_id: str,
    url: str,
    player_colour: str,
    player_result: str,
    time_control: str,
    played_at: str | None,
    eco: str | None,
    opening_family: str,
    variation: str | None,
    classification_ply: int | None,
    perspective: Mapping[str, Any],
    exclusion_reason: str | None = None,
    canonical_opening_id: str | None = None,
    classification_source: str | None = None,
    matched_opening_rule_id: str | None = None,
    matched_moves: list[str] | None = None,
    classification_confidence: float | None = None,
    first_white_move: str | None = None,
    first_black_move: str | None = None,
    classification_conflict_reason: str | None = None,
) -> ClassifiedGameRecord:
    """Create the single attribution record used by counts and aggregates.

    Colour comes from platform player names before this function is called;
    opening names never participate in player-colour attribution.
    """
    player_role = canonical_player_role(perspective)
    ownership = canonical_relationship(perspective)
    opening_id = canonical_opening_id or _slug(opening_family, "unclassified-opening")
    normalised_colour = player_colour if player_colour in {"white", "black"} else "unknown"
    context_id = ":".join((opening_id, normalised_colour, ownership, player_role))
    provenance_supplied = classification_source is not None or matched_opening_rule_id is not None
    record: ClassifiedGameRecord = {
        "gameId": str(game_id),
        "url": str(url or ""),
        "playerColour": normalised_colour,
        "playerResult": player_result if player_result in {"win", "draw", "loss"} else "unknown",
        "timeControl": str(time_control or "unknown"),
        "playedAt": played_at,
        "eco": str(eco).upper() if eco else None,
        "openingFamily": str(opening_family or "Unclassified opening"),
        "variation": str(variation).strip() if variation else None,
        "classificationPly": max(0, int(classification_ply)) if classification_ply is not None else None,
        "playerRole": player_role,
        "relationship": ownership,
        "exclusionReason": exclusion_reason,
    }
    if provenance_supplied:
        depth = max(0, int(classification_ply or 0))
        record.update({
            "canonicalOpeningId": opening_id,
            "openingDisplayName": str(opening_family or "Unclassified opening"),
            "classificationSource": str(classification_source or "unclassified"),
            "matchedOpeningRuleId": str(matched_opening_rule_id) if matched_opening_rule_id else None,
            "matchedPlyDepth": depth,
            "matchedMoves": list(matched_moves or [])[:depth],
            "classificationConfidence": max(0.0, min(1.0, float(classification_confidence or 0))),
            "firstWhiteMove": first_white_move or None,
            "firstBlackMove": first_black_move or None,
            "ownership": ownership,
            "repertoireRoleEligibility": player_role if player_role != "unknown" else "ineligible",
            "canonicalContextId": context_id,
            "classificationContractVersion": 1,
            "classificationConflictReason": classification_conflict_reason or None,
        })
    return record


def opening_context_key(record: Mapping[str, Any]) -> tuple[str, ...]:
    """Keep every aggregate separated by family, colour, role and ownership."""
    if record.get("canonicalContextId"):
        return (str(record["canonicalContextId"]),)
    return (
        str(record.get("openingFamily") or "Unclassified opening"),
        str(record.get("playerColour") or "unknown"),
        str(record.get("playerRole") or "unknown"),
        str(record.get("relationship") or "unknown"),
    )


def record_is_classified(record: Mapping[str, Any]) -> bool:
    name = str(record.get("openingFamily") or "").strip().lower()
    named = bool(name and "unclassified" not in name and name not in {"unknown", "unknown opening"})
    if record.get("classificationContractVersion"):
        return bool(named and record.get("matchedOpeningRuleId") and int(record.get("matchedPlyDepth") or 0) > 0)
    return named


def record_is_used_for_opening_stats(record: Mapping[str, Any]) -> bool:
    return (
        record_is_classified(record)
        and record.get("playerColour") in {"white", "black"}
        and record.get("playerRole") != "unknown"
        and record.get("relationship") in {"played_by_user", "faced_by_user"}
        and not record.get("exclusionReason")
    )
