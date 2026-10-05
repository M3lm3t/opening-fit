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


def _structure_key(moves: List[str], plies: int) -> str:
    return " ".join(str(move).rstrip("+#?!") for move in moves[:plies] if move)


def _result_score(stats: Dict[str, int]) -> float:
    games = int(stats.get("games", 0) or 0)
    if not games:
        return 0
    wins = int(stats.get("wins", 0) or 0)
    draws = int(stats.get("draws", 0) or 0)
    return ((wins + 0.5 * draws) / games) * 100


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
    plan_clarity = _plan_clarity(name, row)

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
        **plan_clarity,
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
        "plan_structures": {
            6: defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0}),
            8: defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0}),
            10: defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0}),
        },
    }


def _add_result(stats: Dict[str, int], result: str) -> None:
    if result == "win":
        stats["wins"] += 1
    elif result == "draw":
        stats["draws"] += 1
    elif result == "loss":
        stats["losses"] += 1


def _add_game(row: Dict[str, Any], game: Dict[str, Any], moves: List[str], fullmoves: int) -> None:
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
        _add_result(bucket, result)

    for plies, structures in row["plan_structures"].items():
        key = _structure_key(moves, plies)
        if not key:
            continue
        structure = structures[key]
        structure["games"] += 1
        _add_result(structure, result)


def _plan_clarity(name: str, row: Dict[str, Any]) -> Dict[str, Any]:
    games = int(row.get("games", 0) or 0)
    structures_by_ply = row.get("plan_structures") or {}
    breakdown = {}
    concentration_total = 0.0
    branching_total = 0.0
    weight_total = 0.0
    repeated_scores = []
    best_sequence = ""
    best_count = 0
    best_plies = 0

    for plies, weight in [(6, 0.30), (8, 0.35), (10, 0.35)]:
        structures = structures_by_ply.get(plies) or {}
        total = sum(int(stats.get("games", 0) or 0) for stats in structures.values())
        ranked = sorted(
            structures.items(),
            key=lambda item: (int(item[1].get("games", 0) or 0), len(str(item[0]))),
            reverse=True,
        )
        top_sequence, top_stats = ranked[0] if ranked else ("", {})
        top_count = int(top_stats.get("games", 0) or 0)
        top_pct = (top_count / total) * 100 if total else 0
        singletons = sum(1 for stats in structures.values() if int(stats.get("games", 0) or 0) == 1)
        singleton_pct = (singletons / total) * 100 if total else 0
        branch_count = len(structures)
        branch_penalty = max(0, branch_count - 1) * 11 + singleton_pct * 0.35
        branching_score = max(0, min(100, 100 - branch_penalty))

        concentration_total += top_pct * weight
        branching_total += branching_score * weight
        weight_total += weight

        repeated = []
        for sequence, stats in ranked:
            structure_games = int(stats.get("games", 0) or 0)
            if structure_games < 2:
                continue
            score = round(_result_score(stats), 1)
            repeated.append({"sequence": sequence, "games": structure_games, "score": score})
            repeated_scores.append(score)

        if top_count > best_count or (top_count == best_count and plies > best_plies):
            best_sequence = str(top_sequence)
            best_count = top_count
            best_plies = plies

        breakdown[str(plies)] = {
            "plies": plies,
            "topSequence": top_sequence,
            "topCount": top_count,
            "topPercentage": round(top_pct, 1),
            "branchCount": branch_count,
            "singletonPercentage": round(singleton_pct, 1),
            "branchingScore": round(branching_score),
            "repeatedStructures": repeated[:4],
        }

    concentration_score = round(concentration_total / weight_total) if weight_total else 0
    branching_score = round(branching_total / weight_total) if weight_total else 0
    if len(repeated_scores) >= 2:
        result_stability = max(20, round(100 - min(80, max(repeated_scores) - min(repeated_scores))))
    elif repeated_scores:
        result_stability = 70
    else:
        result_stability = 35

    score = round(concentration_score * 0.45 + branching_score * 0.30 + result_stability * 0.25)

    if games < 3 or not best_sequence:
        status = "Too little data"
        note = f"{name}: Too little data. There are not enough repeated games to judge the plan after the opening."
    elif score >= 72 and best_count >= 3:
        status = "Clear plan"
        note = f"{name}: Clear plan. You usually reach similar structures by move {max(3, best_plies // 2)}."
    elif score >= 52:
        status = "Some plan"
        note = f"{name}: Some plan. A main setup is visible, but your follow-up choices still branch."
    else:
        status = "Unclear plan"
        note = f"{name}: Unclear plan. Your early setup and follow-up structures vary heavily."

    return {
        "plan_clarity_status": status,
        "planClarityStatus": status,
        "plan_clarity_score": score,
        "planClarityScore": score,
        "plan_clarity_note": note,
        "planClarityNote": note,
        "plan_clarity_best_sequence": best_sequence,
        "planClarityBestSequence": best_sequence,
        "plan_clarity_branching_score": branching_score,
        "planClarityBranchingScore": branching_score,
        "plan_clarity_result_stability": result_stability,
        "planClarityResultStability": result_stability,
        "plan_clarity_breakdown": breakdown,
        "planClarityBreakdown": breakdown,
    }


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
        _add_game(by_opening[opening], game, moves, fullmoves)
        _add_game(by_variation[variation], game, moves, fullmoves)

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
