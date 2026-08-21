"""Canonical parent-fallback evidence hierarchy for valid imported games."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone, timedelta
import hashlib
from typing import Any, Iterable, Mapping

from analysis.evidence_thresholds import evidence_sample_tier


def _text(value: Any) -> str:
    return str(value or "").strip()


def _perspective(game: Mapping[str, Any]) -> Mapping[str, Any]:
    value = game.get("perspective")
    return value if isinstance(value, Mapping) else game


def _identity(game: Mapping[str, Any]) -> str:
    return _text(game.get("gameId") or game.get("game_id") or game.get("url"))


def _role(game: Mapping[str, Any]) -> str:
    perspective = _perspective(game)
    return _text(perspective.get("repertoireRole") or game.get("repertoireRole") or game.get("playerRole") or "unresolved")


def _colour(game: Mapping[str, Any]) -> str:
    perspective = _perspective(game)
    return _text(perspective.get("userColour") or game.get("playerColour") or game.get("colour") or "unknown")


def _opening_id(game: Mapping[str, Any]) -> str:
    return _text(game.get("canonicalOpeningId") or game.get("canonical_opening_id"))


def _opening_family_id(game: Mapping[str, Any]) -> str:
    return _text(
        game.get("canonicalOpeningFamilyId") or game.get("canonical_opening_family_id")
        or game.get("openingFamilyId") or game.get("opening_family_id") or _opening_id(game)
    )


def _variation_id(game: Mapping[str, Any]) -> str:
    opening_id = _opening_id(game)
    variation = _text(game.get("matchedOpeningRuleId") or game.get("variation"))
    return f"{opening_id}:{variation}" if opening_id and variation else ""


def _position_id(game: Mapping[str, Any]) -> str:
    return _text(game.get("canonicalPositionId") or game.get("canonical_position_id") or game.get("positionIdentity"))


def _played_at(game: Mapping[str, Any]) -> datetime | None:
    raw = game.get("playedAt") or game.get("played_at") or game.get("end_time") or game.get("date")
    if isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(float(raw), tz=timezone.utc)
        except (ValueError, OSError, OverflowError):
            return None
    try:
        value = _text(raw).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(value) if value else None
        if parsed and parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def _confidence(count: int, *, trusted: int, total: int, weighted: float | None = None) -> dict[str, Any]:
    tier, label = evidence_sample_tier(count)
    attribution_trust = round(trusted / total, 3) if total else 0.0
    weighted = round(float(count if weighted is None else weighted), 2)
    score = round(min(1.0, weighted / 10) * 0.65 + attribution_trust * 0.35, 3) if total else 0.0
    if total >= 15 and attribution_trust < 0.1:
        state, state_label, recommendation_strength = "analysis_failure", "Analysis failure", "none"
    elif count >= 10 and score >= 0.75:
        state, state_label, recommendation_strength = "strong", "Strong evidence", "firm"
    elif count >= 5 and score >= 0.5:
        state, state_label, recommendation_strength = "developing", "Developing evidence", "cautious"
    elif count > 0:
        state, state_label, recommendation_strength = "limited", "Limited evidence", "observation_only"
    else:
        state, state_label, recommendation_strength = "limited", "Limited evidence", "none"
    if attribution_trust < 0.8 and tier not in {"unavailable", "exploratory"}:
        tier, label = "exploratory", "Exploratory signal"
    return {
        "tier": tier,
        "label": label,
        "sampleSize": count,
        "attributionTrust": attribution_trust,
        "weightedGameEquivalent": weighted,
        "score": score,
        "state": state,
        "stateLabel": state_label,
        "recommendationStrength": recommendation_strength,
        "additionalRelevantGamesForDeveloping": max(0, int(5 - weighted + 0.999)),
        "additionalRelevantGamesForStrong": max(0, int(10 - weighted + 0.999)),
        "factors": ["sample_size", "recency_weight", "attribution_trust"],
    }


def build_evidence_hierarchy(games: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    """Allocate each stable game to every trustworthy parent level exactly once."""
    unique: dict[str, Mapping[str, Any]] = {}
    for game in games:
        if not isinstance(game, Mapping):
            continue
        identity = _identity(game)
        if identity:
            unique.setdefault(identity, game)
    rows = list(unique.values())
    dated = [value for value in (_played_at(game) for game in rows) if value]
    newest = max(dated) if dated else None
    recent_boundary = newest - timedelta(days=90) if newest else None
    weights = {
        game_id: (1.0 if not recent_boundary or (_played_at(game) and _played_at(game) >= recent_boundary) else 0.65)
        for game_id, game in unique.items()
    }
    groups: dict[str, dict[str, set[str]]] = {
        level: defaultdict(set) for level in ("playerColour", "repertoireRole", "openingFamily", "variation", "exactPosition")
    }
    trusted_ids: set[str] = set()
    for game_id, game in unique.items():
        perspective = _perspective(game)
        trusted = bool(perspective.get("roleAttributionTrusted") or game.get("roleAttributionTrusted"))
        if trusted:
            trusted_ids.add(game_id)
        colour, role, opening_id = _colour(game), _role(game), _opening_family_id(game)
        if colour in {"white", "black"}:
            groups["playerColour"][colour].add(game_id)
        if trusted and role in {"white", "black_vs_e4", "black_vs_d4"}:
            groups["repertoireRole"][role].add(game_id)
            if opening_id:
                groups["openingFamily"][f"{role}:{opening_id}"].add(game_id)
                if variation := _variation_id(game):
                    groups["variation"][f"{role}:{variation}"].add(game_id)
                if position := _position_id(game):
                    groups["exactPosition"][f"{role}:{position}"].add(game_id)

    def entries(level: str) -> list[dict[str, Any]]:
        return [
            {
                "identity": identity,
                "games": len(ids),
                "gameIds": sorted(ids),
                "confidence": _confidence(len(ids), trusted=len(ids & trusted_ids), total=len(ids), weighted=sum(weights[item] for item in ids)),
            }
            for identity, ids in sorted(groups[level].items())
        ]

    account_confidence = _confidence(len(rows), trusted=len(trusted_ids), total=len(rows), weighted=sum(weights.values()))
    ledger = []
    for game_id, game in sorted(unique.items()):
        perspective = _perspective(game)
        trusted = bool(perspective.get("roleAttributionTrusted") or game.get("roleAttributionTrusted"))
        role, family, position = _role(game), _opening_family_id(game), _position_id(game)
        ledger.append({
            "gameId": game_id,
            "playerColour": _colour(game),
            "repertoireRole": role,
            "roleAttributionTrusted": trusted,
            "openingFamilyId": family or None,
            "positionIdentity": position or None,
            "usedForOpeningEvidence": bool(trusted and role in {"white", "black_vs_e4", "black_vs_d4"} and family),
            "usedForPositionEvidence": bool(trusted and role in {"white", "black_vs_e4", "black_vs_d4"} and position),
            "exclusionReason": game.get("exclusionReason") or game.get("exclusion_reason"),
            "recencyWeight": weights[game_id],
        })
    failure = account_confidence["state"] == "analysis_failure"
    diagnostic = hashlib.sha256(f"{len(rows)}:{len(trusted_ids)}:{sorted(unique)}".encode()).hexdigest()[:12] if failure else None
    return {
        "contractVersion": 2,
        "fallbackOrder": ["exactPosition", "variation", "openingFamily", "repertoireRole", "playerColour", "account"],
        "account": {"games": len(rows), "gameIds": sorted(unique), "confidence": account_confidence},
        "playerColour": entries("playerColour"),
        "repertoireRole": entries("repertoireRole"),
        "openingFamily": entries("openingFamily"),
        "variation": entries("variation"),
        "exactPosition": entries("exactPosition"),
        "gameLedger": ledger,
        "analysisFailure": ({"failed": True, "reason": "systemic_role_attribution_failure", "diagnosticReference": f"evidence-{diagnostic}", "action": "reanalyse"} if failure else {"failed": False}),
        "weighting": {"recentWindowDays": 90, "recentGameWeight": 1.0, "historicalGameWeight": 0.65},
        "globallyInsufficient": len(rows) == 0,
    }
