import pytest

from analysis.classified_game import (
    build_classified_game_record,
    canonical_player_result,
    opening_context_key,
    record_is_classified,
    record_is_used_for_opening_stats,
)
from analysis.opening_perspective import attribution_diagnostic, classify_opening_perspective, first_white_move_from_item, player_colour_from_game, player_colour_from_names, validate_repertoire_role_for_game
from analysis.report_decision import _matching_games, build_repertoire_coverage_score, build_repertoire_roles
from main import (
    ANALYSIS_GAME_LIMIT,
    build_game_import_quality,
    build_game_count_summary,
    build_role_evidence_accounting,
    chesscom_skip_reason,
    deduplicate_games,
    opening_item,
    result_for_user,
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
        classification_ply=detection["matchedPlyDepth"],
        perspective=perspective,
        canonical_opening_id=detection["canonicalOpeningId"],
        classification_source=detection["classificationSource"],
        matched_opening_rule_id=detection["matchedOpeningRuleId"],
        matched_moves=detection["matchedMoves"],
        classification_confidence=detection["classificationConfidence"],
        first_white_move=moves[0] if moves else None,
        first_black_move=moves[1] if len(moves) > 1 else None,
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
    assert scandi_black["canonicalContextId"].endswith(":black:played_by_user:black_vs_e4")
    assert scandi_black["matchedOpeningRuleId"]
    assert scandi_black["matchedMoves"] == ["e4", "d5"]


def test_username_matching_is_case_insensitive_and_unicode_normalised():
    assert player_colour_from_names("faith", "FAITH", "Opponent") == ("white", None)
    assert player_colour_from_names("Faith", "Opponent", "Ｆａｉｔｈ") == ("black", None)


def test_first_move_survives_headers_comments_variations_move_numbers_and_nags():
    game = {"pgn": '''[Event "Fixture"]
[White "Opponent"]
[Black "Faith"]

{leading note} (1. e4? e5) 1. d4 $1 Nf6 2. c4 *'''}
    assert first_white_move_from_item(game) == "d4"


def test_three_hundred_game_role_accounting_reconciles_without_evidence_loss():
    records = []
    fixtures = [
        ("white", "e4", "white"),
        ("black", "e4", "black_vs_e4"),
        ("black", "d4", "black_vs_d4"),
    ]
    for colour, first_move, expected_role in fixtures:
        perspective = classify_opening_perspective(user_colour=colour, opening_side="white", first_white_move=first_move)
        assert perspective["repertoireRole"] == expected_role
        for index in range(100):
            records.append({
                "gameId": f"{expected_role}-{index}",
                "playerColour": colour,
                "firstWhiteMove": first_move,
                "perspective": perspective,
            })
    accounting = build_role_evidence_accounting(records, {
        "gamesUsedForOpeningStats": 300,
        "gamesParsed": 300,
        "duplicateGamesRemoved": 2,
        "exclusionReasons": {"duplicate": 2, "unsupported": 1},
        "gameReconciliation": {"total_imported": 303, "excluded_total": 3},
    })
    assert accounting["valid"] is True
    assert accounting["roleAttributedGames"] == 300
    assert accounting["whiteGames"] == accounting["blackVsE4Games"] == accounting["blackVsD4Games"] == 100
    assert accounting["importedGames"] == accounting["eligibleGames"] + accounting["excludedGames"]


def test_role_accounting_keeps_legitimate_unclassified_candidates_out_of_the_role_sample():
    records = []
    for index in range(219):
        colour, first_move = (("white", "e4") if index % 2 == 0 else ("black", "d4")) if index < 178 else ("unknown", "")
        records.append({
            "gameId": f"production-shaped-{index}",
            "playerColour": colour,
            "firstWhiteMove": first_move,
            "perspective": classify_opening_perspective(
                user_colour=colour,
                opening_side="white",
                first_white_move=first_move,
            ),
        })
    accounting = build_role_evidence_accounting(records, {
        "analysisCandidateGames": 233,
        "gamesParsed": 219,
        "gamesAttributed": 178,
        "gamesClassified": 178,
        "gamesUsedForOpeningStats": 178,
        "duplicateGamesRemoved": 0,
        "exclusionReasons": {"unclassifiedOpening": 14},
        "gameReconciliation": {"total_imported": 233, "excluded_total": 14},
    })
    assert accounting["valid"] is True
    assert accounting["analysisCandidateGames"] == 233
    assert accounting["eligibleGames"] == 219
    assert accounting["roleAttributedGames"] == 178
    assert accounting["attributionErrors"] == 41
    assert accounting["excludedGames"] == 14


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
                "firstWhiteMove": "e4",
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
            {"gameId": f"played-{index}", "opening": "Scandinavian Defence", "result": "win", "perspective": played, "firstWhiteMove": "e4"}
        for index in range(8)
    ] + [
            {"gameId": f"faced-{index}", "opening": "Scandinavian Defence", "result": "loss", "perspective": faced, "firstWhiteMove": "e4"}
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


def test_jobava_london_cannot_fill_black_against_d4():
    faced = classify_opening_perspective(
        user_colour="black", opening_side="white", first_white_move="d4"
    )
    games = [
        {"gameId": f"jobava-{index}", "opening": "Jobava London System", "result": "loss", "perspective": faced}
        for index in range(12)
    ]
    roles = build_repertoire_roles([], {"analysis_game_index": games})
    black_d4 = next(role for role in roles if role["key"] == "black_d4")

    assert faced["relationship"] == "faced"
    assert black_d4["currentOpening"] is None
    assert black_d4["supportingGameCount"] == 0
    assert black_d4["status"] != "established"


def test_large_scandinavian_black_sample_establishes_the_role_and_coverage_uses_it():
    played = classify_opening_perspective(user_colour="black", opening_side="black", first_white_move="e4")
    faced = classify_opening_perspective(user_colour="white", opening_side="black", first_white_move="e4")
    played_ids = [f"scandi-black-{index}" for index in range(78)]
    report = {"analysis_game_index": [
            {"gameId": game_id, "opening": "Scandinavian Defence", "result": "draw", "perspective": played, "firstWhiteMove": "e4"}
        for game_id in played_ids
    ] + [
            {"gameId": f"scandi-faced-{index}", "opening": "Scandinavian Defence", "result": "loss", "perspective": faced, "firstWhiteMove": "e4"}
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
    assert coverage["formulaVersion"] == "repertoire_health_v2"
    assert coverage["weightsTotal"] == 100
    assert coverage["score"] == pytest.approx(sum(row["contribution"] for row in coverage["components"]), abs=1e-6)
    black_score = next(row for row in coverage["roleScores"] if row["key"] == "black_e4")
    assert black_score["topOpeningShare"] == 100
    assert black_score["roleGames"] == 78
    assert black_score["scattered"] is False


def test_duplicate_kings_indian_context_uses_each_game_once():
    played = classify_opening_perspective(user_colour="black", opening_side="black", first_white_move="d4")
    games = [
        {"gameId": f"kid-{index}", "opening": "King's Indian Defence", "result": "draw", "perspective": played, "firstWhiteMove": "d4"}
        for index in range(9)
    ]
    report = {"analysis_game_index": games + games[:7]}
    roles = build_repertoire_roles([], report)
    black_d4 = next(role for role in roles if role["key"] == "black_d4")
    assert black_d4["evidenceFunnel"]["openingBreakdown"] == [{"openingName": "King's Indian Defence", "games": 9, "gameIds": [f"kid-{index}" for index in range(9)]}]


def test_nimzo_support_is_legal_only_for_black_against_d4():
    game = {"gameId": "nimzo-1", "opening": "Nimzo-Indian Defence", "playerColour": "black", "relationship": "played_by_user", "moves": ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]}
    assert validate_repertoire_role_for_game("black_vs_d4", game) == (True, None)
    assert validate_repertoire_role_for_game("black_vs_e4", game) == (False, "supporting_game_role_mismatch")


@pytest.mark.parametrize("first_move", ["c4", "Nf3", "f4"])
def test_other_first_moves_do_not_leak_into_modelled_black_roles(first_move):
    game = {"playerColour": "black", "relationship": "played_by_user", "firstWhiteMove": first_move}
    assert not validate_repertoire_role_for_game("black_vs_e4", game)[0]
    assert not validate_repertoire_role_for_game("black_vs_d4", game)[0]


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


def test_quality_separates_large_sample_from_incomplete_attribution_and_roles():
    trusted_white = classify_opening_perspective(user_colour="white", opening_side="white", first_white_move="e4")
    unresolved = classify_opening_perspective(user_colour="unknown", opening_side="white", first_white_move="e4")
    games = [
        {"gameId": f"trusted-{index}", "opening": "Vienna Game", "colour": "white", "move_count": 20, "perspective": trusted_white}
        for index in range(60)
    ] + [
        {"gameId": f"unresolved-{index}", "opening": "Scandinavian Defence", "colour": "unknown", "move_count": 20, "perspective": unresolved}
        for index in range(40)
    ]
    quality = build_game_import_quality(games, total_found=100)

    assert quality["sampleSize"]["label"] == "Large"
    assert quality["category"] != "Strong data"
    assert quality["reportCompleteness"]["complete"] is False
    assert quality["metrics"]["correctlyAttributedGames"] == 60
    assert quality["metrics"]["unresolvedContextCount"] == 40
    assert quality["metrics"]["roleCoverageCount"] == 1


@pytest.mark.parametrize(
    ("game", "colour", "expected"),
    [
        ({"result": "1-0"}, "white", "win"),
        ({"result": "1-0"}, "black", "loss"),
        ({"result": "0-1"}, "black", "win"),
        ({"result": "1/2-1/2"}, "white", "draw"),
        ({"winner": "black"}, "white", "loss"),
        ({"white": {"result": "abandoned"}}, "white", "unknown"),
        ({}, "white", "unknown"),
    ],
)
def test_authoritative_player_result_handles_supported_completed_and_unknown_formats(game, colour, expected):
    assert canonical_player_result(game, colour) == expected


def test_chesscom_result_and_score_are_from_the_requested_players_perspective():
    game = {"white": {"username": "Opponent", "result": "checkmated"}, "black": {"username": " Melmet ", "result": "win"}}
    assert result_for_user(game, "MELMET") == "win"
    aggregate = opening_item("Vienna Game", 31, "played_as_white", {"games": 31, "known_results": 30, "wins": 17, "draws": 0, "losses": 13})
    assert aggregate["knownResults"] == 30
    assert aggregate["scoreRate"] == pytest.approx(56.7, abs=0.05)


@pytest.mark.parametrize(
    ("game", "expected"),
    [
        ({"white": {"username": " Melmet "}, "black": {"username": "Other"}}, ("white", None)),
        ({"whiteUsername": "Other", "black_username": "MELMET"}, ("black", None)),
        ({"players": {}, "playerColour": "black"}, ("black", None)),
        ({"players": {"white": {"user": {"name": "Other"}}, "black": {"user": {"id": " MELMET "}}}}, ("black", None)),
        ({"white": {"name": "melmet"}, "black": {"name": "Other"}}, ("white", None)),
        ({"pgn": '[White "Other"]\n[Black " Melmet "]\n\n1. e4 e5'}, ("black", None)),
        ({"white": {"username": "melmet"}, "blackUsername": "MELMET"}, ("unknown", "player_identifier_conflict")),
        ({}, ("unknown", "player_data_missing")),
        ({"white": 7, "black": []}, ("unknown", "player_data_malformed")),
    ],
)
def test_shared_game_username_attribution_handles_platform_and_canonical_shapes(game, expected):
    assert player_colour_from_game("melmet", game) == expected


def test_attribution_diagnostic_contains_only_structural_categories():
    diagnostic = attribution_diagnostic("melmet", {"white": {"username": "Opponent"}, "black": {"username": "Missing"}, "url": "private"}, "chess.com")
    assert diagnostic["failureReasonCode"] == "analysed_username_not_found"
    assert diagnostic["candidateIdentifierCount"] == 2
    assert not ({"username", "opponent", "url", "pgn"} & set(diagnostic))
