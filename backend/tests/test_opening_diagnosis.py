from copy import deepcopy

import chess
import chess.pgn
import io

from analysis.opening_perspective import attach_perspective, classify_opening_perspective
from analysis.report_decision import _build_opening_diagnosis, _parsed_training_game, assert_decision_consistency, build_report_decision


def perspective(colour="white", first_move="d4"):
    return classify_opening_perspective(
        user_colour=colour,
        opening_side=colour,
        first_white_move=first_move,
        classification_source="diagnosis_fixture",
    )


def game(number, moves, *, opening="Queen Pawn Game", colour="white", result="loss", classification_ply=4, game_id=None):
    result_tag = {"win": "1-0", "draw": "1/2-1/2", "loss": "0-1"}[result] if colour == "white" else {"win": "0-1", "draw": "1/2-1/2", "loss": "1-0"}[result]
    white = "FixturePlayer" if colour == "white" else f"Opponent{number}"
    black = "FixturePlayer" if colour == "black" else f"Opponent{number}"
    first_move = moves.split()[1] if moves.startswith("1.") else "d4"
    row = attach_perspective({
        "gameId": game_id or f"diagnosis-{number}",
        "url": f"https://www.chess.com/game/live/diagnosis-{number}",
        "opening": opening,
        "openingFamily": opening,
        "result": result,
        "playerResult": result,
        "playerColour": colour,
        "classificationPly": classification_ply,
        "white_username": white,
        "black_username": black,
        "pgn": f'[Event "Diagnosis fixture"]\n[Site "https://www.chess.com/game/live/diagnosis-{number}"]\n[White "{white}"]\n[Black "{black}"]\n[Result "{result_tag}"]\n\n{moves} {result_tag}',
        "playedAt": f"2026-07-{number:02d}T12:00:00Z",
    }, perspective(colour, first_move))
    return row


def opening(total, *, name="Queen Pawn Game", colour="white", wins=0, draws=0):
    return attach_perspective({
        "name": name, "games": total, "wins": wins, "draws": draws, "losses": total - wins - draws,
    }, perspective(colour))


def decision(games, rows=None):
    return build_report_decision({
        "analysisId": "diagnosis-report", "platform": "chess.com", "username": "FixturePlayer",
        "gamesAnalysed": len(games), "importedAt": "2026-07-30T12:00:00Z",
        "opening_games": games, "analysis_game_index": games,
    }, openings=rows or [opening(len(games))])


def normalized_fen(fen):
    return " ".join(fen.split()[:4])


def direct_diagnosis(games):
    report = {
        "analysisId": "diagnosis-report", "username": "FixturePlayer", "platform": "chess.com",
        "opening_games": games, "analysis_game_index": games,
    }
    target = {
        "decisionId": "decision:diagnosis-report:queen-pawn", "openingName": "Queen Pawn Game",
        "role": "played_as_white", "repertoireRole": "white", "playerColour": "white", "relationship": "played",
    }
    return _build_opening_diagnosis(target, report, [row["gameId"] for row in games])


def test_repeated_player_turn_position_builds_one_canonical_diagnosis():
    games = [
        game(1, "1. d4 d5 2. Nf3 Nf6 3. e3 e6"),
        game(2, "1. d4 d5 2. Nf3 Nf6 3. c4 e6"),
        game(3, "1. d4 d5 2. Nf3 Nf6 3. e3 c5"),
        game(4, "1. d4 d5 2. Nf3 Nf6 3. c4 c5"),
        game(5, "1. d4 d5 2. Nf3 Nf6 3. Bg5 e6"),
    ]
    report = decision(games)
    diagnosis = report["openingDiagnosis"]

    assert report["primaryAction"]["opening"] == "Queen Pawn Game"
    assert diagnosis["version"] == "opening_diagnosis_v1"
    assert diagnosis["method"] == "legal_pgn_normalised_position_v1"
    assert diagnosis["precisionLevel"] == "exact_position"
    assert diagnosis["playerToMove"] == "white"
    assert diagnosis["targetPly"] == 4
    assert diagnosis["targetMoveNumber"] == 3
    assert len(diagnosis["supportingGameIds"]) == 5
    assert {row["move"] for row in [diagnosis["repeatedContinuation"], *diagnosis["alternativeContinuations"]]} == {"e3", "c4", "Bg5"}
    assert diagnosis["objectiveMoveClaimed"] is False
    assert report["trainingPriority"]["diagnosisId"] == report["primaryAction"]["diagnosisId"] == diagnosis["diagnosisId"]
    assert report["trainingPriority"]["expectedMoves"] == []
    assert_decision_consistency(report)


def test_only_selected_opening_role_games_are_diagnosed_and_duplicates_count_once():
    selected = [game(i, f"1. d4 d5 2. Nf3 Nf6 3. {'e3' if i % 2 else 'c4'} e6") for i in range(1, 6)]
    unrelated = [game(7, "1. e4 c6 2. d4 d5 3. Nc3 Nf6", opening="Caro-Kann Defence")]
    payload = [*selected, selected[0], *unrelated]
    report = decision(payload, [opening(5), opening(1, name="Caro-Kann Defence", wins=1)])
    diagnosis = report["openingDiagnosis"]

    assert set(diagnosis["supportingGameIds"]) == {f"diagnosis-{i}" for i in range(1, 6)}
    assert diagnosis["gamesConsidered"] == 5
    assert all("diagnosis-7" not in value for value in diagnosis["supportingGameIds"])


def test_transpositions_group_by_legal_position_not_move_order():
    games = [
        game(1, "1. Nf3 d5 2. d4 Nf6 3. e3 e6"),
        game(2, "1. d4 Nf6 2. Nf3 d5 3. c4 e6"),
        game(3, "1. Nf3 d5 2. d4 Nf6 3. c4 e6"),
        game(4, "1. d4 Nf6 2. Nf3 d5 3. e3 e6"),
        game(5, "1. d4 Nf6 2. Nf3 d5 3. Bg5 e6"),
    ]
    diagnosis = decision(games)["openingDiagnosis"]

    assert diagnosis["precisionLevel"] == "exact_position"
    assert diagnosis["commonMovePrefix"]["san"] is None
    assert len(diagnosis["supportingGameIds"]) == 5


def test_fen_identity_ignores_clocks_but_preserves_castling_and_en_passant():
    parsed = _parsed_training_game(game(1, "1. Nf3 Nf6 2. Rg1 Rg8 3. Rh1 Rh8 4. d3 d6", classification_ply=1))
    assert parsed
    lost_rights = parsed["positions"][6]["key"]
    same_with_other_clocks = " ".join(parsed["positions"][6]["fen"].split()[:4] + ["99", "42"])
    assert lost_rights == normalized_fen(same_with_other_clocks)
    untouched = chess.Board().fen()
    assert lost_rights != normalized_fen(untouched)

    board = chess.Board("8/8/8/8/3pP3/8/8/4K2k b - e3 0 1")
    without_ep = "8/8/8/8/3pP3/8/8/4K2k b - - 0 1"
    assert normalized_fen(board.fen(en_passant="fen")) != normalized_fen(without_ep)


def test_same_board_with_different_castling_rights_is_not_merged():
    lost = [game(i, f"1. Nf3 Nf6 2. Rg1 Rg8 3. Rh1 Rh8 4. {'e3' if i % 2 else 'c4'} e6", classification_ply=6) for i in range(1, 4)]
    intact = [game(i, f"1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. {'e3' if i % 2 else 'c4'} e6", classification_ply=6) for i in range(4, 6)]
    diagnosis = direct_diagnosis([*lost, *intact])

    assert diagnosis["precisionLevel"] == "exact_position"
    assert set(diagnosis["supportingGameIds"]) == {"diagnosis-1", "diagnosis-2", "diagnosis-3"}


def test_one_game_missing_and_corrupt_pgn_fall_back_without_precision_or_engine_claims():
    single = direct_diagnosis([game(1, "1. d4 d5 2. Nf3 Nf6 3. e3")])
    assert single["precisionLevel"] == "opening"
    assert single["fallbackUsed"] is True
    assert single["positionFen"] is None

    missing = game(1, "1. d4 d5 2. Nf3 Nf6 3. e3")
    missing.pop("pgn")
    corrupt = deepcopy(missing)
    corrupt["gameId"] = "corrupt"
    corrupt["pgn"] = "[White \"FixturePlayer\"]\n\n1. d4 d5 2. Nf3 ???"
    fallback = direct_diagnosis([missing, corrupt])
    assert fallback["precisionLevel"] == "insufficient_evidence"
    assert fallback["supportingGameIds"] == []
    assert fallback["engineAnalysisUsed"] is False
    assert "best" not in fallback["userFacingDiagnosis"].lower()


def test_claimed_fen_reproduces_from_every_supporting_pgn_and_selection_is_deterministic():
    games = [game(i, f"1. d4 d5 2. Nf3 Nf6 3. {'e3' if i % 2 else 'c4'} e6") for i in range(1, 6)]
    first = decision(games)["openingDiagnosis"]
    second = decision(list(reversed(games)))["openingDiagnosis"]
    assert first == second
    by_id = {row["gameId"]: row for row in games}
    for game_id in first["supportingGameIds"]:
        parsed = chess.pgn.read_game(io.StringIO(by_id[game_id]["pgn"]))
        board = parsed.board()
        for index, move in enumerate(parsed.mainline_moves()):
            if index >= first["targetPly"]:
                break
            board.push(move)
        assert normalized_fen(board.fen()) == first["positionKey"]


def test_exact_matching_catalogue_continuation_is_legal_and_source_labelled():
    games = [game(i, f"1. d4 d5 2. Nf3 Nf6 3. {'e3' if i % 2 else 'c4'} e6") for i in range(1, 6)]
    baseline = direct_diagnosis(games)
    report = {
        "analysisId": "diagnosis-report", "username": "FixturePlayer", "platform": "chess.com",
        "opening_games": games, "analysis_game_index": games,
        "openingTrainingOpportunities": [{
            "openingId": "queen-pawn-game", "side": "white", "source": "opening_reference_line",
            "positionFen": baseline["positionFen"], "recommendedMove": "c4",
        }],
    }
    target = {
        "decisionId": "decision:diagnosis-report:queen-pawn", "openingName": "Queen Pawn Game",
        "role": "played_as_white", "repertoireRole": "white", "playerColour": "white", "relationship": "played",
    }
    diagnosis = _build_opening_diagnosis(target, report, [row["gameId"] for row in games])

    assert diagnosis["authoritativeContinuation"] == {
        "move": "c4", "source": "opening_reference_line", "sourceLabel": "existing opening catalogue",
    }
    assert diagnosis["continuationSource"] == "opening_reference_line"
    assert "existing opening catalogue" in diagnosis["trainingTask"]
    assert diagnosis["objectiveMoveClaimed"] is False


def test_diagnosis_does_not_change_primary_choice_or_repertoire_health():
    games = [game(i, f"1. d4 d5 2. Nf3 Nf6 3. {'e3' if i % 2 else 'c4'} e6") for i in range(1, 6)]
    without_pgn = [{key: value for key, value in row.items() if key != "pgn"} for row in games]
    precise = decision(games)
    broad = decision(without_pgn)
    assert precise["primaryAction"]["opening"] == broad["primaryAction"]["opening"] == "Queen Pawn Game"
    assert precise["primaryAction"]["repertoireRole"] == broad["primaryAction"]["repertoireRole"] == "white"
    assert precise["repertoireHealth"]["score"] == broad["repertoireHealth"]["score"]
