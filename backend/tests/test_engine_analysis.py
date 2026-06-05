from backend.analysis.engine_analysis import (
    apply_engine_adjustments_to_style_fingerprint,
    build_engine_summary,
    summarise_game_results,
)


def test_engine_summary_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("ENGINE_ANALYSIS_ENABLED", raising=False)

    summary = build_engine_summary([], username="Demo")

    assert summary["enabled"] is False
    assert summary["analysed_games"] == 0
    assert summary["style_adjustments"] == {}


def test_missing_stockfish_fails_gracefully(monkeypatch):
    monkeypatch.setenv("ENGINE_ANALYSIS_ENABLED", "true")
    monkeypatch.setenv("STOCKFISH_PATH", "/missing/stockfish")

    summary = build_engine_summary([{"pgn": "1. e4 e5", "colour": "white"}], username="Demo")

    assert summary["enabled"] is False
    assert summary["reason"] == "stockfish_missing"


def test_engine_results_create_bounded_style_adjustments():
    summary = summarise_game_results(
        [
            {
                "analysed": True,
                "opening_accuracy_estimate": 62,
                "first_major_eval_swing": {"phase": "opening"},
                "swings": [
                    {"issue_type": "king_safety", "drop_cp": 180},
                    {"issue_type": "king_safety", "drop_cp": 160},
                    {"issue_type": "central_collapse", "drop_cp": 170},
                    {"issue_type": "central_collapse", "drop_cp": 150},
                ],
            }
        ]
    )

    assert summary["enabled"] is True
    assert summary["analysed_games"] == 1
    assert summary["opening_accuracy_estimate"] == 62
    assert summary["opening_accuracy_trend"] == "insufficient_data"
    assert summary["style_adjustments"]["king_safety_risk"] > 0
    assert summary["style_adjustments"]["opening_phase_stability"] < 0


def test_style_fingerprint_adjustments_do_not_override_logic():
    fingerprint = {
        "traits": {
            "king_safety_risk": 94,
            "gambit_comfort": 3,
            "open_position_preference": 50,
        },
        "evidence": [],
        "method": "deterministic_pgn_heuristics_v1",
    }
    summary = {
        "style_adjustments": {
            "king_safety_risk": 12,
            "gambit_comfort": -5,
            "open_position_preference": 8,
        }
    }

    adjusted = apply_engine_adjustments_to_style_fingerprint(fingerprint, summary)

    assert adjusted["traits"]["king_safety_risk"] == 100
    assert adjusted["traits"]["gambit_comfort"] == 0
    assert adjusted["traits"]["open_position_preference"] == 58
    assert adjusted["engine_adjusted"] is True
