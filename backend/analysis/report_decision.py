from __future__ import annotations

import hashlib
import io
import re
from collections import Counter
from datetime import datetime
from typing import Any, Iterable, Mapping, Optional

import chess
import chess.pgn

from analysis.opening_perspective import RepertoireRole, normalise_player_identifier, perspective_from_item
from analysis.classified_game import canonical_player_role
from analysis.evidence_thresholds import (
    HIGH_CONFIDENCE_GAMES,
    MINIMUM_OPENING_GAMES,
    MODERATE_CONFIDENCE_GAMES,
)


MIN_OPENING_EVIDENCE = MINIMUM_OPENING_GAMES
MEDIUM_CONFIDENCE_GAMES = MODERATE_CONFIDENCE_GAMES
MIN_COMPARABLE_REPORT_GAMES = 5
REPERTOIRE_COVERAGE_SCORE_VERSION = "repertoire_coverage_v3"
REPERTOIRE_COVERAGE_COMPONENTS = (
    {"key": "roleCompleteness", "label": "Role completeness", "weight": 35},
    {"key": "concentrationConsistency", "label": "Concentration / consistency", "weight": 25},
    {"key": "evidenceStrength", "label": "Evidence strength", "weight": 25},
    {"key": "unresolvedRecurringProblems", "label": "Unresolved recurring problems", "weight": 15},
)
REPERTOIRE_ROLE_SPECS = (
    {"key": "white", "role": RepertoireRole.WHITE.value, "label": "White", "colour": "white", "opponentFirstMove": None},
    {"key": "black_e4", "role": RepertoireRole.BLACK_VS_E4.value, "label": "Black against 1.e4", "colour": "black", "opponentFirstMove": "1.e4"},
    {"key": "black_d4", "role": RepertoireRole.BLACK_VS_D4.value, "label": "Black against 1.d4", "colour": "black", "opponentFirstMove": "1.d4"},
)
SUPPORTED_FINDING_TYPES = frozenset({
    "opening_weakness",
    "branch_weakness",
    "opponent_response_problem",
    "repertoire_gap",
    "preparation_opportunity",
    "stable_strength",
    "mixed_signal",
    "insufficient_evidence",
})


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


def _count_label(value: int, singular: str, plural: Optional[str] = None) -> str:
    return f"{value} {singular if value == 1 else (plural or f'{singular}s')}"


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
    for key in ("scoreRate", "score_rate", "rawResultScore", "raw_result_score", "winRate", "win_rate", "score"):
        value = _number(item.get(key))
        if value is not None:
            return round(max(0, min(100, value * 100 if 0 <= value <= 1 else value)), 1)
    return None


def reports_are_comparable(current: Mapping[str, Any], previous: Optional[Mapping[str, Any]]) -> bool:
    if not previous:
        return False
    current_platform = str(current.get("platform") or current.get("importPlatform") or "").lower()
    previous_platform = str(previous.get("platform") or previous.get("importPlatform") or "").lower()
    current_user = normalise_player_identifier(current.get("username") or current.get("playerName"))
    previous_user = normalise_player_identifier(previous.get("username") or previous.get("playerName"))
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
    # The rich opening-games payload is intentionally capped. Decisions must use
    # the complete lightweight index first or large samples can be misreported as
    # insufficient evidence.
    for key in ("analysis_game_index", "analysisGameIndex", "opening_games", "openingGames"):
        value = report.get(key)
        if isinstance(value, list) and value:
            return [game for game in value if isinstance(game, Mapping)]
    return []


def _has_report_game_collection(report: Mapping[str, Any]) -> bool:
    """Distinguish a legacy aggregate-only report from an explicit empty index."""
    return any(
        isinstance(report.get(key), list)
        for key in ("analysis_game_index", "analysisGameIndex", "opening_games", "openingGames")
    )


def _matching_games(report: Mapping[str, Any], item: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    expected_name = _opening_key(_name(item))
    expected = perspective_from_item(item)
    seen, matched = set(), []
    for game in _report_games(report):
        perspective = perspective_from_item(game)
        if _opening_key(game.get("opening") or game.get("name")) != expected_name:
            continue
        if perspective.get("repertoireRole") != expected.get("repertoireRole"):
            continue
        if expected.get("relationship") != "unknown" and perspective.get("relationship") != expected.get("relationship"):
            continue
        if not perspective.get("roleAttributionTrusted"):
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
    traceable = supporting_ids == games and games > 0
    if not clean_context:
        level = "context_uncertain"
        reason = f"{_count_label(games, 'game')} was found, but colour or repertoire-role attribution is uncertain."
    elif games <= 2:
        level = "insufficient"
        reason = f"Only {_count_label(games, 'opening-specific game')} is available; the sample is insufficient for a repertoire decision."
    elif games <= 4:
        level = "very_early"
        reason = f"{_count_label(games, 'opening-specific game')} provides a very early signal, below the five-game decision threshold."
    elif games <= 9:
        level = "low"
        reason = f"{_count_label(games, 'opening-specific game')} provides a low-confidence result pattern."
    elif games < HIGH_CONFIDENCE_GAMES:
        level = "moderate"
        reason = f"{_count_label(games, 'opening-specific game')} provides a moderate-confidence result pattern."
    else:
        level = "high_sample"
        reason = f"{_count_label(games, 'opening-specific game')} provides high sample confidence."
    quality_reasons = [reason]
    if clean_context and not complete_results:
        quality_reasons.append("The result totals do not fully reconcile, so the chess conclusion remains uncertain.")
    if clean_context and games and not traceable:
        quality_reasons.append("Not every supporting game has a unique traceable identifier, so confidence is capped.")
    if level == "high_sample" and (not complete_results or not traceable):
        level = "moderate"
    return {
        "level": level,
        "label": {
            "context_uncertain": "Context uncertain",
            "insufficient": "Insufficient sample",
            "very_early": "Very early signal",
            "low": "Low confidence",
            "moderate": "Moderate confidence",
            "high_sample": "High sample confidence",
        }[level],
        "reason": " ".join(quality_reasons),
        "reasons": quality_reasons,
        "sampleSize": games,
        "recency": recency,
    }


def _report_count(report: Mapping[str, Any], *keys: str) -> Optional[int]:
    counts = report.get("gameCounts") or report.get("game_counts") or {}
    for key in keys:
        value = report.get(key)
        if value is None and isinstance(counts, Mapping):
            value = counts.get(key)
        number = _number(value)
        if number is not None:
            return max(0, int(number))
    return None


def _confidence_contract(
    *,
    raw_games: int,
    supporting_games: int,
    perspective: Mapping[str, Any],
    validation: list[str],
    confidence: Mapping[str, Any],
) -> dict[str, Any]:
    if not perspective.get("roleAttributionTrusted") or perspective.get("repertoireRole") == RepertoireRole.UNRESOLVED.value:
        code = str(perspective.get("attributionReasonCode") or "role_attribution_unresolved")
    elif supporting_games < MIN_OPENING_EVIDENCE:
        code = "supporting_sample_below_threshold"
    elif validation:
        code = validation[0]
    else:
        code = f"supported_{confidence.get('level') or 'low'}_confidence"
    explanation = str(confidence.get("reason") or "").strip()
    if raw_games != supporting_games:
        explanation = (
            f"{raw_games} games were recorded for this opening, but {supporting_games} correctly attributed games "
            f"support this verdict; {MIN_OPENING_EVIDENCE} are required. {explanation}"
        ).strip()
    return {
        "supportingGameCount": supporting_games,
        "supporting_game_count": supporting_games,
        "requiredGameCount": MIN_OPENING_EVIDENCE,
        "required_game_count": MIN_OPENING_EVIDENCE,
        "confidenceReasonCode": code,
        "confidence_reason_code": code,
        "confidenceExplanation": explanation,
        "confidence_explanation": explanation,
    }


def _evidence_status(
    *,
    supporting_games: int,
    perspective: Mapping[str, Any],
    verdict: str,
    validation: list[str],
) -> str:
    if not perspective.get("roleAttributionTrusted") or perspective.get("repertoireRole") == RepertoireRole.UNRESOLVED.value:
        return "unresolved"
    if supporting_games <= 2:
        return "insufficient"
    if supporting_games < MIN_OPENING_EVIDENCE:
        return "very_early"
    return "sufficient"


def _canonical_recommendation(report: Mapping[str, Any], item: Mapping[str, Any]) -> dict[str, Any]:
    perspective = perspective_from_item(item)
    matched = _matching_games(report, item)
    validation: list[str] = []
    diagnostics: list[str] = []
    raw_games = _games(item)
    if matched or _has_report_game_collection(report):
        games = len(matched)
        wins, draws, losses = _result_counts(matched)
        supporting_ids = [_game_id(game) for game in matched]
        if raw_games and raw_games != games:
            diagnostics.append("source_sample_replaced_by_supporting_games")
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
    fit_score = _number(item.get("fitScore") if item.get("fitScore") is not None else item.get("fit_score"))
    played_dates = [
        parsed
        for game in matched
        if (parsed := _iso(game.get("played_at") or game.get("playedAt") or game.get("end_time") or game.get("endTime"))) is not None
    ]
    latest = max(played_dates, default=None)
    recency = latest.date().isoformat() if latest else None
    issue = _issue_for(report, item, set(supporting_ids))
    clean_context = bool(perspective.get("roleAttributionTrusted"))
    confidence = _confidence(games, clean_context=clean_context, complete_results=complete_results, supporting_ids=len(supporting_ids), recency=recency)
    confidence_contract = _confidence_contract(
        raw_games=raw_games,
        supporting_games=games,
        perspective=perspective,
        validation=validation,
        confidence=confidence,
    )
    owned = perspective["repertoireOwned"]

    if not perspective.get("roleAttributionTrusted") or games < MIN_OPENING_EVIDENCE or validation:
        verdict = "insufficient-data"
    elif not owned:
        verdict = "explore"
    elif score_rate is None:
        # Missing performance/style inputs make the chess conclusion uncertain;
        # they do not erase an otherwise sufficient, role-attributed sample.
        verdict = "explore"
    elif score_rate < 45 or issue:
        verdict = "repair"
    elif score_rate >= 55:
        verdict = "keep"
    else:
        verdict = "explore"

    opening_name = _name(item)
    repertoire_role = str(perspective.get("repertoireRole") or RepertoireRole.UNRESOLVED.value)
    recommendation_id = f"{_slug(opening_name)}:{repertoire_role}:{perspective['role']}"
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
        explanation = f"Keep playing {opening_name}; {_count_label(games, 'recent game')} {'supports' if games == 1 else 'support'} it. {exercise}"
    elif not owned and games >= MIN_OPENING_EVIDENCE:
        title = f"Prepare against the {opening_name}"
        concept = "In each supplied recent game, note the first position where you were unsure of your plan, then choose one response to remember."
        exercise = f"Review up to three supplied recent games where you faced {opening_name} as {perspective['userColour'].title()}."
        completion_target = {"type": "reviewed_games", "count": 1, "label": "Review at least one supplied game and save one response plan."}
        explanation = f"You faced {opening_name} as {perspective['userColour'].title()} in {_count_label(games, 'recent game')}. {exercise} {concept}"
    elif verdict == "explore" and owned:
        title = f"Watch {opening_name} without changing it yet"
        concept = "Separate a mixed result signal from a proven opening weakness."
        exercise = f"Review one recent {opening_name} game and note whether the opening plan or a later decision determined the result."
        completion_target = {"type": "reviewed_games", "count": 1, "label": "Review one representative game before changing the repertoire."}
        explanation = (
            f"Large sample, mixed signal: {games} correctly attributed games are enough evidence to assess {opening_name}, "
            "but the performance does not support an unqualified Keep or Improve verdict."
            if games >= HIGH_CONFIDENCE_GAMES else
            f"The {games}-game sample is sufficient, but its performance signal is mixed. Keep the opening stable while reviewing one representative game."
        )
    elif games >= MIN_OPENING_EVIDENCE:
        title = f"Review the evidence quality for {opening_name}"
        concept = "The opening-specific sample is large enough, but one or more result or context fields cannot support a firm chess conclusion."
        exercise = f"Review one traceable {opening_name} game and rerun the report before changing the repertoire."
        completion_target = {"type": "reviewed_games", "count": 1, "label": "Review one traceable game before reassessing."}
        explanation = f"{games} correctly attributed games meet the sample threshold, but the available result data does not support a firm verdict."
    else:
        remaining = max(1, MIN_OPENING_EVIDENCE - games)
        title = "Collect more games before changing your repertoire"
        result_context = " Your results were positive, so OpeningFit is not treating this as an established weakness yet." if score_rate is not None and score_rate >= 50 else ""
        concept = "Keep the opening unchanged while collecting a clearer sample."
        exercise = f"Play {remaining} more relevant game{'s' if remaining != 1 else ''} with or against {opening_name}, then run the report again."
        completion_target = {"type": "new_games", "count": remaining, "label": f"Add {remaining} relevant game{'s' if remaining != 1 else ''} before reassessing."}
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
        + {
            "high_sample": 100, "moderate": 70, "low": 45,
            "very_early": 25, "insufficient": 10, "context_uncertain": 10,
        }[confidence["level"]] * 0.15
        + (100 if perspective.get("repertoireSlot") in {"white", "black_vs_e4", "black_vs_d4"} else 55) * 0.15
        + (100 if issue else 20) * 0.20
        + recency_score * 0.10
    )
    evidence_status = _evidence_status(
        supporting_games=games,
        perspective=perspective,
        verdict=verdict,
        validation=validation,
    )
    finding_type = (
        "branch_weakness" if verdict == "repair" and issue
        else "opening_weakness" if verdict == "repair"
        else "stable_strength" if verdict == "keep"
        else "opponent_response_problem" if perspective["relationship"] == "faced" and verdict == "explore" and score_rate is not None and score_rate < 45
        else "preparation_opportunity" if perspective["relationship"] == "faced" and verdict == "explore"
        else "mixed_signal" if verdict == "explore" and owned
        else "insufficient_evidence"
    )
    imported_games = _report_count(report, "gamesImported", "fetchedGames")
    eligible_games = _report_count(report, "gamesEligible", "timeControlEligibleGames", "eligible")
    excluded_games = _report_count(report, "gamesExcluded", "excludedGames", "excluded")
    evidence_counts = {
        "importedGames": imported_games,
        "eligibleGames": eligible_games,
        "classifiedOpeningGames": raw_games if raw_games > 0 else games,
        "roleAttributedGames": games,
        "supportingGames": games,
        "excludedGames": excluded_games,
    }
    verdict_reasons = [
        f"{games} unique, correctly attributed game{'s' if games != 1 else ''} support this context.",
        f"Performance score: {score_rate}%." if score_rate is not None else "Performance score is unavailable.",
    ]
    if fit_score is None:
        verdict_reasons.append("Style fit was not calculated; this does not reduce the opening-specific evidence sample.")
    if verdict == "explore" and games >= HIGH_CONFIDENCE_GAMES:
        verdict_reasons.append("Large sample, mixed signal: the sample is strong, while the chess conclusion remains mixed.")
    return {
        "recommendationId": recommendation_id,
        "verdict": verdict,
        "openingId": _slug(opening_name),
        "openingName": opening_name,
        "opening": opening_name,
        "variationName": item.get("variation") or item.get("line") or None,
        "playerColour": perspective["userColour"],
        "repertoireRole": repertoire_role,
        "repertoire_role": repertoire_role,
        "role": perspective["role"],
        "roleLabel": perspective["label"],
        "relationship": perspective["relationship"],
        "repertoireOwned": perspective["repertoireOwned"],
        "repertoireSlot": perspective["repertoireSlot"],
        "sample": sample,
        "sampleSize": games,
        "sampleThreshold": MIN_OPENING_EVIDENCE,
        "games": games,
        "score": score_rate,
        "scoreRate": score_rate,
        "fitScore": round(max(0, min(100, fit_score)), 1) if fit_score is not None else None,
        "performanceScore": score_rate,
        "issue": issue,
        "confidence": confidence,
        "confidenceLevel": confidence["level"],
        "confidenceReasons": confidence["reasons"],
        **confidence_contract,
        "evidenceStatus": evidence_status,
        "evidence_status": evidence_status,
        "findingType": finding_type,
        "finding_type": finding_type,
        "evidenceCounts": evidence_counts,
        "evidence_counts": evidence_counts,
        "sampleSizeStatus": "sufficient" if games >= MIN_OPENING_EVIDENCE and not validation else "insufficient_data",
        "trainingAction": training_action,
        "recommendedAction": training_action,
        "verdictReasons": verdict_reasons,
        "alternativeOpening": None,
        "alternativeReason": None,
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
            f"{_count_label(games, 'game')}: {_count_label(wins, 'win')}, {_count_label(draws, 'draw')}, {_count_label(losses, 'loss', 'losses')}.",
            f"Chess score: {score_rate}% (draws count as half a point)." if score_rate is not None else "Chess score unavailable.",
            confidence["reason"],
        ],
        "validation": {"valid": not validation, "issues": validation, "diagnostics": diagnostics},
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


def _attach_evidence_backed_alternatives(recommendations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach only same-role alternatives supported by stronger canonical evidence."""
    for current in recommendations:
        if (
            current.get("verdict") != "repair"
            or not current.get("repertoireOwned")
            or current.get("evidenceStatus") != "sufficient"
        ):
            continue
        current_score = _number(current.get("performanceScore"))
        alternatives = [
            candidate for candidate in recommendations
            if candidate.get("recommendationId") != current.get("recommendationId")
            and candidate.get("repertoireOwned")
            and candidate.get("repertoireRole") == current.get("repertoireRole")
            and candidate.get("evidenceStatus") == "sufficient"
            and candidate.get("verdict") == "keep"
            and _number(candidate.get("performanceScore")) is not None
            and current_score is not None
            and float(_number(candidate.get("performanceScore")) or 0) >= float(current_score) + 10
        ]
        if not alternatives:
            continue
        alternative = sorted(
            alternatives,
            key=lambda candidate: (
                -float(_number(candidate.get("performanceScore")) or 0),
                -int(_number(candidate.get("sampleSize")) or 0),
                str(candidate.get("openingName") or "").lower(),
            ),
        )[0]
        reason = (
            f"{alternative['openingName']} is comparable in the same {current['repertoireRole']} role and has "
            f"a {alternative['performanceScore']}% score across {alternative['sampleSize']} correctly attributed games, "
            f"versus {current['performanceScore']}% for {current['openingName']}."
        )
        current["alternativeOpening"] = {
            "openingId": alternative["openingId"],
            "openingName": alternative["openingName"],
            "repertoireRole": alternative["repertoireRole"],
            "sampleSize": alternative["sampleSize"],
            "sampleThreshold": alternative["sampleThreshold"],
            "performanceScore": alternative["performanceScore"],
            "verdict": alternative["verdict"],
            "reason": reason,
        }
        current["alternativeReason"] = reason
    return recommendations


def _time_controls(report: Mapping[str, Any]) -> list[str]:
    raw = (
        report.get("timeControlsIncluded") or report.get("time_controls_included")
        or report.get("effectiveTimeFormat") or report.get("effective_time_format")
        or report.get("analysisTimeFormat") or report.get("analysis_time_format")
    )
    values = raw if isinstance(raw, list) else [raw] if raw else []
    return [str(value).strip() for value in values if str(value).strip()]


def build_repertoire_roles(recommendations: list[Mapping[str, Any]], report: Mapping[str, Any]) -> list[dict[str, Any]]:
    controls = _time_controls(report)
    rows = []
    for spec in REPERTOIRE_ROLE_SPECS:
        matching_role_games: list[Mapping[str, Any]] = []
        unresolved_role_games: list[Mapping[str, Any]] = []
        seen_role_game_ids: set[str] = set()
        for game in _report_games(report):
            game_perspective = perspective_from_item(game)
            game_id = _game_id(game)
            if (
                game_perspective.get("repertoireRole") != spec["role"]
                or game_perspective.get("relationship") != "played"
                or game_id in seen_role_game_ids
            ):
                continue
            seen_role_game_ids.add(game_id)
            if game_perspective.get("roleAttributionTrusted"):
                matching_role_games.append(game)
            else:
                unresolved_role_games.append(game)
        role_games = [game for game in matching_role_games if _name(game)]
        opening_groups: dict[str, dict[str, Any]] = {}
        for game in role_games:
            key = _opening_key(_name(game))
            group = opening_groups.setdefault(key, {"openingName": _name(game), "games": 0, "gameIds": []})
            group["games"] += 1
            group["gameIds"].append(_game_id(game))
        opening_breakdown = sorted(
            opening_groups.values(),
            key=lambda item: (-int(item["games"]), str(item["openingName"]).lower()),
        )
        candidates = [
            item for item in recommendations
            if item.get("repertoireOwned")
            and item.get("repertoireRole") == spec["role"]
            and bool((item.get("validation") or {}).get("valid", True))
        ]
        candidate = sorted(candidates, key=lambda item: (-int(_number((item.get("sample") or {}).get("games")) or 0), str(item.get("openingName") or "").lower()))[0] if candidates else None
        if opening_breakdown:
            leading = opening_breakdown[0]
            opening = str(leading["openingName"]).strip()
            current = int(leading["games"])
            sample_ids = list(leading["gameIds"])
            candidate = next((item for item in candidates if _opening_key(item.get("openingName")) == _opening_key(opening)), None)
        else:
            sample = candidate.get("sample") if isinstance(candidate, Mapping) and isinstance(candidate.get("sample"), Mapping) else {}
            current = max(0, int(_number(sample.get("games")) or 0))
            opening = str(candidate.get("openingName") or "").strip() if candidate else ""
            sample_ids = list(sample.get("gameIds") or [])
            opening_breakdown = [
                {
                    "openingName": str(item.get("openingName") or "").strip(),
                    "games": max(0, int(_number((item.get("sample") or {}).get("games")) or 0)),
                    "gameIds": list((item.get("sample") or {}).get("gameIds") or []),
                }
                for item in candidates
                if int(_number((item.get("sample") or {}).get("games")) or 0) > 0
            ]
        attributed = sum(int(item["games"]) for item in opening_breakdown)
        attributed_openings = len(opening_breakdown)
        additional = max(0, MIN_OPENING_EVIDENCE - current)
        candidate_verdict = str((candidate or {}).get("verdict") or "insufficient-data")
        candidate_confidence = str((candidate or {}).get("confidenceLevel") or ((candidate or {}).get("confidence") or {}).get("level") or "insufficient")
        candidate_evidence_status = str((candidate or {}).get("evidenceStatus") or "")
        if not candidate_evidence_status and candidate:
            candidate_evidence_status = "sufficient" if current >= MIN_OPENING_EVIDENCE else "very_early" if current >= 3 else "insufficient"
        candidate_supported = bool(
            candidate
            and candidate_verdict != "insufficient-data"
            and candidate_evidence_status == "sufficient"
        )
        if unresolved_role_games and not matching_role_games:
            status = "unresolved"
        elif current <= 0:
            status = "insufficient"
        elif current < MIN_OPENING_EVIDENCE:
            status = "building"
        elif candidate_supported:
            status = "established"
        else:
            status = "insufficient"
        target = opening or spec["label"]
        reason_code = None
        if status != "established":
            if attributed_openings > 1 and attributed > current:
                reason_code = "split_across_openings"
            elif current > 0:
                reason_code = "below_evidence_threshold" if current < MIN_OPENING_EVIDENCE else "verdict_or_confidence_unsupported"
            elif matching_role_games:
                reason_code = "opening_unclassified"
            elif unresolved_role_games:
                reason_code = "role_attribution_unresolved"
            else:
                # The analysed report does not retain role-specific counts for games
                # rejected before opening attribution. Do not turn that absence into
                # a claim that no matching public games existed.
                reason_code = "unsupported_or_unknown"
        compatible_alternative = (candidate or {}).get("alternativeOpening")
        confidence_contract = (candidate or {}).get("confidenceExplanation") or (
            f"{current} correctly attributed games support the leading opening; {MIN_OPENING_EVIDENCE} are required."
        )
        rows.append({
            "key": spec["key"], "label": spec["label"], "status": status,
            "role": spec["role"], "repertoireRole": spec["role"],
            "openingName": opening or None, "openingKey": candidate.get("openingId") if candidate else None,
            "currentOpening": opening or None,
            "verdict": candidate_verdict,
            "verdictReasons": list((candidate or {}).get("verdictReasons") or []),
            "fitScore": candidate.get("fitScore") if candidate else None,
            "performanceScore": candidate.get("performanceScore") if candidate else None,
            "evidenceStatus": candidate_evidence_status or ("sufficient" if status == "established" else "insufficient"),
            "confidenceLevel": candidate_confidence,
            "confidenceReasons": list((candidate or {}).get("confidenceReasons") or []),
            "sampleSize": current,
            "sampleThreshold": MIN_OPENING_EVIDENCE,
            "recommendedAction": (candidate or {}).get("recommendedAction"),
            "alternativeOpening": compatible_alternative,
            "alternativeReason": (candidate or {}).get("alternativeReason"),
            "confidence": candidate_confidence,
            "conciseReason": str((candidate or {}).get("trainingAction", {}).get("explanation") or confidence_contract),
            "compatibleAlternative": compatible_alternative,
            "alternativeRole": spec["role"] if compatible_alternative else None,
            "reasonCodes": [value for value in [reason_code, (candidate or {}).get("confidenceReasonCode")] if value],
            "evidenceCount": current, "evidenceGameIds": sample_ids,
            "rawGameCount": int(_number((candidate or {}).get("evidenceCounts", {}).get("classifiedOpeningGames")) or current),
            "relevantGameCount": attributed,
            "supportingGameCount": current,
            "requiredGameCount": MIN_OPENING_EVIDENCE,
            "confidenceReasonCode": (candidate or {}).get("confidenceReasonCode") or reason_code,
            "confidenceExplanation": confidence_contract,
            "evidenceReasonCode": reason_code,
            "evidenceFunnel": {
                # The import total is global and cannot honestly be assigned to a
                # single repertoire role before colour/first-move attribution.
                "importedCandidates": None,
                "passedReportFilters": len(matching_role_games) + len(unresolved_role_games) if _report_games(report) else None,
                "correctlyAttributed": attributed,
                "assignedToLeadingOpening": current,
                "distinctAttributedOpenings": attributed_openings,
                "openingUnclassified": max(0, len(matching_role_games) - attributed) if _report_games(report) else None,
                "roleAttributionUnresolved": len(unresolved_role_games) if _report_games(report) else None,
                "openingBreakdown": opening_breakdown,
                "establishmentThreshold": MIN_OPENING_EVIDENCE,
                "additionalRequired": additional,
            },
            "evidenceRequirement": {
                "requiredRole": spec["role"], "requiredColour": spec["colour"],
                "opponentFirstMove": spec["opponentFirstMove"], "openingFamily": opening or None,
                "timeControls": controls, "currentRelevantSample": current,
                "threshold": MIN_OPENING_EVIDENCE, "additionalRelevantGamesRequired": additional,
                "whyNeeded": f"OpeningFit needs {MIN_OPENING_EVIDENCE} correctly attributed games in this repertoire role before treating one opening as established.",
                "qualifyingEvidence": f"A correctly attributed {target} game that passes the report filters and contributes to this exact repertoire role.",
                "nonGuarantee": "Arbitrary games do not guarantee progress: only games that pass the filters and contribute to this exact role reduce the requirement.",
            },
        })
    return rows


def build_repertoire_coverage_score(repertoire_roles: list[Mapping[str, Any]], primary_problem: Optional[Mapping[str, Any]] = None) -> dict[str, Any]:
    supported = sum(1 for row in repertoire_roles if row.get("status") == "established")
    completeness = round((supported / len(REPERTOIRE_ROLE_SPECS)) * 100, 1)
    evidence_scores = [
        min(100.0, (float(_number(row.get("supportingGameCount") or row.get("evidenceCount")) or 0) / HIGH_CONFIDENCE_GAMES) * 100)
        for row in repertoire_roles
    ]
    evidence_strength = round(sum(evidence_scores) / len(REPERTOIRE_ROLE_SPECS), 1)
    concentration_rows = []
    for row in repertoire_roles:
        funnel = row.get("evidenceFunnel") if isinstance(row.get("evidenceFunnel"), Mapping) else {}
        breakdown = [item for item in funnel.get("openingBreakdown", []) if isinstance(item, Mapping)]
        role_games = sum(max(0, int(_number(item.get("games")) or 0)) for item in breakdown)
        top_games = max([max(0, int(_number(item.get("games")) or 0)) for item in breakdown] or [0])
        top_share = round((top_games / role_games) * 100, 1) if role_games else 0.0
        distinct = len([item for item in breakdown if int(_number(item.get("games")) or 0) > 0])
        scattered = role_games >= 10 and distinct >= 3 and top_share < 50
        concentration_rows.append({
            "key": row.get("key"), "roleGames": role_games, "topOpeningGames": top_games,
            "topOpeningShare": top_share, "distinctOpenings": distinct, "scattered": scattered,
            "explanation": (
                f"The top opening represents {top_share}% of this role across {role_games} correctly attributed games."
                if role_games else "No correctly attributed opening sample is available for this role."
            ),
        })
    concentration = round(sum(item["topOpeningShare"] for item in concentration_rows) / len(REPERTOIRE_ROLE_SPECS), 1)
    problem_role = str((primary_problem or {}).get("repertoireRole") or "")
    problem_scores = []
    for row in repertoire_roles:
        verdict = str(row.get("verdict") or "")
        if problem_role and row.get("repertoireRole") == problem_role:
            problem_scores.append(0.0)
        elif row.get("evidenceStatus") == "sufficient" and verdict == "explore":
            problem_scores.append(50.0)
        else:
            problem_scores.append(100.0)
    unresolved_problems = round(sum(problem_scores) / len(REPERTOIRE_ROLE_SPECS), 1)
    values = {
        "roleCompleteness": completeness,
        "concentrationConsistency": concentration,
        "evidenceStrength": evidence_strength,
        "unresolvedRecurringProblems": unresolved_problems,
    }
    components = [
        {**item, "score": values[item["key"]], "contribution": round(values[item["key"]] * item["weight"] / 100, 2), "available": True}
        for item in REPERTOIRE_COVERAGE_COMPONENTS
    ]
    total = round(sum(item["contribution"] for item in components), 2)
    return {
        "score": total, "formulaVersion": REPERTOIRE_COVERAGE_SCORE_VERSION,
        "components": components, "weightsTotal": sum(item["weight"] for item in components),
        "roleScores": [{
            "key": row.get("key"), "label": row.get("label"), "status": row.get("status"), "evidenceScore": evidence_scores[index],
            "problemResolutionScore": problem_scores[index], **concentration_rows[index],
        } for index, row in enumerate(repertoire_roles)],
        "concentrationRule": {
            "label": "Scattered repertoire threshold",
            "minimumRoleGames": 10,
            "minimumDistinctOpenings": 3,
            "scatteredBelowTopOpeningShare": 50,
            "definition": "A role is called scattered only when it has at least 10 correctly attributed games, at least 3 distinct opening families, and its top opening represents less than 50% of that role.",
        },
        "repairStatus": {
            "key": "repair_target_found" if primary_problem else "no_reliable_repair_target",
            "label": "Reliable repair target found" if primary_problem else "No reliable repair target yet",
            "scored": True,
            "explanation": "An unresolved evidence-backed repair target lowers only the unresolved recurring-problems component.",
        },
        "recentResults": {"scored": False, "explanation": "Recent White and Black results are shown as evidence, not included in repertoire coverage."},
        "meaning": "Coverage combines role completeness, opening concentration, evidence strength and unresolved recurring problems across the three user-played repertoire roles. Opponent openings faced by the player do not fill or lower role completeness. It does not grade opening quality or playing strength.",
    }


def apply_repertoire_coverage_score(report: dict[str, Any], decision: dict[str, Any]) -> None:
    roles = decision["repertoireRoles"]
    score = decision["repertoireCoverageScore"]
    legacy_score = report.get("openingFitScore")
    if legacy_score is None:
        legacy_score = report.get("opening_fit_score")
    report["openingFitScoreLegacyV1"] = legacy_score
    report["opening_fit_score_legacy_v1"] = legacy_score
    report["openingFitScoreLegacyBreakdownV1"] = report.get("openingFitScoreBreakdown") or report.get("opening_fit_score_breakdown")
    report["openingFitScoreLegacyContractV1"] = report.get("openingFitScoreContract") or report.get("opening_fit_score_contract")
    for key in ("openingFitScore", "opening_fit_score", "openingfitScore", "openingfit_score"):
        report[key] = score["score"]
    report["openingFitScoreBreakdown"] = {item["key"]: item["score"] for item in score["components"]}
    report["opening_fit_score_breakdown"] = report["openingFitScoreBreakdown"]
    report["openingFitScoreContract"] = score
    report["opening_fit_score_contract"] = score
    report["openingFitScoreExplanation"] = score["meaning"]
    report["opening_fit_score_explanation"] = score["meaning"]
    report["repertoireRoles"] = roles
    report["repertoire_roles"] = roles
    report["repertoireCoverageScore"] = score
    report["repertoire_coverage_score"] = score


def _training_game_rows(report: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """Merge lightweight and rich copies without letting either change identity."""
    merged: dict[str, dict[str, Any]] = {}
    for key in ("analysis_game_index", "analysisGameIndex", "opening_games", "openingGames", "recent_games", "recentGames"):
        rows = report.get(key)
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, Mapping):
                continue
            game_id = _game_id(row)
            existing = merged.get(game_id, {})
            # Later rich rows fill PGN/player metadata while canonical attribution
            # fields from either representation remain identical.
            merged[game_id] = {**existing, **row}
    return list(merged.values())


def _parsed_training_game(row: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    pgn = str(row.get("pgn") or row.get("PGN") or row.get("rawPgn") or row.get("raw_pgn") or "").strip()
    if not pgn:
        return None
    try:
        parsed = chess.pgn.read_game(io.StringIO(pgn))
        if parsed is None:
            return None
        board = parsed.board()
        moves: list[str] = []
        fens = [board.fen()]
        for move in parsed.mainline_moves():
            moves.append(board.san(move))
            board.push(move)
            fens.append(board.fen())
        if not moves:
            return None
        headers = {str(key).lower(): str(value) for key, value in parsed.headers.items()}
        return {"moves": moves, "fens": fens, "headers": headers}
    except (ValueError, TypeError, IndexError):
        return None


def _training_relationship(value: Any) -> str:
    clean = str(value or "").strip().lower()
    return {"played": "played_by_user", "faced": "faced_by_user"}.get(clean, clean)


def _valid_training_game(
    row: Mapping[str, Any],
    *,
    target: Mapping[str, Any],
    supporting_ids: set[str],
    username: str,
) -> Optional[dict[str, Any]]:
    game_id = _game_id(row)
    if game_id not in supporting_ids:
        return None
    if _opening_key(row.get("openingFamily") or row.get("opening") or row.get("name")) != _opening_key(target.get("openingName")):
        return None
    perspective = perspective_from_item(row)
    target_role = str(target.get("role") or "")
    if perspective.get("role") != target_role:
        return None
    if _training_relationship(row.get("relationship") or perspective.get("relationship")) != _training_relationship(target.get("relationship")):
        return None
    target_colour = str(target.get("playerColour") or "")
    row_colour = str(row.get("playerColour") or perspective.get("userColour") or row.get("colour") or row.get("color") or "")
    if target_colour not in {"white", "black"} or row_colour != target_colour:
        return None
    parsed = _parsed_training_game(row)
    if not parsed:
        return None
    white = normalise_player_identifier(row.get("white_username") or row.get("whiteUsername") or parsed["headers"].get("white"))
    black = normalise_player_identifier(row.get("black_username") or row.get("blackUsername") or parsed["headers"].get("black"))
    if not username or (white == username) == (black == username):
        return None
    if (target_colour == "white" and white != username) or (target_colour == "black" and black != username):
        return None
    classification_ply = int(_number(row.get("classificationPly") or row.get("classification_ply")) or 0)
    if classification_ply <= 0 or classification_ply > len(parsed["moves"]):
        return None
    return {
        "id": game_id,
        "row": row,
        "moves": parsed["moves"],
        "fens": parsed["fens"],
        "classificationPly": classification_ply,
        "playedAt": str(row.get("playedAt") or row.get("played_at") or row.get("endTime") or row.get("end_time") or ""),
        "result": str(row.get("playerResult") or row.get("result") or "unknown").lower(),
    }


def _numbered_san(moves: list[str]) -> str:
    tokens = []
    for index, move in enumerate(moves):
        tokens.append(f"{index // 2 + 1}. {move}" if index % 2 == 0 else move)
    return " ".join(tokens)


def _safe_epoch(value: Any) -> float:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return 0


def _training_line_contract(target: Mapping[str, Any], report: Mapping[str, Any], evidence_ids: list[str]) -> dict[str, Any]:
    username = normalise_player_identifier(report.get("username") or report.get("playerName") or report.get("player_name"))
    supporting_ids = set(evidence_ids)
    valid = [
        parsed for row in _training_game_rows(report)
        if (parsed := _valid_training_game(row, target=target, supporting_ids=supporting_ids, username=username)) is not None
    ]
    if not valid:
        return {
            "representativeGameIds": [],
            "recognisedLine": None,
            "classificationPly": None,
            "positionFen": None,
            "opponentContinuation": None,
            "playerResponse": None,
            "firstRepeatedDivergence": None,
            "expectedMoves": [],
        }

    line_counts = Counter(tuple(game["moves"][:game["classificationPly"]]) for game in valid)
    recognised_moves, _ = sorted(line_counts.items(), key=lambda item: (-item[1], item[0]))[0]
    matching_line = [game for game in valid if tuple(game["moves"][:game["classificationPly"]]) == recognised_moves]
    player_colour = str(target.get("playerColour"))
    opponent_colour = "black" if player_colour == "white" else "white"

    branches = []
    player_first_moves = []
    for game in matching_line:
        start = game["classificationPly"]
        opponent_index = next((index for index in range(start, len(game["moves"])) if ("white" if index % 2 == 0 else "black") == opponent_colour), None)
        player_index = next((index for index in range(start, len(game["moves"])) if ("white" if index % 2 == 0 else "black") == player_colour), None)
        if player_index is not None:
            player_first_moves.append((game["moves"][player_index], game["id"]))
        if opponent_index is None:
            continue
        response_index = next((index for index in range(opponent_index + 1, len(game["moves"])) if ("white" if index % 2 == 0 else "black") == player_colour), None)
        branches.append({
            "game": game,
            "opponentIndex": opponent_index,
            "opponentMove": game["moves"][opponent_index],
            "responseIndex": response_index,
            "responseMove": game["moves"][response_index] if response_index is not None else None,
        })

    opponent_counts = Counter(branch["opponentMove"] for branch in branches)
    opponent_move = sorted(opponent_counts.items(), key=lambda item: (-item[1], item[0]))[0][0] if opponent_counts else None
    opponent_branches = [branch for branch in branches if branch["opponentMove"] == opponent_move]
    response_counts = Counter(branch["responseMove"] for branch in opponent_branches if branch["responseMove"])
    response_move = sorted(response_counts.items(), key=lambda item: (-item[1], item[0]))[0][0] if response_counts else None
    representative_pool = list(opponent_branches) or [{"game": game, "opponentIndex": None, "responseIndex": None} for game in matching_line]
    result_rank = {"loss": 0, "draw": 1, "win": 2}
    representative_pool.sort(key=lambda branch: (
        result_rank.get(branch["game"]["result"], 3),
        -_safe_epoch(branch["game"]["playedAt"]),
        branch["game"]["id"],
    ))
    representative_ids = [branch["game"]["id"] for branch in representative_pool[:3]]
    position_fen = None
    practice_line = list(recognised_moves)
    if opponent_branches:
        representative = opponent_branches[0]
        opponent_index = representative["opponentIndex"]
        practice_line = representative["game"]["moves"][:opponent_index + 1]
        position_fen = representative["game"]["fens"][opponent_index + 1]

    divergence_counts = Counter(move for move, _ in player_first_moves)
    divergence = None
    if len(divergence_counts) > 1:
        choices = [{"move": move, "games": count} for move, count in sorted(divergence_counts.items(), key=lambda item: (-item[1], item[0]))]
        divergence = {"ply": matching_line[0]["classificationPly"] + (0 if ("white" if matching_line[0]["classificationPly"] % 2 == 0 else "black") == player_colour else 1), "choices": choices}
    return {
        "representativeGameIds": representative_ids,
        "recognisedLine": _numbered_san(list(recognised_moves)),
        "practiceLine": _numbered_san(practice_line),
        "classificationPly": len(recognised_moves),
        "positionFen": position_fen,
        "opponentContinuation": {
            "move": opponent_move,
            "games": opponent_counts.get(opponent_move, 0),
            "supportingGameIds": [branch["game"]["id"] for branch in opponent_branches],
        } if opponent_move else None,
        "playerResponse": {
            "move": response_move,
            "games": response_counts.get(response_move, 0),
            "supportingGameIds": [branch["game"]["id"] for branch in opponent_branches if branch.get("responseMove") == response_move],
        } if response_move else None,
        "firstRepeatedDivergence": divergence,
        "expectedMoves": [response_move] if response_move else [],
    }


def _training_priority(action: Mapping[str, Any], recommendations: list[Mapping[str, Any]], report: Mapping[str, Any]) -> dict[str, Any]:
    recommendation_id = str(action.get("recommendationId") or "").strip()
    target = next((item for item in recommendations if item.get("recommendationId") == recommendation_id), None)
    sample = action.get("sample") if isinstance(action.get("sample"), Mapping) else {}
    confidence = target.get("confidence") if isinstance(target, Mapping) and isinstance(target.get("confidence"), Mapping) else {}
    opening = str(action.get("opening") or (target or {}).get("openingName") or "").strip() or None
    role = str(action.get("role") or (target or {}).get("role") or "").strip() or None
    repertoire_role = str(action.get("repertoireRole") or (target or {}).get("repertoireRole") or "").strip() or RepertoireRole.UNRESOLVED.value
    colour = str(action.get("colour") or (target or {}).get("playerColour") or "").strip() or None
    action_type = str(action.get("type") or "review").strip()
    completion = action.get("completionTarget") if isinstance(action.get("completionTarget"), Mapping) else {}
    opening_key = str((target or {}).get("openingId") or (_slug(opening) if opening else "")).strip() or None
    colour_label = colour.title() if colour in {"white", "black"} else None
    if action_type == "prepare_against" and opening:
        title = f"Prepare against {opening}{f' as {colour_label}' if colour_label else ''}"
    elif action_type == "repair_repertoire" and opening:
        title = f"Repair {opening}{f' as {colour_label}' if colour_label else ''}"
    elif action_type == "consolidate_strength" and opening:
        title = f"Reinforce {opening}{f' as {colour_label}' if colour_label else ''}"
    else:
        title = str(action.get("title") or action.get("label") or "Build more opening evidence").strip()
    task_type = (
        "position_drill" if action.get("lineOrPosition")
        else "concept_review" if action_type == "collect_more_games"
        else "game_review" if action_type in {"repair_repertoire", "prepare_against", "consolidate_strength"}
        else "concept_review"
    )
    priority_identity = recommendation_id or f"{action_type}:{opening_key or 'report'}"
    priority_id = f"training-{priority_identity}"
    evidence_ids = list(dict.fromkeys(str(value) for value in (sample.get("gameIds") or []) if str(value)))
    line_contract = _training_line_contract(target or {}, report, evidence_ids) if target else {
        "representativeGameIds": [], "recognisedLine": None, "practiceLine": None,
        "classificationPly": None, "positionFen": None, "opponentContinuation": None,
        "playerResponse": None, "firstRepeatedDivergence": None, "expectedMoves": [],
    }
    recorded_line = line_contract.get("practiceLine") or line_contract.get("recognisedLine") or action.get("lineOrPosition")
    has_recorded_line = bool(recorded_line)
    response_move = str((line_contract.get("playerResponse") or {}).get("move") or "").strip()
    objective = (
        f"In your next five relevant {opening} games, reach the recognised branch and rehearse {response_move}; record whether you used it."
        if opening and response_move else
        f"In your next five relevant {opening} games, record whether you reached the recognised opening setup."
        if opening else
        "In your next five relevant games, record the opening role and the first position where your plan became unclear."
    )
    workflow_steps = []
    if line_contract["representativeGameIds"]:
        workflow_steps.append({"type": "source_game_review", "label": "Review up to three verified games from this exact opening and context.", "source": "user_games"})
    else:
        workflow_steps.append({"type": "line_rehearsal", "label": "No verified source game is retained; rehearse the recognised line without a source-game claim.", "source": "report_line_or_general_guidance"})
    if line_contract.get("firstRepeatedDivergence"):
        workflow_steps.append({"type": "decision_point", "label": "Compare your first repeated move divergence after the recognised opening position.", "source": "user_games"})
    else:
        workflow_steps.append({"type": "decision_point", "label": "Identify the first position after the recognised line where your plan became unclear.", "source": "report_and_general_guidance"})
    workflow_steps.append({"type": "response_plan", "label": f"Rehearse {response_move} once as your response." if response_move else "Save and rehearse one short response plan.", "source": "report_and_general_guidance"})
    workflow_steps.append({
        "type": "position_practice" if has_recorded_line else "setup_practice",
        "label": "Practise the recorded position." if has_recorded_line else "Practise a clearly labelled general setup drill.",
        "source": "user_games" if line_contract["representativeGameIds"] else "report_line" if has_recorded_line else "general_guidance",
    })
    workflow_steps.append({"type": "next_game_objective", "label": objective, "source": "completion_contract"})
    return {
        "schemaVersion": 2,
        "priorityId": priority_id,
        "taskId": priority_id,
        "recommendationId": recommendation_id or None,
        "openingName": opening,
        "openingKey": opening_key,
        "role": role,
        "contextRole": role,
        "playerRole": canonical_player_role(target or {}),
        "relationship": _training_relationship((target or {}).get("relationship") or "unknown"),
        "repertoireRole": repertoire_role,
        "repertoire_role": repertoire_role,
        "findingType": str(action.get("findingType") or (target or {}).get("findingType") or "insufficient_evidence"),
        "finding_type": str(action.get("findingType") or (target or {}).get("findingType") or "insufficient_evidence"),
        "playerColour": colour,
        "taskType": task_type,
        "title": title,
        "rationale": str(action.get("reason") or action.get("explanation") or "Review the report evidence before your next games.").strip(),
        "reasonSelected": str(action.get("reason") or action.get("explanation") or "Review the report evidence before your next games.").strip(),
        "selectionCriteria": [
            "The opening is tied to the submitted player's attributed role and context.",
            f"The decision uses {max(0, int(_number(sample.get('games')) or 0))} unique supporting games.",
            "A repeated result or consistency signal is preferred when the report supports one.",
            "A recurring branch is preferred when it can be recovered from matching games.",
            "Recency is used only to break otherwise comparable choices.",
        ],
        "selectionFactors": dict((target or {}).get("priorityFactors") or {}),
        "evidenceCount": max(0, int(_number(sample.get("games")) or 0)),
        "supportingGameCount": max(0, int(_number(sample.get("games")) or 0)),
        "evidenceGameIds": evidence_ids,
        "estimatedDurationMinutes": 10,
        "successCheck": str(completion.get("label") or "Complete the practice and record one practical takeaway.").strip(),
        "confidenceStatus": str(confidence.get("level") or "unknown").strip(),
        "confidence": dict(confidence),
        "sourceReportId": report.get("analysisId") or report.get("analysis_id") or report.get("reportId") or report.get("report_id"),
        "lineOrPosition": recorded_line,
        "recognisedLine": line_contract.get("recognisedLine"),
        "practiceLine": line_contract.get("practiceLine"),
        "classificationPly": line_contract.get("classificationPly"),
        "positionFen": line_contract.get("positionFen"),
        "opponentContinuation": line_contract.get("opponentContinuation"),
        "playerResponse": line_contract.get("playerResponse"),
        "firstRepeatedDivergence": line_contract.get("firstRepeatedDivergence"),
        "expectedMoves": line_contract.get("expectedMoves") or [],
        "representativeGameIds": line_contract.get("representativeGameIds") or [],
        "representativeGameStatus": "verified" if line_contract.get("representativeGameIds") else "unavailable",
        "nextGameObjective": objective,
        "objectiveGameCount": 5,
        "completionTarget": dict(completion),
        "workflowSteps": workflow_steps,
        "sessionSteps": workflow_steps,
        "fallbackSetupDrill": None if has_recorded_line else {
            "source": "general_guidance",
            "label": "General opening setup",
            "instruction": "Complete development, support the centre and secure the king before choosing a structure-specific pawn break.",
        },
        "sourceGameAvailability": {
            "supportingGames": max(0, int(_number(sample.get("games")) or 0)),
            "referencedGameIds": len(evidence_ids),
        },
        "fallback": False,
        "fallbackReason": None,
    }


def assert_decision_consistency(decision: Mapping[str, Any]) -> None:
    """Fail closed when two fields in the authoritative contract disagree."""
    recommendations = [row for row in decision.get("recommendations", []) if isinstance(row, Mapping)]
    by_context = {
        (_opening_key(row.get("openingName")), str(row.get("repertoireRole") or "")): row
        for row in recommendations
        if row.get("repertoireOwned")
    }
    for row in recommendations:
        sample = int(_number(row.get("sampleSize")) or 0)
        threshold = int(_number(row.get("sampleThreshold")) or MIN_OPENING_EVIDENCE)
        confidence = str(row.get("confidenceLevel") or "")
        if sample >= threshold and row.get("evidenceStatus") in {"insufficient", "very_early"}:
            raise ValueError(f"decision_contract: sufficient sample marked {row.get('evidenceStatus')}")
        if confidence == "high_sample" and row.get("verdict") == "insufficient-data":
            raise ValueError("decision_contract: high sample confidence marked insufficient")
        completion = (row.get("recommendedAction") or {}).get("completionTarget") or {}
        if sample >= threshold and completion.get("type") == "new_games":
            raise ValueError("decision_contract: sufficient sample asks for threshold games")
        alternative = row.get("alternativeOpening")
        if alternative and (
            row.get("verdict") != "repair"
            or alternative.get("repertoireRole") != row.get("repertoireRole")
            or not row.get("alternativeReason")
        ):
            raise ValueError("decision_contract: incompatible or unexplained alternative")
    for role in decision.get("roleDecisions", []):
        if not isinstance(role, Mapping) or not role.get("currentOpening"):
            continue
        recommendation = by_context.get((_opening_key(role.get("currentOpening")), str(role.get("repertoireRole") or "")))
        if recommendation and role.get("verdict") != recommendation.get("verdict"):
            raise ValueError("decision_contract: role verdict differs from opening verdict")
    if decision.get("primaryProblem") is None and any(row.get("verdict") == "repair" and row.get("repertoireOwned") for row in recommendations):
        raise ValueError("decision_contract: repair verdict exists without a primary problem")


def build_report_decision(
    report: Mapping[str, Any],
    *,
    openings: Iterable[Mapping[str, Any]],
    previous_report: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    recommendations = _attach_evidence_backed_alternatives([
        _canonical_recommendation(report, item) for item in openings if _name(item)
    ])
    owned = [item for item in recommendations if item["repertoireOwned"] and item["validation"]["valid"]]
    faced = [item for item in recommendations if item["relationship"] == "faced" and item["verdict"] == "explore"]
    strengths = [item for item in owned if item["verdict"] == "keep"]
    problems = [item for item in owned if item["verdict"] == "repair"]
    mixed_signals = [item for item in owned if item["verdict"] == "explore" and item["evidenceStatus"] == "sufficient"]
    strength = sorted(
        strengths,
        key=lambda item: (-item["priority"], -item["sample"]["games"], -item["sample"]["scoreRate"], item["openingName"].lower(), item["role"]),
    )[0] if strengths else None
    problem = sorted(
        problems,
        key=lambda item: (-item["priority"], -item["sample"]["games"], item["openingName"].lower(), item["role"]),
    )[0] if problems else None
    mixed = sorted(
        mixed_signals,
        key=lambda item: (-item["priority"], -item["sample"]["games"], item["openingName"].lower(), item["role"]),
    )[0] if mixed_signals else None

    if problem:
        training = problem["trainingAction"]
        action = {
            "type": "repair_repertoire", "opening": problem["openingName"], "role": problem["role"],
            "repertoireRole": problem["repertoireRole"], "findingType": problem["findingType"],
            "label": training["title"], "reason": training["explanation"],
            "recommendationId": problem["recommendationId"], "sample": problem["sample"],
            **training,
        }
    elif faced:
        preparation = sorted(faced, key=lambda item: (-item["priority"], -item["sample"]["games"], item["openingName"].lower(), item["role"]))[0]
        training = preparation["trainingAction"]
        action = {
            "type": "prepare_against", "opening": preparation["openingName"], "role": preparation["role"],
            "repertoireRole": preparation["repertoireRole"], "findingType": preparation["findingType"],
            "label": training["title"], "reason": training["explanation"],
            "recommendationId": preparation["recommendationId"], "sample": preparation["sample"],
            **training,
        }
    elif strength:
        training = strength["trainingAction"]
        action = {
            "type": "consolidate_strength", "opening": strength["openingName"], "role": strength["role"],
            "repertoireRole": strength["repertoireRole"], "findingType": "stable_strength",
            "label": training["title"], "reason": training["explanation"],
            "recommendationId": strength["recommendationId"], "sample": strength["sample"],
            **training,
        }
    elif mixed:
        training = mixed["recommendedAction"]
        action = {
            "type": "review_mixed_signal", "opening": mixed["openingName"], "role": mixed["role"],
            "repertoireRole": mixed["repertoireRole"], "findingType": "mixed_signal",
            "label": training["title"], "reason": training["explanation"],
            "recommendationId": mixed["recommendationId"], "sample": mixed["sample"],
            **training,
        }
    else:
        action = {
            "type": "collect_more_games", "opening": None, "role": None,
            "repertoireRole": RepertoireRole.UNRESOLVED.value, "findingType": "insufficient_evidence",
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
    training_priority = _training_priority(action, recommendations, report)
    repertoire_roles = build_repertoire_roles(recommendations, report)
    repertoire_coverage_score = build_repertoire_coverage_score(repertoire_roles, problem)
    evidence = []
    if strength:
        evidence.extend(strength["evidence"][:2])
    if problem:
        evidence.extend(problem["evidence"][:2])
    evidence.append(action["reason"])
    findings = [
        {
            "type": item["findingType"],
            "opening": item["openingName"],
            "repertoireRole": item["repertoireRole"],
            "playerColour": item["playerColour"],
            "supportingGameCount": item["supportingGameCount"],
            "confidenceReasonCode": item["confidenceReasonCode"],
            "recommendationId": item["recommendationId"],
        }
        for item in recommendations
    ]
    findings.extend({
        "type": "repertoire_gap" if role["status"] in {"insufficient", "unresolved"} and not role.get("currentOpening") else "insufficient_evidence",
        "opening": role.get("currentOpening"),
        "repertoireRole": role["repertoireRole"],
        "playerColour": role.get("evidenceRequirement", {}).get("requiredColour"),
        "supportingGameCount": role["supportingGameCount"],
        "confidenceReasonCode": role.get("confidenceReasonCode"),
        "recommendationId": None,
    } for role in repertoire_roles if role["status"] != "established")
    decision = {
        "schemaVersion": 4,
        "recommendations": recommendations,
        "findings": findings,
        "establishedStrength": strength,
        "primaryProblem": problem,
        "nextTrainingAction": action,
        "trainingPriority": training_priority,
        "repertoireRoles": repertoire_roles,
        "roleDecisions": repertoire_roles,
        "repertoireCoverageScore": repertoire_coverage_score,
        "supportingEvidence": evidence,
        "reportCoverage": coverage,
        "confidence": {
            "status": "sufficient" if strength or problem or faced or mixed else "insufficient_data",
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
    assert_decision_consistency(decision)
    return decision
