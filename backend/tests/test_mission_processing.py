from datetime import datetime, timezone

import chess
import chess.pgn

from backend.analysis.mission_persistence import InMemoryMissionRepository
from backend.analysis.mission_processing import _encounter, process_completed_analysis
from backend.analysis.opening_training_opportunities import extract_opening_training_opportunities
from backend.tests.test_mission_candidates import TRANSPOSE_A, TRANSPOSE_B, canonical_game, position_before_fourth_move


def report():
    games = [
        canonical_game("a", TRANSPOSE_A, played_at="2026-08-01T00:00:00Z"),
        canonical_game("b", TRANSPOSE_B, played_at="2026-08-02T00:00:00Z"),
    ]
    return {"reportId": "report-1", "opening_games": games, "openingTrainingOpportunities": [{
        "opportunityId": "trusted-1", "openingId": "queens-gambit", "side": "white",
        "positionFen": position_before_fourth_move(), "recommendedMove": "g3", "source": "active_repertoire_line",
    }]}


def test_processing_is_idempotent_and_baseline_does_not_verify_new_mission():
    repository = InMemoryMissionRepository()
    first = process_completed_analysis(user_id="user-1", platform="chess.com", username="User", report=report(), repository=repository)
    second = process_completed_analysis(user_id="user-1", platform="chess.com", username="User", report=report(), repository=repository)
    assert {key: first[key] for key in ("encounters", "candidates", "assigned")} == {
        "encounters": 0, "candidates": 1, "assigned": 1,
    }
    assert first["reasonCode"] == "candidate_available"
    assert second["assigned"] == 0
    assert len(repository.missions) == 1
    assert repository.encounters == {}


def test_exact_encounter_classification_ignores_result_and_rejects_wrong_turn():
    mission = {"role": "white_repertoire", "exact_position_key": " ".join(position_before_fourth_move().split()[:4])}
    game = canonical_game("future", TRANSPOSE_A, result="win")
    assert _encounter(game, mission) == ("b1c3", "Nc3")
    assert _encounter({**game, "playerColour": "black"}, mission) is None


def test_truncated_game_does_not_create_false_classification():
    pgn = '[White "User"]\n[Black "Other"]\n\n1. Nf3 d5 2. d4 Nf6 3. c4 e6 *'
    mission = {"role": "white_repertoire", "exact_position_key": " ".join(position_before_fourth_move().split()[:4])}
    assert _encounter(canonical_game("truncated", pgn), mission) is None


SCANDINAVIAN = '[White "Other"]\n[Black "User"]\n\n1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd8 4. d4 *'


def _scandinavian_position():
    game = chess.pgn.read_game(__import__("io").StringIO(SCANDINAVIAN))
    board = game.board()
    for move in game.mainline_moves():
        if board.turn == chess.BLACK and board.fullmove_number == 3:
            return board.fen()
        board.push(move)
    raise AssertionError("fixture did not reach Scandinavian repair position")


def _large_three_role_report(*, trusted_repair=True):
    target = _scandinavian_position()
    games = []
    for index in range(60):
        extra = {
            "openingDisplayName": "Scandinavian Defence",
            "openingFamily": "Scandinavian Defence",
        }
        if trusted_repair:
            extra["moveAnalysis"] = [{
                "moveNumber": 3, "positionFen": target,
                "issueType": "repertoire_deviation",
                "explanation": "The verified report continuation keeps the queen active.",
                "recommendedMove": "Qa5", "recommendedMoveReliable": True,
                "confidence": 0.9, "source": "canonical_report_decision",
            }]
        games.append(canonical_game(
            f"scandinavian-{index}", SCANDINAVIAN, role="black_vs_e4",
            opening_id="scandinavian-defence", colour="black", **extra,
        ))
    for index in range(70):
        games.append(canonical_game(
            f"white-{index}", '[White "User"]\n[Black "Other"]\n\n1. a3 a6 *',
            opening_id="white-test-opening", openingDisplayName="White test opening",
            openingFamily="White test opening",
        ))
        games.append(canonical_game(
            f"black-d4-{index}", '[White "Other"]\n[Black "User"]\n\n1. d4 a6 *',
            role="black_vs_d4", opening_id="black-d4-test-opening", colour="black",
            openingDisplayName="Black d4 test opening", openingFamily="Black d4 test opening",
        ))
    opportunities = extract_opening_training_opportunities(games, user_id="opaque-fixture-user", username="User")
    return {"reportId": "large-report", "opening_games": games, "openingTrainingOpportunities": opportunities}


def test_realistic_200_game_three_role_scandinavian_repair_assigns_once():
    repository = InMemoryMissionRepository()
    report = _large_three_role_report()
    first = process_completed_analysis(user_id="opaque-fixture-user", platform="chess.com", username="User", report=report, repository=repository)
    second = process_completed_analysis(user_id="opaque-fixture-user", platform="chess.com", username="User", report=report, repository=repository)
    assert len(report["opening_games"]) == 200
    assert {game["playerRole"] for game in report["opening_games"]} == {"white_repertoire", "black_vs_e4", "black_vs_d4"}
    assert {key: first[key] for key in ("encounters", "candidates", "assigned")} == {
        "encounters": 0, "candidates": 1, "assigned": 1,
    }
    assert first["funnel"]["canonicalRecordsReceived"] == 200
    assert second["candidates"] == 1 and second["assigned"] == 0
    assert len(repository.missions) == 1
    mission = next(iter(repository.missions.values()))
    assert mission["opening_id"] == "scandinavian-defence"
    assert mission["status"] == "assigned"
    assert mission["baseline_evidence_count"] == 60


def test_realistic_large_report_without_verified_move_correctly_has_no_candidate():
    repository = InMemoryMissionRepository()
    result = process_completed_analysis(
        user_id="opaque-fixture-user", platform="chess.com", username="User",
        report=_large_three_role_report(trusted_repair=False), repository=repository,
    )
    assert {key: result[key] for key in ("encounters", "candidates", "assigned")} == {
        "encounters": 0, "candidates": 0, "assigned": 0,
    }
    assert result["reasonCode"] == "trusted_correction_missing"
    assert repository.missions == {}


def test_internal_full_evidence_survives_public_compaction_only_until_processing():
    from backend import main

    report = _large_three_role_report()
    report["_missionOpeningGames"] = report["opening_games"]
    report["_missionOpeningTrainingOpportunities"] = report["openingTrainingOpportunities"]
    compact = main.compact_analysis_result(report, preserve_mission_evidence=True)
    assert len(compact["opening_games"]) == main.ANALYSIS_EVIDENCE_GAME_LIMIT
    assert len(compact["_missionOpeningGames"]) == 200

    repository = InMemoryMissionRepository()
    result = process_completed_analysis(
        user_id="opaque-fixture-user", platform="chess.com", username="User",
        report=compact, repository=repository,
    )
    assert result["candidates"] == 1
    public = main.compact_analysis_result(compact)
    assert "_missionOpeningGames" not in public
    assert "_missionOpeningTrainingOpportunities" not in public
