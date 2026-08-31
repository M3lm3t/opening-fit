from __future__ import annotations

import io
import itertools
import random

import chess
import chess.pgn

from backend.analysis.mission_candidates import (
    MISSIONS_CANDIDATE_ALGORITHM_VERSION,
    build_mission_candidates,
    exact_position_key,
)


TRANSPOSE_A = '[White "User"]\n[Black "Other"]\n\n1. Nf3 d5 2. d4 Nf6 3. c4 e6 4. Nc3 *'
TRANSPOSE_B = '[White "User"]\n[Black "Other"]\n\n1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 *'


def canonical_game(game_id, pgn=TRANSPOSE_A, *, role="white_repertoire", opening_id="queens-gambit", colour="white", trusted=True, played_at=None, result="loss", **extra):
    return {
        "gameId": game_id,
        "pgn": pgn,
        "playerColour": colour,
        "playerResult": result,
        "playedAt": played_at,
        "openingFamily": "Queen's Gambit",
        "openingDisplayName": "Queen's Gambit",
        "canonicalOpeningId": opening_id,
        "classificationSource": "canonical_move_tree",
        "matchedOpeningRuleId": f"rule:{opening_id}",
        "matchedPlyDepth": 4,
        "classificationPly": 4,
        "classificationConfidence": 0.92,
        "playerRole": role,
        "repertoireRole": role,
        "relationship": "played_by_user",
        "roleAttributionTrusted": trusted,
        "repertoireRoleEligibility": role if trusted else "ineligible",
        "classificationContractVersion": 1,
        "exclusionReason": None,
        **extra,
    }


def position_before_fourth_move(pgn=TRANSPOSE_A):
    game = chess.pgn.read_game(io.StringIO(pgn))
    board = game.board()
    for index, move in enumerate(game.mainline_moves()):
        if index == 6:
            return board.fen()
        board.push(move)
    raise AssertionError("fixture did not reach the target position")


def correction(*, fen=None, move="g3", source="active_repertoire_line", provenance="active repertoire entry rep-1", role="white_repertoire", opening_id="queens-gambit"):
    fen = fen or position_before_fourth_move()
    return {
        "role": role,
        "canonicalOpeningId": opening_id,
        "positionFen": fen,
        "acceptedMoves": [move],
        "source": source,
        "provenance": provenance,
    }


def build(games=None, sources=None, **context):
    return build_mission_candidates(
        games or [canonical_game("a", TRANSPOSE_A), canonical_game("b", TRANSPOSE_B)],
        sources or [correction()],
        **context,
    )


def test_transpositions_group_and_move_notation_is_canonical():
    result = build()
    candidate = result["candidates"][0]
    assert candidate["evidenceCount"] == 2
    assert candidate["repeatedPlayedMove"] == {"uci": "b1c3", "san": "Nc3"}
    assert candidate["acceptedCorrectionMoves"] == [{"uci": "g2g3", "san": "g3"}]
    assert candidate["confidence"]["level"] == "low"
    assert candidate["missionType"] == "repertoire_deviation"


def test_exact_position_identity_retains_legal_fields_but_ignores_clocks():
    base = position_before_fourth_move()
    fields = base.split()
    assert exact_position_key(base) == exact_position_key(" ".join([*fields[:4], "27", "91"]))
    assert exact_position_key(base) != exact_position_key(" ".join([fields[0], "b", *fields[2:]]))
    castling = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"
    assert exact_position_key(castling) != exact_position_key(castling.replace("KQkq", "KQ"))
    ep = "8/8/8/3pP3/8/8/8/4K2k w - d6 0 2"
    assert exact_position_key(ep) != exact_position_key(ep.replace(" d6 ", " - "))


def test_duplicate_identity_and_one_game_do_not_inflate_evidence():
    duplicate = canonical_game("a", TRANSPOSE_B)
    result = build([canonical_game("a"), duplicate])
    assert result["candidates"] == []
    assert result["accounting"]["canonicalRecordsReceived"] == 2
    assert result["accounting"]["uniqueCanonicalRecords"] == 1
    assert result["accounting"]["duplicateIdentities"] == 1


def test_untrusted_and_canonically_ineligible_records_are_excluded():
    result = build([
        canonical_game("untrusted", trusted=False),
        canonical_game("excluded", exclusionReason="unsupported"),
    ])
    assert result["candidates"] == []
    assert result["accounting"]["eligibleAttributedRecords"] == 0
    assert result["accounting"]["excludedRecords"] == 2
    assert result["exclusionReasons"] == {
        "canonical_record_ineligible": 1,
        "role_attribution_untrusted": 1,
    }


def test_missing_provenance_or_correction_blocks_assignment():
    missing = correction(provenance="")
    result = build(sources=[missing])
    assert result["candidates"] == []
    assert result["excludedCandidates"][0]["reasonCodes"] == ["trusted_correction_missing"]


def test_conflicting_trusted_sources_block_assignment():
    result = build(sources=[correction(move="g3"), correction(move="e3", source="opening_pack_continuation", provenance="pack qg-1")])
    assert result["candidates"] == []
    assert "trusted_correction_conflict" in result["excludedCandidates"][0]["reasonCodes"]


def test_matching_played_and_correction_move_is_not_a_repair():
    result = build(sources=[correction(move="Nc3")])
    assert result["candidates"] == []
    assert result["excludedCandidates"][0]["reasonCodes"] == ["played_move_matches_correction"]


def test_illegal_correction_is_rejected():
    result = build(sources=[correction(move="e5")])
    assert result["candidates"] == []
    assert result["exclusionReasons"]["trusted_correction_missing"] == 1


def test_result_does_not_change_severity_or_identity():
    losses = build([canonical_game("a", result="loss"), canonical_game("b", TRANSPOSE_B, result="loss")])
    wins = build([canonical_game("a", result="win"), canonical_game("b", TRANSPOSE_B, result="win")])
    assert losses["candidates"][0]["scoreComponents"]["severity"] == wins["candidates"][0]["scoreComponents"]["severity"]
    assert losses["candidates"][0]["candidateKey"] == wins["candidates"][0]["candidateKey"]


def test_candidate_and_ranking_are_stable_across_input_permutations():
    games = [
        canonical_game("a", played_at="2026-01-01T00:00:00Z"),
        canonical_game("b", TRANSPOSE_B, played_at="2026-02-01T00:00:00Z"),
        canonical_game("c", played_at=None),
    ]
    sources = [correction(source="opening_pack_continuation", provenance="pack qg-1"), correction()]
    expected = build(games, sources)
    for game_order in itertools.permutations(games):
        assert build(game_order, reversed(sources)) == expected


def test_scores_and_components_are_deterministic_and_bounded():
    first = build()
    second = build()
    assert first == second
    candidate = first["candidates"][0]
    assert 0 <= candidate["score"] <= 100
    assert all(0 <= value <= 100 for value in candidate["scoreComponents"].values())
    assert candidate["algorithmVersion"] == MISSIONS_CANDIDATE_ALGORITHM_VERSION


def test_missing_timestamps_do_not_create_nondeterminism():
    candidate = build()["candidates"][0]
    assert candidate["firstSeenAt"] is candidate["lastSeenAt"] is None
    assert "timestamps_unavailable" in candidate["confidenceReasonCodes"]


def test_systemic_failure_fails_closed():
    result = build(systemic_failure=True)
    assert result["candidates"] == []
    assert result["exclusionReasons"]["systemic_attribution_failure"] == 2


def role_pgn(colour):
    return ('[White "Other"]\n[Black "User"]\n\n1. e4 e5 2. Nf3 Nc6 *' if colour == "black" else TRANSPOSE_A)


def test_three_repertoire_roles_remain_separate():
    games = [canonical_game("w1"), canonical_game("w2", TRANSPOSE_B)]
    sources = [correction()]
    for role, opening_id in (("black_vs_e4", "open-game"), ("black_vs_d4", "queens-pawn")):
        for index in range(2):
            games.append(canonical_game(f"{role}-{index}", role_pgn("black"), role=role, opening_id=opening_id, colour="black"))
    result = build(games, sources)
    assert result["candidates"][0]["role"] == "white_repertoire"
    assert {row["role"] for row in result["excludedCandidates"]} == {"black_vs_e4", "black_vs_d4"}


def test_tie_break_uses_stable_candidate_key_after_confidence_count_and_date():
    other_pgn_a = '[White "User"]\n[Black "Other"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 *'
    other_pgn_b = '[White "User"]\n[Black "Other"]\n\n1. Nf3 Nc6 2. e4 e5 3. Bc4 Nf6 4. d3 *'
    other_fen = position_before_fourth_move(other_pgn_a)
    games = [canonical_game("q1"), canonical_game("q2", TRANSPOSE_B), canonical_game("i1", other_pgn_a, opening_id="italian"), canonical_game("i2", other_pgn_b, opening_id="italian")]
    sources = [correction(), correction(fen=other_fen, move="O-O", opening_id="italian", source="opening_reference_line", provenance="pack italian-1")]
    result = build(games, sources)
    keys = [row["candidateKey"] for row in result["candidates"]]
    shuffled = list(games); random.Random(7).shuffle(shuffled)
    assert [row["candidateKey"] for row in build(shuffled, reversed(sources))["candidates"]] == keys


def test_300_trusted_game_reconciliation_fixture_balances_exactly():
    games = []
    for index in range(100):
        games.append(canonical_game(f"white-{index}", TRANSPOSE_A if index % 2 == 0 else TRANSPOSE_B, role="white_repertoire"))
        games.append(canonical_game(f"e4-{index}", role_pgn("black"), role="black_vs_e4", opening_id="open-game", colour="black"))
        games.append(canonical_game(f"d4-{index}", role_pgn("black"), role="black_vs_d4", opening_id="queens-pawn", colour="black"))
    games.extend([dict(games[0]), dict(games[1]), canonical_game("untrusted-extra", trusted=False)])
    result = build(reversed(games), [correction()])
    accounting = result["accounting"]
    assert accounting == {
        "canonicalRecordsReceived": 303,
        "uniqueCanonicalRecords": 301,
        "recordsWithoutIdentity": 0,
        "eligibleAttributedRecords": 300,
        "excludedRecords": 1,
        "duplicateIdentities": 2,
        "positionsExamined": accounting["positionsExamined"],
        "repeatedPositionGroups": accounting["repeatedPositionGroups"],
        "candidatesGenerated": 1,
        "candidatesExcluded": len(result["excludedCandidates"]),
    }
    assert accounting["positionsExamined"] > 0
    assert accounting["repeatedPositionGroups"] >= 3
    assert result["candidates"][0]["evidenceCount"] == 100
    assert accounting["uniqueCanonicalRecords"] == accounting["eligibleAttributedRecords"] + accounting["excludedRecords"]
    assert accounting["canonicalRecordsReceived"] == accounting["uniqueCanonicalRecords"] + accounting["duplicateIdentities"] + accounting["recordsWithoutIdentity"]
    assert accounting["candidatesExcluded"] == sum(result["exclusionReasons"].get(code, 0) for code in {reason for row in result["excludedCandidates"] for reason in row["reasonCodes"]})
