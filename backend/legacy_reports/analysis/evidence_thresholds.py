"""Authoritative opening-specific evidence thresholds used by recommendation code."""

MINIMUM_OPENING_GAMES = 5
MODERATE_CONFIDENCE_GAMES = 10
HIGH_CONFIDENCE_GAMES = 25


def evidence_sample_tier(games: int) -> tuple[str, str]:
    """Return the shared, user-facing sample tier without implying certainty."""
    count = max(0, int(games or 0))
    if count == 0:
        return "unavailable", "Unavailable"
    if count <= 4:
        return "exploratory", "Exploratory signal"
    if count <= 9:
        return "early", "Early signal"
    if count <= 24:
        return "moderate", "Moderate confidence"
    if count <= 49:
        return "strong", "Strong confidence"
    return "high", "High confidence"
