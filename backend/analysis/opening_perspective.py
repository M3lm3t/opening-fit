from __future__ import annotations

from enum import Enum
from typing import Any, Mapping, TypedDict


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
    opponentPreparation: bool
    label: str
    classificationSource: str


def black_repertoire_slot(first_white_move: str) -> str:
    move = str(first_white_move or "").strip().rstrip("+#?!")
    if move == "e4":
        return "black_vs_e4"
    if move == "d4":
        return "black_vs_d4"
    if move in {"c4", "Nf3", "g3", "b3"}:
        return "black_vs_other"
    return "black_vs_other"


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

    if user == "white" and side == "white":
        role = OpeningRole.PLAYED_AS_WHITE
        relationship = OpeningRelationship.PLAYED
        repertoire_slot = "white"
    elif user == "black" and side == "black":
        role = OpeningRole.PLAYED_AS_BLACK
        relationship = OpeningRelationship.PLAYED
        repertoire_slot = black_repertoire_slot(first_white_move)
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
    return {
        "userColour": user if user in {"white", "black"} else "unknown",
        "openingSide": side if side in {"white", "black"} else None,
        "role": role.value,
        "relationship": relationship.value,
        "repertoireOwned": relationship is OpeningRelationship.PLAYED,
        "repertoireSlot": repertoire_slot,
        "opponentPreparation": relationship is OpeningRelationship.FACED,
        "label": labels[role],
        "classificationSource": classification_source,
    }


def perspective_from_item(item: Mapping[str, Any]) -> OpeningPerspective:
    """Read current records and conservatively adapt older stored reports."""
    explicit = item.get("perspective")
    if isinstance(explicit, Mapping) and explicit.get("role"):
        return dict(explicit)  # type: ignore[return-value]

    role = str(item.get("role") or item.get("openingRole") or item.get("opening_role") or "")
    if role in {member.value for member in OpeningRole}:
        user_colour = str(item.get("userColour") or item.get("user_colour") or item.get("colour") or item.get("color") or "unknown")
        relationship = "played" if role.startswith("played_") else "faced" if role.startswith("faced_") else "unknown"
        slot = item.get("repertoireSlot") or item.get("repertoire_slot")
        return {
            "userColour": user_colour,
            "openingSide": item.get("openingSide") or item.get("opening_side"),
            "role": role,
            "relationship": relationship,
            "repertoireOwned": relationship == "played",
            "repertoireSlot": str(slot) if slot else None,
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
        "openingSide": perspective["openingSide"],
        "opening_side": perspective["openingSide"],
        "roleLabel": perspective["label"],
        "role_label": perspective["label"],
    }
