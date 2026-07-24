from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


UNKNOWN_OPENING = "Unknown Opening"
OPEN_GAME_FAMILY = "Open Game"
QUEEN_PAWN_FAMILY = "Queen's Pawn Opening"

# This is classification metadata, not a repertoire inference.  It records
# which side's move sequence defines the named family.  Repertoire ownership
# is resolved later by combining this value with the user's actual colour.
OPENING_SIDE_METADATA = {
    "Ruy Lopez": "white", "Italian Game": "white", "Scotch Game": "white",
    "Vienna Game": "white", "Four Knights Game": "white", "King's Gambit": "white",
    "Queen's Gambit": "white", "English Opening": "white", "Catalan Opening": "white",
    "London System": "white", "Jobava London System": "white", "RÃ©ti Opening": "white",
    "King's Indian Attack": "white", OPEN_GAME_FAMILY: "white", QUEEN_PAWN_FAMILY: "white",
    "Sicilian Defence": "black", "French Defence": "black", "Caro-Kann Defence": "black",
    "Scandinavian Defence": "black", "Alekhine Defence": "black", "Pirc Defence": "black",
    "Modern Defence": "black", "King's Indian Defence": "black", "GrÃ¼nfeld Defence": "black",
    "Queen's Gambit Declined": "black", "Slav Defence": "black",
    "Nimzo-Indian Defence": "black", "Benoni Defence": "black", "Dutch Defence": "black",
}


def opening_side_for(opening: str) -> str | None:
    """Return explicit classifier metadata for the side defining a family."""
    return OPENING_SIDE_METADATA.get(normalise_opening_name(opening))


def clean_san(move: str) -> str:
    return (
        str(move or "")
        .replace("+", "")
        .replace("#", "")
        .replace("!", "")
        .replace("?", "")
        .strip()
    )


def normalise_moves(moves: list[str]) -> list[str]:
    return [clean_san(move) for move in moves if clean_san(move)]


def normalise_opening_name(name: str) -> str:
    if not name:
        return UNKNOWN_OPENING

    lower = str(name).lower()

    mapping = [
        (["sicilian"], "Sicilian Defence"),
        (["french"], "French Defence"),
        (["caro-kann", "caro kann"], "Caro-Kann Defence"),
        (["ruy lopez", "spanish"], "Ruy Lopez"),
        (["italian", "giuoco", "two knights"], "Italian Game"),
        (["scotch"], "Scotch Game"),
        (["pirc"], "Pirc Defence"),
        (["modern"], "Modern Defence"),
        (["king's indian attack", "kings indian attack"], "King's Indian Attack"),
        (["king's indian", "kings indian"], "King's Indian Defence"),
        (["grünfeld", "grunfeld"], "Grünfeld Defence"),
        (["queen's gambit declined", "queens gambit declined", "qgd"], "Queen's Gambit Declined"),
        (["queen's gambit", "queens gambit"], "Queen's Gambit"),
        (["slav"], "Slav Defence"),
        (["nimzo"], "Nimzo-Indian Defence"),
        (["english"], "English Opening"),
        (["catalan"], "Catalan Opening"),
        (["jobava"], "Jobava London System"),
        (["london"], "London System"),
        (["queen pawn", "queen's pawn"], QUEEN_PAWN_FAMILY),
        (["open game"], OPEN_GAME_FAMILY),
        (["benoni"], "Benoni Defence"),
        (["dutch"], "Dutch Defence"),
        (["scandinavian", "center counter", "centre counter"], "Scandinavian Defence"),
        (["alekhine"], "Alekhine Defence"),
        (["vienna"], "Vienna Game"),
        (["king's gambit", "kings gambit"], "King's Gambit"),
        (["reti", "réti"], "Réti Opening"),
        (["four knights"], "Four Knights Game"),
    ]

    for keys, value in mapping:
        if any(key in lower for key in keys):
            return value

    return str(name).strip() or UNKNOWN_OPENING


def is_unknown_opening(name: str) -> bool:
    lower = str(name or "").strip().lower()
    return lower in {"", "opening", "unknown", "unknown opening", "unclassified opening"} or "unknown" in lower


def pgn_tag_value(pgn: str, tag: str) -> str:
    if not pgn:
        return ""

    pattern = re.compile(rf'^\[{re.escape(tag)}\s+"([^"]+)"\]', re.IGNORECASE)

    for line in pgn.splitlines():
        match = pattern.match(line.strip())
        if match:
            return match.group(1).strip()

    return ""


def opening_from_eco_url(url: str) -> str:
    if not url:
        return ""

    slug = str(url).rstrip("/").split("/")[-1]
    slug = re.sub(r"[-_]+", " ", slug)
    return normalise_opening_name(slug)


def eco_family(eco: str) -> str:
    code = str(eco or "").strip().upper()

    if not re.match(r"^[A-E]\d{2}$", code):
        return UNKNOWN_OPENING

    letter = code[0]
    number = int(code[1:])

    if letter == "A":
        if 0 <= number <= 3:
            return "Nimzowitsch-Larsen Attack"
        if 4 <= number <= 9:
            return "Réti Opening"
        if 10 <= number <= 39:
            return "English Opening"
        if 40 <= number <= 44:
            return "Queen Pawn Game"
        if 45 <= number <= 49:
            return "Trompowsky Attack"
        if 50 <= number <= 79:
            return "Benoni Defence"
        if 80 <= number <= 99:
            return "Dutch Defence"

    if letter == "B":
        if number == 0:
            return "Uncommon King's Pawn Opening"
        if number == 1:
            return "Scandinavian Defence"
        if 2 <= number <= 5:
            return "Alekhine Defence"
        if 6 <= number <= 9:
            return "Modern Defence"
        if 10 <= number <= 19:
            return "Caro-Kann Defence"
        if 20 <= number <= 99:
            return "Sicilian Defence"

    if letter == "C":
        if 0 <= number <= 19:
            return "French Defence"
        if 20 <= number <= 29:
            return "King's Pawn Game"
        if 30 <= number <= 39:
            return "King's Gambit"
        if 44 <= number <= 45:
            return "Scotch Game"
        if 50 <= number <= 59:
            return "Italian Game"
        if 60 <= number <= 99:
            return "Ruy Lopez"

    if letter == "D":
        if 0 <= number <= 5:
            return QUEEN_PAWN_FAMILY
        if 10 <= number <= 19 or 43 <= number <= 49:
            return "Slav Defence"
        if 6 <= number <= 69:
            return "Queen's Gambit Declined" if number >= 30 else "Queen's Gambit"
        if 70 <= number <= 99:
            return "Grünfeld Defence"

    if letter == "E":
        if 0 <= number <= 9:
            return "Catalan Opening"
        if 10 <= number <= 59:
            return "Nimzo-Indian Defence"
        if 60 <= number <= 99:
            return "King's Indian Defence"

    return UNKNOWN_OPENING


@dataclass(frozen=True)
class BookLine:
    name: str
    family: str
    moves: tuple[str, ...]
    eco: str = ""


BOOK_LINES = [
    BookLine("Ruy Lopez", "Open Game / Spanish", ("e4", "e5", "Nf3", "Nc6", "Bb5"), "C60"),
    BookLine("Italian Game", "Open Game / Italian", ("e4", "e5", "Nf3", "Nc6", "Bc4"), "C50"),
    BookLine("Scotch Game", "Open Game / Scotch", ("e4", "e5", "Nf3", "Nc6", "d4"), "C45"),
    BookLine("Vienna Game", "Open Game / Vienna", ("e4", "e5", "Nc3"), "C25"),
    BookLine("King's Gambit", "Open Game / King's Gambit", ("e4", "e5", "f4"), "C30"),
    BookLine("Four Knights Game", "Open Game / Four Knights", ("e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"), "C47"),
    BookLine("Four Knights Game", "Open Game / Four Knights", ("e4", "e5", "Nc3", "Nf6", "Nf3", "Nc6"), "C47"),
    BookLine("Sicilian Defence", "Sicilian structure", ("e4", "c5"), "B20"),
    BookLine("French Defence", "French structure", ("e4", "e6"), "C00"),
    BookLine("Caro-Kann Defence", "Caro-Kann structure", ("e4", "c6"), "B10"),
    BookLine("Scandinavian Defence", "Scandinavian structure", ("e4", "d5"), "B01"),
    BookLine("Alekhine Defence", "Alekhine structure", ("e4", "Nf6"), "B02"),
    BookLine("Pirc Defence", "Pirc / Modern complex", ("e4", "d6", "d4", "Nf6"), "B07"),
    BookLine("Modern Defence", "Modern / Pirc complex", ("e4", "g6"), "B06"),
    BookLine("Queen's Gambit", "Queen's Gambit structure", ("d4", "d5", "c4"), "D06"),
    BookLine("Queen's Gambit Declined", "Queen's Gambit Declined structure", ("d4", "d5", "c4", "e6"), "D30"),
    BookLine("Slav Defence", "Slav structure", ("d4", "d5", "c4", "c6"), "D10"),
    BookLine("London System", "London System setup", ("d4", "d5", "Nf3", "Nf6", "Bf4"), "D02"),
    BookLine("Jobava London System", "Jobava London setup", ("d4", "d5", "Nc3", "Nf6", "Bf4"), "D00"),
    BookLine("Jobava London System", "Jobava London setup", ("d4", "Nf6", "Nc3", "d5", "Bf4"), "D00"),
    BookLine("King's Indian Defence", "King's Indian type setup", ("d4", "Nf6", "c4", "g6"), "E60"),
    BookLine("Grünfeld Defence", "Grünfeld type setup", ("d4", "Nf6", "c4", "g6", "Nc3", "d5"), "D70"),
    BookLine("Nimzo-Indian Defence", "Nimzo-Indian structure", ("d4", "Nf6", "c4", "e6", "Nc3", "Bb4"), "E20"),
    BookLine("Benoni Defence", "Benoni structure", ("d4", "Nf6", "c4", "c5"), "A56"),
    BookLine("Dutch Defence", "Dutch structure", ("d4", "f5"), "A80"),
    BookLine("English Opening", "English Opening structure", ("c4",), "A10"),
    BookLine("Catalan Opening", "Catalan structure", ("d4", "Nf6", "c4", "e6", "g3"), "E00"),
]


OPENING_THEMES = {
    "Sicilian Defence": ["fight for the centre from the flank", "use the c-file", "look for ...d5 breaks"],
    "French Defence": ["pressure White's centre", "prepare ...c5", "solve the light-square bishop"],
    "Caro-Kann Defence": ["build a solid centre", "develop cleanly", "look for ...c5 or ...e5 breaks"],
    "Ruy Lopez": ["pressure the e5 defender", "build central tension", "use c3 and d4 when ready"],
    "Italian Game": ["develop quickly", "control the centre", "watch f7 and d4 ideas"],
    "Scotch Game": ["open the centre early", "use active piece play", "avoid premature queen adventures"],
    "Pirc Defence": ["invite a big centre", "counter with ...e5 or ...c5", "develop the kingside compactly"],
    "Modern Defence": ["fianchetto first", "challenge the centre later", "keep transpositions flexible"],
    "King's Indian Defence": ["challenge White's centre", "prepare ...e5 or ...c5 pawn breaks", "create kingside counterplay after castling"],
    "Grünfeld Defence": ["invite White's centre forward", "attack d4 with pieces", "use ...c5 pressure"],
    "Queen's Gambit": ["pressure d5", "develop smoothly", "use c-file and central breaks"],
    "Queen's Gambit Declined": ["hold the d5 centre", "develop solidly", "prepare ...c5 or ...e5 breaks"],
    "Slav Defence": ["support d5 with ...c6", "develop the light-square bishop", "strike with ...c5 or ...e5"],
    "Nimzo-Indian Defence": ["pin the c3 knight", "fight for dark squares", "pressure doubled pawns when created"],
    "English Opening": ["control d5", "transpose flexibly", "expand without rushing the centre"],
    "Catalan Opening": ["pressure the long diagonal", "combine c4 with g3/Bg2", "recover or pressure queenside pawns"],
    "London System": ["complete a stable setup", "control e5", "choose queenside expansion or kingside pressure"],
    "Jobava London System": ["combine Nc3 and Bf4 quickly", "watch e4/e5 jumps", "avoid drifting into random queen-pawn play"],
    "Benoni Defence": ["accept space disadvantage", "use ...c5 counterplay", "attack dark squares and queenside breaks"],
    "Dutch Defence": ["claim kingside space", "fight for e4", "watch light-square weaknesses"],
    "Scandinavian Defence": ["challenge e4 immediately", "develop after queen movement", "avoid losing tempi"],
    "Alekhine Defence": ["provoke pawn advances", "attack the extended centre", "time ...d6 and ...c5 breaks"],
    "Vienna Game": ["develop flexibly", "keep f4 attacking ideas", "watch e5 and kingside tactics"],
    "King's Gambit": ["open the f-file", "prioritise development", "calculate king-safety tactics"],
    OPEN_GAME_FAMILY: ["develop knights and bishops quickly", "fight for the centre", "avoid naming a sharper line too early"],
    QUEEN_PAWN_FAMILY: ["build a d4 centre", "identify the c4 or system setup", "choose the main pawn break before expanding"],
}


OPENING_TYPICAL_PLANS = {
    "Sicilian Defence": [
        "Fight for the centre from the flank with ...c5.",
        "Use the half-open c-file when it appears.",
        "Look for a well-timed ...d5 break.",
    ],
    "French Defence": [
        "Pressure White's pawn chain with ...c5.",
        "Challenge the centre with ...f6 when the structure allows it.",
        "Solve the light-square bishop before it becomes a long-term problem.",
    ],
    "Caro-Kann Defence": [
        "Build a solid ...c6 and ...d5 centre.",
        "Develop cleanly before opening the position.",
        "Break with ...c5 or ...e5 when White overextends.",
    ],
    "King's Indian Defence": [
        "Castle short before committing the centre.",
        "Play ...d6 to support the dark-square shell.",
        "Challenge White's centre with ...e5 or ...c5.",
        "Prepare kingside play with ...f5 when the centre is locked.",
        "Use ...Nh5-f4 ideas in some lines when the kingside becomes the battlefield.",
    ],
    "Grünfeld Defence": [
        "Invite White's centre forward, then attack it with pieces.",
        "Hit d4 with ...c5, ...Nc6, and Bg7 pressure.",
        "Keep the centre dynamic instead of defending passively.",
    ],
    "Queen's Gambit": [
        "Use c4 to pressure Black's d5 pawn.",
        "Develop smoothly before resolving central tension.",
        "Use the c-file and e4 break when the position supports it.",
    ],
    "Queen's Gambit Declined": [
        "Hold the d5 centre without releasing tension too early.",
        "Develop the kingside before committing the queenside structure.",
        "Look for ...c5 or ...e5 when White's centre is ready to be challenged.",
    ],
    "Slav Defence": [
        "Support d5 with ...c6.",
        "Develop the light-square bishop before closing it in.",
        "Strike back with ...c5 or ...e5 when White's setup slows down.",
    ],
    "Nimzo-Indian Defence": [
        "Pin the c3 knight and fight for dark squares.",
        "Pressure doubled c-pawns if White accepts them.",
        "Choose ...d5 or ...c5 depending on White's centre.",
    ],
    "English Opening": [
        "Control d5 without rushing the central pawn break.",
        "Keep transpositions into Catalan, Queen's Gambit, or Sicilian-style structures available.",
        "Expand on the queenside when Black concedes space.",
    ],
    "Catalan Opening": [
        "Use the Bg2 bishop to pressure the long diagonal.",
        "Combine c4 pressure with steady kingside safety.",
        "Recover or target queenside pawns when Black grabs material.",
    ],
    "London System": [
        "Complete the d4, Nf3, Bf4, e3 setup efficiently.",
        "Fight for e5 before starting a direct attack.",
        "Choose queenside expansion or kingside pressure based on Black's setup.",
    ],
    "Jobava London System": [
        "Use Nc3 and Bf4 to pressure e5 and c7 early.",
        "Decide quickly whether e4 is playable.",
        "Keep development smooth so the setup stays a plan, not just a move order.",
    ],
    "Benoni Defence": [
        "Accept less space in return for active counterplay.",
        "Use ...c5 pressure and queenside breaks.",
        "Fight for dark squares around e5 and d4.",
    ],
    "Dutch Defence": [
        "Claim kingside space with ...f5.",
        "Fight for e4 and watch the light squares.",
        "Decide between Stonewall, Classical, and Leningrad-style piece placement.",
    ],
    "Pirc Defence": [
        "Let White build the centre, then challenge it.",
        "Develop compactly with ...Nf6, ...g6, and ...Bg7.",
        "Choose ...e5 or ...c5 as the main counterpunch.",
    ],
    "Modern Defence": [
        "Fianchetto first and keep the central pawn choice flexible.",
        "Transpose into Pirc, King's Indian, or Modern structures when useful.",
        "Challenge the centre only after White shows their setup.",
    ],
}


def theme_for(opening: str) -> list[str]:
    return OPENING_THEMES.get(
        normalise_opening_name(opening),
        ["identify the pawn breaks", "finish development before forcing tactics", "review the first unclear plan"],
    )


def typical_plans_for(opening: str) -> list[str]:
    name = normalise_opening_name(opening)
    if name in OPENING_TYPICAL_PLANS:
        return OPENING_TYPICAL_PLANS[name]

    return [theme[0].upper() + theme[1:] + "." for theme in theme_for(name)]


def repertoire_bucket_for(opening: str) -> str:
    name = normalise_opening_name(opening)

    black_defences = {
        "Sicilian Defence",
        "French Defence",
        "Caro-Kann Defence",
        "Pirc Defence",
        "Modern Defence",
        "King's Indian Defence",
        "Grünfeld Defence",
        "Queen's Gambit Declined",
        "Slav Defence",
        "Nimzo-Indian Defence",
        "Benoni Defence",
        "Dutch Defence",
        "Scandinavian Defence",
        "Alekhine Defence",
    }
    white_openings = {
        "Ruy Lopez",
        "Italian Game",
        "Scotch Game",
        "Vienna Game",
        "King's Gambit",
        "Queen's Gambit",
        "English Opening",
        "Catalan Opening",
        "London System",
        "Jobava London System",
        "Réti Opening",
        "King's Indian Attack",
        OPEN_GAME_FAMILY,
        QUEEN_PAWN_FAMILY,
    }

    if name in black_defences:
        return "Black defensive repertoire"
    if name in white_openings:
        return "White opening repertoire"
    if is_unknown_opening(name):
        return "Unclassified / needs more moves"

    return "Flexible transposition bucket"


def side_moves(moves: list[str], white: bool) -> list[str]:
    return moves[0::2] if white else moves[1::2]


def has_all(values: list[str], required: set[str]) -> bool:
    value_set = set(values)
    return required.issubset(value_set)


def count_matches(values: list[str], wanted: set[str]) -> int:
    value_set = set(values)
    return len(value_set.intersection(wanted))


def prefix_match(moves: list[str], pattern: tuple[str, ...]) -> bool:
    return len(moves) >= len(pattern) and tuple(moves[: len(pattern)]) == pattern


def exact_book_signal(moves: list[str]) -> dict[str, Any] | None:
    matches = [line for line in BOOK_LINES if len(line.moves) >= 3 and prefix_match(moves, line.moves)]

    if not matches:
        return None

    best = max(matches, key=lambda line: len(line.moves))
    return {
        "type": "exact_book",
        "opening": best.name,
        "family": best.family,
        "confidence": 0.96,
        "weight": 34 + len(best.moves),
        "evidence": f"Matched book line through {' '.join(best.moves)}.",
        "eco": best.eco,
        "openingSide": opening_side_for(best.name),
    }


def eco_signal(eco: str, eco_url: str = "", tagged_opening: str = "") -> dict[str, Any] | None:
    name = normalise_opening_name(tagged_opening) if tagged_opening else UNKNOWN_OPENING
    if is_unknown_opening(name):
        name = opening_from_eco_url(eco_url)
    if is_unknown_opening(name):
        name = eco_family(eco)

    if is_unknown_opening(name):
        return None

    return {
        "type": "eco",
        "opening": name,
        "family": family_for_opening(name),
        "confidence": 0.9 if tagged_opening or eco_url else 0.76,
        "weight": 38 if tagged_opening or eco_url else 30,
        "evidence": f"ECO metadata points to {name}." if eco else f"Opening metadata points to {name}.",
        "eco": str(eco or "").upper() or None,
        "openingSide": opening_side_for(name),
    }


def family_for_opening(opening: str) -> str:
    name = normalise_opening_name(opening)
    families = {
        "Ruy Lopez": "Open Game / Spanish",
        "Italian Game": "Open Game / Italian",
        "Scotch Game": "Open Game / Scotch",
        "Vienna Game": "Open Game / Vienna",
        "Four Knights Game": "Open Game / Four Knights",
        "King's Gambit": "Open Game / King's Gambit",
        OPEN_GAME_FAMILY: "Open Game family",
        "Sicilian Defence": "Sicilian structure",
        "French Defence": "French Defence structure",
        "Caro-Kann Defence": "Caro-Kann structure",
        "Scandinavian Defence": "Scandinavian structure",
        "Alekhine Defence": "Alekhine structure",
        "Pirc Defence": "Pirc / Modern complex",
        "Modern Defence": "Modern / Pirc complex",
        "King's Indian Defence": "King's Indian type setup",
        "Grünfeld Defence": "Grünfeld type setup",
        "Queen's Gambit": "Queen's Gambit structure",
        "Queen's Gambit Declined": "Queen's Gambit Declined structure",
        "Slav Defence": "Slav structure",
        "Nimzo-Indian Defence": "Nimzo-Indian structure",
        "English Opening": "English Opening structure",
        "Catalan Opening": "Catalan structure",
        "London System": "London System setup",
        "Jobava London System": "Jobava London setup",
        QUEEN_PAWN_FAMILY: "Queen's Pawn family",
        "Benoni Defence": "Benoni structure",
        "Dutch Defence": "Dutch structure",
    }
    return families.get(name, name if not is_unknown_opening(name) else "unclassified opening structure")


def structure_signals(moves: list[str]) -> list[dict[str, Any]]:
    early = moves[:16]
    white = side_moves(early, True)
    black = side_moves(early, False)
    signals: list[dict[str, Any]] = []

    def add(opening: str, confidence: float, evidence: str, weight: int = 24, signal_type: str = "structure") -> None:
        signals.append(
            {
                "type": signal_type,
                "opening": opening,
                "family": family_for_opening(opening),
                "confidence": confidence,
                "weight": weight,
                "evidence": evidence,
            }
        )

    if early[:1] == ["c4"] and not ("d4" in white and "d5" in black):
        add("English Opening", 0.84, "White starts with c4 and keeps English transposition options.")
    if early[:1] == ["Nf3"] and not ("d4" in white and "c4" in white):
        add("Réti Opening", 0.72, "White starts with Nf3 and delays the central pawn choice.", 18)
    if early[:2] == ["d4", "f5"]:
        add("Dutch Defence", 0.93, "Black answers 1.d4 with ...f5.")
    if early[:2] == ["e4", "Nf6"]:
        add("Alekhine Defence", 0.94, "Black attacks e4 with ...Nf6 on move one.")
    if early[:2] == ["e4", "d5"]:
        add("Scandinavian Defence", 0.94, "Black challenges e4 immediately with ...d5.")
    if early[:2] == ["e4", "c5"]:
        add("Sicilian Defence", 0.94, "Black answers 1.e4 with ...c5.")
    if early[:2] == ["e4", "e6"]:
        add("French Defence", 0.92, "Black answers 1.e4 with ...e6 and prepares ...d5.")
    if early[:2] == ["e4", "c6"]:
        add("Caro-Kann Defence", 0.92, "Black answers 1.e4 with ...c6 and prepares ...d5.")

    if "e4" in white and "c5" in black and early[:1] != ["c4"]:
        add("Sicilian Defence", 0.86, "The game transposes to a 1.e4 versus ...c5 Sicilian structure.", 36, "transposition")
    if "e4" in white and "e6" in black and "d5" in black:
        add("French Defence", 0.86, "Black reaches the French ...e6/...d5 structure against e4.", 36, "transposition")
    if "e4" in white and "c6" in black and "d5" in black:
        add("Caro-Kann Defence", 0.86, "Black reaches the Caro-Kann ...c6/...d5 structure against e4.", 36, "transposition")
    if "e4" in white and "d5" in black and (early[:2] == ["e4", "d5"] or "exd5" in white or "e5" in white):
        add("Scandinavian Defence", 0.88, "The early e4 versus ...d5 structure is Scandinavian even if the follow-up varies.", 36, "transposition")

    if has_all(white, {"d4", "c4"}) and has_all(black, {"d5", "c6"}):
        add("Slav Defence", 0.9, "The d4/c4 versus d5/c6 pawn shell is a Slav structure.", 42, "transposition")
    elif has_all(white, {"d4", "c4"}) and has_all(black, {"d5", "e6"}):
        add("Queen's Gambit Declined", 0.88, "The d4/c4 versus ...d5/...e6 shell is a Queen's Gambit Declined structure.", 42, "transposition")
    elif has_all(white, {"d4", "c4"}) and "d5" in black:
        add("Queen's Gambit", 0.84, "White uses d4/c4 against a ...d5 centre.", 38, "transposition")

    if "d4" in white and "c4" not in white and ("Bf4" in white or "Bg5" in white or "Nc3" in white):
        add(QUEEN_PAWN_FAMILY, 0.76, "White is in a queen-pawn system without enough c4 evidence for a Queen's Gambit label.", 34)

    if has_all(white, {"d4", "c4"}) and "c5" in black and ("Nf6" in black or "e6" in black or "g6" in black):
        add("Benoni Defence", 0.84, "Black meets d4/c4 with early ...c5 counterplay.")

    if has_all(white, {"d4", "c4"}) and has_all(black, {"Nf6", "g6", "d5"}):
        add("Grünfeld Defence", 0.9, "Black combines ...Nf6, ...g6, and a quick ...d5 against d4/c4.", 42, "transposition")
    elif has_all(white, {"d4", "c4"}) and has_all(black, {"Nf6", "g6"}) and ("Bg7" in black or "d6" in black):
        add("King's Indian Defence", 0.88, "Black has the ...Nf6/...g6/...Bg7 King's Indian shell.", 40, "transposition")

    if has_all(white, {"d4", "c4", "Nc3"}) and has_all(black, {"Nf6", "e6", "Bb4"}):
        add("Nimzo-Indian Defence", 0.92, "Black pins Nc3 with ...Bb4 after ...Nf6/...e6.", 42, "transposition")

    if has_all(white, {"d4", "c4", "g3"}) and ("Bg2" in white or len(white) <= 5) and ("Nf6" in black or "d5" in black or "e6" in black):
        add("Catalan Opening", 0.86, "White combines d4/c4 with g3/Bg2.", 38, "transposition")

    if "d4" in white and "Nc3" in white and "Bf4" in white and "c4" not in white:
        add("Jobava London System", 0.88, "White combines d4, Nc3, and Bf4 in a Jobava London setup.", 40, "transposition")
    elif "d4" in white and ("Bf4" in white or "Bg5" in white) and ("Nf3" in white or "e3" in white or "c3" in white):
        add("London System", 0.84, "White builds a d4 plus Bf4/Bg5 system setup.", 36, "transposition")

    if "e4" in white and "d4" in white and "d6" in black and "Nf6" in black and ("g6" in black or "Bg7" in black):
        add("Pirc Defence", 0.88, "Black reaches the Pirc ...d6/...Nf6/...g6 setup against e4/d4.", 40, "transposition")
    elif early[:2] == ["e4", "d6"] and ("Nf6" in black or "g6" in black):
        add("Pirc Defence", 0.84, "Black uses ...d6 with kingside development against 1.e4.", 34, "transposition")
    if early[:2] == ["e4", "g6"] or ("e4" in white and "g6" in black and "Bg7" in black and "Nf6" not in black[:3]):
        add("Modern Defence", 0.8, "Black fianchettoes early and delays a classical centre.", 34, "transposition")

    return signals


def piece_placement_signals(moves: list[str]) -> list[dict[str, Any]]:
    early = moves[:14]
    white = side_moves(early, True)
    black = side_moves(early, False)
    signals: list[dict[str, Any]] = []

    def add(opening: str, confidence: float, evidence: str, weight: int = 20, signal_type: str = "piece_placement") -> None:
        signals.append(
            {
                "type": signal_type,
                "opening": opening,
                "family": family_for_opening(opening),
                "confidence": confidence,
                "weight": weight,
                "evidence": evidence,
            }
        )

    is_open_game = early[:2] == ["e4", "e5"]
    both_white_knights = "Nf3" in white[:4] and "Nc3" in white[:4]
    both_black_knights = "Nf6" in black[:4] and "Nc6" in black[:4]

    if is_open_game and both_white_knights and both_black_knights:
        add("Four Knights Game", 0.9, "Both sides develop both knights, so the game has transposed to a Four Knights structure.", 48, "transposition")
    if is_open_game and "Bb5" in white[:4] and not both_white_knights:
        add("Ruy Lopez", 0.94, "White develops Bb5 against the knight defending e5.", 28)
    if is_open_game and "Bc4" in white[:4] and "Nf3" in white[:4] and not both_white_knights:
        add("Italian Game", 0.92, "White develops Nf3 and Bc4 in an open game.", 28)
    if is_open_game and "Bc4" in white[:4] and "Nf3" not in white[:3] and "Nc3" in white[:3]:
        add("Vienna Game", 0.76, "White reaches Bc4 from a Vienna-style Nc3 move order, so exact line precision is limited.", 22)
        add(OPEN_GAME_FAMILY, 0.78, "The move order overlaps Vienna and Italian themes; keeping it as an Open Game family is safer.", 30, "transposition")
    if is_open_game and "d4" in white[:4] and "Nf3" in white[:3]:
        add("Scotch Game", 0.9, "White opens the centre with d4 in an open game.", 28)
    if is_open_game and "Nc3" in white[:3] and not both_white_knights:
        confidence = 0.9 if "f4" in white[:3] or "Bc4" in white[:3] else 0.8
        add("Vienna Game", confidence, "White develops Nc3 before Nf3 or alongside Vienna attacking ideas.", 28)
    if early[:2] == ["e4", "e5"] and "f4" in white[:3]:
        add("King's Gambit", 0.92, "White challenges e5 with early f4.", 30)
    if count_matches(black, {"g6", "Bg7", "d6", "O-O"}) >= 3 and count_matches(white, {"d4", "c4", "Nf3", "Nc3", "e4"}) >= 2:
        add("King's Indian Defence", 0.82, "Black's pieces form a fianchettoed King's Indian shell.")
    if count_matches(black, {"Nf6", "g6", "Bg7", "d5"}) >= 3 and count_matches(white, {"d4", "c4", "Nc3"}) >= 2:
        add("Grünfeld Defence", 0.82, "Black's fianchetto is paired with direct ...d5 pressure.")

    return signals


def aggregate_signals(signals: list[dict[str, Any]]) -> dict[str, Any]:
    if not signals:
        return {
            "opening": UNKNOWN_OPENING,
            "family": "unclassified opening structure",
            "confidence": "low",
            "confidenceScore": 0,
            "themes": theme_for(UNKNOWN_OPENING),
            "typicalPlans": typical_plans_for(UNKNOWN_OPENING),
            "repertoireBucket": repertoire_bucket_for(UNKNOWN_OPENING),
            "signals": [],
            "openingSide": None,
            "openingSideSource": "unresolved",
        }

    scores: dict[str, float] = {}
    for signal in signals:
        opening = normalise_opening_name(signal["opening"])
        scores[opening] = scores.get(opening, 0) + float(signal.get("weight", 0)) * float(signal.get("confidence", 0))

    best_opening = max(scores, key=scores.get)
    best_score = min(100, round(scores[best_opening]))
    best_signals = [signal for signal in signals if normalise_opening_name(signal["opening"]) == best_opening]
    best_signal = max(best_signals, key=lambda signal: signal.get("confidence", 0))

    if best_score >= 72:
        confidence = "high"
    elif best_score >= 20:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "opening": best_opening,
        "family": best_signal.get("family") or family_for_opening(best_opening),
        "confidence": confidence,
        "confidenceScore": best_score,
        "themes": theme_for(best_opening),
        "typicalPlans": typical_plans_for(best_opening),
        "repertoireBucket": repertoire_bucket_for(best_opening),
        "signals": sorted(signals, key=lambda signal: signal.get("weight", 0) * signal.get("confidence", 0), reverse=True),
        "openingSide": best_signal.get("openingSide") or opening_side_for(best_opening),
        "openingSideSource": "move_sequence_or_opening_metadata",
    }


def detect_opening(
    moves: list[str],
    *,
    tagged_opening: str = "",
    eco: str = "",
    eco_url: str = "",
) -> dict[str, Any]:
    clean_moves = normalise_moves(moves)
    signals: list[dict[str, Any]] = []

    book = exact_book_signal(clean_moves)
    if book:
        signals.append(book)

    eco_match = eco_signal(eco, eco_url=eco_url, tagged_opening=tagged_opening)
    if eco_match:
        signals.append(eco_match)

    signals.extend(structure_signals(clean_moves))
    signals.extend(piece_placement_signals(clean_moves))

    result = aggregate_signals(signals)
    result["movesAnalysed"] = clean_moves[:18]
    return result


def detect_opening_from_pgn(pgn: str, moves: list[str] | None = None) -> dict[str, Any]:
    tagged = pgn_tag_value(pgn, "Opening")
    eco = pgn_tag_value(pgn, "ECO")
    eco_url = pgn_tag_value(pgn, "ECOUrl")
    return detect_opening(moves or [], tagged_opening=tagged, eco=eco, eco_url=eco_url)
