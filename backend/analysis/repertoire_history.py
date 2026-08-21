"""Additive repertoire-history classification over canonical attributed games."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping

from analysis.opening_perspective import perspective_from_item


RECENT_WINDOW_DAYS = 60
ESTABLISHED_HISTORICAL_GAMES = 5
MIN_EXPERIMENT_GAMES = 2


def _text(value: Any) -> str:
    return str(value or "").strip()


def _opening_key(value: Any) -> str:
    return "-".join(_text(value).lower().replace("'", "").split())


def _canonical_opening_id(game: Mapping[str, Any], opening: str) -> str:
    return _text(
        game.get("canonicalOpeningId")
        or game.get("canonical_opening_id")
        or game.get("openingId")
        or game.get("opening_id")
    ) or _opening_key(opening)


def _played_at(game: Mapping[str, Any]) -> datetime | None:
    raw = next((game.get(key) for key in ("playedAt", "played_at", "played_date", "end_time", "endTime", "createdAt") if game.get(key) is not None), None)
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(float(raw), timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    value = _text(raw)
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc).astimezone(timezone.utc)
    except ValueError:
        return None


def _result(game: Mapping[str, Any]) -> str:
    value = _text(game.get("result") or game.get("playerResult") or game.get("player_result")).lower()
    if value in {"win", "won", "1-0"}: return "win"
    if value in {"draw", "drawn", "1/2-1/2"}: return "draw"
    if value in {"loss", "lost", "0-1"}: return "loss"
    return "unknown"


def build_repertoire_history(games: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    eligible: list[dict[str, Any]] = []
    for game in games:
        perspective = perspective_from_item(game)
        opening = _text(game.get("opening") or game.get("openingName") or game.get("name"))
        role = _text(perspective.get("repertoireRole"))
        if not opening or role not in {"white", "black_vs_e4", "black_vs_d4"}:
            continue
        if not perspective.get("roleAttributionTrusted") or perspective.get("relationship") != "played":
            continue
        eligible.append({
            "game": game, "opening": opening,
            "openingKey": _opening_key(opening),
            "canonicalOpeningId": _canonical_opening_id(game, opening),
            "role": role, "playedAt": _played_at(game),
        })

    dated = [row for row in eligible if row["playedAt"] is not None]
    latest = max((row["playedAt"] for row in dated), default=None)
    recent_start = latest.date().toordinal() - (RECENT_WINDOW_DAYS - 1) if latest else None
    history_available = bool(latest and any(row["playedAt"].date().toordinal() < recent_start for row in dated))

    role_totals: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "recent": 0, "historical": 0})
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in eligible:
        groups[(row["role"], row["openingKey"])].append(row)
        role_totals[row["role"]]["total"] += 1
        if recent_start is not None and row["playedAt"] is not None:
            bucket = "recent" if row["playedAt"].date().toordinal() >= recent_start else "historical"
            role_totals[row["role"]][bucket] += 1

    openings = []
    for (role, opening_key), rows in groups.items():
        dated_rows = sorted((row for row in rows if row["playedAt"] is not None), key=lambda row: row["playedAt"])
        recent_rows = [row for row in dated_rows if recent_start is not None and row["playedAt"].date().toordinal() >= recent_start]
        historical_rows = [row for row in dated_rows if recent_start is not None and row["playedAt"].date().toordinal() < recent_start]
        months = {row["playedAt"].strftime("%Y-%m") for row in historical_rows}
        historical_span = (historical_rows[-1]["playedAt"].date() - historical_rows[0]["playedAt"].date()).days if len(historical_rows) > 1 else 0
        repeated_historically = len(historical_rows) >= ESTABLISHED_HISTORICAL_GAMES and len(months) >= 2 and historical_span >= 30
        recent_frequency = round(len(recent_rows) / role_totals[role]["recent"], 4) if role_totals[role]["recent"] else 0.0
        historical_frequency = round(len(historical_rows) / role_totals[role]["historical"], 4) if role_totals[role]["historical"] else 0.0

        if repeated_historically and (not recent_rows or recent_frequency < 0.05):
            classification = "DORMANT"
        elif repeated_historically:
            classification = "ESTABLISHED"
        elif history_available and len(recent_rows) >= MIN_EXPERIMENT_GAMES and len(historical_rows) <= 1 and recent_frequency >= 0.15:
            classification = "EXPERIMENT"
        elif len(recent_rows) >= ESTABLISHED_HISTORICAL_GAMES or (len(historical_rows) >= 2 and len(recent_rows) >= 2):
            classification = "CURRENT"
        else:
            classification = "INSUFFICIENT_EVIDENCE"

        results = defaultdict(int)
        for row in rows:
            results[_result(row["game"])] += 1
        decided = results["win"] + results["draw"] + results["loss"]
        score_rate = round(((results["win"] + 0.5 * results["draw"]) / decided) * 100, 1) if decided else None
        openings.append({
            "opening": rows[0]["opening"], "openingKey": opening_key,
            "canonicalOpeningId": rows[0]["canonicalOpeningId"], "repertoireRole": role,
            "classification": classification, "isCurrent": bool(recent_rows),
            "totalEligibleGames": len(rows), "recentGames": len(recent_rows), "historicalGames": len(historical_rows),
            "datedGames": len(dated_rows), "undatedGames": len(rows) - len(dated_rows),
            "firstSeen": dated_rows[0]["playedAt"].isoformat().replace("+00:00", "Z") if dated_rows else None,
            "lastSeen": dated_rows[-1]["playedAt"].isoformat().replace("+00:00", "Z") if dated_rows else None,
            "historicalFrequency": historical_frequency, "recentFrequency": recent_frequency,
            "continuity": {"historicalMonths": len(months), "historicalSpanDays": historical_span, "repeatedAcrossTime": repeated_historically},
            "performance": {"wins": results["win"], "draws": results["draw"], "losses": results["loss"], "scoreRate": score_rate},
        })

    priority = {"DORMANT": 0, "ESTABLISHED": 1, "CURRENT": 2, "EXPERIMENT": 3, "INSUFFICIENT_EVIDENCE": 4}
    openings.sort(key=lambda row: (row["repertoireRole"], priority[row["classification"]], -row["totalEligibleGames"], row["openingKey"]))
    return {
        "version": "repertoire_history_v1", "recentWindowDays": RECENT_WINDOW_DAYS,
        "windowAnchor": latest.isoformat().replace("+00:00", "Z") if latest else None,
        "recentWindowStart": datetime.fromordinal(recent_start).date().isoformat() if recent_start is not None else None,
        "historyAvailable": history_available,
        "classificationPolicy": {
            "establishedHistoricalGames": ESTABLISHED_HISTORICAL_GAMES,
            "minimumExperimentGames": MIN_EXPERIMENT_GAMES,
            "currentMayOverlapEstablishedViaIsCurrent": True,
        },
        "openings": openings,
    }
