import pytest
from fastapi import HTTPException, Request

import main
from analysis.opponent_prep import build_opponent_prep


def public_game(game_id, move="Nf3"):
    reply = "Nf6" if move == "Nf3" else "Nc6"
    return {
        "gameId": game_id, "colour": "white", "canonicalOpeningId": "kings-pawn-game",
        "opening": "King's Pawn Game",
        "pgn": f'[White "Opponent"]\n[Black "Other"]\n\n1. e4 e5 2. {move} {reply} *',
    }


def report():
    return {
        "gamesAnalysed": 4, "gamesFound": 4, "monthsChecked": 3,
        "analysis_game_index": [public_game("g1"), public_game("g2"), public_game("g3"), public_game("g4", "Nc3")],
        "repertoireHistory": {"openings": [{
            "canonicalOpeningId": "kings-pawn-game", "opening": "King's Pawn Game", "repertoireRole": "white",
            "totalEligibleGames": 4, "recentGames": 3, "historicalGames": 1,
            "recentFrequency": 1.0, "historicalFrequency": 1.0,
        }]},
    }


def request(ip="127.0.0.1"):
    return Request({"type": "http", "method": "POST", "path": "/api/opponent-prep", "headers": [], "client": (ip, 1234)})


def test_prep_reuses_canonical_openings_positions_and_user_intersections():
    prep = build_opponent_prep(report(), username="Opponent", platform="chess.com", own_opening_ids=["kings-pawn-game"])
    assert prep["likelyWhiteOpenings"][0]["canonicalOpeningId"] == "kings-pawn-game"
    assert prep["likelyWhiteOpenings"][0]["recentGames"] == 3
    assert prep["likelyWhiteOpenings"][0]["historicalGames"] == 1
    tendency = next(row for row in prep["repeatedMoveTendencies"] if row["playedMove"] == "Nf3")
    assert tendency["occurrenceCount"] == 3
    assert tendency["eligibleOccurrenceCount"] == 4
    assert tendency["intersectsUserRepertoire"] is True
    assert tendency["trainingSubjectId"].startswith("opponent-position:white:")
    assert prep["engineAnalysisRan"] is False
    assert tendency["recommendedMove"] is None


def test_feature_flag_fails_closed(monkeypatch):
    monkeypatch.setattr(main, "OPPONENT_PREP_ENABLED", False)
    with pytest.raises(HTTPException, match="not enabled") as error:
        main.opponent_prep(main.OpponentPrepRequest(platform="chess.com", username="Opponent"), request())
    assert error.value.status_code == 404


def test_unavailable_or_private_account_is_graceful(monkeypatch):
    monkeypatch.setattr(main, "OPPONENT_PREP_ENABLED", True)
    monkeypatch.setattr(main, "run_import_route", lambda *_args, **_kwargs: {"gamesFound": 0})
    main._opponent_prep_requests.clear()
    with pytest.raises(HTTPException, match="private, unavailable") as error:
        main.opponent_prep(main.OpponentPrepRequest(platform="lichess", username="Opponent"), request())
    assert error.value.status_code == 404


def test_endpoint_rate_limits_repeated_requests(monkeypatch):
    monkeypatch.setattr(main, "OPPONENT_PREP_ENABLED", True)
    monkeypatch.setattr(main, "run_import_route", lambda *_args, **_kwargs: report())
    main._opponent_prep_requests.clear()
    payload = main.OpponentPrepRequest(platform="chess.com", username="Opponent")
    for _ in range(main.OPPONENT_PREP_RATE_LIMIT):
        assert main.opponent_prep(payload, request("192.0.2.1"))["username"] == "Opponent"
    with pytest.raises(HTTPException, match="request limit") as error:
        main.opponent_prep(payload, request("192.0.2.1"))
    assert error.value.status_code == 429
    assert error.value.headers["Retry-After"]
