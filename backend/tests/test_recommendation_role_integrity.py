from analysis.opening_perspective import (
    attach_perspective,
    classify_opening_perspective,
    perspective_from_item,
    player_colour_from_names,
)
from analysis.opening_recommender import build_opening_recommendations
from analysis.report_decision import SUPPORTED_FINDING_TYPES, build_report_decision
import main as backend_main


def fingerprint():
    return {"traits": {"tactical_tendency": 60, "positional_tendency": 60}, "evidence": []}


def perspective(user_colour: str, first_move: str, opening_side: str):
    return classify_opening_perspective(
        user_colour=user_colour,
        opening_side=opening_side,
        first_white_move=first_move,
    )


def opening(name: str, role, games: int, wins=None, draws=None, losses=None):
    row = {"name": name, "games": games, "fitScore": 65}
    if wins is not None:
        row.update({"wins": wins, "draws": draws, "losses": losses})
    return attach_perspective(row, role)


def game(name: str, role, number: int, result="draw"):
    return attach_perspective(
        {"opening": name, "gameId": f"role-game-{number}", "result": result},
        role,
    )


def report(games, **extra):
    return {
        "username": "FixturePlayer",
        "platform": "chess.com",
        "gamesImported": extra.pop("gamesImported", len(games)),
        "gamesEligible": extra.pop("gamesEligible", len(games)),
        "gamesAnalysed": len(games),
        "gamesExcluded": extra.pop("gamesExcluded", 0),
        "opening_games": games,
        **extra,
    }


def test_catalog_alternatives_never_cross_repertoire_roles():
    recommendations = build_opening_recommendations(
        fingerprint(),
        current_opening_stats=[
            {"name": "French Defence", "repertoireRole": "black_vs_d4", "games": 12, "wins": 1, "draws": 1, "losses": 10},
            {"name": "Nimzo-Indian Defence", "repertoireRole": "black_vs_e4", "games": 12, "wins": 1, "draws": 1, "losses": 10},
            {"name": "Italian Game", "repertoireRole": "black_vs_e4", "games": 12, "wins": 1, "draws": 1, "losses": 10},
            {"name": "Modern Defence", "repertoireRole": "black_vs_d4", "games": 12, "wins": 4, "draws": 4, "losses": 4},
        ],
        limit_per_slot=20,
    )

    assert all(item["repertoireRole"] == role for role, items in recommendations.items() for item in items)
    assert "French Defence" not in {item["name"] for item in recommendations["black_vs_d4"]}
    assert "Nimzo-Indian Defence" not in {item["name"] for item in recommendations["black_vs_e4"]}
    assert "Italian Game" not in {item["name"] for item in recommendations["black_vs_e4"]}
    french = next(item for item in recommendations["black_vs_e4"] if item["name"] == "French Defence")
    nimzo = next(item for item in recommendations["black_vs_d4"] if item["name"] == "Nimzo-Indian Defence")
    assert french["currentlyPlayed"] is False
    assert nimzo["currentlyPlayed"] is False


def test_insufficient_roles_do_not_become_established_or_full_coverage():
    roles = [
        perspective("white", "e4", "white"),
        perspective("black", "e4", "black"),
        perspective("black", "d4", "black"),
    ]
    decision = build_report_decision(
        report([]),
        openings=[
            opening("Vienna Game", roles[0], 20),
            opening("French Defence", roles[1], 20),
            opening("Nimzo-Indian Defence", roles[2], 20),
        ],
    )

    assert [item["status"] for item in decision["repertoireRoles"]] == ["insufficient"] * 3
    assert decision["repertoireCoverageScore"]["components"][0]["score"] == 0
    assert decision["repertoireCoverageScore"]["score"] < 100


def test_high_raw_count_and_low_supporting_count_explain_the_failed_threshold():
    role = perspective("black", "e4", "black")
    games = [game("Scandinavian Defence", role, index, "loss") for index in range(1, 4)]
    decision = build_report_decision(
        report(games, gamesImported=300, gamesEligible=220, gamesExcluded=80),
        openings=[opening("Scandinavian Defence", role, 78, 0, 0, 78)],
    )
    recommendation = decision["recommendations"][0]

    assert recommendation["evidenceCounts"] == {
        "importedGames": 300,
        "eligibleGames": 220,
        "classifiedOpeningGames": 78,
        "roleAttributedGames": 3,
        "supportingGames": 3,
        "excludedGames": 80,
    }
    assert recommendation["supporting_game_count"] == 3
    assert recommendation["required_game_count"] == 5
    assert recommendation["confidence_reason_code"] == "supporting_sample_below_threshold"
    assert "78 games were recorded" in recommendation["confidence_explanation"]
    assert "3 correctly attributed games" in recommendation["confidence_explanation"]
    assert recommendation["verdict"] == "insufficient-data"


def test_player_colour_matching_is_case_insensitive_and_unicode_normalised():
    assert player_colour_from_names("  FIXTUREPLAYER ", "fixturePlayer", "Opponent") == ("white", None)
    assert player_colour_from_names("Ｆｉｘｔｕｒｅ", "Opponent", "fixture") == ("black", None)
    assert player_colour_from_names("Same", "same", "SAME") == ("unknown", "player_colour_ambiguous")
    assert perspective("black", "1.d4", "black")["repertoireRole"] == "black_vs_d4"


def test_recognised_black_repertoire_games_populate_the_correct_black_roles():
    black_e4 = perspective("black", "e4", "black")
    black_d4 = perspective("black", "d4", "black")
    games = [
        game("French Defence", black_e4, 1),
        game("Scandinavian Defence", black_e4, 2),
        game("King's Indian Defence", black_d4, 3),
        game("King's Indian Defence", black_d4, 4),
    ]
    decision = build_report_decision(report(games), openings=[])
    role_rows = {item["repertoireRole"]: item for item in decision["repertoireRoles"]}

    assert role_rows["black_vs_e4"]["relevantGameCount"] == 2
    assert role_rows["black_vs_d4"]["relevantGameCount"] == 2
    assert role_rows["black_vs_e4"]["evidenceFunnel"]["passedReportFilters"] == 2
    assert role_rows["black_vs_d4"]["evidenceFunnel"]["passedReportFilters"] == 2


def test_lichess_pipeline_keeps_black_first_move_roles_through_serialisation(monkeypatch):
    monkeypatch.setattr(backend_main, "previous_saved_report", lambda _username, _platform: None)
    monkeypatch.setattr(backend_main, "save_user_profile", lambda username, _payload: {
        "username": username,
        "lastUpdated": "2026-01-01T00:00:00+00:00",
        "importHistory": [],
        "isPremium": False,
    })
    monkeypatch.setattr(backend_main, "log_analytics_event", lambda _event, _data=None: None)
    def lichess_game(game_id, moves, opening_name):
        return {
            "id": game_id,
            "moves": moves,
            "opening": {"name": opening_name},
            "players": {
                "white": {"user": {"name": "Opponent"}, "rating": 1500},
                "black": {"user": {"name": "FixtureBlackPlayer"}, "rating": 1500},
            },
            "winner": "white",
            "speed": "rapid",
            "lastMoveAt": 1_700_000_000_000 + int(game_id),
        }

    result = backend_main.build_lichess_analysis("fixtureblackplayer", [
        lichess_game("1", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6", "Sicilian Defense"),
        lichess_game("2", "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O", "Nimzo-Indian Defense"),
    ], 3)
    roles = {item["repertoireRole"]: item for item in result["reportDecision"]["roleDecisions"]}
    candidates = {item["openingName"]: item for item in result["reportDecision"]["recommendations"]}

    assert roles["black_vs_e4"]["relevantGameCount"] == 1
    assert roles["black_vs_d4"]["relevantGameCount"] == 1
    assert candidates["Sicilian Defence"]["repertoireRole"] == "black_vs_e4"
    assert candidates["Nimzo-Indian Defence"]["repertoireRole"] == "black_vs_d4"


def test_white_vienna_and_black_scandinavian_samples_keep_one_role_decision_each():
    white_role = perspective("white", "e4", "white")
    black_e4_role = perspective("black", "e4", "black")
    games = [
        *[game("Vienna Game", white_role, index, "win") for index in range(1, 7)],
        *[game("Scandinavian Defence", black_e4_role, index, "draw") for index in range(7, 15)],
    ]
    decision = build_report_decision(
        report(games),
        openings=[
            opening("Vienna Game", white_role, 6, 6, 0, 0),
            opening("Scandinavian Defence", black_e4_role, 8, 0, 8, 0),
        ],
    )
    roles = {row["repertoireRole"]: row for row in decision["roleDecisions"]}
    recommendations = {row["openingName"]: row for row in decision["recommendations"]}

    assert roles["white"]["status"] == "established"
    assert roles["white"]["currentOpening"] == "Vienna Game"
    assert roles["black_vs_e4"]["status"] == "established"
    assert roles["black_vs_e4"]["currentOpening"] == "Scandinavian Defence"
    assert roles["black_vs_e4"]["supportingGameCount"] == 8
    assert recommendations["Vienna Game"]["repertoireRole"] == "white"
    assert recommendations["Scandinavian Defence"]["repertoireRole"] == "black_vs_e4"
    assert recommendations["Scandinavian Defence"]["verdict"] == roles["black_vs_e4"]["verdict"]


def test_preparation_is_serialised_as_preparation_not_weakness():
    faced = perspective("white", "e4", "black")
    games = [game("Caro-Kann Defence", faced, index) for index in range(1, 6)]
    decision = build_report_decision(
        report(games),
        openings=[opening("Caro-Kann Defence", faced, 5, 0, 5, 0)],
    )

    assert decision["primaryProblem"] is None
    assert decision["nextTrainingAction"]["findingType"] == "preparation_opportunity"
    assert decision["trainingPriority"]["findingType"] == "preparation_opportunity"
    assert decision["findings"][0]["type"] == "preparation_opportunity"
    priority = decision["trainingPriority"]
    assert priority["title"] == "Prepare against Caro-Kann Defence as White"
    assert priority["evidenceCount"] == 5
    assert priority["successCheck"] == "Review at least one supplied game and save one response plan."
    assert priority["workflowSteps"][0]["type"] == "line_rehearsal"
    assert priority["workflowSteps"][-1]["type"] == "next_game_objective"
    assert priority["fallbackSetupDrill"]["source"] == "general_guidance"
    assert priority["sourceGameAvailability"] == {"supportingGames": 5, "referencedGameIds": 5}


def test_supported_poor_opponent_result_is_distinct_from_repertoire_weakness():
    faced = perspective("white", "e4", "black")
    games = [game("Caro-Kann Defence", faced, index, "loss") for index in range(1, 6)]
    decision = build_report_decision(
        report(games),
        openings=[opening("Caro-Kann Defence", faced, 5, 0, 0, 5)],
    )

    assert decision["primaryProblem"] is None
    assert decision["nextTrainingAction"]["findingType"] == "opponent_response_problem"
    assert decision["trainingPriority"]["findingType"] == "opponent_response_problem"


def test_missing_canonical_role_is_a_gap_without_becoming_a_weakness():
    decision = build_report_decision(report([]), openings=[])

    assert decision["primaryProblem"] is None
    assert {item["type"] for item in decision["findings"]} == {"repertoire_gap"}
    assert {item["type"] for item in decision["findings"]} <= SUPPORTED_FINDING_TYPES


def test_legacy_explicit_perspective_loads_without_name_based_role_inference():
    legacy = perspective_from_item({
        "opening": "French Defence",
        "openingRole": "played_as_black",
        "repertoireSlot": "black_vs_e4",
        "userColour": "black",
        "openingSide": "black",
    })
    unresolved = perspective_from_item({"opening": "French Defence", "colour": "black"})

    assert legacy["repertoireRole"] == "black_vs_e4"
    assert legacy["roleAttributionTrusted"] is True
    assert unresolved["repertoireRole"] == "unresolved"
    assert unresolved["classificationSource"] == "legacy_unresolved"


def test_one_canonical_decision_drives_role_alternative_and_weekly_priority():
    current_role = perspective("black", "e4", "black")
    games = [game("French Defence", current_role, index, "loss" if index < 4 else "draw") for index in range(1, 6)]
    payload = report(games, recommended_openings={
        "black_vs_e4": [
            {"name": "Nimzo-Indian Defence", "repertoireRole": "black_vs_d4", "fitScore": 90},
            {"name": "Caro-Kann Defence", "repertoireRole": "black_vs_e4", "fitScore": 72, "reason": "Compatible 1.e4 alternative."},
        ],
    })
    decision = build_report_decision(
        payload,
        openings=[opening("French Defence", current_role, 5, 0, 2, 3)],
    )
    role = next(item for item in decision["roleDecisions"] if item["repertoireRole"] == "black_vs_e4")

    assert role["currentOpening"] == "French Defence"
    assert role["verdict"] == decision["primaryProblem"]["verdict"] == "repair"
    # Catalogue fit alone is not enough to deprioritise a played opening. An
    # alternative needs its own same-role, role-attributed report evidence.
    assert role["compatibleAlternative"] is None
    assert role["alternativeRole"] is None
    assert decision["nextTrainingAction"]["opening"] == "French Defence"
    assert decision["trainingPriority"]["openingName"] == "French Defence"
    assert decision["trainingPriority"]["repertoireRole"] == "black_vs_e4"
