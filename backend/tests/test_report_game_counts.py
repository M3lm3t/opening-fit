from main import (
    ANALYSIS_EVIDENCE_GAME_LIMIT,
    ANALYSIS_GAME_LIMIT,
    build_game_count_summary,
    compact_analysis_result,
    chesscom_skip_reason,
    deduplicate_games,
    filter_games_by_time_control,
    lichess_skip_reason,
)


def assert_invariants(summary):
    assert summary["excludedGames"] == summary["fetchedGames"] - summary["analysedGames"]
    assert sum(summary["exclusionReasons"].values()) == summary["excludedGames"]
    assert summary["analysedGames"] <= summary["analysisCandidateGames"]
    assert summary["usableOpeningSignals"] <= summary["analysedGames"]


def test_report_game_counts_reconcile_with_exclusions():
    summary = build_game_count_summary(20, 14, {"bullet": 2, "missingOpening": 3, "veryShort": 1})
    assert summary["fetchedGames"] == 20
    assert summary["timeControlEligibleGames"] == 18
    assert summary["analysedGames"] == 14
    assert summary["excludedGames"] == 6
    assert_invariants(summary)


def test_analysis_limit_is_a_real_exclusion_not_the_evidence_payload_limit():
    summary = build_game_count_summary(
        307, 280, {"analysisLimit": 7, "missingOpening": 20},
        analysis_candidates=300, analysis_limit=ANALYSIS_GAME_LIMIT,
    )
    assert summary["analysisCandidateGames"] == 300
    assert summary["analysisLimit"] == 300
    assert summary["exclusionReasons"]["analysisLimit"] == 7
    assert_invariants(summary)

    games = [{"url": f"g-{index}", "opening": "French Defence", "end_time": index} for index in range(280)]
    compact = compact_analysis_result({"opening_games": games, "gameCounts": summary})
    assert len(compact["opening_games"]) == ANALYSIS_EVIDENCE_GAME_LIMIT
    assert len(compact["analysis_game_index"]) == 280
    assert compact["gameCounts"]["analysedGames"] == 280


def test_time_control_filter_and_duplicate_detection_are_applied_before_selection():
    games = [
        {"url": "a", "time_class": "rapid"},
        {"url": "a", "time_class": "rapid"},
        {"url": "b", "time_class": "blitz"},
    ]
    rapid, mismatch = filter_games_by_time_control(games, "chess.com", "rapid")
    unique, duplicates = deduplicate_games(rapid, "chess.com")
    assert (len(rapid), mismatch, len(unique), duplicates) == (2, 1, 1, 1)
    unfiltered, mismatch = filter_games_by_time_control(games, "chess.com", "custom")
    assert len(unfiltered) == 3 and mismatch == 0


def test_lichess_time_control_filter_uses_platform_speed_metadata():
    games = [{"id": "a", "speed": "rapid"}, {"id": "b", "speed": "bullet"}]
    filtered, mismatch = filter_games_by_time_control(games, "lichess", "rapid")
    assert [game["id"] for game in filtered] == ["a"]
    assert mismatch == 1


def test_no_usable_games_reconciles_under_missing_or_other_reasons():
    summary = build_game_count_summary(2, 0, {"outsideWindow": 1, "missingOpening": 1})
    assert summary["exclusionReasons"]["outsideDateRange"] == 1
    assert summary["exclusionReasons"]["missingOpeningSignal"] == 1
    assert_invariants(summary)


def test_fewer_than_limit_has_no_limit_exclusion_and_incomplete_games_are_classified():
    summary = build_game_count_summary(12, 12, {}, analysis_candidates=12, analysis_limit=ANALYSIS_GAME_LIMIT)
    assert summary["exclusionReasons"]["analysisLimit"] == 0
    assert_invariants(summary)
    assert chesscom_skip_reason({"rules": "chess", "pgn": "1. e4 e5", "white": {"result": "resigned"}, "black": {"result": "win"}}) == "oneMoveResignation"
    assert lichess_skip_reason({"variant": {"key": "standard"}, "moves": "e4 e5", "status": "resign", "winner": "black"}) == "oneMoveResignation"
