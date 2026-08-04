from __future__ import annotations

from enum import Enum
from typing import Any, Mapping, TypedDict
import unicodedata
import re
from collections import Counter


class RepertoireRole(str, Enum):
    WHITE = "white"
    BLACK_VS_E4 = "black_vs_e4"
    BLACK_VS_D4 = "black_vs_d4"
    UNRESOLVED = "unresolved"


class OpeningRole(str, Enum):
    PLAYED_AS_WHITE = "played_as_white"
    PLAYED_AS_BLACK = "played_as_black"
    FACED_AS_WHITE = "faced_as_white"
    FACED_AS_BLACK = "faced_as_black"
    UNKNOWN = "unknown_mixed"


class OpeningRelationship(str, Enum):
    PLAYED = "played"
    FACED = "faced"
    UNKNOWN = "unknown"


class OpeningPerspective(TypedDict):
    userColour: str
    openingSide: str | None
    role: str
    relationship: str
    repertoireOwned: bool
    repertoireSlot: str | None
    repertoireRole: str
    roleAttributionTrusted: bool
    attributionReasonCode: str | None
    opponentPreparation: bool
    label: str
    classificationSource: str


def black_repertoire_slot(first_white_move: str) -> str:
    move = str(first_white_move or "").strip().rstrip("+#?!")
    if move.startswith("1."):
        move = move[2:].strip()
    if move == "e4":
        return "black_vs_e4"
    if move == "d4":
        return "black_vs_d4"
    return RepertoireRole.UNRESOLVED.value


def normalise_player_identifier(value: Any) -> str:
    """Normalise public-platform usernames without guessing account ownership."""
    return unicodedata.normalize("NFKC", str(value or "")).strip().casefold()


def player_colour_from_names(username: Any, white_username: Any, black_username: Any) -> tuple[str, str | None]:
    user = normalise_player_identifier(username)
    white = normalise_player_identifier(white_username)
    black = normalise_player_identifier(black_username)
    if not user:
        return "unknown", "analysed_username_missing"
    white_match = bool(white and white == user)
    black_match = bool(black and black == user)
    if white_match == black_match:
        return "unknown", "player_colour_ambiguous" if white_match else "analysed_username_not_found"
    return ("white", None) if white_match else ("black", None)


def _pgn_header(game: Mapping[str, Any], colour: str) -> str:
    match = re.search(rf'^\[{colour.title()}\s+"([^"]+)"\]', str(game.get("pgn") or ""), re.MULTILINE)
    return match.group(1) if match else ""


def _player_identifier_candidates(game: Mapping[str, Any], colour: str) -> tuple[list[tuple[str, str]], bool]:
    """Read supported identifiers in precedence order without using unrelated display fields."""
    players = game.get("players") if isinstance(game.get("players"), Mapping) else {}
    values: list[tuple[str, Any]] = []
    malformed = False
    for source, raw in (("side", game.get(colour)), ("players", players.get(colour))):
        if raw is not None and not isinstance(raw, (str, Mapping)):
            malformed = True
            continue
        if isinstance(raw, Mapping):
            user = raw.get("user") if isinstance(raw.get("user"), Mapping) else {}
            values.extend([(f"{source}.username", raw.get("username")), (f"{source}.name", raw.get("name")), (f"{source}.userId", raw.get("userId")), (f"{source}.user.name", user.get("name")), (f"{source}.user.id", user.get("id"))])
        elif isinstance(raw, str):
            values.append((source, raw))
    values.extend([
        ("flattened_username", game.get(f"{colour}_username") or game.get(f"{colour}Username")),
        ("flattened_name", game.get(f"{colour}_name") or game.get(f"{colour}Name")),
        ("pgn_header", _pgn_header(game, colour)),
    ])
    candidates, seen = [], set()
    for source, value in values:
        identifier = normalise_player_identifier(value)
        if identifier and identifier not in seen:
            seen.add(identifier)
            candidates.append((source, identifier))
    return candidates, malformed


def player_colour_from_game(username: Any, game: Mapping[str, Any]) -> tuple[str, str | None]:
    """Resolve colour from raw Chess.com/Lichess or canonical imported records."""
    user = normalise_player_identifier(username)
    white, white_malformed = _player_identifier_candidates(game, "white")
    black, black_malformed = _player_identifier_candidates(game, "black")
    if len(white) > 1 or len(black) > 1:
        return "unknown", "player_identifier_conflict"
    white_match = any(value == user for _source, value in white)
    black_match = any(value == user for _source, value in black)
    if white_match and black_match:
        return "unknown", "player_identifier_conflict"
    if white_match:
        return "white", None
    if black_match:
        return "black", None
    if white or black:
        return "unknown", "analysed_username_not_found"
    explicit = str(game.get("playerColour") or game.get("player_colour") or "").strip().lower()
    if explicit in {"white", "black"}:
        return explicit, None
    if white_malformed or black_malformed:
        return "unknown", "player_data_malformed"
    return "unknown", "player_data_missing"


def attribution_diagnostic(username: Any, game: Mapping[str, Any], platform: str = "unknown") -> dict[str, Any]:
    """Privacy-safe structural detail: never includes usernames, opponents, URLs or PGN."""
    white, white_malformed = _player_identifier_candidates(game, "white")
    black, black_malformed = _player_identifier_candidates(game, "black")
    colour, reason = player_colour_from_game(username, game)
    return {
        "platform": str(platform or "unknown"),
        "schemaVariant": "players_nested" if isinstance(game.get("players"), Mapping) else "side_nested" if isinstance(game.get("white"), Mapping) or isinstance(game.get("black"), Mapping) else "flattened_or_canonical",
        "whiteIdentifierPresent": bool(white), "blackIdentifierPresent": bool(black),
        "requestedUsernameMatched": colour in {"white", "black"},
        "candidateIdentifierCount": len(white) + len(black), "failureReasonCode": reason,
        "hasPgnHeaders": bool(_pgn_header(game, "white") or _pgn_header(game, "black")),
        "hasNestedPlayers": isinstance(game.get("players"), Mapping),
        "hasFlattenedUsernames": bool(game.get("white_username") or game.get("whiteUsername") or game.get("black_username") or game.get("blackUsername")),
        "malformedPlayerShape": white_malformed or black_malformed,
    }


def summarise_attribution_diagnostics(games: list[Mapping[str, Any]]) -> dict[str, Any]:
    """Aggregate only categorical reason/schema counts for operator-safe output."""
    diagnostics = [game.get("attributionDiagnostic") for game in games if isinstance(game.get("attributionDiagnostic"), Mapping)]
    failures = [item for item in diagnostics if item.get("failureReasonCode")]
    return {
        "totalChecked": len(diagnostics),
        "attributed": len(diagnostics) - len(failures),
        "failed": len(failures),
        "reasonCounts": dict(sorted(Counter(str(item.get("failureReasonCode")) for item in failures).items())),
        "schemaVariantCounts": dict(sorted(Counter(str(item.get("schemaVariant")) for item in diagnostics).items())),
    }


def first_white_move_from_item(item: Mapping[str, Any]) -> str:
    explicit = item.get("firstWhiteMove") or item.get("first_white_move")
    if explicit:
        return str(explicit).strip().rstrip("+#?!")
    moves = item.get("moves")
    if isinstance(moves, list) and moves:
        return str(moves[0]).strip().rstrip("+#?!")
    if isinstance(moves, str) and moves.strip():
        return moves.split()[0].strip().rstrip("+#?!")
    body = "\n".join(line for line in str(item.get("pgn") or "").splitlines() if not line.strip().startswith("["))
    body = re.sub(r"\{[^}]*\}|\([^)]*\)|\$\d+", " ", body)
    for token in body.split():
        clean = re.sub(r"^\d+\.(\.\.)?", "", token).strip().rstrip("+#?!")
        if clean and clean not in {"1-0", "0-1", "1/2-1/2", "*"}:
            return clean
    return ""


def validate_repertoire_role_for_game(role: str, game: Mapping[str, Any]) -> tuple[bool, str | None]:
    """Validate a role from retained player colour and moves, never an opening label."""
    stored = game.get("perspective") if isinstance(game.get("perspective"), Mapping) else {}
    colour = str(game.get("playerColour") or game.get("player_colour") or stored.get("userColour") or stored.get("user_colour") or "").lower()
    relationship = str(game.get("relationship") or stored.get("relationship") or "").lower()
    if relationship not in {"played", "played_by_user"}:
        return False, "supporting_game_not_played_by_user"
    expected, reason = canonical_repertoire_role(colour, first_white_move_from_item(game))
    return (True, None) if expected == role else (False, reason or "supporting_game_role_mismatch")


def canonical_repertoire_role(user_colour: str, first_white_move: str = "") -> tuple[str, str | None]:
    colour = str(user_colour or "").strip().lower()
    if colour == "white":
        return RepertoireRole.WHITE.value, None
    if colour != "black":
        return RepertoireRole.UNRESOLVED.value, "player_colour_unresolved"
    role = black_repertoire_slot(first_white_move)
    if role == RepertoireRole.UNRESOLVED.value:
        return role, "opponent_first_move_unresolved"
    return role, None


def classify_opening_perspective(
    *,
    user_colour: str,
    opening_side: str | None,
    first_white_move: str = "",
    classification_source: str = "move_sequence_or_opening_metadata",
) -> OpeningPerspective:
    user = str(user_colour or "").lower()
    side = str(opening_side or "").lower() or None
    role = OpeningRole.UNKNOWN
    relationship = OpeningRelationship.UNKNOWN
    repertoire_slot = None
    repertoire_role, role_reason = canonical_repertoire_role(user, first_white_move)

    if user == "white" and side == "white":
        role = OpeningRole.PLAYED_AS_WHITE
        relationship = OpeningRelationship.PLAYED
        repertoire_slot = "white"
    elif user == "black" and side == "black":
        role = OpeningRole.PLAYED_AS_BLACK
        relationship = OpeningRelationship.PLAYED
        repertoire_slot = repertoire_role if repertoire_role != RepertoireRole.UNRESOLVED.value else None
    elif user == "white" and side == "black":
        role = OpeningRole.FACED_AS_WHITE
        relationship = OpeningRelationship.FACED
    elif user == "black" and side == "white":
        role = OpeningRole.FACED_AS_BLACK
        relationship = OpeningRelationship.FACED

    labels = {
        OpeningRole.PLAYED_AS_WHITE: "played by you as White",
        OpeningRole.PLAYED_AS_BLACK: "played by you as Black",
        OpeningRole.FACED_AS_WHITE: "faced by you as White",
        OpeningRole.FACED_AS_BLACK: "faced by you as Black",
        OpeningRole.UNKNOWN: "ownership unresolved",
    }
    trusted = repertoire_role != RepertoireRole.UNRESOLVED.value and side in {"white", "black"}
    attribution_reason = role_reason if role_reason else None if trusted else "opening_side_unresolved"
    return {
        "userColour": user if user in {"white", "black"} else "unknown",
        "openingSide": side if side in {"white", "black"} else None,
        "role": role.value,
        "relationship": relationship.value,
        "repertoireOwned": relationship is OpeningRelationship.PLAYED,
        "repertoireSlot": repertoire_slot,
        "repertoireRole": repertoire_role,
        "roleAttributionTrusted": trusted,
        "attributionReasonCode": attribution_reason,
        "opponentPreparation": relationship is OpeningRelationship.FACED,
        "label": labels[role],
        "classificationSource": classification_source,
    }


def perspective_from_item(item: Mapping[str, Any]) -> OpeningPerspective:
    """Read current records and conservatively adapt older stored reports."""
    explicit = item.get("perspective")
    if isinstance(explicit, Mapping) and explicit.get("role"):
        stored = dict(explicit)
        opening_side = stored.get("openingSide") or stored.get("opening_side")
        repertoire_role = str(stored.get("repertoireRole") or stored.get("repertoire_role") or stored.get("repertoireSlot") or stored.get("repertoire_slot") or "")
        if repertoire_role not in {member.value for member in RepertoireRole}:
            repertoire_role, reason = canonical_repertoire_role(str(stored.get("userColour") or stored.get("user_colour") or ""), str(item.get("firstWhiteMove") or item.get("first_white_move") or ""))
            stored["attributionReasonCode"] = stored.get("attributionReasonCode") or reason or "legacy_role_unresolved"
        stored["repertoireRole"] = repertoire_role
        stored["roleAttributionTrusted"] = bool(stored.get("roleAttributionTrusted", stored.get("role_attribution_trusted", repertoire_role != RepertoireRole.UNRESOLVED.value and opening_side in {"white", "black"})))
        stored.setdefault("attributionReasonCode", None if stored["roleAttributionTrusted"] else "legacy_role_unresolved")
        return stored  # type: ignore[return-value]

    role = str(item.get("role") or item.get("openingRole") or item.get("opening_role") or "")
    if role in {member.value for member in OpeningRole}:
        user_colour = str(item.get("userColour") or item.get("user_colour") or item.get("colour") or item.get("color") or "unknown")
        relationship = "played" if role.startswith("played_") else "faced" if role.startswith("faced_") else "unknown"
        slot = item.get("repertoireSlot") or item.get("repertoire_slot")
        repertoire_role = str(item.get("repertoireRole") or item.get("repertoire_role") or slot or "")
        if repertoire_role not in {member.value for member in RepertoireRole}:
            repertoire_role, _reason = canonical_repertoire_role(user_colour, str(item.get("firstWhiteMove") or item.get("first_white_move") or ""))
        opening_side = item.get("openingSide") or item.get("opening_side")
        trusted = bool(item.get("roleAttributionTrusted", item.get("role_attribution_trusted", repertoire_role != RepertoireRole.UNRESOLVED.value and opening_side in {"white", "black"})))
        return {
            "userColour": user_colour,
            "openingSide": opening_side,
            "role": role,
            "relationship": relationship,
            "repertoireOwned": relationship == "played",
            "repertoireSlot": str(slot) if slot else None,
            "repertoireRole": repertoire_role,
            "roleAttributionTrusted": trusted,
            "attributionReasonCode": item.get("attributionReasonCode") or item.get("attribution_reason_code") or (None if trusted else "legacy_role_unresolved"),
            "opponentPreparation": relationship == "faced",
            "label": str(item.get("roleLabel") or item.get("role_label") or role.replace("_", " ")),
            "classificationSource": str(item.get("classificationSource") or item.get("classification_source") or "stored_explicit_role"),
        }

    # Legacy contexts do not prove ownership.  Do not revive the former
    # opening-name heuristic; retain colour for display and mark ownership
    # unresolved until a new analysis can classify the move sequence.
    colour = str(item.get("colour") or item.get("color") or "unknown").lower()
    return classify_opening_perspective(
        user_colour=colour,
        opening_side=None,
        classification_source="legacy_unresolved",
    )


def attach_perspective(item: Mapping[str, Any], perspective: OpeningPerspective) -> dict[str, Any]:
    return {
        **dict(item),
        "perspective": dict(perspective),
        "openingRole": perspective["role"],
        "opening_role": perspective["role"],
        "relationship": perspective["relationship"],
        "repertoireOwned": perspective["repertoireOwned"],
        "repertoire_owned": perspective["repertoireOwned"],
        "repertoireSlot": perspective["repertoireSlot"],
        "repertoire_slot": perspective["repertoireSlot"],
        "repertoireRole": perspective["repertoireRole"],
        "repertoire_role": perspective["repertoireRole"],
        "roleAttributionTrusted": perspective["roleAttributionTrusted"],
        "role_attribution_trusted": perspective["roleAttributionTrusted"],
        "attributionReasonCode": perspective["attributionReasonCode"],
        "attribution_reason_code": perspective["attributionReasonCode"],
        "openingSide": perspective["openingSide"],
        "opening_side": perspective["openingSide"],
        "roleLabel": perspective["label"],
        "role_label": perspective["label"],
    }
