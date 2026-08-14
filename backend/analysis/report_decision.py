from __future__ import annotations

import hashlib
import io
import re
from collections import Counter
from datetime import datetime
from typing import Any, Iterable, Mapping, Optional

import chess
import chess.pgn

from analysis.opening_perspective import RepertoireRole, normalise_player_identifier, perspective_from_item, validate_repertoire_role_for_game
from analysis.classified_game import canonical_player_role
from analysis.evidence_thresholds import (
    HIGH_CONFIDENCE_GAMES,
    MINIMUM_OPENING_GAMES,
    MODERATE_CONFIDENCE_GAMES,
)


MIN_OPENING_EVIDENCE = MINIMUM_OPENING_GAMES
MEDIUM_CONFIDENCE_GAMES = MODERATE_CONFIDENCE_GAMES
MIN_COMPARABLE_REPORT_GAMES = 5
REPERTOIRE_HEALTH_VERSION = "repertoire_health_v2"
OPENING_SUITABILITY_VERSION = "opening_suitability_v1"
OBSERVED_PERFORMANCE_VERSION = "observed_performance_v1"
EVIDENCE_CONFIDENCE_VERSION = "evidence_confidence_v1"
OPENING_DIAGNOSIS_VERSION = "opening_diagnosis_v1"
OPENING_DIAGNOSIS_METHOD = "legal_pgn_normalised_position_v1"
MAX_DIAGNOSIS_PLY = 20
# Compatibility alias for callers and stored reports written before the score was
# given its precise product name. The arithmetic is intentionally unchanged.
REPERTOIRE_COVERAGE_SCORE_VERSION = REPERTOIRE_HEALTH_VERSION
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
    "processing_failure",
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


def _result_counts(games: list[Mapping[str, Any]]) -> tuple[int, int, int, int]:
    results = [str(game.get("result") or "").lower() for game in games]
    wins, draws, losses = results.count("win"), results.count("draw"), results.count("loss")
    return wins, draws, losses, wins + draws + losses


def _candidate_score_rate(item: Mapping[str, Any], games: int, wins: int, draws: int) -> Optional[float]:
    if games and wins + draws + int(_number(item.get("losses")) or 0) == games:
        return round(((wins + draws * 0.5) / games) * 100, 1)
    # Win rate is deliberately not a fallback: draws count for score rate but not
    # for win rate, so the two measurements are not interchangeable.
    for key in ("scoreRate", "score_rate", "rawResultScore", "raw_result_score", "score"):
        value = _number(item.get(key))
        if value is not None:
            return round(max(0, min(100, value * 100 if 0 <= value <= 1 else value)), 1)
    return None


def _public_confidence_level(level: Any, games: int) -> str:
    raw = str(level or "").strip().lower()
    if raw in {"context_uncertain", "insufficient", "very_early", "no_personal_evidence"} or games <= 3:
        return "insufficient"
    if raw == "low" or games <= 9:
        return "low"
    if raw in {"moderate", "medium"} or games < HIGH_CONFIDENCE_GAMES:
        return "medium"
    return "high"


def _evidence_confidence_contract(confidence: Mapping[str, Any], *, games: int, scope: str) -> dict[str, Any]:
    level = _public_confidence_level(confidence.get("level"), games)
    label = {"insufficient": "Insufficient", "low": "Low", "medium": "Medium", "high": "High"}[level]
    return {
        "version": EVIDENCE_CONFIDENCE_VERSION,
        "level": level,
        "label": label,
        "scope": scope,
        "sampleSize": games,
        "sampleTier": (
            "no_personal_performance_evidence" if games == 0 else
            "too_little_for_firm_verdict" if games <= 3 else
            "useful_signal_needs_more_games" if games <= 9 else
            "stronger_opening_specific_evidence"
        ),
        "reasons": list(confidence.get("reasons") or [confidence.get("reason") or "Evidence confidence is unavailable."]),
        "explanation": str(confidence.get("reason") or "Evidence confidence is unavailable."),
    }


def _observed_performance_contract(
    *, games: int, wins: int, draws: int, losses: int, role: str, colour: str,
    baseline: Optional[float] = None, baseline_source: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    if games <= 0:
        return None
    known_results = wins + draws + losses
    if not known_results or known_results > games:
        return None
    win_rate = (wins / known_results) * 100
    score_rate = ((wins + 0.5 * draws) / known_results) * 100
    return {
        "version": OBSERVED_PERFORMANCE_VERSION,
        "games": games, "knownResults": known_results, "wins": wins, "draws": draws, "losses": losses,
        "winRate": round(win_rate, 1) if win_rate is not None else None,
        "scoreRate": round(score_rate, 1) if score_rate is not None else None,
        "relevantBaseline": round(baseline, 1) if baseline is not None else None,
        "baselineSource": baseline_source,
        "baselineDifference": round(score_rate - baseline, 1) if score_rate is not None and baseline is not None else None,
        "role": role, "colour": colour,
        "sampleTier": "insufficient" if games <= 3 else "low" if games <= 9 else "medium" if games < HIGH_CONFIDENCE_GAMES else "high",
        "drawTreatment": "Draws count as half a point in Score Rate; Win Rate counts wins only.",
    }


def _opening_suitability_contract(item: Mapping[str, Any], *, fit_score: Optional[float], games: int, confidence: Mapping[str, Any]) -> dict[str, Any]:
    score = round(max(0, min(100, fit_score)), 1) if fit_score is not None else None
    style_available = any(item.get(key) is not None for key in (
        "traitFitScore", "trait_fit_score", "styleFitScore", "style_fit_score", "fitScore", "fit_score",
    ))
    played_available = games > 0
    rationale = str(item.get("fitExplanation") or item.get("fit_explanation") or item.get("reason") or "").strip()
    if games == 0:
        rationale = "This is a style/repertoire estimate, not proven by your results. " + (rationale or "No personal game evidence is available yet.")
    elif not rationale:
        rationale = "This suitability estimate is separate from the observed game result and does not override the authoritative recommendation."
    evidence_sources = []
    if played_available:
        evidence_sources.append("role-attributed played games")
    if style_available:
        evidence_sources.append("deterministic style/repertoire inputs")
    return {
        "version": OPENING_SUITABILITY_VERSION,
        "score": score,
        "evidenceSources": evidence_sources,
        "currentlyPlayed": played_available,
        "playedGameContributionAvailable": played_available,
        "styleCatalogueContributionAvailable": style_available,
        "rationale": rationale,
        "confidence": _evidence_confidence_contract(confidence, games=games, scope="opening_suitability"),
        "meaning": "An estimate of repertoire and style fit; it is not observed performance or a chess rating.",
    }


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
    expected_context_id = str(item.get("canonicalContextId") or item.get("canonical_context_id") or "")
    expected = perspective_from_item(item)
    seen, matched = set(), []
    for game in _report_games(report):
        game_context_id = str(game.get("canonicalContextId") or game.get("canonical_context_id") or "")
        if expected_context_id and game_context_id != expected_context_id:
            continue
        perspective = perspective_from_item(game)
        if _opening_key(game.get("opening") or game.get("name")) != expected_name:
            continue
        if perspective.get("repertoireRole") != expected.get("repertoireRole"):
            continue
        if expected.get("relationship") == "played":
            legal, _reason = validate_repertoire_role_for_game(str(expected.get("repertoireRole") or ""), game)
            if not legal:
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
    elif games <= 3:
        level = "insufficient"
        reason = f"{_count_label(games, 'opening-specific game')} is too little data for a firm verdict."
    elif games <= 9:
        level = "low"
        reason = f"{_count_label(games, 'opening-specific game')} is a useful signal, but needs more games."
    elif games < HIGH_CONFIDENCE_GAMES:
        level = "moderate"
        reason = f"{_count_label(games, 'opening-specific game')} provides stronger evidence, while the chess conclusion still depends on the result pattern."
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
    if supporting_games <= 3:
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
        wins, draws, losses, known_results = _result_counts(matched)
        supporting_ids = [_game_id(game) for game in matched]
        if raw_games and raw_games != games:
            diagnostics.append("source_sample_replaced_by_supporting_games")
    else:
        games = _games(item)
        wins = int(_number(item.get("wins")) or 0)
        draws = int(_number(item.get("draws")) or 0)
        losses = int(_number(item.get("losses")) or 0)
        known_results = int(_number(item.get("knownResults") or item.get("known_results")) or (wins + draws + losses))
        supporting_ids = [str(value) for value in (item.get("supportingGameIds") or item.get("supporting_game_ids") or []) if str(value)]

    result_total = wins + draws + losses
    known_results = min(games, known_results, result_total)
    complete_results = known_results == games
    if result_total > games:
        validation.append("results_exceed_sample")
    elif not complete_results:
        diagnostics.append("unknown_results_excluded_from_score_rate")
    if supporting_ids and len(supporting_ids) != games:
        validation.append("supporting_games_do_not_reconcile")
    score_rate = round(((wins + draws * 0.5) / known_results) * 100, 1) if known_results else _candidate_score_rate(item, games, wins, draws)
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
    canonical_context_id = str(item.get("canonicalContextId") or item.get("canonical_context_id") or "")
    canonical_aggregate_id = str(item.get("canonicalAggregateId") or item.get("canonical_aggregate_id") or "")
    recommendation_id = canonical_aggregate_id or (f"opening-aggregate:{canonical_context_id}" if canonical_context_id else f"{_slug(opening_name)}:{repertoire_role}:{perspective['role']}")
    sample = {
        "gameIds": supporting_ids,
        "games": games,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "knownResults": known_results,
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
    evidence_confidence = _evidence_confidence_contract(confidence, games=games, scope="opening_decision")
    classification_confidence = {
        "level": "trusted" if perspective.get("openingSide") in {"white", "black"} else "unresolved",
        "label": "Opening side classified" if perspective.get("openingSide") in {"white", "black"} else "Opening side unresolved",
        "source": perspective.get("classificationSource"),
    }
    role_attribution_confidence = {
        "level": "trusted" if perspective.get("roleAttributionTrusted") else "unresolved",
        "label": "Role attribution trusted" if perspective.get("roleAttributionTrusted") else "Role attribution unresolved",
        "reasonCode": perspective.get("attributionReasonCode"),
    }
    recommendation_confidence = {
        "level": evidence_confidence["level"] if not validation else "insufficient",
        "label": evidence_confidence["label"] if not validation else "Recommendation unresolved",
        "scope": "recommendation",
        "reasons": [*confidence["reasons"], *validation],
    }
    observed_performance = _observed_performance_contract(
        games=games, wins=wins, draws=draws, losses=losses,
        role=repertoire_role, colour=perspective["userColour"],
    )
    opening_suitability = _opening_suitability_contract(
        item, fit_score=fit_score, games=games, confidence=confidence,
    )
    return {
        "recommendationId": recommendation_id,
        "decisionId": f"opening-decision:{canonical_context_id}" if canonical_context_id else f"opening-decision:{recommendation_id}",
        "canonicalContextId": canonical_context_id or None,
        "canonicalAggregateId": canonical_aggregate_id or (recommendation_id if canonical_context_id else None),
        "verdict": verdict,
        "openingId": _slug(opening_name),
        "openingName": opening_name,
        "opening": opening_name,
        "variationName": item.get("variation") or item.get("line") or None,
        "playerColour": perspective["userColour"],
        "repertoireRole": repertoire_role,
        "repertoire_role": repertoire_role,
        "roleAttributionTrusted": bool(perspective.get("roleAttributionTrusted")),
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
        "observedPerformance": observed_performance,
        "observed_performance": observed_performance,
        "openingSuitability": opening_suitability,
        "opening_suitability": opening_suitability,
        "evidenceConfidence": evidence_confidence,
        "evidence_confidence": evidence_confidence,
        "sampleSizeConfidence": evidence_confidence,
        "classificationConfidence": classification_confidence,
        "roleAttributionConfidence": role_attribution_confidence,
        "recommendationConfidence": recommendation_confidence,
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
        "gamesNeeded": max(0, MIN_OPENING_EVIDENCE - games),
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


def _attach_relevant_baselines(recommendations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach one role-local comparison without changing the recorded result."""
    for candidate in recommendations:
        peers = [
            row for row in recommendations
            if row is not candidate
            and row.get("repertoireOwned")
            and row.get("repertoireRole") == candidate.get("repertoireRole")
            and row.get("evidenceStatus") == "sufficient"
            and row.get("verdict") != "repair"
            and _number(row.get("performanceScore")) is not None
        ]
        peer_games = sum(int(_number(row.get("sampleSize")) or 0) for row in peers)
        if peer_games:
            baseline = sum(
                float(_number(row.get("performanceScore")) or 0) * int(_number(row.get("sampleSize")) or 0)
                for row in peers
            ) / peer_games
            baseline_source = "other supported openings in the same repertoire role"
        else:
            baseline = 50.0
            baseline_source = "neutral chess-score reference for this role"
        score = _number(candidate.get("performanceScore"))
        candidate["relevantBaseline"] = round(baseline, 1)
        candidate["baselineDifference"] = round(float(score) - baseline, 1) if score is not None else None
        candidate["baselineReason"] = baseline_source
        sample = candidate.get("sample") if isinstance(candidate.get("sample"), Mapping) else {}
        observed = _observed_performance_contract(
            games=int(_number(sample.get("games")) or 0),
            wins=int(_number(sample.get("wins")) or 0),
            draws=int(_number(sample.get("draws")) or 0),
            losses=int(_number(sample.get("losses")) or 0),
            role=str(candidate.get("repertoireRole") or "unknown"),
            colour=str(candidate.get("playerColour") or "unknown"),
            baseline=baseline,
            baseline_source=baseline_source,
        )
        candidate["observedPerformance"] = observed
        candidate["observed_performance"] = observed
        if candidate.get("verdict") == "repair" and not candidate.get("issue"):
            if candidate["baselineDifference"] is None or candidate["baselineDifference"] > -10:
                candidate["verdict"] = "explore"
                candidate["findingType"] = candidate["finding_type"] = "mixed_signal"
                candidate["trainingAction"] = candidate["recommendedAction"] = {
                    "title": f"Watch {candidate['openingName']} without changing it yet",
                    "explanation": "The observed score is below 45%, but it is not materially below the relevant role baseline and no repeated structural issue was recorded.",
                    "concept": "Separate a mixed result signal from a proven opening weakness.",
                    "exercise": f"Review one recent {candidate['openingName']} game and keep the opening stable while collecting more evidence.",
                    "completionTarget": {"type": "reviewed_games", "count": 1, "label": "Review one game without changing the repertoire."},
                    "colour": candidate.get("playerColour"),
                }
                candidate["verdictReasons"].append(
                    "The result is not at least 10 points below its relevant role baseline, so it is not promoted as a repair."
                )
    return recommendations


def _confidence_rank(candidate: Mapping[str, Any]) -> int:
    return {
        "high_sample": 4, "moderate": 3, "low": 2,
        "very_early": 1, "insufficient": 0, "context_uncertain": 0,
    }.get(str(candidate.get("confidenceLevel") or ""), 0)


def _repair_order(candidate: Mapping[str, Any]) -> tuple[Any, ...]:
    difference = _number(candidate.get("baselineDifference"))
    return (
        float(difference) if difference is not None else 0.0,
        -_confidence_rank(candidate),
        -int(_number(candidate.get("sampleSize")) or 0),
        int(_number((candidate.get("priorityFactors") or {}).get("recencyDays")))
        if _number((candidate.get("priorityFactors") or {}).get("recencyDays")) is not None else 999999,
        str(candidate.get("openingId") or ""),
        str(candidate.get("repertoireRole") or ""),
    )


def _style_experiments(report: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Normalise unplayed catalogue suggestions without personal-evidence claims."""
    raw = report.get("recommended_openings") or report.get("recommendedOpeningsByStyle") or {}
    rows = []
    if isinstance(raw, Mapping):
        for role, values in raw.items():
            if role not in {"white", "black_vs_e4", "black_vs_d4"} or not isinstance(values, list):
                continue
            for value in values:
                if isinstance(value, Mapping):
                    rows.append((role, value))
    experiments = []
    seen = set()
    for role, item in rows:
        name = _name(item)
        games = _games(item)
        key = (_opening_key(name), role)
        if not name or games != 0 or key in seen:
            continue
        seen.add(key)
        colour = "white" if role == "white" else "black"
        reason = str(
            item.get("reason") or item.get("whyItFits") or item.get("why_it_fits")
            or f"This is an unplayed style/repertoire-fit suggestion for {role.replace('_', ' ')}."
        ).strip()
        experiment_confidence = _evidence_confidence_contract(
            {"level": "no_personal_evidence", "reason": "No personal performance evidence is available for this experiment."},
            games=0, scope="opening_suitability",
        )
        experiment_suitability = _opening_suitability_contract(
            item, fit_score=_number(item.get("fitScore") if item.get("fitScore") is not None else item.get("fit_score")),
            games=0, confidence={"level": "no_personal_evidence", "reason": "No personal performance evidence is available for this experiment."},
        )
        experiments.append({
            "recommendationId": f"experiment:{_slug(name)}:{role}",
            "openingId": _slug(name), "canonicalOpeningId": _slug(name),
            "openingName": name, "opening": name, "repertoireRole": role,
            "playerColour": colour, "targetType": "opening", "verdict": "experiment",
            "games": 0, "wins": 0, "draws": 0, "losses": 0, "scoreRate": None,
            "relevantBaseline": None, "baselineDifference": None,
            "confidenceLevel": "no_personal_evidence",
            "confidenceReason": "No played-game evidence supports this experiment yet.",
            "observedPerformance": None, "observed_performance": None,
            "evidenceConfidence": experiment_confidence, "evidence_confidence": experiment_confidence,
            "openingSuitability": experiment_suitability, "opening_suitability": experiment_suitability,
            "evidenceGameIds": [], "conciseReason": reason,
            "nextAction": f"Try one 10-minute general setup rehearsal for {name} before deciding whether to test it.",
            "trainingDuration": {"minutes": 10},
            "successCheck": "Complete one labelled setup rehearsal; do not treat it as proven until relevant games exist.",
            "source": "style_repertoire_catalogue", "fallback": False,
        })
    return sorted(experiments, key=lambda row: (row["repertoireRole"], row["openingId"]))


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
                or game_id in seen_role_game_ids
            ):
                continue
            seen_role_game_ids.add(game_id)
            legal, legality_reason = validate_repertoire_role_for_game(spec["role"], game)
            if not legal:
                unresolved_role_games.append({**dict(game), "roleLegalityReasonCode": legality_reason})
                continue
            if game_perspective.get("roleAttributionTrusted"):
                matching_role_games.append(game)
            else:
                unresolved_role_games.append(game)
        # Every eligible game belongs to its colour/first-move role. Only an
        # opening conventionally played by the user can establish the user's
        # leading opening inside that role.
        role_games = [
            game for game in matching_role_games
            if _name(game) and perspective_from_item(game).get("relationship") == "played"
        ]
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
        elif not _has_report_game_collection(report):
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
        else:
            current, opening, sample_ids, opening_breakdown, candidate = 0, "", [], [], None
        attributed = sum(int(item["games"]) for item in opening_breakdown)
        attributed_openings = len(opening_breakdown)
        additional = max(0, MIN_OPENING_EVIDENCE - current)
        candidate_verdict = str((candidate or {}).get("verdict") or "insufficient-data")
        candidate_confidence = str((candidate or {}).get("confidenceLevel") or ((candidate or {}).get("confidence") or {}).get("level") or "insufficient")
        candidate_evidence_status = str((candidate or {}).get("evidenceStatus") or "")
        if not candidate_evidence_status and candidate:
            candidate_evidence_status = "sufficient" if current >= MIN_OPENING_EVIDENCE else "very_early" if current >= 4 else "insufficient"
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
            "relevantGameCount": len(matching_role_games),
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
                "roleAttributed": len(matching_role_games),
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
    role_evidence_counts = [max(0, int(_number(row.get("supportingGameCount") or row.get("evidenceCount")) or 0)) for row in repertoire_roles]
    evidence_scores = [min(100.0, (count / HIGH_CONFIDENCE_GAMES) * 100) for count in role_evidence_counts]
    available_evidence_scores = [score for score, count in zip(evidence_scores, role_evidence_counts) if count > 0]
    evidence_strength = round(sum(available_evidence_scores) / len(available_evidence_scores), 1) if available_evidence_scores else None
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
    available_concentration = [item["topOpeningShare"] for item in concentration_rows if item["roleGames"] > 0]
    concentration = round(sum(available_concentration) / len(available_concentration), 1) if available_concentration else None
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
    available_problem_scores = [score for score, count in zip(problem_scores, role_evidence_counts) if count > 0]
    unresolved_problems = round(sum(available_problem_scores) / len(available_problem_scores), 1) if available_problem_scores else None
    values = {
        "roleCompleteness": completeness,
        "concentrationConsistency": concentration,
        "evidenceStrength": evidence_strength,
        "unresolvedRecurringProblems": unresolved_problems,
    }
    available_weight = sum(item["weight"] for item in REPERTOIRE_COVERAGE_COMPONENTS if values[item["key"]] is not None)
    components = []
    all_role_game_ids = list(dict.fromkeys(
        str(game_id)
        for role in repertoire_roles
        for game_id in (role.get("evidenceGameIds") or [])
        if str(game_id)
    ))
    for item in REPERTOIRE_COVERAGE_COMPONENTS:
        value = values[item["key"]]
        available = value is not None
        effective_weight = (item["weight"] / available_weight * 100) if available and available_weight else 0.0
        direction = "neutral" if not available or 40 < float(value) < 70 else "helping" if float(value) >= 70 else "dragging"
        components.append({
            **item,
            "componentId": f"health:{item['key']}",
            "targetCanonicalContextId": "repertoire:all",
            "opening": None,
            "context": "all_repertoire_roles",
            "supportingGameIds": all_role_game_ids,
            "supportingGameCount": len(all_role_game_ids),
            "metric": item["key"],
            "direction": direction,
            "explanationReasonCode": f"{item['key']}_{direction}",
            "destinationActionId": "report-action:repertoire-health",
            "evidenceSource": f"canonical-health-metric:{item['key']}",
            "explanation": (f"{item['label']} is {direction} at {value}% across {len(all_role_game_ids)} unique role-attributed games." if available else f"{item['label']} is neutral because no role-attributed evidence is available."),
            "value": value,
            "score": value,
            "baseWeight": item["weight"],
            "effectiveWeight": round(effective_weight, 6),
            "contribution": round(value * effective_weight / 100, 6) if available else None,
            "available": available,
            "availabilityReason": "Evidence is available." if available else "No role-attributed personal-game evidence is available for this component.",
        })
    total = round(sum(float(item["contribution"] or 0) for item in components), 6) if available_weight else None
    ranked = sorted(
        [item for item in components if item["available"]],
        key=lambda item: ((100 - float(item["value"])) * float(item["effectiveWeight"]), item["key"]),
        reverse=True,
    )
    limiting = [{"key": item["key"], "label": item["label"], "value": item["value"]} for item in ranked[:2]]
    strongest = [
        {"key": item["key"], "label": item["label"], "value": item["value"]}
        for item in sorted([item for item in components if item["available"]], key=lambda item: (item["value"], item["key"]), reverse=True)[:2]
    ]
    missing_roles = [str(row.get("label") or row.get("key")) for row in repertoire_roles if row.get("status") != "established"]
    if primary_problem:
        weakness_explanation = f"{primary_problem.get('openingName') or primary_problem.get('opening')} is the evidence-backed repair target."
    elif missing_roles:
        weakness_explanation = f"No single played opening stands out as the main weakness, but your repertoire is incomplete in {', '.join(missing_roles)}."
    elif evidence_strength is None or evidence_strength < 40:
        weakness_explanation = "No single weakness is proven yet. Limited evidence is reducing your Repertoire Health."
    elif limiting:
        weakness_explanation = "No single opening currently has enough evidence to qualify as an authoritative repair target. " + "The main limits are " + " and ".join(item["label"].lower() for item in limiting) + "."
    else:
        weakness_explanation = "No single opening currently has enough evidence to qualify as an authoritative repair target."
    explanation = (
        "Repertoire Health is held back mainly by " + " and ".join(item["label"].lower() for item in limiting) + "."
        if limiting and total is not None and total < 70 else
        "The most useful improvement lever is " + limiting[0]["label"].lower() + "."
        if limiting else "Repertoire Health is unavailable until repertoire evidence exists."
    )
    total_role_games = sum(role_evidence_counts)
    health_confidence = _evidence_confidence_contract(
        {"level": "high_sample" if total_role_games >= 50 else "moderate" if total_role_games >= 10 else "low" if total_role_games >= 4 else "insufficient",
         "reason": f"{total_role_games} correctly attributed repertoire-role games support this overall health snapshot."},
        games=total_role_games, scope="repertoire_health",
    )
    return {
        "score": total, "version": REPERTOIRE_HEALTH_VERSION, "formulaVersion": REPERTOIRE_HEALTH_VERSION,
        "displayName": "Repertoire Health",
        "components": components,
        "baseWeightsTotal": sum(item["weight"] for item in components),
        "effectiveWeightsTotal": round(sum(item["effectiveWeight"] for item in components), 6),
        "weightsTotal": sum(item["weight"] for item in components),
        "limitingFactors": limiting, "strongestFactors": strongest,
        "explanation": explanation, "weaknessExplanation": weakness_explanation,
        "confidence": health_confidence,
        "comparisonEligibility": {"eligible": False, "reason": "Comparison eligibility is set from the report-level baseline contract."},
        "evidenceUsed": {"roleAttributedGames": total_role_games, "establishedRoles": supported, "totalRoles": len(REPERTOIRE_ROLE_SPECS)},
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
        "meaning": "Repertoire Health combines role completeness, opening concentration, evidence strength and unresolved recurring problems across the three user-played repertoire roles. It does not measure general chess strength, tactics, accuracy, next-game winning chances, or the quality of one opening.",
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
    report["repertoireHealth"] = score
    report["repertoire_health"] = score


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
        if parsed is None or parsed.errors:
            return None
        board = parsed.board()
        moves: list[str] = []
        uci_moves: list[str] = []
        fens = [board.fen()]
        positions = [{"ply": 0, "fen": board.fen(), "key": " ".join(board.fen().split()[:4]), "turn": "white"}]
        for move in parsed.mainline_moves():
            moves.append(board.san(move))
            uci_moves.append(move.uci())
            board.push(move)
            fens.append(board.fen())
            positions.append({
                "ply": len(moves),
                "fen": board.fen(),
                # Half/full-move clocks do not change the legal position. Board,
                # turn, castling and legally relevant en-passant state do.
                "key": " ".join(board.fen().split()[:4]),
                "turn": "white" if board.turn == chess.WHITE else "black",
            })
        if not moves:
            return None
        headers = {str(key).lower(): str(value) for key, value in parsed.headers.items()}
        return {"moves": moves, "uciMoves": uci_moves, "fens": fens, "positions": positions, "headers": headers}
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
        "uciMoves": parsed["uciMoves"],
        "fens": parsed["fens"],
        "positions": parsed["positions"],
        "classificationPly": classification_ply,
        "playedAt": str(row.get("playedAt") or row.get("played_at") or row.get("endTime") or row.get("end_time") or ""),
        "result": str(row.get("playerResult") or row.get("result") or "unknown").lower(),
        "url": str(row.get("url") or row.get("gameUrl") or row.get("game_url") or "").strip(),
        "eco": str(row.get("eco") or "").strip() or None,
        "variation": str(row.get("variation") or "").strip() or None,
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


def _common_prefix(rows: list[list[str]]) -> list[str]:
    if not rows:
        return []
    prefix = list(rows[0])
    for row in rows[1:]:
        limit = min(len(prefix), len(row))
        index = 0
        while index < limit and prefix[index] == row[index]:
            index += 1
        prefix = prefix[:index]
    return prefix


def _diagnosis_confidence(games: int, precision: str) -> tuple[str, str]:
    subject = (
        "reproduce this position" if precision == "exact_position"
        else "reproduce this opening branch" if precision in {"variation", "move_order"}
        else "support this opening-level review"
    )
    if games < 2:
        return "insufficient", "A repeated target requires at least two distinct supporting games."
    if games < 5:
        return "low", f"{games} distinct games {subject}; treat it as a review target, not an objective move verdict."
    if games < 10:
        return "medium", f"{games} distinct games {subject}, providing useful personal evidence without an objective move-quality claim."
    return "high", f"{games} distinct games {subject}, providing strong personal evidence without an objective move-quality claim."


def _representative_ids(games: list[Mapping[str, Any]]) -> list[str]:
    result_rank = {"loss": 0, "draw": 1, "win": 2}
    return [str(game["id"]) for game in sorted(
        games,
        key=lambda game: (result_rank.get(str(game.get("result")), 3), -_safe_epoch(game.get("playedAt")), str(game["id"])),
    )[:3]]


def _trusted_diagnosis_continuation(
    report: Mapping[str, Any],
    *,
    opening: str,
    colour: str,
    position_key: Optional[str],
    position_fen: Optional[str],
) -> Optional[dict[str, Any]]:
    """Pass through only an existing legal repertoire/reference continuation."""
    if not position_key or not position_fen:
        return None
    try:
        board = chess.Board(position_fen)
    except ValueError:
        return None
    trusted_sources = {
        "active_repertoire_line": "saved repertoire",
        "opening_reference_line": "existing opening catalogue",
    }
    matches = []
    rows = report.get("openingTrainingOpportunities") or report.get("opening_training_opportunities") or []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        source = str(row.get("source") or "").strip()
        if source not in trusted_sources:
            continue
        row_opening = str(row.get("openingId") or row.get("opening_id") or row.get("openingName") or row.get("opening_name") or "").strip()
        if _slug(row_opening) != _slug(opening):
            continue
        if str(row.get("side") or row.get("playerColour") or row.get("player_colour") or "").strip().lower() != colour:
            continue
        raw_fen = str(row.get("positionFen") or row.get("position_fen") or "").strip()
        raw_key = str(row.get("positionKey") or row.get("position_key") or "").strip()
        if raw_fen:
            try:
                raw_key = " ".join(chess.Board(raw_fen).fen().split()[:4])
            except ValueError:
                continue
        if raw_key != position_key:
            continue
        raw_move = str(row.get("recommendedMove") or row.get("recommended_move") or "").strip()
        try:
            move = board.parse_san(raw_move)
            san = board.san(move)
        except (ValueError, TypeError):
            continue
        matches.append((source, san, trusted_sources[source]))
    unique = sorted(set(matches))
    if len(unique) != 1:
        return None
    source, move, label = unique[0]
    return {"move": move, "source": source, "sourceLabel": label}


def _build_opening_diagnosis(target: Mapping[str, Any], report: Mapping[str, Any], evidence_ids: list[str]) -> dict[str, Any]:
    """Resolve one deterministic diagnosis inside the selected opening/context only."""
    username = normalise_player_identifier(report.get("username") or report.get("playerName") or report.get("player_name"))
    supporting_ids = set(evidence_ids)
    valid = [
        parsed for row in _training_game_rows(report)
        if (parsed := _valid_training_game(row, target=target, supporting_ids=supporting_ids, username=username)) is not None
    ]
    valid_by_id = {str(game["id"]): game for game in valid}
    valid = [valid_by_id[key] for key in sorted(valid_by_id)]
    opening = str(target.get("openingName") or target.get("opening") or "this opening")
    role = str(target.get("repertoireRole") or RepertoireRole.UNRESOLVED.value)
    colour = str(target.get("playerColour") or "unknown")
    source_report_id = report.get("analysisId") or report.get("analysis_id") or report.get("reportId") or report.get("report_id")
    decision_id = target.get("decisionId") or target.get("actionId")

    position_occurrences: dict[str, dict[str, Mapping[str, Any]]] = {}
    for game in valid:
        start = max(0, game["classificationPly"])
        stop = min(len(game["moves"]), MAX_DIAGNOSIS_PLY)
        for position in game["positions"][start:stop + 1]:
            ply = int(position["ply"])
            if position["turn"] != colour:
                continue
            position_occurrences.setdefault(str(position["key"]), {}).setdefault(str(game["id"]), {
                "game": game,
                "position": position,
                "move": game["moves"][ply] if ply < len(game["moves"]) else None,
                "uci": game["uciMoves"][ply] if ply < len(game["uciMoves"]) else None,
            })

    candidates = []
    for position_key, by_game in position_occurrences.items():
        occurrences = list(by_game.values())
        if len(occurrences) < 2:
            continue
        continuation_counts = Counter(str(row["move"]) for row in occurrences if row.get("move"))
        score_points = sum({"win": 1.0, "draw": 0.5}.get(str(row["game"].get("result")), 0.0) for row in occurrences)
        representative = min(occurrences, key=lambda row: (int(row["position"]["ply"]), str(row["game"]["id"])))
        candidates.append({
            "key": position_key,
            "occurrences": occurrences,
            "continuations": continuation_counts,
            "inconsistency": len(continuation_counts),
            "scoreRate": score_points / len(occurrences),
            "ply": int(representative["position"]["ply"]),
            "fen": str(representative["position"]["fen"]),
        })
    exact_candidates = [row for row in candidates if row["inconsistency"] > 1]
    pool = exact_candidates or candidates
    selected = sorted(pool, key=lambda row: (-len(row["occurrences"]), -row["inconsistency"], row["scoreRate"], row["ply"], row["key"]))[0] if pool else None

    precision = "exact_position" if selected and selected["inconsistency"] > 1 else "move_order" if selected else "variation" if any(game.get("variation") for game in valid) and len(valid) >= 2 else "opening" if valid else "insufficient_evidence"
    diagnosis_games = [row["game"] for row in selected["occurrences"]] if selected else valid
    diagnosis_ids = [str(game["id"]) for game in diagnosis_games]
    representative_ids = _representative_ids(diagnosis_games)
    san_prefix = _common_prefix([game["moves"][:selected["ply"]] if selected else game["moves"][:game["classificationPly"]] for game in diagnosis_games])
    uci_prefix = _common_prefix([game["uciMoves"][:selected["ply"]] if selected else game["uciMoves"][:game["classificationPly"]] for game in diagnosis_games])
    variation_counts = Counter(str(game.get("variation")) for game in diagnosis_games if game.get("variation"))
    variation = sorted(variation_counts.items(), key=lambda row: (-row[1], row[0]))[0][0] if variation_counts else str(target.get("variationName") or "").strip() or None
    eco_counts = Counter(str(game.get("eco")) for game in diagnosis_games if game.get("eco"))
    eco = sorted(eco_counts.items(), key=lambda row: (-row[1], row[0]))[0][0] if eco_counts else None
    continuations = sorted((selected or {}).get("continuations", {}).items(), key=lambda row: (-row[1], row[0]))
    repeated = {"move": continuations[0][0], "games": continuations[0][1], "source": "repeated_personal_continuation"} if continuations else None
    alternatives = [{"move": move, "games": count, "source": "repeated_personal_continuation"} for move, count in continuations[1:]]
    trusted_continuation = _trusted_diagnosis_continuation(
        report,
        opening=opening,
        colour=colour,
        position_key=(selected or {}).get("key"),
        position_fen=(selected or {}).get("fen"),
    )
    confidence, confidence_reason = _diagnosis_confidence(len(diagnosis_games), precision)
    if precision == "exact_position":
        diagnosis_text = f"You reached this legal position in {len(diagnosis_games)} games and chose {len(continuations)} different continuations. This is the first strongest repeated position where your plan is inconsistent."
        task = (
            f"Replay the {min(3, len(representative_ids))} supplied {opening} games to this position, compare your continuations, then rehearse {trusted_continuation['move']} from your {trusted_continuation['sourceLabel']}."
            if trusted_continuation else
            f"Replay the {min(3, len(representative_ids))} supplied {opening} games to this position, compare your continuations, then choose one legal continuation to test."
        )
        success = "Complete the supplied reviews and rehearse the sourced continuation three times." if trusted_continuation else "Complete the supplied reviews and rehearse your chosen legal continuation three times."
        divergence_type = "inconsistent_player_continuations"
    elif precision in {"move_order", "variation"}:
        diagnosis_text = f"You reached this repeated {variation or 'opening move order'} in {len(diagnosis_games)} games, but the data does not support an objective best-move claim."
        task = f"Replay up to three supplied {opening} games through the repeated line, compare the first player decision that differs, and save one legal continuation to test."
        success = "Complete the supplied reviews and record one legal continuation for the next five relevant games."
        divergence_type = "repeated_move_order"
    elif precision == "opening":
        diagnosis_text = f"This opening-level pattern recurs across {len(diagnosis_games)} supporting {opening} games, but no single repeated legal position or variation was retained."
        task = f"Compare up to three supplied {opening} games and mark the first position where your plans diverge; do not assume a move is a mistake."
        success = "Complete the supplied reviews and record one position to revisit after more games."
        divergence_type = "opening_level_review"
    else:
        diagnosis_text = f"The saved {opening} evidence does not contain enough valid PGN data for a repeated-position diagnosis."
        task = f"Review the available {opening} evidence at opening level and collect another complete game before narrowing the diagnosis."
        success = "Record one opening-plan question and add a complete relevant game before reassessing."
        divergence_type = "insufficient_legal_move_evidence"
    fallback = precision in {"opening", "opening_family", "insufficient_evidence"}
    diagnosis_id = "diagnosis:" + hashlib.sha256("|".join([str(decision_id or source_report_id or "report"), opening, role, str((selected or {}).get("key") or precision), *diagnosis_ids]).encode()).hexdigest()[:20]
    diagnosis_scope = "position" if precision == "exact_position" else "variation" if precision in {"move_order", "variation"} else "opening"
    lost_game_count = sum(1 for game in diagnosis_games if str(game.get("result") or "").lower() == "loss")
    opening_scope_ids = sorted(set(str(value) for value in evidence_ids if str(value)))
    repeated_line_evidence = ({
        "scope": diagnosis_scope,
        "precisionLevel": precision,
        "supportingGameIds": diagnosis_ids,
        "supportingGameCount": len(diagnosis_ids),
        "positionKey": (selected or {}).get("key"),
        "variation": variation,
    } if precision in {"exact_position", "move_order", "variation"} else None)
    return {
        "version": OPENING_DIAGNOSIS_VERSION, "diagnosisId": diagnosis_id,
        "trainingTaskId": f"training-task:{diagnosis_id.removeprefix('diagnosis:')}",
        "sourceReportId": source_report_id, "canonicalDecisionId": decision_id,
        "opening": opening, "openingFamily": opening, "variation": variation, "eco": eco,
        "repertoireRole": role, "playerColour": colour, "precisionLevel": precision,
        "diagnosisScope": diagnosis_scope,
        "openingScopeEvidence": {"scope": "opening", "supportingGameIds": opening_scope_ids, "supportingGameCount": len(opening_scope_ids)},
        "repeatedLineEvidence": repeated_line_evidence,
        "confidence": confidence, "confidenceReason": confidence_reason,
        "gamesConsidered": len(valid), "supportingGameIds": diagnosis_ids,
        "affectedGameCount": len(diagnosis_ids), "lostGameCount": lost_game_count,
        "supportingGameUrls": [game["url"] for game in diagnosis_games if game.get("url")],
        "representativeGameId": representative_ids[0] if representative_ids else None,
        "representativeGameIds": representative_ids,
        "commonMovePrefix": {"san": _numbered_san(san_prefix) if san_prefix else None, "uci": uci_prefix},
        "positionFen": (selected or {}).get("fen"), "positionKey": (selected or {}).get("key"),
        "playerToMove": colour if selected else None, "targetPly": (selected or {}).get("ply"),
        "targetMoveNumber": ((selected["ply"] // 2) + 1) if selected else None,
        "repeatedContinuation": repeated, "alternativeContinuations": alternatives,
        "authoritativeContinuation": trusted_continuation,
        "continuationSource": trusted_continuation["source"] if trusted_continuation else "no_authoritative_continuation_available",
        "divergenceType": divergence_type,
        "evidenceSummary": f"{len(diagnosis_games)} distinct supporting games; {len(valid)} valid PGNs considered from {len(evidence_ids)} canonical evidence IDs.",
        "userFacingDiagnosis": diagnosis_text, "trainingTask": task, "successCheck": success,
        "fallbackUsed": fallback,
        "fallbackReason": diagnosis_text if fallback else None,
        "method": OPENING_DIAGNOSIS_METHOD,
        "engineAnalysisUsed": False,
        "objectiveMoveClaimed": False,
    }


def _training_priority(action: Mapping[str, Any], recommendations: list[Mapping[str, Any]], report: Mapping[str, Any]) -> dict[str, Any]:
    recommendation_id = str(action.get("recommendationId") or "").strip()
    target = next((item for item in recommendations if item.get("recommendationId") == recommendation_id), None)
    if target is None and action.get("opening"):
        target = next((item for item in recommendations if (
            _opening_key(item.get("openingName")) == _opening_key(action.get("opening"))
            and str(item.get("repertoireRole") or "") == str(action.get("repertoireRole") or "")
        )), None)
    sample = action.get("sample") if isinstance(action.get("sample"), Mapping) else {}
    confidence = target.get("confidence") if isinstance(target, Mapping) and isinstance(target.get("confidence"), Mapping) else {}
    confidence_status = str(confidence.get("level") or action.get("confidenceLevel") or "insufficient").strip()
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
    diagnosis_target = {**dict(target or {}), "decisionId": action.get("decisionId"), "actionId": action.get("actionId")}
    diagnosis = _build_opening_diagnosis(diagnosis_target, report, evidence_ids) if target else None
    diagnosis_evidence_ids = list((diagnosis or {}).get("supportingGameIds") or evidence_ids)
    common_prefix = (diagnosis or {}).get("commonMovePrefix") if isinstance((diagnosis or {}).get("commonMovePrefix"), Mapping) else {}
    recorded_line = common_prefix.get("san") or action.get("lineOrPosition")
    has_recorded_line = bool(recorded_line)
    objective = (
        f"In your next five relevant {opening} games, record whether you reached the diagnosed position and used the continuation you chose to test."
        if opening and (diagnosis or {}).get("positionFen") else
        f"In your next five relevant {opening} games, record the first position where your plan becomes unclear."
        if opening else
        "In your next five relevant games, record the opening role and the first position where your plan became unclear."
    )
    workflow_steps = []
    representative_ids = list((diagnosis or {}).get("representativeGameIds") or [])
    if representative_ids:
        workflow_steps.append({"type": "source_game_review", "label": "Review up to three verified games from this exact opening and context.", "source": "user_games"})
    else:
        workflow_steps.append({"type": "line_rehearsal", "label": "No verified source game is retained; rehearse the recognised line without a source-game claim.", "source": "report_line_or_general_guidance"})
    if (diagnosis or {}).get("divergenceType") == "inconsistent_player_continuations":
        workflow_steps.append({"type": "decision_point", "label": "Compare your continuations at the diagnosed repeated position.", "source": "user_games"})
    else:
        workflow_steps.append({"type": "decision_point", "label": "Identify the first position after the recognised line where your plan became unclear.", "source": "report_and_general_guidance"})
    workflow_steps.append({"type": "response_plan", "label": "Choose and rehearse one legal continuation; OpeningFit is not claiming an engine-best move.", "source": "user_choice"})
    workflow_steps.append({
        "type": "position_practice" if has_recorded_line else "setup_practice",
        "label": "Practise the recorded position." if has_recorded_line else "Practise a clearly labelled general setup drill.",
        "source": "user_games" if representative_ids else "report_line" if has_recorded_line else "general_guidance",
    })
    workflow_steps.append({"type": "next_game_objective", "label": objective, "source": "completion_contract"})
    return {
        "schemaVersion": 3,
        "decisionId": action.get("decisionId"),
        "actionId": action.get("actionId"),
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
        "verdict": action.get("verdict"),
        "title": title,
        "rationale": str((diagnosis or {}).get("userFacingDiagnosis") or action.get("reason") or action.get("explanation") or "Review the report evidence before your next games.").strip(),
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
        "evidenceGameIds": diagnosis_evidence_ids,
        "canonicalEvidenceGameIds": evidence_ids,
        "estimatedDurationMinutes": 10,
        "trainingDuration": dict(action.get("trainingDuration") or {"minutes": 10}),
        "nextAction": str((diagnosis or {}).get("trainingTask") or action.get("nextAction") or action.get("exercise") or action.get("explanation") or "").strip(),
        "successCheck": str((diagnosis or {}).get("successCheck") or completion.get("label") or "Complete the practice and record one practical takeaway.").strip(),
        "confidenceStatus": confidence_status,
        "confidence": dict(confidence) if confidence else {"level": confidence_status, "reason": action.get("confidenceReason")},
        "sourceReportId": report.get("analysisId") or report.get("analysis_id") or report.get("reportId") or report.get("report_id"),
        "diagnosisId": (diagnosis or {}).get("diagnosisId"),
        "openingDiagnosis": diagnosis,
        "lineOrPosition": recorded_line,
        "recognisedLine": recorded_line,
        "practiceLine": recorded_line,
        "classificationPly": (diagnosis or {}).get("targetPly"),
        "positionFen": (diagnosis or {}).get("positionFen"),
        "opponentContinuation": None,
        "playerResponse": (diagnosis or {}).get("repeatedContinuation"),
        "firstRepeatedDivergence": {"ply": (diagnosis or {}).get("targetPly"), "choices": (diagnosis or {}).get("alternativeContinuations") or []} if (diagnosis or {}).get("divergenceType") == "inconsistent_player_continuations" else None,
        # Repeated personal choices are evidence only. A move is marked for
        # rehearsal solely when an existing validated catalogue/repertoire line
        # matches this exact legal position.
        "expectedMoves": [diagnosis["authoritativeContinuation"]["move"]] if (diagnosis or {}).get("authoritativeContinuation") else [],
        "representativeGameIds": representative_ids,
        "representativeGameStatus": "verified" if representative_ids else "unavailable",
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
            "supportingGames": len(diagnosis_evidence_ids),
            "canonicalOpeningGames": max(0, int(_number(sample.get("games")) or 0)),
            "referencedGameIds": len(diagnosis_evidence_ids),
        },
        "fallback": action.get("type") not in {"repair_repertoire", "consolidate_strength"},
        "fallbackReason": str(action.get("reason")) if action.get("type") not in {"repair_repertoire", "consolidate_strength"} else None,
    }


def assert_decision_consistency(decision: Mapping[str, Any]) -> None:
    """Fail closed when two fields in the authoritative contract disagree."""
    recommendations = [row for row in decision.get("recommendations", []) if isinstance(row, Mapping)]
    seen_decision_ids: set[str] = set()
    context_verdicts: dict[tuple[str, str, str, str], str] = {}
    for row in recommendations:
        recommendation_id = str(row.get("recommendationId") or "")
        if not recommendation_id or recommendation_id in seen_decision_ids:
            raise ValueError("decision_contract: recommendation IDs must be present and unique")
        seen_decision_ids.add(recommendation_id)
        context_id = (
            str(row.get("openingId") or _opening_key(row.get("openingName"))),
            str(row.get("repertoireRole") or ""),
            str(row.get("role") or ""),
            str(row.get("relationship") or ""),
        )
        prior_verdict = context_verdicts.get(context_id)
        if prior_verdict is not None and prior_verdict != str(row.get("verdict") or ""):
            raise ValueError("decision_contract: conflicting verdicts for one canonical opening context")
        context_verdicts[context_id] = str(row.get("verdict") or "")
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
        observed = row.get("observedPerformance")
        if sample == 0 and observed is not None:
            raise ValueError("decision_contract: zero-game opening exposes observed performance")
        if isinstance(observed, Mapping):
            wins = int(_number(observed.get("wins")) or 0)
            draws = int(_number(observed.get("draws")) or 0)
            losses = int(_number(observed.get("losses")) or 0)
            known_results = int(_number(observed.get("knownResults")) or (wins + draws + losses))
            if wins + draws + losses != known_results or known_results > sample:
                raise ValueError("decision_contract: observed performance does not reconcile")
            expected_win_rate = round(wins / known_results * 100, 1)
            expected_score_rate = round((wins + draws * 0.5) / known_results * 100, 1)
            if _number(observed.get("winRate")) != expected_win_rate or _number(observed.get("scoreRate")) != expected_score_rate:
                raise ValueError("decision_contract: observed performance rates diverge from WDL")
        if row.get("openingSuitability") != row.get("opening_suitability") or row.get("evidenceConfidence") != row.get("evidence_confidence"):
            raise ValueError("decision_contract: score contract aliases diverge")
    for role in decision.get("roleDecisions", []):
        if not isinstance(role, Mapping) or not role.get("currentOpening"):
            continue
        recommendation = by_context.get((_opening_key(role.get("currentOpening")), str(role.get("repertoireRole") or "")))
        if recommendation and role.get("verdict") != recommendation.get("verdict"):
            raise ValueError("decision_contract: role verdict differs from opening verdict")
    if decision.get("primaryProblem") is None and any(row.get("verdict") == "repair" and row.get("repertoireOwned") for row in recommendations):
        raise ValueError("decision_contract: repair verdict exists without a primary problem")

    primary = decision.get("primaryAction")
    legacy = decision.get("nextTrainingAction")
    priority = decision.get("trainingPriority")
    if primary != legacy:
        raise ValueError("decision_contract: primaryAction and nextTrainingAction differ")
    if priority and primary and (
        priority.get("decisionId") != primary.get("decisionId")
        or priority.get("recommendationId") != primary.get("recommendationId")
        or priority.get("openingName") != primary.get("opening")
        or priority.get("repertoireRole") != primary.get("repertoireRole")
        or priority.get("verdict") != primary.get("verdict")
        or priority.get("nextAction") != primary.get("nextAction")
        or priority.get("trainingDuration") != primary.get("trainingDuration")
        or priority.get("confidenceStatus") != primary.get("confidenceLevel")
        or priority.get("successCheck") != primary.get("successCheck")
    ):
        raise ValueError("decision_contract: training priority differs from primary action")
    diagnosis = decision.get("openingDiagnosis") or decision.get("opening_diagnosis")
    if decision.get("openingDiagnosis") != decision.get("opening_diagnosis"):
        raise ValueError("decision_contract: opening diagnosis aliases diverge")
    if diagnosis:
        primary_ids = set(str(value) for value in ((primary or {}).get("evidenceGameIds") or []))
        diagnosis_ids = [str(value) for value in diagnosis.get("supportingGameIds") or []]
        representative_ids = [str(value) for value in diagnosis.get("representativeGameIds") or []]
        if len(diagnosis_ids) != len(set(diagnosis_ids)) or not set(diagnosis_ids).issubset(primary_ids):
            raise ValueError("decision_contract: diagnosis evidence escapes the primary opening sample")
        if not set(representative_ids).issubset(set(diagnosis_ids)):
            raise ValueError("decision_contract: diagnosis representative game is unsupported")
        opening_scope = diagnosis.get("openingScopeEvidence") if isinstance(diagnosis.get("openingScopeEvidence"), Mapping) else {}
        opening_scope_ids = [str(value) for value in opening_scope.get("supportingGameIds") or []]
        if len(opening_scope_ids) != len(set(opening_scope_ids)) or int(_number(opening_scope.get("supportingGameCount")) or 0) != len(opening_scope_ids):
            raise ValueError("decision_contract: opening diagnosis scope does not reconcile")
        line_scope = diagnosis.get("repeatedLineEvidence") if isinstance(diagnosis.get("repeatedLineEvidence"), Mapping) else None
        if line_scope:
            line_ids = [str(value) for value in line_scope.get("supportingGameIds") or []]
            if len(line_ids) != len(set(line_ids)) or int(_number(line_scope.get("supportingGameCount")) or 0) != len(line_ids) or not set(line_ids).issubset(set(opening_scope_ids)):
                raise ValueError("decision_contract: repeated-line diagnosis scope does not reconcile")
        if diagnosis.get("canonicalDecisionId") != (primary or {}).get("decisionId"):
            raise ValueError("decision_contract: diagnosis belongs to another decision")
        if diagnosis.get("opening") != (primary or {}).get("opening") or diagnosis.get("repertoireRole") != (primary or {}).get("repertoireRole"):
            raise ValueError("decision_contract: diagnosis opening or role differs from primary action")
        if diagnosis.get("precisionLevel") == "exact_position" and (
            len(diagnosis_ids) < 2
            or not diagnosis.get("positionFen")
            or diagnosis.get("playerToMove") != (primary or {}).get("playerColour")
        ):
            raise ValueError("decision_contract: exact diagnosis is not a repeated player-turn position")
        if diagnosis.get("engineAnalysisUsed") or diagnosis.get("objectiveMoveClaimed"):
            raise ValueError("decision_contract: deterministic diagnosis claims unsupported engine authority")
        if priority and (
            priority.get("diagnosisId") != diagnosis.get("diagnosisId")
            or priority.get("openingDiagnosis") != diagnosis
            or priority.get("positionFen") != diagnosis.get("positionFen")
        ):
            raise ValueError("decision_contract: training priority differs from opening diagnosis")
    if decision.get("repair") and decision["repair"].get("verdict") != "repair":
        raise ValueError("decision_contract: repair slot is not a repair verdict")
    if decision.get("keep") and decision["keep"].get("verdict") != "keep":
        raise ValueError("decision_contract: keep slot is not a keep verdict")
    health = decision.get("repertoireHealth") or decision.get("repertoireCoverageScore")
    if isinstance(health, Mapping):
        available = [row for row in health.get("components", []) if isinstance(row, Mapping) and row.get("available")]
        health_claims: dict[tuple[str, str], str] = {}
        for row in [item for item in health.get("components", []) if isinstance(item, Mapping)]:
            ids = [str(value) for value in row.get("supportingGameIds") or []]
            if len(ids) != len(set(ids)) or int(_number(row.get("supportingGameCount")) or 0) != len(ids):
                raise ValueError("decision_contract: health component evidence count does not reconcile")
            if not all(row.get(key) is not None for key in ("componentId", "targetCanonicalContextId", "context", "metric", "direction", "explanationReasonCode", "destinationActionId")):
                raise ValueError("decision_contract: health component lacks structured evidence")
            claim_key = (str(row.get("targetCanonicalContextId")), str(row.get("metric")))
            prior_direction = health_claims.get(claim_key)
            direction = str(row.get("direction"))
            if prior_direction and prior_direction != direction and "neutral" not in {prior_direction, direction}:
                raise ValueError("decision_contract: one health metric both helps and drags the same context")
            health_claims[claim_key] = direction
        effective_total = sum(float(_number(row.get("effectiveWeight")) or 0) for row in available)
        reproduced = sum(float(_number(row.get("contribution")) or 0) for row in available)
        if available and abs(effective_total - 100) > 0.00001:
            raise ValueError("decision_contract: Repertoire Health effective weights do not reconcile")
        if _number(health.get("score")) is not None and abs(reproduced - float(health["score"])) > 0.00001:
            raise ValueError("decision_contract: Repertoire Health score is not reproducible")


def _decision_slot(candidate: Optional[Mapping[str, Any]], verdict: str) -> Optional[dict[str, Any]]:
    if not candidate:
        return None
    sample = candidate.get("sample") if isinstance(candidate.get("sample"), Mapping) else {}
    action = candidate.get("trainingAction") if isinstance(candidate.get("trainingAction"), Mapping) else {}
    issue = candidate.get("issue") if isinstance(candidate.get("issue"), Mapping) else None
    completion = action.get("completionTarget") if isinstance(action.get("completionTarget"), Mapping) else {}
    return {
        "recommendationId": candidate.get("recommendationId"),
        "opening": candidate.get("openingName"),
        "openingName": candidate.get("openingName"),
        "canonicalOpeningId": candidate.get("openingId"),
        "repertoireRole": candidate.get("repertoireRole"),
        "playerColour": candidate.get("playerColour"),
        "targetType": "exact_line" if issue else "variation" if candidate.get("variationName") else "opening_family",
        "verdict": verdict,
        "games": int(_number(sample.get("games")) or 0),
        "wins": int(_number(sample.get("wins")) or 0),
        "draws": int(_number(sample.get("draws")) or 0),
        "losses": int(_number(sample.get("losses")) or 0),
        "scoreRate": _number(sample.get("scoreRate")),
        "relevantBaseline": candidate.get("relevantBaseline"),
        "baselineDifference": candidate.get("baselineDifference"),
        "confidenceLevel": candidate.get("confidenceLevel"),
        "confidenceReason": str((candidate.get("confidence") or {}).get("reason") or ""),
        "evidenceGameIds": list(sample.get("gameIds") or []),
        "conciseReason": str(action.get("explanation") or ""),
        "nextAction": str(action.get("exercise") or ""),
        "trainingDuration": {"minutes": 10},
        "successCheck": str(completion.get("label") or "Complete the task and record one practical takeaway."),
        "source": "canonical_played_game_evidence",
        "fallback": False,
    }


def build_report_decision(
    report: Mapping[str, Any],
    *,
    openings: Iterable[Mapping[str, Any]],
    previous_report: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    recommendations = _attach_evidence_backed_alternatives(_attach_relevant_baselines([
        _canonical_recommendation(report, item) for item in openings if _name(item)
    ]))
    owned = [item for item in recommendations if item["repertoireOwned"] and item["validation"]["valid"]]
    strengths = [item for item in owned if item["verdict"] == "keep"]
    problems = [item for item in owned if item["verdict"] == "repair"]
    mixed_signals = [item for item in owned if item["verdict"] == "explore" and item["evidenceStatus"] == "sufficient"]
    strength = sorted(
        strengths,
        key=lambda item: (-item["priority"], -item["sample"]["games"], -item["sample"]["scoreRate"], item["openingName"].lower(), item["role"]),
    )[0] if strengths else None
    problem = sorted(
        problems,
        key=_repair_order,
    )[0] if problems else None
    mixed = sorted(
        mixed_signals,
        key=lambda item: (-item["priority"], -item["sample"]["games"], item["openingName"].lower(), item["role"]),
    )[0] if mixed_signals else None

    repertoire_roles = build_repertoire_roles(recommendations, report)
    experiments = _style_experiments(report)
    role_accounting = report.get("roleEvidenceAccounting") or report.get("role_evidence_accounting") or {}
    attribution_invalid = isinstance(role_accounting, Mapping) and role_accounting.get("valid") is False
    if attribution_invalid:
        strength = problem = mixed = None
        recommendations = []
        experiments = []
        repertoire_roles = [{
            **role,
            "status": "unresolved",
            "dataQuality": "role_attribution_failure",
            "currentOpening": None,
            "openingName": None,
            "confidenceReasonCode": "systemic_role_attribution_failure",
            "confidenceExplanation": "Role attribution failed systemically; reanalyse before using repertoire conclusions.",
        } for role in repertoire_roles]
    missing_role = next((
        role for role in repertoire_roles
        if role.get("status") in {"insufficient", "unresolved"} and not role.get("currentOpening")
    ), None)
    building_roles = [role for role in repertoire_roles if role.get("status") != "established"]

    if attribution_invalid:
        action = {
            "type": "reanalyse_role_attribution", "opening": None, "role": None,
            "repertoireRole": RepertoireRole.UNRESOLVED.value, "findingType": "processing_failure",
            "label": "Reanalyse to repair role attribution",
            "reason": "We imported your games but couldn’t reliably assign them to repertoire roles. Reanalyse to repair this report.",
            "recommendationId": None, "sample": None,
            "title": "Reanalyse to repair this report",
            "explanation": "OpeningFit retained a diagnostic reference and will not manufacture weaknesses or recommendations from invalid role evidence.",
            "concept": "Repair the report processing contract before using repertoire conclusions.",
            "exercise": "Run the analysis again.",
            "completionTarget": {"type": "reanalyse", "count": 1, "label": "Complete one successful reanalysis."},
        }
    elif problem:
        training = problem["trainingAction"]
        action = {
            "type": "repair_repertoire", "opening": problem["openingName"], "role": problem["role"],
            "repertoireRole": problem["repertoireRole"], "findingType": problem["findingType"],
            "label": training["title"], "reason": training["explanation"],
            "recommendationId": problem["recommendationId"], "sample": problem["sample"],
            **training,
        }
    elif missing_role:
        role_label = str(missing_role.get("label") or missing_role.get("repertoireRole") or "this repertoire role")
        action = {
            "type": "fill_repertoire_gap", "opening": None, "role": missing_role.get("role"),
            "repertoireRole": missing_role.get("repertoireRole"), "findingType": "repertoire_gap",
            "label": f"Establish a {role_label} choice",
            "reason": f"No correctly attributed opening is established for {role_label}; this is a repertoire gap, not a diagnosed weakness.",
            "recommendationId": None, "sample": {"games": 0, "wins": 0, "draws": 0, "losses": 0, "scoreRate": None, "gameIds": []},
            "title": f"Establish a {role_label} choice",
            "explanation": f"Choose one setup for {role_label}, keep it stable, and collect five correctly attributed games before judging it.",
            "concept": "Build usable role coverage before comparing opening performance.",
            "exercise": f"Review one general setup for {role_label} for approximately 10 minutes.",
            "completionTarget": {"type": "new_games", "count": 5, "label": "Play five correctly attributed games in this exact role."},
        }
    elif building_roles:
        role = sorted(building_roles, key=lambda row: (int(_number(row.get("supportingGameCount")) or 0), str(row.get("repertoireRole") or "")))[0]
        remaining = max(1, int(_number((role.get("evidenceRequirement") or {}).get("additionalRelevantGamesRequired")) or MIN_OPENING_EVIDENCE))
        action = {
            "type": "collect_more_games", "opening": role.get("currentOpening"), "role": role.get("role"),
            "repertoireRole": role.get("repertoireRole"), "findingType": "insufficient_evidence",
            "label": "Collect more games before changing your repertoire",
            "reason": str(role.get("confidenceExplanation") or "No opening has enough correctly attributed evidence for a firm repair decision."),
            "recommendationId": None, "sample": {"games": int(_number(role.get("supportingGameCount")) or 0), "gameIds": list(role.get("evidenceGameIds") or [])},
            "title": "Collect more games before changing your repertoire",
            "explanation": f"Keep the current choice stable and play {remaining} more relevant game{'s' if remaining != 1 else ''} in this exact role.",
            "concept": "A larger role-specific sample is needed before choosing a repair target.",
            "exercise": f"Play {remaining} relevant game{'s' if remaining != 1 else ''} without switching the opening.",
            "completionTarget": {"type": "new_games", "count": remaining, "label": f"Add {remaining} relevant game{'s' if remaining != 1 else ''} before reassessing."},
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
    elif experiments:
        experiment = experiments[0]
        action = {
            "type": "experiment", "opening": experiment["openingName"], "role": None,
            "repertoireRole": experiment["repertoireRole"], "findingType": "preparation_opportunity",
            "label": f"Try {experiment['openingName']} as an experiment", "reason": experiment["conciseReason"],
            "recommendationId": experiment["recommendationId"],
            "sample": {"games": 0, "wins": 0, "draws": 0, "losses": 0, "scoreRate": None, "gameIds": []},
            "title": f"Try {experiment['openingName']} as an experiment", "explanation": experiment["conciseReason"],
            "concept": "Test a style/repertoire-fit idea without treating it as proven.", "exercise": experiment["nextAction"],
            "completionTarget": {"type": "setup_rehearsal", "count": 1, "label": experiment["successCheck"]},
        }
    else:
        action = {
            "type": "collect_more_games", "opening": None, "role": None,
            "repertoireRole": RepertoireRole.UNRESOLVED.value, "findingType": "insufficient_evidence",
            "label": "Collect more games before changing your repertoire",
            "reason": "No single opening currently has enough evidence to qualify as an authoritative repair target. Keep your current repertoire and check again after more games.",
            "recommendationId": None, "sample": None,
            "title": "Collect more games before changing your repertoire",
            "explanation": "Keep the current repertoire stable, play five more eligible games, then run the report again.",
            "concept": "A larger opening-specific sample is needed before choosing a repair target.",
            "exercise": "Play five eligible games without changing openings.",
            "completionTarget": {"type": "new_games", "count": 5, "label": "Add five eligible games before reassessing."},
        }

    source_report_id = str(
        report.get("analysisId") or report.get("analysis_id") or report.get("reportId") or report.get("report_id")
        or f"report-{hashlib.sha256('|'.join(str(report.get(key) or '') for key in ('platform', 'username', 'importedAt', 'lastUpdated')).encode()).hexdigest()[:16]}"
    )
    selected = next((row for row in recommendations if row.get("recommendationId") == action.get("recommendationId")), None)
    selected_experiment = next((row for row in experiments if row.get("recommendationId") == action.get("recommendationId")), None)
    sample = action.get("sample") if isinstance(action.get("sample"), Mapping) else {}
    completion = action.get("completionTarget") if isinstance(action.get("completionTarget"), Mapping) else {}
    confidence = selected.get("confidence") if isinstance(selected, Mapping) else {}
    action_id = f"decision:{source_report_id}:{action.get('recommendationId') or action.get('type')}"
    action.update({
        "decisionId": action_id, "actionId": action_id,
        "canonicalOpeningId": (selected or selected_experiment or {}).get("openingId"),
        "playerColour": (selected or selected_experiment or {}).get("playerColour"),
        "relationship": (selected or selected_experiment or {}).get("relationship"),
        "targetType": (
            "repertoire_gap" if action.get("type") == "fill_repertoire_gap"
            else "exact_line" if action.get("lineOrPosition")
            else "variation" if action.get("variationName")
            else "opening_family" if action.get("opening")
            else "repertoire_gap"
        ),
        "verdict": (
            "repair" if action.get("type") == "repair_repertoire"
            else "keep" if action.get("type") == "consolidate_strength"
            else "experiment" if action.get("type") == "experiment"
            else "collect_more_data"
        ),
        "games": int(_number(sample.get("games")) or 0),
        "wins": int(_number(sample.get("wins")) or 0),
        "draws": int(_number(sample.get("draws")) or 0),
        "losses": int(_number(sample.get("losses")) or 0),
        "scoreRate": _number(sample.get("scoreRate")),
        "relevantBaseline": (selected or {}).get("relevantBaseline"),
        "baselineDifference": (selected or {}).get("baselineDifference"),
        "confidenceLevel": str((selected or selected_experiment or {}).get("confidenceLevel") or confidence.get("level") or "insufficient"),
        "confidenceReason": str((selected or selected_experiment or {}).get("confidenceReason") or confidence.get("reason") or action.get("reason") or ""),
        "evidenceGameIds": list(sample.get("gameIds") or []),
        "conciseReason": str(action.get("reason") or action.get("explanation") or ""),
        "nextAction": str(action.get("exercise") or action.get("explanation") or ""),
        "trainingDuration": {"minutes": 10},
        "successCheck": str(completion.get("label") or "Complete the task and record one practical takeaway."),
        "source": "canonical_report_decision",
        "fallback": action.get("type") not in {"repair_repertoire", "consolidate_strength"},
    })

    total_games = int(_number(report.get("gamesAnalysed") or report.get("gamesImported") or report.get("total_games")) or 0)
    comparable = reports_are_comparable(report, previous_report)
    coverage = _report_coverage(total_games)
    training_priority = _training_priority(action, recommendations, report)
    opening_diagnosis = training_priority.get("openingDiagnosis")
    if opening_diagnosis:
        action.update({
            "diagnosisId": opening_diagnosis.get("diagnosisId"),
            "openingDiagnosis": opening_diagnosis,
            "targetType": opening_diagnosis.get("precisionLevel"),
            "nextAction": training_priority.get("nextAction"),
            "successCheck": training_priority.get("successCheck"),
        })
    repertoire_coverage_score = build_repertoire_coverage_score(repertoire_roles, problem)
    repertoire_coverage_score["comparisonEligibility"] = {
        "eligible": comparable,
        "reason": "The previous report uses a compatible player, platform, sample and chronology." if comparable else "No compatible earlier report is available for a direct Repertoire Health comparison.",
    }
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
    if attribution_invalid:
        findings = [{
            "type": "processing_failure", "opening": None, "repertoireRole": "unresolved",
            "playerColour": None, "supportingGameCount": 0,
            "confidenceReasonCode": "systemic_role_attribution_failure", "recommendationId": None,
        }]
    decision = {
        "schemaVersion": 6,
        "version": "report_decision_v6",
        "decisionId": action_id,
        "sourceReportId": source_report_id,
        "generatedAt": report.get("importedAt") or report.get("imported_at") or report.get("lastUpdated") or report.get("last_updated"),
        "evidenceStatus": (
            "sufficient" if action.get("verdict") in {"repair", "keep"}
            else "experimental" if action.get("verdict") == "experiment"
            else "insufficient"
        ),
        "overallSummary": (
            f"Repair {problem['openingName']} first; keep {strength['openingName']} as the stable reference. {(opening_diagnosis or {}).get('userFacingDiagnosis', '')}".strip() if problem and strength
            else f"Repair {problem['openingName']} first. {(opening_diagnosis or {}).get('userFacingDiagnosis', '')}".strip() if problem
            else str(action.get("reason") or action.get("label"))
        ),
        "recommendations": recommendations,
        "findings": findings,
        "keep": _decision_slot(strength, "keep"),
        "repair": ({
            **(_decision_slot(problem, "repair") or {}),
            "diagnosisId": (opening_diagnosis or {}).get("diagnosisId"),
            "openingDiagnosis": opening_diagnosis,
            "targetType": (opening_diagnosis or {}).get("precisionLevel") or "opening_family",
            "nextAction": (opening_diagnosis or {}).get("trainingTask") or str((problem.get("trainingAction") or {}).get("exercise") or ""),
            "successCheck": (opening_diagnosis or {}).get("successCheck") or "Complete the task and record one practical takeaway.",
        } if problem else None),
        "experiment": experiments[0] if experiments else None,
        "establishedStrength": strength,
        "primaryProblem": problem,
        "primaryAction": action,
        "nextTrainingAction": action,
        "trainingPriority": training_priority,
        "openingDiagnosis": opening_diagnosis,
        "opening_diagnosis": opening_diagnosis,
        "rejectedCandidates": [
            {
                "recommendationId": row.get("recommendationId"),
                "opening": row.get("openingName"),
                "repertoireRole": row.get("repertoireRole"),
                "reason": "Not selected because the canonical priority order chose a stronger evidence-backed action.",
            }
            for row in [*recommendations, *experiments]
            if row.get("recommendationId") != action.get("recommendationId")
        ],
        "fallbackUsed": bool(action.get("fallback")),
        "fallbackReason": str(action.get("reason")) if action.get("fallback") else None,
        "roleAttribution": dict(role_accounting) if isinstance(role_accounting, Mapping) else None,
        "repertoireRoles": repertoire_roles,
        "roleDecisions": repertoire_roles,
        "repertoireCoverageScore": repertoire_coverage_score,
        "repertoireHealth": repertoire_coverage_score,
        "repertoire_health": repertoire_coverage_score,
        "supportingEvidence": evidence,
        "reportCoverage": coverage,
        "confidence": {
            "status": "sufficient" if strength or problem or mixed else "insufficient_data",
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
