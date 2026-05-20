import pytest
from backend.intelligence import enrich_analysis_result


def make_payload(games_imported, top_openings=None, games_list=None, months=3):
    payload = {
        "gamesImported": games_imported,
        "months": months,
    }
    if top_openings is not None:
        payload["top_openings"] = top_openings
    if games_list is not None:
        payload["games"] = games_list
    return payload


def test_hikaru_large_sample():
    payload = make_payload(500, top_openings=[{"name": "Sicilian", "games": 120}, {"name": "Vienna", "games": 80}])
    res = enrich_analysis_result(payload, username="hikaru", platform="chess.com")
    assert "analysisConfidence" in res
    assert res["analysisConfidence"] == "strong"
    assert res["notEnoughDataReason"] is None


def test_low_game_account():
    payload = make_payload(3, top_openings=[{"name": "Unknown Opening", "games": 2}])
    res = enrich_analysis_result(payload, username="lowgame", platform="chess.com")
    assert "analysisConfidence" in res
    assert res["analysisConfidence"] in {"aggregate", "light"}
    assert res["notEnoughDataReason"] is not None


def test_club_player_medium():
    payload = make_payload(7, top_openings=[{"name": "London System", "games": 4}, {"name": "Italian", "games": 3}])
    res = enrich_analysis_result(payload, username="clubplayer", platform="chess.com")
    assert res["analysisConfidence"] == "medium"


def test_elite_user_conservative_language():
    payload = make_payload(20, top_openings=[{"name": "Rare Line", "games": 3}, {"name": "Another", "games": 2}])
    res = enrich_analysis_result(payload, username="DrNykterstein", platform="chess.com")
    # For elite-like username, still produce a report and not block
    assert "backend_recommendation" in res
    assert res["gamesImported"] == 20
