from analysis.classified_game import (
    build_classified_game_record,
    opening_context_key,
    record_is_classified,
    record_is_used_for_opening_stats,
)
from analysis.opening_perspective import classify_opening_perspective, player_colour_from_names
from analysis.report_decision import _matching_games, build_repertoire_coverage_score, build_repertoire_roles
from main import (
    ANALYSIS_GAME_LIMIT,
    build_game_count_summary,
    chesscom_skip_reason,
    deduplicate_games,
)
from opening_detection import detect_opening


def classified_record(moves, *, username="FixturePlayer", white="FixturePlayer", black="Opponent", tagged=""):
    colour, reason = player_colour_from_names(username, white, black)
    detection = detect_opening(moves, tagged_opening=tagged)
    perspective = classify_opening_perspective(
        user_colour=colour,
        opening_side=detection.get("openingSide"),
        first_white_move=moves[0] if moves else "",
    )
    record = build_classified_game_record(
        game_id=f"game-{white}-{black}-{'-'.join(moves[:4])}",
        url="https://example.test/game",
        player_colour=colour,
        player_result="win",
        time_control="rapid",
        played_at="2026-08-01T12:00:00+00:00",
        eco=None,
        opening_family=detection["opening"],
        variation=tagged or None,
        classification_ply=len(detection["movesAnalysed"]),
        perspective=perspective,
    )
    return record, perspective, reason


def test_scandinavian_and_french_are_attributed_from_player_names_not_opening_name():
    scandi_black, scandi_black_perspective, _ = classified_record(
        ["e4", "d5", "exd5", "Qxd5"], white="Opponent", black="FixturePlayer"
    )
    scandi_white, scandi_white_perspective, _ = classified_record(
        ["e4", "d5", "exd5", "Qxd5"]
    )
    french_black, french_black_perspective, _ = classified_record(
        ["e4", "e6", "d4", "d5"], white="Opponent", black="FixturePlayer"
    )
    french_white, french_white_perspective, _ = classified_record(["e4", "e6", "d4", "d5"])

    assert (scandi_black["playerColour"], scandi_black["playerRole"], scandi_black["relationship"]) == (
        "black", "black_vs_e4", "played_by_user"
    )
    assert (french_black["playerColour"], french_black["playerRole"], french_black["relationship"]) == (
        "black", "black_vs_e4", "played_by_user"
    )
    assert (scandi_white["playerColour"], scandi_white["playerRole"], scandi_white["relationship"]) == (
        "white", "white_repertoire", "faced_by_user"
    )
    assert (french_white["playerColour"], french_white["playerRole"], french_white["relationship"]) == (
        "white", "white_repertoire", "faced_by_user"
    )
    assert scandi_black_perspective["relationship"] == french_black_perspective["relationship"] == "played"
    assert scandi_white_perspective["relationship"] == french_white_perspective["relationship"] == "faced"
    assert len({opening_context_key(scandi_black), opening_context_key(scandi_white)}) == 2


def test_duplicate_records_and_transposed_aliases_have_deterministic_canonical_contexts():
    games = [
        {"pgn": '[White "A"]\n[Black "B"]\n\n1. d4 Nf6'},
        {"pgn": '[White "A"]\n[Black "B"]\n\n1. d4 Nf6'},
    ]
    unique, duplicates = deduplicate_games(games, "chess.com")
    assert len(unique) == 1
    assert duplicates == 1

    first, _, _ = classified_record(
        ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"],
        white="Opponent",
        black="FixturePlayer",
        tagged="King's Indian Defense: Fianchetto Variation",
    )
    transposed, _, _ = classified_record(
        ["d4", "g6", "c4", "Bg7", "Nc3", "Nf6"],
        white="Opponent",
        black="FixturePlayer",
        tagged="King's Indian Defence: Normal Variation",
    )
    assert first["openingFamily"] == transposed["openingFamily"] == "King's Indian Defence"
    assert opening_context_key(first) == opening_context_key(transposed)
    aggregates = {}
    for record in (first, transposed):
        aggregate = aggregates.setdefault(opening_context_key(record), set())
        aggregate.add(record["gameId"])
    assert len(aggregates) == 1
    assert len(next(iter(aggregates.values()))) == 2


def test_unknown_colour_and_incomplete_game_do_not_enter_opening_stats():
    record, perspective, reason = classified_record(
        ["e4", "d5", "exd5", "Qxd5"], username="Missing", white="White", black="Black"
    )
    assert reason == "analysed_username_not_found"
    assert perspective["role"] == "unknown_mixed"
    assert record["playerColour"] == "unknown"
    assert record["playerRole"] == "unknown"
    assert not record_is_used_for_opening_stats(record)
    assert chesscom_skip_reason({
        "rules": "chess",
        "pgn": "1. e4 e5",
        "white": {"result": "abandoned"},
        "black": {"result": "abandoned"},
    }) == "abandoned"


def test_counts_reconcile_structural_classification_and_analysis_cap():
    summary = build_game_count_summary(
        314,
        280,
        {"analysisLimit": 14, "incompleteGame": 19},
        structurally_usable=281,
        used_for_opening_stats=279,
        analysis_candidates=300,
        analysis_limit=ANALYSIS_GAME_LIMIT,
    )
    assert summary["gamesFetched"] == 314
    assert summary["gamesStructurallyUsable"] == 281
    assert summary["gamesUsedForOpeningStats"] == 279
    assert summary["gamesUsedForOpeningStats"] <= summary["gamesClassified"]
    assert sum(summary["exclusionReasons"].values()) == summary["gamesExcluded"] == 35


def test_complete_analysis_index_prevents_large_sample_from_becoming_insufficient():
    perspective = classify_opening_perspective(
        user_colour="black", opening_side="black", first_white_move="e4"
    )
    item = {"name": "Scandinavian Defence", "games": 78, "perspective": perspective}
    complete = [
        {
            "gameId": f"scandi-{index}",
            "opening": "Scandinavian Defence",
            "result": "win",
            "perspective": perspective,
        }
        for index in range(78)
    ]
    report = {"opening_games": complete[:3], "analysis_game_index": complete}
    matched = _matching_games(report, item)
    assert len(matched) == 78
    assert len({game["gameId"] for game in matched}) == 78


def test_faced_openings_never_fill_a_player_repertoire_role():
    played = classify_opening_perspective(
        user_colour="black", opening_side="black", first_white_move="e4"
    )
    faced = classify_opening_perspective(
        user_colour="white", opening_side="black", first_white_move="e4"
    )
    report = {"analysis_game_index": [
        {"gameId": f"played-{index}", "opening": "Scandinavian Defence", "result": "win", "perspective": played}
        for index in range(8)
    ] + [
        {"gameId": f"faced-{index}", "opening": "Scandinavian Defence", "result": "loss", "perspective": faced}
        for index in range(94)
    ]}
    recommendation = {
        "openingName": "Scandinavian Defence",
        "repertoireOwned": True,
        "repertoireRole": "black_vs_e4",
        "verdict": "keep",
        "confidence": {"level": "medium"},
        "sample": {"games": 8, "gameIds": [f"played-{index}" for index in range(8)]},
        "validation": {"valid": True},
    }
    roles = build_repertoire_roles([recommendation], report)
    black_e4 = next(role for role in roles if role["repertoireRole"] == "black_vs_e4")
    white = next(role for role in roles if role["repertoireRole"] == "white")
    assert black_e4["supportingGameCount"] == 8
    assert black_e4["status"] == "established"
    assert white["supportingGameCount"] == 0
    assert all(not game_id.startswith("faced-") for game_id in black_e4["evidenceGameIds"])


def test_large_scandinavian_black_sample_establishes_the_role_and_coverage_uses_it():
    played = classify_opening_perspective(user_colour="black", opening_side="black", first_white_move="e4")
    faced = classify_opening_perspective(user_colour="white", opening_side="black", first_white_move="e4")
    played_ids = [f"scandi-black-{index}" for index in range(78)]
    report = {"analysis_game_index": [
        {"gameId": game_id, "opening": "Scandinavian Defence", "result": "draw", "perspective": played}
        for game_id in played_ids
    ] + [
        {"gameId": f"scandi-faced-{index}", "opening": "Scandinavian Defence", "result": "loss", "perspective": faced}
        for index in range(94)
    ]}
    recommendation = {
        "openingName": "Scandinavian Defence", "repertoireOwned": True,
        "repertoireRole": "black_vs_e4", "verdict": "keep",
        "confidence": {"level": "high"},
        "sample": {"games": 78, "gameIds": played_ids}, "validation": {"valid": True},
    }
    roles = build_repertoire_roles([recommendation], report)
    black_e4 = next(role for role in roles if role["key"] == "black_e4")
    white = next(role for role in roles if role["key"] == "white")
    assert (black_e4["status"], black_e4["supportingGameCount"]) == ("established", 78)
    assert white["supportingGameCount"] == 0
    coverage = build_repertoire_coverage_score(roles)
    assert coverage["formulaVersion"] == "repertoire_coverage_v3"
    assert coverage["weightsTotal"] == 100
    assert coverage["score"] == round(sum(row["contribution"] for row in coverage["components"]), 2)
    black_score = next(row for row in coverage["roleScores"] if row["key"] == "black_e4")
    assert black_score["topOpeningShare"] == 100
    assert black_score["roleGames"] == 78
    assert black_score["scattered"] is False


def test_duplicate_kings_indian_context_uses_each_game_once():
    played = classify_opening_perspective(user_colour="black", opening_side="black", first_white_move="d4")
    games = [
        {"gameId": f"kid-{index}", "opening": "King's Indian Defence", "result": "draw", "perspective": played}
        for index in range(9)
    ]
    report = {"analysis_game_index": games + games[:7]}
    roles = build_repertoire_roles([], report)
    black_d4 = next(role for role in roles if role["key"] == "black_d4")
    assert black_d4["evidenceFunnel"]["openingBreakdown"] == [{"openingName": "King's Indian Defence", "games": 9, "gameIds": [f"kid-{index}" for index in range(9)]}]


def test_excluded_canonical_record_preserves_reason_without_becoming_classified_usage():
    perspective = classify_opening_perspective(
        user_colour="black", opening_side="black", first_white_move="e4"
    )
    record = build_classified_game_record(
        game_id="abandoned-1",
        url="",
        player_colour="black",
        player_result="unknown",
        time_control="rapid",
        played_at=None,
        eco=None,
        opening_family="Unclassified opening",
        variation=None,
        classification_ply=None,
        perspective=perspective,
        exclusion_reason="incompleteGame",
    )
    assert record["exclusionReason"] == "incompleteGame"
    assert not record_is_classified(record)
    assert not record_is_used_for_opening_stats(record)
