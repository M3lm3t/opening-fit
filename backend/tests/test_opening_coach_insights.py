from backend.analysis.opening_coach_insights import build_opening_coach_insights


def _game(opening, result="win", moves=None, colour="white", move_count=None):
    return {
        "opening": opening,
        "result": result,
        "moves": moves or ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O", "Nf6"],
        "colour": colour,
        "moveCount": move_count,
    }


def test_low_sample_returns_defensive_insufficient_data():
    report = {
        "recent_games": [
            _game("Italian Game", "loss", move_count=10),
            _game("Italian Game", "win", move_count=32),
        ]
    }

    insights = build_opening_coach_insights(report)

    assert insights["version"] == 1
    assert insights["confidence"]["label"] == "low"
    assert insights["biggestLeak"]["issueType"] == "insufficient_data"
    assert insights["focusMission"]["targetGames"] == 5


def test_healthy_opening_is_kept_as_strongest_weapon():
    games = [
        _game("Vienna Game", result, move_count=30)
        for result in ["win", "win", "win", "win", "win", "win", "draw", "draw", "win", "win", "loss", "draw"]
    ]
    report = {
        "recent_games": games,
        "best_openings": [{"name": "Vienna Game", "games": 12, "wins": 8, "draws": 3, "losses": 1, "fitScore": 76}],
    }

    insights = build_opening_coach_insights(report)
    diagnostic = insights["openingDiagnostics"][0]

    assert insights["confidence"]["label"] == "high"
    assert insights["strongestWeapon"]["openingName"] == "Vienna Game"
    assert diagnostic["verdict"] == "keep"
    assert diagnostic["phaseAssessment"]["opening"] == "strong"


def test_repeated_early_losses_are_opening_issue():
    moves = ["e4", "e5", "Qh5", "Nc6", "Qxf7+", "Kxf7", "Bc4+", "d5", "Bxd5+", "Be6"]
    games = [_game("Italian Game", "loss", moves=moves, move_count=9) for _ in range(5)]
    games.append(_game("Italian Game", "draw", moves=moves, move_count=14))
    report = {
        "recent_games": games,
        "best_openings": [{"name": "Italian Game", "games": 6, "wins": 0, "draws": 1, "losses": 5, "fitScore": 28}],
    }

    insights = build_opening_coach_insights(report)

    assert insights["biggestLeak"]["openingName"] == "Italian Game"
    assert insights["biggestLeak"]["issueType"] == "opening"
    assert insights["openingDiagnostics"][0]["recurringIssue"]["moveRange"] == "moves 1-12"


def test_later_game_losses_are_not_blamed_on_opening():
    games = [_game("London System", "loss", move_count=36) for _ in range(6)]
    games.extend([_game("London System", "win", move_count=42), _game("London System", "draw", move_count=40)])
    report = {
        "recent_games": games,
        "best_openings": [{"name": "London System", "games": 8, "wins": 1, "draws": 1, "losses": 6, "fitScore": 38}],
    }

    insights = build_opening_coach_insights(report)
    diagnostic = insights["openingDiagnostics"][0]

    assert diagnostic["issueType"] == "middlegame"
    assert insights["biggestLeak"]["issueType"] == "middlegame"
    assert "opening itself is not the main suspect" in diagnostic["explanation"]


def test_missing_move_data_never_crashes_and_uses_existing_rows():
    report = {
        "recent_games": [
            {"opening": "Caro-Kann Defense", "result": "win"},
            {"opening": "Caro-Kann Defense", "result": "draw"},
        ],
        "bestOpenings": [{"name": "Caro-Kann Defense", "games": 2, "wins": 1, "draws": 1, "losses": 0}],
    }

    insights = build_opening_coach_insights(report)

    assert insights["analysedGameCount"] == 2
    assert insights["openingDiagnostics"][0]["openingName"] == "Caro-Kann Defense"
    assert insights["openingDiagnostics"][0]["confidence"] == "low"
