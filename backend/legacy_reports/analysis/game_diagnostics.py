from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional


PHASES = ("opening", "transition", "middlegame", "endgame")
PATTERN_LABELS = {
    "delayed_castling": "Delayed castling showed up before the position was settled.",
    "early_queen_move": "The queen came out early, giving the opponent tempo targets.",
    "repeated_piece_moves": "The same piece moved repeatedly before development was complete.",
    "undeveloped_by_move_10": "Too many minor pieces were still undeveloped around move 10.",
    "early_pawn_grabbing": "Several games included early pawn grabs before development was secure.",
    "queen_trade_early": "Early queen trades may be pulling you into simplified positions too soon.",
    "opposite_side_castling": "Opposite-side castling led to sharper races than the rest of the opening.",
    "short_loss": "Some losses ended before the middlegame really settled.",
    "long_game_conversion_issue": "Long games suggest conversion or endurance issues after the opening.",
    "opening_instability": "Repeated early losses point to unstable opening lines.",
}


def _strip_pgn_to_moves(pgn: str) -> List[str]:
    if not pgn:
        return []

    move_text = " ".join(line for line in str(pgn).splitlines() if not line.startswith("["))
    move_text = re.sub(r"\{[^}]*\}", " ", move_text)
    move_text = re.sub(r"\([^)]*\)", " ", move_text)
    move_text = re.sub(r"\$\d+", " ", move_text)
    move_text = re.sub(r"\d+\.(\.\.)?", " ", move_text)
    move_text = re.sub(r"1-0|0-1|1/2-1/2|\*", " ", move_text)
    move_text = re.sub(r"\s+", " ", move_text).strip()
    moves = [move for move in move_text.split(" ") if move]

    # Keep only SAN-like move tokens. If parsing gets weird, returning a partial
    # list is better than failing the entire import.
    return [
        move
        for move in moves
        if not move.startswith("[") and not move.startswith("%") and "..." not in move
    ]


def _fullmove_count(moves: List[str]) -> int:
    return max(1, (len(moves) + 1) // 2) if moves else 0


def _phase_for_move(move_number: int) -> str:
    if move_number <= 10:
        return "opening"
    if move_number <= 20:
        return "transition"
    if move_number <= 40:
        return "middlegame"
    return "endgame"


def _result_for_user(game: Dict[str, Any]) -> str:
    return str(game.get("result") or game.get("user_result") or "").lower()


def _colour_for_user(game: Dict[str, Any]) -> str:
    return str(game.get("colour") or game.get("color") or "").lower()


def _user_moves(moves: List[str], colour: str) -> List[str]:
    if colour == "white":
        return moves[0::2]
    if colour == "black":
        return moves[1::2]
    return []


def _is_minor_development(move: str) -> bool:
    clean = move.replace("+", "").replace("#", "")
    return clean.startswith("N") or clean.startswith("B")


def _piece_origin_key(move: str) -> Optional[str]:
    clean = move.replace("+", "").replace("#", "").replace("x", "")
    if not clean or clean[0] not in "NBRQK":
        return None
    # SAN does not always expose source squares. The piece plus destination is a
    # conservative proxy for "same piece kept moving" without needing an engine.
    destination = re.search(r"([a-h][1-8])", clean)
    return f"{clean[0]}:{destination.group(1) if destination else clean[:3]}"


def _variation_key(opening: str, moves: List[str], plies: int = 8) -> str:
    early = " ".join(moves[:plies])
    return f"{opening or 'Unknown Opening'}: {early}".strip()


def _variation_label(opening: str, moves: List[str], plies: int = 8) -> str:
    early = " ".join(moves[:plies])
    return f"{opening or 'Unknown Opening'} ({early})" if early else opening or "Unknown Opening"


def _detect_patterns(game: Dict[str, Any], moves: List[str]) -> List[str]:
    colour = _colour_for_user(game)
    user_moves = _user_moves(moves, colour)
    fullmoves = _fullmove_count(moves)
    result = _result_for_user(game)
    tags = set()

    early_user_moves = user_moves[:10]
    early_all_moves = moves[:20]

    # These are intentionally shallow PGN heuristics. They are diagnostic hints,
    # not engine claims, and only become "common" after repeated occurrence.
    castle_index = next(
        (index for index, move in enumerate(user_moves, start=1) if move in {"O-O", "O-O-O", "0-0", "0-0-0"}),
        None,
    )
    if (castle_index is None or castle_index > 10) and fullmoves >= 10:
        tags.add("delayed_castling")

    if any(move.startswith("Q") for move in early_user_moves[:6]):
        tags.add("early_queen_move")

    piece_keys = [_piece_origin_key(move) for move in early_user_moves[:8]]
    piece_repeats = Counter(key for key in piece_keys if key)
    if any(count >= 2 for count in piece_repeats.values()):
        tags.add("repeated_piece_moves")

    if sum(1 for move in early_user_moves[:10] if _is_minor_development(move)) < 3 and fullmoves >= 10:
        tags.add("undeveloped_by_move_10")

    if any(re.match(r"^[a-h]x", move) for move in early_user_moves[:8]):
        tags.add("early_pawn_grabbing")

    queen_capture_indexes = [
        index
        for index, move in enumerate(early_all_moves[:16])
        if move.startswith("Q") and "x" in move
    ]
    if len(queen_capture_indexes) >= 2 and queen_capture_indexes[-1] - queen_capture_indexes[0] <= 4:
        tags.add("queen_trade_early")

    white_castle = next((move for move in moves[0::2] if move in {"O-O", "O-O-O", "0-0", "0-0-0"}), "")
    black_castle = next((move for move in moves[1::2] if move in {"O-O", "O-O-O", "0-0", "0-0-0"}), "")
    if white_castle and black_castle and white_castle != black_castle:
        tags.add("opposite_side_castling")

    if result == "loss" and fullmoves <= 20:
        tags.add("short_loss")
    if result != "win" and fullmoves >= 41:
        tags.add("long_game_conversion_issue")
    if result == "loss" and fullmoves <= 25:
        tags.add("opening_instability")

    return sorted(tags)


def _issue_phase_for_game(result: str, fullmoves: int, patterns: List[str]) -> Optional[str]:
    if result == "win":
        return None
    if "short_loss" in patterns or "opening_instability" in patterns:
        if fullmoves <= 10:
            return "opening"
        if fullmoves <= 20:
            return "transition"
    if "long_game_conversion_issue" in patterns:
        return "endgame"
    return _phase_for_move(fullmoves)


def _confidence(sample_size: int, issue_games: int) -> str:
    if sample_size < 5 or issue_games < 2:
        return "low"
    if sample_size < 12 or issue_games < 5:
        return "medium"
    return "high"


def build_diagnostic_summary(games: List[Dict[str, Any]], username: Optional[str] = None) -> Dict[str, Any]:
    analysed_games = []
    phase_counts = Counter()
    pattern_counts = Counter()
    variation_rows: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"line": "", "opening": "", "games": 0, "wins": 0, "draws": 0, "losses": 0, "patterns": Counter()}
    )

    for game in games or []:
        try:
            moves = game.get("moves") if isinstance(game.get("moves"), list) else _strip_pgn_to_moves(str(game.get("pgn") or ""))
            if not moves:
                continue

            result = _result_for_user(game)
            opening = str(game.get("opening") or game.get("name") or "Unknown Opening")
            fullmoves = _fullmove_count(moves)
            patterns = _detect_patterns(game, moves)
            issue_phase = _issue_phase_for_game(result, fullmoves, patterns)

            if issue_phase:
                phase_counts[issue_phase] += 1
            pattern_counts.update(patterns)

            key = _variation_key(opening, moves)
            row = variation_rows[key]
            row["line"] = _variation_label(opening, moves)
            row["opening"] = opening
            row["games"] += 1
            if result == "win":
                row["wins"] += 1
            elif result == "draw":
                row["draws"] += 1
            elif result == "loss":
                row["losses"] += 1
            row["patterns"].update(patterns)

            analysed_games.append(
                {
                    "phase": issue_phase,
                    "patterns": patterns,
                    "result": result,
                    "fullmoves": fullmoves,
                }
            )
        except Exception:
            continue

    issue_games = sum(phase_counts.values())
    main_issue_phase = phase_counts.most_common(1)[0][0] if phase_counts else "opening"
    confidence = _confidence(len(analysed_games), issue_games)

    weak_variations = []
    for row in variation_rows.values():
        games_count = row["games"]
        if games_count < 3:
            continue
        loss_rate = row["losses"] / games_count if games_count else 0
        if row["losses"] < 2 or loss_rate < 0.5:
            continue
        weak_variations.append(
            {
                "line": row["line"],
                "opening": row["opening"],
                "games": games_count,
                "losses": row["losses"],
                "loss_rate": round(loss_rate * 100),
                "lossRate": round(loss_rate * 100),
                "common_patterns": [pattern for pattern, _count in row["patterns"].most_common(3)],
                "commonPatterns": [pattern for pattern, _count in row["patterns"].most_common(3)],
            }
        )

    weak_variations.sort(key=lambda item: (item["loss_rate"], item["losses"], item["games"]), reverse=True)

    common_patterns = [
        {
            "type": pattern,
            "frequency": count,
            "example": PATTERN_LABELS.get(pattern, "This pattern appeared in several analysed games."),
        }
        for pattern, count in pattern_counts.most_common(6)
        if count >= 2
    ]

    coach_notes = []
    if confidence == "low":
        coach_notes.append("The sample is still small, so treat these as early clues rather than firm conclusions.")
    if main_issue_phase == "opening":
        coach_notes.append("Your fastest improvement likely comes from making the first 10 moves more repeatable.")
    elif main_issue_phase == "transition":
        coach_notes.append("The recurring danger is the handoff from opening setup into the first middlegame plan.")
    elif main_issue_phase == "middlegame":
        coach_notes.append("Your openings are reaching playable positions, but the plan around moves 21-40 needs attention.")
    elif main_issue_phase == "endgame":
        coach_notes.append("You are surviving the opening often enough; focus on converting long games cleanly.")
    if weak_variations:
        coach_notes.append("Review the repeated weak variation first instead of switching your whole repertoire.")
    if common_patterns:
        top_pattern = common_patterns[0]["type"]
        coach_notes.append(PATTERN_LABELS.get(top_pattern, "One mistake pattern appears often enough to train directly."))

    return {
        "main_issue_phase": main_issue_phase,
        "mainIssuePhase": main_issue_phase,
        "confidence": confidence,
        "sample_size": len(analysed_games),
        "sampleSize": len(analysed_games),
        "phase_counts": dict(phase_counts),
        "phaseCounts": dict(phase_counts),
        "common_patterns": common_patterns,
        "commonPatterns": common_patterns,
        "weak_variations": weak_variations[:6],
        "weakVariations": weak_variations[:6],
        "coach_notes": coach_notes[:5],
        "coachNotes": coach_notes[:5],
        "method": "deterministic_pgn_diagnostics_v1",
    }
