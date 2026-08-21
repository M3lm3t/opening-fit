"""Focused invariants for the user-facing OpeningFit analysis contract."""

from copy import deepcopy

import pytest

from analysis.opening_perspective import attach_perspective, classify_opening_perspective
from analysis.report_decision import build_report_decision
from main import build_game_count_summary
from opening_detection import detect_opening


def perspective(role: str):
    if role == "white":
        return classify_opening_perspective(
            user_colour="white", opening_side="white", first_white_move="e4",
            classification_source="contract_audit",
        )
    if role == "black_vs_e4":
        return classify_opening_perspective(
            user_colour="black", opening_side="black", first_white_move="e4",
            classification_source="contract_audit",
        )
    if role == "black_vs_d4":
        return classify_opening_perspective(
            user_colour="black", opening_side="black", first_white_move="d4",
            classification_source="contract_audit",
        )
    return classify_opening_perspective(
        user_colour="black", opening_side="black", first_white_move="Nf3",
        classification_source="contract_audit",
    )


def opening(name: str, role: str, results: list[str]):
    return attach_perspective({
        "name": name,
        "games": len(results),
        "wins": results.count("win"),
        "draws": results.count("draw"),
        "losses": results.count("loss"),
    }, perspective(role))


def games(name: str, role: str, results: list[str]):
    return [
        attach_perspective({
            "opening": name,
            "openingFamily": name,
            "gameId": f"{name.lower().replace(' ', '-')}-{role}-{index}",
            "result": result,
            "firstWhiteMove": "d4" if role == "black_vs_d4" else "e4",
            "played_at": f"2026-07-{(index % 28) + 1:02d}T12:00:00Z",
        }, perspective(role))
        for index, result in enumerate(results)
    ]


def decision(rows, evidence, **extra):
    report = {
        "analysisId": "analysis-engine-contract-audit",
        "username": "ContractPlayer",
        "platform": "chess.com",
        "gamesAnalysed": len(evidence),
        "opening_games": evidence,
        "importedAt": "2026-08-10T12:00:00Z",
        **extra,
    }
    return build_report_decision(report, openings=rows)


def recommendation_for(result, name):
    return next(row for row in result["recommendations"] if row["openingName"] == name)


def test_four_games_at_seventy_five_percent_is_low_evidence_not_a_firm_verdict():
    results = ["win", "win", "win", "loss"]
    result = decision([opening("Vienna Game", "white", results)], games("Vienna Game", "white", results))
    row = recommendation_for(result, "Vienna Game")

    assert row["observedPerformance"]["scoreRate"] == 75.0
    assert row["observedPerformance"]["winRate"] == 75.0
    assert row["evidenceConfidence"]["level"] == "low"
    assert row["verdict"] == "insufficient-data"
    assert result["establishedStrength"] is None


def test_forty_games_at_stable_fifty_five_percent_is_established_evidence():
    results = ["win"] * 22 + ["loss"] * 18
    result = decision([opening("Caro-Kann Defence", "black_vs_e4", results)], games("Caro-Kann Defence", "black_vs_e4", results))
    row = recommendation_for(result, "Caro-Kann Defence")

    assert row["observedPerformance"]["scoreRate"] == 55.0
    assert row["evidenceConfidence"]["level"] == "high"
    assert row["verdict"] == "keep"
    assert result["establishedStrength"]["openingName"] == "Caro-Kann Defence"


def test_established_opening_plus_small_losing_run_does_not_become_replacement():
    stable = ["win"] * 22 + ["loss"] * 18
    with_new_losses = stable + ["loss"] * 3
    before = decision([opening("Caro-Kann Defence", "black_vs_e4", stable)], games("Caro-Kann Defence", "black_vs_e4", stable))
    after = decision([opening("Caro-Kann Defence", "black_vs_e4", with_new_losses)], games("Caro-Kann Defence", "black_vs_e4", with_new_losses))

    assert recommendation_for(before, "Caro-Kann Defence")["verdict"] == "keep"
    assert recommendation_for(after, "Caro-Kann Defence")["verdict"] == "explore"
    assert after["primaryProblem"] is None
    assert after["primaryAction"]["type"] != "experiment"


def test_poor_established_opening_is_a_genuine_repair():
    results = ["win"] * 8 + ["draw"] * 4 + ["loss"] * 18
    result = decision([opening("French Defence", "black_vs_e4", results)], games("French Defence", "black_vs_e4", results))
    row = recommendation_for(result, "French Defence")

    assert row["observedPerformance"]["scoreRate"] == pytest.approx(33.3, abs=0.1)
    assert row["verdict"] == "repair"
    assert result["primaryProblem"]["openingName"] == "French Defence"
    assert result["primaryAction"]["type"] == "repair_repertoire"


def test_no_black_vs_d4_evidence_is_a_coverage_gap_not_a_weakness():
    white = ["win"] * 6
    black_e4 = ["win"] * 6
    result = decision(
        [opening("Vienna Game", "white", white), opening("Caro-Kann Defence", "black_vs_e4", black_e4)],
        [*games("Vienna Game", "white", white), *games("Caro-Kann Defence", "black_vs_e4", black_e4)],
    )
    d4_role = next(row for row in result["repertoireRoles"] if row["repertoireRole"] == "black_vs_d4")

    assert d4_role["status"] == "insufficient"
    assert d4_role["currentOpening"] is None
    assert result["primaryProblem"] is None
    assert result["primaryAction"]["type"] == "fill_repertoire_gap"
    assert result["primaryAction"]["findingType"] == "repertoire_gap"


def test_mixed_or_unresolved_role_data_fails_safe():
    results = ["loss"] * 20
    result = decision([opening("English Opening", "unresolved", results)], games("English Opening", "unresolved", results))
    row = recommendation_for(result, "English Opening")

    assert row["roleAttributionTrusted"] is False
    assert row["verdict"] == "insufficient-data"
    assert row["evidenceStatus"] == "unresolved"
    assert result["primaryProblem"] is None


def test_transposed_openings_classify_deterministically():
    direct = detect_opening(["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"])
    transposed = detect_opening(["d4", "g6", "c4", "Bg7", "Nc3", "Nf6"])

    assert direct["opening"] == transposed["opening"] == "King's Indian Defence"
    assert direct["canonicalOpeningId"] == transposed["canonicalOpeningId"]


def test_wdl_contract_keeps_win_rate_and_chess_score_distinct():
    results = ["win", "draw", "loss", "loss"] * 3
    result = decision([opening("Italian Game", "white", results)], games("Italian Game", "white", results))
    observed = recommendation_for(result, "Italian Game")["observedPerformance"]

    assert (observed["wins"], observed["draws"], observed["losses"]) == (3, 3, 6)
    assert observed["winRate"] == 25.0
    assert observed["scoreRate"] == 37.5
    assert "Draws count as half" in observed["drawTreatment"]


def test_import_exclusion_accounting_reconciles_exactly():
    counts = build_game_count_summary(
        30, 21,
        {"outsideWindow": 2, "unsupportedTimeControl": 3, "missingOpening": 2, "analysisLimit": 2},
        date_range_eligible=28,
        time_control_eligible=25,
        analysis_candidates=23,
        structurally_usable=21,
    )

    assert counts["fetchedGames"] == counts["analysedGames"] + counts["excludedGames"]
    assert counts["excludedGames"] == sum(counts["exclusionReasons"].values()) == 9
    assert counts["exclusionReasons"]["other"] == 0


def test_health_without_repair_explains_coverage_and_confidence_limits():
    white = ["win"] * 6
    result = decision([opening("Vienna Game", "white", white)], games("Vienna Game", "white", white))
    health = result["repertoireHealth"]

    assert result["primaryProblem"] is None
    assert health["score"] < 70
    assert health["limitingFactors"]
    assert "held back mainly by" in health["explanation"]
    assert "incomplete" in health["weaknessExplanation"]
    assert health["repairStatus"]["key"] == "no_reliable_repair_target"


def test_a_few_new_games_cannot_jump_from_keep_to_repair_or_experiment():
    baseline = ["win"] * 11 + ["loss"] * 9
    updated = baseline + ["loss", "loss"]
    before = decision([opening("Slav Defence", "black_vs_d4", baseline)], games("Slav Defence", "black_vs_d4", baseline))
    after = decision([opening("Slav Defence", "black_vs_d4", updated)], games("Slav Defence", "black_vs_d4", updated))

    assert recommendation_for(before, "Slav Defence")["verdict"] == "keep"
    assert recommendation_for(after, "Slav Defence")["verdict"] == "explore"
    assert after["primaryProblem"] is None
    assert after["experiment"] is None


def test_target_elo_fields_do_not_change_analysis_decisions():
    results = ["win"] * 6 + ["loss"] * 4
    rows = [opening("Vienna Game", "white", results)]
    evidence = games("Vienna Game", "white", results)
    without_target = decision(rows, evidence)
    with_target = decision(deepcopy(rows), deepcopy(evidence), targetElo=2200, target_rating=2200, ratingGoal={"targetRating": 2200})

    for result in (without_target, with_target):
        assert recommendation_for(result, "Vienna Game")["verdict"] == "keep"
        assert result["primaryAction"]["type"] == "fill_repertoire_gap"
    assert without_target["recommendations"] == with_target["recommendations"]
    assert without_target["repertoireHealth"] == with_target["repertoireHealth"]
