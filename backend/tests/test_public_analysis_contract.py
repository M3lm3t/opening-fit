import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


def test_public_analysis_contract_contains_only_enforced_public_limits():
    contract = main.public_analysis_contract()
    assert contract == {
        "analysisGameLimit": main.ANALYSIS_GAME_LIMIT,
        "freeHistoryMonths": 3,
        "plusHistoryMonths": 12,
        "freeRefreshMinutes": 60,
        "plusRefreshMinutes": 5,
        "freeEvidenceGames": 8,
        "plusEvidenceGames": main.ANALYSIS_EVIDENCE_GAME_LIMIT,
        "freeWeeklyTasks": 1,
        "plusWeeklyTasks": 5,
        "savedReportLimit": 50,
    }
