import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


class _Query:
    def __init__(self, count):
        self.count = count

    def select(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("CountResponse", (), {"count": self.count})()


class _Supabase:
    def __init__(self, count):
        self.count = count

    def table(self, name):
        assert name == "analysed_games"
        return _Query(self.count)


def _reset_cache():
    main.GAMES_ANALYSED_COUNT_CACHE.update({
        "expires_at": datetime.fromtimestamp(0, tz=timezone.utc),
        "payload": None,
    })


def _payload(response):
    return json.loads(response.body)


def test_public_metric_uses_only_exact_saved_analysed_game_rows(monkeypatch):
    _reset_cache()
    monkeypatch.setattr(main, "supabase", _Supabase(8426))
    assert _payload(main.public_games_analysed_count()) == {
        "ok": True,
        "count": 8426,
        "source": "analysed_games_unique_saved_records",
    }


def test_public_metric_is_unavailable_without_database(monkeypatch):
    _reset_cache()
    monkeypatch.setattr(main, "supabase", None)
    assert _payload(main.public_games_analysed_count()) == {
        "ok": False,
        "count": None,
        "source": "unavailable",
    }
