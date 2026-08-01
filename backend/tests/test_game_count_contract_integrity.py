import pytest

from intelligence import enrich_analysis_result
from main import (
    build_game_count_summary,
    classified_game_pipeline_counts,
    demo_profile,
    game_identity,
    game_count_report_aliases,
    validate_game_count_contract,
)


STAGES = (
    "gamesFetched", "eligible", "gamesPgnAvailable", "gamesParsed",
    "gamesAttributed", "gamesClassified", "gamesUsedForOpeningStats",
)


def assert_contract(payload):
    counts = payload["gameCounts"]
    validate_game_count_contract(counts)
    values = [counts[key] for key in STAGES]
    assert all(isinstance(value, int) and value >= 0 for value in values)
    assert all(left >= right for left, right in zip(values, values[1:]))
    assert counts["gamesExcluded"] == values[0] - values[-1]
    assert sum(counts["exclusionReasons"].values()) == counts["gamesExcluded"]
    return counts


def test_impossible_used_total_fails_instead_of_clamping_24_to_30():
    with pytest.raises(ValueError, match="invalid stage inputs"):
        build_game_count_summary(24, 24, {}, structurally_usable=24, used_for_opening_stats=30)


def test_duplicate_canonical_records_count_once():
    record = {
        "gameId": "same-game", "pgn": "1. e4 e5", "moves": ["e4", "e5"],
        "classificationPly": 2, "playerColour": "white", "playerRole": "white_repertoire",
        "relationship": "played_by_user", "openingFamily": "Open Game", "exclusionReason": None,
    }
    assert classified_game_pipeline_counts([record, dict(record)])["usedForOpeningStats"] == 1


def test_fallback_identity_uses_platform_players_timestamp_and_game_text():
    base = {
        "white": {"username": "FixtureWhite"}, "black": {"username": "FixtureBlack"},
        "end_time": 1785585600, "pgn": "1. e4 e5 2. Nf3 Nc6",
    }
    identity = game_identity(base, "chess.com")
    assert identity.startswith("pgn-")
    assert identity == game_identity(dict(base), "chess.com")
    assert identity != game_identity({**base, "end_time": 1785585601}, "chess.com")
    assert identity != game_identity({**base, "black": {"username": "OtherBlack"}}, "chess.com")


def test_recorded_stage_reason_must_match_the_measured_gap_exactly():
    counts = build_game_count_summary(
        1, 0, {"attributionFailed": 1}, structurally_usable=1,
        pgn_available=1, parsed=1, attributed=0, used_for_opening_stats=0,
    )
    assert counts["exclusionReasons"]["attributionFailed"] == 1
    with pytest.raises(ValueError, match="does not match stage gap"):
        build_game_count_summary(
            2, 0, {"attributionFailed": 1}, structurally_usable=2,
            pgn_available=2, parsed=2, attributed=0, used_for_opening_stats=0,
        )


def test_missing_pgn_and_unknown_attribution_each_receive_one_primary_reason():
    missing = build_game_count_summary(
        1, 0, {"missingPgnMoves": 1}, structurally_usable=0,
        pgn_available=0, parsed=0, attributed=0, used_for_opening_stats=0,
    )
    assert missing["exclusionReasons"]["missingPgnMoves"] == 1
    assert sum(missing["exclusionReasons"].values()) == 1

    unattributed = build_game_count_summary(
        1, 0, {}, structurally_usable=1, pgn_available=1, parsed=1,
        attributed=0, used_for_opening_stats=0,
    )
    assert unattributed["exclusionReasons"]["attributionFailed"] == 1
    assert sum(unattributed["exclusionReasons"].values()) == 1


def test_public_aliases_are_assigned_from_the_same_contract_values():
    counts = build_game_count_summary(8, 6, {"unsupportedTimeControl": 1}, structurally_usable=7, used_for_opening_stats=6)
    aliases = game_count_report_aliases(counts)
    assert aliases["gamesImported"] == aliases["gamesFound"] == counts["gamesFetched"]
    assert aliases["gamesAnalysed"] == aliases["gamesAnalyzed"] == counts["gamesParsed"]
    assert aliases["gamesClassified"] == aliases["games_classified"] == counts["gamesClassified"]
    assert aliases["gamesUsedForFit"] == aliases["games_used_for_fit"] == counts["gamesUsedForOpeningStats"]
    assert aliases["gamesExcluded"] == aliases["games_excluded"] == counts["gamesExcluded"]


def test_fetched_count_is_unique_and_duplicate_removals_are_diagnostic_only():
    raw = [
        {"url": "same", "pgn": "1. e4 e5"},
        {"url": "same", "pgn": "1. e4 e5"},
        {"url": "other", "pgn": "1. d4 d5"},
    ]
    from main import deduplicate_games
    unique, removed = deduplicate_games(raw, "chess.com")
    counts = build_game_count_summary(
        len(unique), len(unique), {}, structurally_usable=len(unique),
        used_for_opening_stats=len(unique), duplicate_games_removed=removed,
    )
    assert counts["gamesFetched"] == 2
    assert counts["gamesExcluded"] == 0
    assert counts["duplicateGamesRemoved"] == 1
    assert counts["exclusionReasons"]["duplicate"] == 0
    with pytest.raises(ValueError, match="removed before fetched"):
        build_game_count_summary(3, 2, {"duplicate": 1}, structurally_usable=2)


def test_demo_has_one_fully_reconciled_24_game_funnel_and_primary_opening_total():
    payload = enrich_analysis_result(demo_profile(), username="DemoPlayer", platform="demo")
    counts = assert_contract(payload)
    assert [counts[key] for key in STAGES] == [24] * len(STAGES)
    assert counts["gamesExcluded"] == 0
    assert sum(int(item.get("games", 0) or 0) for item in payload["best_openings"]) == 24
    assert len({game["gameId"] for game in payload["analysis_game_index"]}) == 24
    assert payload["gamesWithPgn"] == len([game for game in payload["analysis_game_index"] if game.get("pgn")]) == 24
    assert payload["analysisConfidence"] == payload["data_quality"]["confidence"] == "medium"
    assert payload["style_fingerprint"]["method"] == "demo_precomputed_traits_v1"
    assert next(item for item in payload["opening_recommendations"]["black_vs_e4"] if item["name"] == "Caro-Kann Defence")["games"] == 0


def test_pgn_derived_style_method_is_downgraded_when_no_pgn_evidence_exists():
    counts = build_game_count_summary(
        1, 0, {"missingPgnMoves": 1}, structurally_usable=0,
        pgn_available=0, parsed=0, attributed=0, used_for_opening_stats=0,
    )
    payload = enrich_analysis_result({
        **game_count_report_aliases(counts),
        "style_fingerprint": {"method": "deterministic_pgn_heuristics_v1", "confidence": "strong"},
        "top_openings": [],
    })
    assert payload["gamesWithPgn"] == 0
    assert payload["style_fingerprint"]["method"] == "insufficient_move_evidence"
    assert payload["style_fingerprint"]["confidence"] == "low"


def test_contract_validator_rejects_opening_aggregate_inflation():
    counts = build_game_count_summary(24, 24, {}, structurally_usable=24, used_for_opening_stats=24)
    with pytest.raises(ValueError, match="opening-stat total 30 differs from used 24"):
        validate_game_count_contract(counts, opening_stat_games=30)


def test_enrichment_downgrades_an_impossible_stored_v4_contract():
    payload = enrich_analysis_result({
        "gamesImported": 24,
        "gameCounts": {
            "contractVersion": 4, "gamesFetched": 24, "eligible": 24,
            "gamesPgnAvailable": 0, "gamesParsed": 0, "gamesAttributed": 0,
            "gamesClassified": 30, "gamesUsedForOpeningStats": 30,
            "gamesExcluded": 0, "exclusionReasons": {},
        },
        "style_fingerprint": {"method": "deterministic_pgn_heuristics_v1", "confidence": "strong"},
    })
    assert payload["gameCountContractStatus"] == "invalid_current_contract"
    assert payload["data_quality"]["usable_games"] is None
    assert payload["analysisConfidence"] == payload["data_quality"]["confidence"] == "low"
    assert payload["style_fingerprint"]["method"] == "insufficient_move_evidence"
