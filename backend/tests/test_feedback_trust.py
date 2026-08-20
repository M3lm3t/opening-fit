import sys
import re
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


def frontend_product_events():
    source = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "productAnalytics.js").read_text(encoding="utf-8")
    registry = source.split("const allowed =", 1)[0]
    return set(re.findall(r'"([a-z][a-z0-9_]+)"', registry))


class Query:
    def __init__(self, rows): self.rows = rows
    def insert(self, item): self.rows.append(item); return self
    def execute(self): return type("Result", (), {"data": self.rows})()


class FeedbackStore:
    def __init__(self): self.rows = []
    def table(self, name): assert name == "feedback"; return Query(self.rows)


def test_anonymous_feedback_saves_without_contact(monkeypatch):
    store = FeedbackStore(); monkeypatch.setattr(main, "supabase", store)
    saved = main.save_feedback("Import failed repeatedly", category="Broken game import", route="/", platform="lichess")
    assert saved["contact"] is None
    assert "Type: Broken game import" in store.rows[0]["message"]


def test_authenticated_feedback_can_include_voluntary_contact(monkeypatch):
    store = FeedbackStore(); monkeypatch.setattr(main, "supabase", store)
    saved = main.save_feedback("Recommendation looks wrong", contact="player@example.com", category="Misidentified opening", report_identifier="lichess:player:report")
    assert saved["contact"] == "player@example.com"
    assert "Report: lichess:player:report" in store.rows[0]["message"]


def test_feedback_storage_failure_is_clear(monkeypatch):
    monkeypatch.setattr(main, "supabase", None)
    with pytest.raises(HTTPException) as error: main.save_feedback("Useful message")
    assert error.value.status_code == 500


def test_cached_public_profile_removal_is_scoped(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "PROFILES_DIR", tmp_path)
    (tmp_path / "lichess_player-one.json").write_text("{}")
    (tmp_path / "chess.com_other-player.json").write_text("{}")
    assert main.delete_cached_user_profiles(["Player-One"]) == 1
    assert not (tmp_path / "lichess_player-one.json").exists()
    assert (tmp_path / "chess.com_other-player.json").exists()


def test_analytics_schema_rejects_sensitive_properties():
    clean = main.sanitize_analytics_data({"platform": "lichess", "route": "/report", "email": "private@example.com", "accessToken": "secret", "pgn": "1. e4", "games": 12})
    assert clean == {"platform": "lichess", "route": "/report", "games": 12}
    assert "analysis_completed" in main.PRODUCT_ANALYTICS_EVENTS
    assert {
        "repertoire_created",
        "repertoire_change_accepted",
        "repertoire_change_rejected",
        "repertoire_training_opened",
    }.issubset(main.PRODUCT_ANALYTICS_EVENTS)
    assert {
        "weekly_plan_started",
        "training_task_started",
        "weekly_plan_completed",
        "training_impact_viewed",
        "training_history_opened",
        "subscription_manage_clicked",
        "upgrade_clicked",
        "portal_open_failed",
    }.issubset(main.PRODUCT_ANALYTICS_EVENTS)


def test_canonical_retention_analytics_events_are_accepted(monkeypatch):
    recorded = []
    monkeypatch.setattr(main, "log_analytics_event", lambda event, data: recorded.append((event, data)))
    retention_events = {
        "today_viewed",
        "today_primary_action_started",
        "today_primary_action_completed",
        "today_no_supported_task",
        "today_new_games_available",
        "weekly_recap_shown",
        "weekly_recap_opened",
        "weekly_recap_dismissed",
        "weekly_recap_action_clicked",
        "training_session_completed",
        "new_games_detected",
    }
    for event in retention_events:
        assert main.analytics_event(main.AnalyticsEventRequest(event=event, data={"source": "contract_test"})) == {"status": "ok"}
    assert {event for event, _data in recorded} == retention_events


def test_backend_allowlist_exactly_covers_frontend_registry():
    assert frontend_product_events() == main.PRODUCT_ANALYTICS_EVENTS


def test_analytics_endpoint_rejects_unknown_and_malformed_events(monkeypatch):
    monkeypatch.setattr(main, "log_analytics_event", lambda _event, _data: None)
    with pytest.raises(HTTPException) as unknown:
        main.analytics_event(main.AnalyticsEventRequest(event="retention_event_not_registered", data={}))
    assert unknown.value.status_code == 400
    with pytest.raises(HTTPException) as malformed:
        main.analytics_event(main.AnalyticsEventRequest(event="   ", data={}))
    assert malformed.value.status_code == 400


def test_analytics_endpoint_strips_private_payload_and_keeps_legacy_event(monkeypatch):
    recorded = []
    monkeypatch.setattr(main, "log_analytics_event", lambda event, data: recorded.append((event, data)))
    result = main.analytics_event(main.AnalyticsEventRequest(event="analysis_completed", data={
        "source": "legacy_flow",
        "username": "private-player",
        "pgn": "1. e4 e5",
        "responsePlanText": "private plan",
        "notificationText": "private reminder",
        "reportContent": "private report",
    }))
    assert result == {"status": "ok"}
    assert recorded == [("analysis_completed", {"source": "legacy_flow"})]


def test_operational_log_details_redact_secrets_and_safely_reference_ids():
    clean = main.safe_log_details({
        "stripe_secret_key": "sk_live_never_log_this",
        "authorization": "Bearer private-token",
        "user_id": "00000000-0000-0000-0000-000000000123",
        "subscription_id": "sub_1234567890abcdef",
        "error": RuntimeError("request failed with whsec_neverlog"),
    })
    rendered = str(clean)
    assert "sk_live_never_log_this" not in rendered
    assert "private-token" not in rendered
    assert "whsec_neverlog" not in rendered
    assert clean["user_id"].startswith("sha256:")
    assert clean["subscription_id"].startswith("...")
