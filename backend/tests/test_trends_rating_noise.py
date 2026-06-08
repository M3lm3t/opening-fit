from backend.main import (
    apply_recent_trends_to_openings,
    build_recent_opening_trend_report,
    chesscom_skip_reason,
    opponent_rating_fields,
)


def chesscom_game_with_moves(moves):
    pgn = " ".join(f"{index // 2 + 1}. {moves[index]} {moves[index + 1] if index + 1 < len(moves) else ''}" for index in range(0, len(moves), 2))
    return {
        "rules": "chess",
        "pgn": pgn,
        "white": {"username": "user", "result": "win"},
        "black": {"username": "other", "result": "resigned"},
    }


def trend_game(result, end_time, moves=None):
    return {
        "opening": "Vienna Game",
        "context": "played_as_white",
        "result": result,
        "colour": "white",
        "end_time": end_time,
        "moves": moves or ["e4", "e5", "Nc3", "Nf6", "f4", "d5", "fxe5", "Nxe4", "Nf3", "Be7"],
        "loss_timing": {"bucket": "opening" if result == "loss" else "none"},
    }


def test_chesscom_short_game_filter_uses_full_moves():
    seven_full_moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4", "e5", "d5", "exf6", "dxc4"]
    eight_full_moves = seven_full_moves + ["O-O", "O-O"]

    assert chesscom_skip_reason(chesscom_game_with_moves(seven_full_moves)) == "veryShort"
    assert chesscom_skip_reason(chesscom_game_with_moves(eight_full_moves)) is None


def test_recent_trend_compares_results_early_losses_and_plan_clarity():
    older = [
        trend_game("loss", 1_700_000_000 + index, moves=["e4", "e5", "Nc3", "Nf6", move, "d5", "Nf3", "Nc6"])
        for index, move in enumerate(["f4", "Bc4", "g3", "d3"])
    ]
    recent = [
        trend_game("win", 1_800_000_000 + index)
        for index in range(4)
    ]

    report = build_recent_opening_trend_report(
        recent + older,
        [{"name": "Vienna Game", "context": "played_as_white", "games": 8, "planClarityStatus": "Some plan", "planClarityScore": 60}],
        min_total_games=6,
        min_split_games=3,
    )
    item = report["items"][0]

    assert item["trend"] == "Improving"
    assert item["recent"]["score"] > item["older"]["score"]
    assert item["recent"]["earlyLossRate"] < item["older"]["earlyLossRate"]
    assert item["planClarityDelta"] > 0


def test_recent_trend_and_opponent_rating_adjustments_are_bounded_context():
    adjusted = apply_recent_trends_to_openings(
        [{"name": "Vienna Game", "context": "played_as_white", "games": 8, "fitScore": 70, "confidence": "Medium confidence"}],
        {
            "items": [
                {
                    "opening": "Vienna Game",
                    "context": "played_as_white",
                    "trend": "Declining",
                    "confidence": "Low confidence",
                    "scoreDelta": -20,
                    "summary": "Vienna Game: declining recently.",
                    "advice": "Review recent losses.",
                }
            ]
        },
    )[0]
    rating = opponent_rating_fields(
        {
            "rating_game_count": 6,
            "user_rating_total": 9000,
            "opponent_rating_total": 9600,
        }
    )

    assert adjusted["fitScore"] == 68
    assert adjusted["fitScoreBreakdown"]["recentTrendAdjustment"] == -2
    assert rating["opponentRatingAdjustment"] <= 8
    assert "higher rated" in rating["opponentRatingNote"]
