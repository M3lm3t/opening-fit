from __future__ import annotations

from typing import Any, Dict, List, Optional

try:
    from analysis.opening_recommendation_catalog import (
        OPENING_RECOMMENDATION_CATALOG,
        OpeningCatalogItem,
    )
except ModuleNotFoundError:  # pragma: no cover - package-style test imports
    from backend.analysis.opening_recommendation_catalog import (
        OPENING_RECOMMENDATION_CATALOG,
        OpeningCatalogItem,
    )


SLOT_DEFINITIONS = {
    "white": {"colour": "white", "against": None},
    "black_vs_e4": {"colour": "black", "against": "1.e4"},
    "black_vs_d4": {"colour": "black", "against": "1.d4"},
}

RISK_SCORE = {"low": 1, "medium": 2, "high": 3}
THEORY_SCORE = {"low": 1, "medium": 2, "high": 3}
DIFFICULTY_SCORE = {"easy": 1, "medium": 2, "hard": 3}


def clamp_score(value: float) -> int:
    return int(round(max(0, min(100, value))))


def normalise_name(name: str) -> str:
    return str(name or "").strip().lower().replace("’", "'")


def score_for_opening_stats(stats: Dict[str, Any]) -> Optional[float]:
    games = int(stats.get("games", 0) or 0)
    if games <= 0:
        return None

    if stats.get("score") is not None:
        score = float(stats.get("score") or 0)
        return score * 100 if score <= 1 else score

    wins = int(stats.get("wins", 0) or 0)
    draws = int(stats.get("draws", 0) or 0)
    return ((wins + 0.5 * draws) / games) * 100


def flatten_current_openings(current_opening_stats: Any) -> Dict[str, Dict[str, Any]]:
    flattened: Dict[str, Dict[str, Any]] = {}

    def add_item(item: Any):
        if not isinstance(item, dict):
            return
        name = str(item.get("name") or item.get("opening") or "").strip()
        if not name:
            return
        key = normalise_name(name)
        existing = flattened.get(key, {"name": name, "games": 0, "wins": 0, "draws": 0, "losses": 0})
        existing["games"] = int(existing.get("games", 0) or 0) + int(item.get("games", 0) or 0)
        existing["wins"] = int(existing.get("wins", 0) or 0) + int(item.get("wins", 0) or 0)
        existing["draws"] = int(existing.get("draws", 0) or 0) + int(item.get("draws", 0) or 0)
        existing["losses"] = int(existing.get("losses", 0) or 0) + int(item.get("losses", 0) or 0)
        existing["context"] = item.get("context") or item.get("repertoireContext") or existing.get("context")
        existing["score"] = score_for_opening_stats(existing)
        flattened[key] = existing

    if isinstance(current_opening_stats, dict):
        for value in current_opening_stats.values():
            if isinstance(value, dict):
                add_item(value)
            elif isinstance(value, list):
                for item in value:
                    add_item(item)
    elif isinstance(current_opening_stats, list):
        for item in current_opening_stats:
            add_item(item)

    return flattened


def catalog_by_name() -> Dict[str, OpeningCatalogItem]:
    return {normalise_name(item["name"]): item for item in OPENING_RECOMMENDATION_CATALOG}


def trait_fit_score(item: OpeningCatalogItem, traits: Dict[str, Any]) -> float:
    weighted_total = 0.0
    weight_total = 0.0

    for trait, weight in item.get("fit_weights", {}).items():
        trait_value = float(traits.get(trait, 50) or 50)

        if weight >= 0:
            weighted_total += trait_value * weight
            weight_total += abs(weight)
        else:
            weighted_total += (100 - trait_value) * abs(weight)
            weight_total += abs(weight)

    return weighted_total / weight_total if weight_total else 50


def rating_penalty(item: OpeningCatalogItem, rating: Optional[int]) -> float:
    if rating is None:
        return 0

    low, high = item.get("recommended_rating_band", [0, 9999])
    if low <= rating <= high:
        return 0
    if rating < low:
        return min(18, (low - rating) / 45)
    return min(10, (rating - high) / 80)


def theory_penalty(item: OpeningCatalogItem, rating: Optional[int], traits: Dict[str, Any]) -> float:
    if item.get("theory_load") != "high" or rating is None:
        return 0

    stability = float(traits.get("opening_phase_stability", 50) or 50)
    if rating < 1100:
        return 16 if stability < 72 else 8
    if rating < 1500:
        return 9 if stability < 72 else 4
    return 0


def successful_tag_boost(
    item: OpeningCatalogItem,
    current_stats: Dict[str, Dict[str, Any]],
    catalog_lookup: Dict[str, OpeningCatalogItem],
) -> float:
    item_tags = set(item.get("style_tags", []))
    boosts = []

    for key, stats in current_stats.items():
        games = int(stats.get("games", 0) or 0)
        if games < 3:
            continue
        score = score_for_opening_stats(stats)
        if score is None or score < 55:
            continue
        played_catalog = catalog_lookup.get(key)
        if not played_catalog:
            continue
        overlap = len(item_tags.intersection(played_catalog.get("style_tags", [])))
        if overlap:
            boosts.append(min(8, overlap * 2 + min(games, 10) * 0.3))

    return min(10, max(boosts or [0]))


def existing_opening_adjustment(item: OpeningCatalogItem, stats: Optional[Dict[str, Any]]) -> float:
    if not stats:
        return 0

    games = int(stats.get("games", 0) or 0)
    if games < 3:
        return 0

    score = score_for_opening_stats(stats)
    if score is None:
        return 0

    if score >= 60:
        return 8
    if score >= 50:
        return 4
    if score < 35 and games >= 5:
        return -12
    if score < 45:
        return -6
    return 0


def learning_cost(item: OpeningCatalogItem) -> str:
    total = THEORY_SCORE.get(item.get("theory_load"), 2) + DIFFICULTY_SCORE.get(item.get("difficulty"), 2)
    if total <= 3:
        return "low"
    if total <= 5:
        return "medium"
    return "high"


def risk_level(item: OpeningCatalogItem) -> str:
    total = RISK_SCORE.get(item.get("tactical_risk"), 2) + RISK_SCORE.get(item.get("strategic_risk"), 2)
    if total <= 3:
        return "low"
    if total <= 5:
        return "medium"
    return "high"


def confidence_for_recommendation(
    style_fingerprint: Dict[str, Any],
    fit_score: int,
    currently_played: bool,
    current_games: int,
) -> str:
    sample_size = int(style_fingerprint.get("sample_size") or style_fingerprint.get("sampleSize") or 0)
    base = str(style_fingerprint.get("confidence") or "low")

    if currently_played and current_games >= 5 and fit_score >= 70:
        return "high"
    if sample_size >= 12 and base in {"medium", "high"} and fit_score >= 72:
        return "high"
    if sample_size >= 3 and fit_score >= 58:
        return "medium"
    return "low"


def upgrade_type(stats: Optional[Dict[str, Any]]) -> str:
    if not stats:
        return "new_recommendation"

    games = int(stats.get("games", 0) or 0)
    score = score_for_opening_stats(stats)
    if games < 3 or score is None:
        return "improve"
    if score >= 55:
        return "keep"
    if score >= 40:
        return "improve"
    return "avoid"


def reason_for_item(item: OpeningCatalogItem, traits: Dict[str, Any], upgrade: str) -> str:
    tags = set(item.get("style_tags", []))
    reasons = []
    if "open" in tags and traits.get("open_position_preference", 50) >= 60:
        reasons.append("open central positions")
    if "tactical" in tags and traits.get("tactical_tendency", 50) >= 60:
        reasons.append("tactical play")
    if "gambit" in tags and traits.get("gambit_comfort", 50) >= 58:
        reasons.append("initiative and gambit comfort")
    if "solid" in tags and traits.get("positional_tendency", 50) >= 55:
        reasons.append("solid structured positions")
    if "closed" in tags and traits.get("closed_position_comfort", 50) >= 55:
        reasons.append("closed-position comfort")
    if "development" in tags and traits.get("development_speed", 50) >= 58:
        reasons.append("fast development")

    if not reasons:
        reasons.append(item.get("typical_position_type", "your current style profile"))

    prefix = {
        "keep": "This already looks like a useful fit:",
        "improve": "This is close to your style but needs cleaner execution:",
        "avoid": "This appears risky for your current results:",
        "new_recommendation": "This is a new candidate because your games point toward",
    }.get(upgrade, "This opening matches")

    if upgrade == "new_recommendation":
        return f"{prefix} {', '.join(reasons[:2])}."
    return f"{prefix} it matches {', '.join(reasons[:2])}."


def watch_out_for_item(item: OpeningCatalogItem, traits: Dict[str, Any]) -> List[str]:
    watch = []
    if item.get("theory_load") == "high":
        watch.append("Theory load is high, so keep the first repertoire version narrow.")
    if item.get("tactical_risk") == "high" and traits.get("king_safety_risk", 50) >= 55:
        watch.append("Your king safety habits need to stay disciplined in this opening.")
    if "gambit" in item.get("style_tags", []):
        watch.append("Do not rely on surprise value only; learn the common decline lines.")
    if item.get("strategic_risk") == "high":
        watch.append("The structures can become strategically demanding if the attack stalls.")
    return watch[:2]


def build_recommendation(
    item: OpeningCatalogItem,
    style_fingerprint: Dict[str, Any],
    current_stats: Dict[str, Dict[str, Any]],
    catalog_lookup: Dict[str, OpeningCatalogItem],
    rating: Optional[int],
) -> Dict[str, Any]:
    traits = style_fingerprint.get("traits") or {}
    key = normalise_name(item["name"])
    stats = current_stats.get(key)
    current_games = int(stats.get("games", 0) or 0) if stats else 0
    currently_played = bool(stats)
    fit = trait_fit_score(item, traits)
    fit -= rating_penalty(item, rating)
    fit -= theory_penalty(item, rating, traits)
    fit += successful_tag_boost(item, current_stats, catalog_lookup)
    fit += existing_opening_adjustment(item, stats)
    fit_score = clamp_score(fit)
    upgrade = upgrade_type(stats)

    return {
        "name": item["name"],
        "fit_score": fit_score,
        "fitScore": fit_score,
        "confidence": confidence_for_recommendation(style_fingerprint, fit_score, currently_played, current_games),
        "reason": reason_for_item(item, traits, upgrade),
        "evidence": list(style_fingerprint.get("evidence") or [])[:3],
        "learning_cost": learning_cost(item),
        "learningCost": learning_cost(item),
        "risk_level": risk_level(item),
        "riskLevel": risk_level(item),
        "whether_user_currently_plays_it": currently_played,
        "currently_played": currently_played,
        "currentlyPlayed": currently_played,
        "upgrade_type": upgrade,
        "upgradeType": upgrade,
        "watch_out": watch_out_for_item(item, traits),
        "watchOut": watch_out_for_item(item, traits),
        "style_tags": list(item.get("style_tags", [])),
        "styleTags": list(item.get("style_tags", [])),
        "typical_position_type": item.get("typical_position_type", ""),
        "typicalPositionType": item.get("typical_position_type", ""),
        "theory_load": item.get("theory_load", "medium"),
        "theoryLoad": item.get("theory_load", "medium"),
    }


def is_gambit(recommendation: Dict[str, Any]) -> bool:
    return "gambit" in {str(tag).lower() for tag in recommendation.get("style_tags", [])}


def is_safe(recommendation: Dict[str, Any]) -> bool:
    return recommendation.get("risk_level") in {"low", "medium"} and recommendation.get("learning_cost") in {"low", "medium"}


def is_ambitious(recommendation: Dict[str, Any]) -> bool:
    return (
        recommendation.get("risk_level") == "high"
        or recommendation.get("learning_cost") == "high"
        or is_gambit(recommendation)
    )


def balanced_top_recommendations(recommendations: List[Dict[str, Any]], limit: int = 4) -> List[Dict[str, Any]]:
    ranked = sorted(recommendations, key=lambda item: item["fit_score"], reverse=True)
    selected = ranked[:limit]

    if ranked and not any(is_safe(item) for item in selected):
        safe = next((item for item in ranked if is_safe(item)), None)
        if safe:
            selected = (selected[: limit - 1] + [safe])[:limit]

    if ranked and not any(is_ambitious(item) for item in selected):
        ambitious = next((item for item in ranked if is_ambitious(item)), None)
        if ambitious:
            selected = (selected[: limit - 1] + [ambitious])[:limit]

    if selected and all(is_gambit(item) for item in selected):
        non_gambit = next((item for item in ranked if not is_gambit(item)), None)
        if non_gambit:
            selected[-1] = non_gambit

    deduped = []
    seen = set()
    for item in sorted(selected, key=lambda rec: rec["fit_score"], reverse=True):
        if item["name"] in seen:
            continue
        seen.add(item["name"])
        deduped.append(item)

    return deduped[:limit]


def catalog_items_for_slot(slot: str) -> List[OpeningCatalogItem]:
    definition = SLOT_DEFINITIONS[slot]
    return [
        item
        for item in OPENING_RECOMMENDATION_CATALOG
        if item["colour"] == definition["colour"]
        and (definition["against"] is None or item["against"] == definition["against"])
    ]


def build_opening_recommendations(
    style_fingerprint: Dict[str, Any],
    current_opening_stats: Any = None,
    player_rating: Optional[int] = None,
    colour_needs: Optional[List[str]] = None,
    existing_openings: Optional[List[str]] = None,
    limit_per_slot: int = 4,
) -> Dict[str, List[Dict[str, Any]]]:
    current_stats = flatten_current_openings(current_opening_stats)

    for name in existing_openings or []:
        key = normalise_name(name)
        current_stats.setdefault(key, {"name": name, "games": 0, "wins": 0, "draws": 0, "losses": 0})

    catalog_lookup = catalog_by_name()
    slots = colour_needs or ["white", "black_vs_e4", "black_vs_d4"]
    output = {"white": [], "black_vs_e4": [], "black_vs_d4": []}

    for slot in output:
        if slot not in slots:
            continue
        recommendations = [
            build_recommendation(item, style_fingerprint, current_stats, catalog_lookup, player_rating)
            for item in catalog_items_for_slot(slot)
        ]
        output[slot] = balanced_top_recommendations(recommendations, limit=limit_per_slot)

    return output


def first_non_gambit(items: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return next((item for item in items if not is_gambit(item)), None)


def first_safe(items: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return next((item for item in items if is_safe(item) and not is_gambit(item)), None)


def first_ambitious(items: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return next((item for item in items if is_ambitious(item)), None)


def build_basic_recommendation_summary(
    recommendations: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    white = sorted(recommendations.get("white") or [], key=lambda item: item.get("fit_score", 0), reverse=True)
    black_e4 = sorted(recommendations.get("black_vs_e4") or [], key=lambda item: item.get("fit_score", 0), reverse=True)
    black_d4 = sorted(recommendations.get("black_vs_d4") or [], key=lambda item: item.get("fit_score", 0), reverse=True)

    safe_white = first_safe(white) or first_non_gambit(white) or (white[0] if white else None)
    ambitious_white = first_ambitious([item for item in white if item != safe_white]) or first_non_gambit(white) or (white[0] if white else None)
    black_vs_e4 = first_non_gambit(black_e4) or (black_e4[0] if black_e4 else None)
    black_vs_d4 = first_non_gambit(black_d4) or (black_d4[0] if black_d4 else None)
    avoid_or_delay = [
        item
        for item in white + black_e4 + black_d4
        if item.get("learning_cost") == "high"
        or item.get("risk_level") == "high"
        or item.get("upgrade_type") == "avoid"
    ]

    selected_names = {
        item.get("name")
        for item in [safe_white, ambitious_white, black_vs_e4, black_vs_d4]
        if item
    }
    avoid_or_delay = [
        item
        for item in avoid_or_delay
        if item.get("name") not in selected_names and not is_gambit(item)
    ][:4]

    return {
        "safe_white": safe_white,
        "safeWhite": safe_white,
        "ambitious_white": ambitious_white,
        "ambitiousWhite": ambitious_white,
        "black_vs_e4": black_vs_e4,
        "blackVsE4": black_vs_e4,
        "black_vs_d4": black_vs_d4,
        "blackVsD4": black_vs_d4,
        "delay_or_avoid": avoid_or_delay,
        "delayOrAvoid": avoid_or_delay,
        "method": "catalog_recommendation_summary_v1",
    }
