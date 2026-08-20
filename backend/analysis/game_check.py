"""Conservative Game Check comparison over already-canonical report evidence."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Mapping, Optional

OUTCOME_TYPES = {
    "priority_recurred", "response_plan_followed", "response_plan_not_followed",
    "execution_improved", "execution_regressed", "confidence_increased",
    "repertoire_stable", "new_supported_priority", "not_encountered_again",
    "insufficient_comparable_evidence", "no_meaningful_change",
}

def _text(value: Any) -> str:
    return str(value or "").strip()

def stable_game_id(game: Mapping[str, Any]) -> str:
    return _text(game.get("id") or game.get("uuid") or game.get("game_id") or game.get("gameId") or game.get("url") or game.get("archive"))

def genuinely_new_games(games: Iterable[Mapping[str, Any]], checked_ids: Iterable[str], limit: Optional[int] = None) -> List[Dict[str, Any]]:
    checked = {_text(value) for value in checked_ids if _text(value)}
    unique: Dict[str, Dict[str, Any]] = {}
    for game in games or []:
        identity = stable_game_id(game)
        if identity and identity not in checked and identity not in unique:
            unique[identity] = dict(game)
    rows = list(unique.values())
    return rows[: max(0, int(limit))] if limit is not None else rows

def _outcome(kind: str, wording: str, games: List[Mapping[str, Any]], *, role: str = "", opening_id: str = "", diagnosis_id: str = "", comparable: bool = True) -> Dict[str, Any]:
    assert kind in OUTCOME_TYPES
    return {"type": kind, "wording": wording, "role": role or None, "openingId": opening_id or None, "diagnosisId": diagnosis_id or None, "relevantGameCount": len(games), "evidenceReferences": [stable_game_id(game) for game in games if stable_game_id(game)], "comparisonEligible": bool(comparable), "causalClaim": False}

def build_game_check_change_set(*, games: Iterable[Mapping[str, Any]], checked_ids: Iterable[str] = (), priority: Optional[Mapping[str, Any]] = None, response_plan: Optional[Mapping[str, Any]] = None, comparable: bool = False, import_limit: Optional[int] = None) -> Dict[str, Any]:
    new_games = genuinely_new_games(games, checked_ids, import_limit)
    ids = [stable_game_id(game) for game in new_games]
    if not new_games:
        return {"status": "no_new_games", "newGameCount": 0, "checkedGameIds": [], "lead": "No genuinely new games were found.", "outcomes": [], "nextAction": {"type": "continue_playing", "label": "Keep playing"}}

    outcomes: List[Dict[str, Any]] = []
    priority = priority or {}
    role = _text(priority.get("repertoireRole") or priority.get("repertoire_role"))
    opening_id = _text(priority.get("openingId") or priority.get("opening_id"))
    diagnosis_id = _text(priority.get("diagnosisId") or priority.get("diagnosis_id"))
    matching = [game for game in new_games if diagnosis_id and _text(game.get("diagnosisId") or game.get("diagnosis_id")) == diagnosis_id and (not role or _text(game.get("repertoireRole") or game.get("repertoire_role")) == role) and (not opening_id or _text(game.get("openingId") or game.get("opening_id") or game.get("canonicalOpeningId")) == opening_id)]
    if matching:
        outcomes.append(_outcome("priority_recurred", f"Your current opening priority appeared again in {len(matching)} of {len(new_games)} new games.", matching, role=role, opening_id=opening_id, diagnosis_id=diagnosis_id))
    elif diagnosis_id:
        outcomes.append(_outcome("not_encountered_again", "The trained position did not occur, so no improvement claim can be made.", [], role=role, opening_id=opening_id, diagnosis_id=diagnosis_id))

    plan = response_plan or {}
    plan_role = _text(plan.get("repertoireRole") or plan.get("repertoire_role"))
    plan_opening = _text(plan.get("openingId") or plan.get("opening_id"))
    plan_diagnosis = _text(plan.get("diagnosisId") or plan.get("diagnosis_id"))
    plan_games = [game for game in new_games if (not plan_role or _text(game.get("repertoireRole") or game.get("repertoire_role")) == plan_role) and (not plan_opening or _text(game.get("openingId") or game.get("opening_id") or game.get("canonicalOpeningId")) == plan_opening)] if (plan_role or plan_opening) else []
    followed = [game for game in plan_games if game.get("responsePlanFollowed") is True or game.get("response_plan_followed") is True]
    not_followed = [game for game in plan_games if game.get("responsePlanFollowed") is False or game.get("response_plan_followed") is False]
    if followed: outcomes.append(_outcome("response_plan_followed", f"You followed your saved response plan in {len(followed)} recoverable game{'s' if len(followed) != 1 else ''}.", followed, role=plan_role, opening_id=plan_opening, diagnosis_id=plan_diagnosis))
    if not_followed: outcomes.append(_outcome("response_plan_not_followed", f"Your saved response plan was not followed in {len(not_followed)} recoverable game{'s' if len(not_followed) != 1 else ''}.", not_followed, role=plan_role, opening_id=plan_opening, diagnosis_id=plan_diagnosis))

    if comparable:
        improved = [game for game in new_games if _text(game.get("trainingOutcome") or game.get("training_outcome")) == "improved"]
        regressed = [game for game in new_games if _text(game.get("trainingOutcome") or game.get("training_outcome")) == "regressed"]
        confidence = [game for game in new_games if game.get("confidenceIncreased") is True or game.get("confidence_increased") is True]
        stable = [game for game in new_games if game.get("repertoireStable") is True or game.get("repertoire_stable") is True]
        if improved: outcomes.append(_outcome("execution_improved", f"Execution improved in {len(improved)} comparable new game{'s' if len(improved) != 1 else ''}; this does not prove the training caused it.", improved))
        if regressed: outcomes.append(_outcome("execution_regressed", f"Execution regressed in {len(regressed)} comparable new game{'s' if len(regressed) != 1 else ''}; this is an observation, not a causal claim.", regressed))
        if confidence: outcomes.append(_outcome("confidence_increased", f"{len(confidence)} new game{'s' if len(confidence) != 1 else ''} increased the evidence confidence for an existing conclusion.", confidence))
        if stable: outcomes.append(_outcome("repertoire_stable", "Your repertoire remained stable; no repertoire change is recommended.", stable))
        if priority.get("isNewSupportedPriority") is True or priority.get("is_new_supported_priority") is True:
            outcomes.append(_outcome("new_supported_priority", "The new evidence supports a different current priority.", matching or new_games, role=role, opening_id=opening_id, diagnosis_id=diagnosis_id))

    if not comparable:
        outcomes.append(_outcome("insufficient_comparable_evidence", "The new games were checked, but the reports are not comparable enough to claim improvement or regression.", new_games, comparable=False))
    elif not matching and not followed and not not_followed:
        outcomes.append(_outcome("no_meaningful_change", "No supported repertoire or training change was found in these new games.", new_games))

    important = outcomes[:3]
    lead = important[0]["wording"] if important else f"{len(new_games)} genuinely new games were checked."
    return {"status": "complete", "newGameCount": len(new_games), "checkedGameIds": ids, "lead": lead, "outcomes": important, "nextAction": {"type": "review_evidence" if matching or followed or not_followed else "continue_playing", "label": "Review evidence" if matching or followed or not_followed else "Keep playing"}}
