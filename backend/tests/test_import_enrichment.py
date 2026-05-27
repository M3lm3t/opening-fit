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


def test_competitive_psychology_flags_painful_patterns():
    payload = make_payload(
        24,
        top_openings=[
            {"name": "French Defence", "games": 8, "wins": 1, "draws": 1, "losses": 6, "score": 19, "side": "white"},
            {"name": "Sicilian Defence", "games": 6, "wins": 1, "draws": 1, "losses": 4, "score": 25, "side": "black"},
            {"name": "London System", "games": 7, "wins": 5, "draws": 1, "losses": 1, "score": 79, "side": "white"},
        ],
        games_list=[
            {"result": "loss", "moves": " ".join(["e4", "c5"] * 22)},
            {"result": "loss", "moves": " ".join(["d4", "Nf6"] * 21)},
        ],
    )

    res = enrich_analysis_result(payload, username="clubplayer", platform="chess.com")
    psychology = res["competitivePsychology"]

    assert psychology["insights"]
    assert any("French Defence" in item["title"] for item in psychology["insights"])
    assert any(item["type"] == "black_consistency" for item in psychology["insights"])
