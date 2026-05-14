from __future__ import annotations

from statistics import median
from typing import Any


def safe_number(value: Any, fallback: Any = None) -> Any:
    try:
        if value is None or value == "":
            return fallback
        number = float(str(value).replace("%", ""))
        if number.is_integer():
            return int(number)
        return number
    except Exception:
        return fallback


def as_list(value: Any) -> list:
    if not value:
        return []

    if isinstance(value, list):
        return value

    if isinstance(value, dict):
        items = []
        for name, stats in value.items():
            if isinstance(stats, dict):
                items.append({"name": name, **stats})
            else:
                items.append({"name": name, "value": stats})
        return items

    return []


def get_opening_name(item: Any) -> str:
    if isinstance(item, str):
        return item

    if not isinstance(item, dict):
        return "Unclassified opening"

    return (
        item.get("name")
        or item.get("opening")
        or item.get("openingName")
        or item.get("opening_name")
        or item.get("ecoName")
        or item.get("eco_name")
        or item.get("displayName")
        or item.get("family")
        or "Unclassified opening"
    )


def is_unknown_opening(name: str) -> bool:
    normalised = str(name or "").strip().lower()

    return (
        not normalised
        or normalised == "opening"
        or normalised == "unknown"
        or normalised == "unknown opening"
        or normalised == "uncommon opening"
        or "unknown" in normalised
        or "unclassified" in normalised
    )


def get_opening_games(item: Any) -> int:
    if not isinstance(item, dict):
        return 0

    return int(
        safe_number(
            item.get("games")
            or item.get("count")
            or item.get("total")
            or item.get("played")
            or item.get("sample"),
            0,
        )
    )


def get_opening_score(item: Any) -> int | None:
    if not isinstance(item, dict):
        return None

    raw = (
        item.get("winRate")
        if item.get("winRate") is not None
        else item.get("win_rate")
        if item.get("win_rate") is not None
        else item.get("score")
        if item.get("score") is not None
        else item.get("scoreRate")
        if item.get("scoreRate") is not None
        else item.get("score_rate")
        if item.get("score_rate") is not None
        else item.get("percentage")
    )

    number = safe_number(raw, None)

    if number is None:
        return None

    if number <= 1:
        return round(number * 100)

    return round(number)


def collect_openings(data: dict, include_unknown: bool = True) -> list[dict]:
    sources = [
        data.get("openings"),
        data.get("openingStats"),
        data.get("opening_stats"),
        data.get("topOpenings"),
        data.get("top_openings"),
        data.get("bestOpenings"),
        data.get("best_openings"),
        data.get("preferredWhite"),
        data.get("preferred_white"),
        data.get("preferredBlack"),
        data.get("preferred_black"),
        data.get("openingWinRates"),
        data.get("opening_win_rates"),
        data.get("recommendations"),
    ]

    merged: dict[str, dict] = {}

    for source in sources:
        for item in as_list(source):
            if not isinstance(item, dict):
                item = {"name": str(item)}

            name = get_opening_name(item)
            unknown = is_unknown_opening(name)

            if unknown and not include_unknown:
                continue

            key = f"unknown-{len(merged)}" if unknown else name.lower()
            games = get_opening_games(item)
            score = get_opening_score(item)

            enriched = {
                **item,
                "name": name,
                "games": games,
                "score": score,
                "is_unknown_opening": unknown,
            }

            if key not in merged:
                merged[key] = enriched
                continue

            if games > get_opening_games(merged[key]):
                merged[key] = {
                    **merged[key],
                    **enriched,
                    "score": score if score is not None else merged[key].get("score"),
                }

    return list(merged.values())


def collect_rating(data: dict) -> int | None:
    values: list[int] = []

    direct_fields = [
        "rating",
        "currentRating",
        "current_rating",
        "rapidRating",
        "rapid_rating",
        "blitzRating",
        "blitz_rating",
        "bulletRating",
        "bullet_rating",
        "chesscomRating",
        "chesscom_rating",
    ]

    for field in direct_fields:
        number = safe_number(data.get(field), None)
        if number and 100 < number < 3500:
            values.append(int(number))

    games = []
    games.extend(as_list(data.get("recent_games")))
    games.extend(as_list(data.get("recentGames")))
    games.extend(as_list(data.get("games")))

    for game in games:
        if not isinstance(game, dict):
            continue

        for field in [
            "white_rating",
            "whiteRating",
            "black_rating",
            "blackRating",
            "player_rating",
            "playerRating",
            "rating",
        ]:
            number = safe_number(game.get(field), None)
            if number and 100 < number < 3500:
                values.append(int(number))

    if not values:
        return None

    return int(median(values))


def get_player_level(data: dict, username: str | None = None) -> dict:
    rating = collect_rating(data)

    name = str(
        username
        or data.get("username")
        or data.get("playerName")
        or data.get("player_name")
        or data.get("requestedUsername")
        or data.get("requested_username")
        or ""
    ).lower()

    likely_elite_name = name in {
        "hikaru",
        "gmhikaru",
        "magnuscarlsen",
        "drnykterstein",
        "nihalsarin",
        "firouzja2003",
    }

    if likely_elite_name and (rating is None or rating >= 2200):
        level = "elite"
    elif rating is None:
        level = "unknown"
    elif rating < 800:
        level = "beginner"
    elif rating < 1200:
        level = "improver"
    elif rating < 1600:
        level = "club"
    elif rating < 2000:
        level = "strong"
    elif rating < 2400:
        level = "advanced"
    else:
        level = "elite"

    profiles = {
        "unknown": {
            "label": "Unknown level",
            "short_label": "Unknown",
            "tone": "balanced",
            "opening_unknown_label": "Unclassified opening",
            "headline": "The player level is unclear, so the report should avoid overclaiming.",
            "recommendation": "Use repeated opening patterns and game volume before giving strong advice.",
            "training_focus": "Import more games to improve confidence.",
            "unknown_explanation": "OpeningFit could not confidently name this opening from the available move order.",
        },
        "beginner": {
            "label": "Beginner",
            "short_label": "Beginner",
            "tone": "simple",
            "opening_unknown_label": "Unclassified / messy setup",
            "headline": "This player needs simple opening habits more than theory.",
            "recommendation": "Recommend one easy White setup and one simple Black defence. Avoid deep lines.",
            "training_focus": "Development, king safety, and reaching familiar positions.",
            "unknown_explanation": "At beginner level, this usually means the game left known opening paths early.",
        },
        "improver": {
            "label": "Improving beginner",
            "short_label": "Improver",
            "tone": "simple",
            "opening_unknown_label": "Unclassified setup",
            "headline": "This player should reduce opening variety and build reliable habits.",
            "recommendation": "Pick one White opening, one Black defence against 1.e4, and one setup against 1.d4.",
            "training_focus": "Repeatable setup, first 6 moves, and avoiding random sidelines.",
            "unknown_explanation": "This normally means the move order left common book lines early.",
        },
        "club": {
            "label": "Club player",
            "short_label": "Club",
            "tone": "coach",
            "opening_unknown_label": "Unclassified opening",
            "headline": "This player can build a practical repertoire from repeated patterns.",
            "recommendation": "Keep the strongest openings, repair one weak line, and study typical middlegame plans.",
            "training_focus": "Common plans, recurring early mistakes, and colour-specific repertoire choices.",
            "unknown_explanation": "This may be a transposition or an opening that the detector could not classify.",
        },
        "strong": {
            "label": "Strong club player",
            "short_label": "Strong club",
            "tone": "refine",
            "opening_unknown_label": "Rare line / transposition",
            "headline": "This player needs refinement, not generic opening advice.",
            "recommendation": "Use colour splits, weak branches, and repeated middlegame structures to refine the repertoire.",
            "training_focus": "Opening branches, time-control trends, and move-order issues.",
            "unknown_explanation": "For stronger players, this often means a transposition, sideline, or incomplete ECO detection.",
        },
        "advanced": {
            "label": "Advanced player",
            "short_label": "Advanced",
            "tone": "audit",
            "opening_unknown_label": "Rare line / transposition",
            "headline": "This player probably already has a repertoire. Audit it instead of replacing it.",
            "recommendation": "Highlight underperforming branches, high-volume openings, and prep gaps.",
            "training_focus": "Repertoire refinement, sideline performance, and recent trend changes.",
            "unknown_explanation": "At advanced level, unclassified openings are more likely to be transpositions, sidelines, or detector limitations.",
        },
        "elite": {
            "label": "Elite / master-level profile",
            "short_label": "Elite",
            "tone": "audit",
            "opening_unknown_label": "Rare line / transposition",
            "headline": "This profile is beyond normal club-player coaching.",
            "recommendation": "Use OpeningFit as a trend, prep, and repertoire audit tool.",
            "training_focus": "Deep trend detection, opponent prep, colour splits, and weak-scoring sidelines.",
            "unknown_explanation": "At elite level, unclassified openings are usually a classification limitation, rare sideline, or transposition — not a beginner-style mistake.",
        },
    }

    return {
        "rating": rating,
        "level": level,
        **profiles[level],
    }


def build_recommendation(data: dict, level_profile: dict, openings: list[dict]) -> dict:
    known = [opening for opening in openings if not opening.get("is_unknown_opening")]

    ranked = sorted(
        known,
        key=lambda item: (
            get_opening_score(item) if get_opening_score(item) is not None else -1,
            get_opening_games(item),
        ),
        reverse=True,
    )

    weakest_candidates = [
        item
        for item in known
        if get_opening_games(item) >= 2 and get_opening_score(item) is not None
    ]

    weakest = sorted(
        weakest_candidates,
        key=lambda item: get_opening_score(item) if get_opening_score(item) is not None else 100,
    )

    best = ranked[0] if ranked else None
    weak = weakest[0] if weakest else None

    best_name = get_opening_name(best) if best else "your strongest repeated opening"
    weak_name = get_opening_name(weak) if weak else "your weakest repeated opening"

    level = level_profile["level"]

    if level == "elite":
        return {
            "type": "elite_audit",
            "title": "Elite-level repertoire audit",
            "summary": "Do not give this player beginner-style opening advice. The useful output is a high-level audit of trends, underperforming branches, and preparation gaps.",
            "primary_action": "Prioritise colour splits, time-control splits, opponent-rating bands, and openings that have changed performance recently.",
            "best_opening": best_name,
            "weak_opening": weak_name,
        }

    if level == "advanced":
        return {
            "type": "advanced_refinement",
            "title": "Advanced repertoire refinement",
            "summary": "This player likely already has opening knowledge. Recommendations should refine what they play, not replace it.",
            "primary_action": f"Use {best_name} as the stable reference point, then investigate {weak_name} for branches or move-order issues.",
            "best_opening": best_name,
            "weak_opening": weak_name,
        }

    if level == "strong":
        return {
            "type": "strong_club_refinement",
            "title": "Strong club-player refinement",
            "summary": "The goal is not just choosing openings — it is improving the branches and structures that appear most often.",
            "primary_action": f"Keep {best_name} as a main weapon and use {weak_name} as the next repair target.",
            "best_opening": best_name,
            "weak_opening": weak_name,
        }

    if level == "club":
        return {
            "type": "club_repertoire",
            "title": "Practical club repertoire",
            "summary": "This player should build around repeated strengths and study typical middlegame plans rather than memorising lots of theory.",
            "primary_action": f"Build around {best_name}, then review the first uncomfortable position in {weak_name}.",
            "best_opening": best_name,
            "weak_opening": weak_name,
        }

    if level in {"beginner", "improver"}:
        return {
            "type": "simplify_repertoire",
            "title": "Simplify the opening choices",
            "summary": "This player will improve faster by playing fewer openings and reaching familiar positions more often.",
            "primary_action": "Choose one White setup, one Black defence against 1.e4, and one simple setup against 1.d4 for the next 20 games.",
            "best_opening": best_name,
            "weak_opening": weak_name,
        }

    return {
        "type": "cautious_read",
        "title": "Cautious recommendation",
        "summary": "The rating level is unclear, so the advice should stay cautious and rely on repeated opening patterns.",
        "primary_action": f"Start with {best_name}, then import more games to improve confidence.",
        "best_opening": best_name,
        "weak_opening": weak_name,
    }


def enrich_analysis_result(payload: Any, username: str | None = None, platform: str | None = None) -> Any:
    if not isinstance(payload, dict):
        return payload

    data = dict(payload)

    level_profile = get_player_level(data, username=username)
    openings = collect_openings(data, include_unknown=True)
    known_openings = [item for item in openings if not item.get("is_unknown_opening")]
    unknown_openings = [item for item in openings if item.get("is_unknown_opening")]

    game_count = (
        safe_number(data.get("gamesImported"), None)
        or safe_number(data.get("games_imported"), None)
        or safe_number(data.get("totalGames"), None)
        or safe_number(data.get("total_games"), None)
        or safe_number(data.get("gameCount"), None)
        or safe_number(data.get("game_count"), None)
        or sum(get_opening_games(item) for item in openings)
    )

    repeat_openings = len([item for item in known_openings if get_opening_games(item) >= 3])

    if game_count < 30:
        confidence = "low"
    elif game_count >= 80 and repeat_openings >= 4:
        confidence = "high"
    else:
        confidence = "medium"

    recommendation = build_recommendation(data, level_profile, openings)

    data["player_level"] = level_profile
    data["opening_classification"] = {
        "known_openings": len(known_openings),
        "unclassified_openings": len(unknown_openings),
        "unclassified_games": sum(get_opening_games(item) for item in unknown_openings),
        "display_label": level_profile["opening_unknown_label"],
        "explanation": level_profile["unknown_explanation"],
    }
    data["data_quality"] = {
        "confidence": confidence,
        "games_checked": game_count,
        "repeat_openings": repeat_openings,
        "known_openings": len(known_openings),
        "rating_detected": level_profile["rating"],
    }
    data["backend_recommendation"] = recommendation
    data["backend_coach_summary"] = level_profile["headline"]
    data["backend_next_action"] = recommendation["primary_action"]

    if username and not data.get("username"):
        data["username"] = username

    if platform and not data.get("platform"):
        data["platform"] = platform

    return data
