from backend.analysis.retention_metrics import build_retention_metrics


def test_retention_metrics_builds_mastery_and_one_fix():
    metrics = build_retention_metrics(
        best_openings=[
            {
                "name": "Vienna Game",
                "games": 12,
                "wins": 7,
                "draws": 2,
                "losses": 3,
                "recentTrend": "Improving",
                "recentTrendScoreDelta": 14,
                "planClarityResultStability": 78,
            },
            {
                "name": "Scandinavian Defense",
                "games": 6,
                "wins": 1,
                "draws": 1,
                "losses": 4,
                "recentTrend": "Declining",
                "recentTrendScoreDelta": -16,
                "planClarityResultStability": 48,
            },
        ],
        problem_lines=[
            {
                "opening": "Scandinavian Defense",
                "variation": "1.e4 d5 2.exd5 Qxd5",
                "games": 5,
                "wins": 1,
                "draws": 0,
                "losses": 4,
                "lossRate": 80,
                "flagReason": "The queen is moving too often before development is finished.",
            }
        ],
        repertoire_coverage={
            "white": [{"key": "main_white", "status": "Covered", "games": 12}],
            "black": [
                {"key": "black_vs_e4", "status": "Needs work", "games": 6},
                {"key": "black_vs_d4", "status": "Too little data", "games": 1},
            ],
        },
        training_items=[{"opening": "Scandinavian Defense", "completed": True}],
    )

    mastery_by_name = {item["opening"]: item for item in metrics["openingMastery"]}

    assert mastery_by_name["Vienna Game"]["masteryScore"] > mastery_by_name["Scandinavian Defense"]["masteryScore"]
    assert mastery_by_name["Scandinavian Defense"]["weakLineCount"] == 1
    assert mastery_by_name["Scandinavian Defense"]["trainingCompletedCount"] == 1
    assert metrics["oneThingToFix"]["opening"] == "Scandinavian Defense"
    assert "queen" in metrics["oneThingToFix"]["exactIssue"]
    assert 0 <= metrics["repertoireHealth"]["score"] <= 100
    assert 0 <= metrics["openingFitScore"]["score"] <= 1000
    assert metrics["openingFitScore"]["factors"]["averageMastery"] > 0
    assert metrics["openingIdentity"]["identity"] in {
        "Aggressive Counterpuncher",
        "Positional Builder",
        "Dynamic Attacker",
        "Solid Defender",
        "Tactical Explorer",
        "Endgame Grinder",
        "Gambit Seeker",
        "Classical Developer",
    }
    assert len(metrics["openingIdentity"]["reasons"]) == 2


def test_weakest_line_tracking_detects_changed_line_from_previous_report():
    metrics = build_retention_metrics(
        best_openings=[{"name": "London System", "games": 8, "wins": 3, "draws": 1, "losses": 4}],
        problem_lines=[
            {
                "opening": "London System",
                "variation": "1.d4 d5 2.Bf4 c5",
                "games": 4,
                "wins": 0,
                "draws": 1,
                "losses": 3,
                "lossRate": 75,
            }
        ],
        previous_report={
            "weakestLineTracking": {
                "currentWeakestLine": {
                    "opening": "Caro-Kann Defense",
                    "variation": "Advance Variation",
                    "games": 5,
                    "lossRate": 60,
                }
            }
        },
    )

    tracking = metrics["weakestLineTracking"]

    assert tracking["currentWeakestLine"]["opening"] == "London System"
    assert tracking["previousWeakestLine"]["opening"] == "Caro-Kann Defense"
    assert tracking["changedSinceLastAnalysis"] is True


def test_opening_decay_uses_dates_without_creating_noise():
    metrics = build_retention_metrics(
        best_openings=[
            {"name": "Vienna Game", "games": 8, "wins": 4, "draws": 2, "losses": 2},
            {"name": "Italian Game", "games": 2, "wins": 1, "draws": 0, "losses": 1},
        ],
        recent_games=[
            {
                "opening": "Vienna Game",
                "result": "win",
                "end_time": "2026-05-01T12:00:00+00:00",
            },
            {
                "opening": "Italian Game",
                "result": "loss",
                "end_time": "2026-04-01T12:00:00+00:00",
            },
        ],
    )

    by_name = {item["opening"]: item for item in metrics["openingMastery"]}

    assert by_name["Vienna Game"]["decayRisk"] in {"medium", "high"}
    assert by_name["Vienna Game"]["daysSincePlayed"] is not None
    assert by_name["Italian Game"]["decayRisk"] == "none"
    assert metrics["oneThingToFix"]["reasonCode"] == "opening_decay"
