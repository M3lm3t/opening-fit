from copy import deepcopy

import pytest

from backend.analysis.style_fingerprint import build_style_fingerprint, LOW_SAMPLE_TRAITS
from backend.analysis.opening_recommender import build_opening_recommendations


@pytest.mark.parametrize("player", ["AliceEval", "BorisEval"])
def test_missing_fingerprint_retains_neutral_numbers_without_measured_trait_claims(player):
    fingerprint = build_style_fingerprint([], username=player)
    assert fingerprint["traits"] == LOW_SAMPLE_TRAITS
    assert set(fingerprint["traitInputStatus"].values()) == {"defaulted"}
    recommendations = build_opening_recommendations(fingerprint, current_opening_stats=[])
    for rows in recommendations.values():
        if not isinstance(rows, list):
            continue
        for row in rows:
            assert row["games"] == 0
            assert "not personally proven" in row["reason"]
            assert set(row["traitInputStatus"].values()) == {"defaulted"}


def test_missing_long_games_do_not_turn_fallback_into_endgame_preference():
    games = [{"moves": "e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6".split(), "result": "win", "colour": "white", "opening": "Italian Game"} for _ in range(4)]
    fingerprint = build_style_fingerprint(games)
    assert fingerprint["traitInputStatus"]["endgame_conversion"] == "defaulted"
    assert fingerprint["traitInputStatus"]["long_game_success"] == "defaulted"
    assert fingerprint["traitInputStatus"]["development_speed"] == "heuristic"


def test_provenance_is_additive_without_changing_ranking_or_stored_input():
    fingerprint = {"traits": {"tactical_tendency": 0, "open_position_preference": 75}, "sample_size": 12, "confidence": "medium"}
    marked = {**deepcopy(fingerprint), "traitInputStatus": {"tactical_tendency": "heuristic", "open_position_preference": "partial"}}
    saved = deepcopy(marked)
    before, after = build_opening_recommendations(fingerprint), build_opening_recommendations(marked)
    for role in ("white", "black_vs_e4", "black_vs_d4"):
        assert [(row["name"], row["fit_score"]) for row in before[role]] == [(row["name"], row["fit_score"]) for row in after[role]]
    assert marked == saved
