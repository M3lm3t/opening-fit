from datetime import datetime, timezone

from backend.analysis.mission_persistence import InMemoryMissionRepository
from backend.analysis.mission_processing import _encounter, process_completed_analysis
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
    assert first == {"encounters": 0, "candidates": 1, "assigned": 1}
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
