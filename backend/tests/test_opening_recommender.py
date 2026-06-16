from backend.analysis.opening_recommender import build_opening_recommendations


def tactical_fingerprint():
    return {
        "confidence": "high",
        "sample_size": 18,
        "traits": {
            "tactical_tendency": 82,
            "open_position_preference": 84,
            "development_speed": 76,
            "gambit_comfort": 62,
            "early_attack_frequency": 64,
            "king_safety_risk": 38,
            "opening_phase_stability": 66,
            "central_pawn_break_frequency": 72,
            "positional_tendency": 45,
            "closed_position_comfort": 38,
            "endgame_conversion": 46,
        },
        "evidence": [
            "You score best in games where the centre opens early.",
            "Your wins are often decided before move 30.",
        ],
    }


def test_recommends_new_open_white_openings_from_tactical_style():
    recommendations = build_opening_recommendations(
        tactical_fingerprint(),
        current_opening_stats=[],
        player_rating=1300,
    )

    white_names = [item["name"] for item in recommendations["white"]]
    assert "Scotch Game" in white_names or "Vienna Game" in white_names
    assert any(item["upgrade_type"] == "new_recommendation" for item in recommendations["white"])
    assert all(0 <= item["fit_score"] <= 100 for item in recommendations["white"])
    assert any(not ("gambit" in item["style_tags"]) for item in recommendations["white"])


def test_high_theory_openings_are_penalised_for_lower_rated_players():
    low_rating = build_opening_recommendations(tactical_fingerprint(), player_rating=900, limit_per_slot=10)
    higher_rating = build_opening_recommendations(tactical_fingerprint(), player_rating=1700, limit_per_slot=10)

    low_grunfeld = next(item for item in low_rating["black_vs_d4"] if item["name"] == "Grünfeld Defence")
    high_grunfeld = next(item for item in higher_rating["black_vs_d4"] if item["name"] == "Grünfeld Defence")

    assert high_grunfeld["fit_score"] > low_grunfeld["fit_score"]


def test_existing_opening_samples_drive_upgrade_type_without_tiny_sample_overclaim():
    recommendations = build_opening_recommendations(
        tactical_fingerprint(),
        current_opening_stats=[
            {"name": "Italian Game", "games": 2, "wins": 2, "draws": 0, "losses": 0},
            {"name": "Caro-Kann Defence", "games": 6, "wins": 4, "draws": 1, "losses": 1},
            {"name": "French Defence", "games": 6, "wins": 1, "draws": 1, "losses": 4},
        ],
        player_rating=1300,
        limit_per_slot=10,
    )

    italian = next(item for item in recommendations["white"] if item["name"] == "Italian Game")
    caro = next(item for item in recommendations["black_vs_e4"] if item["name"] == "Caro-Kann Defence")
    french = next(item for item in recommendations["black_vs_e4"] if item["name"] == "French Defence")

    assert italian["currently_played"] is True
    assert italian["upgrade_type"] == "experiment"
    assert italian["confidence"] == "Low"
    assert italian["recommendation_label"] == "Too little data"
    assert italian["reason_label"] == "Too little data"
    assert "too small" in italian["confidence_reason"]
    assert caro["upgrade_type"] == "keep"
    assert caro["confidence"] == "Medium"
    assert caro["recommendation_label"] == "Keep"
    assert french["upgrade_type"] == "replace"


def test_output_contains_required_fields_and_slot_groups():
    recommendations = build_opening_recommendations(tactical_fingerprint(), player_rating=1400)

    assert set(recommendations) == {"white", "black_vs_e4", "black_vs_d4"}
    sample = recommendations["white"][0]
    for key in [
        "name",
        "fit_score",
        "confidence",
        "confidence_reason",
        "games",
        "recommendation_label",
        "reason_label",
        "short_reason",
        "next_action",
        "reason",
        "evidence",
        "learning_cost",
        "risk_level",
        "currently_played",
        "upgrade_type",
        "watch_out",
    ]:
        assert key in sample
