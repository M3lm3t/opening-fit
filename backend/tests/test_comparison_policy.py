import json
from copy import deepcopy
from pathlib import Path

import pytest

from analysis.comparison_policy import build_comparison_cohort, comparison_eligibility, opening_context_identity, observed_opening_performance

CASES = json.loads((Path(__file__).resolve().parents[2] / "frontend/src/lib/fixtures/comparisonPolicyCases.json").read_text())


@pytest.mark.parametrize("fixture", CASES, ids=[row["name"] for row in CASES])
def test_shared_comparison_contract(fixture):
    before = deepcopy(fixture)
    assert comparison_eligibility(fixture["previous"], fixture["current"])["comparable"] == fixture["comparable"]
    from main import build_report_progress_comparison
    result = build_report_progress_comparison(fixture["current"], fixture["previous"])
    assert result["available"] == fixture["comparable"]
    assert fixture == before


def test_observed_results_are_not_fit_or_win_rate():
    row = observed_opening_performance({"games": 18, "wins": 11, "draws": 2, "losses": 5})
    assert round(row["winRate"], 1) == 61.1
    assert round(row["scoreRate"], 1) == 66.7
    for missing in ({"games": 0, "wins": 0, "draws": 0, "losses": 0}, {"games": 8, "win_rate": 75, "fitScore": 80}):
        assert observed_opening_performance(missing) is None


def test_role_and_colour_are_required():
    white = {"canonicalContextId": "same", "repertoireRole": "white", "playerColour": "white"}
    assert opening_context_identity(white) != opening_context_identity({**white, "repertoireRole": "black_vs_e4", "playerColour": "black"})
    assert opening_context_identity({**white, "playerColour": "black"}) is None
    assert opening_context_identity({"canonicalContextId": "same"}) is None


def test_cohort_records_all_unique_games_and_explicit_unlimited_cap():
    games = [{"gameId": str(i), "timeControl": "rapid", "classificationContractVersion": 1} for i in range(27)]
    cohort = build_comparison_cohort(games + games, 3, "rapid", {"analysisLimit": None, "analysisSelectionRule": "newest_first", "contractVersion": 4})
    assert len(cohort["gameIds"]) == 27
    assert cohort["analysisLimit"] == "unlimited"
    assert cohort["timeControls"] == ["rapid"]


def test_opening_comparisons_withhold_ambiguous_or_reduced_exposure():
    from main import build_report_progress_comparison
    before, after = deepcopy(CASES[0]["previous"]), deepcopy(CASES[0]["current"])
    row = {"canonicalContextId": "italian|white", "repertoireRole": "white", "playerColour": "white", "openingName": "Italian", "games": 10, "wins": 5, "draws": 0, "losses": 5}
    before["best_openings"] = [row]
    after["best_openings"] = [{**row, "wins": 8, "losses": 2}]
    changes = lambda: [item for item in build_report_progress_comparison(after, before)["items"] if item["type"] == "opening_score"]
    assert changes()[0]["previous"] == 50
    assert changes()[0]["current"] == 80
    after["best_openings"] *= 2
    assert changes() == []
    after["best_openings"] = [{**row, "games": 5, "wins": 5, "losses": 0}]
    assert changes() == []
    after["best_openings"] = [{**row, "wins": 8, "losses": 1}]
    assert changes() == []  # One unknown outcome changes the observed denominator.
