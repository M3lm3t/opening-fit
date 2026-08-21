from analysis.recurring_opening_habits import detect_recurring_opening_habits


POSITION = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"


def analysed_game(game_id, move="Nf3", *, recommended="Nc3", change=-120):
    tail = {"Nf3": "Nf6", "Nc3": "Nc6", "d3": "d6"}[move]
    return {
        "gameId": game_id,
        "colour": "white",
        "canonicalOpeningId": "kings-pawn-game",
        "opening": "King's Pawn Game",
        "pgn": f'[White "FixtureUser"]\n[Black "Opponent"]\n\n1. e4 e5 2. {move} {tail} *',
        "moveAnalysis": [{
            "positionFen": POSITION,
            "recommendedMove": recommended,
            "evaluationChangeCp": change,
            "evaluationPerspective": "player",
            "confidence": 0.9,
            "source": "existing_engine_analysis",
        }],
    }


def test_same_bad_move_becomes_a_trustworthy_recurring_mistake():
    habits = detect_recurring_opening_habits([analysed_game(f"bad-{index}") for index in range(6)], user_id="user-1")
    habit = habits[0]
    assert habit["habitType"] == "RECURRING_MISTAKE"
    assert habit["playedMove"] == "Nf3"
    assert habit["recommendedMove"] == "Nc3"
    assert habit["occurrenceCount"] == habit["eligibleOccurrenceCount"] == 6
    assert habit["averageEvaluationChangeCp"] == -120
    assert len(habit["gameReferences"]) == 6
    assert habit["trainingSubjectId"].startswith("opening-position:white:")


def test_same_supported_move_becomes_a_good_habit():
    games = [analysed_game(f"good-{index}", recommended="Nf3", change=-5) for index in range(5)]
    habit = detect_recurring_opening_habits(games, user_id="user-2")[0]
    assert habit["habitType"] == "GOOD_HABIT"
    assert habit["playedMove"] == habit["recommendedMove"] == "Nf3"
    assert habit["engineEvaluationAvailable"] is True


def test_repeated_position_with_split_choices_is_mixed():
    games = [
        analysed_game("mixed-nf3-1", "Nf3", recommended="Nf3", change=-5),
        analysed_game("mixed-nf3-2", "Nf3", recommended="Nf3", change=-5),
        analysed_game("mixed-nc3-1", "Nc3", recommended="Nf3", change=-45),
        analysed_game("mixed-nc3-2", "Nc3", recommended="Nf3", change=-45),
    ]
    habit = detect_recurring_opening_habits(games, user_id="user-3")[0]
    assert habit["habitType"] == "MIXED"
    assert habit["eligibleOccurrenceCount"] == 4
    assert habit["confidence"]["analysedOccurrences"] == 4


def test_insufficient_or_untrusted_evidence_fails_closed():
    insufficient = [analysed_game(f"few-{index}") for index in range(3)]
    untrusted = [analysed_game(f"untrusted-{index}") for index in range(5)]
    for game in untrusted:
        game["moveAnalysis"][0] = {"positionFen": POSITION, "recommendedMove": "Nc3", "confidence": 0.2, "source": "heuristic"}
    assert detect_recurring_opening_habits(insufficient, user_id="user-4") == []
    assert detect_recurring_opening_habits(untrusted, user_id="user-4") == []


def test_missing_canonical_opening_identity_fails_closed():
    games = [analysed_game(f"missing-{index}") for index in range(5)]
    for game in games:
        game.pop("canonicalOpeningId")
    assert detect_recurring_opening_habits(games, user_id="user-5") == []
