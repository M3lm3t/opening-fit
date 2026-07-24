from analysis.opening_perspective import attach_perspective, classify_opening_perspective
from analysis.report_decision import build_report_decision


def perspective(role: str):
    user_colour = "white" if role.endswith("white") else "black"
    opening_side = user_colour if role.startswith("played") else ("black" if user_colour == "white" else "white")
    return classify_opening_perspective(user_colour=user_colour, opening_side=opening_side, first_white_move="e4")


def opening(name: str, role: str, games: int, wins: int, draws: int, losses: int):
    return attach_perspective(
        {"name": name, "games": games, "wins": wins, "draws": draws, "losses": losses},
        perspective(role),
    )


def game(name: str, role: str, number: int, result: str):
    return attach_perspective(
        {"opening": name, "gameId": f"{role}-{number}", "result": result, "played_at": f"2026-07-{number:02d}T12:00:00Z"},
        perspective(role),
    )


def report(games):
    return {
        "platform": "chess.com",
        "username": "example-player",
        "gamesAnalysed": len(games),
        "importedAt": "2026-07-24T12:00:00Z",
        "opening_games": games,
    }


def test_three_game_french_slice_cannot_inherit_twenty_two_game_repair_claim():
    games = [
        game("French Defence", "faced_as_white", 1, "win"),
        game("French Defence", "faced_as_white", 2, "win"),
        game("French Defence", "faced_as_white", 3, "loss"),
    ]
    decision = build_report_decision(
        report(games),
        openings=[opening("French Defence", "faced_as_white", 22, 7, 3, 12)],
    )
    recommendation = decision["recommendations"][0]

    assert recommendation["sample"] == {
        "gameIds": ["faced_as_white-1", "faced_as_white-2", "faced_as_white-3"],
        "games": 3,
        "wins": 2,
        "draws": 0,
        "losses": 1,
        "scoreRate": 66.7,
    }
    assert recommendation["verdict"] == "insufficient-data"
    assert recommendation["confidence"]["level"] == "low"
    assert decision["primaryProblem"] is None
    assert "22" not in decision["nextTrainingAction"]["reason"]


def test_total_report_volume_never_inflates_opening_confidence():
    games = [game("Scandinavian Defence", "played_as_black", index, result) for index, result in enumerate(["loss"] * 4, 1)]
    payload = report(games)
    payload["gamesAnalysed"] = 200
    decision = build_report_decision(payload, openings=[opening("Scandinavian Defence", "played_as_black", 4, 0, 0, 4)])

    assert decision["reportCoverage"]["level"] == "broad"
    assert decision["recommendations"][0]["confidence"]["level"] == "low"
    assert decision["primaryProblem"] is None


def test_colour_and_role_are_part_of_the_evidence_key():
    games = [
        *[game("French Defence", "played_as_black", index, "loss") for index in range(1, 6)],
        *[game("French Defence", "faced_as_white", index, "win") for index in range(6, 16)],
    ]
    decision = build_report_decision(
        report(games),
        openings=[
            opening("French Defence", "played_as_black", 5, 0, 0, 5),
            opening("French Defence", "faced_as_white", 10, 10, 0, 0),
        ],
    )

    owned, faced = decision["recommendations"]
    assert owned["sample"]["games"] == 5
    assert owned["verdict"] == "repair"
    assert faced["sample"]["games"] == 10
    assert faced["verdict"] == "explore"
    assert decision["primaryProblem"]["role"] == "played_as_black"


def test_chess_score_includes_half_a_point_for_each_draw():
    games = [game("Italian Game", "played_as_white", index, result) for index, result in enumerate(["win", "draw", "draw", "loss", "loss"], 1)]
    decision = build_report_decision(report(games), openings=[opening("Italian Game", "played_as_white", 5, 1, 2, 2)])

    assert decision["recommendations"][0]["sample"]["scoreRate"] == 40.0
    assert decision["primaryProblem"]["openingName"] == "Italian Game"


def test_recommendation_ranking_is_deterministic_for_equal_evidence():
    games = [
        *[game("Scandinavian Defence", "played_as_black", index, "loss") for index in range(1, 6)],
        *[game("French Defence", "played_as_black", index, "loss") for index in range(6, 11)],
    ]
    rows = [
        opening("Scandinavian Defence", "played_as_black", 5, 0, 0, 5),
        opening("French Defence", "played_as_black", 5, 0, 0, 5),
    ]
    first = build_report_decision(report(games), openings=rows)["primaryProblem"]["openingName"]
    second = build_report_decision(report(games), openings=list(reversed(rows)))["primaryProblem"]["openingName"]

    assert first == second


def test_variation_names_do_not_silently_inflate_family_evidence():
    games = [
        *[game("French Defence", "played_as_black", index, "loss") for index in range(1, 4)],
        *[game("French Defence: Advance Variation", "played_as_black", index, "loss") for index in range(4, 9)],
    ]
    decision = build_report_decision(
        report(games),
        openings=[opening("French Defence", "played_as_black", 3, 0, 0, 3)],
    )

    assert decision["recommendations"][0]["sample"]["games"] == 3
    assert decision["primaryProblem"] is None


def test_no_supported_weakness_returns_an_honest_collect_more_action():
    games = [game("Italian Game", "played_as_white", index, result) for index, result in enumerate(["win", "draw", "draw", "loss", "draw"], 1)]
    decision = build_report_decision(report(games), openings=[opening("Italian Game", "played_as_white", 5, 1, 3, 1)])

    assert decision["establishedStrength"] is None
    assert decision["primaryProblem"] is None
    assert decision["nextTrainingAction"]["type"] == "collect_more_games"
    assert decision["nextTrainingAction"]["reason"].startswith("No reliable opening weakness")


def test_a_weak_line_requires_recurrence_ids_and_a_move_sequence():
    games = [game("Italian Game", "played_as_white", index, "win" if index <= 3 else "loss") for index in range(1, 6)]
    payload = report(games)
    payload["problem_lines"] = [{
        "opening": "Italian Game",
        "games": 2,
        "supportingGameIds": ["played_as_white-4"],
        "line": "1. e4 e5 2. Nf3 Nc6",
    }]
    decision = build_report_decision(payload, openings=[opening("Italian Game", "played_as_white", 5, 3, 0, 2)])
    assert decision["recommendations"][0]["issue"] is None
    assert decision["recommendations"][0]["verdict"] == "keep"

    payload["problem_lines"][0]["supportingGameIds"].append("played_as_white-5")
    decision = build_report_decision(payload, openings=[opening("Italian Game", "played_as_white", 5, 3, 0, 2)])
    assert decision["recommendations"][0]["issue"]["occurrences"] == 2
    assert decision["recommendations"][0]["verdict"] == "repair"
    action = decision["nextTrainingAction"]
    assert action["lineOrPosition"] == "1. e4 e5 2. Nf3 Nc6"
    assert action["colour"] == "white"
    assert action["completionTarget"] == {"type": "correct_repetitions", "count": 5, "label": "Finish five correct repetitions."}
    assert "Practise the position five times from the White side" in action["exercise"]


def test_broad_training_action_does_not_invent_a_variation():
    games = [game("Scandinavian Defence", "played_as_black", index, "loss" if index <= 3 else "draw") for index in range(1, 6)]
    decision = build_report_decision(report(games), openings=[opening("Scandinavian Defence", "played_as_black", 5, 0, 2, 3)])
    action = decision["nextTrainingAction"]

    assert action["type"] == "repair_repertoire"
    assert "variationName" not in action
    assert "move sequence" in action["reason"]
    assert action["completionTarget"]["count"] == 3
