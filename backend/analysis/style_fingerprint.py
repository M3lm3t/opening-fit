from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any, Dict, Iterable, List, Optional

try:
    import chess
except Exception:  # pragma: no cover - defensive for minimal environments
    chess = None


TRAIT_KEYS = [
    "tactical_tendency",
    "positional_tendency",
    "open_position_preference",
    "closed_position_comfort",
    "gambit_comfort",
    "early_attack_frequency",
    "queen_trade_frequency",
    "simplified_position_comfort",
    "castling_consistency",
    "opposite_side_castling_frequency",
    "central_pawn_break_frequency",
    "development_speed",
    "king_safety_risk",
    "endgame_conversion",
    "short_game_success",
    "long_game_success",
    "opening_phase_stability",
]

LOW_SAMPLE_TRAITS = {
    "tactical_tendency": 50,
    "positional_tendency": 50,
    "open_position_preference": 50,
    "closed_position_comfort": 50,
    "gambit_comfort": 50,
    "early_attack_frequency": 50,
    "queen_trade_frequency": 50,
    "simplified_position_comfort": 50,
    "castling_consistency": 50,
    "opposite_side_castling_frequency": 50,
    "central_pawn_break_frequency": 50,
    "development_speed": 50,
    "king_safety_risk": 50,
    "endgame_conversion": 50,
    "short_game_success": 50,
    "long_game_success": 50,
    "opening_phase_stability": 50,
}


def clamp_score(value: float) -> int:
    return int(round(max(0, min(100, value))))


def rate(numerator: float, denominator: float, default: float = 0.0) -> float:
    if not denominator:
        return default
    return numerator / denominator


def average(values: Iterable[float], default: float = 0.0) -> float:
    values = list(values)
    if not values:
        return default
    return sum(values) / len(values)


def score_from_success(success: float) -> float:
    return success * 100


def pgn_tag_value(pgn: str, tag: str) -> str:
    if not pgn:
        return ""

    pattern = re.compile(rf'^\[{re.escape(tag)}\s+"([^"]*)"\]', re.IGNORECASE | re.MULTILINE)
    match = pattern.search(pgn)
    return match.group(1).strip() if match else ""


def clean_moves_from_text(text: str) -> List[str]:
    if not text:
        return []

    lines = [line for line in str(text).splitlines() if not line.lstrip().startswith("[")]
    move_text = " ".join(lines)
    move_text = re.sub(r"\{[^}]*\}", " ", move_text)
    move_text = re.sub(r"\([^)]*\)", " ", move_text)
    move_text = re.sub(r"\d+\.(\.\.)?", " ", move_text)
    move_text = re.sub(r"1-0|0-1|1/2-1/2|\*", " ", move_text)
    move_text = re.sub(r"\$\d+", " ", move_text)
    move_text = re.sub(r"\s+", " ", move_text).strip()
    return move_text.split() if move_text else []


def moves_for_game(game: Dict[str, Any]) -> List[str]:
    moves = game.get("moves")
    if isinstance(moves, list):
        return [str(move) for move in moves if move]

    moves_text = game.get("movesText") or game.get("moves_text") or game.get("moves")
    if isinstance(moves_text, str) and moves_text.strip():
        return clean_moves_from_text(moves_text)

    return clean_moves_from_text(str(game.get("pgn") or ""))


def result_score(result: str) -> float:
    result = str(result or "").lower()
    if result == "win":
        return 1.0
    if result == "draw":
        return 0.5
    if result == "loss":
        return 0.0
    return 0.5


def user_move_indices(colour: str, total_plies: int) -> List[int]:
    colour = str(colour or "").lower()
    if colour == "white":
        return list(range(0, total_plies, 2))
    if colour == "black":
        return list(range(1, total_plies, 2))
    return list(range(total_plies))


def user_san_moves(moves: List[str], colour: str) -> List[str]:
    return [moves[index] for index in user_move_indices(colour, len(moves))]


def is_central_pawn_break(san: str) -> bool:
    clean = san.replace("+", "").replace("#", "").replace("!", "").replace("?", "")
    clean = clean.replace("=", "")
    lowered = clean.lower()
    return bool(
        re.match(r"^[cdef][34-6]$", lowered)
        or re.match(r"^[cdef]x[cdef][34-6]", lowered)
    )


def is_early_attack_move(san: str) -> bool:
    clean = san.replace("+", "").replace("#", "").replace("!", "").replace("?", "")
    lowered = clean.lower()
    return bool(
        lowered in {"f4", "f5", "g4", "g5", "h4", "h5"}
        or lowered.startswith("q")
        or lowered.startswith("bxf7")
        or lowered.startswith("bxh7")
        or lowered.startswith("nxf7")
        or lowered.startswith("nxh7")
        or lowered.startswith("ng5")
        or lowered.startswith("bg5")
    )


def is_development_move(san: str) -> bool:
    clean = san.replace("+", "").replace("#", "").replace("!", "").replace("?", "")
    return clean.startswith(("N", "B")) or clean in {"O-O", "O-O-O", "0-0", "0-0-0"}


def chess_features(moves: List[str]) -> Dict[str, Any]:
    features = {
        "queen_trade_ply": None,
        "white_castle_ply": None,
        "black_castle_ply": None,
        "white_castle_side": None,
        "black_castle_side": None,
        "legal_plies": 0,
    }

    if not chess:
        return features

    board = chess.Board()

    for ply_index, san in enumerate(moves, start=1):
        try:
            move = board.parse_san(str(san))
        except Exception:
            break

        moved_piece = board.piece_at(move.from_square)
        is_castle = bool(
            moved_piece
            and moved_piece.piece_type == chess.KING
            and abs(chess.square_file(move.to_square) - chess.square_file(move.from_square)) == 2
        )
        mover = board.turn
        board.push(move)
        features["legal_plies"] = ply_index

        if is_castle:
            side = "queen" if chess.square_file(move.to_square) == 2 else "king"
            if mover == chess.WHITE and features["white_castle_ply"] is None:
                features["white_castle_ply"] = ply_index
                features["white_castle_side"] = side
            elif mover == chess.BLACK and features["black_castle_ply"] is None:
                features["black_castle_ply"] = ply_index
                features["black_castle_side"] = side

        if features["queen_trade_ply"] is None and not any(
            piece.piece_type == chess.QUEEN for piece in board.piece_map().values()
        ):
            features["queen_trade_ply"] = ply_index

    return features


def classify_game(game: Dict[str, Any]) -> Dict[str, Any]:
    moves = moves_for_game(game)
    colour = str(game.get("colour") or game.get("color") or "unknown").lower()
    result = str(game.get("result") or "unknown").lower()
    score = result_score(result)
    opening = str(game.get("opening") or game.get("name") or pgn_tag_value(str(game.get("pgn") or ""), "Opening") or "")
    lower_opening = opening.lower()
    user_moves = user_san_moves(moves, colour)
    early_moves = moves[:20]
    early_user_moves = user_moves[:10]
    full_moves = math.ceil(len(moves) / 2) if moves else 0
    features = chess_features(moves)

    user_castle_ply = None
    opponent_castle_ply = None
    user_castle_side = None
    opponent_castle_side = None

    if colour == "white":
        user_castle_ply = features.get("white_castle_ply")
        opponent_castle_ply = features.get("black_castle_ply")
        user_castle_side = features.get("white_castle_side")
        opponent_castle_side = features.get("black_castle_side")
    elif colour == "black":
        user_castle_ply = features.get("black_castle_ply")
        opponent_castle_ply = features.get("white_castle_ply")
        user_castle_side = features.get("black_castle_side")
        opponent_castle_side = features.get("white_castle_side")

    early_capture_count = sum(1 for move in early_moves if "x" in move)
    user_early_captures = sum(1 for move in early_user_moves if "x" in move)
    central_breaks = sum(1 for move in early_user_moves if is_central_pawn_break(move))
    early_attacks = sum(1 for move in early_user_moves if is_early_attack_move(move))
    development_moves = sum(1 for move in early_user_moves[:8] if is_development_move(move))
    queen_trade_ply = features.get("queen_trade_ply")
    queen_trade_early = bool(queen_trade_ply and queen_trade_ply <= 30)
    opposite_side_castling = bool(
        user_castle_side
        and opponent_castle_side
        and user_castle_side != opponent_castle_side
    )
    castled_by_move_12 = bool(user_castle_ply and user_castle_ply <= 24)
    delayed_or_no_castle = not castled_by_move_12
    gambit_signal = "gambit" in lower_opening or any(move.lower() in {"f4", "g4", "b4"} for move in early_user_moves[:5])
    open_position = early_capture_count >= 3 or user_early_captures >= 2
    closed_position = early_capture_count <= 1 and full_moves >= 30
    short_game = bool(full_moves and full_moves <= 30)
    long_game = bool(full_moves >= 45)

    return {
        "result": result,
        "score": score,
        "opening": opening,
        "full_moves": full_moves,
        "short_game": short_game,
        "long_game": long_game,
        "open_position": open_position,
        "closed_position": closed_position,
        "gambit_signal": gambit_signal,
        "queen_trade_early": queen_trade_early,
        "opposite_side_castling": opposite_side_castling,
        "castled_by_move_12": castled_by_move_12,
        "delayed_or_no_castle": delayed_or_no_castle,
        "central_breaks": central_breaks,
        "early_attacks": early_attacks,
        "development_moves": development_moves,
        "early_capture_count": early_capture_count,
    }


def success_for_flag(games: List[Dict[str, Any]], flag: str, default: float = 0.5) -> float:
    flagged = [game["score"] for game in games if game.get(flag)]
    return average(flagged, default=default)


def rate_for_flag(games: List[Dict[str, Any]], flag: str) -> float:
    return rate(sum(1 for game in games if game.get(flag)), len(games))


def opening_stability_score(games: List[Dict[str, Any]]) -> int:
    openings = [game.get("opening") for game in games if game.get("opening")]
    if not openings:
        return 45

    counts = Counter(openings)
    top_share = counts.most_common(1)[0][1] / len(openings)
    repeated_share = sum(count for _name, count in counts.items() if count >= 2) / len(openings)
    variety_penalty = min(20, max(0, len(counts) - 6) * 2)
    return clamp_score((top_share * 52) + (repeated_share * 48) - variety_penalty)


def confidence_for_count(count: int) -> str:
    if count < 3:
        return "low"
    if count < 8:
        return "medium"
    if count < 20:
        return "medium"
    return "high"


def primary_style_for_traits(traits: Dict[str, int]) -> str:
    tactical = traits["tactical_tendency"]
    positional = traits["positional_tendency"]
    open_pref = traits["open_position_preference"]
    endgame = traits["endgame_conversion"]
    gambit = traits["gambit_comfort"]
    risk = traits["king_safety_risk"]

    if tactical >= 66 and open_pref >= 60:
        return "Tactical Attacker"
    if positional >= 66 and endgame >= 58:
        return "Positional Converter"
    if gambit >= 62 and tactical >= 58:
        return "Initiative Seeker"
    if risk >= 65:
        return "Practical Improver"
    if positional > tactical:
        return "Solid Strategist"
    return "Balanced Practical Player"


def secondary_style_for_traits(traits: Dict[str, int], primary: str) -> str:
    options = [
        ("Practical Improver", traits["king_safety_risk"]),
        ("Endgame Grinder", traits["endgame_conversion"]),
        ("Open Position Player", traits["open_position_preference"]),
        ("Structure Player", traits["closed_position_comfort"]),
        ("Fast Developer", traits["development_speed"]),
    ]
    for label, value in sorted(options, key=lambda item: item[1], reverse=True):
        if label != primary and value >= 55:
            return label
    return "Practical Improver" if primary != "Practical Improver" else "Balanced Practical Player"


def evidence_for_traits(games: List[Dict[str, Any]], traits: Dict[str, int]) -> List[str]:
    evidence = []

    if traits["open_position_preference"] >= 62:
        evidence.append("You score best in games where the centre opens early.")
    if traits["short_game_success"] >= 62:
        evidence.append("Your wins are often decided before move 30.")
    if traits["king_safety_risk"] >= 60:
        evidence.append("Your losses often include delayed castling or exposed king positions.")
    if traits["simplified_position_comfort"] >= 60:
        evidence.append("You handle early queen trades and simplified positions well.")
    if traits["opposite_side_castling_frequency"] >= 55:
        evidence.append("Opposite-side castling appears often enough to support attacking or initiative plans.")
    if traits["endgame_conversion"] >= 60:
        evidence.append("You convert longer games better than the average game in this sample.")
    if traits["opening_phase_stability"] >= 62:
        evidence.append("Your opening phase is fairly stable because your games repeat the same families.")
    if traits["development_speed"] >= 62:
        evidence.append("You usually develop pieces and castle quickly in the opening.")
    if not evidence:
        evidence.append("OpeningFit found useful signals, but no single style pattern dominates yet.")

    if len(games) < 8:
        evidence.append("The sample is still small, so these style traits should be treated as a starting read.")

    return evidence[:5]


def build_style_fingerprint(games: List[Dict[str, Any]], username: Optional[str] = None) -> Dict[str, Any]:
    del username  # Reserved for future account-specific heuristics.

    parsed_games = [classify_game(game) for game in games if isinstance(game, dict)]
    parsed_games = [game for game in parsed_games if game["full_moves"] >= 4]
    game_count = len(parsed_games)

    if game_count < 3:
        return {
            "primary_style": "Developing Player",
            "primaryStyle": "Developing Player",
            "secondary_style": "Needs More Games",
            "secondaryStyle": "Needs More Games",
            "confidence": "low",
            "traits": dict(LOW_SAMPLE_TRAITS),
            "evidence": [
                "OpeningFit needs at least a few usable games before making a strong style read.",
                "The current fingerprint is a neutral baseline rather than a verdict.",
            ],
            "sample_size": game_count,
            "sampleSize": game_count,
            "method": "deterministic_pgn_heuristics_v1",
        }

    open_rate = rate_for_flag(parsed_games, "open_position")
    open_success = success_for_flag(parsed_games, "open_position")
    closed_rate = rate_for_flag(parsed_games, "closed_position")
    closed_success = success_for_flag(parsed_games, "closed_position")
    gambit_rate = rate_for_flag(parsed_games, "gambit_signal")
    gambit_success = success_for_flag(parsed_games, "gambit_signal")
    queen_trade_rate = rate_for_flag(parsed_games, "queen_trade_early")
    queen_trade_success = success_for_flag(parsed_games, "queen_trade_early")
    opposite_castle_rate = rate_for_flag(parsed_games, "opposite_side_castling")
    central_break_rate = average([min(1.0, game["central_breaks"] / 2) for game in parsed_games])
    early_attack_rate = average([min(1.0, game["early_attacks"] / 2) for game in parsed_games])
    development_rate = average([min(1.0, game["development_moves"] / 4) for game in parsed_games])
    castling_rate = rate_for_flag(parsed_games, "castled_by_move_12")
    delayed_loss_rate = rate(
        sum(1 for game in parsed_games if game["delayed_or_no_castle"] and game["result"] == "loss"),
        sum(1 for game in parsed_games if game["delayed_or_no_castle"]),
        default=0.0,
    )
    short_success = success_for_flag(parsed_games, "short_game")
    long_success = success_for_flag(parsed_games, "long_game")
    overall_success = average([game["score"] for game in parsed_games], default=0.5)

    tactical_signal = (
        (open_rate * 24)
        + (score_from_success(open_success) * 0.24)
        + (score_from_success(short_success) * 0.22)
        + (early_attack_rate * 18)
        + (opposite_castle_rate * 12)
    )
    positional_signal = (
        (closed_rate * 22)
        + (score_from_success(closed_success) * 0.24)
        + (score_from_success(long_success) * 0.20)
        + (queen_trade_rate * 12)
        + (castling_rate * 14)
    )

    traits = {
        "tactical_tendency": clamp_score(tactical_signal),
        "positional_tendency": clamp_score(positional_signal),
        "open_position_preference": clamp_score((open_rate * 48) + (score_from_success(open_success) * 0.52)),
        "closed_position_comfort": clamp_score((closed_rate * 45) + (score_from_success(closed_success) * 0.55)),
        "gambit_comfort": clamp_score((gambit_rate * 52) + (score_from_success(gambit_success) * 0.48)),
        "early_attack_frequency": clamp_score(early_attack_rate * 100),
        "queen_trade_frequency": clamp_score(queen_trade_rate * 100),
        "simplified_position_comfort": clamp_score((queen_trade_rate * 40) + (score_from_success(queen_trade_success) * 0.60)),
        "castling_consistency": clamp_score(castling_rate * 100),
        "opposite_side_castling_frequency": clamp_score(opposite_castle_rate * 100),
        "central_pawn_break_frequency": clamp_score(central_break_rate * 100),
        "development_speed": clamp_score(development_rate * 100),
        "king_safety_risk": clamp_score((1 - castling_rate) * 45 + delayed_loss_rate * 55),
        "endgame_conversion": clamp_score(score_from_success(long_success) if any(game["long_game"] for game in parsed_games) else 45 + (overall_success * 10)),
        "short_game_success": clamp_score(score_from_success(short_success) if any(game["short_game"] for game in parsed_games) else 45 + (overall_success * 10)),
        "long_game_success": clamp_score(score_from_success(long_success) if any(game["long_game"] for game in parsed_games) else 45 + (overall_success * 10)),
        "opening_phase_stability": opening_stability_score(parsed_games),
    }

    primary = primary_style_for_traits(traits)
    secondary = secondary_style_for_traits(traits, primary)

    return {
        "primary_style": primary,
        "primaryStyle": primary,
        "secondary_style": secondary,
        "secondaryStyle": secondary,
        "confidence": confidence_for_count(game_count),
        "traits": traits,
        "evidence": evidence_for_traits(parsed_games, traits),
        "sample_size": game_count,
        "sampleSize": game_count,
        "method": "deterministic_pgn_heuristics_v1",
    }
