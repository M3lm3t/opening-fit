from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any, Dict, Iterable, List, Optional, Tuple


UNKNOWN_OPENING = "Unclassified opening"


def _as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _num(value: Any, default: Optional[float] = None) -> Optional[float]:
    if isinstance(value, bool):
        return default
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number != number:
        return default
    return number


def _int(value: Any, default: int = 0) -> int:
    number = _num(value)
    return int(number) if number is not None else default


def _clean_opening_name(value: Any) -> str:
    if not isinstance(value, str):
        return UNKNOWN_OPENING
    name = re.sub(r"\s+", " ", value).strip()
    return name or UNKNOWN_OPENING


def _opening_name(item: Dict[str, Any]) -> str:
    opening = item.get("opening")
    if isinstance(opening, dict):
        return _clean_opening_name(opening.get("name"))
    return _clean_opening_name(
        item.get("openingName")
        or item.get("opening_name")
        or item.get("name")
        or item.get("eco_name")
        or opening
    )


def _normalise_score(value: Any) -> Optional[float]:
    score = _num(value)
    if score is None:
        return None
    if 0 <= score <= 1:
        score *= 100
    return max(0.0, min(100.0, score))


def _moves_for_game(game: Dict[str, Any]) -> List[str]:
    moves = game.get("moves")
    if isinstance(moves, list):
        return [str(move) for move in moves if str(move).strip()]
    text = game.get("movesText") or game.get("moves_text") or game.get("moves")
    if isinstance(text, str) and text.strip():
        return _moves_from_text(text)
    pgn = game.get("pgn")
    if isinstance(pgn, str) and pgn.strip():
        return _moves_from_text(pgn)
    return []


def _moves_from_text(text: str) -> List[str]:
    text = re.sub(r"\{[^}]*\}", " ", text)
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"\[[^\]]*\]", " ", text)
    tokens = re.split(r"\s+", text.replace("\n", " ").strip())
    moves: List[str] = []
    for token in tokens:
        token = token.strip()
        if not token or token in {"1-0", "0-1", "1/2-1/2", "*"}:
            continue
        if re.match(r"^\d+\.(\.\.)?$", token):
            continue
        if token.startswith("$"):
            continue
        moves.append(token)
    return moves


def _fullmove_count(game: Dict[str, Any]) -> Optional[int]:
    explicit = _num(game.get("moveCount") or game.get("move_count"))
    if explicit is not None:
        return int(explicit)
    moves = _moves_for_game(game)
    if moves:
        return max(1, (len(moves) + 1) // 2)
    return None


def _result(game: Dict[str, Any]) -> str:
    value = str(game.get("result") or "").lower()
    if value in {"win", "won", "1-0"}:
        return "win"
    if value in {"loss", "lost", "0-1"}:
        return "loss"
    if value in {"draw", "1/2-1/2"}:
        return "draw"
    return "unknown"


def _game_phase_issue(game: Dict[str, Any]) -> str:
    loss_timing = _as_dict(game.get("loss_timing") or game.get("lossTiming"))
    bucket = str(loss_timing.get("bucket") or loss_timing.get("phase") or "").lower()
    if bucket in {"opening", "early"}:
        return "opening"
    if bucket in {"transition", "early_middlegame"}:
        return "transition"
    if bucket in {"middlegame", "late_middlegame", "endgame"}:
        return "middlegame"

    move_count = _fullmove_count(game)
    if _result(game) != "loss" or move_count is None:
        return "unclear"
    if move_count <= 12:
        return "opening"
    if move_count <= 24:
        return "transition"
    return "middlegame"


def _confidence_label(sample_size: int) -> str:
    if sample_size < 5:
        return "low"
    if sample_size < 12:
        return "medium"
    return "high"


def _confidence_reason(sample_size: int) -> str:
    if sample_size < 5:
        return f"Only {sample_size} analysed game{'s' if sample_size != 1 else ''}; treat this as an early signal."
    if sample_size < 12:
        return f"{sample_size} analysed games gives a usable trend, but it can still move quickly."
    return f"{sample_size} analysed games gives a stable enough sample for coaching priorities."


def _pick_report_list(report: Dict[str, Any], *keys: str) -> List[Any]:
    for key in keys:
        value = report.get(key)
        if isinstance(value, list):
            return value
    return []


def _pick_report_dict(report: Dict[str, Any], *keys: str) -> Dict[str, Any]:
    for key in keys:
        value = report.get(key)
        if isinstance(value, dict):
            return value
    return {}


def _opening_rows(report: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows = _pick_report_list(report, "best_openings", "bestOpenings", "top_openings", "topOpenings")
    metrics = _pick_report_dict(report, "opening_fit_metrics", "openingFitMetrics")
    metric_rows = _as_list(metrics.get("openings"))

    by_name: Dict[str, Dict[str, Any]] = {}
    for row in metric_rows + rows:
        if not isinstance(row, dict):
            continue
        name = _opening_name(row)
        existing = by_name.setdefault(name, {})
        existing.update(row)
        existing.setdefault("name", name)
    return list(by_name.values())


def _report_games(report: Dict[str, Any]) -> List[Dict[str, Any]]:
    games: List[Dict[str, Any]] = []
    for key in ("recent_games", "recentGames", "opening_games", "openingGames", "games"):
        for game in _as_list(report.get(key)):
            if isinstance(game, dict):
                games.append(game)

    seen = set()
    unique = []
    for game in games:
        marker = (
            game.get("url")
            or game.get("gameUrl")
            or game.get("end_time")
            or game.get("endTime")
        )
        if marker and marker in seen:
            continue
        if marker:
            seen.add(marker)
        unique.append(game)
    return unique


def _stats_from_row(row: Dict[str, Any], grouped_games: List[Dict[str, Any]]) -> Dict[str, Any]:
    games = _int(
        row.get("games")
        or row.get("games_played")
        or row.get("gamesPlayed")
        or row.get("sampleSize")
        or len(grouped_games),
        len(grouped_games),
    )
    wins = _int(row.get("wins"))
    draws = _int(row.get("draws"))
    losses = _int(row.get("losses"))
    if wins + draws + losses == 0 and grouped_games:
        results = Counter(_result(game) for game in grouped_games)
        wins = results["win"]
        draws = results["draw"]
        losses = results["loss"]
        games = max(games, wins + draws + losses)

    win_rate = _num(row.get("winRate") or row.get("win_rate") or row.get("scoreRate"))
    if win_rate is None and games:
        win_rate = round((wins + draws * 0.5) / games * 100, 1)
    elif win_rate is not None and 0 <= win_rate <= 1:
        win_rate = round(win_rate * 100, 1)

    score = _normalise_score(
        row.get("fitScore")
        or row.get("fit_score")
        or row.get("score")
        or row.get("openingFitScore")
        or win_rate
    )

    return {
        "games": max(games, len(grouped_games)),
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "win_rate": round(win_rate, 1) if win_rate is not None else None,
        "score": round(score, 1) if score is not None else None,
    }


def _phase_counts(games: List[Dict[str, Any]]) -> Counter:
    counts = Counter()
    for game in games:
        phase = _game_phase_issue(game)
        if phase != "unclear":
            counts[phase] += 1
    return counts


def _phase_assessment(games_count: int, counts: Counter) -> Dict[str, str]:
    assessment: Dict[str, str] = {}
    for phase in ("opening", "transition", "middlegame"):
        if games_count < 5:
            assessment[phase] = "unclear"
            continue
        rate = counts[phase] / max(1, games_count)
        if rate >= 0.35 and counts[phase] >= 2:
            assessment[phase] = "needs_work"
        elif rate <= 0.15:
            assessment[phase] = "strong"
        else:
            assessment[phase] = "stable"
    return assessment


def _issue_type(games_count: int, counts: Counter, score: Optional[float]) -> str:
    if games_count < 5:
        return "insufficient_data"
    opening_rate = counts["opening"] / max(1, games_count)
    transition_rate = counts["transition"] / max(1, games_count)
    middlegame_rate = counts["middlegame"] / max(1, games_count)
    has_opening = counts["opening"] >= 2 and opening_rate >= 0.35
    has_transition = counts["transition"] >= 2 and transition_rate >= 0.35
    has_middlegame = counts["middlegame"] >= 2 and middlegame_rate >= 0.35

    if has_opening and (has_transition or has_middlegame):
        return "mixed"
    if has_opening:
        return "opening"
    if has_transition:
        return "transition"
    if has_middlegame:
        return "middlegame"
    if score is not None and score < 40 and counts["opening"] + counts["transition"] >= 2:
        return "mixed"
    return "insufficient_data"


def _verdict(issue: str, games: int, score: Optional[float], win_rate: Optional[float]) -> str:
    result_score = score if score is not None else win_rate
    if games < 5:
        return "watch"
    if result_score is not None and result_score >= 58 and issue not in {"opening", "mixed"}:
        return "keep"
    if result_score is not None and result_score < 35 and issue in {"opening", "mixed"}:
        return "avoid_for_now"
    if issue in {"opening", "transition", "mixed"} or (result_score is not None and result_score < 50):
        return "improve"
    return "watch"


def _common_reply(games: List[Dict[str, Any]]) -> Optional[str]:
    replies = Counter()
    for game in games:
        moves = _moves_for_game(game)
        colour = str(game.get("colour") or game.get("color") or "").lower()
        if colour == "white" and len(moves) >= 2:
            replies[moves[1]] += 1
        elif colour == "black" and moves:
            replies[moves[0]] += 1
    if not replies:
        return None
    reply, count = replies.most_common(1)[0]
    return reply if count >= 2 else None


def _recurring_issue(opening_name: str, issue: str, games: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if issue not in {"opening", "transition", "mixed"} or len(games) < 5:
        return None
    phase = "opening" if issue in {"opening", "mixed"} else "transition"
    reply = _common_reply(games)
    move_range = "moves 1-12" if phase == "opening" else "moves 9-20"
    title = "Repeated early trouble" if phase == "opening" else "Opening-to-middlegame handoff"
    description = (
        f"{opening_name} is showing repeated problems in the first 12 moves."
        if phase == "opening"
        else f"{opening_name} usually reaches play, but the next decisions are costing games."
    )
    prompt = (
        f"Replay the {opening_name} main setup and stop after move 12 to choose a safer plan."
        if phase == "opening"
        else f"Practice three typical plans after development in the {opening_name}."
    )
    return {
        "title": title,
        "description": description,
        "moveRange": move_range,
        "commonOpponentReply": reply,
        "practicePrompt": prompt,
    }


def _score_breakdown(stats: Dict[str, Any], counts: Counter, games_count: int) -> Dict[str, Any]:
    score = stats["score"]
    result_component = stats["win_rate"]
    opening_reliability = round(100 - (counts["opening"] / max(1, games_count) * 100), 1) if games_count else None
    consistency = round(100 - ((counts["opening"] + counts["transition"]) / max(1, games_count) * 100), 1) if games_count else None
    return {
        "overall": score,
        "results": result_component,
        "openingPhaseReliability": opening_reliability,
        "consistency": consistency,
        "explanation": "Uses existing fit score when available, then result rate and repeated phase issues from imported games.",
    }


def _diagnostic(row: Dict[str, Any], grouped_games: List[Dict[str, Any]]) -> Dict[str, Any]:
    name = _opening_name(row)
    stats = _stats_from_row(row, grouped_games)
    counts = _phase_counts(grouped_games)
    issue = _issue_type(stats["games"], counts, stats["score"])
    phase = _phase_assessment(stats["games"], counts)
    verdict = _verdict(issue, stats["games"], stats["score"], stats["win_rate"])
    confidence = _confidence_label(stats["games"])

    if issue == "opening":
        explanation = "The same opening phase is appearing in repeated losses, so practise the first decisions before adding theory."
        recommendation = "Review the first 8-12 moves and build one simple answer to the common reply."
    elif issue == "transition":
        explanation = "The opening is usually playable, but the handoff into the middlegame needs a clearer plan."
        recommendation = "Practise the first middlegame plan after development rather than replacing the opening."
    elif issue == "middlegame":
        explanation = "The losses are arriving later, so the opening itself is not the main suspect."
        recommendation = "Keep the opening and train typical middlegame plans from the positions you reach."
    elif issue == "mixed":
        explanation = "There are several repeat problems across the opening and the next phase."
        recommendation = "Use this as an improve line and work from the earliest repeated issue first."
    else:
        explanation = "There is not enough repeated evidence to call this a weakness yet."
        recommendation = "Keep collecting games before changing this part of the repertoire."

    evidence = [
        f"{stats['games']} analysed game{'s' if stats['games'] != 1 else ''}",
    ]
    if stats["win_rate"] is not None:
        evidence.append(f"{stats['win_rate']}% score rate")
    if counts:
        evidence.append(
            f"phase issues: opening {counts['opening']}, transition {counts['transition']}, middlegame {counts['middlegame']}"
        )

    return {
        "openingName": name,
        "verdict": verdict,
        "confidence": confidence,
        "games": stats["games"],
        "winRate": stats["win_rate"],
        "openingHealthScore": stats["score"],
        "phaseAssessment": phase,
        "explanation": explanation,
        "evidence": evidence,
        "recurringIssue": _recurring_issue(name, issue, grouped_games),
        "recommendation": recommendation,
        "issueType": issue,
        "scoreBreakdown": _score_breakdown(stats, counts, max(1, len(grouped_games) or stats["games"])),
    }


def _build_diagnostics(report: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    games = _report_games(report)
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for game in games:
        grouped[_opening_name(game)].append(game)

    rows = _opening_rows(report)
    known_names = {_opening_name(row) for row in rows}
    for name, opening_games in grouped.items():
        if name not in known_names:
            rows.append({"name": name, "games": len(opening_games)})

    diagnostics = [_diagnostic(row, grouped.get(_opening_name(row), [])) for row in rows]
    diagnostics.sort(key=lambda item: (item["games"], item.get("openingHealthScore") or 0), reverse=True)
    return diagnostics, games


def _strongest_weapon(diagnostics: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    candidates = [item for item in diagnostics if item["games"] >= 3]
    if not candidates:
        return None
    best = max(
        candidates,
        key=lambda item: (
            item.get("openingHealthScore") or item.get("winRate") or 0,
            item["games"],
            1 if item["verdict"] == "keep" else 0,
        ),
    )
    score = best.get("openingHealthScore") or best.get("winRate")
    return {
        "openingName": best["openingName"],
        "score": score,
        "evidence": best["evidence"],
        "games": best["games"],
        "action": "Keep this as a core weapon and use practice time to sharpen the recurring plans.",
    }


def _biggest_leak(diagnostics: List[Dict[str, Any]]) -> Dict[str, Any]:
    candidates = [
        item
        for item in diagnostics
        if item["games"] >= 5 and item.get("issueType") in {"opening", "transition", "middlegame", "mixed"}
    ]
    if not candidates:
        return {
            "openingName": None,
            "issueType": "insufficient_data",
            "title": "No reliable leak yet",
            "explanation": "There is not enough repeated evidence to name one opening as the main problem.",
            "evidence": ["Needs at least five games in a line before calling it a leak."],
            "games": 0,
            "action": "Analyse a few more games before changing the repertoire.",
            "confidence": "low",
        }

    priority = {"opening": 4, "mixed": 3, "transition": 2, "middlegame": 1}
    weakest = min(
        candidates,
        key=lambda item: (
            -priority.get(item.get("issueType"), 0),
            item.get("openingHealthScore") if item.get("openingHealthScore") is not None else 50,
            -item["games"],
        ),
    )
    issue = weakest["issueType"]
    if issue == "opening":
        title = "Fix the opening phase first"
    elif issue == "transition":
        title = "Fix the handoff after the opening"
    elif issue == "middlegame":
        title = "The opening is playable; train the middlegame"
    else:
        title = "Simplify this line before adding more theory"

    return {
        "openingName": weakest["openingName"],
        "issueType": issue,
        "title": title,
        "explanation": weakest["explanation"],
        "evidence": weakest["evidence"],
        "games": weakest["games"],
        "action": weakest["recommendation"],
        "confidence": weakest["confidence"],
    }


def _focus_mission(strongest: Optional[Dict[str, Any]], leak: Dict[str, Any]) -> Dict[str, Any]:
    if leak.get("issueType") != "insufficient_data":
        opening = leak.get("openingName")
        return {
            "title": f"Stabilise {opening}",
            "description": leak.get("explanation"),
            "openingName": opening,
            "practiceGoal": leak.get("action"),
            "targetGames": 5,
            "targetDrills": 3,
            "successMetric": "In the next five games, reach move 12 with a playable position at least four times.",
        }
    if strongest:
        opening = strongest["openingName"]
        return {
            "title": f"Prove {opening} over the next set",
            "description": "The current sample is not showing a clear leak, so grow the evidence around your best line.",
            "openingName": opening,
            "practiceGoal": strongest["action"],
            "targetGames": 5,
            "targetDrills": 3,
            "successMetric": "Keep the score rate at 50% or better while recording the opponent reply you face most.",
        }
    return {
        "title": "Build a bigger sample",
        "description": "The report needs more completed games before it can coach one opening confidently.",
        "openingName": None,
        "practiceGoal": "Play and import five more games in your normal repertoire.",
        "targetGames": 5,
        "targetDrills": 3,
        "successMetric": "Import enough games to move confidence from low to medium.",
    }


def _headline(strongest: Optional[Dict[str, Any]], leak: Dict[str, Any], confidence: Dict[str, Any]) -> Dict[str, Any]:
    if leak.get("issueType") != "insufficient_data":
        return {
            "title": leak["title"],
            "summary": f"{leak['openingName']} is the clearest coaching priority, with {leak['games']} relevant games.",
            "primaryAction": leak["action"],
        }
    if strongest:
        return {
            "title": f"{strongest['openingName']} looks like your best current weapon",
            "summary": f"The biggest weakness is not reliable yet. Confidence is {confidence['label']} because of the sample size.",
            "primaryAction": strongest["action"],
        }
    return {
        "title": "More games needed for a reliable coach verdict",
        "summary": confidence["reason"],
        "primaryAction": "Import more recent games before changing openings.",
    }


def _take_names(items: Iterable[Any], limit: int) -> List[Any]:
    values: List[Any] = []
    for item in items:
        if len(values) >= limit:
            break
        if isinstance(item, dict):
            name = item.get("name") or item.get("openingName") or item.get("title")
            values.append({"name": name, **{k: v for k, v in item.items() if k in {"fitScore", "reason", "slot"}}})
        elif isinstance(item, str):
            values.append({"name": item})
    return [item for item in values if item.get("name")]


def _repertoire_recommendation(report: Dict[str, Any], diagnostics: List[Dict[str, Any]]) -> Dict[str, Any]:
    recs = _pick_report_dict(report, "opening_recommendations", "openingRecommendations", "recommendedOpenings")
    plan = _pick_report_dict(report, "recommended_repertoire_plan", "recommendedRepertoirePlan")

    white = _take_names(
        _as_list(recs.get("white") or recs.get("white_repertoire") or plan.get("white")),
        3,
    )
    black_e4 = _take_names(
        _as_list(recs.get("black_vs_e4") or recs.get("blackVsE4") or plan.get("black_vs_e4") or plan.get("blackVsE4")),
        3,
    )
    black_d4 = _take_names(
        _as_list(recs.get("black_vs_d4") or recs.get("blackVsD4") or plan.get("black_vs_d4") or plan.get("blackVsD4")),
        3,
    )

    improve = next((item for item in diagnostics if item["verdict"] in {"improve", "avoid_for_now"}), None)
    keep = next((item for item in diagnostics if item["verdict"] == "keep"), None)
    focus = improve["openingName"] if improve else (keep["openingName"] if keep else None)
    rationale = (
        f"Focus on {focus} because it is the clearest current coaching signal."
        if focus
        else "No repertoire shift is recommended until the sample is stronger."
    )

    return {
        "white": white,
        "blackVsE4": black_e4,
        "blackVsD4": black_d4,
        "focus": focus,
        "rationale": rationale,
    }


def build_opening_coach_insights(report: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    report = _as_dict(report)
    diagnostics, games = _build_diagnostics(report)
    analysed_count = len(games) or _int(report.get("gamesAnalysed") or report.get("gamesAnalyzed") or report.get("gamesImported"))
    confidence = {
        "label": _confidence_label(analysed_count),
        "reason": _confidence_reason(analysed_count),
        "sampleSize": analysed_count,
    }
    strongest = _strongest_weapon(diagnostics)
    leak = _biggest_leak(diagnostics)

    return {
        "version": 1,
        "analysedGameCount": analysed_count,
        "confidence": confidence,
        "headline": _headline(strongest, leak, confidence),
        "strongestWeapon": strongest,
        "biggestLeak": leak,
        "focusMission": _focus_mission(strongest, leak),
        "openingDiagnostics": diagnostics,
        "repertoireRecommendation": _repertoire_recommendation(report, diagnostics),
    }
