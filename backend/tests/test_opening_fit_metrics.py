from backend.analysis.opening_fit_metrics import build_opening_fit_metrics
from backend.analysis.opening_recommender import (
    build_basic_recommendation_summary,
    build_opening_recommendations,
)
from backend.analysis.style_fingerprint import build_style_fingerprint


def test_opening_fit_metrics_classifies_repeated_weak_line():
    pgn = """
[Opening "Italian Game"]

1. e4 e5 2. Qh5 Nc6 3. Qxf7+ Kxf7 4. Bc4+ d5 5. Bxd5+ Be6
6. Bxe6+ Kxe6 7. Nf3 Nf6 8. Ng5+ Ke7 9. O-O h6 10. Nf3 *
"""
    games = [
        {"pgn": pgn, "opening": "Italian Game", "colour": "white", "result": "loss", "time_class": "blitz"},
        {"pgn": pgn, "opening": "Italian Game", "colour": "white", "result": "loss", "time_class": "blitz"},
        {"pgn": pgn, "opening": "Italian Game", "colour": "white", "result": "draw", "time_class": "rapid"},
    ]

    metrics = build_opening_fit_metrics(games)
    opening = metrics["openings"][0]

    assert opening["games_played"] == 3
    assert opening["loss_rate"] > 50
    assert opening["result_by_colour"]["white"]["losses"] == 2
    assert opening["result_by_time_control"]["blitz"]["games"] == 2
    assert opening["fit_classification"] == "needs_training_line"
    assert metrics["weak_lines"]


def test_style_fingerprint_includes_theory_tolerance_and_basic_recommendations():
    games = [
        {
            "moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O", "Nf6", "d3", "O-O"],
            "opening": "Italian Game",
            "colour": "white",
            "result": "win",
        }
    ] * 8

    fingerprint = build_style_fingerprint(games)
    recommendations = build_opening_recommendations(
        fingerprint,
        current_opening_stats=[{"name": "Italian Game", "games": 8, "wins": 6, "draws": 1, "losses": 1}],
        player_rating=1200,
    )
    summary = build_basic_recommendation_summary(recommendations)

    assert "theory_tolerance" in fingerprint["traits"]
    assert summary["safe_white"]
    assert summary["ambitious_white"]
    assert summary["black_vs_e4"]
    assert summary["black_vs_d4"]
