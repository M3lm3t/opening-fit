from backend.analysis.game_diagnostics import build_diagnostic_summary


def test_diagnostic_summary_detects_patterns_and_weak_variations():
    pgn = """
[White "Demo"]
[Black "Opponent"]
[Opening "Italian Game"]

1. e4 e5 2. Qh5 Nc6 3. Qxf7+ Kxf7 4. Bc4+ d5 5. Bxd5+ Be6 6. Bxe6+ Kxe6
7. Nf3 Nf6 8. Ng5+ Ke7 9. O-O h6 10. Nf3 *
"""
    games = [
        {"pgn": pgn, "opening": "Italian Game", "colour": "white", "result": "loss"},
        {"pgn": pgn, "opening": "Italian Game", "colour": "white", "result": "loss"},
        {"pgn": pgn, "opening": "Italian Game", "colour": "white", "result": "draw"},
        {
            "pgn": """
[White "Demo"]
[Black "Opponent"]
[Opening "Queen Pawn Game"]

1. d4 d5 2. Nf3 Nf6 3. Bf4 e6 4. e3 Be7 5. Bd3 O-O 6. O-O c5
7. c3 Nc6 8. Nbd2 b6 9. h3 Bb7 10. Re1 *
""",
            "opening": "Queen Pawn Game",
            "colour": "white",
            "result": "win",
        },
    ]

    summary = build_diagnostic_summary(games, username="Demo")

    assert summary["method"] == "deterministic_pgn_diagnostics_v1"
    assert summary["main_issue_phase"] in {"opening", "transition"}
    assert summary["confidence"] == "low"
    assert any(item["type"] == "early_queen_move" for item in summary["common_patterns"])
    assert summary["weak_variations"]
    assert summary["weak_variations"][0]["games"] == 3


def test_diagnostic_summary_does_not_call_two_game_line_weak():
    pgn = """
[White "Demo"]
[Black "Opponent"]
[Opening "Scotch Game"]

1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Qh4 5. Nc3 Bb4 6. Be2 Qxe4 *
"""

    summary = build_diagnostic_summary(
        [
            {"pgn": pgn, "opening": "Scotch Game", "colour": "white", "result": "loss"},
            {"pgn": pgn, "opening": "Scotch Game", "colour": "white", "result": "loss"},
        ],
        username="Demo",
    )

    assert summary["confidence"] == "low"
    assert summary["weak_variations"] == []
