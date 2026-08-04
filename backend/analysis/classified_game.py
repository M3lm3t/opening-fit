from __future__ import annotations

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


class ClassifiedGameRecord(TypedDict):
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
) -> ClassifiedGameRecord:
    """Create the single attribution record used by counts and aggregates.

    Colour comes from platform player names before this function is called;
    opening names never participate in player-colour attribution.
    """
    return {
        "gameId": str(game_id),
        "url": str(url or ""),
        "playerColour": player_colour if player_colour in {"white", "black"} else "unknown",
        "playerResult": player_result if player_result in {"win", "draw", "loss"} else "unknown",
        "timeControl": str(time_control or "unknown"),
        "playedAt": played_at,
        "eco": str(eco).upper() if eco else None,
        "openingFamily": str(opening_family or "Unclassified opening"),
        "variation": str(variation).strip() if variation else None,
        "classificationPly": max(0, int(classification_ply)) if classification_ply is not None else None,
        "playerRole": canonical_player_role(perspective),
        "relationship": canonical_relationship(perspective),
        "exclusionReason": exclusion_reason,
    }


def opening_context_key(record: Mapping[str, Any]) -> tuple[str, str, str, str]:
    """Keep every aggregate separated by family, colour, role and ownership."""
    return (
        str(record.get("openingFamily") or "Unclassified opening"),
        str(record.get("playerColour") or "unknown"),
        str(record.get("playerRole") or "unknown"),
        str(record.get("relationship") or "unknown"),
    )


def record_is_classified(record: Mapping[str, Any]) -> bool:
    name = str(record.get("openingFamily") or "").strip().lower()
    return bool(name and "unclassified" not in name and name not in {"unknown", "unknown opening"})


def record_is_used_for_opening_stats(record: Mapping[str, Any]) -> bool:
    return (
        record_is_classified(record)
        and record.get("playerColour") in {"white", "black"}
        and record.get("playerRole") != "unknown"
        and record.get("relationship") in {"played_by_user", "faced_by_user"}
        and not record.get("exclusionReason")
    )
