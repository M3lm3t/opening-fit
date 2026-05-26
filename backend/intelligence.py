from __future__ import annotations

from statistics import median
import json
import urllib.error
import urllib.request
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


def get_opening_colour(item: Any) -> str:
    if not isinstance(item, dict):
        return "mixed"

    colour = (
        item.get("colour")
        or item.get("color")
        or item.get("side")
        or item.get("player_colour")
        or item.get("playerColor")
        or "mixed"
    )

    colour = str(colour or "mixed").strip().lower()

    if colour in {"white", "black"}:
        return colour

    return "mixed"


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

            key = "unclassified-opening-bucket" if unknown else name.lower()
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


def opening_sample_evidence(
    item: dict,
    total_games: int,
    average_score: int | None,
    level_profile: dict,
) -> dict:
    games = get_opening_games(item)
    score = get_opening_score(item)
    colour = get_opening_colour(item)
    sample_percent = round((games / total_games) * 100, 1) if total_games else 0
    rating = level_profile.get("rating")
    level = level_profile.get("level", "unknown")
    original_verdict = str(
        item.get("verdict")
        or item.get("fitVerdict")
        or item.get("fit_verdict")
        or item.get("recommendation")
        or item.get("status")
        or ""
    ).strip()
    advanced_levels = {"advanced", "expert", "master", "elite", "strong"}
    master_levels = {"master", "elite"}

    def level_tone_reason() -> str:
        if level in master_levels:
            return (
                "At this level, this is likely about move-order precision, "
                "opponent preparation, or a recent trend in one branch, not basic understanding."
            )
        if level in advanced_levels:
            return (
                "This may be a practical review area. Your results suggest this line "
                "deserves targeted analysis before making a repertoire decision."
            )
        if level in {"intermediate", "club"}:
            return "This is a study-plan target: review the first uncomfortable position and build one clear plan."
        return "Keep the advice simple and practical: focus on development, king safety, and familiar positions."

    def avoid_allowed() -> bool:
        if score is None:
            return False
        if level in master_levels:
            return games >= 30 and score <= 20
        if level == "expert":
            return games >= 24 and score <= 24
        if level in {"advanced", "strong"}:
            return games >= 20 and score <= 28
        if level in {"intermediate", "club"}:
            return games >= 12 and score <= 30
        if level in {"developing", "improver"}:
            return games >= 10 and score <= 32
        return games >= 8 and score <= 35

    def review_verdict() -> str:
        if level in master_levels:
            return "Targeted review"
        if level in advanced_levels:
            return "Practical review"
        if level in {"intermediate", "club"}:
            return "Improve"
        return "Review"

    if games <= 2:
        confidence_label = "Too little data"
        verdict = "Too little data"
        reason = "This opening appears only once or twice, so the result is too noisy to judge."
    elif games <= 4:
        confidence_label = "Low confidence"
        verdict = "Emerging pattern"
        reason = "A small pattern is forming, but a few games can still swing the result heavily."
    elif games <= 7:
        confidence_label = "Low confidence"
        verdict = "Needs more games before judging"
        reason = "There are enough games to track, but not enough for a strong Keep, Improve, or Avoid verdict."
    else:
        sample_points = 0

        if games >= 20:
            sample_points += 2
        elif games >= 10:
            sample_points += 1

        if sample_percent >= 12:
            sample_points += 2
        elif sample_percent >= 6:
            sample_points += 1

        if colour in {"white", "black"}:
            sample_points += 1

        if rating:
            sample_points += 1

        if level in advanced_levels and games < 12:
            sample_points -= 1

        if games < 10 and sample_percent < 10:
            sample_points -= 1

        if sample_points >= 5:
            confidence_label = "High confidence"
        elif sample_points >= 3:
            confidence_label = "Medium confidence"
        else:
            confidence_label = "Low confidence"

        if score is None:
            verdict = original_verdict or "Needs more games before judging"
        elif score >= 58:
            verdict = "Keep"
        elif score >= 42:
            verdict = "Improve"
        elif avoid_allowed():
            verdict = "Avoid"
        else:
            verdict = review_verdict()

        if confidence_label == "Low confidence" and verdict in {"Keep", "Improve", "Avoid"}:
            verdict = "Needs more games before judging"

        if score is not None and score < 42 and level in advanced_levels:
            reason = level_tone_reason()
        elif confidence_label == "High confidence":
            reason = "This opening has repeated across a meaningful share of the import, so the verdict is more reliable."
        elif confidence_label == "Medium confidence":
            reason = "This opening repeats enough to inform a cautious recommendation, but more games would improve certainty."
        else:
            reason = "The sample is still modest for this import, so treat the verdict as provisional."

    comparison = None
    comparison_text = "No average comparison available yet."

    if score is not None and average_score is not None:
        comparison = round(score - average_score, 1)
        if comparison > 0:
            comparison_text = f"{comparison:g} points above your imported-game average."
        elif comparison < 0:
            comparison_text = f"{abs(comparison):g} points below your imported-game average."
        else:
            comparison_text = "Matches your imported-game average."

    return {
        "confidence_label": confidence_label,
        "confidenceLabel": confidence_label,
        "sample_percent": sample_percent,
        "samplePercent": sample_percent,
        "verdict": verdict,
        "fitVerdict": verdict,
        "verdict_reason": reason,
        "verdictReason": reason,
        "confidence_reason": reason,
        "confidenceReason": reason,
        "average_score": average_score,
        "averageScore": average_score,
        "comparison_to_average": comparison,
        "comparisonToAverage": comparison,
        "comparison_text": comparison_text,
        "comparisonText": comparison_text,
        "colour": colour,
        "color": colour,
    }


def enrich_opening_item(
    item: Any,
    total_games: int,
    average_score: int | None,
    level_profile: dict,
) -> Any:
    if not isinstance(item, dict):
        return item

    return {
        **item,
        **opening_sample_evidence(item, total_games, average_score, level_profile),
    }


def enrich_opening_collection(
    collection: Any,
    total_games: int,
    average_score: int | None,
    level_profile: dict,
) -> Any:
    if isinstance(collection, list):
        return [
            enrich_opening_item(item, total_games, average_score, level_profile)
            for item in collection
        ]

    if isinstance(collection, dict):
        return {
            key: enrich_opening_item(value, total_games, average_score, level_profile)
            for key, value in collection.items()
        }

    return collection


def extract_rating_from_object(obj: Any, username: str | None = None) -> list[int]:
    values: list[int] = []

    if isinstance(obj, dict):
        direct_rating_keys = {
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
            "white_rating",
            "whiteRating",
            "black_rating",
            "blackRating",
            "player_rating",
            "playerRating",
            "elo",
            "whiteElo",
            "white_elo",
            "blackElo",
            "black_elo",
        }

        for key, value in obj.items():
            if key in direct_rating_keys:
                number = safe_number(value, None)
                if number and 100 < number < 3500:
                    values.append(int(number))

        # Chess.com-style nested players:
        # {"white": {"username": "...", "rating": 1234}, "black": {...}}
        if username:
            user_lower = username.lower()

            for side in ["white", "black", "player"]:
                side_obj = obj.get(side)

                if isinstance(side_obj, dict):
                    side_name = str(
                        side_obj.get("username")
                        or side_obj.get("name")
                        or side_obj.get("player")
                        or ""
                    ).lower()

                    if side_name == user_lower:
                        number = safe_number(side_obj.get("rating"), None)
                        if number and 100 < number < 3500:
                            values.append(int(number))

        for value in obj.values():
            values.extend(extract_rating_from_object(value, username=username))

    elif isinstance(obj, list):
        for item in obj:
            values.extend(extract_rating_from_object(item, username=username))

    return values


def collect_rating(data: dict, username: str | None = None) -> int | None:
    values = extract_rating_from_object(data, username=username)

    if not values:
        return None

    # Remove obvious duplicates/noise, then use median so one odd game does not skew it.
    values = sorted(set(values))

    return int(median(values))



def fetch_chesscom_current_rating(username: str | None) -> int | None:
    if not username:
        return None

    safe_username = str(username).strip().lower()

    if not safe_username:
        return None

    url = f"https://api.chess.com/pub/player/{safe_username}/stats"

    try:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "OpeningFit/0.1 contact: openingfit.com",
                "Accept": "application/json",
            },
        )

        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

    # Prefer the most useful live ratings for opening advice.
    preferred_modes = [
        "chess_rapid",
        "chess_blitz",
        "chess_bullet",
        "chess_daily",
    ]

    ratings: list[int] = []

    for mode in preferred_modes:
        current = payload.get(mode, {}).get("last", {})
        rating = safe_number(current.get("rating"), None)

        if rating and 100 < rating < 3500:
            ratings.append(int(rating))

    if not ratings:
        return None

    # Rapid is best for opening advice, but if missing use the first valid mode.
    return ratings[0]


def get_player_level(data: dict, username: str | None = None) -> dict:
    rating = collect_rating(data, username=username)

    if rating is None and username:
        rating = fetch_chesscom_current_rating(username)

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
        level = "master"
    elif rating is None:
        level = "unknown"
    elif rating < 900:
        level = "beginner"
    elif rating < 1400:
        level = "developing"
    elif rating < 1800:
        level = "intermediate"
    elif rating < 2200:
        level = "advanced"
    elif rating < 2400:
        level = "expert"
    else:
        level = "master"

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
        "developing": {
            "label": "Developing",
            "short_label": "Developing",
            "tone": "simple",
            "opening_unknown_label": "Unclassified setup",
            "headline": "This player should reduce opening variety and build reliable habits.",
            "recommendation": "Pick one White opening, one Black defence against 1.e4, and one setup against 1.d4.",
            "training_focus": "Repeatable setup, first 6 moves, and avoiding random sidelines.",
            "unknown_explanation": "This normally means the move order left common book lines early.",
        },
        "intermediate": {
            "label": "Intermediate",
            "short_label": "Intermediate",
            "tone": "coach",
            "opening_unknown_label": "Unclassified opening",
            "headline": "This player can build a practical repertoire from repeated patterns.",
            "recommendation": "Keep the strongest openings, repair one weak line, and study typical middlegame plans.",
            "training_focus": "Common plans, recurring early mistakes, and colour-specific repertoire choices.",
            "unknown_explanation": "This may be a transposition or an opening that the detector could not classify.",
        },
        "advanced": {
            "label": "Advanced",
            "short_label": "Advanced",
            "tone": "refine",
            "opening_unknown_label": "Rare line / transposition",
            "headline": "This player needs repertoire refinement, not generic opening advice.",
            "recommendation": "Use colour splits, weak branches, and repeated middlegame structures to refine the repertoire.",
            "training_focus": "Opening branches, time-control trends, and move-order issues.",
            "unknown_explanation": "For stronger players, this often means a transposition, sideline, or incomplete ECO detection.",
        },
        "expert": {
            "label": "Expert",
            "short_label": "Expert",
            "tone": "audit",
            "opening_unknown_label": "Rare line / transposition",
            "headline": "This player probably already has a repertoire. Audit it instead of replacing it.",
            "recommendation": "Highlight underperforming branches, high-volume openings, and prep gaps.",
            "training_focus": "Repertoire refinement, sideline performance, and recent trend changes.",
            "unknown_explanation": "At advanced level, unclassified openings are more likely to be transpositions, sidelines, or detector limitations.",
        },
        "master": {
            "label": "Master",
            "short_label": "Master",
            "tone": "audit",
            "opening_unknown_label": "Rare line / transposition",
            "headline": "This is a master-level profile. Treat the report as a repertoire audit, not basic coaching.",
            "recommendation": "Use OpeningFit as a trend, prep, precision, and repertoire audit tool.",
            "training_focus": "Deep trend detection, opponent prep, colour splits, and weak-scoring sidelines.",
            "unknown_explanation": "At master level, unclassified openings are usually a classification limitation, rare sideline, or transposition — not a beginner-style mistake.",
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

    if level in {"master", "elite"}:
        return {
            "type": "master_audit",
            "title": "Master-level repertoire audit",
            "summary": "This is a master-level repertoire audit. Treat heavily played openings as trusted weapons unless the data is large and extremely clear.",
            "primary_action": "Prioritise colour splits, time-control splits, opponent-rating bands, and openings that have changed performance recently.",
            "best_opening": best_name,
            "weak_opening": weak_name,
        }

    if level == "expert":
        return {
            "type": "expert_audit",
            "title": "Expert repertoire audit",
            "summary": "This player likely already has serious opening knowledge. Recommendations should identify practical review areas, not prescribe basic replacements.",
            "primary_action": f"Use {best_name} as the stable reference point, then investigate {weak_name} for branches, move-order issues, or recent trend changes.",
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

    if level == "intermediate":
        return {
            "type": "intermediate_repertoire",
            "title": "Practical intermediate repertoire",
            "summary": "This player should build around repeated strengths and study typical middlegame plans rather than memorising lots of theory.",
            "primary_action": f"Build around {best_name}, then review the first uncomfortable position in {weak_name}.",
            "best_opening": best_name,
            "weak_opening": weak_name,
        }

    if level in {"beginner", "developing", "improver"}:
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


TACTICAL_OPENING_TERMS = {
    "gambit",
    "sicilian",
    "vienna",
    "king's gambit",
    "scotch",
    "danish",
    "smith-morra",
    "albin",
    "englund",
    "benko",
    "max lange",
    "fried liver",
    "attack",
}

POSITIONAL_OPENING_TERMS = {
    "caro-kann",
    "french",
    "london",
    "queen's gambit",
    "queen's gambit declined",
    "slav",
    "catalan",
    "reti",
    "réti",
    "english",
    "italian",
    "queen's indian",
    "nimzo",
    "colle",
}

BLACK_OPENING_TERMS = {
    "defence",
    "defense",
    "sicilian",
    "french",
    "caro-kann",
    "scandinavian",
    "pirc",
    "modern",
    "alekhine",
    "dutch",
    "nimzo",
    "queen's indian",
    "king's indian",
    "slav",
    "benoni",
    "benko",
    "englund",
}

WHITE_OPENING_TERMS = {
    "london",
    "vienna",
    "italian",
    "ruy lopez",
    "spanish",
    "scotch",
    "king's gambit",
    "queen's gambit",
    "english opening",
    "reti",
    "réti",
    "colle",
    "stonewall",
    "trompowsky",
    "wayward queen",
    "danish",
}


def opening_name_matches(name: str, terms: set[str]) -> bool:
    lower = str(name or "").lower()
    return any(term in lower for term in terms)


def infer_opening_side(item: dict) -> str:
    colour = get_opening_colour(item)

    if colour in {"white", "black"}:
        return colour

    name = get_opening_name(item)

    if opening_name_matches(name, BLACK_OPENING_TERMS):
        return "black"

    if opening_name_matches(name, WHITE_OPENING_TERMS):
        return "white"

    return "mixed"


def score_band_text(score: int | None) -> str:
    if score is None:
        return "unclear results"
    if score >= 58:
        return "strong results"
    if score >= 48:
        return "playable but improvable results"
    if score >= 40:
        return "fragile results"
    return "costly results"


def confidence_from_sample(games: int, total_games: int) -> str:
    share = (games / total_games) if total_games else 0

    if games >= 20 or (games >= 12 and share >= 0.1):
        return "High"
    if games >= 8 or (games >= 5 and share >= 0.06):
        return "Medium"
    return "Low"


def estimate_impact_range(opening: dict, average_score: int | None, side_gap: float = 0) -> dict:
    score = get_opening_score(opening)
    games = get_opening_games(opening)

    if score is None:
        low, high = (2, 4)
    else:
        gap = max(0, (average_score or 50) - score)
        sample_bonus = 2 if games >= 12 else 1 if games >= 6 else 0
        side_bonus = 2 if side_gap >= 8 else 0
        low = max(2, min(8, round(gap / 7) + sample_bonus + side_bonus))
        high = min(12, low + 3)

    return {
        "low": low,
        "high": high,
        "label": f"{low}-{high}%",
    }


def build_ai_chess_coach(
    data: dict,
    level_profile: dict,
    openings: list[dict],
    average_score: int | None,
    games_imported: int,
) -> dict:
    known = [item for item in openings if not item.get("is_unknown_opening")]
    style_profile = data.get("style_profile") if isinstance(data.get("style_profile"), dict) else {}
    style_profile_camel = data.get("styleProfile") if isinstance(data.get("styleProfile"), dict) else {}
    useful = [
        item
        for item in known
        if get_opening_games(item) >= 2 and get_opening_score(item) is not None
    ]

    by_score = sorted(
        useful,
        key=lambda item: (get_opening_score(item) or -1, get_opening_games(item)),
        reverse=True,
    )
    weak = sorted(
        useful,
        key=lambda item: (get_opening_score(item) or 100, -get_opening_games(item)),
    )

    white_items = [item for item in useful if infer_opening_side(item) == "white"]
    black_items = [item for item in useful if infer_opening_side(item) == "black"]

    def weighted(items: list[dict]) -> float | None:
        games = sum(get_opening_games(item) for item in items)
        if not games:
            return None
        total = sum(get_opening_games(item) * (get_opening_score(item) or 0) for item in items)
        return round(total / games, 1)

    white_score = weighted(white_items)
    black_score = weighted(black_items)
    side_gap = abs((white_score or average_score or 50) - (black_score or average_score or 50))
    weaker_side = "black" if white_score is not None and black_score is not None and black_score < white_score else "white"

    tactical_games = sum(
        get_opening_games(item)
        for item in known
        if opening_name_matches(get_opening_name(item), TACTICAL_OPENING_TERMS)
    )
    positional_games = sum(
        get_opening_games(item)
        for item in known
        if opening_name_matches(get_opening_name(item), POSITIONAL_OPENING_TERMS)
    )

    if tactical_games > positional_games * 1.2:
        preference = "Tactical"
        preference_copy = "You seem most comfortable when the opening creates immediate contact and forcing choices."
    elif positional_games > tactical_games * 1.2:
        preference = "Positional"
        preference_copy = "Your repertoire leans toward structure, repeatable plans, and slower pressure."
    else:
        preference = "Balanced"
        preference_copy = "Your games show a mix of tactical and positional openings, so the study plan should stay practical rather than narrow."

    repeat_count = len([item for item in known if get_opening_games(item) >= 5])
    variety = len(known)
    if repeat_count >= 4 and variety <= 10:
        consistency_label = "Consistent repertoire"
        consistency_copy = "You repeat enough openings to build habits and measure progress quickly."
    elif variety >= 12 and repeat_count < 4:
        consistency_label = "Scattered repertoire"
        consistency_copy = "You are spreading games across many openings, which makes improvement slower. Narrow the menu for the next block."
    else:
        consistency_label = "Moderate consistency"
        consistency_copy = "There are useful patterns, but a smaller repeatable repertoire would make the next report sharper."

    best = by_score[0] if by_score else None
    weakest = weak[0] if weak else None
    weakest_black = next((item for item in weak if infer_opening_side(item) == "black"), None)
    weakest_white = next((item for item in weak if infer_opening_side(item) == "white"), None)
    priority_target = weakest_black or weakest or weakest_white or best
    priority_name = get_opening_name(priority_target) if priority_target else "your most repeated opening"
    priority_side = infer_opening_side(priority_target) if priority_target else weaker_side
    impact = estimate_impact_range(priority_target or {}, average_score, side_gap)
    confidence = confidence_from_sample(get_opening_games(priority_target or {}), games_imported)

    recommendations = []

    if priority_target:
        action = (
            f"Focus on defending with {priority_name} first"
            if priority_side == "black"
            else f"Make {priority_name} your first study target"
        )
        recommendations.append(
            {
                "priority": 1,
                "title": action,
                "coach_note": (
                    f"This is your clearest improvement lever: {get_opening_games(priority_target)} games, "
                    f"{score_band_text(get_opening_score(priority_target))}."
                ),
                "action": "Review the first position where you stop knowing the plan, then save one simple line you will repeat for 10 games.",
                "confidence": confidence,
                "estimated_impact": impact["label"],
                "estimatedImpact": impact["label"],
                "opening": priority_name,
            }
        )

    if white_score is not None and black_score is not None and side_gap >= 5:
        stronger = "White" if white_score > black_score else "Black"
        weaker = "black" if stronger == "White" else "white"
        recommendations.append(
            {
                "priority": len(recommendations) + 1,
                "title": f"Your {stronger.lower()} repertoire is stronger than {weaker}",
                "coach_note": f"White is scoring {white_score:g}% and Black is scoring {black_score:g}%. The next roadmap should repair the weaker side before adding new weapons.",
                "action": f"Spend the next study block on one {weaker} line instead of learning another opening.",
                "confidence": "Medium" if min(len(white_items), len(black_items)) else "Low",
                "estimated_impact": "4-8%",
                "estimatedImpact": "4-8%",
            }
        )

    if weakest and best and get_opening_score(best) is not None and get_opening_score(weakest) is not None:
        recommendations.append(
            {
                "priority": len(recommendations) + 1,
                "title": f"Use {get_opening_name(best)} as the model for fixing {get_opening_name(weakest)}",
                "coach_note": "Your best opening shows the kind of positions you handle well. Copy that clarity into the weaker line.",
                "action": "Write down the pawn structure, usual piece squares, and one middlegame plan for the weaker opening.",
                "confidence": confidence_from_sample(get_opening_games(best) + get_opening_games(weakest), games_imported),
                "estimated_impact": "3-6%",
                "estimatedImpact": "3-6%",
            }
        )

    roadmap = [
        {
            "phase": "This week",
            "title": f"Stabilise {priority_name}",
            "task": "Study one main line, one common sideline, and the first middlegame plan. Keep it narrow.",
        },
        {
            "phase": "Next 10 games",
            "title": "Repeat the repaired line on purpose",
            "task": "Do not switch openings after one loss. Track whether you reached a familiar position by move 8.",
        },
        {
            "phase": "After 20 games",
            "title": "Re-import and compare",
            "task": f"Look for the target opening moving toward {max(48, (get_opening_score(priority_target or {}) or 45) + 5)}% or better.",
        },
    ]

    opening_suggestions = []
    for item in weak[:3]:
        item_impact = estimate_impact_range(item, average_score, side_gap if infer_opening_side(item) == weaker_side else 0)
        opening_suggestions.append(
            {
                "opening": get_opening_name(item),
                "side": infer_opening_side(item),
                "issue": score_band_text(get_opening_score(item)),
                "suggestion": "Learn one anti-line or simplify the move order before playing it again.",
                "confidence": confidence_from_sample(get_opening_games(item), games_imported),
                "estimated_impact": item_impact["label"],
                "estimatedImpact": item_impact["label"],
            }
        )

    return {
        "headline": f"Study {priority_name} next",
        "summary": (
            f"The fastest improvement path is to repair one repeated weak spot, then test it for 10-20 games. "
            f"{preference_copy}"
        ),
        "recommendations": recommendations[:3],
        "roadmap": roadmap,
        "opening_improvement_suggestions": opening_suggestions,
        "openingImprovementSuggestions": opening_suggestions,
        "style_analysis": {
            "label": data.get("styleLabel") or style_profile.get("primary") or style_profile_camel.get("primary") or f"{preference} practical player",
            "summary": data.get("styleSummary") or style_profile.get("summary") or style_profile_camel.get("summary") or preference_copy,
        },
        "styleAnalysis": {
            "label": data.get("styleLabel") or style_profile.get("primary") or style_profile_camel.get("primary") or f"{preference} practical player",
            "summary": data.get("styleSummary") or style_profile.get("summary") or style_profile_camel.get("summary") or preference_copy,
        },
        "preference_detection": {
            "label": preference,
            "tactical_games": tactical_games,
            "positional_games": positional_games,
            "summary": preference_copy,
        },
        "preferenceDetection": {
            "label": preference,
            "tacticalGames": tactical_games,
            "positionalGames": positional_games,
            "summary": preference_copy,
        },
        "consistency_analysis": {
            "label": consistency_label,
            "summary": consistency_copy,
            "repeat_openings": repeat_count,
            "opening_variety": variety,
        },
        "consistencyAnalysis": {
            "label": consistency_label,
            "summary": consistency_copy,
            "repeatOpenings": repeat_count,
            "openingVariety": variety,
        },
    }


def enrich_analysis_result(payload: Any, username: str | None = None, platform: str | None = None) -> Any:
    if not isinstance(payload, dict):
        return payload

    data = dict(payload)

    level_profile = get_player_level(data, username=username)
    openings = collect_openings(data, include_unknown=True)
    known_openings = [item for item in openings if not item.get("is_unknown_opening")]
    unknown_openings = [item for item in openings if item.get("is_unknown_opening")]
    # Standardised import counts
    games_imported = (
        safe_number(data.get("gamesImported"), None)
        or safe_number(data.get("games_imported"), None)
        or safe_number(data.get("totalGames"), None)
        or safe_number(data.get("total_games"), None)
        or safe_number(data.get("gameCount"), None)
        or safe_number(data.get("game_count"), None)
        or 0
    )

    # Count games with PGN where available
    games_list = data.get("games") if isinstance(data.get("games"), list) else None
    games_with_pgn = 0
    games_parsed = 0
    if games_list:
        for g in games_list:
            pgn = g.get("pgn") if isinstance(g, dict) else None
            if pgn:
                games_with_pgn += 1
                games_parsed += 1

    # Opening detection counts
    games_with_opening = sum(get_opening_games(item) for item in openings)
    openings_detected = len(openings)

    # Usable games are those assigned to known openings (not unknown)
    usable_games = sum(get_opening_games(item) for item in known_openings)
    scored_games = 0
    weighted_score_total = 0

    for item in known_openings:
        games = get_opening_games(item)
        score = get_opening_score(item)

        if games and score is not None:
            scored_games += games
            weighted_score_total += games * score

    average_score = round(weighted_score_total / scored_games, 1) if scored_games else None

    opening_collection_keys = [
        "openings",
        "openingStats",
        "opening_stats",
        "topOpenings",
        "top_openings",
        "bestOpenings",
        "best_openings",
        "preferredWhite",
        "preferred_white",
        "preferredBlack",
        "preferred_black",
        "openingWinRates",
        "opening_win_rates",
    ]

    for key in opening_collection_keys:
        if key in data:
            data[key] = enrich_opening_collection(
                data[key],
                games_imported,
                average_score,
                level_profile,
            )

    # Strict qualification (affects wording/confidence only)
    qualified_openings = [item for item in known_openings if get_opening_games(item) >= 5]

    # Repeat openings heuristic
    repeat_openings = len([item for item in known_openings if get_opening_games(item) >= 3])

    # Base confidence (legacy)
    if games_imported < 30:
        base_confidence = "low"
    elif level_profile.get("rating") is None:
        base_confidence = "medium"
    elif games_imported >= 80 and repeat_openings >= 4:
        base_confidence = "high"
    else:
        base_confidence = "medium"

    # Sample-size aware final confidence / tier
    if usable_games >= 10:
        sample_tier = "strong"
    elif 5 <= usable_games <= 9:
        sample_tier = "medium"
    elif 3 <= usable_games <= 4:
        sample_tier = "light"
    else:
        sample_tier = "aggregate"

    final_confidence = sample_tier

    not_enough_data_reason = None
    if usable_games < 10:
        not_enough_data_reason = (
            f"Only {usable_games} usable games detected — fewer than the recommended 10 for a strong report."
        )

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
        "confidence": base_confidence,
        "sample_tier": sample_tier,
        "games_checked": games_imported,
        "usable_games": usable_games,
        "games_with_pgn": games_with_pgn,
        "games_with_opening": games_with_opening,
        "repeat_openings": repeat_openings,
        "known_openings": len(known_openings),
        "rating_detected": level_profile["rating"],
        "average_score": average_score,
    }
    # Expose analysis-level fields required by the UI
    data["gamesImported"] = games_imported
    data["gamesWithPgn"] = games_with_pgn
    data["gamesWithOpeningDetected"] = games_with_opening
    data["gamesUsedForFit"] = usable_games
    data["qualifiedOpenings"] = [get_opening_name(o) for o in qualified_openings]
    data["analysisConfidence"] = final_confidence
    data["notEnoughDataReason"] = not_enough_data_reason
    data["averageOpeningScore"] = average_score

    # Debug / diagnostic payload for frontend
    debug = {
        "username": username or data.get("username") or data.get("playerName"),
        "platform": platform or data.get("platform"),
        "monthsRequested": data.get("months") or data.get("monthsChecked") or data.get("months_requested"),
        "gamesFetched": games_imported,
        "gamesWithPgn": games_with_pgn,
        "gamesParsed": games_parsed,
        "gamesWithOpening": games_with_opening,
        "openingsDetected": openings_detected,
        "qualifiedOpenings": [get_opening_name(o) for o in qualified_openings],
        "topOpeningSamples": [get_opening_name(o) for o in sorted(openings, key=lambda x: get_opening_games(x), reverse=True)[:5]],
        "rejectedReasonCounts": data.get("rejected") or {},
        "finalConfidence": final_confidence,
        "notEnoughDataReason": not_enough_data_reason,
    }

    data["import_debug"] = debug
    data["backend_recommendation"] = recommendation
    data["backend_coach_summary"] = level_profile["headline"]
    data["backend_next_action"] = recommendation["primary_action"]
    data["ai_chess_coach"] = build_ai_chess_coach(
        data,
        level_profile,
        openings,
        average_score,
        games_imported,
    )
    data["aiChessCoach"] = data["ai_chess_coach"]

    if username and not data.get("username"):
        data["username"] = username

    if platform and not data.get("platform"):
        data["platform"] = platform

    return data
