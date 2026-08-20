from analysis.game_check import build_game_check_change_set, genuinely_new_games

def game(identity, **extra): return {"id": identity, **extra}

def test_duplicate_archives_and_retries_never_count_twice():
    rows = genuinely_new_games([game("a"), game("a"), {"uuid": "b"}], ["a"])
    assert [row.get("uuid") for row in rows] == ["b"]
    assert build_game_check_change_set(games=[game("a")], checked_ids=["a"])["status"] == "no_new_games"

def test_priority_recurs_only_with_exact_authoritative_identity():
    result = build_game_check_change_set(games=[game("g1", diagnosisId="d1", repertoireRole="black_vs_d4", openingId="o1"), game("g2", diagnosisId="other")], priority={"diagnosisId": "d1", "repertoireRole": "black_vs_d4", "openingId": "o1"}, comparable=True)
    assert result["outcomes"][0]["type"] == "priority_recurred"
    assert result["outcomes"][0]["relevantGameCount"] == 1
    assert result["outcomes"][0]["evidenceReferences"] == ["g1"]

def test_trained_opening_not_encountered_makes_no_improvement_claim():
    result = build_game_check_change_set(games=[game("g1", repertoireRole="white", openingId="other")], priority={"diagnosisId": "d1", "repertoireRole": "black_vs_e4", "openingId": "caro"}, comparable=True)
    assert result["outcomes"][0]["type"] == "not_encountered_again"
    assert "no improvement claim" in result["outcomes"][0]["wording"]

def test_response_plan_requires_explicit_recoverable_comparison():
    plan = {"repertoireRole": "white", "openingId": "vienna", "diagnosisId": "d2"}
    followed = build_game_check_change_set(games=[game("g1", repertoireRole="white", openingId="vienna", responsePlanFollowed=True)], response_plan=plan, comparable=True)
    assert followed["outcomes"][0]["type"] == "response_plan_followed"
    unknown = build_game_check_change_set(games=[game("g2", repertoireRole="white", openingId="vienna")], response_plan=plan, comparable=False)
    assert all(row["type"] != "response_plan_not_followed" for row in unknown["outcomes"])

def test_non_comparable_and_out_of_role_games_fail_closed():
    result = build_game_check_change_set(games=[game("g1", repertoireRole="outside_core")], comparable=False)
    assert result["outcomes"][0]["type"] == "insufficient_comparable_evidence"
    assert result["outcomes"][0]["comparisonEligible"] is False
    assert result["outcomes"][0]["causalClaim"] is False

def test_existing_import_limit_is_applied_without_a_second_entitlement_rule():
    result = build_game_check_change_set(games=[game(str(i)) for i in range(5)], import_limit=2)
    assert result["newGameCount"] == 2
