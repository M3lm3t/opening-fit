from analysis.opening_perspective import attach_perspective, classify_opening_perspective
from analysis.report_decision import build_report_decision
from opening_detection import detect_opening


def classified(moves, user_colour):
    detection = detect_opening(moves)
    perspective = classify_opening_perspective(
        user_colour=user_colour,
        opening_side=detection["openingSide"],
        first_white_move=moves[0],
        classification_source=detection["openingSideSource"],
    )
    return detection, perspective


def opening(name, role, games, score, verdict="Keep"):
    colour = "white" if role.endswith("white") else "black"
    side = colour if role.startswith("played") else ("black" if colour == "white" else "white")
    perspective = classify_opening_perspective(
        user_colour=colour,
        opening_side=side,
        first_white_move="e4",
    )
    return attach_perspective(
        {"name": name, "games": games, "fitScore": score, "verdict": verdict, "evidence": [f"{games} game{'s' if games != 1 else ''} analysed."]},
        perspective,
    )


def report(date="2026-07-23T12:00:00Z", games=12):
    return {
        "platform": "chess.com",
        "username": "player",
        "gamesAnalysed": games,
        "importedAt": date,
    }


def test_user_plays_french_defence_as_black():
    detection, perspective = classified(["e4", "e6", "d4", "d5"], "black")
    assert detection["opening"] == "French Defence"
    assert perspective["role"] == "played_as_black"
    assert perspective["repertoireOwned"] is True
    assert perspective["repertoireSlot"] == "black_vs_e4"


def test_user_faces_french_defence_as_white():
    detection, perspective = classified(["e4", "e6", "d4", "d5"], "white")
    assert detection["opening"] == "French Defence"
    assert perspective["role"] == "faced_as_white"
    assert perspective["repertoireOwned"] is False
    assert perspective["opponentPreparation"] is True


def test_user_plays_scandinavian_defence_as_black():
    detection, perspective = classified(["e4", "d5", "exd5", "Qxd5"], "black")
    assert detection["opening"] == "Scandinavian Defence"
    assert perspective["role"] == "played_as_black"
    assert perspective["repertoireOwned"] is True


def test_user_faces_scandinavian_defence_as_white():
    detection, perspective = classified(["e4", "d5", "exd5", "Qxd5"], "white")
    assert detection["opening"] == "Scandinavian Defence"
    assert perspective["role"] == "faced_as_white"
    assert perspective["repertoireOwned"] is False


def test_white_and_black_transpositions_keep_user_perspective():
    french, as_white = classified(["Nf3", "d5", "e4", "e6", "d4", "Nf6"], "white")
    slav, as_black = classified(["Nf3", "d5", "d4", "c6", "c4", "Nf6"], "black")
    assert french["opening"] == "French Defence"
    assert as_white["role"] == "faced_as_white"
    assert slav["opening"] == "Slav Defence"
    assert as_black["role"] == "played_as_black"
    assert as_black["repertoireSlot"] == "black_vs_other"


def test_one_game_sample_is_never_a_strength_problem_or_perfect_fit_claim():
    decision = build_report_decision(report(games=1), openings=[opening("Italian Game", "played_as_white", 1, 100)])
    assert decision["establishedStrength"] is None
    assert decision["primaryProblem"] is None
    assert decision["nextTrainingAction"]["type"] == "collect_more_games"
    assert decision["confidence"]["status"] == "insufficient_data"


def test_first_report_is_baseline_and_cannot_claim_improvement():
    decision = build_report_decision(report(), openings=[opening("Italian Game", "played_as_white", 8, 72)])
    assert decision["baseline"] == {
        "status": "baseline",
        "hasComparablePrevious": False,
        "comparisonClaimsAllowed": False,
    }


def test_genuine_later_comparable_report_allows_comparison_claims():
    previous = report("2026-06-23T12:00:00Z", games=10)
    decision = build_report_decision(report("2026-07-23T12:00:00Z", games=12), openings=[], previous_report=previous)
    assert decision["baseline"]["status"] == "comparable_later_report"
    assert decision["baseline"]["comparisonClaimsAllowed"] is True


def test_insufficient_evidence_yields_no_established_strength():
    decision = build_report_decision(
        report(games=4),
        openings=[opening("Italian Game", "played_as_white", 2, 90), opening("Vienna Game", "played_as_white", 2, 85)],
    )
    assert decision["establishedStrength"] is None


def test_faced_opening_becomes_preparation_not_repertoire_problem():
    decision = build_report_decision(
        report(),
        openings=[opening("French Defence", "faced_as_white", 6, 25, "Fix")],
    )
    assert decision["primaryProblem"] is None
    assert decision["nextTrainingAction"]["type"] == "prepare_against"
    assert decision["nextTrainingAction"]["label"] == "Prepare against the French Defence"
