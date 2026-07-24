from main import build_opening_fit_profile


def test_openingfit_score_uses_chess_score_not_pure_win_rate():
    profile = build_opening_fit_profile(
        [{
            "name": "Italian Game",
            "context": "played_as_white",
            "games": 10,
            "wins": 2,
            "draws": 6,
            "losses": 2,
            "winRate": 20,
            "scoreRate": 50,
        }],
        {"experimental_rare": [], "too_little_data": []},
        10,
        {},
    )

    assert profile["openingFitScoreBreakdown"]["whitePerformance"] == 50
    assert profile["openingFitScoreBreakdown"]["blackPerformance"] == 50
    assert profile["openingFitScoreContract"]["scoreRateDefinition"].startswith("wins plus half of draws")


def test_openingfit_score_contract_is_complete_and_deterministic():
    args = (
        [{"name": "French Defence", "context": "black_vs_e4", "games": 5, "scoreRate": 40, "winRate": 20}],
        {"experimental_rare": [], "too_little_data": []},
        5,
        {},
    )
    first = build_opening_fit_profile(*args)
    second = build_opening_fit_profile(*args)

    assert first == second
    assert first["openingFitScoreContract"]["scale"] == {"minimum": 0, "maximum": 100}
    assert sum(component["weight"] for component in first["openingFitScoreContract"]["components"]) == 100
    assert next(component for component in first["openingFitScoreContract"]["components"] if component["key"] == "whitePerformance")["available"] is False
