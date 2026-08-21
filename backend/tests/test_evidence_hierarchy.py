from analysis.evidence_hierarchy import build_evidence_hierarchy
from analysis.evidence_thresholds import evidence_sample_tier
from main import build_game_count_summary, build_role_evidence_accounting, enrich_game_reconciliation


def game(game_id, colour, role, opening_id, variation="", position=""):
    return {
        "gameId": game_id,
        "playerColour": colour,
        "playerRole": role,
        "canonicalOpeningId": opening_id,
        "variation": variation,
        "canonicalPositionId": position,
        "perspective": {
            "userColour": colour,
            "repertoireRole": role,
            "role": "played_as_white" if colour == "white" else "played_as_black",
            "relationship": "played",
            "roleAttributionTrusted": True,
        },
    }


def test_shared_sample_tiers_are_graded():
    assert [evidence_sample_tier(value)[0] for value in (1, 5, 10, 25, 50)] == [
        "exploratory", "early", "moderate", "strong", "high"
    ]


def test_three_hundred_games_fall_back_without_disappearing():
    games = []
    specs = [("white", "white", "queens-pawn"), ("black", "black_vs_e4", "caro-kann"), ("black", "black_vs_d4", "kings-indian")]
    for colour, role, opening_id in specs:
        for index in range(100):
            games.append(game(f"{role}-{index}", colour, role, opening_id, f"line-{index % 30}", f"pos-{index % 70}"))
    hierarchy = build_evidence_hierarchy(games)
    assert hierarchy["account"]["games"] == 300
    assert hierarchy["globallyInsufficient"] is False
    assert [row["games"] for row in hierarchy["repertoireRole"]] == [100, 100, 100]
    assert all(row["confidence"]["tier"] == "high" for row in hierarchy["repertoireRole"])
    assert all(row["games"] <= 4 for row in hierarchy["exactPosition"])
    assert all(row["confidence"]["tier"] == "exploratory" for row in hierarchy["exactPosition"])
    assert sum(row["games"] for row in hierarchy["openingFamily"]) == 300


def test_reconciliation_records_every_role_and_exclusion():
    games = [game(f"w-{index}", "white", "white", "vienna") for index in range(7)]
    counts = build_game_count_summary(9, 7, {"parseFailure": 2}, structurally_usable=9, pgn_available=9, parsed=7, attributed=7, used_for_opening_stats=7, duplicate_games_removed=1)
    accounting = build_role_evidence_accounting(games, counts)
    reconciliation = enrich_game_reconciliation(counts, accounting)
    assert reconciliation["requested_games"] == 10
    assert reconciliation["imported_games"] == 9
    assert reconciliation["successfully_parsed_games"] == 7
    assert reconciliation["white_role_games"] == 7
    assert reconciliation["eligible_games"] == reconciliation["white_role_games"] + reconciliation["unresolved_role_games"] + reconciliation["outside_core_role_games"]
