import sys
import types
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))


stripe = types.ModuleType("stripe")
sys.modules.setdefault("stripe", stripe)

dotenv = types.ModuleType("dotenv")
dotenv.load_dotenv = lambda *args, **kwargs: None
sys.modules.setdefault("dotenv", dotenv)

supabase = types.ModuleType("supabase")
supabase.create_client = lambda *args, **kwargs: None
supabase.Client = object
sys.modules.setdefault("supabase", supabase)

from backend.main import build_openingfit_suggestion, detect_opening_family_for_position


def test_detects_kings_indian_structure_by_family():
    moves = ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"]

    result = detect_opening_family_for_position(moves)

    assert result["opening"] == "King's Indian Defence"
    assert result["family"] == "King's Indian type setup"
    assert result["confidence"] == "high"
    assert "challenge White's centre" in result["themes"][0]


def test_combined_suggestion_keeps_engine_as_one_signal():
    opening_family = {
        "opening": "King's Indian Defence",
        "family": "King's Indian type setup",
        "confidence": "high",
        "themes": ["challenge White's centre", "create kingside counterplay"],
    }
    engine_result = {
        "enabled": True,
        "bestMove": "...e5",
        "evaluation": {"centipawns": 12, "sideToMove": "black"},
    }

    suggestion = build_openingfit_suggestion(opening_family, engine_result)

    assert (
        suggestion["summary"]
        == "You are playing a King's Indian type setup. The main plan is to challenge White's centre. In this exact position, Stockfish recommends ...e5."
    )
    assert suggestion["engineNote"] == (
        "Engine move included as a position-specific check, not as the whole opening recommendation."
    )
    assert suggestion["pipeline"] == [
        "parse_position",
        "detect_opening_family",
        "analyse_with_stockfish_if_available",
        "combine_signals",
    ]
