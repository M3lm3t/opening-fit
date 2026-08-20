from typing import get_args

from backend.coaching_contracts import CoachingActivityType, CoachingPriorityStatus


def test_coaching_contract_statuses_are_closed_and_backward_safe():
    assert set(get_args(CoachingPriorityStatus)) == {
        "ready", "in_progress", "completed", "superseded", "unavailable"
    }


def test_only_meaningful_completion_types_enter_the_contract():
    activities = set(get_args(CoachingActivityType))
    assert activities == {
        "training_session_completed", "source_game_review_completed",
        "response_plan_saved", "response_plan_recalled",
        "game_check_completed", "position_review_completed",
    }
    assert activities.isdisjoint({"login", "app_open", "page_view", "report_view"})
