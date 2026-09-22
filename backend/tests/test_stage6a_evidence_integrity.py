from copy import deepcopy

import pytest

from analysis.classified_game import build_classified_game_record
from analysis.opening_perspective import attach_perspective, classify_opening_perspective
from analysis.opening_fit_metrics import build_opening_fit_metrics, merge_opening_fit_metrics
from analysis.opening_recommender import flatten_current_openings, score_for_opening_stats, trait_fit_score, trait_input
from analysis.report_decision import build_report_decision, effective_membership, reports_are_comparable, assert_decision_consistency


def game(number, colour="white", result="win", *, opening="Italian Game", role=None):
    perspective = classify_opening_perspective(user_colour=colour, opening_side="white", first_white_move="e4")
    record = build_classified_game_record(
        game_id=str(number), url=f"https://example.test/{number}", player_colour=colour,
        player_result=result, time_control="rapid", played_at="2026-09-01T12:00:00Z",
        eco="C50", opening_family=opening, variation=None, classification_ply=6,
        perspective=perspective, canonical_opening_id="italian-game", classification_source="fixture",
        matched_opening_rule_id="italian", matched_moves=["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
        first_white_move="e4", first_black_move="e5",
    )
    return {**attach_perspective({"opening": opening, "moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]}, perspective), **record}


def batch(results, **extra):
    return {"name": "Italian Game", "repertoireRole": "white", "games": len(results),
            "wins": results.count("win"), "draws": results.count("draw"), "losses": results.count("loss"), **extra}


def flatten(rows):
    return next(iter(flatten_current_openings(rows).values()))


def test_context_boundaries_and_duplicate_membership():
    games = [game(i) for i in range(5)] + [game(i + 5, "black", "loss") for i in range(5)]
    metrics = build_opening_fit_metrics(games + games)
    assert len(metrics["openings"]) == 2
    rows = {row["playerColour"]: row for row in metrics["openings"]}
    assert (rows["white"]["games"], rows["white"]["wins"], rows["white"]["losses"]) == (5, 5, 0)
    assert (rows["black"]["games"], rows["black"]["wins"], rows["black"]["losses"]) == (5, 0, 5)
    assert set(rows["white"]["supportingGameIds"]).isdisjoint(rows["black"]["supportingGameIds"])
    originals = [{"name": row["name"], "canonicalContextId": row["canonicalContextId"], "supportingGameIds": row["supportingGameIds"]} for row in rows.values()]
    merged = merge_opening_fit_metrics(originals, metrics)
    assert [row["games"] for row in merged] == [5, 5]
    unscoped = {"name": "Italian Game", "games": 10}
    assert merge_opening_fit_metrics([unscoped], metrics) == [unscoped]
    partial = {**originals[0], "supportingGameIds": ["not-in-metrics"], "games": 1}
    assert merge_opening_fit_metrics([partial], metrics) == [partial]


def test_missing_and_ambiguous_context_fail_closed_in_both_orders():
    missing = {"gameId": "missing", "opening": "Italian Game", "colour": "white", "result": "win", "moves": ["e4", "e5", "Nf3", "Nc6"]}
    for rows in ([game(1), game(1, "black"), missing], [missing, game(1, "black"), game(1)]):
        metrics = build_opening_fit_metrics(rows)
        assert metrics["openings"] == []
        assert metrics["excludedEvidence"] == {"ambiguous_attribution": 1, "missing_or_excluded_context": 1}
    assert build_opening_fit_metrics([])["openings"] == []


@pytest.mark.parametrize("results", [["win"] * 5 + ["loss"] * 5, ["win"] * 11 + ["draw"] * 2 + ["loss"] * 5, ["unknown"] * 3, []])
def test_batch_order_and_single_batch_agree(results):
    one = flatten([batch(results)])
    left, right = batch(results[:5], score=99), batch(results[5:], score=1)
    assert flatten([left, right]) == flatten([right, left]) == one
    if len(results) == 10:
        assert one["score"] == one["winRate"] == 50
    elif len(results) == 18:
        assert round(one["score"], 1) == 66.7
        assert round(one["winRate"], 1) == 61.1
    else:
        assert one["score"] is one["winRate"] is None


def test_unknown_outcomes_are_not_losses():
    row = flatten([batch(["win", "unknown"])])
    assert (row["games"], row["knownResults"], row["unknownResults"], row["score"]) == (2, 1, 1, 100)
    metric = build_opening_fit_metrics([game(1, result="unknown")])["openings"][0]
    assert metric["winRate"] is metric["scoreRate"] is None
    assert score_for_opening_stats({"games": 5, "score": 80}) is None
    unknown = build_opening_fit_metrics([game(i, result="unknown") for i in range(20)])["openings"][0]
    assert unknown["confidence"] == "low"


def test_display_aliases_do_not_split_canonical_context():
    games = [game(1), game(2, opening="Italian Opening")]
    first = build_opening_fit_metrics(games)
    assert first == build_opening_fit_metrics(list(reversed(games)))
    assert len(first["openings"]) == len(first["variations"]) == 1
    assert first["openings"][0]["games"] == 2


def test_overlapping_batches_reconcile_per_game_results():
    a = batch(["win", "loss"], supportingGameIds=["a", "b", "b"], supportingGameResults={"a": "win", "b": "loss"})
    b = batch(["loss", "draw"], supportingGameIds=["b", "c"], supportingGameResults={"b": "loss", "c": "draw"})
    for rows in ([a, b], [b, a]):
        result = flatten(rows)
        assert (result["games"], result["wins"], result["draws"], result["losses"], result["score"]) == (3, 1, 1, 1, 50)
    for row in (a, b):
        row.pop("supportingGameResults")
    result = flatten([a, b])
    assert result["games"] == 3 and result["score"] is None
    assert result["performanceEvidenceStatus"] == "overlap_without_results"


@pytest.mark.parametrize("value,status,expected", [(0, "observed", 0), (None, "missing", 50), ("bad", "invalid", 50), (float("nan"), "invalid", 50), (float("inf"), "invalid", 50), (-1, "invalid", 50), (101, "invalid", 50), (True, "invalid", 50)])
def test_trait_contract(value, status, expected):
    assert trait_input({"tactical_tendency": value}, "tactical_tendency") == (expected, status)
    assert trait_fit_score({"fit_weights": {"tactical_tendency": 1}}, {"tactical_tendency": value}) == expected
    assert trait_fit_score({"fit_weights": {"tactical_tendency": -1}}, {"tactical_tendency": value}) == 100 - expected
    assert trait_input({}, "tactical_tendency") == (50, "missing")


@pytest.mark.parametrize("automatic", ["ESTABLISHED", "DORMANT", "CURRENT", "EXPERIMENT", "INSUFFICIENT_EVIDENCE"])
@pytest.mark.parametrize("preference", ["automatic", "main", "experimenting", "ignore"])
def test_membership_matrix(automatic, preference):
    expected = {"main": "MAIN_REPERTOIRE", "experimenting": "EXPERIMENT", "ignore": "IGNORED"}.get(preference, automatic)
    assert effective_membership({"classification": automatic, "userPreference": preference}) == {
        "effectiveClassification": expected, "mainRepertoireEligible": expected not in {"EXPERIMENT", "IGNORED"}}


@pytest.mark.parametrize("preference,eligible", [("automatic", True), ("main", True), ("experimenting", False), ("ignore", False)])
def test_preferences_align_roles_health_and_selected_training(preference, eligible):
    games = [game(i) for i in range(8)]
    metric = build_opening_fit_metrics(games)["openings"][0]
    row = attach_perspective(metric, classify_opening_perspective(user_colour="white", opening_side="white", first_white_move="e4"))
    report = {"analysisId": "stage6a", "username": "Fixture", "platform": "chess.com", "gamesAnalysed": 8,
              "analysis_game_index": games, "repertoirePreferences": [{"repertoireRole": "white", "canonicalOpeningId": "italian-game", "preference": preference}]}
    before = deepcopy(report)
    decision = build_report_decision(report, openings=[row])
    assert report == before
    assert_decision_consistency(decision)
    role = next(item for item in decision["repertoireRoles"] if item["repertoireRole"] == "white")
    assert bool(role["evidenceGameIds"]) == eligible
    assert bool(decision["establishedStrength"]) == eligible
    assert decision["recommendations"][0]["mainRepertoireEligible"] == eligible
    assert role["evidenceFunnel"]["openingBreakdown"][0]["games"] == 8
    if not eligible:
        assert decision["nextTrainingAction"]["type"] != "consolidate_strength"


def test_new_generation_cannot_compare_with_saved_old_health():
    common = {"username": "Fixture", "platform": "chess.com", "gamesAnalysed": 10}
    current = {**common, "importedAt": "2026-09-20T00:00:00Z", "repertoireHealth": {"version": "repertoire_health_v4"}}
    previous = {**common, "importedAt": "2026-09-01T00:00:00Z", "repertoireHealth": {"version": "repertoire_health_v3", "score": 83}}
    before = deepcopy(previous)
    assert not reports_are_comparable(current, previous)
    assert previous == before
    previous["repertoireHealth"]["version"] = "repertoire_health_v4"
    assert reports_are_comparable(current, previous)


def test_aggregate_only_preference_does_not_require_history():
    row = attach_perspective(batch(["win"] * 8, canonicalOpeningId="italian-game"), classify_opening_perspective(user_colour="white", opening_side="white", first_white_move="e4"))
    decision = build_report_decision({"analysisId": "aggregate", "gamesAnalysed": 8}, openings=[row], repertoire_preferences=[{"repertoireRole": "white", "canonicalOpeningId": "italian-game", "preference": "ignore"}])
    assert decision["establishedStrength"] is None
    assert decision["recommendations"][0]["mainRepertoireEligible"] is False
    assert decision["recommendations"][0]["sample"]["games"] == 8


@pytest.mark.parametrize("platform", ["chess.com", "lichess"])
def test_import_callers_keep_same_opening_opposite_colours_separate(monkeypatch, platform):
    import main
    monkeypatch.setattr(main, "previous_saved_report", lambda *_: None)
    monkeypatch.setattr(main, "save_user_profile", lambda username, _: {"username": username, "lastUpdated": "2026-09-01T12:00:00Z", "importHistory": [], "isPremium": False})
    monkeypatch.setattr(main, "log_analytics_event", lambda *_, **__: None)
    moves = "e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 O-O d6 c3 O-O Re1 a6 Bb3 Ba7"
    rows = []
    for i in range(10):
        white, black = ("Fixture", "Opponent") if i < 5 else ("Opponent", "Fixture")
        if platform == "lichess":
            rows.append({"id": str(i), "moves": moves, "opening": {"name": "Italian Game"},
                         "players": {"white": {"user": {"name": white}, "rating": 1500}, "black": {"user": {"name": black}, "rating": 1500}},
                         "winner": "white", "status": "mate", "speed": "rapid", "lastMoveAt": 1788264000000 + i})
        else:
            numbered = " ".join(f"{j // 2 + 1}. {move}" if j % 2 == 0 else move for j, move in enumerate(moves.split()))
            pgn = f'[White "{white}"]\n[Black "{black}"]\n[Result "1-0"]\n\n{numbered} 1-0'
            rows.append({"url": f"https://example.test/game/{i}", "pgn": pgn, "time_class": "rapid", "time_control": "600", "end_time": 1788264000 + i,
                         "white": {"username": white, "result": "win", "rating": 1500}, "black": {"username": black, "result": "checkmated", "rating": 1500}})
    if platform == "lichess":
        import json
        from types import SimpleNamespace
        responses = iter([
            SimpleNamespace(status_code=200, ok=True, json=lambda: {"username": "Fixture"}),
            SimpleNamespace(status_code=200, ok=True, text="\n".join(json.dumps(row) for row in rows + rows)),
        ])
        monkeypatch.setattr(main.requests, "get", lambda *_, **__: next(responses))
        result = main.import_lichess_logic("Fixture", 1)
    else:
        monkeypatch.setattr(main, "validate_player", lambda _: {"username": "Fixture"})
        monkeypatch.setattr(main, "fetch_chesscom_stats", lambda _: {})
        monkeypatch.setattr(main, "fetch_archives", lambda _: ["2026/09"])
        monkeypatch.setattr(main, "fetch_games_from_archive", lambda _: rows + rows)
        result = main.import_chesscom_logic("Fixture", 1)
    metrics = result["opening_fit_metrics"]["openings"]
    assert len(metrics) == 2
    assert {row["games"] for row in metrics} == {5}
    assert {row["playerColour"]: row["wins"] for row in metrics} == {"white": 5, "black": 0}
    candidates = result["reportDecision"]["recommendations"]
    assert candidates
    assert {row["sample"]["games"] for row in candidates} == {5}
    assert all(row["sample"]["wins"] == (5 if row["playerColour"] == "white" else 0) for row in candidates)
    assert len(result["analysis_game_index"]) == 10
    assert result["reportDecision"]["version"] == "report_decision_v7"
    assert_decision_consistency(result["reportDecision"])
