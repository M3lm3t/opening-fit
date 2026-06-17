from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def _number(value: Any, fallback: float = 0) -> float:
    try:
        if isinstance(value, str):
            value = value.replace("%", "").strip()
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return number if math.isfinite(number) else fallback


def _score(value: Any, fallback: float = 0) -> int:
    number = _number(value, fallback)
    if 0 <= number <= 1:
        number *= 100
    return int(round(max(0, min(100, number))))


def _opening_name(item: Dict[str, Any]) -> str:
    return str(
        item.get("name")
        or item.get("opening")
        or item.get("openingName")
        or item.get("opening_name")
        or "Unknown opening"
    )


def _variation_name(item: Dict[str, Any]) -> str:
    return str(
        item.get("variation")
        or item.get("line")
        or item.get("moveLine")
        or item.get("move_line")
        or ""
    )


def _opening_key(name: str) -> str:
    return " ".join(str(name or "").lower().split())


def _games(item: Dict[str, Any]) -> int:
    return max(0, int(_number(item.get("games") or item.get("gamesPlayed") or item.get("games_played"), 0)))


def _win_rate(item: Dict[str, Any]) -> int:
    direct = item.get("winRate", item.get("win_rate"))
    if direct is not None:
        return _score(direct)
    games = _games(item)
    if not games:
        return 0
    wins = _number(item.get("wins"), 0)
    draws = _number(item.get("draws"), 0)
    return _score(((wins + draws * 0.5) / games) * 100)


def _loss_rate(item: Dict[str, Any]) -> int:
    direct = item.get("lossRate", item.get("loss_rate"))
    if direct is not None:
        return _score(direct)
    games = _games(item)
    if not games:
        return 0
    return _score((_number(item.get("losses"), 0) / games) * 100)


def _trend_value(item: Dict[str, Any]) -> Dict[str, Any]:
    label = str(item.get("recentTrend") or item.get("recent_trend") or "Stable")
    delta = _number(item.get("recentTrendScoreDelta", item.get("recent_trend_score_delta")), 0)
    if label == "Stable" and delta >= 8:
        label = "Improving"
    elif label == "Stable" and delta <= -8:
        label = "Declining"
    score = 50 + max(-20, min(20, delta))
    if label.lower() == "improving":
        score = max(score, 62)
    elif label.lower() == "declining":
        score = min(score, 38)
    return {
        "label": label,
        "scoreDelta": round(delta, 1),
        "score": _score(score, 50),
    }


def _consistency_score(item: Dict[str, Any]) -> int:
    return _score(
        item.get(
            "consistencyScore",
            item.get(
                "consistency_score",
                item.get(
                    "planClarityResultStability",
                    item.get("plan_clarity_result_stability", item.get("planClarityScore", item.get("plan_clarity_score"))),
                ),
            ),
        ),
        72 if _games(item) >= 8 else 58 if _games(item) >= 3 else 42,
    )


def _training_count(name: str, training_items: List[Dict[str, Any]]) -> int:
    key = _opening_key(name)
    total = 0
    for item in training_items or []:
        if not isinstance(item, dict):
            continue
        item_name = _opening_key(str(item.get("opening") or item.get("name") or item.get("trainingTarget") or ""))
        if item_name and item_name != key:
            continue
        total += int(_number(item.get("trainingCompletedCount") or item.get("completedCount"), 0))
        if item.get("completed") or item.get("isCompleted"):
            total += 1
    return total


def _weak_lines_for_opening(name: str, problem_lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    key = _opening_key(name)
    return [
        line
        for line in problem_lines or []
        if isinstance(line, dict)
        and _opening_key(str(line.get("opening") or line.get("name") or line.get("trainingTarget") or "")) == key
    ]


def _parse_date(value: Any) -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        try:
            timestamp = float(value)
            if timestamp > 10_000_000_000:
                timestamp /= 1000
            return datetime.fromtimestamp(timestamp, tz=timezone.utc)
        except (OSError, OverflowError, ValueError):
            return None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            if text.isdigit():
                return _parse_date(float(text))
            return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            return None
    return None


def _game_date(game: Dict[str, Any]) -> Optional[datetime]:
    return _parse_date(
        game.get("end_time")
        or game.get("endTime")
        or game.get("playedAt")
        or game.get("played_at")
        or game.get("date")
        or game.get("created_at")
    )


def _decay_label(days: Optional[int]) -> str:
    if days is None:
        return "none"
    if days <= 7:
        return "none"
    if days <= 14:
        return "low"
    if days <= 30:
        return "medium"
    return "high"


def _confidence_from_games(games: int) -> str:
    if games >= 30:
        return "High"
    if games >= 10:
        return "Medium"
    return "Low"


def _reduce_confidence(label: str) -> str:
    if label == "High":
        return "Medium"
    if label == "Medium":
        return "Low"
    return "Low"


def _opening_confidence(games: int, decay_risk: str = "none") -> Dict[str, Any]:
    label = _confidence_from_games(games)
    if decay_risk in {"medium", "high"}:
        label = _reduce_confidence(label)

    text = f"{label} confidence - based on {games} game{'s' if games != 1 else ''}"
    if decay_risk in {"medium", "high"} and games >= 10:
        text += "; older data lowers this by one level"

    return {
        "confidence": label,
        "confidenceLevel": label,
        "confidence_level": label,
        "confidenceText": text,
        "confidence_text": text,
        "confidenceGames": games,
        "confidence_games": games,
    }


def _decay_for_opening(name: str, games: int, recent_games: List[Dict[str, Any]], now: Optional[datetime] = None) -> Dict[str, Any]:
    if games < 4:
        return {
            "lastSeenDate": None,
            "last_seen_date": None,
            "daysSincePlayed": None,
            "days_since_played": None,
            "decayRisk": "none",
            "decay_risk": "none",
        }

    key = _opening_key(name)
    dates = []
    for game in recent_games or []:
        if not isinstance(game, dict):
            continue
        game_opening = _opening_key(str(game.get("opening") or game.get("name") or game.get("openingName") or ""))
        if game_opening != key:
            continue
        date = _game_date(game)
        if date:
            dates.append(date)

    if not dates:
        return {
            "lastSeenDate": None,
            "last_seen_date": None,
            "daysSincePlayed": None,
            "days_since_played": None,
            "decayRisk": "none",
            "decay_risk": "none",
        }

    latest = max(dates)
    current = now or datetime.now(timezone.utc)
    days = max(0, int((current - latest).total_seconds() // 86400))
    risk = _decay_label(days)
    return {
        "lastSeenDate": latest.isoformat(),
        "last_seen_date": latest.isoformat(),
        "daysSincePlayed": days,
        "days_since_played": days,
        "decayRisk": risk,
        "decay_risk": risk,
    }


def build_opening_mastery(
    openings: List[Dict[str, Any]],
    problem_lines: Optional[List[Dict[str, Any]]] = None,
    training_items: Optional[List[Dict[str, Any]]] = None,
    recent_games: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    mastery = []
    for opening in openings or []:
        if not isinstance(opening, dict):
            continue
        name = _opening_name(opening)
        games = _games(opening)
        weak_lines = _weak_lines_for_opening(name, problem_lines or [])
        trend = _trend_value(opening)
        consistency = _consistency_score(opening)
        win_rate = _win_rate(opening)
        loss_rate = _loss_rate(opening)
        sample_score = 100 if games >= 12 else 82 if games >= 8 else 64 if games >= 4 else 38 if games else 0
        weak_penalty = min(28, len(weak_lines) * 9 + sum(1 for line in weak_lines if _loss_rate(line) >= 60) * 4)
        training_completed = _training_count(name, training_items or [])
        training_bonus = min(8, training_completed * 2)
        decay = _decay_for_opening(name, games, recent_games or [])
        confidence = _opening_confidence(games, decay.get("decayRisk", "none"))
        mastery_score = _score(
            win_rate * 0.34
            + (100 - loss_rate) * 0.18
            + trend["score"] * 0.16
            + consistency * 0.18
            + sample_score * 0.14
            - weak_penalty
            + training_bonus
        )
        mastery.append(
            {
                "opening": name,
                "name": name,
                "variation": _variation_name(opening),
                "gamesPlayed": games,
                "games_played": games,
                "winRate": win_rate,
                "win_rate": win_rate,
                "lossRate": loss_rate,
                "loss_rate": loss_rate,
                "recentTrend": trend,
                "recent_trend": trend,
                "consistencyScore": consistency,
                "consistency_score": consistency,
                "weakLineCount": len(weak_lines),
                "weak_line_count": len(weak_lines),
                "trainingCompletedCount": training_completed,
                "training_completed_count": training_completed,
                **decay,
                **confidence,
                "masteryScore": mastery_score,
                "mastery_score": mastery_score,
                "masteryLevel": max(1, min(10, math.ceil(mastery_score / 10))),
                "mastery_level": max(1, min(10, math.ceil(mastery_score / 10))),
            }
        )
    return sorted(mastery, key=lambda item: (item["masteryScore"], -item["gamesPlayed"]))


def _line_identity(line: Optional[Dict[str, Any]]) -> str:
    if not line:
        return ""
    return "::".join(
        [
            _opening_key(str(line.get("opening") or line.get("name") or "")),
            _opening_key(str(line.get("variation") or line.get("line") or line.get("moveLine") or "")),
        ]
    )


def _rank_weak_lines(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        [line for line in lines or [] if isinstance(line, dict)],
        key=lambda line: (_loss_rate(line), -_win_rate(line), _games(line)),
        reverse=True,
    )


def _previous_weakest_line(previous_report: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(previous_report, dict):
        return None
    tracking = previous_report.get("weakestLineTracking") or previous_report.get("weakest_line_tracking") or {}
    if isinstance(tracking, dict) and isinstance(tracking.get("currentWeakestLine") or tracking.get("current_weakest_line"), dict):
        return tracking.get("currentWeakestLine") or tracking.get("current_weakest_line")
    previous_lines = previous_report.get("problemLines") or previous_report.get("problem_lines") or []
    ranked = _rank_weak_lines(previous_lines)
    return ranked[0] if ranked else None


def build_weakest_line_tracking(
    problem_lines: List[Dict[str, Any]],
    previous_report: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    ranked = _rank_weak_lines(problem_lines)
    current = ranked[0] if ranked else None
    previous = _previous_weakest_line(previous_report)
    changed = bool(current and previous and _line_identity(current) != _line_identity(previous))
    return {
        "currentWeakestLine": current,
        "current_weakest_line": current,
        "previousWeakestLine": previous,
        "previous_weakest_line": previous,
        "changedSinceLastAnalysis": changed,
        "changed_since_last_analysis": changed,
    }


def build_one_thing_to_fix(opening_mastery: List[Dict[str, Any]], problem_lines: List[Dict[str, Any]]) -> Dict[str, Any]:
    weakest_line = _rank_weak_lines(problem_lines)[0] if problem_lines else None
    if weakest_line:
        opening = str(weakest_line.get("opening") or weakest_line.get("name") or "your weakest line")
        variation = str(weakest_line.get("variation") or weakest_line.get("line") or weakest_line.get("moveLine") or "")
        issue = str(weakest_line.get("flagReason") or "This line is producing too many losses.")
        matching_mastery = next((item for item in opening_mastery if _opening_key(item.get("opening", "")) == _opening_key(opening)), None)
        confidence = matching_mastery or _opening_confidence(_games(weakest_line))
        return {
            "opening": opening,
            "variation": variation,
            "confidence": confidence.get("confidence", "Low"),
            "confidenceLevel": confidence.get("confidenceLevel", "Low"),
            "confidence_level": confidence.get("confidence_level", "Low"),
            "confidenceText": confidence.get("confidenceText", "Low confidence - based on 0 games"),
            "confidence_text": confidence.get("confidence_text", "Low confidence - based on 0 games"),
            "confidenceGames": confidence.get("confidenceGames", _games(weakest_line)),
            "confidence_games": confidence.get("confidence_games", _games(weakest_line)),
            "exactIssue": issue,
            "exact_issue": issue,
            "whyItMatters": "Repeated losses in one line are usually easier to fix than changing the whole repertoire.",
            "why_it_matters": "Repeated losses in one line are usually easier to fix than changing the whole repertoire.",
            "suggestedTrainingAction": f"Replay two recent losses in {opening} and practise the first position where the plan breaks.",
            "suggested_training_action": f"Replay two recent losses in {opening} and practise the first position where the plan breaks.",
            "shortDisplayText": f"Fix {opening}{f' - {variation}' if variation else ''}",
            "short_display_text": f"Fix {opening}{f' - {variation}' if variation else ''}",
        }

    stale = next(
        (
            item for item in opening_mastery
            if item.get("decayRisk") in {"high", "medium"} and int(item.get("gamesPlayed", 0) or 0) >= 4
        ),
        None,
    )
    if stale:
        opening = stale.get("opening", "your stale opening")
        days = stale.get("daysSincePlayed")
        risk = stale.get("decayRisk")
        issue = (
            f"You have not played {opening} for {days} days, so it may be worth a calm refresh."
            if days is not None
            else f"{opening} may be worth a calm refresh before relying on it again."
        )
        return {
            "opening": opening,
            "variation": stale.get("variation", ""),
            "confidence": stale.get("confidence", "Low"),
            "confidenceLevel": stale.get("confidenceLevel", "Low"),
            "confidence_level": stale.get("confidence_level", "Low"),
            "confidenceText": stale.get("confidenceText", "Low confidence - based on 0 games"),
            "confidence_text": stale.get("confidence_text", "Low confidence - based on 0 games"),
            "confidenceGames": stale.get("confidenceGames", stale.get("gamesPlayed", 0)),
            "confidence_games": stale.get("confidence_games", stale.get("gamesPlayed", 0)),
            "exactIssue": issue,
            "exact_issue": issue,
            "whyItMatters": "A short refresh keeps familiar opening plans easy to recall without creating fake urgency.",
            "why_it_matters": "A short refresh keeps familiar opening plans easy to recall without creating fake urgency.",
            "suggestedTrainingAction": f"Review one model line in {opening}, then play it in a low-pressure game.",
            "suggested_training_action": f"Review one model line in {opening}, then play it in a low-pressure game.",
            "shortDisplayText": f"Refresh {opening}",
            "short_display_text": f"Refresh {opening}",
            "reasonCode": "opening_decay",
            "reason_code": "opening_decay",
            "decayRisk": risk,
            "decay_risk": risk,
        }

    weak_mastery = opening_mastery[0] if opening_mastery else None
    opening = weak_mastery.get("opening") if weak_mastery else "your lowest-confidence opening"
    issue = "This opening has the lowest current mastery score in the report."
    return {
        "opening": opening,
        "variation": weak_mastery.get("variation", "") if weak_mastery else "",
        "confidence": weak_mastery.get("confidence", "Low") if weak_mastery else "Low",
        "confidenceLevel": weak_mastery.get("confidenceLevel", "Low") if weak_mastery else "Low",
        "confidence_level": weak_mastery.get("confidence_level", "Low") if weak_mastery else "Low",
        "confidenceText": weak_mastery.get("confidenceText", "Low confidence - based on 0 games") if weak_mastery else "Low confidence - based on 0 games",
        "confidence_text": weak_mastery.get("confidence_text", "Low confidence - based on 0 games") if weak_mastery else "Low confidence - based on 0 games",
        "confidenceGames": weak_mastery.get("confidenceGames", weak_mastery.get("gamesPlayed", 0)) if weak_mastery else 0,
        "confidence_games": weak_mastery.get("confidence_games", weak_mastery.get("games_played", 0)) if weak_mastery else 0,
        "exactIssue": issue,
        "exact_issue": issue,
        "whyItMatters": "Improving the lowest mastery area gives the next report the clearest signal.",
        "why_it_matters": "Improving the lowest mastery area gives the next report the clearest signal.",
        "suggestedTrainingAction": f"Play a short review block for {opening} and note one recurring decision to fix.",
        "suggested_training_action": f"Play a short review block for {opening} and note one recurring decision to fix.",
        "shortDisplayText": f"Review {opening}",
        "short_display_text": f"Review {opening}",
    }


def _coverage_bucket_score(coverage: Dict[str, Any], section: str, key: str) -> int:
    rows = coverage.get(section) or []
    row = next((item for item in rows if item.get("key") == key), None)
    if not row:
        return 35
    status = str(row.get("status") or "")
    games = _games(row)
    if status == "Covered":
        return 88
    if status == "Needs work":
        return 62
    if status == "Too little data":
        return 42 if games else 32
    return 28


def build_repertoire_health(
    opening_mastery: List[Dict[str, Any]],
    repertoire_coverage: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    coverage = repertoire_coverage or {}
    white = _coverage_bucket_score(coverage, "white", "main_white")
    black_e4 = _coverage_bucket_score(coverage, "black", "black_vs_e4")
    black_d4 = _coverage_bucket_score(coverage, "black", "black_vs_d4")
    total_games = sum(item.get("gamesPlayed", 0) for item in opening_mastery)
    top_games = max([item.get("gamesPlayed", 0) for item in opening_mastery] or [0])
    over_reliance = _score((top_games / total_games) * 100 if total_games else 0)
    unstable_weak_lines = sum(
        1
        for item in opening_mastery
        if item.get("weakLineCount", 0) and item.get("consistencyScore", 0) < 65
    )
    improving = sum(1 for item in opening_mastery if str(item.get("recentTrend", {}).get("label", "")).lower() == "improving")
    declining = sum(1 for item in opening_mastery if str(item.get("recentTrend", {}).get("label", "")).lower() == "declining")
    improvement_score = _score(55 + improving * 8 - declining * 8)
    weak_line_penalty = min(30, unstable_weak_lines * 10)
    over_reliance_penalty = max(0, over_reliance - 45) * 0.35
    score = _score(
        white * 0.22
        + black_e4 * 0.20
        + black_d4 * 0.18
        + (100 - weak_line_penalty * 2) * 0.16
        + (100 - over_reliance_penalty) * 0.12
        + improvement_score * 0.12
    )
    return {
        "score": score,
        "coverageAsWhite": white,
        "coverage_as_white": white,
        "coverageVsE4": black_e4,
        "coverage_vs_e4": black_e4,
        "coverageVsD4": black_d4,
        "coverage_vs_d4": black_d4,
        "unstableWeakLines": unstable_weak_lines,
        "unstable_weak_lines": unstable_weak_lines,
        "overRelianceOnOneOpening": over_reliance,
        "over_reliance_on_one_opening": over_reliance,
        "recentImprovement": improvement_score,
        "recent_improvement": improvement_score,
    }


def _average(values: List[float], fallback: float = 0) -> float:
    usable = [float(value) for value in values if math.isfinite(float(value))]
    return sum(usable) / len(usable) if usable else fallback


def build_openingfit_score(
    opening_mastery: List[Dict[str, Any]],
    repertoire_health: Dict[str, Any],
) -> Dict[str, Any]:
    average_mastery = _average([item.get("masteryScore", 0) for item in opening_mastery], 45)
    average_consistency = _average([item.get("consistencyScore", 0) for item in opening_mastery], 50)
    weak_lines = sum(int(item.get("weakLineCount", 0) or 0) for item in opening_mastery)
    training_completed = sum(int(item.get("trainingCompletedCount", 0) or 0) for item in opening_mastery)
    improvement = _score(repertoire_health.get("recentImprovement", repertoire_health.get("recent_improvement", 50)), 50)
    health_score = _score(repertoire_health.get("score"), 50)
    weak_line_score = max(0, 100 - min(60, weak_lines * 10))
    training_score = min(100, 42 + training_completed * 12)
    score_100 = _score(
        health_score * 0.30
        + average_mastery * 0.26
        + weak_line_score * 0.16
        + improvement * 0.12
        + training_score * 0.08
        + average_consistency * 0.08
    )
    score_1000 = int(round(score_100 * 10))

    return {
        "score": score_1000,
        "scoreOutOf1000": score_1000,
        "score_out_of_1000": score_1000,
        "explanation": "A practical opening progress score from repertoire health, mastery, weak lines, recent trend, training, and consistency.",
        "factors": {
            "repertoireHealth": health_score,
            "repertoire_health": health_score,
            "averageMastery": round(average_mastery, 1),
            "average_mastery": round(average_mastery, 1),
            "weakLineScore": weak_line_score,
            "weak_line_score": weak_line_score,
            "recentImprovement": improvement,
            "recent_improvement": improvement,
            "trainingCompletion": training_score,
            "training_completion": training_score,
            "consistency": round(average_consistency, 1),
        },
    }


def _style_scores(style_profile: Optional[Dict[str, Any]]) -> Dict[str, float]:
    if not isinstance(style_profile, dict):
        return {}
    scores = style_profile.get("styleScores") or style_profile.get("style_scores") or {}
    return scores if isinstance(scores, dict) else {}


def _dominant_opening_names(opening_mastery: List[Dict[str, Any]]) -> str:
    names = [item.get("opening") for item in opening_mastery[:3] if item.get("opening")]
    return ", ".join(names) if names else "your repeated openings"


def build_opening_identity(
    opening_mastery: List[Dict[str, Any]],
    repertoire_health: Dict[str, Any],
    style_profile: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    style_label = str((style_profile or {}).get("styleLabel") or (style_profile or {}).get("style_label") or "")
    style_scores = _style_scores(style_profile)
    names_text = _dominant_opening_names(opening_mastery)
    opening_text = " ".join(str(item.get("opening", "")).lower() for item in opening_mastery[:5])
    avg_mastery = _average([item.get("masteryScore", 0) for item in opening_mastery], 45)
    avg_loss = _average([item.get("lossRate", 0) for item in opening_mastery], 45)
    health_score = _score(repertoire_health.get("score"), 50)

    tactical = _number(style_scores.get("tactical") or style_scores.get("attacking"), 0)
    positional = _number(style_scores.get("positional") or style_scores.get("strategic"), 0)
    solid = _number(style_scores.get("solid") or style_scores.get("defensive"), 0)
    endgame = _number(style_scores.get("endgame"), 0)

    if "gambit" in opening_text:
        identity = "Gambit Seeker"
        direction = "Keep gambits narrow: one main line, one backup, and review early losses first."
    elif tactical >= max(positional, solid, endgame) and tactical:
        identity = "Dynamic Attacker" if avg_loss < 50 else "Tactical Explorer"
        direction = "Choose openings with active piece play, but keep one repair line for early tactics."
    elif solid >= max(tactical, positional, endgame) and solid:
        identity = "Solid Defender"
        direction = "Build around reliable Black systems and one clear White setup."
    elif endgame >= max(tactical, positional, solid) and endgame:
        identity = "Endgame Grinder"
        direction = "Prefer openings that trade into stable structures without giving up the centre."
    elif positional >= max(tactical, solid, endgame) and positional:
        identity = "Positional Builder"
        direction = "Lean into openings with repeatable pawn structures and clear improvement plans."
    elif any(token in opening_text for token in ["sicilian", "king's indian", "modern", "pirc", "dutch"]):
        identity = "Aggressive Counterpuncher"
        direction = "Use counterattacking openings, but reduce the number of sidelines you maintain."
    elif any(token in opening_text for token in ["italian", "ruy", "queen's gambit", "scotch"]):
        identity = "Classical Developer"
        direction = "Keep developing openings that reward clean piece placement and central breaks."
    else:
        identity = "Tactical Explorer" if avg_mastery < 58 else "Classical Developer"
        direction = "Focus on one repeatable opening family before adding fresh theory."

    reasons = [
        f"Your clearest evidence comes from {names_text}.",
        f"Repertoire health is {health_score}/100 with average mastery near {round(avg_mastery)}%.",
    ]
    if style_label:
        reasons[0] = f"Your style profile leans {style_label}, and {names_text} carry the current evidence."

    confidence = _score(45 + min(25, len(opening_mastery) * 5) + max(0, health_score - 50) * 0.35)
    return {
        "identity": identity,
        "label": identity,
        "confidence": confidence,
        "confidencePercentage": confidence,
        "confidence_percentage": confidence,
        "reasons": reasons[:2],
        "suggestedOpeningDirection": direction,
        "suggested_opening_direction": direction,
    }


def build_retention_metrics(
    best_openings: List[Dict[str, Any]],
    problem_lines: Optional[List[Dict[str, Any]]] = None,
    repertoire_coverage: Optional[Dict[str, Any]] = None,
    training_items: Optional[List[Dict[str, Any]]] = None,
    previous_report: Optional[Dict[str, Any]] = None,
    style_profile: Optional[Dict[str, Any]] = None,
    recent_games: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    mastery = build_opening_mastery(best_openings, problem_lines, training_items, recent_games)
    weakest_tracking = build_weakest_line_tracking(problem_lines or [], previous_report)
    one_fix = build_one_thing_to_fix(mastery, problem_lines or [])
    health = build_repertoire_health(mastery, repertoire_coverage)
    openingfit_score = build_openingfit_score(mastery, health)
    opening_identity = build_opening_identity(mastery, health, style_profile)

    return {
        "openingFitScore": openingfit_score,
        "opening_fit_score": openingfit_score,
        "openingIdentity": opening_identity,
        "opening_identity": opening_identity,
        "openingMastery": mastery,
        "opening_mastery": mastery,
        "weakestLineTracking": weakest_tracking,
        "weakest_line_tracking": weakest_tracking,
        "oneThingToFix": one_fix,
        "one_thing_to_fix": one_fix,
        "repertoireHealth": health,
        "repertoire_health": health,
        "method": "heuristic_retention_metrics_v1",
    }
