from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable, Mapping, Optional

from analysis.opening_perspective import perspective_from_item


MIN_OPENING_EVIDENCE = 3
MIN_COMPARABLE_REPORT_GAMES = 5


def _number(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _games(item: Mapping[str, Any]) -> int:
    return max(0, int(_number(item.get("games") or item.get("sampleSize") or item.get("sample_size")) or 0))


def _score(item: Mapping[str, Any]) -> Optional[float]:
    for key in ("fitScore", "fit_score", "winRate", "win_rate", "score"):
        value = _number(item.get(key))
        if value is not None:
            return max(0, min(100, value * 100 if 0 <= value <= 1 else value))
    return None


def _name(item: Mapping[str, Any]) -> str:
    return str(item.get("name") or item.get("opening") or item.get("openingName") or "").strip()


def _iso(value: Any) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def reports_are_comparable(current: Mapping[str, Any], previous: Optional[Mapping[str, Any]]) -> bool:
    if not previous:
        return False
    current_platform = str(current.get("platform") or current.get("importPlatform") or "").lower()
    previous_platform = str(previous.get("platform") or previous.get("importPlatform") or "").lower()
    current_user = str(current.get("username") or current.get("playerName") or "").lower()
    previous_user = str(previous.get("username") or previous.get("playerName") or "").lower()
    if current_platform and previous_platform and current_platform != previous_platform:
        return False
    if current_user and previous_user and current_user != previous_user:
        return False
    current_games = int(_number(current.get("gamesAnalysed") or current.get("gamesImported") or current.get("total_games")) or 0)
    previous_games = int(_number(previous.get("gamesAnalysed") or previous.get("gamesImported") or previous.get("total_games")) or 0)
    if min(current_games, previous_games) < MIN_COMPARABLE_REPORT_GAMES:
        return False
    current_date = _iso(current.get("importedAt") or current.get("lastUpdated"))
    previous_date = _iso(previous.get("importedAt") or previous.get("lastUpdated"))
    return bool(current_date and previous_date and previous_date < current_date)


def _decision_opening(item: Mapping[str, Any]) -> dict[str, Any]:
    perspective = perspective_from_item(item)
    games = _games(item)
    score = _score(item)
    return {
        "opening": _name(item),
        "role": perspective["role"],
        "roleLabel": perspective["label"],
        "relationship": perspective["relationship"],
        "repertoireOwned": perspective["repertoireOwned"],
        "repertoireSlot": perspective["repertoireSlot"],
        "userColour": perspective["userColour"],
        "games": games,
        "score": round(score) if score is not None else None,
        "confidence": str(item.get("confidence") or item.get("confidenceLabel") or "Insufficient data"),
        "sampleSizeStatus": "sufficient" if games >= MIN_OPENING_EVIDENCE else "insufficient_data",
        "evidence": list(item.get("evidence") or item.get("evidenceBullets") or [])[:5],
    }


def build_report_decision(
    report: Mapping[str, Any],
    *,
    openings: Iterable[Mapping[str, Any]],
    previous_report: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    candidates = [item for item in openings if _name(item)]
    supported = [item for item in candidates if _games(item) >= MIN_OPENING_EVIDENCE]
    owned = [item for item in supported if perspective_from_item(item)["repertoireOwned"]]
    faced = [item for item in supported if perspective_from_item(item)["opponentPreparation"]]

    strengths = [item for item in owned if (_score(item) or 0) >= 60 and str(item.get("verdict") or "").lower() not in {"fix", "replace", "avoid"}]
    problems = [item for item in owned if (_score(item) is not None and (_score(item) or 0) < 50) or str(item.get("verdict") or "").lower() in {"fix", "replace", "avoid", "improve"}]
    strength = max(strengths, key=lambda item: (_games(item), _score(item) or 0), default=None)
    problem = max(problems, key=lambda item: (_games(item), 100 - (_score(item) or 100)), default=None)

    if problem:
        problem_decision = _decision_opening(problem)
        action = {
            "type": "repair_repertoire",
            "opening": problem_decision["opening"],
            "role": problem_decision["role"],
            "label": f"Repair {problem_decision['opening']}",
            "reason": f"This is the highest-priority sufficiently supported weakness in your own repertoire ({problem_decision['games']} games).",
        }
    elif faced:
        preparation = max(faced, key=lambda item: (_games(item), 100 - (_score(item) or 100)))
        prep_decision = _decision_opening(preparation)
        action = {
            "type": "prepare_against",
            "opening": prep_decision["opening"],
            "role": prep_decision["role"],
            "label": f"Prepare against the {prep_decision['opening']}",
            "reason": f"You face this opening as {prep_decision['userColour'].title()} ({prep_decision['games']} games); it is opponent preparation, not a repertoire opening you play.",
        }
    elif strength:
        strength_decision = _decision_opening(strength)
        action = {
            "type": "consolidate_strength",
            "opening": strength_decision["opening"],
            "role": strength_decision["role"],
            "label": f"Consolidate {strength_decision['opening']}",
            "reason": f"No supported weakness is clear, so reinforce the best-supported repertoire opening ({strength_decision['games']} games).",
        }
    else:
        action = {
            "type": "collect_more_games",
            "opening": None,
            "role": None,
            "label": "Collect more games before changing your repertoire",
            "reason": "No opening has enough correctly attributed evidence for a strength or weakness claim.",
        }

    total_games = int(_number(report.get("gamesAnalysed") or report.get("gamesImported") or report.get("total_games")) or 0)
    comparable = reports_are_comparable(report, previous_report)
    strength_decision = _decision_opening(strength) if strength else None
    problem_decision = _decision_opening(problem) if problem else None
    evidence = []
    if strength_decision:
        evidence.append(f"{strength_decision['opening']}: {strength_decision['games']} games, {strength_decision['score']} fit score.")
    if problem_decision:
        evidence.append(f"{problem_decision['opening']}: {problem_decision['games']} games, {problem_decision['score']} fit score.")
    evidence.append(action["reason"])
    return {
        "schemaVersion": 1,
        "establishedStrength": strength_decision,
        "primaryProblem": problem_decision,
        "nextTrainingAction": action,
        "supportingEvidence": evidence,
        "confidence": {
            "status": "sufficient" if supported else "insufficient_data",
            "sampleSizeStatus": "sufficient" if total_games >= MIN_COMPARABLE_REPORT_GAMES else "insufficient_data",
            "gamesAnalysed": total_games,
            "minimumOpeningGames": MIN_OPENING_EVIDENCE,
        },
        "baseline": {
            "status": "comparable_later_report" if comparable else "baseline",
            "hasComparablePrevious": comparable,
            "comparisonClaimsAllowed": comparable,
        },
    }
