from main import build_game_count_summary


def test_report_game_counts_reconcile_with_exclusions():
    summary = build_game_count_summary(
        20,
        14,
        {"bullet": 2, "missingOpening": 3, "veryShort": 1},
    )
    assert summary["imported"] == 20
    assert summary["eligible"] == 18
    assert summary["classified"] == 14
    assert summary["excluded"] == 6
    assert summary["imported"] == summary["classified"] + summary["excluded"]


def test_report_game_count_labels_use_stable_exclusion_categories():
    summary = build_game_count_summary(2, 0, {"outsideWindow": 1, "missingOpening": 1})
    labels = {row["label"] for row in summary["exclusionReasons"]}
    assert "Outside selected date range" in labels
    assert "Missing or invalid PGN/opening data" in labels
