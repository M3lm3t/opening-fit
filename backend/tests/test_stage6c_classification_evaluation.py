"""Bounded Stage 6C classification and downstream ambiguity regressions."""
from copy import deepcopy
from itertools import permutations

import chess
import pytest

from backend.opening_detection import aggregate_signals, detect_opening, exact_book_signal


def position(moves):
    board = chess.Board()
    for move in moves.split():
        board.push_san(move)
    # Ignore move clocks, retain turn, castling and legally relevant en passant.
    return board.epd()


@pytest.mark.parametrize("direct,transposed,expected", [
    ("d4 d5 c4 e6 Nc3 Nf6 Nf3 Be7", "c4 e6 d4 d5 Nc3 Nf6 Nf3 Be7", "Queen's Gambit Declined"),
    ("d4 d5 c4 c6 Nf3 Nf6 Nc3", "Nf3 d5 c4 c6 d4 Nf6 Nc3", "Slav Defence"),
])
def test_existing_transpositions_preserve_family_at_identical_positions(direct, transposed, expected):
    assert position(direct) == position(transposed)
    assert detect_opening(direct.split())["opening"] == expected
    assert detect_opening(transposed.split())["opening"] == expected


def test_french_evaluation_pair_is_legal_and_position_identical():
    assert position("e4 e6 d4 d5 e5 c5") == position("d4 e6 e4 d5 e5 c5")


def test_french_advance_transposition_is_not_scandinavian():
    direct = detect_opening("e4 e6 d4 d5 e5 c5".split())
    transposed = detect_opening("d4 e6 e4 d5 e5 c5".split())
    assert direct["opening"] == transposed["opening"] == "French Defence"
    assert all(signal["opening"] not in {"Scandinavian Defence", "Sicilian Defence"} for signal in transposed["signals"])


@pytest.mark.parametrize("tag,eco", [("Nimzo-Indian Defence", "E20"), ("French Defence", "C00")])
def test_conflicting_metadata_stays_diagnostic_not_authoritative(tag, eco):
    moves = "e4 e5 Nf3 Nc6 Bc4".split()
    before = deepcopy(moves)
    result = detect_opening(moves, tagged_opening=tag, eco=eco)
    assert result["opening"] == "Italian Game"
    assert result["metadataConflictReason"] == "metadata_conflicts_with_move_rule"
    assert result["metadataSignals"][0]["opening"] == tag
    assert result["classificationSource"] == "move_sequence:exact_book"
    assert moves == before


def test_real_conflicting_signals_are_stable_under_input_permutations():
    result = detect_opening("e4 c5 Nf3 e6 d4 cxd4 Nxd4 d5".split())
    signals = result["signals"]
    assert {signal["opening"] for signal in signals} >= {"French Defence", "Sicilian Defence"}
    assert all(signal["opening"] != "Scandinavian Defence" for signal in signals)
    assert {aggregate_signals(list(order))["opening"] for order in permutations(signals)} == {"Sicilian Defence"}


def test_controlled_equal_strength_family_tie_is_order_independent():
    # Two existing book signals have equal weight/confidence. This deliberately
    # injected conflict tests tie handling, not a claim that one game matches both.
    italian = exact_book_signal("e4 e5 Nf3 Nc6 Bc4".split())
    spanish = exact_book_signal("e4 e5 Nf3 Nc6 Bb5".split())
    assert italian["weight"] * italian["confidence"] == spanish["weight"] * spanish["confidence"]
    a, b = aggregate_signals([italian, spanish]), aggregate_signals([spanish, italian])
    assert (a["canonicalOpeningId"], a["confidence"]) == (b["canonicalOpeningId"], b["confidence"])
    assert a == b
    assert a["opening"] == "Unknown Opening"
    assert a["classificationSource"] == "unclassified"
    assert a["confidence"] == "low"
    assert a["classificationConfidence"] == a["confidenceScore"] == 0
    assert a["matchedOpeningRuleId"] is None
    assert len(a["signals"]) == 2


def test_existing_london_with_bf4_remains_positive_control():
    moves = "d4 Nf6 Nf3 d5 Bf4 e6 e3 Be7"
    position(moves)
    assert detect_opening(moves.split())["opening"] == "London System"


def test_bg5_without_bf4_keeps_existing_broad_queen_pawn_fallback():
    moves = "d4 Nf6 Nf3 e6 Bg5 d5 e3 Be7"
    position(moves)
    assert "Bf4" not in moves.split()[::2]
    assert detect_opening(moves.split())["opening"] == "Queen's Pawn Opening"


@pytest.mark.parametrize("moves", [
    "e4 d5 exd5 Qxd5 Nc3 Qa5",
    "e4 d5 exd5 Nf6 d4 Nxd5",
    "e4 d5 e5 Bf5 d4 e6",
])
def test_valid_scandinavian_continuations_remain_classified(moves):
    position(moves)
    assert detect_opening(moves.split())["opening"] == "Scandinavian Defence"


@pytest.mark.parametrize("moves", [
    "e4 c5 Nf3 d6 d4 cxd4",
    "Nf3 c5 e4 d6 d4 cxd4",
    "e4 c5 Nf3 e6 d4 cxd4 Nxd4 d5",
])
def test_sicilian_entry_is_not_confused_with_later_french_pawn_break(moves):
    position(moves)
    assert detect_opening(moves.split())["opening"] == "Sicilian Defence"


def test_french_exchange_transposition_does_not_acquire_scandinavian_label():
    direct, transposed = "e4 e6 d4 d5 exd5 exd5", "d4 e6 e4 d5 exd5 exd5"
    assert position(direct) == position(transposed)
    assert detect_opening(direct.split())["opening"] == "French Defence"
    assert detect_opening(transposed.split())["opening"] == "French Defence"


@pytest.mark.parametrize("moves,expected", [
    ("d4 d5 Nf3 Nf6 Bf4 e6 e3 Be7", "London System"),
    ("d4 Nf6 Bf4 d5 Nf3 e6 e3 Bd6 Bg5", "London System"),
    ("d4 Nf6 Nf3 d5 Bf4 c5 e3 Nh5 Bg3", "London System"),
    ("d4 Nf6 Nc3 d5 Bf4 e6", "Jobava London System"),
])
def test_london_uses_bf4_history_not_current_bishop_square(moves, expected):
    position(moves)
    assert "Bf4" in moves.split()[::2]
    assert detect_opening(moves.split())["opening"] == expected


def test_ambiguous_signals_cannot_supply_classified_role_evidence_or_recommendations():
    from analysis.classified_game import build_classified_game_record, record_is_classified, record_is_used_for_opening_stats
    from analysis.opening_perspective import classify_opening_perspective
    from analysis.report_decision import build_report_decision
    from main import classified_game_pipeline_counts

    # Even a high raw tied vote must stay unresolved, regardless of game count.
    signals = [dict(exact_book_signal(moves.split()), weight=100) for moves in (
        "e4 e5 Nf3 Nc6 Bc4", "e4 e5 Nf3 Nc6 Bb5")]
    result = aggregate_signals(signals)
    assert result["confidence"] == "low"
    assert result["classificationConfidence"] == 0
    records = []
    for index in range(20):
        record = build_classified_game_record(
            game_id=f"ambiguous-{index}", url="", player_colour="white", player_result="win",
            time_control="rapid", played_at=None, eco=None, opening_family=result["opening"],
            variation=None, classification_ply=result["matchedPlyDepth"],
            perspective=classify_opening_perspective(user_colour="white", opening_side=result["openingSide"], first_white_move="e4"),
            canonical_opening_id=result["canonicalOpeningId"], classification_source=result["classificationSource"],
            matched_opening_rule_id=result["matchedOpeningRuleId"], classification_confidence=result["classificationConfidence"],
        )
        assert record["classificationContractVersion"] == 2
        assert not record_is_classified(record)
        assert not record_is_used_for_opening_stats(record)
        records.append(record)
    counts = classified_game_pipeline_counts(records)
    assert counts["classified"] == counts["usedForOpeningStats"] == 0
    decision = build_report_decision({"analysisId": "ambiguous", "gamesAnalysed": 0, "analysis_game_index": records}, openings=[])
    assert decision["establishedStrength"] is None
    assert decision["primaryProblem"] is None
    assert decision["recommendations"] == []
    assert all(role["status"] != "established" for role in decision["repertoireRoles"])


def test_classification_generation_change_blocks_comparison_without_rewriting_history():
    import json
    from pathlib import Path
    from analysis.comparison_policy import comparison_eligibility
    from analysis.classified_game import CLASSIFICATION_CONTRACT_VERSION

    fixture = json.loads((Path(__file__).resolve().parents[2] / "frontend/src/lib/fixtures/comparisonPolicyCases.json").read_text())[0]
    before = deepcopy(fixture)
    current = deepcopy(fixture["current"])
    current["comparisonCohort"]["classificationVersion"] = CLASSIFICATION_CONTRACT_VERSION
    eligibility = comparison_eligibility(fixture["previous"], current)
    assert not eligibility["comparable"]
    assert "Cohort classificationVersion is missing or different." in eligibility["reasons"]
    previous_v2 = deepcopy(fixture["previous"])
    previous_v2["comparisonCohort"]["classificationVersion"] = CLASSIFICATION_CONTRACT_VERSION
    assert comparison_eligibility(previous_v2, current)["comparable"]
    assert fixture == before
