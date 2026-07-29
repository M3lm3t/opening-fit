from main import build_opening_fit_profile, build_report_progress_comparison


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


def test_progress_comparison_does_not_compare_score_methodologies():
    shared = {"platform": "chess.com", "username": "fixture", "gamesAnalysed": 20}
    previous = {
        **shared,
        "importedAt": "2026-06-01T12:00:00Z",
        "openingFitScore": 61,
        "openingFitScoreContract": {"formulaVersion": "openingfit_score_v1"},
    }
    current = {
        **shared,
        "importedAt": "2026-07-01T12:00:00Z",
        "openingFitScore": 44,
        "openingFitScoreContract": {"formulaVersion": "repertoire_coverage_v2"},
    }

    comparison = build_report_progress_comparison(current, previous)

    assert comparison["enabled"] is True
    assert not any(item.get("type") == "fit_score" for item in comparison["items"])
