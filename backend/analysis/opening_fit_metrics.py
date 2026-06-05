from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any, Dict, List


def _moves_for_game(game: Dict[str, Any]) -> List[str]:
    moves = game.get("moves")
    if isinstance(moves, list):
        return [str(move) for move in moves if move]

    text = str(game.get("movesText") or game.get("moves_text") or game.get("moves") or game.get("pgn") or "")
    if not text:
        return []

    lines = [line for line in text.splitlines() if not line.lstrip().startswith("[")]
    move_text = " ".join(lines)
    move_text = re.sub(r"\{[^}]*\}", " ", move_text)
    move_text = re.sub(r"\([^)]*\)", " ", move_text)
    move_text = re.sub(r"\d+\.(\.\.)?", " ", move_text)
    move_text = re.sub(r"1-0|0-1|1/2-1/2|\*", " ", move_text)
    move_text = re.sub(r"\$\d+", " ", move_text)
    move_text = re.sub(r"\s+", " ", move_text).strip()
    return move_text.split() if move_text else []


def _fullmoves(game: Dict[str, Any]) -> int:
    moves = _moves_for_game(game)
    return (len(moves) + 1) // 2 if moves else 0


def _variation(game: Dict[str, Any], moves: List[str]) -> str:
    opening = str(game.get("opening") or game.get("name") or "Unknown Opening")
    early = " ".join(moves[:8])
    return f"{opening}: {early}".strip()


def _confidence(games: int) -> str:
    if games < 3:
        return "low"
    if games < 8:
        return "medium"
    return "high"


def _classify(games: int, win_rate: float, loss_rate: float, early_loss_rate: float) -> str:
    # Classifications are sample-aware. One or two games are reported with low
    # confidence, but they are not treated as firm recommendations.
    if games < 3:
        return "promising_small_sample"
    if win_rate >= 58 and loss_rate <= 35:
        return "strong_keep"
    if early_loss_rate >= 45 and games >= 3:
        return "needs_training_line"
    if win_rate >= 45 and early_loss_rate >= 30:
        return "good_opening_bad_execution"
    if loss_rate >= 55:
        return "weak_fit"
    return "good_opening_bad_execution" if win_rate >= 45 else "needs_training_line"


def _summary_row(name: str, row: Dict[str, Any]) -> Dict[str, Any]:
    games = int(row["games"] or 0)
    wins = int(row["wins"] or 0)
    losses = int(row["losses"] or 0)
    win_rate = round((wins / games) * 100, 1) if games else 0
    loss_rate = round((losses / games) * 100, 1) if games else 0
    early_loss_rate = round((row["early_losses"] / games) * 100, 1) if games else 0
    avg_length = round(sum(row["lengths"]) / len(row["lengths"]), 1) if row["lengths"] else 0
    classification = _classify(games, win_rate, loss_rate, early_loss_rate)

    return {
        "name": name,
        "games_played": games,
        "gamesPlayed": games,
        "games": games,
        "wins": wins,
        "draws": int(row["draws"] or 0),
        "losses": losses,
        "win_rate": win_rate,
        "winRate": win_rate,
        "loss_rate": loss_rate,
        "lossRate": loss_rate,
        "average_game_length": avg_length,
        "averageGameLength": avg_length,
        "result_by_colour": dict(row["by_colour"]),
        "resultByColour": dict(row["by_colour"]),
        "result_by_time_control": dict(row["by_time_control"]),
        "resultByTimeControl": dict(row["by_time_control"]),
        "early_loss_rate": early_loss_rate,
        "earlyLossRate": early_loss_rate,
        "confidence": _confidence(games),
        "fit_classification": classification,
        "fitClassification": classification,
    }


def _blank_row() -> Dict[str, Any]:
    return {
        "games": 0,
        "wins": 0,
        "draws": 0,
        "losses": 0,
        "early_losses": 0,
        "lengths": [],
        "by_colour": defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0}),
        "by_time_control": defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0}),
    }


def _add_game(row: Dict[str, Any], game: Dict[str, Any], fullmoves: int) -> None:
    result = str(game.get("result") or "unknown").lower()
    colour = str(game.get("colour") or game.get("color") or "unknown").lower()
    time_control = str(game.get("time_class") or game.get("timeClass") or "unknown").lower()

    row["games"] += 1
    row["lengths"].append(fullmoves)
    if result == "win":
        row["wins"] += 1
    elif result == "draw":
        row["draws"] += 1
    elif result == "loss":
        row["losses"] += 1
        if fullmoves and fullmoves <= 20:
            row["early_losses"] += 1

    for bucket in (row["by_colour"][colour], row["by_time_control"][time_control]):
        bucket["games"] += 1
        if result == "win":
            bucket["wins"] += 1
        elif result == "draw":
            bucket["draws"] += 1
        elif result == "loss":
            bucket["losses"] += 1


def build_opening_fit_metrics(games: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_opening: Dict[str, Dict[str, Any]] = defaultdict(_blank_row)
    by_variation: Dict[str, Dict[str, Any]] = defaultdict(_blank_row)

    for game in games or []:
        if not isinstance(game, dict):
            continue
        moves = _moves_for_game(game)
        fullmoves = _fullmoves(game)
        if not moves or fullmoves < 2:
            continue

        opening = str(game.get("opening") or game.get("name") or "Unknown Opening")
        variation = _variation(game, moves)
        _add_game(by_opening[opening], game, fullmoves)
        _add_game(by_variation[variation], game, fullmoves)

    opening_rows = [_summary_row(name, row) for name, row in by_opening.items()]
    variation_rows = [_summary_row(name, row) for name, row in by_variation.items()]
    weak_lines = [
        row
        for row in variation_rows
        if row["games"] >= 3 and row["losses"] >= 2 and row["loss_rate"] >= 50
    ]

    opening_rows.sort(key=lambda item: (item["games"], item["win_rate"]), reverse=True)
    variation_rows.sort(key=lambda item: (item["games"], item["loss_rate"]), reverse=True)
    weak_lines.sort(key=lambda item: (item["loss_rate"], item["losses"], item["games"]), reverse=True)

    return {
        "openings": opening_rows,
        "variations": variation_rows,
        "weak_lines": weak_lines[:8],
        "weakLines": weak_lines[:8],
        "method": "deterministic_opening_fit_metrics_v1",
    }


def merge_opening_fit_metrics(openings: List[Dict[str, Any]], metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
    by_name = {str(item.get("name") or ""): item for item in metrics.get("openings", [])}
    merged = []

    for opening in openings or []:
        name = str(opening.get("name") or "")
        metric = by_name.get(name)
        merged.append({**opening, **metric} if metric else opening)

    return merged
