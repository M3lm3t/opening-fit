from pathlib import Path

import chess
import chess.pgn

from backend.analysis.opening_training_opportunities import (
    OPENING_PHASE_END_MOVE,
    extract_opening_training_opportunities,
)


FIXTURES = Path(__file__).parent / "fixtures"


def fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def game(name: str, game_id: str, **extra):
    return {"gameId": game_id, "colour": "white", "pgn": fixture(name), **extra}


def test_repeated_queen_movement_is_grouped_at_the_normalised_position():
    opportunities = extract_opening_training_opportunities(
        [game("repeated_early_queen_1.pgn", "queen-1"), game("repeated_early_queen_2.pgn", "queen-2")],
        user_id="user-1",
        username="FixtureUser",
    )

    queen = next(item for item in opportunities if item["issueType"] == "early_queen_movement")
    assert queen["recurrenceCount"] == 2
    assert queen["recommendedMove"] is None
    assert queen["reviewType"] == "concept_review"
    assert queen["confidence"] >= 0.6
    assert "same normalised position" in queen["evidence"]


def test_active_repertoire_line_supplies_a_legal_intended_move():
    opportunities = extract_opening_training_opportunities(
        [game("italian_repertoire_deviation.pgn", "italian-1")],
        user_id="user-2",
        repertoire=[{
            "status": "active",
            "canonical_opening_id": "italian-game",
            "display_name": "Italian Game",
            "expected_moves": ["e4", "e5", "Nf3", "Nc6", "Bc4"],
        }],
    )

    deviation = next(item for item in opportunities if item["issueType"] == "intended_repertoire_move_missed")
    assert deviation["playedMove"] == "Bb5"
    assert deviation["recommendedMove"] == "Bc4"
    assert deviation["source"] == "active_repertoire_line"
    assert deviation["moveNumber"] == 3


def test_delayed_castling_is_a_concept_review_not_an_invented_move():
    opportunities = extract_opening_training_opportunities(
        [game("delayed_castling.pgn", "castle-1")],
        user_id="user-3",
    )

    delayed = next(item for item in opportunities if item["issueType"] == "delayed_castling")
    assert delayed["moveNumber"] <= OPENING_PHASE_END_MOVE
    assert delayed["recommendedMove"] is None
    assert delayed["alternativeMoves"] == []
    assert "not a claim that castling was tactically forced" in delayed["evidence"]


def test_saved_analysis_is_used_without_exposing_raw_engine_values():
    pgn = fixture("delayed_castling.pgn")
    parsed = chess.pgn.read_game(__import__("io").StringIO(pgn))
    board = parsed.board()
    target_fen = None
    for move in parsed.mainline_moves():
        if board.turn == chess.WHITE and board.fullmove_number == 6:
            target_fen = board.fen()
            break
        board.push(move)
    analysed = game(
        "delayed_castling.pgn",
        "analysis-1",
        move_analysis=[{
            "move_number": 6,
            "position_fen": target_fen,
            "issue_type": "poor_development",
            "explanation": "A developing move was available before another pawn move.",
            "evidence_text": "The saved move analysis marks this as the first opening development issue.",
            "recommended_move": "Ba2",
            "confidence": 0.82,
            "source": "existing_engine_analysis",
            "raw_cp": -187,
        }],
    )

    opportunity = next(item for item in extract_opening_training_opportunities([analysed], user_id="user-4") if item["source"] == "existing_engine_analysis")
    assert opportunity["recommendedMove"] == "Ba2"
    assert "187" not in opportunity["evidence"]
    assert "raw_cp" not in opportunity


def test_post_opening_blunders_are_ignored_unless_marked_as_opening_plan_related():
    late = game(
        "delayed_castling.pgn",
        "late-1",
        move_analysis=[{
            "move_number": 15,
            "issue_type": "bad_pawn_structure",
            "explanation": "A later pawn move was a generic middlegame blunder.",
            "confidence": 0.9,
            "source": "existing_engine_analysis",
        }],
    )
    issues = extract_opening_training_opportunities([late], user_id="user-5")
    assert not any(item["issueType"] == "pawn_structure_mistake" for item in issues)


def test_low_confidence_saved_move_becomes_a_concept_review():
    analysed = game(
        "delayed_castling.pgn",
        "low-confidence-1",
        move_analysis=[{
            "move_number": 6,
            "issue_type": "poor_development",
            "explanation": "The saved analysis has only a weak development signal here.",
            "recommended_move": "Ba2",
            "confidence": "low",
            "source": "existing_engine_analysis",
        }],
    )
    opportunity = next(item for item in extract_opening_training_opportunities([analysed], user_id="user-low") if item["source"] == "existing_engine_analysis")
    assert opportunity["recommendedMove"] is None
    assert opportunity["reviewType"] == "concept_review"
    assert opportunity["confidence"] < 0.6


def test_output_is_deterministic_bounded_and_contains_the_required_shape():
    games = [game("repeated_early_queen_1.pgn", f"repeat-{index}") for index in range(4)]
    first = extract_opening_training_opportunities(games, user_id="user-6", limit=2)
    second = extract_opening_training_opportunities(games, user_id="user-6", limit=2)
    assert first == second
    assert len(first) <= 2
    required = {"opportunityId", "userId", "gameId", "openingId", "side", "moveNumber", "positionFen", "playedMove", "recommendedMove", "alternativeMoves", "issueType", "explanation", "evidence", "confidence", "recurrenceCount", "source"}
    assert required.issubset(first[0])
