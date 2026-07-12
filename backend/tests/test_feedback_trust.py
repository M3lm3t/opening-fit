import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


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
