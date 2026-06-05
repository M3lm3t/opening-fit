from __future__ import annotations

import hashlib
import io
import json
import os
import time
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import chess
    import chess.engine
    import chess.pgn
except Exception:  # pragma: no cover - defensive for minimal environments
    chess = None


CACHE_PATH = Path(os.getenv("ENGINE_ANALYSIS_CACHE_PATH", "data/engine_analysis_cache.json"))
DEFAULT_ENGINE_SUMMARY = {
    "enabled": False,
    "analysed_games": 0,
    "opening_accuracy_estimate": None,
    "common_issues": [],
    "style_adjustments": {},
}

ISSUE_EXAMPLES = {
    "poor_development": "Several early mistakes came before the minor pieces were developed.",
    "king_safety": "Several losses involved delayed castling before the position opened.",
    "premature_queen_movement": "Early queen moves repeatedly gave the opponent tempi.",
    "missed_tactic": "The engine swings point to missed tactical resources in the opening phase.",
    "central_collapse": "The largest swings often happened when the centre opened unfavourably.",
    "trapped_piece": "Some early mistakes left a piece short of safe squares.",
    "bad_pawn_structure": "Several early swings followed pawn moves that weakened the structure.",
    "walking_into_known_opening_danger": "Some mistakes appeared in sharp opening lines where precision matters early.",
}


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, value))


def pgn_hash(pgn: str) -> str:
    return hashlib.sha256(str(pgn or "").encode("utf-8", errors="ignore")).hexdigest()


def load_cache() -> Dict[str, Any]:
    if not CACHE_PATH.exists():
        return {}
    try:
        return json.loads(CACHE_PATH.read_text())
    except Exception:
        return {}


def save_cache(cache: Dict[str, Any]) -> None:
    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(cache, indent=2))
    except Exception:
        pass


def game_from_pgn(pgn: str):
    if not chess or not pgn:
        return None
    try:
        return chess.pgn.read_game(io.StringIO(pgn))
    except Exception:
        return None


def user_colour_for_game(game: Any, username: Optional[str], fallback: Optional[str] = None) -> Optional[bool]:
    fallback = str(fallback or "").lower()
    if fallback == "white":
        return chess.WHITE
    if fallback == "black":
        return chess.BLACK

    if not game or not username:
        return None

    username_lower = username.lower()
    white = str(game.headers.get("White", "")).lower()
    black = str(game.headers.get("Black", "")).lower()
    if username_lower and username_lower == white:
        return chess.WHITE
    if username_lower and username_lower == black:
        return chess.BLACK
    return None


def score_to_cp(score: Any, colour: bool) -> int:
    pov = score.pov(colour)
    if pov.is_mate():
        mate = pov.mate()
        if mate is None:
            return 0
        return 10000 if mate > 0 else -10000
    return int(pov.score(mate_score=10000) or 0)


def phase_for_fullmove(fullmove: int) -> str:
    if fullmove <= 12:
        return "opening"
    if fullmove <= 30:
        return "middlegame"
    return "endgame"


def material_count(board: Any, colour: bool, piece_type: int) -> int:
    return len(board.pieces(piece_type, colour))


def developed_minor_count(board: Any, colour: bool) -> int:
    home_squares = {
        chess.WHITE: {chess.B1, chess.C1, chess.F1, chess.G1},
        chess.BLACK: {chess.B8, chess.C8, chess.F8, chess.G8},
    }[colour]
    count = 0
    for square in board.pieces(chess.KNIGHT, colour) | board.pieces(chess.BISHOP, colour):
        if square not in home_squares:
            count += 1
    return count


def move_opens_centre(board: Any, move: Any) -> bool:
    from_file = chess.square_file(move.from_square)
    to_file = chess.square_file(move.to_square)
    return from_file in {2, 3, 4, 5} or to_file in {2, 3, 4, 5}


def is_piece_trap_signal(board: Any, move: Any, colour: bool) -> bool:
    piece = board.piece_at(move.from_square)
    if not piece or piece.color != colour or piece.piece_type not in {chess.BISHOP, chess.KNIGHT, chess.ROOK, chess.QUEEN}:
        return False
    next_board = board.copy(stack=False)
    try:
        next_board.push(move)
    except Exception:
        return False
    return next_board.is_attacked_by(not colour, move.to_square) and not next_board.attackers(colour, move.to_square)


def classify_issue(board: Any, move: Any, colour: bool, fullmove: int, opening_name: str, drop_cp: int) -> str:
    piece = board.piece_at(move.from_square)
    opening_lower = str(opening_name or "").lower()

    if fullmove <= 12 and not board.has_castling_rights(colour) and board.king(colour) and board.is_attacked_by(not colour, board.king(colour)):
        return "king_safety"
    if fullmove >= 8 and board.has_castling_rights(colour) and move_opens_centre(board, move):
        return "king_safety"
    if fullmove <= 10 and developed_minor_count(board, colour) < 2 and piece and piece.piece_type not in {chess.KNIGHT, chess.BISHOP, chess.KING}:
        return "poor_development"
    if fullmove <= 12 and piece and piece.piece_type == chess.QUEEN:
        return "premature_queen_movement"
    if fullmove <= 18 and ("gambit" in opening_lower or "sicilian" in opening_lower or "king's indian" in opening_lower) and drop_cp >= 180:
        return "walking_into_known_opening_danger"
    if move_opens_centre(board, move) and drop_cp >= 160:
        return "central_collapse"
    if is_piece_trap_signal(board, move, colour):
        return "trapped_piece"
    if piece and piece.piece_type == chess.PAWN and drop_cp >= 140:
        return "bad_pawn_structure"
    return "missed_tactic"


def analyse_single_game(
    engine: Any,
    pgn: str,
    username: Optional[str],
    fallback_colour: Optional[str],
    depth: int,
    per_position_time: float,
    deadline: float,
) -> Dict[str, Any]:
    game = game_from_pgn(pgn)
    if not game:
        return {"analysed": False, "reason": "invalid_pgn"}

    colour = user_colour_for_game(game, username, fallback_colour)
    if colour is None:
        return {"analysed": False, "reason": "unknown_user_colour"}

    opening_name = str(game.headers.get("Opening", ""))
    board = game.board()
    swings = []
    before_cp: Optional[int] = None

    for move in game.mainline_moves():
        if time.monotonic() >= deadline:
            return {"analysed": False, "reason": "timeout"}

        fullmove = board.fullmove_number
        mover = board.turn
        should_analyse = mover == colour and 4 <= fullmove <= 18
        before_board = board.copy(stack=False)

        if should_analyse:
            before_info = engine.analyse(before_board, chess.engine.Limit(depth=depth, time=per_position_time))
            before_cp = score_to_cp(before_info["score"], colour)

        board.push(move)

        if should_analyse and before_cp is not None:
            if time.monotonic() >= deadline:
                return {"analysed": False, "reason": "timeout"}
            after_info = engine.analyse(board, chess.engine.Limit(depth=depth, time=per_position_time))
            after_cp = score_to_cp(after_info["score"], colour)
            drop_cp = max(0, before_cp - after_cp)
            if drop_cp >= 100:
                issue = classify_issue(before_board, move, colour, fullmove, opening_name, drop_cp)
                swings.append(
                    {
                        "move": fullmove,
                        "phase": phase_for_fullmove(fullmove),
                        "drop_cp": drop_cp,
                        "issue_type": issue,
                        "san": before_board.san(move),
                    }
                )

    largest_drop = max((swing["drop_cp"] for swing in swings), default=0)
    accuracy = max(0, min(100, round(100 - (largest_drop / 8) - (len(swings) * 4))))

    return {
        "analysed": True,
        "opening_accuracy_estimate": accuracy,
        "first_major_eval_swing": next((swing for swing in swings if swing["drop_cp"] >= 150), None),
        "swings": swings,
    }


def summarise_game_results(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    analysed = [result for result in results if result.get("analysed")]
    if not analysed:
        return {
            **DEFAULT_ENGINE_SUMMARY,
            "enabled": True,
            "analysed_games": 0,
            "opening_accuracy_estimate": None,
        }

    def accuracy_trend(values: List[float]) -> str:
        if len(values) < 4:
            return "insufficient_data"
        midpoint = len(values) // 2
        early = sum(values[:midpoint]) / midpoint
        recent = sum(values[midpoint:]) / (len(values) - midpoint)
        if recent >= early + 6:
            return "improving"
        if recent <= early - 6:
            return "declining"
        return "stable"

    issue_counts = Counter()
    phases = Counter()
    accuracy_values = []

    for result in analysed:
        if isinstance(result.get("opening_accuracy_estimate"), (int, float)):
            accuracy_values.append(float(result["opening_accuracy_estimate"]))
        first_swing = result.get("first_major_eval_swing") or {}
        if first_swing.get("phase"):
            phases[first_swing["phase"]] += 1
        for swing in result.get("swings") or []:
            issue_counts[swing.get("issue_type", "missed_tactic")] += 1

    common_issues = [
        {
            "type": issue_type,
            "frequency": frequency,
            "example": ISSUE_EXAMPLES.get(issue_type, "The engine found repeated opening-phase mistakes."),
        }
        for issue_type, frequency in issue_counts.most_common(5)
    ]

    style_adjustments = {}
    if issue_counts["king_safety"] >= 2:
        style_adjustments["king_safety_risk"] = min(14, 4 + issue_counts["king_safety"] * 2)
    if issue_counts["central_collapse"] >= 2:
        style_adjustments["open_position_preference"] = min(10, 3 + issue_counts["central_collapse"])
        style_adjustments["opening_phase_stability"] = -min(10, 3 + issue_counts["central_collapse"])
    if issue_counts["walking_into_known_opening_danger"] >= 1:
        style_adjustments["gambit_comfort"] = -min(8, 3 + issue_counts["walking_into_known_opening_danger"] * 2)
    if issue_counts["poor_development"] >= 2:
        style_adjustments["development_speed"] = -min(10, issue_counts["poor_development"] * 2)
    if issue_counts["missed_tactic"] >= 2:
        style_adjustments["tactical_tendency"] = min(8, issue_counts["missed_tactic"] * 2)

    return {
        "enabled": True,
        "analysed_games": len(analysed),
        "analysedGames": len(analysed),
        "opening_accuracy_estimate": round(sum(accuracy_values) / len(accuracy_values)) if accuracy_values else None,
        "openingAccuracyEstimate": round(sum(accuracy_values) / len(accuracy_values)) if accuracy_values else None,
        "opening_accuracy_trend": accuracy_trend(accuracy_values),
        "openingAccuracyTrend": accuracy_trend(accuracy_values),
        "first_major_eval_swing": next((result.get("first_major_eval_swing") for result in analysed if result.get("first_major_eval_swing")), None),
        "firstMajorEvalSwing": next((result.get("first_major_eval_swing") for result in analysed if result.get("first_major_eval_swing")), None),
        "mistake_phase_distribution": dict(phases),
        "mistakePhaseDistribution": dict(phases),
        "common_issues": common_issues,
        "commonIssues": common_issues,
        "style_adjustments": style_adjustments,
        "styleAdjustments": style_adjustments,
    }


def apply_engine_adjustments_to_style_fingerprint(style_fingerprint: Dict[str, Any], engine_summary: Dict[str, Any]) -> Dict[str, Any]:
    adjusted = dict(style_fingerprint or {})
    traits = dict(adjusted.get("traits") or {})
    adjustments = engine_summary.get("style_adjustments") or {}

    for key, delta in adjustments.items():
        if key not in traits:
            continue
        try:
            traits[key] = int(round(max(0, min(100, float(traits[key]) + float(delta)))))
        except (TypeError, ValueError):
            continue

    if adjustments:
        adjusted["traits"] = traits
        adjusted["engine_adjusted"] = True
        adjusted["engineAdjusted"] = True
        adjusted["engine_summary"] = engine_summary
        adjusted["engineSummary"] = engine_summary
        adjusted["method"] = f"{adjusted.get('method', 'deterministic_pgn_heuristics_v1')}+stockfish_light_v1"
        evidence = list(adjusted.get("evidence") or [])
        evidence.append("A lightweight Stockfish pass nudged a few style traits without overriding the repertoire logic.")
        adjusted["evidence"] = evidence[:6]

    return adjusted


def build_engine_summary(
    games: List[Dict[str, Any]],
    username: Optional[str] = None,
    is_premium: bool = False,
) -> Dict[str, Any]:
    if not env_bool("ENGINE_ANALYSIS_ENABLED", False):
        return dict(DEFAULT_ENGINE_SUMMARY)
    if not chess:
        return {**DEFAULT_ENGINE_SUMMARY, "enabled": False, "reason": "python_chess_missing"}

    stockfish_path = os.getenv("STOCKFISH_PATH", "").strip()
    if not stockfish_path or not Path(stockfish_path).exists():
        return {**DEFAULT_ENGINE_SUMMARY, "enabled": False, "reason": "stockfish_missing"}

    depth = env_int("ENGINE_DEPTH", 10, 1, 18)
    timeout_seconds = env_int("ENGINE_TIMEOUT_SECONDS", 20, 2, 120)
    per_position_time = max(0.05, min(1.5, timeout_seconds / 30))
    free_limit = env_int("ENGINE_GAME_LIMIT_FREE", 6, 0, 100)
    premium_limit = env_int("ENGINE_GAME_LIMIT_PREMIUM", 20, 0, 200)
    game_limit = premium_limit if is_premium else free_limit

    candidates = [
        game
        for game in games or []
        if isinstance(game, dict) and str(game.get("pgn") or "").strip()
    ][:game_limit]

    if not candidates:
        return {**DEFAULT_ENGINE_SUMMARY, "enabled": True, "reason": "no_pgn_games"}

    cache = load_cache()
    results = []
    deadline = time.monotonic() + timeout_seconds
    engine = None

    try:
        engine = chess.engine.SimpleEngine.popen_uci(stockfish_path, timeout=min(5, timeout_seconds))

        for game in candidates:
            pgn = str(game.get("pgn") or "")
            key = pgn_hash(pgn)
            if key in cache:
                results.append(cache[key])
                continue
            if time.monotonic() >= deadline:
                break

            result = analyse_single_game(
                engine,
                pgn,
                username=username,
                fallback_colour=game.get("colour") or game.get("color"),
                depth=depth,
                per_position_time=per_position_time,
                deadline=deadline,
            )
            cache[key] = result
            results.append(result)
    except Exception as exc:
        return {**DEFAULT_ENGINE_SUMMARY, "enabled": False, "reason": "engine_failed", "error": str(exc)[:160]}
    finally:
        if engine:
            try:
                engine.quit()
            except Exception:
                pass
        save_cache(cache)

    summary = summarise_game_results(results)
    summary["depth"] = depth
    summary["per_position_time_seconds"] = per_position_time
    summary["perPositionTimeSeconds"] = per_position_time
    summary["game_limit"] = game_limit
    summary["gameLimit"] = game_limit
    return summary
