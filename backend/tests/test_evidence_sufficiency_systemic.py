from analysis.evidence_hierarchy import build_evidence_hierarchy
from main import build_game_count_summary, build_role_evidence_accounting, enrich_game_reconciliation


def evidence_game(game_id, *, colour="white", role="white", family="vienna", opening="vienna-game", position="", played_at="2026-08-01T12:00:00Z", trusted=True):
    first = "e4" if role == "black_vs_e4" else "d4" if role == "black_vs_d4" else "e4"
    return {
        "gameId": game_id, "playerColour": colour, "firstWhiteMove": first,
        "canonicalOpeningId": opening, "canonicalOpeningFamilyId": family,
        "canonicalPositionId": position or None, "playedAt": played_at,
        "perspective": {"userColour": colour, "repertoireRole": role, "roleAttributionTrusted": trusted, "relationship": "played"},
    }


def test_three_hundred_games_reconcile_across_all_roles_and_evidence_uses():
    specs = [("white", "white", "vienna"), ("black", "black_vs_e4", "caro-kann"), ("black", "black_vs_d4", "kings-indian")]
    games = [evidence_game(f"{role}-{index}", colour=colour, role=role, family=family, position=f"{family}-position-{index % 8}") for colour, role, family in specs for index in range(100)]
    hierarchy = build_evidence_hierarchy(games)
    assert hierarchy["account"]["games"] == len(hierarchy["gameLedger"]) == 300
    assert sum(row["games"] for row in hierarchy["repertoireRole"]) == 300
    assert sum(row["usedForOpeningEvidence"] for row in hierarchy["gameLedger"]) == 300
    assert sum(row["usedForPositionEvidence"] for row in hierarchy["gameLedger"]) == 300


def test_move_orders_pool_under_the_same_canonical_family_without_hiding_positions():
    games = [evidence_game(f"transpose-{index}", family="queens-gambit-family", opening=f"display-name-{index % 3}", position=f"position-{index % 2}") for index in range(12)]
    hierarchy = build_evidence_hierarchy(games)
    family = hierarchy["openingFamily"]
    assert len(family) == 1 and family[0]["games"] == 12
    assert family[0]["confidence"]["state"] == "strong"
    assert sorted(row["games"] for row in hierarchy["exactPosition"]) == [6, 6]


def test_recent_experiments_are_weighted_but_historical_games_do_not_disappear():
    historical = [evidence_game(f"old-{index}", family="established", played_at="2025-08-01T12:00:00Z") for index in range(10)]
    recent = [evidence_game(f"new-{index}", family="experiment", played_at="2026-08-01T12:00:00Z") for index in range(4)]
    hierarchy = build_evidence_hierarchy(historical + recent)
    families = {row["identity"].split(":", 1)[1]: row for row in hierarchy["openingFamily"]}
    assert families["established"]["games"] == 10
    assert families["established"]["confidence"]["weightedGameEquivalent"] == 6.5
    assert families["experiment"]["confidence"]["state"] == "limited"


def test_large_import_with_real_exclusions_reconciles_every_missing_game():
    counts = build_game_count_summary(240, 210, {"unsupportedTimeControl": 12, "incompleteGame": 8, "parseFailure": 10}, structurally_usable=220, pgn_available=220, parsed=210, attributed=210, used_for_opening_stats=210, duplicate_games_removed=5)
    games = [evidence_game(f"white-{index}") for index in range(210)]
    accounting = build_role_evidence_accounting(games, counts)
    reconciliation = enrich_game_reconciliation(counts, accounting)
    assert reconciliation["requested_games"] == 245
    assert reconciliation["excluded_total"] == sum(reconciliation["exclusion_breakdown"].values()) == 35
    assert reconciliation["requested_games"] == reconciliation["analysed"] + reconciliation["excluded_total"]


def test_small_actionable_sample_is_limited_and_has_specific_next_threshold():
    hierarchy = build_evidence_hierarchy([evidence_game(f"small-{index}", position="repeat-position") for index in range(3)])
    confidence = hierarchy["openingFamily"][0]["confidence"]
    assert confidence["stateLabel"] == "Limited evidence"
    assert confidence["recommendationStrength"] == "observation_only"
    assert confidence["additionalRelevantGamesForDeveloping"] == 2


def test_systemic_attribution_failure_is_explicit_and_diagnostic():
    games = [evidence_game(f"broken-{index}", role="unresolved", trusted=False) for index in range(30)]
    hierarchy = build_evidence_hierarchy(games)
    assert hierarchy["account"]["confidence"]["stateLabel"] == "Analysis failure"
    assert hierarchy["analysisFailure"]["action"] == "reanalyse"
    assert hierarchy["analysisFailure"]["diagnosticReference"].startswith("evidence-")
