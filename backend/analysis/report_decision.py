from __future__ import annotations

import hashlib
import re
from datetime import datetime
from typing import Any, Iterable, Mapping, Optional

from analysis.opening_perspective import perspective_from_item


MIN_OPENING_EVIDENCE = 5
MEDIUM_CONFIDENCE_GAMES = 10
HIGH_CONFIDENCE_GAMES = 15
MIN_COMPARABLE_REPORT_GAMES = 5


def _number(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _games(item: Mapping[str, Any]) -> int:
    return max(0, int(_number(item.get("games") or item.get("sampleSize") or item.get("sample_size")) or 0))


def _name(item: Mapping[str, Any]) -> str:
    return str(item.get("name") or item.get("opening") or item.get("openingName") or "").strip()


def _opening_key(value: Any) -> str:
    # Only editorial spelling and whitespace are normalised here. Family and
    # variation aliases must not silently pool distinct evidence samples.
    return " ".join(str(value or "").lower().replace("defense", "defence").split())


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "opening"


def _iso(value: Any) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _game_id(game: Mapping[str, Any]) -> str:
    explicit = game.get("gameId") or game.get("game_id") or game.get("id") or game.get("url")
    if explicit:
        return str(explicit)
    fingerprint = "|".join(str(game.get(key) or "") for key in ("opening", "context", "end_time", "pgn", "moves"))
    return f"game-{hashlib.sha256(fingerprint.encode('utf-8', errors='ignore')).hexdigest()[:16]}"


def _result_counts(games: list[Mapping[str, Any]]) -> tuple[int, int, int]:
    results = [str(game.get("result") or "").lower() for game in games]
    return results.count("win"), results.count("draw"), results.count("loss")


def _candidate_score_rate(item: Mapping[str, Any], games: int, wins: int, draws: int) -> Optional[float]:
    if games and wins + draws + int(_number(item.get("losses")) or 0) == games:
        return round(((wins + draws * 0.5) / games) * 100, 1)
    for key in ("scoreRate", "score_rate", "rawResultScore", "raw_result_score", "winRate", "win_rate", "score", "fitScore", "fit_score"):
        value = _number(item.get(key))
        if value is not None:
            return round(max(0, min(100, value * 100 if 0 <= value <= 1 else value)), 1)
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


def _report_games(report: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    for key in ("opening_games", "openingGames", "analysis_game_index", "analysisGameIndex"):
        value = report.get(key)
        if isinstance(value, list) and value:
            return [game for game in value if isinstance(game, Mapping)]
    return []


def _matching_games(report: Mapping[str, Any], item: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    expected_name = _opening_key(_name(item))
    expected = perspective_from_item(item)
    seen, matched = set(), []
    for game in _report_games(report):
        perspective = perspective_from_item(game)
        if _opening_key(game.get("opening") or game.get("name")) != expected_name:
            continue
        if perspective["role"] != expected["role"]:
            continue
        game_id = _game_id(game)
        if game_id in seen:
            continue
        seen.add(game_id)
        matched.append(game)
    return matched


def _issue_for(report: Mapping[str, Any], item: Mapping[str, Any], sample_ids: set[str]) -> Optional[dict[str, Any]]:
    rows = report.get("problem_lines") or report.get("problemLines") or report.get("weak_lines") or report.get("weakLines") or []
    if not isinstance(rows, list):
        return None
    expected_name = _opening_key(_name(item))
    expected_role = perspective_from_item(item)["role"]
    candidates = []
    for row in rows:
        if not isinstance(row, Mapping) or _opening_key(row.get("opening") or row.get("name")) != expected_name:
            continue
        row_role = perspective_from_item(row)["role"]
        if row_role != "unknown_mixed" and row_role != expected_role:
            continue
        move_sequence = row.get("line") or row.get("moveLine") or row.get("move_line") or row.get("position") or row.get("fen")
        occurrences = int(_number(row.get("occurrences") or row.get("games") or row.get("count")) or 0)
        ids = [str(value) for value in (row.get("supportingGameIds") or row.get("supporting_game_ids") or []) if str(value)]
        if sample_ids:
            ids = [value for value in ids if value in sample_ids]
        if occurrences < 2 or not move_sequence or (sample_ids and len(ids) < 2):
            continue
        candidates.append({
            "type": str(row.get("type") or "recurring_weak_line"),
            "description": str(row.get("summary") or row.get("explanation") or f"A repeated problem appears in {move_sequence}."),
            "supportingGameIds": ids,
            "occurrences": min(occurrences, len(ids)) if ids else occurrences,
            "positionOrMoveSequence": str(move_sequence),
        })
    return max(candidates, key=lambda row: row["occurrences"], default=None)


def _confidence(games: int, *, clean_context: bool, complete_results: bool, supporting_ids: int, recency: Optional[str]) -> dict[str, Any]:
    evidence_complete = complete_results and supporting_ids == games and games > 0 and clean_context
    if games >= HIGH_CONFIDENCE_GAMES and evidence_complete:
        level = "high"
        reason = f"{games} opening-specific games with reconciled results and colour context provide a stable sample."
    elif games >= MEDIUM_CONFIDENCE_GAMES and clean_context and complete_results:
        level = "medium"
        reason = f"{games} opening-specific games provide a useful trend, but it can still move."
    elif games >= MIN_OPENING_EVIDENCE and clean_context:
        level = "low"
        reason = f"{games} opening-specific games are an early signal, not a firm repertoire verdict."
    else:
        level = "low"
        reason = f"Only {games} opening-specific game{' is' if games == 1 else 's are'} available; collect more evidence before changing the repertoire."
    return {"level": level, "reason": reason, "sampleSize": games, "recency": recency}


def _canonical_recommendation(report: Mapping[str, Any], item: Mapping[str, Any]) -> dict[str, Any]:
    perspective = perspective_from_item(item)
    matched = _matching_games(report, item)
    validation: list[str] = []
    if matched:
        games = len(matched)
        wins, draws, losses = _result_counts(matched)
        supporting_ids = [_game_id(game) for game in matched]
        source_games = _games(item)
        if source_games and source_games != games:
            validation.append("source_sample_replaced_by_supporting_games")
    else:
        games = _games(item)
        wins = int(_number(item.get("wins")) or 0)
        draws = int(_number(item.get("draws")) or 0)
        losses = int(_number(item.get("losses")) or 0)
        supporting_ids = [str(value) for value in (item.get("supportingGameIds") or item.get("supporting_game_ids") or []) if str(value)]

    result_total = wins + draws + losses
    complete_results = result_total == games
    if result_total and not complete_results:
        validation.append("results_do_not_reconcile")
    if supporting_ids and len(supporting_ids) != games:
        validation.append("supporting_games_do_not_reconcile")
    score_rate = round(((wins + draws * 0.5) / games) * 100, 1) if games and complete_results else _candidate_score_rate(item, games, wins, draws)
    latest = max((_iso(game.get("played_at") or game.get("playedAt") or game.get("end_time") or game.get("endTime")) for game in matched), default=None)
    recency = latest.date().isoformat() if latest else None
    issue = _issue_for(report, item, set(supporting_ids))
    clean_context = perspective["repertoireOwned"] or perspective["opponentPreparation"]
    confidence = _confidence(games, clean_context=clean_context, complete_results=complete_results, supporting_ids=len(supporting_ids), recency=recency)
    owned = perspective["repertoireOwned"]

    if games < MIN_OPENING_EVIDENCE or score_rate is None or validation:
        verdict = "insufficient-data"
    elif not owned:
        verdict = "explore"
    elif score_rate < 45 or issue:
        verdict = "repair"
    elif score_rate >= 55:
        verdict = "keep"
    else:
        verdict = "explore"

    opening_name = _name(item)
    recommendation_id = f"{_slug(opening_name)}:{perspective['role']}"
    sample = {
        "gameIds": supporting_ids,
        "games": games,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "scoreRate": score_rate,
    }
    if verdict == "repair":
        title = f"Fix your {opening_name} as {perspective['userColour'].title()}"
        if issue:
            concept = issue["description"]
            exercise = f"Practise the position five times from the {perspective['userColour'].title()} side."
            completion_target = {"type": "correct_repetitions", "count": 5, "label": "Finish five correct repetitions."}
            explanation = f"This problem appeared in {issue['occurrences']} recent games after {issue['positionOrMoveSequence']}. {concept} {exercise}"
        else:
            review_count = min(3, max(1, losses))
            concept = "Identify the first move where you left a familiar plan or allowed your pieces to become awkward."
            exercise = f"Review {review_count} recent {opening_name} loss{'es' if review_count != 1 else ''} from the {perspective['userColour'].title()} side and mark that move."
            completion_target = {"type": "reviewed_games", "count": review_count, "label": f"Finish {review_count} annotated review{'s' if review_count != 1 else ''}."}
            explanation = f"The {games}-game sample supports a repair task, but it does not identify one recurring move sequence. {exercise}"
    elif verdict == "keep":
        title = f"Keep playing {opening_name}"
        concept = "Write down the piece placement or pawn break you aim for, then check whether you reached it."
        exercise = f"Review one recent {opening_name} game and test the same plan in your next three games from the {perspective['userColour'].title()} side."
        completion_target = {"type": "future_games", "count": 3, "label": "Complete the review and play three focused games."}
        explanation = f"Keep playing {opening_name}; {games} recent games support it. {exercise}"
    elif not owned and games >= MIN_OPENING_EVIDENCE:
        title = f"Prepare against the {opening_name}"
        concept = "Find the first repeated position where your plan was unclear and write down one simple response."
        exercise = f"Review three games where you faced {opening_name} as {perspective['userColour'].title()}."
        completion_target = {"type": "reviewed_games", "count": 3, "label": "Finish three game reviews and save one response plan."}
        explanation = f"You faced {opening_name} as {perspective['userColour'].title()} in {games} recent games. {exercise} {concept}"
    else:
        title = "Collect more games before changing your repertoire"
        result_context = " Your results were positive, so OpeningFit is not treating this as an established weakness yet." if score_rate is not None and score_rate >= 50 else ""
        concept = "Keep the opening unchanged while collecting a clearer sample."
        exercise = f"Play five more games with or against {opening_name}, then run the report again."
        completion_target = {"type": "new_games", "count": 5, "label": "Add five relevant games before reassessing."}
        explanation = f"Early signal: only {games} {opening_name} game{' was' if games == 1 else 's were'} found.{result_context} {exercise}"
    training_action = {
        "title": title,
        "explanation": explanation,
        "concept": concept,
        "exercise": exercise,
        "completionTarget": completion_target,
        "colour": perspective["userColour"],
    }
    if item.get("variation"):
        training_action["variationName"] = item.get("variation")
    if issue:
        training_action["lineOrPosition"] = issue["positionOrMoveSequence"]

    report_date = _iso(report.get("importedAt") or report.get("imported_at") or report.get("lastUpdated") or report.get("last_updated"))
    age_days = max(0, (report_date.replace(tzinfo=None) - latest.replace(tzinfo=None)).days) if report_date and latest else None
    recency_score = 100 if age_days is not None and age_days <= 30 else 70 if age_days is not None and age_days <= 90 else 40 if age_days is not None else 50
    priority = round(
        min(100, games * 4) * 0.20
        + max(0, 50 - (score_rate if score_rate is not None else 50)) * 2 * 0.20
        + {"high": 100, "medium": 70, "low": 35}[confidence["level"]] * 0.15
        + (100 if perspective.get("repertoireSlot") in {"white", "black_vs_e4", "black_vs_d4"} else 55) * 0.15
        + (100 if issue else 20) * 0.20
        + recency_score * 0.10
    )
    return {
        "recommendationId": recommendation_id,
        "verdict": verdict,
        "openingId": _slug(opening_name),
        "openingName": opening_name,
        "opening": opening_name,
        "variationName": item.get("variation") or item.get("line") or None,
        "playerColour": perspective["userColour"],
        "role": perspective["role"],
        "roleLabel": perspective["label"],
        "relationship": perspective["relationship"],
        "repertoireOwned": perspective["repertoireOwned"],
        "repertoireSlot": perspective["repertoireSlot"],
        "sample": sample,
        "games": games,
        "score": score_rate,
        "scoreRate": score_rate,
        "issue": issue,
        "confidence": confidence,
        "sampleSizeStatus": "sufficient" if games >= MIN_OPENING_EVIDENCE and not validation else "insufficient_data",
        "trainingAction": training_action,
        "priority": priority,
        "priorityFactors": {
            "sampleSize": games,
            "performanceSeverity": max(0, round(50 - score_rate, 1)) if score_rate is not None else 0,
            "confidence": confidence["level"],
            "repertoireImportance": perspective.get("repertoireSlot"),
            "actionableIssue": bool(issue),
            "recencyDays": age_days,
        },
        "evidence": [
            f"{games} game{'' if games == 1 else 's'}: {wins} wins, {draws} draws, {losses} losses.",
            f"Chess score: {score_rate}% (draws count as half a point)." if score_rate is not None else "Chess score unavailable.",
            confidence["reason"],
        ],
        "validation": {"valid": not validation, "issues": validation},
    }


def _report_coverage(total_games: int) -> dict[str, Any]:
    if total_games >= 50:
        level, reason = "broad", "The report has broad overall coverage, but each recommendation keeps its own confidence."
    elif total_games >= 20:
        level, reason = "moderate", "The report has moderate overall coverage; small opening-specific samples remain cautious."
    elif total_games >= 5:
        level, reason = "limited", "The report has limited overall coverage."
    else:
        level, reason = "insufficient", "Too few analysed games are available for reliable report coverage."
    return {"level": level, "gamesAnalysed": total_games, "reason": reason}


def build_report_decision(
    report: Mapping[str, Any],
    *,
    openings: Iterable[Mapping[str, Any]],
    previous_report: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    recommendations = [_canonical_recommendation(report, item) for item in openings if _name(item)]
    owned = [item for item in recommendations if item["repertoireOwned"] and item["validation"]["valid"]]
    faced = [item for item in recommendations if not item["repertoireOwned"] and item["verdict"] == "explore"]
    strengths = [item for item in owned if item["verdict"] == "keep"]
    problems = [item for item in owned if item["verdict"] == "repair"]
    strength = sorted(
        strengths,
        key=lambda item: (-item["priority"], -item["sample"]["games"], -item["sample"]["scoreRate"], item["openingName"].lower(), item["role"]),
    )[0] if strengths else None
    problem = sorted(
        problems,
        key=lambda item: (-item["priority"], -item["sample"]["games"], item["openingName"].lower(), item["role"]),
    )[0] if problems else None

    if problem:
        training = problem["trainingAction"]
        action = {
            "type": "repair_repertoire", "opening": problem["openingName"], "role": problem["role"],
            "label": training["title"], "reason": training["explanation"],
            "recommendationId": problem["recommendationId"], "sample": problem["sample"],
            **training,
        }
    elif faced:
        preparation = sorted(faced, key=lambda item: (-item["priority"], -item["sample"]["games"], item["openingName"].lower(), item["role"]))[0]
        training = preparation["trainingAction"]
        action = {
            "type": "prepare_against", "opening": preparation["openingName"], "role": preparation["role"],
            "label": training["title"], "reason": training["explanation"],
            "recommendationId": preparation["recommendationId"], "sample": preparation["sample"],
            **training,
        }
    elif strength:
        training = strength["trainingAction"]
        action = {
            "type": "consolidate_strength", "opening": strength["openingName"], "role": strength["role"],
            "label": training["title"], "reason": training["explanation"],
            "recommendationId": strength["recommendationId"], "sample": strength["sample"],
            **training,
        }
    else:
        action = {
            "type": "collect_more_games", "opening": None, "role": None,
            "label": "Collect more games before changing your repertoire",
            "reason": "No reliable opening weakness was found. Keep your current repertoire and check again after more games.",
            "recommendationId": None, "sample": None,
            "title": "Collect more games before changing your repertoire",
            "explanation": "Keep the current repertoire stable, play five more eligible games, then run the report again.",
            "concept": "A larger opening-specific sample is needed before choosing a repair target.",
            "exercise": "Play five eligible games without changing openings.",
            "completionTarget": {"type": "new_games", "count": 5, "label": "Add five eligible games before reassessing."},
        }

    total_games = int(_number(report.get("gamesAnalysed") or report.get("gamesImported") or report.get("total_games")) or 0)
    comparable = reports_are_comparable(report, previous_report)
    coverage = _report_coverage(total_games)
    evidence = []
    if strength:
        evidence.extend(strength["evidence"][:2])
    if problem:
        evidence.extend(problem["evidence"][:2])
    evidence.append(action["reason"])
    return {
        "schemaVersion": 2,
        "recommendations": recommendations,
        "establishedStrength": strength,
        "primaryProblem": problem,
        "nextTrainingAction": action,
        "supportingEvidence": evidence,
        "reportCoverage": coverage,
        "confidence": {
            "status": "sufficient" if strength or problem or faced else "insufficient_data",
            "sampleSizeStatus": coverage["level"],
            "gamesAnalysed": total_games,
            "minimumOpeningGames": MIN_OPENING_EVIDENCE,
        },
        "baseline": {
            "status": "comparable_later_report" if comparable else "baseline",
            "hasComparablePrevious": comparable,
            "comparisonClaimsAllowed": comparable,
        },
    }
