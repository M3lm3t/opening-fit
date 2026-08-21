from analysis.opening_perspective import attach_perspective, classify_opening_perspective
from copy import deepcopy

import pytest

from analysis.report_decision import apply_repertoire_coverage_score, assert_decision_consistency, build_report_decision


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
        {"opening": name, "gameId": f"{role}-{number}", "result": result, "played_at": f"2026-07-{number:02d}T12:00:00Z", "firstWhiteMove": "e4"},
        perspective(role),
    )


def pgn_game(name: str, role: str, number: int, moves: str, result: str = "draw", classification_ply: int = 2):
    result_tag = {"win": "1-0", "loss": "0-1", "draw": "1/2-1/2"}[result]
    row = game(name, role, number, result)
    row.update({
        "pgn": f'[Event "Priority fixture"]\n[Site "https://chess.com/game/live/{number}"]\n[White "FixturePlayer"]\n[Black "Opponent{number}"]\n[Result "{result_tag}"]\n\n{moves} {result_tag}',
        "white_username": "FixturePlayer",
        "black_username": f"Opponent{number}",
        "classificationPly": classification_ply,
        "openingFamily": name,
        "playerColour": "white",
        "relationship": "faced_by_user",
    })
    return row


def black_pgn_game(name: str, number: int, moves: str, result: str = "loss", classification_ply: int = 2):
    result_tag = {"win": "0-1", "loss": "1-0", "draw": "1/2-1/2"}[result]
    row = game(name, "played_as_black", number, result)
    row.update({
        "pgn": f'[Event "Priority fixture"]\n[Site "https://chess.com/game/live/black-{number}"]\n[White "Opponent{number}"]\n[Black "FixturePlayer"]\n[Result "{result_tag}"]\n\n{moves} {result_tag}',
        "white_username": f"Opponent{number}",
        "black_username": "FixturePlayer",
        "classificationPly": classification_ply,
        "openingFamily": name,
        "playerColour": "black",
        "relationship": "played_by_user",
    })
    return row


def report(games):
    return {
        "platform": "chess.com",
        "username": "FixturePlayer",
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
            "knownResults": 3,
            "scoreRate": 66.7,
    }
    assert recommendation["verdict"] == "insufficient-data"
    assert recommendation["confidence"]["level"] == "insufficient"
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


def test_vienna_decision_contract_cannot_disagree_with_its_repertoire_role():
    results = ["win"] * 36 + ["draw"] * 12 + ["loss"] * 12
    games = [game("Vienna Game", "played_as_white", index, result) for index, result in enumerate(results, 1)]
    decision = build_report_decision(
        report(games),
        openings=[opening("Vienna Game", "played_as_white", 60, 36, 12, 12)],
    )
    recommendation = decision["recommendations"][0]
    role = next(row for row in decision["roleDecisions"] if row["repertoireRole"] == "white")

    assert decision["schemaVersion"] == 6
    assert recommendation["sampleSize"] == 60
    assert recommendation["sampleThreshold"] == 5
    assert recommendation["evidenceStatus"] == "sufficient"
    assert recommendation["confidenceLevel"] == "high_sample"
    assert recommendation["fitScore"] is None
    assert recommendation["verdict"] == role["verdict"] == "keep"
    assert role["status"] == "established"
    assert recommendation["alternativeOpening"] is None
    assert "Style fit was not calculated" in recommendation["verdictReasons"][-1]


def test_large_scandinavian_mixed_signal_is_not_insufficient_or_told_to_play_more():
    results = ["win"] * 26 + ["draw"] * 26 + ["loss"] * 26
    games = [game("Scandinavian Defence", "played_as_black", index, result) for index, result in enumerate(results, 1)]
    decision = build_report_decision(
        report(games),
        openings=[opening("Scandinavian Defence", "played_as_black", 78, 26, 26, 26)],
    )
    recommendation = decision["recommendations"][0]
    role = next(row for row in decision["roleDecisions"] if row["repertoireRole"] == "black_vs_e4")

    assert recommendation["sampleSize"] == role["supportingGameCount"] == 78
    assert recommendation["evidenceStatus"] == role["evidenceStatus"] == "sufficient"
    assert recommendation["confidenceLevel"] == role["confidenceLevel"] == "high_sample"
    assert recommendation["verdict"] == role["verdict"] == "explore"
    assert role["status"] == "established"
    assert decision["primaryProblem"] is None
    assert decision["nextTrainingAction"]["type"] == "fill_repertoire_gap"
    combined_copy = " ".join([
        recommendation["recommendedAction"]["explanation"],
        recommendation["recommendedAction"]["explanation"],
        role["confidenceExplanation"],
    ]).lower()
    assert "large sample, mixed signal" in combined_copy
    assert "not enough" not in combined_copy
    assert "more relevant game" not in combined_copy


def test_alternative_requires_same_role_stronger_evidence_and_an_explicit_reason():
    games = [
        *[game("Vienna Game", "played_as_white", index, "loss") for index in range(1, 11)],
        *[game("Italian Game", "played_as_white", index, "win") for index in range(11, 21)],
        *[game("French Defence", "played_as_black", index, "win") for index in range(21, 31)],
    ]
    decision = build_report_decision(report(games), openings=[
        opening("Vienna Game", "played_as_white", 10, 0, 0, 10),
        opening("Italian Game", "played_as_white", 10, 10, 0, 0),
        opening("French Defence", "played_as_black", 10, 10, 0, 0),
    ])
    vienna = next(row for row in decision["recommendations"] if row["openingName"] == "Vienna Game")

    assert vienna["verdict"] == "repair"
    assert vienna["alternativeOpening"]["openingName"] == "Italian Game"
    assert vienna["alternativeOpening"]["repertoireRole"] == "white"
    assert "same white role" in vienna["alternativeReason"]
    assert "French Defence" not in vienna["alternativeReason"]


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


def test_sufficient_mixed_sample_returns_an_honest_review_action():
    games = [game("Italian Game", "played_as_white", index, result) for index, result in enumerate(["win", "draw", "draw", "loss", "draw"], 1)]
    decision = build_report_decision(report(games), openings=[opening("Italian Game", "played_as_white", 5, 1, 3, 1)])

    assert decision["establishedStrength"] is None
    assert decision["primaryProblem"] is None
    assert decision["nextTrainingAction"]["type"] == "fill_repertoire_gap"
    recommendation = decision["recommendations"][0]
    assert recommendation["recommendedAction"]["completionTarget"]["type"] == "reviewed_games"
    assert "sample is sufficient" in recommendation["recommendedAction"]["explanation"]
    assert "mixed" in recommendation["recommendedAction"]["explanation"]


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


def test_report_exposes_one_canonical_training_priority_for_all_clients():
    games = [game("Caro-Kann Defence", "played_as_black", index, "loss" if index <= 3 else "draw") for index in range(1, 6)]
    decision = build_report_decision(report(games), openings=[opening("Caro-Kann Defence", "played_as_black", 5, 0, 2, 3)])
    action = decision["nextTrainingAction"]
    priority = decision["trainingPriority"]

    assert priority["recommendationId"] == action["recommendationId"]
    assert priority["openingName"] == action["opening"] == "Caro-Kann Defence"
    assert priority["role"] == action["role"] == "played_as_black"
    assert priority["playerColour"] == "black"
    assert priority["evidenceCount"] == 5
    assert priority["estimatedDurationMinutes"] == 10
    assert priority["fallback"] is False
    assert priority["priorityId"].startswith("training-")


def test_report_evidence_uses_singular_result_and_game_labels():
    games = [game("Italian Game", "played_as_white", 1, "draw")]
    decision = build_report_decision(report(games), openings=[opening("Italian Game", "played_as_white", 1, 0, 1, 0)])
    recommendation = decision["recommendations"][0]

    assert recommendation["evidence"][0] == "1 game: 0 wins, 1 draw, 0 losses."
    assert recommendation["confidence"]["reason"] == "1 opening-specific game is too little data for a firm verdict."


def test_repertoire_roles_expose_role_specific_evidence_gaps_and_filters():
    games = [
        *[game("Vienna Game", "played_as_white", index, "win") for index in range(1, 6)],
        *[game("Caro-Kann Defence", "played_as_black", index, "draw") for index in range(6, 10)],
    ]
    payload = report(games)
    payload["analysisTimeFormat"] = "rapid"
    decision = build_report_decision(payload, openings=[
        opening("Vienna Game", "played_as_white", 5, 5, 0, 0),
        opening("Caro-Kann Defence", "played_as_black", 4, 0, 4, 0),
    ])
    roles = {row["key"]: row for row in decision["repertoireRoles"]}

    assert list(roles) == ["white", "black_e4", "black_d4"]
    assert roles["white"]["status"] == "established"
    assert roles["black_e4"]["status"] == "building"
    assert roles["black_e4"]["evidenceRequirement"]["additionalRelevantGamesRequired"] == 1
    assert roles["black_e4"]["evidenceRequirement"]["opponentFirstMove"] == "1.e4"
    assert roles["black_e4"]["evidenceRequirement"]["timeControls"] == ["rapid"]
    assert roles["black_e4"]["evidenceReasonCode"] == "below_evidence_threshold"
    assert roles["black_e4"]["evidenceFunnel"]["correctlyAttributed"] == 4
    assert roles["black_e4"]["evidenceFunnel"]["assignedToLeadingOpening"] == 4
    assert roles["black_e4"]["evidenceFunnel"]["importedCandidates"] is None
    assert roles["black_e4"]["evidenceFunnel"]["passedReportFilters"] == 4
    assert roles["black_d4"]["status"] == "insufficient"
    assert roles["black_d4"]["evidenceReasonCode"] == "unsupported_or_unknown"
    assert roles["black_d4"]["evidenceRequirement"]["additionalRelevantGamesRequired"] == 5
    assert roles["black_d4"]["evidenceRequirement"]["opponentFirstMove"] == "1.d4"


def test_repertoire_role_funnel_exposes_split_attributed_evidence_without_claiming_zero():
    games = [
        *[game("Caro-Kann Defence", "played_as_black", index, "draw") for index in range(1, 4)],
        *[game("French Defence", "played_as_black", index, "draw") for index in range(4, 6)],
    ]
    decision = build_report_decision(report(games), openings=[
        opening("Caro-Kann Defence", "played_as_black", 3, 0, 3, 0),
        opening("French Defence", "played_as_black", 2, 0, 2, 0),
    ])
    role = next(row for row in decision["repertoireRoles"] if row["key"] == "black_e4")

    assert role["status"] == "building"
    assert role["evidenceReasonCode"] == "split_across_openings"
    assert role["evidenceFunnel"]["correctlyAttributed"] == 5
    assert role["evidenceFunnel"]["assignedToLeadingOpening"] == 3
    assert role["evidenceFunnel"]["distinctAttributedOpenings"] == 2
    assert role["evidenceRequirement"]["additionalRelevantGamesRequired"] == 2


def test_role_evidence_derives_the_leader_from_the_same_eighty_four_game_breakdown():
    groups = (
        ("Caro-Kann Defense", 30),
        ("French Defense", 20),
        ("Sicilian Defense", 18),
        ("Pirc Defense", 16),
    )
    games = []
    number = 1
    for name, count in groups:
        for _ in range(count):
            games.append(game(name, "played_as_black", number, "draw"))
            number += 1

    decision = build_report_decision(report(games), openings=[])
    role = next(row for row in decision["repertoireRoles"] if row["key"] == "black_e4")

    assert role["status"] == "insufficient"
    assert role["openingName"] == "Caro-Kann Defense"
    assert role["evidenceCount"] == 30
    assert role["evidenceFunnel"]["passedReportFilters"] == 84
    assert role["evidenceFunnel"]["correctlyAttributed"] == 84
    assert role["evidenceFunnel"]["assignedToLeadingOpening"] == 30
    assert role["evidenceFunnel"]["distinctAttributedOpenings"] == 4
    assert sum(item["games"] for item in role["evidenceFunnel"]["openingBreakdown"]) == 84
    assert role["evidenceRequirement"]["additionalRelevantGamesRequired"] == 0


def test_role_evidence_counts_filtered_but_unclassified_games_without_inventing_an_opening():
    unresolved = [
        {**game("Temporary", "played_as_black", index, "draw"), "opening": ""}
        for index in range(1, 4)
    ]
    decision = build_report_decision(report(unresolved), openings=[])
    role = next(row for row in decision["repertoireRoles"] if row["key"] == "black_e4")

    assert role["status"] == "insufficient"
    assert role["evidenceReasonCode"] == "opening_unclassified"
    assert role["evidenceFunnel"]["passedReportFilters"] == 3
    assert role["evidenceFunnel"]["correctlyAttributed"] == 0
    assert role["evidenceFunnel"]["openingUnclassified"] == 3
    assert role["evidenceFunnel"]["openingBreakdown"] == []


def test_repertoire_coverage_arithmetic_excludes_results_and_neutral_weakness_state():
    games = [game("Vienna Game", "played_as_white", index, "loss") for index in range(1, 6)]
    decision = build_report_decision(report(games), openings=[opening("Vienna Game", "played_as_white", 5, 0, 0, 5)])
    score = decision["repertoireCoverageScore"]

    assert score["formulaVersion"] == "repertoire_health_v3"
    assert score["weightsTotal"] == 100
    assert sum(component["contribution"] for component in score["components"]) == score["score"]
    assert score["recentResults"]["scored"] is False
    assert score["repairStatus"]["scored"] is True
    assert score["repairStatus"]["label"] in {"Reliable repair target found", "No reliable repair target yet"}

    payload = {"openingFitScore": 61, "openingFitScoreBreakdown": {"blackPerformance": 41}}
    apply_repertoire_coverage_score(payload, decision)
    assert payload["openingFitScoreLegacyV1"] == 61
    assert payload["openingFitScore"] == score["score"]
    assert payload["openingFitScoreContract"]["formulaVersion"] == "repertoire_health_v3"
    assert payload["openingFitScoreBreakdown"] == {component["key"]: component["score"] for component in score["components"]}


def test_decision_guard_rejects_summary_role_verdict_drift():
    games = [game("Vienna Game", "played_as_white", index, "win") for index in range(1, 6)]
    decision = build_report_decision(report(games), openings=[opening("Vienna Game", "played_as_white", 5, 5, 0, 0)])
    broken = deepcopy(decision)
    broken["roleDecisions"][0]["verdict"] = "explore"

    with pytest.raises(ValueError, match="role verdict differs"):
        assert_decision_consistency(broken)


def test_decision_guard_rejects_threshold_cta_and_high_sample_insufficient_copy():
    games = [game("Scandinavian Defence", "played_as_black", index, "draw") for index in range(1, 26)]
    decision = build_report_decision(report(games), openings=[opening("Scandinavian Defence", "played_as_black", 25, 0, 25, 0)])

    threshold_broken = deepcopy(decision)
    threshold_broken["recommendations"][0]["recommendedAction"]["completionTarget"] = {"type": "new_games", "count": 1}
    with pytest.raises(ValueError, match="asks for threshold games"):
        assert_decision_consistency(threshold_broken)

    confidence_broken = deepcopy(decision)
    confidence_broken["recommendations"][0]["verdict"] = "insufficient-data"
    with pytest.raises(ValueError, match="high sample confidence marked insufficient"):
        assert_decision_consistency(confidence_broken)


def test_decision_guard_rejects_conflicting_alternative():
    games = [game("Vienna Game", "played_as_white", index, "loss") for index in range(1, 6)]
    decision = build_report_decision(report(games), openings=[opening("Vienna Game", "played_as_white", 5, 0, 0, 5)])
    broken = deepcopy(decision)
    broken["recommendations"][0]["alternativeOpening"] = {
        "openingName": "French Defence",
        "repertoireRole": "black_vs_e4",
    }

    with pytest.raises(ValueError, match="incompatible or unexplained alternative"):
        assert_decision_consistency(broken)


def test_caro_kann_priority_keeps_verified_games_and_post_classification_continuation_together():
    games = [
        pgn_game("Caro-Kann Defence", "faced_as_white", index, "1. e4 c6 2. d4 d5 3. Nc3 Nf6 4. e5", "draw")
        for index in range(1, 9)
    ] + [
        pgn_game("Caro-Kann Defence", "faced_as_white", 9, "1. e4 c6 2. Nc3 d5 3. d4 Nf6 4. e5", "loss"),
        pgn_game("Caro-Kann Defence", "faced_as_white", 10, "1. e4 c6 2. Nc3 d5 3. d4 Nf6 4. e5", "draw"),
    ]
    decision = build_report_decision(report(games), openings=[opening("Caro-Kann Defence", "faced_as_white", 10, 0, 9, 1)])
    recommendation = decision["recommendations"][0]

    assert recommendation["openingName"] == "Caro-Kann Defence"
    assert recommendation["role"] == "faced_as_white"
    assert recommendation["relationship"] == "faced"
    assert recommendation["sampleSize"] == 10
    assert set(recommendation["sample"]["gameIds"]) == {f"faced_as_white-{index}" for index in range(1, 11)}
    assert recommendation["findingType"] == "preparation_opportunity"
    assert decision["trainingPriority"]["openingName"] is None
    assert decision["trainingPriority"]["findingType"] == "repertoire_gap"


def test_training_priority_falls_back_to_line_rehearsal_without_verified_representative_game():
    games = [game("Caro-Kann Defence", "faced_as_white", index, "draw") for index in range(1, 6)]
    priority = build_report_decision(report(games), openings=[opening("Caro-Kann Defence", "faced_as_white", 5, 0, 5, 0)])["trainingPriority"]

    assert priority["representativeGameIds"] == []
    assert priority["representativeGameStatus"] == "unavailable"
    assert priority["positionFen"] is None
    assert priority["workflowSteps"][0]["type"] == "line_rehearsal"
    assert "No verified source game" in priority["workflowSteps"][0]["label"]


def test_black_priority_targets_the_players_turn_without_labelling_the_opponents_move_as_the_diagnosis():
    games = [
        black_pgn_game("Caro-Kann Defence", index, "1. e4 c6 2. d4 d5 3. Nc3", "loss")
        for index in range(1, 6)
    ]
    decision = build_report_decision(report(games), openings=[opening("Caro-Kann Defence", "played_as_black", 5, 0, 0, 5)])
    priority = decision["trainingPriority"]

    assert priority["playerColour"] == "black"
    assert priority["playerRole"] == "black_vs_e4"
    assert priority["relationship"] == "played_by_user"
    assert priority["recognisedLine"] == "1. e4 c6 2. d4"
    assert priority["openingDiagnosis"]["playerToMove"] == "black"
    assert priority["openingDiagnosis"]["repeatedContinuation"]["move"] == "d5"
    assert priority["openingDiagnosis"]["repeatedContinuation"]["move"] not in {"e4", "c6", "d4"}
    assert priority["opponentContinuation"] is None
