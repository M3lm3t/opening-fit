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


            # Fallback tiers affect wording and confidence rather than blocking output.
            if games >= 10:
                # Strong signal — be decisive but balanced
                if win_rate >= 55:
                    verdict = "Keep"
                else:
                    verdict = "Review"
            elif 5 <= games <= 9:
                verdict = "Volatile sample"
            elif 3 <= games <= 4:
                verdict = "Low confidence"
            else:
                verdict = "Specialist line"
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
    }
    # Expose analysis-level fields required by the UI
    data["gamesImported"] = games_imported
    data["gamesWithPgn"] = games_with_pgn
    data["gamesWithOpeningDetected"] = games_with_opening
    data["gamesUsedForFit"] = usable_games
    data["qualifiedOpenings"] = [get_opening_name(o) for o in qualified_openings]
    data["analysisConfidence"] = final_confidence
    data["notEnoughDataReason"] = not_enough_data_reason

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

    if username and not data.get("username"):
        data["username"] = username

    if platform and not data.get("platform"):
        data["platform"] = platform

    return data
