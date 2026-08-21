from copy import deepcopy
import json

import pytest

import main as backend_main
from analysis.opening_perspective import attach_perspective, classify_opening_perspective
from analysis.report_decision import (
    assert_decision_consistency,
    build_report_decision,
    build_repertoire_coverage_score,
)


def context(role: str):
    colour = "white" if role == "white" else "black"
    first_move = "d4" if role == "black_vs_d4" else "e4"
    return classify_opening_perspective(
        user_colour=colour,
        opening_side=colour,
        first_white_move=first_move,
        classification_source="decision_contract_fixture",
    )


def opening(name, role, results, *, fit_score=None):
    wins = results.count("win")
    draws = results.count("draw")
    losses = results.count("loss")
    row = {"name": name, "games": len(results), "wins": wins, "draws": draws, "losses": losses}
    if fit_score is not None:
        row["fitScore"] = fit_score
    return attach_perspective(row, context(role))


def games_for(name, role, results, *, prefix=None):
    marker = prefix or name.lower().replace(" ", "-")
    return [
        attach_perspective(
            {
                "opening": name,
                "openingFamily": name,
                "gameId": f"{marker}-{index}",
                "result": result,
                "firstWhiteMove": "d4" if role == "black_vs_d4" else "e4",
                "played_at": f"2026-07-{index:02d}T12:00:00Z",
            },
            context(role),
        )
        for index, result in enumerate(results, 1)
    ]


def build(rows, games, **extra):
    report = {
        "analysisId": extra.pop("analysisId", "authoritative-fixture"),
        "username": "FixturePlayer",
        "platform": "chess.com",
        "gamesAnalysed": len(games),
        "opening_games": games,
        **extra,
    }
    return build_report_decision(report, openings=rows)


def test_systemic_role_attribution_failure_is_recoverable_and_suppresses_chess_claims():
    decision = build(
        [opening("Italian Game", "white", ["loss"] * 20)],
        games_for("Italian Game", "white", ["loss"] * 20),
        roleEvidenceAccounting={
            "valid": False,
            "status": "invalid",
            "diagnosticReference": "role-deadbeef1234",
            "eligibleGames": 20,
            "roleAttributedGames": 0,
        },
    )
    assert decision["nextTrainingAction"]["type"] == "reanalyse_role_attribution"
    assert decision["nextTrainingAction"]["findingType"] == "processing_failure"
    assert decision["recommendations"] == []
    assert decision["findings"] == [{
        "type": "processing_failure", "opening": None, "repertoireRole": "unresolved",
        "playerColour": None, "supportingGameCount": 0,
        "confidenceReasonCode": "systemic_role_attribution_failure", "recommendationId": None,
    }]
    assert all(role["dataQuality"] == "role_attribution_failure" for role in decision["repertoireRoles"])


def dated_games(name, role, dates, *, prefix, results=None):
    outcomes = results or (["win", "draw", "loss"] * len(dates))[:len(dates)]
    return [
        attach_perspective(
            {
                "opening": name,
                "openingFamily": name,
                "gameId": f"{prefix}-{index}",
                "result": outcomes[index - 1],
                "firstWhiteMove": "d4" if role == "black_vs_d4" else "e4",
                "played_at": f"{played_on}T12:00:00Z",
            },
            context(role),
        )
        for index, played_on in enumerate(dates, 1)
    ]


def test_realistic_three_hundred_game_fixture_establishes_all_three_roles():
    fixtures = [
        ("Vienna Game", "white"),
        ("Caro-Kann Defence", "black_vs_e4"),
        ("Queen's Gambit Declined", "black_vs_d4"),
    ]
    rows = []
    games = []
    for name, role in fixtures:
        results = (["win", "draw", "loss", "win"] * 25)
        rows.append(opening(name, role, results))
        games.extend(games_for(name, role, results, prefix=role))
    decision = build(rows, games)
    established = [role for role in decision["repertoireRoles"] if role["status"] == "established"]
    assert len(established) == 3
    assert {role["repertoireRole"] for role in established} == {"white", "black_vs_e4", "black_vs_d4"}
    assert all(role["relevantGameCount"] == 100 for role in established)


def test_historical_repertoire_survives_recent_opening_experiments():
    nimzo_dates = ["2025-10-05", "2025-11-12", "2025-12-20", "2026-01-08", "2026-02-14", "2026-03-03"]
    owen_dates = ["2025-09-07", "2025-10-19", "2025-11-21", "2025-12-11", "2026-01-17", "2026-02-09", "2026-03-18", "2026-04-02"]
    caro_dates = ["2026-07-03", "2026-07-19", "2026-08-02", "2026-08-15"]
    sicilian_dates = ["2026-07-08", "2026-07-27", "2026-08-10"]
    games = [
        *dated_games("Nimzo-Larsen Attack", "white", nimzo_dates, prefix="nimzo-larsen"),
        *dated_games("Owen's Defence", "black_vs_e4", owen_dates, prefix="owen"),
        *dated_games("Caro-Kann Defence", "black_vs_e4", caro_dates, prefix="caro"),
        *dated_games("Sicilian Defence", "black_vs_e4", sicilian_dates, prefix="sicilian"),
    ]
    rows = [
        opening("Nimzo-Larsen Attack", "white", ["win", "draw", "loss", "win", "draw", "loss"]),
        opening("Owen's Defence", "black_vs_e4", ["win", "draw", "loss", "win", "draw", "loss", "win", "draw"]),
        opening("Caro-Kann Defence", "black_vs_e4", ["loss"] * 4),
        opening("Sicilian Defence", "black_vs_e4", ["loss"] * 3),
    ]

    decision = build(rows, games)
    history = {(row["opening"], row["repertoireRole"]): row for row in decision["repertoireHistory"]["openings"]}
    roles = {row["repertoireRole"]: row for row in decision["repertoireRoles"]}

    assert decision["repertoireHistory"]["historyAvailable"] is True
    assert history[("Nimzo-Larsen Attack", "white")]["classification"] == "DORMANT"
    assert history[("Owen's Defence", "black_vs_e4")]["classification"] == "DORMANT"
    assert history[("Caro-Kann Defence", "black_vs_e4")]["classification"] == "EXPERIMENT"
    assert history[("Sicilian Defence", "black_vs_e4")]["classification"] == "EXPERIMENT"
    assert history[("Owen's Defence", "black_vs_e4")]["totalEligibleGames"] == 8
    assert history[("Owen's Defence", "black_vs_e4")]["historicalGames"] == 8
    assert history[("Caro-Kann Defence", "black_vs_e4")]["recentGames"] == 4
    assert history[("Nimzo-Larsen Attack", "white")]["canonicalOpeningId"] == "nimzo-larsen-attack"
    assert history[("Owen's Defence", "black_vs_e4")]["canonicalOpeningId"] == "owens-defence"
    assert history[("Owen's Defence", "black_vs_e4")]["continuity"]["repeatedAcrossTime"] is True
    assert history[("Owen's Defence", "black_vs_e4")]["performance"]["scoreRate"] is not None
    assert roles["white"]["currentOpening"] == "Nimzo-Larsen Attack"
    assert roles["black_vs_e4"]["currentOpening"] == "Owen's Defence"
    assert decision["primaryAction"].get("opening") not in {"Caro-Kann Defence", "Sicilian Defence"}


def test_recent_experiments_are_visible_but_do_not_lower_main_repertoire_health():
    established_dates = ["2025-09-07", "2025-10-19", "2025-11-21", "2025-12-11", "2026-01-17", "2026-02-09"]
    experiment_dates = ["2026-07-03", "2026-07-19", "2026-08-02", "2026-08-15"]
    established_games = dated_games("Owen's Defence", "black_vs_e4", established_dates, prefix="owen")
    experiment_games = dated_games("Caro-Kann Defence", "black_vs_e4", experiment_dates, prefix="caro", results=["loss"] * 4)
    established_row = opening("Owen's Defence", "black_vs_e4", ["win", "draw", "loss", "win", "draw", "loss"])
    experiment_row = opening("Caro-Kann Defence", "black_vs_e4", ["loss"] * 4)

    baseline = build([established_row], established_games)
    with_experiment = build([established_row, experiment_row], [*established_games, *experiment_games])

    assert with_experiment["repertoireHealth"]["score"] == baseline["repertoireHealth"]["score"]
    role = next(row for row in with_experiment["repertoireHealth"]["roleScores"] if row["key"] == "black_e4")
    assert role["roleGames"] == 6
    assert role["excludedExperimentGames"] == 4
    assert role["topOpeningShare"] == 100
    assert with_experiment["repertoireHealth"]["recentExperiments"] == [{
        "canonicalOpeningId": "caro-kann-defence", "opening": "Caro-Kann Defence",
        "repertoireRole": "black_vs_e4", "status": "struggling", "statusLabel": "struggling",
        "recentGames": 4,
        "performance": {"wins": 0, "draws": 0, "losses": 4, "scoreRate": 0.0},
        "includedInPrimaryScore": False,
    }]


def test_explicit_repertoire_choice_overrides_scoring_presentation_not_history():
    historical = dated_games("Owen's Defence", "black_vs_e4", ["2025-09-07", "2025-10-19", "2025-11-21", "2025-12-11", "2026-01-17", "2026-02-09"], prefix="owen")
    recent = dated_games("Caro-Kann Defence", "black_vs_e4", ["2026-07-03", "2026-07-19", "2026-08-02", "2026-08-15"], prefix="caro", results=["loss"] * 4)
    rows = [opening("Owen's Defence", "black_vs_e4", ["win", "draw", "loss", "win", "draw", "loss"]), opening("Caro-Kann Defence", "black_vs_e4", ["loss"] * 4)]
    decision = build(rows, [*historical, *recent], repertoirePreferences=[{
        "repertoireRole": "black_vs_e4", "canonicalOpeningId": "caro-kann-defence", "preference": "main",
    }])
    caro = next(row for row in decision["repertoireHistory"]["openings"] if row["canonicalOpeningId"] == "caro-kann-defence")
    role = next(row for row in decision["repertoireHealth"]["roleScores"] if row["key"] == "black_e4")

    assert caro["classification"] == "EXPERIMENT"
    assert caro["effectiveClassification"] == "MAIN_REPERTOIRE"
    assert caro["userPreference"] == "main"
    assert role["excludedExperimentGames"] == 0
    assert decision["repertoireHealth"]["recentExperiments"] == []


def test_six_game_severe_weakness_outranks_seven_game_playable_opening():
    weak = ["win", "loss", "loss", "loss", "loss", "loss"]
    playable = ["win", "win", "win", "win", "loss", "loss", "loss"]
    decision = build(
        [opening("Queen Pawn Game", "white", weak), opening("Scandinavian Defence", "black_vs_e4", playable)],
        [*games_for("Queen Pawn Game", "white", weak), *games_for("Scandinavian Defence", "black_vs_e4", playable)],
    )

    assert decision["repair"]["opening"] == "Queen Pawn Game"
    assert decision["primaryAction"]["opening"] == "Queen Pawn Game"
    assert decision["primaryAction"]["verdict"] == "repair"


def test_demo_has_one_queen_pawn_primary_action_and_consistent_aliases():
    payload = backend_main.demo_profile()
    decision = payload["reportDecision"]

    assert decision["primaryAction"]["opening"] == "Queen Pawn Game"
    assert decision["primaryAction"] == decision["nextTrainingAction"]
    assert decision["trainingPriority"]["decisionId"] == decision["decisionId"]
    assert payload["trainingPriority"]["openingName"] == "Queen Pawn Game"
    assert payload["recommendedAction"] == decision["primaryAction"]["label"]


def test_keep_and_zero_game_style_experiment_cannot_displace_repair():
    weak = ["loss"] * 6
    keep = ["win"] * 5 + ["loss"] * 2
    decision = build(
        [opening("Queen Pawn Game", "white", weak, fit_score=10), opening("Scandinavian Defence", "black_vs_e4", keep, fit_score=99)],
        [*games_for("Queen Pawn Game", "white", weak), *games_for("Scandinavian Defence", "black_vs_e4", keep)],
        recommended_openings={"black_vs_d4": [{"name": "King's Indian Defence", "games": 0, "fitScore": 100}]},
    )

    assert decision["keep"]["opening"] == "Scandinavian Defence"
    assert decision["repair"]["opening"] == decision["primaryAction"]["opening"] == "Queen Pawn Game"
    assert decision["experiment"]["openingName"] == "King's Indian Defence"
    assert decision["experiment"]["games"] == 0


def test_faced_evidence_never_creates_a_repertoire_repair():
    faced = classify_opening_perspective(user_colour="white", opening_side="black", first_white_move="e4")
    results = ["loss"] * 12
    rows = [attach_perspective({"name": "Caro-Kann Defence", "games": 12, "wins": 0, "draws": 0, "losses": 12}, faced)]
    games = [attach_perspective({"opening": "Caro-Kann Defence", "gameId": f"faced-{i}", "result": result}, faced) for i, result in enumerate(results, 1)]
    decision = build(rows, games)

    assert decision["repair"] is None
    assert decision["primaryAction"]["verdict"] == "collect_more_data"
    assert all(role.get("currentOpening") != "Caro-Kann Defence" for role in decision["repertoireRoles"])


def test_black_repertoire_roles_remain_separate():
    e4 = ["loss"] * 6
    d4 = ["win"] * 6
    decision = build(
        [opening("French Defence", "black_vs_e4", e4), opening("King's Indian Defence", "black_vs_d4", d4)],
        [*games_for("French Defence", "black_vs_e4", e4), *games_for("King's Indian Defence", "black_vs_d4", d4)],
    )
    roles = {row["repertoireRole"]: row for row in decision["repertoireRoles"]}

    assert roles["black_vs_e4"]["currentOpening"] == "French Defence"
    assert roles["black_vs_d4"]["currentOpening"] == "King's Indian Defence"
    assert decision["primaryAction"]["repertoireRole"] == "black_vs_e4"


def test_low_samples_choose_one_cautious_collect_action():
    samples = {
        "white": ("Vienna Game", ["win", "loss"]),
        "black_vs_e4": ("French Defence", ["win", "loss"]),
        "black_vs_d4": ("Slav Defence", ["draw", "loss"]),
    }
    rows = [opening(name, role, results) for role, (name, results) in samples.items()]
    games = [game for role, (name, results) in samples.items() for game in games_for(name, role, results)]
    decision = build(rows, games)

    assert decision["primaryAction"]["verdict"] == "collect_more_data"
    assert decision["primaryAction"]["confidenceLevel"] == "insufficient"
    assert decision["primaryAction"] == decision["nextTrainingAction"]


def test_repair_ties_are_stable_and_evidence_ids_match_target_context():
    results = ["loss"] * 5
    rows = [opening("Scandinavian Defence", "black_vs_e4", results), opening("French Defence", "black_vs_e4", results)]
    games = [*games_for("Scandinavian Defence", "black_vs_e4", results, prefix="scandi"), *games_for("French Defence", "black_vs_e4", results, prefix="french")]

    first = build(rows, games)
    second = build(list(reversed(rows)), list(reversed(games)))

    assert first["primaryAction"]["opening"] == second["primaryAction"]["opening"] == "French Defence"
    assert set(first["primaryAction"]["evidenceGameIds"]) == {f"french-{index}" for index in range(1, 6)}
    assert first["primaryAction"]["games"] == 5


def test_contract_guard_rejects_competing_primary_alias_and_unsupported_percentages():
    results = ["loss"] * 6
    decision = build([opening("Queen Pawn Game", "white", results)], games_for("Queen Pawn Game", "white", results))
    altered = deepcopy(decision)
    altered["nextTrainingAction"] = {**altered["nextTrainingAction"], "opening": "Scandinavian Defence"}

    with pytest.raises(ValueError, match="primaryAction and nextTrainingAction differ"):
        assert_decision_consistency(altered)
    assert "%" not in decision["primaryAction"]["successCheck"]
    assert "estimated_impact" not in decision["primaryAction"]


def test_contract_guard_rejects_duplicate_ids_and_context_verdict_conflicts():
    results = ["win"] * 6
    decision = build([opening("Vienna Game", "white", results)], games_for("Vienna Game", "white", results))
    duplicate = deepcopy(decision["recommendations"][0])
    duplicate["verdict"] = "repair"
    broken = deepcopy(decision)
    broken["recommendations"].append(duplicate)

    with pytest.raises(ValueError, match="recommendation IDs must be present and unique"):
        assert_decision_consistency(broken)

    duplicate["recommendationId"] = "different-id-same-context"
    broken["recommendations"][-1] = duplicate
    with pytest.raises(ValueError, match="conflicting verdicts"):
        assert_decision_consistency(broken)


def test_repertoire_health_is_versioned_reproducible_and_weights_reconcile():
    payload = backend_main.demo_profile()
    health = payload["repertoireHealth"]
    available = [row for row in health["components"] if row["available"]]

    assert health["version"] == health["formulaVersion"] == "repertoire_health_v3"
    assert health["score"] == pytest.approx(sum(row["contribution"] for row in available), abs=1e-5)
    assert sum(row["baseWeight"] for row in health["components"]) == 100
    assert sum(row["effectiveWeight"] for row in available) == pytest.approx(100, abs=1e-5)
    assert health["limitingFactors"]
    assert health["limitingFactors"][0]["label"].lower() in health["explanation"].lower()


def test_unavailable_health_components_are_null_and_reweighted_not_zeroed():
    health = build_repertoire_coverage_score([
        {"key": "white", "label": "White", "status": "insufficient", "supportingGameCount": 0, "evidenceFunnel": {"openingBreakdown": []}},
        {"key": "black_e4", "label": "Black against 1.e4", "status": "insufficient", "supportingGameCount": 0, "evidenceFunnel": {"openingBreakdown": []}},
        {"key": "black_d4", "label": "Black against 1.d4", "status": "insufficient", "supportingGameCount": 0, "evidenceFunnel": {"openingBreakdown": []}},
    ])
    components = {row["key"]: row for row in health["components"]}

    assert components["roleCompleteness"]["available"] is True
    assert components["roleCompleteness"]["value"] == 0
    for key in ("concentrationConsistency", "evidenceStrength", "unresolvedRecurringProblems"):
        assert components[key]["available"] is False
        assert components[key]["value"] is None
        assert components[key]["contribution"] is None
    assert components["roleCompleteness"]["effectiveWeight"] == 100


def test_observed_performance_distinguishes_win_rate_score_rate_and_role_baseline():
    results = ["win", "draw", "loss", "loss", "loss", "loss"]
    decision = build([opening("Queen Pawn Game", "white", results, fit_score=90)], games_for("Queen Pawn Game", "white", results))
    recommendation = decision["recommendations"][0]
    observed = recommendation["observedPerformance"]

    assert observed["version"] == "observed_performance_v1"
    assert observed["winRate"] == 16.7
    assert observed["scoreRate"] == 25.0
    assert observed["role"] == "white"
    assert observed["baselineSource"] == "neutral chess-score reference for this role"
    assert recommendation["openingSuitability"]["score"] == 90
    assert recommendation["performanceScore"] == 25.0


def test_confidence_has_explicit_scope_and_does_not_change_observed_results():
    results = ["win", "draw"] + ["loss"] * 6
    recommendation = build([opening("Vienna Game", "white", results, fit_score=90)], games_for("Vienna Game", "white", results))["recommendations"][0]

    assert recommendation["observedPerformance"]["scoreRate"] == 18.8
    assert recommendation["evidenceConfidence"]["level"] == "low"
    assert recommendation["evidenceConfidence"]["scope"] == "opening_decision"
    assert recommendation["openingSuitability"]["confidence"]["scope"] == "opening_suitability"
    assert recommendation["sampleSizeConfidence"]["scope"] == "opening_decision"
    assert recommendation["classificationConfidence"]["level"] == "trusted"
    assert recommendation["roleAttributionConfidence"]["level"] == "trusted"
    assert recommendation["recommendationConfidence"]["scope"] == "recommendation"
    assert recommendation["gamesNeeded"] == 0


def test_recommendation_serializes_trusted_role_attribution_explicitly():
    results = ["win"] * 6
    recommendation = build(
        [opening("Vienna Game", "white", results)],
        games_for("Vienna Game", "white", results),
    )["recommendations"][0]

    assert recommendation["roleAttributionTrusted"] is True


def test_unresolved_recommendation_serializes_false_and_remains_cautious():
    unresolved = classify_opening_perspective(
        user_colour="black",
        opening_side="black",
        first_white_move="Nf3",
        classification_source="decision_contract_fixture",
    )
    results = ["loss"] * 20
    row = attach_perspective(
        {"name": "English Opening", "games": 20, "wins": 0, "draws": 0, "losses": 20},
        unresolved,
    )
    evidence = [
        attach_perspective(
            {"opening": "English Opening", "gameId": f"unresolved-{index}", "result": result},
            unresolved,
        )
        for index, result in enumerate(results, 1)
    ]
    decision = build([row], evidence)
    recommendation = decision["recommendations"][0]

    assert recommendation["roleAttributionTrusted"] is False
    assert recommendation["verdict"] == "insufficient-data"
    assert recommendation["evidenceStatus"] == "unresolved"
    assert decision["primaryProblem"] is None
    restored = json.loads(json.dumps(decision))
    assert restored["recommendations"][0]["roleAttributionTrusted"] is False


def test_serialization_round_trip_preserves_role_attribution_boolean():
    results = ["win"] * 6
    decision = build(
        [opening("Vienna Game", "white", results)],
        games_for("Vienna Game", "white", results),
    )
    restored = json.loads(json.dumps(decision))

    assert restored["recommendations"][0]["roleAttributionTrusted"] is True


def test_zero_game_experiment_has_suitability_but_no_observed_performance():
    decision = build([], [], recommended_openings={"white": [{"name": "Vienna Game", "games": 0, "fitScore": 90}]})
    experiment = decision["experiment"]

    assert experiment["observedPerformance"] is None
    assert experiment["scoreRate"] is None
    assert experiment["openingSuitability"]["score"] == 90
    assert "not proven by your results" in experiment["openingSuitability"]["rationale"]
    assert experiment["evidenceConfidence"]["level"] == "insufficient"


def test_demo_semantics_and_aliases_do_not_change_primary_action():
    payload = backend_main.demo_profile()
    decision = payload["reportDecision"]
    queen = next(row for row in decision["recommendations"] if row["openingName"] == "Queen Pawn Game")
    vienna = next(row for row in decision["recommendations"] if row["openingName"] == "Vienna Game")

    assert decision["primaryAction"]["opening"] == "Queen Pawn Game"
    assert queen["observedPerformance"] == queen["observed_performance"]
    assert queen["observedPerformance"] | {"winRate": 16.7, "scoreRate": 25.0} == queen["observedPerformance"]
    assert vienna["observedPerformance"]["games"] == 8
    assert vienna["observedPerformance"]["scoreRate"] == 68.8
    assert vienna["evidenceConfidence"]["level"] == "low"
    assert payload["repertoireHealth"] == payload["repertoire_health"] == payload["repertoireCoverageScore"]
    assert payload["openingFitScore"] == payload["repertoireHealth"]["score"]


def test_demo_diagnosis_is_honest_and_stays_inside_the_queen_pawn_sample():
    payload = backend_main.demo_profile()
    diagnosis = payload["openingDiagnosis"]
    queen_ids = set(next(row for row in payload["reportDecision"]["recommendations"] if row["openingName"] == "Queen Pawn Game")["sample"]["gameIds"])

    assert payload["reportDecision"]["primaryAction"]["opening"] == "Queen Pawn Game"
    assert diagnosis["opening"] == "Queen Pawn Game"
    assert diagnosis["repertoireRole"] == "white"
    assert diagnosis["playerColour"] == "white"
    assert diagnosis["precisionLevel"] == "move_order"
    assert diagnosis["positionFen"]
    assert diagnosis["playerToMove"] == "white"
    assert len(diagnosis["supportingGameIds"]) == 6
    assert set(diagnosis["supportingGameIds"]) == queen_ids
    assert diagnosis["objectiveMoveClaimed"] is False
    assert payload["trainingPriority"]["diagnosisId"] == diagnosis["diagnosisId"]
