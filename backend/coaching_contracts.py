"""Typed shared-domain contracts for persisted coaching-loop state."""

from typing import Literal, NotRequired, TypedDict

CoachingPriorityStatus = Literal["ready", "in_progress", "completed", "superseded", "unavailable"]
CoachingActivityType = Literal[
    "training_session_completed",
    "source_game_review_completed",
    "response_plan_saved",
    "response_plan_recalled",
    "game_check_completed",
    "position_review_completed",
]


class CoachingPriority(TypedDict):
    user_id: str
    report_id: NotRequired[str | None]
    diagnosis_id: NotRequired[str | None]
    decision_id: NotRequired[str | None]
    recommendation_id: NotRequired[str | None]
    repertoire_role: str
    opening_id: NotRequired[str | None]
    opening_name: NotRequired[str | None]
    task_id: str
    status: CoachingPriorityStatus
    evidence_refs: NotRequired[dict[str, object]]


class MeaningfulCoachingActivity(TypedDict):
    user_id: str
    activity_type: CoachingActivityType
    idempotency_key: str
    report_id: NotRequired[str | None]
    task_id: NotRequired[str | None]
    evidence_refs: NotRequired[dict[str, object]]
    occurred_at: NotRequired[str | None]


class WeeklyCoachingGoal(TypedDict):
    target: int
    completed: int
    week_start: str
    week_end: str
    timezone: str


class CoachingGameCheckpoint(TypedDict):
    user_id: str
    platform: str
    username: str
    last_completed_at: str
    last_imported_at: NotRequired[str | None]
    latest_platform_game_id: NotRequired[str | None]
    checked_game_ids: list[str]


class PersonalResponsePlan(TypedDict):
    user_id: str
    repertoire_role: str
    opening_id: NotRequired[str | None]
    diagnosis_id: NotRequired[str | None]
    plan_text: str
    status: Literal["active", "superseded"]
    report_id: NotRequired[str | None]
    task_id: NotRequired[str | None]
