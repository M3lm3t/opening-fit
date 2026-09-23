"""Renaming identity must not alter the same chess evidence or preferences."""
import json
from copy import deepcopy

import pytest

from analysis.opening_fit_metrics import build_opening_fit_metrics
from analysis.opening_perspective import attach_perspective
from analysis.opening_recommender import flatten_current_openings
from analysis.report_decision import build_report_decision
from backend.tests.test_classified_game_attribution import classified_record


@pytest.mark.parametrize("platform", ["chess.com", "lichess"])
@pytest.mark.parametrize("preference", ["main", "ignore"])
def test_identical_chess_evidence_is_invariant_under_player_and_account_renaming(platform, preference):
    fixtures = [
        ("white", "e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6"),
        ("black", "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6"),
        ("black", "d4 d5 c4 e6 Nc3 Nf6 Nf3 Be7"),
    ]
    identities = [
        ("AliceEval", "OpponentOne", "account-alpha"),
        ("BorisEval", "OpponentTwo", "account-beta"),
        ("ChenEval", "OpponentThree", "account-gamma"),
    ]
    outputs = []
    for username, opponent, account in identities:
        games, perspectives = [], {}
        for group, (colour, move_text) in enumerate(fixtures):
            white, black = (username, opponent) if colour == "white" else (opponent, username)
            record, perspective, reason = classified_record(move_text.split(), username=username, white=white, black=black)
            assert reason is None
            perspectives[record["canonicalContextId"]] = perspective
            for index in range(8):
                result = ["win", "draw", "loss", "win"][index % 4]
                games.append({**record, "gameId": f"same-evidence-{group}-{index}", "moves": move_text.split(),
                              "playerResult": result, "username": username, "userId": account,
                              "white_username": white, "black_username": black})
        metrics = build_opening_fit_metrics(games)
        assert len(metrics["openings"]) == 3
        assert {row["playerColour"] for row in metrics["openings"]} == {"white", "black"}
        assert {row["playerRole"] for row in metrics["openings"]} == {"white_repertoire", "black_vs_e4", "black_vs_d4"}
        openings = [attach_perspective(row, perspectives[row["canonicalContextId"]]) for row in metrics["openings"]]
        report = {"analysisId": "same-chess-evidence", "username": username, "playerName": username,
                  "userId": account, "user_id": account, "analysisOwnerUserId": account, "platform": platform,
                  "importedAt": "2026-09-20T12:00:00Z", "gamesAnalysed": 24, "analysis_game_index": games,
                  "isPremium": False, "repertoirePreferences": [
                      {"repertoireRole": "white", "canonicalOpeningId": "italian-game", "preference": preference}]}
        saved = deepcopy(report)
        decision = build_report_decision(report, openings=openings)
        assert report == saved
        assert len(decision["recommendations"]) == 3
        italian = next(row for row in decision["recommendations"] if row["repertoireRole"] == "white")
        assert italian["mainRepertoireEligible"] == (preference == "main")
        # No score/decision fields are stripped: source game/report IDs, evidence,
        # role membership, decisions and performance must all be identical.
        outputs.append(json.dumps({"metrics": metrics, "performance": flatten_current_openings(openings), "decision": decision}, sort_keys=True))
    assert outputs[0] == outputs[1] == outputs[2]
