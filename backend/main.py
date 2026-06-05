import stripe
from collections import Counter, defaultdict
from fastapi.responses import JSONResponse, Response
from intelligence import enrich_analysis_result
from analysis.style_fingerprint import build_style_fingerprint
from analysis.opening_recommender import build_opening_recommendations as build_style_opening_recommendations
from analysis.opening_recommender import build_basic_recommendation_summary
from analysis.engine_analysis import (
    apply_engine_adjustments_to_style_fingerprint,
    build_engine_summary,
)
from analysis.game_diagnostics import build_diagnostic_summary
from analysis.opening_fit_metrics import build_opening_fit_metrics, merge_opening_fit_metrics
from opening_detection import (
    detect_opening,
    detect_opening_from_pgn,
    normalise_opening_name as detect_normalise_opening_name,
    pgn_tag_value,
)
from typing import List, Dict, Any, Optional
import os
from dotenv import load_dotenv
import re
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta
from uuid import UUID

import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client


load_dotenv(".env")
load_dotenv(".env.local", override=False)

app = FastAPI(title="Opening Fit API")

@app.middleware("http")
async def enrich_openingfit_analysis_payloads(request, call_next):
    response = await call_next(request)

    path = request.url.path
    should_enrich = path.startswith("/api/import/") or path == "/api/demo"

    if not should_enrich or response.status_code >= 400:
        return response

    content_type = response.headers.get("content-type", "")

    if "application/json" not in content_type:
        return response

    body = b""

    async for chunk in response.body_iterator:
        body += chunk

    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        return Response(
            content=body,
            status_code=response.status_code,
            media_type=content_type,
        )

    parts = [part for part in path.split("/") if part]
    platform = None
    username = None

    if len(parts) >= 4 and parts[0] == "api" and parts[1] == "import":
        platform = parts[2]
        username = parts[3]

    enriched = enrich_analysis_result(payload, username=username, platform=platform)

    return JSONResponse(
        content=enriched,
        status_code=response.status_code,
    )


FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip()
FRONTEND_URL_WWW = os.getenv("FRONTEND_URL_WWW", "").strip()

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://openingfit.com",
    "https://www.openingfit.com",
]

if FRONTEND_URL:
    allowed_origins.append(FRONTEND_URL)

if FRONTEND_URL_WWW:
    allowed_origins.append(FRONTEND_URL_WWW)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


CHESSCOM_HEADERS = {
    "User-Agent": "Mozilla/5.0 OpeningFit/1.0"
}

LICHESS_HEADERS = {
    "Accept": "application/x-ndjson",
    "User-Agent": "OpeningFit/1.0",
}


DATA_DIR = Path("data")
PROFILES_DIR = DATA_DIR / "profiles"
ANALYTICS_FILE = DATA_DIR / "analytics.jsonl"

DATA_DIR.mkdir(exist_ok=True)
PROFILES_DIR.mkdir(exist_ok=True)


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


class FeedbackRequest(BaseModel):
    message: str
    contact: Optional[str] = None
    username: Optional[str] = None
    platform: Optional[str] = None


class AnalyticsEventRequest(BaseModel):
    event: str
    data: Optional[Dict[str, Any]] = None


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def safe_username(username: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "", username.strip().lower())


def profile_path(username: str, platform: str = "chess.com") -> Path:
    platform_key = re.sub(r"[^a-zA-Z0-9_-]", "", platform.strip().lower())
    return PROFILES_DIR / f"{platform_key}_{safe_username(username)}.json"


def save_user_profile(username: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    clean_username = safe_username(username)
    platform = payload.get("platform", "chess.com")

    profile = {
        "username": username,
        "usernameKey": clean_username,
        "platform": platform,
        "lastUpdated": now_iso(),
        "isPremium": False,
        "importHistory": [],
        "latestResult": payload,
    }

    existing_path = profile_path(username, platform)

    if existing_path.exists():
        try:
            existing = json.loads(existing_path.read_text())
            profile["isPremium"] = existing.get("isPremium", False)
            profile["importHistory"] = existing.get("importHistory", [])
        except Exception:
            pass

    games_imported = (
        payload.get("gamesImported")
        or payload.get("total_games")
        or payload.get("totalGames")
        or 0
    )

    months_checked = (
        payload.get("monthsChecked")
        or payload.get("months_checked")
        or payload.get("months")
        or None
    )

    profile["importHistory"].insert(
        0,
        {
            "date": now_iso(),
            "platform": platform,
            "gamesImported": games_imported,
            "monthsChecked": months_checked,
        },
    )

    profile["importHistory"] = profile["importHistory"][:20]

    existing_path.write_text(json.dumps(profile, indent=2))
    return profile


def load_user_profile(username: str, platform: Optional[str] = None):
    possible_paths = []

    if platform:
        possible_paths.append(profile_path(username, platform))

    possible_paths.append(profile_path(username, "chess.com"))
    possible_paths.append(profile_path(username, "chesscom"))
    possible_paths.append(profile_path(username, "lichess"))
    possible_paths.append(PROFILES_DIR / f"{safe_username(username)}.json")

    for path in possible_paths:
        if not path.exists():
            continue

        try:
            return json.loads(path.read_text())
        except Exception:
            return None

    return None


def log_analytics_event(event_name: str, data: Optional[Dict[str, Any]] = None):
    event = {
        "event": event_name,
        "date": now_iso(),
        "data": data or {},
    }

    with ANALYTICS_FILE.open("a") as f:
        f.write(json.dumps(event) + "\n")


def save_feedback(
    message: str,
    contact: Optional[str] = None,
    username: Optional[str] = None,
    platform: Optional[str] = None,
):
    item = {
        "message": message.strip(),
        "contact": contact.strip() if contact else None,
        "username": username.strip() if username else None,
        "platform": platform.strip() if platform else None,
    }

    if not supabase:
        print("Supabase feedback insert failed: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        raise HTTPException(
            status_code=500,
            detail="Feedback storage is not configured.",
        )

    try:
        supabase.table("feedback").insert(item).execute()
    except Exception as exc:
        print("Supabase feedback insert failed:", exc)
        raise HTTPException(
            status_code=500,
            detail="Could not save feedback.",
        )

    return {
        "date": now_iso(),
        **item,
    }


@app.get("/")
def root():
    return {
        "message": "Opening Fit backend is running",
        "health": "/health",
        "api_health": "/api/health",
        "demo": "/api/demo",
        "chesscom_import": "/api/import/chesscom/{username}",
        "lichess_import": "/api/import/lichess/{username}",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/health")
def api_health():
    return {"status": "ok"}


@app.get("/debug/chesscom/{username}")
def debug_chesscom(username: str):
    url = f"https://api.chess.com/pub/player/{username.lower()}"
    try:
        response = requests.get(url, headers=CHESSCOM_HEADERS, timeout=20)
        return {
            "url": url,
            "status_code": response.status_code,
            "text_preview": response.text[:300],
        }
    except requests.RequestException as exc:
        return {
            "url": url,
            "error": str(exc),
        }


@app.get("/api/debug/chesscom/{username}")
def api_debug_chesscom(username: str):
    return debug_chesscom(username)


@app.get("/api/debug/lichess/{username}")
def api_debug_lichess(username: str):
    url = f"https://lichess.org/api/user/{username}"
    try:
        response = requests.get(
            url,
            headers={"User-Agent": "OpeningFit/1.0"},
            timeout=20,
        )
        return {
            "url": url,
            "status_code": response.status_code,
            "text_preview": response.text[:300],
        }
    except requests.RequestException as exc:
        return {
            "url": url,
            "error": str(exc),
        }


def safe_get(url: str) -> Dict[str, Any]:
    try:
        response = requests.get(url, headers=CHESSCOM_HEADERS, timeout=20)
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not connect to Chess.com. Request failed: {str(exc)}",
        )

    if response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail="Could not find that Chess.com username or public game archive.",
        )

    if response.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="Chess.com is rate limiting requests. Try again in a minute.",
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Chess.com API returned status {response.status_code}. Try again later.",
        )

    try:
        return response.json()
    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="Chess.com returned invalid data. Try again later.",
        )


def validate_player(username: str) -> Dict[str, Any]:
    url = f"https://api.chess.com/pub/player/{username.lower()}"
    return safe_get(url)


def fetch_archives(username: str) -> List[str]:
    url = f"https://api.chess.com/pub/player/{username.lower()}/games/archives"
    data = safe_get(url)
    archives = data.get("archives", [])

    if not archives:
        raise HTTPException(
            status_code=404,
            detail=f"This Chess.com profile exists, but no public games were found for '{username}'.",
        )

    return archives


def fetch_games_from_archive(archive_url: str) -> List[Dict[str, Any]]:
    data = safe_get(archive_url)
    return data.get("games", [])


def clean_moves_from_pgn(pgn: str) -> List[str]:
    if not pgn:
        return []

    lines = []
    for line in pgn.splitlines():
        if not line.startswith("["):
            lines.append(line)

    move_text = " ".join(lines)
    move_text = re.sub(r"\{[^}]*\}", " ", move_text)
    move_text = re.sub(r"\([^)]*\)", " ", move_text)
    move_text = re.sub(r"\d+\.(\.\.)?", " ", move_text)
    move_text = re.sub(r"1-0|0-1|1/2-1/2|\*", " ", move_text)
    move_text = re.sub(r"\$\d+", " ", move_text)
    move_text = re.sub(r"\s+", " ", move_text).strip()

    return move_text.split() if move_text else []


def normalize_opening_name(name: str) -> str:
    return detect_normalise_opening_name(name)


def pgn_tag_opening(pgn: str) -> str:
    return pgn_tag_value(pgn, "Opening")


def is_kings_indian_structure(seq: List[str]) -> bool:
    """Recognise KID by pawn/piece structure, not just exact move order."""
    early = seq[:14]
    early_lower = [move.lower().replace("+", "").replace("#", "") for move in early]

    white_moves = early_lower[0::2]
    black_moves = early_lower[1::2]

    starts_as_queen_pawn_game = bool(early_lower and early_lower[0] in {"d4", "c4", "nf3"})
    white_has_queen_pawn_center = "d4" in white_moves and (
        "c4" in white_moves
        or (
            starts_as_queen_pawn_game
            and any(move in white_moves for move in {"nf3", "nc3", "g3", "e4"})
        )
    )
    black_has_kid_shell = (
        "nf6" in black_moves
        and "g6" in black_moves
        and ("bg7" in black_moves or len(black_moves) <= 4)
    )
    black_has_kid_center = (
        "d6" in black_moves
        or "o-o" in black_moves
        or "e5" in black_moves
        or "c5" in black_moves
        or len(black_moves) <= 4
    )

    if not (white_has_queen_pawn_center and black_has_kid_shell and black_has_kid_center):
        return False

    # A quick ...d5 after ...Nf6/...g6 is much more likely to be a Grünfeld.
    if "d5" in black_moves:
        d5_index = black_moves.index("d5")
        g6_index = black_moves.index("g6") if "g6" in black_moves else 99
        if d5_index <= g6_index + 2:
            return False

    return True


def opening_from_move_sequence(moves: List[str]) -> str:
    seq = moves[:12]
    s = " ".join(seq)

    if s.startswith("e4 e5 Nc3"):
        if "f4" in seq[:8]:
            return "Vienna Game"
        return "Vienna / Closed Game"

    if s.startswith("e4 e5 Nf3 Nc6 Bb5"):
        return "Ruy Lopez"

    if s.startswith("e4 e5 Nf3 Nc6 Bc4"):
        return "Italian Game"

    if s.startswith("e4 e5 Nf3 Nc6 d4"):
        return "Scotch Game"

    if s.startswith("e4 e5 Nf3 Nc6 Nc3"):
        return "Four Knights Game"

    if s.startswith("e4 c5"):
        return "Sicilian Defence"

    if s.startswith("e4 e6"):
        return "French Defence"

    if s.startswith("e4 c6"):
        return "Caro-Kann Defence"

    if s.startswith("e4 d5"):
        return "Scandinavian Defence"

    if s.startswith("d4 d5 Bf4"):
        return "London System"

    if s.startswith("d4 d5 c4"):
        return "Queen's Gambit"

    if is_kings_indian_structure(moves):
        return "King's Indian Defence"

    if s.startswith("d4 Nf6 c4 g6") and "d5" in seq[:8]:
        return "Grünfeld Defence"

    if s.startswith("d4 Nf6 Bf4"):
        return "London System"

    if s.startswith("c4"):
        return "English Opening"

    if s.startswith("Nf3"):
        return "Réti Opening"

    if s.startswith("e4 d6"):
        return "Pirc Defence"

    if s.startswith("e4 g6"):
        return "Modern Defence"

    if s.startswith("e4 e5 Nf3"):
        return "Open Game"

    if len(seq) >= 2 and seq[0] == "d4" and seq[1] == "d5":
        return "Queen Pawn Game"

    return "Unknown Opening"


def guess_opening_from_pgn(pgn: str) -> str:
    moves = clean_moves_from_pgn(pgn)
    detected = detect_opening_from_pgn(pgn, moves)

    if not is_unknown_opening_name(detected.get("opening", "")):
        return detected["opening"]

    return normalize_opening_name(opening_from_move_sequence(moves))


SKIPPED_REASON_LABELS = {
    "bullet": "Bullet games",
    "variants": "Variants",
    "veryShort": "Very short games",
    "missingOpening": "Missing opening/ECO data",
    "outsideWindow": "Games outside selected import window",
}


def skipped_reason_items(reason_counts: Dict[str, int]) -> List[Dict[str, Any]]:
    return [
        {
            "key": key,
            "label": SKIPPED_REASON_LABELS.get(key, key),
            "count": count,
        }
        for key, count in reason_counts.items()
        if count
    ]


def chesscom_skip_reason(game: Dict[str, Any]) -> Optional[str]:
    if str(game.get("rules", "chess")).lower() not in {"", "chess"}:
        return "variants"

    pgn = game.get("pgn", "")
    moves = clean_moves_from_pgn(pgn)

    if len(moves) < 8:
        return "veryShort"

    if is_unknown_opening_name(guess_opening_from_pgn(pgn)):
        return "missingOpening"

    return None


def lichess_skip_reason(game: Dict[str, Any]) -> Optional[str]:
    variant = game.get("variant") or {}
    variant_key = variant.get("key") if isinstance(variant, dict) else variant

    if str(variant_key or "standard").lower() not in {"", "standard"}:
        return "variants"

    moves = str(game.get("moves") or "").split()

    if len(moves) < 8:
        return "veryShort"

    if is_unknown_opening_name(get_lichess_opening_name(game)):
        return "missingOpening"

    return None


def split_usable_games(
    games: List[Dict[str, Any]],
    reason_getter,
) -> tuple[List[Dict[str, Any]], Dict[str, int]]:
    usable_games = []
    reason_counts = {key: 0 for key in SKIPPED_REASON_LABELS}

    for game in games:
        reason = reason_getter(game)

        if reason:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
        else:
            usable_games.append(game)

    return usable_games, reason_counts


def result_for_user(game: Dict[str, Any], username: str) -> str:
    username = username.lower()
    white_user = game.get("white", {}).get("username", "").lower()
    black_user = game.get("black", {}).get("username", "").lower()

    if white_user == username:
        res = game.get("white", {}).get("result", "")
    elif black_user == username:
        res = game.get("black", {}).get("result", "")
    else:
        return "unknown"

    if res == "win":
        return "win"

    if res in {
        "agreed",
        "repetition",
        "stalemate",
        "insufficient",
        "50move",
        "timevsinsufficient",
    }:
        return "draw"

    return "loss"


def colour_for_user(game: Dict[str, Any], username: str) -> str:
    username = username.lower()

    if game.get("white", {}).get("username", "").lower() == username:
        return "white"

    if game.get("black", {}).get("username", "").lower() == username:
        return "black"

    return "unknown"


def extract_year_month(url: str) -> str:
    parts = url.rstrip("/").split("/")
    if len(parts) >= 2:
        return f"{parts[-2]}-{parts[-1]}"
    return "unknown"


def get_user_moves(game: Dict[str, Any], username: str) -> List[str]:
    moves = clean_moves_from_pgn(game.get("pgn", ""))
    colour = colour_for_user(game, username)

    if colour == "white":
        return [moves[i] for i in range(0, len(moves), 2)]

    if colour == "black":
        return [moves[i] for i in range(1, len(moves), 2)]

    return []


def build_style_profile(games: List[Dict[str, Any]], username: str) -> Dict[str, Any]:
    aggressive = 0
    solid = 0
    tactical = 0
    flexible = 0

    opening_counts = Counter()

    for game in games:
        opening = guess_opening_from_pgn(game.get("pgn", ""))
        opening_counts[opening] += 1
        user_moves = get_user_moves(game, username)
        colour = colour_for_user(game, username)

        joined = " ".join(user_moves[:8]).lower()
        opening_lower = opening.lower()

        if any(
            x in opening_lower
            for x in ["vienna", "sicilian", "scandinavian", "king's indian", "scotch"]
        ):
            aggressive += 2
            tactical += 1

        if any(x in opening_lower for x in ["caro-kann", "french", "london", "queen"]):
            solid += 2

        if "f4" in user_moves[:4] or "g4" in user_moves[:5]:
            aggressive += 2
            tactical += 2

        if "g3" in user_moves[:4] or "b3" in user_moves[:4]:
            flexible += 1

        if colour == "white" and len(user_moves) >= 3 and user_moves[1] in {"Nc3", "Bc4", "f4"}:
            aggressive += 1

        if colour == "black" and "d5" in user_moves[:2]:
            solid += 1

        if colour == "black" and ("g6" in joined or "bg7" in joined):
            flexible += 1

    labels = []

    if aggressive >= solid + 2:
        labels.append("Aggressive")
    elif solid >= aggressive + 2:
        labels.append("Solid")
    else:
        labels.append("Balanced")

    if tactical >= 4:
        labels.append("Tactical")

    if flexible >= 3:
        labels.append("Flexible")

    summary_parts = []

    if "Aggressive" in labels:
        summary_parts.append("You lean toward active positions and practical initiative.")

    if "Solid" in labels:
        summary_parts.append("You often choose stable structures and clear development.")

    if "Balanced" in labels:
        summary_parts.append("You mix active and stable choices rather than forcing one style.")

    if "Tactical" in labels:
        summary_parts.append("Your games suggest you are comfortable in sharper positions.")

    if "Flexible" in labels:
        summary_parts.append("You seem comfortable transposing between different setups.")

    if not summary_parts:
        summary_parts.append("Your style is still developing, which is completely normal.")

    primary_style = " ".join(labels) if labels else "Developing"

    return {
        "primaryStyle": primary_style,
        "labels": labels or ["Developing"],
        "summary": " ".join(summary_parts),
        "top_opening_families": [name for name, _ in opening_counts.most_common(3)],
        "topOpeningFamilies": [name for name, _ in opening_counts.most_common(3)],
        "scores": {
            "aggressive": aggressive,
            "solid": solid,
            "tactical": tactical,
            "flexible": flexible,
        },
    }


def build_lichess_style_profile(
    top_openings: List[Dict[str, Any]],
    preferred_white: List[Dict[str, Any]],
    preferred_black: List[Dict[str, Any]],
) -> Dict[str, Any]:
    aggressive = 0
    solid = 0
    tactical = 0
    flexible = 0

    for item in top_openings:
        opening_lower = item.get("name", "").lower()

        if any(x in opening_lower for x in ["vienna", "sicilian", "scandinavian", "king's indian", "scotch"]):
            aggressive += 2
            tactical += 1

        if any(x in opening_lower for x in ["caro-kann", "french", "london", "queen"]):
            solid += 2

        if any(x in opening_lower for x in ["english", "réti", "reti", "modern", "pirc"]):
            flexible += 2

    labels = []

    if aggressive >= solid + 2:
        labels.append("Aggressive")
    elif solid >= aggressive + 2:
        labels.append("Solid")
    else:
        labels.append("Balanced")

    if tactical >= 3:
        labels.append("Tactical")

    if flexible >= 3:
        labels.append("Flexible")

    if len(top_openings) >= 8:
        labels.append("Wide repertoire")

    if len(top_openings) <= 3:
        labels.append("Focused repertoire")

    top_families = [item["name"] for item in top_openings[:3]]

    summary_parts = []

    if "Aggressive" in labels:
        summary_parts.append("Your Lichess games suggest you often choose active, practical openings.")

    if "Solid" in labels:
        summary_parts.append("Your Lichess games suggest you favour stable structures and clear development.")

    if "Balanced" in labels:
        summary_parts.append("Your Lichess games show a mix of active and solid opening choices.")

    if "Tactical" in labels:
        summary_parts.append("You appear comfortable entering sharper positions.")

    if "Flexible" in labels:
        summary_parts.append("You use openings that can transpose into different structures.")

    if not summary_parts:
        summary_parts.append("Your Lichess opening style is still developing.")

    return {
        "primaryStyle": " ".join(labels) if labels else "Developing",
        "labels": labels or ["Developing"],
        "summary": " ".join(summary_parts),
        "top_opening_families": top_families,
        "topOpeningFamilies": top_families,
        "scores": {
            "aggressive": aggressive,
            "solid": solid,
            "tactical": tactical,
            "flexible": flexible,
        },
    }


def dominant_opening_colour(stats: Dict[str, int]) -> str:
    white_games = int(stats.get("white", 0) or 0)
    black_games = int(stats.get("black", 0) or 0)

    if white_games > black_games:
        return "white"

    if black_games > white_games:
        return "black"

    return "mixed"


SAFE_CONTEXT_FALLBACK_COPY = (
    "We found this opening pattern, but not enough colour/context data to recommend it confidently."
)
PUBLIC_ACCOUNT_CAUTION_COPY = (
    "This appears to be a high-level or public account. OpeningFit is analysing recent online results only, not judging the player’s actual opening knowledge."
)
MASTER_TITLES = {"gm", "im", "fm", "cm", "wgm", "wim", "wfm", "wcm", "nm", "lm"}

BLACK_OPENING_NAME_PATTERNS = [
    "defence",
    "defense",
    "sicilian",
    "french",
    "caro-kann",
    "scandinavian",
    "pirc",
    "modern defence",
    "modern defense",
    "alekhine",
    "dutch",
    "nimzo",
    "queen's indian",
    "king's indian",
    "queen's gambit declined",
    "queen's gambit accepted",
    "grunfeld",
    "grünfeld",
    "slav",
    "benoni",
    "benko",
    "englund",
]

WHITE_OPENING_NAME_PATTERNS = [
    "london",
    "vienna",
    "italian",
    "ruy lopez",
    "spanish",
    "scotch",
    "king's gambit",
    "queen's gambit",
    "english opening",
    "réti",
    "reti",
    "colle",
    "stonewall attack",
    "trompowsky",
    "wayward queen",
    "danish gambit",
    "king's pawn game",
    "queen pawn game",
    "queen's pawn game",
    "center game",
    "centre game",
    "zukertort opening",
    "polish opening",
    "bird's opening",
]


def opening_name_colour_hint(opening: str) -> str:
    lower = (opening or "").lower()

    if any(pattern in lower for pattern in BLACK_OPENING_NAME_PATTERNS):
        return "black"

    if any(pattern in lower for pattern in WHITE_OPENING_NAME_PATTERNS):
        return "white"

    return "unknown"


def is_unknown_opening_name(opening: str) -> bool:
    normalized = (opening or "").strip().lower()

    return (
        not normalized
        or normalized in {"unknown", "unknown opening", "unclassified opening"}
        or "unknown" in normalized
        or "uncommon" in normalized
    )


def extract_first_white_move_from_text(text: str) -> str:
    if not text:
        return ""

    moves_text = "\n".join(
        line for line in text.splitlines() if not line.strip().startswith("[")
    )
    moves_text = re.sub(r"\{[^}]*\}", " ", moves_text)
    moves_text = re.sub(r"\([^)]*\)", " ", moves_text)
    moves_text = re.sub(r"\$\d+", " ", moves_text)

    for token in moves_text.split():
        clean = token.strip()
        clean = re.sub(r"^\d+\.(\.\.)?", "", clean)
        clean = clean.strip()

        if not clean or clean in {"1-0", "0-1", "1/2-1/2", "*"}:
            continue

        return clean.rstrip("+#?!")

    return ""


def black_context_from_first_white_move(first_white_move: str) -> str:
    clean = (first_white_move or "").strip().rstrip("+#?!")

    if clean == "e4":
        return "black_vs_e4"

    if clean == "d4":
        return "black_vs_d4"

    if clean in {"c4", "Nf3", "g3", "b3"}:
        return "black_vs_other"

    return "unknown_mixed"


def opening_context_for_game(colour: str, first_white_move: str) -> str:
    if colour == "white":
        return "played_as_white"

    if colour == "black":
        return black_context_from_first_white_move(first_white_move)

    return "unknown_mixed"


def context_label(context: str) -> str:
    return {
        "played_as_white": "played as White",
        "black_vs_e4": "played as Black vs 1.e4",
        "black_vs_d4": "played as Black vs 1.d4",
        "black_vs_other": "played as Black vs other first moves",
        "black_vs_d4_other": "played as Black vs 1.d4 / other first moves",
        "unknown_mixed": "unknown / mixed",
    }.get(context, "unknown / mixed")


def detect_report_mode(
    *,
    rating: Optional[int] = None,
    title: Optional[str] = None,
    total_games: int = 0,
    player_level: Optional[str] = None,
    username: str = "",
) -> Dict[str, Any]:
    clean_title = str(title or "").strip().lower()
    clean_level = str(player_level or "").strip().lower()
    reasons = []

    if rating and rating >= 2200:
        reasons.append(f"rating {rating}")

    if clean_title in MASTER_TITLES:
        reasons.append(f"title {clean_title.upper()}")

    if any(word in clean_level for word in ["master", "elite", "grandmaster", "international master"]):
        reasons.append(f"level {player_level}")

    if total_games >= 250:
        reasons.append(f"high recent game volume ({total_games})")

    high_rated = bool(rating and rating >= 2200) or clean_title in MASTER_TITLES
    public_possible = total_games >= 250 or any(
        word in clean_level for word in ["master", "elite", "grandmaster", "international master"]
    )

    if public_possible:
        mode = "public_account_possible"
    elif high_rated:
        mode = "high_rated_user"
    else:
        mode = "normal_user"

    return {
        "report_mode": mode,
        "reportMode": mode,
        "reportModeReasons": reasons,
        "publicAccountCaution": PUBLIC_ACCOUNT_CAUTION_COPY if mode != "normal_user" else "",
    }


def public_mode_verdict(verdict: str, games: int) -> str:
    if games < 8:
        return "Not enough context to judge"

    if verdict == "Keep":
        return "Recent strength"

    if verdict == "Improve":
        return "Lower-scoring sample"

    if verdict == "Avoid":
        return "Recent underperformer"

    return "Not enough context to judge"


def adapt_openings_for_report_mode(
    openings: List[Dict[str, Any]],
    report_mode: str,
) -> List[Dict[str, Any]]:
    if report_mode == "normal_user":
        return openings

    adapted = []

    for opening in openings:
        games = int(opening.get("games", 0) or 0)
        original_verdict = str(opening.get("verdict", ""))
        verdict = public_mode_verdict(original_verdict, games)
        adapted.append(
            {
                **opening,
                "originalVerdict": original_verdict,
                "verdict": verdict,
                "fitVerdict": verdict,
                "publicModeNote": PUBLIC_ACCOUNT_CAUTION_COPY,
            }
        )

    return adapted


def context_colour(context: str) -> str:
    if context == "played_as_white":
        return "white"

    if context in {"black_vs_e4", "black_vs_d4", "black_vs_other", "black_vs_d4_other"}:
        return "black"

    return "mixed"


def dominant_opening_context(stats: Dict[str, int]) -> str:
    context_counts = {
        "played_as_white": int(stats.get("played_as_white", 0) or 0),
        "black_vs_e4": int(stats.get("black_vs_e4", 0) or 0),
        "black_vs_d4": int(stats.get("black_vs_d4", 0) or 0),
        "black_vs_other": int(stats.get("black_vs_other", 0) or 0),
        "black_vs_d4_other": int(stats.get("black_vs_d4_other", 0) or 0),
        "unknown_mixed": int(stats.get("unknown_mixed", 0) or 0),
    }
    known = {key: value for key, value in context_counts.items() if value > 0}

    if not known:
        return "unknown_mixed"

    ranked = sorted(known.items(), key=lambda item: item[1], reverse=True)

    if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
        return "unknown_mixed"

    return ranked[0][0]


def empty_opening_stats() -> Dict[str, Any]:
    return {
        "name": "",
        "games": 0,
        "wins": 0,
        "draws": 0,
        "losses": 0,
        "white": 0,
        "black": 0,
        "played_as_white": 0,
        "black_vs_e4": 0,
        "black_vs_d4": 0,
        "black_vs_other": 0,
        "black_vs_d4_other": 0,
        "unknown_mixed": 0,
    }


def opening_item(
    name: str,
    games: int,
    context: str,
    stats: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    stats = stats or {}
    win_rate = None

    if stats.get("games"):
        win_rate = round((stats.get("wins", 0) / stats["games"]) * 100, 1)

    item = {
        "name": name,
        "games": games,
        "wins": int(stats.get("wins", 0) or 0),
        "draws": int(stats.get("draws", 0) or 0),
        "losses": int(stats.get("losses", 0) or 0),
        "context": context,
        "contextLabel": context_label(context),
        "repertoireContext": context,
        "recommendationCopy": SAFE_CONTEXT_FALLBACK_COPY if context == "unknown_mixed" else "",
        "colour": context_colour(context),
        "color": context_colour(context),
        **opening_explanation(name),
    }

    if win_rate is not None:
        item["win_rate"] = win_rate
        item["winRate"] = win_rate

    return item


def context_is_compatible(name: str, context: str) -> bool:
    hint = opening_name_colour_hint(name)

    if context == "played_as_white":
        return hint != "black"

    if context in {"black_vs_e4", "black_vs_d4", "black_vs_other", "black_vs_d4_other"}:
        return hint != "white"

    return False


def repertoire_context_title(opening: Dict[str, Any]) -> str:
    name = str(opening.get("name", "this opening"))
    context = str(opening.get("context") or opening.get("repertoireContext") or "unknown_mixed")
    hint = opening_name_colour_hint(name)

    if context == "played_as_white" and hint == "black":
        return f"facing {name} as White"

    if context in {"black_vs_e4", "black_vs_d4", "black_vs_other", "black_vs_d4_other"} and hint == "white":
        return f"facing {name} as Black"

    if context == "played_as_white":
        return f"{name} as White"

    if context in {"black_vs_e4", "black_vs_d4", "black_vs_other", "black_vs_d4_other"}:
        return f"{name} as Black"

    return f"{name} as a mixed signal"


def is_clean_repertoire_context(opening: Dict[str, Any]) -> bool:
    name = str(opening.get("name", ""))
    context = str(opening.get("context") or opening.get("repertoireContext") or "unknown_mixed")
    return context_is_compatible(name, context)


def build_colour_aware_recommendations(
    opening_results: Dict[str, Dict[str, int]],
    max_items: int = 5,
) -> Dict[str, Any]:
    sections = {
        "white_repertoire": [],
        "black_vs_e4": [],
        "black_vs_d4": [],
        "black_vs_other": [],
        "experimental_rare": [],
        "too_little_data": [],
    }

    for name, stats in opening_results.items():
        display_name = str(stats.get("name") or name).split("::")[0]
        games = int(stats.get("games", 0) or 0)
        context = dominant_opening_context(stats)
        item = opening_item(display_name, games, context, stats)

        if is_unknown_opening_name(display_name):
            sections["too_little_data"].append(
                {
                    **item,
                    "context": "unknown_mixed",
                    "contextLabel": context_label("unknown_mixed"),
                    "repertoireContext": "unknown_mixed",
                    "colour": "mixed",
                    "color": "mixed",
                    "recommendationCopy": SAFE_CONTEXT_FALLBACK_COPY,
                }
            )
            continue

        if games < 2:
            sections["experimental_rare"].append(item)
            continue

        if context == "unknown_mixed" or not context_is_compatible(display_name, context):
            sections["too_little_data"].append(
                {
                    **item,
                    "context": "unknown_mixed",
                    "contextLabel": context_label("unknown_mixed"),
                    "repertoireContext": "unknown_mixed",
                    "colour": "mixed",
                    "color": "mixed",
                    "recommendationCopy": SAFE_CONTEXT_FALLBACK_COPY,
                }
            )
            continue

        section_key = "white_repertoire" if context == "played_as_white" else context
        if section_key == "black_vs_d4_other":
            section_key = "black_vs_d4"

        if section_key in sections:
            sections[section_key].append(item)

    def rank(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return sorted(
            items,
            key=lambda item: (
                item.get("games", 0),
                item.get("win_rate") if item.get("win_rate") is not None else -1,
            ),
            reverse=True,
        )[:max_items]

    sections = {key: rank(value) for key, value in sections.items()}
    black_combined = sections["black_vs_e4"] + sections["black_vs_d4"] + sections["black_vs_other"]
    black_d4_other = sections["black_vs_d4"] + sections["black_vs_other"]

    return {
        **sections,
        "black_vs_d4_other": black_d4_other,
        "white": [item["name"] for item in sections["white_repertoire"]],
        "black": [item["name"] for item in black_combined[:max_items]],
        "blackVsE4": [item["name"] for item in sections["black_vs_e4"]],
        "blackVsD4": [item["name"] for item in sections["black_vs_d4"]],
        "blackVsOther": [item["name"] for item in sections["black_vs_other"]],
        "blackVsD4Other": [item["name"] for item in black_d4_other],
        "whiteDetailed": sections["white_repertoire"],
        "blackDetailed": black_combined[:max_items],
        "blackVsE4Detailed": sections["black_vs_e4"],
        "blackVsD4Detailed": sections["black_vs_d4"],
        "blackVsOtherDetailed": sections["black_vs_other"],
        "blackVsD4OtherDetailed": black_d4_other,
        "experimentalRare": sections["experimental_rare"],
        "tooLittleData": sections["too_little_data"],
        "sections": [
            {
                "key": "white_repertoire",
                "title": "White repertoire",
                "items": sections["white_repertoire"],
            },
            {
                "key": "black_vs_e4",
                "title": "Black vs 1.e4",
                "items": sections["black_vs_e4"],
            },
            {
                "key": "black_vs_d4",
                "title": "Black vs 1.d4",
                "items": sections["black_vs_d4"],
            },
            {
                "key": "black_vs_other",
                "title": "Black vs other first moves",
                "items": sections["black_vs_other"],
            },
            {
                "key": "experimental_rare",
                "title": "Experimental / rare openings",
                "items": sections["experimental_rare"],
            },
            {
                "key": "too_little_data",
                "title": "Too little data",
                "items": sections["too_little_data"],
            },
        ],
    }


def build_opening_scores(opening_results: Dict[str, Dict[str, int]]) -> List[Dict[str, Any]]:
    scored = []

    for opening, stats in opening_results.items():
        display_name = str(stats.get("name") or opening).split("::")[0]
        games = stats["games"]
        wins = stats["wins"]
        draws = stats["draws"]
        losses = stats["losses"]

        if games == 0:
            continue

        win_rate = round((wins / games) * 100, 1)
        score = round((wins + 0.5 * draws) / games, 2)

        if games >= 5:
            if win_rate >= 55:
                verdict = "Keep"
            elif win_rate >= 40:
                verdict = "Improve"
            else:
                verdict = "Avoid"
        else:
            verdict = "Test More"

        context = dominant_opening_context(stats)

        scored.append(
            {
                "name": display_name,
                "games": games,
                "wins": wins,
                "draws": draws,
                "losses": losses,
                "win_rate": win_rate,
                "winRate": win_rate,
                "score": score,
                "verdict": verdict,
                "colour": dominant_opening_colour(stats),
                "color": dominant_opening_colour(stats),
                "context": context,
                "contextLabel": context_label(context),
                "repertoireContext": context,
            }
        )

    scored.sort(key=lambda x: (x["games"] >= 5, x["score"], x["games"]), reverse=True)
    return scored


def weighted_score(items: List[Dict[str, Any]]) -> Optional[float]:
    total_games = sum(int(item.get("games", 0) or 0) for item in items)
    if total_games <= 0:
        return None

    return round(
        sum(float(item.get("winRate", item.get("win_rate", 0)) or 0) * int(item.get("games", 0) or 0) for item in items)
        / total_games,
        1,
    )


def build_opening_fit_profile(
    best_openings: List[Dict[str, Any]],
    opening_recommendations: Dict[str, Any],
    total_games: int,
    style_profile: Dict[str, Any],
) -> Dict[str, Any]:
    openings = [item for item in best_openings if not is_unknown_opening_name(item.get("name", ""))]
    total_opening_games = sum(int(item.get("games", 0) or 0) for item in openings)
    white_items = [item for item in openings if item.get("context") == "played_as_white" or item.get("colour") == "white"]
    black_items = [
        item
        for item in openings
        if item.get("context") in {"black_vs_e4", "black_vs_d4", "black_vs_other", "black_vs_d4_other"}
        or item.get("colour") == "black"
    ]
    black_e4_items = [item for item in openings if item.get("context") == "black_vs_e4"]
    rare_count = len(opening_recommendations.get("experimental_rare", [])) + len(opening_recommendations.get("too_little_data", []))
    weak_items = [
        item
        for item in openings
        if int(item.get("games", 0) or 0) >= 3 and float(item.get("winRate", item.get("win_rate", 50)) or 50) < 40
    ]

    if not openings or total_opening_games <= 0:
        return {
            "opening_fit_score": 0,
            "openingFitScore": 0,
            "opening_fit_score_explanation": "Import more games before assigning an OpeningFit Score.",
            "openingFitScoreExplanation": "Import more games before assigning an OpeningFit Score.",
            "opening_identity": "Repertoire experimenter",
            "openingIdentity": "Repertoire experimenter",
            "opening_identity_explanation": "There is not enough stable opening data yet, so OpeningFit is treating this as an early repertoire snapshot.",
            "openingIdentityExplanation": "There is not enough stable opening data yet, so OpeningFit is treating this as an early repertoire snapshot.",
        }

    top_three_games = sum(int(item.get("games", 0) or 0) for item in sorted(openings, key=lambda item: item.get("games", 0), reverse=True)[:3])
    stability_score = min(100, round((top_three_games / total_opening_games) * 70 + min(len([i for i in openings if i.get("games", 0) >= 5]), 3) * 10))
    white_score = weighted_score(white_items) or weighted_score(openings) or 50
    black_score = weighted_score(black_items) or weighted_score(openings) or 50
    confidence_score = min(100, round((min(total_games, 60) / 60) * 70 + min(len([i for i in openings if i.get("games", 0) >= 5]), 4) * 7.5))
    weakness_score = max(25, 100 - len(weak_items) * 18 - rare_count * 6)
    recent_consistency = 72 if total_games >= 20 else 58

    score = round(
        stability_score * 0.22
        + white_score * 0.20
        + black_score * 0.20
        + confidence_score * 0.18
        + weakness_score * 0.12
        + recent_consistency * 0.08
    )
    score = max(20, min(95, score))

    reasons = []
    if black_score < 45:
        reasons.append("unstable Black results")
    if weighted_score(black_e4_items) is not None and weighted_score(black_e4_items) < 45:
        reasons.append("Black results against 1.e4")
    if white_score < 45:
        reasons.append("lower White performance")
    if confidence_score < 65:
        reasons.append("low confidence from the current sample size")
    if rare_count >= 2:
        reasons.append("several rare or unclear openings")
    if weak_items:
        reasons.append(f"{len(weak_items)} clear lower-scoring opening sample{'s' if len(weak_items) != 1 else ''}")

    if reasons:
        explanation = f"Your score is held back by {', '.join(reasons[:3])}."
    else:
        explanation = "Your score is supported by stable repeated openings, balanced White and Black results, and a useful sample size."

    style_text = " ".join(style_profile.get("labels", []) + [style_profile.get("primaryStyle", ""), style_profile.get("summary", "")]).lower()
    if black_score < 45 and black_score + 8 < white_score:
        identity = "Needs a simpler Black repertoire"
        identity_explanation = "Your White results are ahead of your Black results, so the report points toward simplifying the Black repertoire before adding new systems."
    elif rare_count >= 3 or stability_score < 55:
        identity = "Repertoire experimenter"
        identity_explanation = "Your games are spread across several low-sample openings, which makes the report read more like an experimentation snapshot than a settled repertoire."
    elif "aggressive" in style_text or "tactical" in style_text:
        identity = "Tactical but unstable" if weak_items else "Sharp counter-attacker"
        identity_explanation = "Your best results come from active positions, but the score still depends on whether those sharp lines repeat cleanly across a larger sample."
    elif stability_score >= 72 and min(white_score, black_score) >= 50:
        identity = "Strong with familiar structures"
        identity_explanation = "Your repeated openings are carrying the report, suggesting you score best when you reach familiar pawn structures and plans."
    elif "solid" in style_text or "positional" in style_text:
        identity = "Solid positional player"
        identity_explanation = "Your opening profile leans toward steadier structures, so the best next step is improving one repeated branch rather than changing the whole repertoire."
    else:
        identity = "System-based improver"
        identity_explanation = "Your report points toward a compact repertoire with repeatable plans, especially in the openings with the clearest sample size."

    return {
        "opening_fit_score": score,
        "openingFitScore": score,
        "opening_fit_score_explanation": explanation,
        "openingFitScoreExplanation": explanation,
        "opening_identity": identity,
        "openingIdentity": identity,
        "opening_identity_explanation": identity_explanation,
        "openingIdentityExplanation": identity_explanation,
        "openingFitScoreBreakdown": {
            "stability": stability_score,
            "whitePerformance": round(white_score),
            "blackPerformance": round(black_score),
            "confidence": confidence_score,
            "weaknessControl": weakness_score,
            "recentConsistency": recent_consistency,
        },
    }


def opening_explanation(name: str) -> Dict[str, str]:
    lower = name.lower()

    if "vienna" in lower:
        return {
            "reason": "Fits players who like quick development, attacking chances and natural piece play.",
            "plan": "Develop with Nc3, Bc4 and aim for pressure on the centre or f7.",
            "mistakeToAvoid": "Do not attack too early before your king is safe.",
            "difficulty": "Beginner friendly",
        }

    if "italian" in lower:
        return {
            "reason": "Gives simple development, quick castling and clear attacking ideas.",
            "plan": "Develop pieces quickly, castle early and build pressure in the centre.",
            "mistakeToAvoid": "Avoid moving the same piece repeatedly in the opening.",
            "difficulty": "Beginner friendly",
        }

    if "scotch" in lower:
        return {
            "reason": "Creates open positions quickly, which suits tactical players.",
            "plan": "Open the centre early and use active piece development to create threats.",
            "mistakeToAvoid": "Do not trade into positions where your pieces become passive.",
            "difficulty": "Easy to learn",
        }

    if "scandinavian" in lower:
        return {
            "reason": "Good for players who want direct positions and simple development plans.",
            "plan": "Challenge the centre early, develop quickly and avoid wasting queen moves.",
            "mistakeToAvoid": "Do not move the queen too many times in the opening.",
            "difficulty": "Beginner friendly",
        }

    if "sicilian" in lower:
        return {
            "reason": "Creates unbalanced games with lots of winning chances.",
            "plan": "Fight for the centre from the side and look for counterplay instead of copying White.",
            "mistakeToAvoid": "Do not ignore development while chasing tactics.",
            "difficulty": "Medium",
        }

    if "king's indian" in lower:
        return {
            "reason": "Suits flexible players who like counterattacking setups.",
            "plan": "Develop with g6, Bg7 and look for a later central or kingside break.",
            "mistakeToAvoid": "Do not sit passively without creating counterplay.",
            "difficulty": "Medium",
        }

    if "caro" in lower:
        return {
            "reason": "Good if you want a solid structure with fewer early traps.",
            "plan": "Build a strong centre, develop safely and counterattack later.",
            "mistakeToAvoid": "Do not play too passively after completing development.",
            "difficulty": "Easy to learn, harder to master",
        }

    if "french" in lower:
        return {
            "reason": "Fits solid players who like structure and counterattacking pawn breaks.",
            "plan": "Challenge White's centre with ...c5 and develop with a clear pawn structure.",
            "mistakeToAvoid": "Do not trap your light-squared bishop forever.",
            "difficulty": "Medium",
        }

    if "london" in lower:
        return {
            "reason": "Reliable for players who want repeatable development and low theory.",
            "plan": "Set up Bf4, e3, Nf3, Bd3 and castle before choosing a central break.",
            "mistakeToAvoid": "Do not play the same setup without reacting to your opponent.",
            "difficulty": "Beginner friendly",
        }

    if "queen" in lower:
        return {
            "reason": "Good for players who like stable centres and long-term pressure.",
            "plan": "Control the centre, develop calmly and prepare pressure on the queenside or centre.",
            "mistakeToAvoid": "Do not grab pawns if it slows your development too much.",
            "difficulty": "Beginner to medium",
        }

    if "english" in lower or "réti" in lower or "reti" in lower:
        return {
            "reason": "Fits flexible players who like choosing the structure after seeing the opponent's setup.",
            "plan": "Control the centre from the side and transpose into comfortable structures.",
            "mistakeToAvoid": "Do not become too slow or vague with your development.",
            "difficulty": "Medium",
        }

    return {
        "reason": "This opening appears in your games and may be worth testing further.",
        "plan": "Focus on development, king safety and understanding the first pawn break.",
        "mistakeToAvoid": "Do not judge it from one game. Build a small sample before deciding.",
        "difficulty": "Unknown",
    }


def enrich_opening_list(openings: List[str]) -> List[Dict[str, str]]:
    enriched = []

    for name in openings:
        info = opening_explanation(name)
        enriched.append(
            {
                "name": name,
                **info,
            }
        )

    return enriched


def recommend_openings_from_style(style_profile: Dict[str, Any]) -> Dict[str, Any]:
    labels = style_profile.get("labels", [])

    white_recs = []
    black_recs = []

    if "Aggressive" in labels:
        white_recs.extend(["Vienna Game", "Italian Game", "Scotch Game"])
        black_recs.extend(["Scandinavian Defence", "Sicilian Defence", "King's Indian Defence"])

    if "Solid" in labels:
        white_recs.extend(["London System", "Queen's Gambit", "Italian Game"])
        black_recs.extend(["Caro-Kann Defence", "French Defence", "Queen's Gambit Declined ideas"])

    if "Balanced" in labels:
        white_recs.extend(["Italian Game", "Queen's Gambit", "London System"])
        black_recs.extend(["Caro-Kann Defence", "Scandinavian Defence", "Classical ...e5 setups"])

    if "Tactical" in labels:
        white_recs.extend(["Vienna Game", "Scotch Game"])
        black_recs.extend(["Sicilian Defence", "Scandinavian Defence"])

    if "Flexible" in labels:
        white_recs.extend(["English Opening", "Réti Opening"])
        black_recs.extend(["King's Indian Defence", "Modern Defence"])

    def dedupe(items: List[str]) -> List[str]:
        seen = set()
        out = []

        for item in items:
            if item not in seen:
                seen.add(item)
                out.append(item)

        return out

    white = dedupe(white_recs)[:5]
    black = dedupe(black_recs)[:5]

    return {
        "white": white,
        "black": black,
        "whiteDetailed": enrich_opening_list(white),
        "blackDetailed": enrich_opening_list(black),
    }


STARTER_OPENING_LIBRARY: Dict[str, Dict[str, Any]] = {
    "Italian Game": {
        "role": "white",
        "starterMoves": ["1. e4 e5", "2. Nf3 Nc6", "3. Bc4"],
        "corePlan": "Develop knights and bishops quickly, castle early, then build pressure in the centre or on f7.",
        "commonMistakeAvoided": "It discourages early queen adventures by giving every minor piece a natural square.",
    },
    "Scotch Game": {
        "role": "white",
        "starterMoves": ["1. e4 e5", "2. Nf3 Nc6", "3. d4"],
        "corePlan": "Open the centre early, trade central pawns, and use active pieces before Black finishes development.",
        "commonMistakeAvoided": "It helps avoid slow pawn moves that leave your pieces undeveloped.",
    },
    "Vienna Game": {
        "role": "white",
        "starterMoves": ["1. e4 e5", "2. Nc3 Nf6", "3. Bc4"],
        "corePlan": "Develop naturally, keep attacking chances, and choose f4 ideas only after your pieces are ready.",
        "commonMistakeAvoided": "It gives attacking players a structure so the attack does not start before development.",
    },
    "King's Gambit": {
        "role": "white",
        "starterMoves": ["1. e4 e5", "2. f4"],
        "corePlan": "Use the f-pawn to fight for initiative, then develop quickly and attack before Black consolidates.",
        "commonMistakeAvoided": "It teaches that gambits need development and king safety, not just sacrifices.",
        "advanced": True,
    },
    "London System": {
        "role": "white",
        "starterMoves": ["1. d4 d5", "2. Bf4 Nf6", "3. e3"],
        "corePlan": "Build a repeatable setup with Bf4, e3, Nf3, Bd3 and castle before choosing a central break.",
        "commonMistakeAvoided": "It reduces random early pawn moves by giving a simple development order.",
    },
    "Queen's Gambit": {
        "role": "white",
        "starterMoves": ["1. d4 d5", "2. c4"],
        "corePlan": "Use the c-pawn to challenge Black's centre, develop calmly, and play for long-term pressure.",
        "commonMistakeAvoided": "It helps avoid passive development by making the centre the main question.",
    },
    "Colle System": {
        "role": "white",
        "starterMoves": ["1. d4 d5", "2. Nf3 Nf6", "3. e3"],
        "corePlan": "Build a solid centre, develop behind it, then prepare e4 when your pieces are ready.",
        "commonMistakeAvoided": "It keeps the queen home and makes development more automatic.",
    },
    "Catalan-style setups": {
        "role": "white",
        "starterMoves": ["1. d4 d5", "2. c4 e6", "3. g3"],
        "corePlan": "Fianchetto the bishop, pressure the long diagonal, and play for positional control.",
        "commonMistakeAvoided": "It teaches long-term pressure instead of one-move attacks.",
        "futureUpgrade": True,
    },
    "e5 systems": {
        "role": "blackVsE4",
        "starterMoves": ["1. e4 e5", "2. Nf3 Nc6"],
        "corePlan": "Meet White in the centre, develop naturally, and castle before choosing a counterattack.",
        "commonMistakeAvoided": "It prevents passive beginner defence by giving Black central space and active pieces.",
    },
    "Scandinavian Defence": {
        "role": "blackVsE4",
        "starterMoves": ["1. e4 d5", "2. exd5 Qxd5", "3. Nc3 Qa5"],
        "corePlan": "Challenge the centre immediately, move the queen once to safety, then develop quickly.",
        "commonMistakeAvoided": "It highlights why repeated queen moves cost time.",
    },
    "Caro-Kann Defence": {
        "role": "blackVsE4",
        "starterMoves": ["1. e4 c6", "2. d4 d5"],
        "corePlan": "Build a solid centre, develop safely, and counterattack after your structure is stable.",
        "commonMistakeAvoided": "It avoids early weaknesses and teaches patient development.",
    },
    "French Defence": {
        "role": "blackVsE4",
        "starterMoves": ["1. e4 e6", "2. d4 d5"],
        "corePlan": "Challenge White's centre and prepare ...c5 while developing around a strong pawn chain.",
        "commonMistakeAvoided": "It teaches not to ignore the light-squared bishop and queenside development.",
    },
    "Queen's Gambit Declined": {
        "role": "blackVsD4",
        "starterMoves": ["1. d4 d5", "2. c4 e6"],
        "corePlan": "Hold the centre, develop solidly, and prepare ...Nf6, ...Be7 and castling.",
        "commonMistakeAvoided": "It avoids grabbing pawns before development is complete.",
    },
    "Queen's Gambit Declined setup": {
        "role": "blackVsD4",
        "starterMoves": ["1. d4 d5", "2. c4 e6", "3. Nc3 Nf6"],
        "corePlan": "Use a simple Queen's Gambit Declined structure against most d4 systems.",
        "commonMistakeAvoided": "It gives beginners one reliable setup instead of a new defence every game.",
    },
    "Slav Defence": {
        "role": "blackVsD4",
        "starterMoves": ["1. d4 d5", "2. c4 c6"],
        "corePlan": "Support the d5 pawn with ...c6, develop actively, and keep a sturdy centre.",
        "commonMistakeAvoided": "It avoids weakening the centre before your pieces are ready.",
    },
    "Dutch Defence": {
        "role": "blackVsD4",
        "starterMoves": ["1. d4 f5"],
        "corePlan": "Fight for kingside space and attacking chances while developing carefully.",
        "commonMistakeAvoided": "It reminds aggressive players not to weaken their king without development.",
        "advanced": True,
    },
    "King's Indian as future option": {
        "role": "blackVsD4",
        "starterMoves": ["1. d4 Nf6", "2. c4 g6", "3. Nc3 Bg7"],
        "corePlan": "Develop flexibly, castle, then look for central or kingside counterplay.",
        "commonMistakeAvoided": "It warns against sitting passively in cramped positions.",
        "futureUpgrade": True,
    },
}


THEORY_HEAVY_FUTURE_UPGRADES = [
    "Sicilian Najdorf",
    "Dragon Sicilian",
    "Grünfeld Defence",
    "Benoni Defence",
    "Advanced Catalan systems",
    "Highly theoretical King's Indian lines",
]


def opening_data_reliability(
    best_openings: List[Dict[str, Any]],
    top_openings: List[Dict[str, Any]],
    games_analyzed: int,
) -> Dict[str, Any]:
    known = [
        item
        for item in (best_openings or top_openings or [])
        if not is_unknown_opening_name(item.get("name", ""))
    ]
    repeated = [item for item in known if int(item.get("games", 0) or 0) >= 3]
    strong = [item for item in known if int(item.get("games", 0) or 0) >= 5]
    total_known_games = sum(int(item.get("games", 0) or 0) for item in known)
    reasons = []

    if games_analyzed < 10:
        reasons.append("fewer than 10 analysed games")
    if games_analyzed < 5:
        reasons.append("fewer than 5 analysed games")
    if not repeated:
        reasons.append("no repeated opening pattern yet")
    if total_known_games < max(3, round(games_analyzed * 0.45)):
        reasons.append("recognised opening coverage is low")
    if not strong:
        reasons.append("no opening has enough games for high confidence")

    low_data = games_analyzed < 10 or not repeated or total_known_games < max(3, round(games_analyzed * 0.45))

    return {
        "lowData": low_data,
        "low_data": low_data,
        "gamesAnalyzed": games_analyzed,
        "games_analyzed": games_analyzed,
        "recognizedOpeningGames": total_known_games,
        "recognized_opening_games": total_known_games,
        "repeatedOpeningCount": len(repeated),
        "repeated_opening_count": len(repeated),
        "strongOpeningCount": len(strong),
        "strong_opening_count": len(strong),
        "reasons": reasons or ["opening history is strong enough for detected-opening recommendations"],
    }


def enrich_style_profile_for_starters(style_profile: Dict[str, Any]) -> Dict[str, Any]:
    scores = style_profile.get("scores", {}) or {}
    aggressive = int(scores.get("aggressive", 0) or 0)
    solid = int(scores.get("solid", 0) or 0)
    tactical = int(scores.get("tactical", 0) or 0)
    flexible = int(scores.get("flexible", 0) or 0)
    labels = set(style_profile.get("labels", []))

    return {
        **style_profile,
        "styleSignals": {
            "aggression": "aggressive" if aggressive > solid + 1 else "solid" if solid > aggressive + 1 else "balanced",
            "tacticalAbility": "tactical" if tactical >= 3 or "Tactical" in labels else "positional",
            "developmentHabits": "developing" if aggressive + solid + flexible < 3 else "patterned",
            "kingSafety": "unknown",
            "positionPreference": "open" if aggressive >= solid else "closed or structured",
            "pieceActivity": "attacking" if aggressive >= solid else "controlled",
            "exchanges": "unknown",
            "winPatterns": "tactical attacks" if tactical >= 3 else "practical structure",
        },
        "style_signals": {
            "aggression": "aggressive" if aggressive > solid + 1 else "solid" if solid > aggressive + 1 else "balanced",
            "tactical_ability": "tactical" if tactical >= 3 or "Tactical" in labels else "positional",
            "development_habits": "developing" if aggressive + solid + flexible < 3 else "patterned",
            "king_safety": "unknown",
            "position_preference": "open" if aggressive >= solid else "closed or structured",
            "piece_activity": "attacking" if aggressive >= solid else "controlled",
            "exchanges": "unknown",
            "win_patterns": "tactical attacks" if tactical >= 3 else "practical structure",
        },
    }


def starter_opening_names_for_style(style_profile: Dict[str, Any], games_analyzed: int) -> Dict[str, List[str]]:
    labels = set(style_profile.get("labels", []))
    scores = style_profile.get("scores", {}) or {}
    aggressive = int(scores.get("aggressive", 0) or 0)
    solid = int(scores.get("solid", 0) or 0)
    tactical = int(scores.get("tactical", 0) or 0)
    beginner = games_analyzed < 10 or not labels or "Developing" in labels
    positional = "Solid" in labels and tactical < 3 and aggressive <= solid

    if beginner:
        return {
            "white": ["Italian Game", "London System", "Queen's Gambit"],
            "blackVsE4": ["e5 systems", "Caro-Kann Defence"],
            "blackVsD4": ["Queen's Gambit Declined setup"],
        }

    if "Aggressive" in labels or tactical >= 4:
        return {
            "white": ["Italian Game", "Scotch Game", "Vienna Game", "King's Gambit"],
            "blackVsE4": ["Scandinavian Defence", "Caro-Kann Defence", "e5 systems"],
            "blackVsD4": ["Queen's Gambit Declined", "Dutch Defence"],
        }

    if positional:
        return {
            "white": ["Queen's Gambit", "Colle System", "Catalan-style setups"],
            "blackVsE4": ["Caro-Kann Defence", "French Defence"],
            "blackVsD4": ["Queen's Gambit Declined", "Slav Defence", "King's Indian as future option"],
        }

    return {
        "white": ["London System", "Italian Game", "Queen's Gambit"],
        "blackVsE4": ["Caro-Kann Defence", "French Defence", "e5 systems"],
        "blackVsD4": ["Queen's Gambit Declined", "Slav Defence"],
    }


def build_style_recommendation_item(name: str, style_profile: Dict[str, Any], reliability: Dict[str, Any], games_analyzed: int) -> Dict[str, Any]:
    library = STARTER_OPENING_LIBRARY.get(name, {})
    labels = style_profile.get("labels", ["Developing"])
    label_text = ", ".join(labels)
    low_data = bool(reliability.get("lowData"))
    confidence = "Medium Confidence" if games_analyzed >= 5 else "Low Confidence"
    if not low_data and reliability.get("repeatedOpeningCount", 0) >= 2:
        confidence = "Low Confidence"
    if games_analyzed >= 10 and low_data:
        confidence = "Medium Confidence"

    future = bool(library.get("futureUpgrade") or library.get("advanced"))
    if future:
        confidence = "Low Confidence"

    return {
        "name": name,
        "role": library.get("role", "general"),
        "label": "Style-Based Recommendation",
        "recommendationType": "style_based",
        "recommendation_type": "style_based",
        "confidence": confidence,
        "confidenceLevel": confidence,
        "confidence_level": confidence,
        "whyItFits": f"{name} fits your current {label_text.lower()} profile because it gives you a clearer opening plan without depending on a large existing repertoire sample.",
        "why_it_fits": f"{name} fits your current {label_text.lower()} profile because it gives you a clearer opening plan without depending on a large existing repertoire sample.",
        "corePlan": library.get("corePlan", opening_explanation(name).get("plan")),
        "core_plan": library.get("corePlan", opening_explanation(name).get("plan")),
        "commonMistakeAvoided": library.get("commonMistakeAvoided", opening_explanation(name).get("mistakeToAvoid")),
        "common_mistake_avoided": library.get("commonMistakeAvoided", opening_explanation(name).get("mistakeToAvoid")),
        "starterMoveSequence": library.get("starterMoves", []),
        "starter_move_sequence": library.get("starterMoves", []),
        "futureUpgrade": future,
        "future_upgrade": future,
    }


def build_style_based_recommendations(
    style_profile: Dict[str, Any],
    best_openings: List[Dict[str, Any]],
    top_openings: List[Dict[str, Any]],
    games_analyzed: int,
) -> Dict[str, Any]:
    reliability = opening_data_reliability(best_openings, top_openings, games_analyzed)
    enriched_style = enrich_style_profile_for_starters(style_profile)
    names_by_role = starter_opening_names_for_style(enriched_style, games_analyzed)
    sections = []

    for key, title in [
        ("white", "White"),
        ("blackVsE4", "Black vs 1.e4"),
        ("blackVsD4", "Black vs 1.d4"),
    ]:
        items = [
            build_style_recommendation_item(name, enriched_style, reliability, games_analyzed)
            for name in names_by_role.get(key, [])
        ]
        sections.append({"key": key, "title": title, "items": items})

    future_upgrades = [
        {
            "name": name,
            "label": "Future Upgrade Opening",
            "reason": "Theory-heavy opening. Add this later after your starter repertoire is stable.",
        }
        for name in THEORY_HEAVY_FUTURE_UPGRADES
    ]

    return {
        "enabled": bool(reliability["lowData"]),
        "optional": not bool(reliability["lowData"]),
        "title": "Starter Opening Recommendations",
        "message": "We couldn't find enough repeated opening data yet, so OpeningFit is recommending openings based on your playing style.",
        "analysisVersion": "style-starters-v1",
        "analysis_version": "style-starters-v1",
        "generatedAt": now_iso(),
        "generated_at": now_iso(),
        "gamesAnalyzed": games_analyzed,
        "games_analyzed": games_analyzed,
        "styleProfile": enriched_style,
        "style_profile": enriched_style,
        "dataReliability": reliability,
        "data_reliability": reliability,
        "sections": sections,
        "futureUpgradeOpenings": future_upgrades,
        "future_upgrade_openings": future_upgrades,
    }


def build_training_plan(
    style_profile: Dict[str, Any],
    preferred_white: List[Dict[str, Any]],
    preferred_black: List[Dict[str, Any]],
    best_openings: List[Dict[str, Any]],
    report_mode: str = "normal_user",
) -> List[str]:
    plan = []
    public_mode = report_mode != "normal_user"

    if preferred_white:
        if public_mode:
            plan.append(f"As White, {preferred_white[0]['name']} is a recent recurring sample to review by move order and opponent pool.")
        else:
            plan.append(f"As White, play {preferred_white[0]['name']} for your next 10 to 15 games.")

    if preferred_black:
        if public_mode:
            plan.append(f"As Black, review the recent {preferred_black[0]['name']} sample as an online-results trend, not a knowledge verdict.")
        else:
            plan.append(f"As Black, stick with {preferred_black[0]['name']} and learn the first 6 to 8 moves well.")

    usable_best_openings = [
        opening for opening in best_openings if not is_unknown_opening_name(opening.get("name", ""))
    ]

    if usable_best_openings:
        top = usable_best_openings[0]
        top_title = repertoire_context_title(top)
        top_is_clean = is_clean_repertoire_context(top)

        if public_mode and top["games"] < 8:
            plan.append(f"{top_title} is too small a sample for a hard verdict.")
        elif public_mode:
            plan.append(f"Treat {top_title} as a recent performance trend and compare it with opponent strength and time control.")
        elif not top_is_clean:
            plan.append(f"Track {top_title} by side/context before treating it as a repertoire recommendation.")
        elif top["games"] < 8:
            plan.append(f"Treat {top_title} as an emerging pattern and collect more games before judging it.")
        elif top["verdict"] == "Keep":
            plan.append(f"Keep building around {top_title}. It is currently your best practical opening in that context.")
        elif top["verdict"] == "Improve":
            plan.append(f"Keep {top_title} in your pool, but review the early middlegame plans.")
        elif top["verdict"] == "Avoid":
            plan.append(f"Review {top_title} before using it again as a main repertoire choice.")

    labels = style_profile.get("labels", [])

    if "Aggressive" in labels:
        plan.append("Study 2 tactical motifs from your main openings and look for initiative before material.")

    if "Solid" in labels:
        plan.append("Focus on development, king safety and reaching familiar pawn structures every game.")

    if "Tactical" in labels:
        plan.append("After each game, review where tactics first appeared rather than only the final blunder.")

    if "Flexible" in labels:
        plan.append("Choose one main line and one backup line so flexibility does not become inconsistency.")

    plan.append("Do not switch openings every session. Give one opening a real test sample before judging it.")

    return plan[:6]


def build_recommended_action(
    preferred_white: List[Dict[str, Any]],
    preferred_black: List[Dict[str, Any]],
    best_openings: List[Dict[str, Any]],
    training_plan: List[str],
    report_mode: str = "normal_user",
) -> str:
    public_mode = report_mode != "normal_user"
    usable_best_openings = [
        opening for opening in best_openings if not is_unknown_opening_name(opening.get("name", ""))
    ]
    clean_best = next(
        (opening for opening in usable_best_openings if is_clean_repertoire_context(opening)),
        None,
    )
    clean_weak = next(
        (
            opening
            for opening in sorted(
                usable_best_openings,
                key=lambda item: (item.get("fitScore", 100), -(item.get("games") or 0)),
            )
            if is_clean_repertoire_context(opening) and (opening.get("games") or 0) >= 2
        ),
        None,
    )

    if public_mode:
        if usable_best_openings:
            return f"Review the {repertoire_context_title(usable_best_openings[0])} sample by time control."
        return "Review the imported games by time control."

    if clean_weak and clean_weak.get("losses", 0) >= 3:
        losses = min(3, clean_weak.get("losses", 3))
        return f"Review these {losses} losses in {repertoire_context_title(clean_weak)}."

    if clean_best:
        verdict = str(clean_best.get("verdict") or clean_best.get("fitVerdict") or "").lower()
        if verdict in {"keep", "strong fit", "recent strength"} or (clean_best.get("fitScore") or 0) >= 70:
            return f"Train this line: {repertoire_context_title(clean_best)}."
        return f"Play 5 games with {repertoire_context_title(clean_best)}."

    if preferred_white:
        return f"Play 5 games with {preferred_white[0]['name']} as White."

    if preferred_black:
        return f"Play 5 games with {preferred_black[0]['name']} as Black."

    if training_plan:
        first_step = str(training_plan[0]).strip()
        return first_step if first_step.endswith(".") else f"{first_step}."

    return "Play 5 games, then run a fresh analysis."


def build_recommendations(
    preferred_white: List[Dict[str, Any]],
    preferred_black: List[Dict[str, Any]],
    best_openings: List[Dict[str, Any]],
    style_profile: Dict[str, Any],
    report_mode: str = "normal_user",
) -> List[str]:
    recommendations = []
    public_mode = report_mode != "normal_user"

    if public_mode:
        recommendations.append(PUBLIC_ACCOUNT_CAUTION_COPY)

    if preferred_white:
        recommendations.append(
            f"As White, the most common recent sample is {preferred_white[0]['name']}."
            if public_mode
            else f"As White, your most common practical choice is {preferred_white[0]['name']}."
        )

    if preferred_black:
        recommendations.append(
            f"As Black, the most common recent sample is {preferred_black[0]['name']}."
            if public_mode
            else f"As Black, your most common structure is {preferred_black[0]['name']}."
        )

    usable_best_openings = [
        opening for opening in best_openings if not is_unknown_opening_name(opening.get("name", ""))
    ]

    if usable_best_openings:
        top = usable_best_openings[0]
        top_title = repertoire_context_title(top)
        top_is_clean = is_clean_repertoire_context(top)
        if public_mode and top["games"] < 8:
            recommendations.append(
                f"{top_title} is too small or noisy a sample for a hard verdict."
            )
        elif public_mode:
            recommendations.append(
                f"{top_title} is a recent strength in this import, not a claim about the player's full repertoire."
            )
        elif not top_is_clean:
            recommendations.append(
                f"{top_title} appears in the data, but it is not clean enough to recommend as something to play."
            )
        elif top["games"] < 8:
            recommendations.append(
                f"{top_title} is an emerging pattern, but it needs more games before a strong verdict."
            )
        else:
            recommendations.append(
                f"Your best-scoring recurring opening is {top_title}."
            )

    labels = style_profile.get("labels", [])

    if "Aggressive" in labels:
        recommendations.append("You seem to score best when you play actively rather than passively.")

    if "Solid" in labels:
        recommendations.append("You look suited to openings with clear structure and repeatable plans.")

    if "Tactical" in labels:
        recommendations.append("Your results suggest tactics and initiative are worth leaning into.")

    if "Flexible" in labels:
        recommendations.append(
            "You can handle variety, but keeping a tighter core repertoire should improve consistency."
        )

    return recommendations[:5]


def build_premium_data(best_openings: List[Dict[str, Any]], style_profile: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "isPremium": False,
        "lockedFeatures": [
            "Full opening ranking",
            "Full Keep / Improve / Avoid report",
            "Saved import history",
            "Advanced training plan",
            "More months of game history",
            "Opponent-specific prep",
            "Future Stockfish analysis",
        ],
        "premiumPreview": {
            "title": "Unlock full opening report",
            "best_opening_for_you": best_openings[:3],
            "style_profile_summary": style_profile.get("summary", ""),
            "premium_features": [
                "Full opening ranking",
                "Keep / Improve / Avoid engine",
                "Training plan by style",
                "Opening recommendations",
                "More months of game history",
                "Opponent-specific prep",
                "Future Stockfish analysis",
            ],
        },
        "premium_preview": {
            "title": "Unlock full opening report",
            "best_opening_for_you": best_openings[:3],
            "style_profile_summary": style_profile.get("summary", ""),
            "premium_features": [
                "Full opening ranking",
                "Keep / Improve / Avoid engine",
                "Training plan by style",
                "Opening recommendations",
                "More months of game history",
                "Opponent-specific prep",
                "Future Stockfish analysis",
            ],
        },
    }


def import_chesscom_logic(username: str, months: int = 3):
    username = username.strip()

    if not username:
        raise HTTPException(status_code=400, detail="Username is required.")

    if months < 1:
        raise HTTPException(status_code=400, detail="Months must be at least 1.")

    if months > 12:
        months = 12

    log_analytics_event(
        "import_started",
        {
            "username": username,
            "platform": "chess.com",
            "months": months,
        },
    )

    player = validate_player(username)
    archives = fetch_archives(username)
    selected_archives = archives[-months:] if len(archives) >= months else archives

    all_games: List[Dict[str, Any]] = []
    archive_breakdown = []

    for archive_url in selected_archives:
        games = fetch_games_from_archive(archive_url)
        user_games = []

        for game in games:
            white_user = game.get("white", {}).get("username", "").lower()
            black_user = game.get("black", {}).get("username", "").lower()

            if username.lower() in {white_user, black_user}:
                user_games.append(game)

        archive_breakdown.append(
            {
                "archive": extract_year_month(archive_url),
                "games_found": len(user_games),
                "gamesFound": len(user_games),
            }
        )

        all_games.extend(user_games)

    if not all_games:
        raise HTTPException(
            status_code=404,
            detail=f"No games found for Chess.com user '{username}' in the selected archives.",
        )

    analysed_games, skipped_reason_counts = split_usable_games(all_games, chesscom_skip_reason)

    opening_counter = Counter()
    white_opening_counter = Counter()
    black_opening_counter = Counter()
    opening_results = defaultdict(empty_opening_stats)
    context_opening_results = defaultdict(empty_opening_stats)
    recent_games = []
    opening_game_samples = []

    for game in analysed_games:
        opening = guess_opening_from_pgn(game.get("pgn", ""))
        colour = colour_for_user(game, username)
        result = result_for_user(game, username)
        first_white_move = extract_first_white_move_from_text(game.get("pgn", ""))
        repertoire_context = opening_context_for_game(colour, first_white_move)

        opening_counter[opening] += 1

        if colour == "white":
            white_opening_counter[opening] += 1
        elif colour == "black":
            black_opening_counter[opening] += 1

        context_key = f"{opening}::{repertoire_context}"
        for stats in (opening_results[opening], context_opening_results[context_key]):
            stats["name"] = opening
            stats["games"] += 1
            if colour in {"white", "black"}:
                stats[colour] += 1
            stats[repertoire_context] += 1

            if result == "win":
                stats["wins"] += 1
            elif result == "draw":
                stats["draws"] += 1
            elif result == "loss":
                stats["losses"] += 1

        recent_games.append(
            {
                "url": game.get("url"),
                "time_class": game.get("time_class"),
                "timeClass": game.get("time_class"),
                "rated": game.get("rated"),
                "colour": colour,
                "color": colour,
                "result": result,
                "opening": opening,
                "context": repertoire_context,
                "contextLabel": context_label(repertoire_context),
                "repertoireContext": repertoire_context,
                "end_time": game.get("end_time"),
                "endTime": game.get("end_time"),
                "pgn": game.get("pgn", ""),
                "white_username": game.get("white", {}).get("username", ""),
                "whiteUsername": game.get("white", {}).get("username", ""),
                "black_username": game.get("black", {}).get("username", ""),
                "blackUsername": game.get("black", {}).get("username", ""),
            }
        )
        opening_game_samples.append(
            {
                "url": game.get("url"),
                "time_class": game.get("time_class"),
                "timeClass": game.get("time_class"),
                "rated": game.get("rated"),
                "colour": colour,
                "color": colour,
                "result": result,
                "opening": opening,
                "name": opening,
                "context": repertoire_context,
                "contextLabel": context_label(repertoire_context),
                "repertoireContext": repertoire_context,
                "end_time": game.get("end_time"),
                "endTime": game.get("end_time"),
            }
        )

    top_openings = []

    for opening, _count in opening_counter.most_common(10):
        stats = opening_results[opening]
        games = stats["games"]
        win_rate = round((stats["wins"] / games) * 100, 1) if games else 0
        explanation = opening_explanation(opening)

        top_openings.append(
            {
                "name": opening,
                "games": games,
                "wins": stats["wins"],
                "draws": stats["draws"],
                "losses": stats["losses"],
                "win_rate": win_rate,
                "winRate": win_rate,
                "colour": dominant_opening_colour(stats),
                "color": dominant_opening_colour(stats),
                "context": dominant_opening_context(stats),
                "contextLabel": context_label(dominant_opening_context(stats)),
                "repertoireContext": dominant_opening_context(stats),
                **explanation,
            }
        )

    preferred_white = [
        {
            "name": n,
            "games": g,
            "context": "played_as_white",
            "contextLabel": context_label("played_as_white"),
            "repertoireContext": "played_as_white",
            "colour": "white",
            "color": "white",
            **opening_explanation(n),
        }
        for n, g in white_opening_counter.most_common(5)
        if not is_unknown_opening_name(n) and context_is_compatible(n, "played_as_white")
    ]

    preferred_black = [
        {
            "name": n,
            "games": g,
            "context": dominant_opening_context(opening_results[n]),
            "contextLabel": context_label(dominant_opening_context(opening_results[n])),
            "repertoireContext": dominant_opening_context(opening_results[n]),
            "colour": "black",
            "color": "black",
            **opening_explanation(n),
        }
        for n, g in black_opening_counter.most_common(5)
        if not is_unknown_opening_name(n) and context_is_compatible(n, dominant_opening_context(opening_results[n]))
    ]

    style_profile = build_style_profile(analysed_games, username)
    style_fingerprint = build_style_fingerprint(recent_games, username=username)
    engine_summary = build_engine_summary(recent_games, username=username, is_premium=False)
    style_fingerprint = apply_engine_adjustments_to_style_fingerprint(style_fingerprint, engine_summary)
    opening_fit_metrics = build_opening_fit_metrics(recent_games)
    top_openings = merge_opening_fit_metrics(top_openings, opening_fit_metrics)
    best_openings = build_opening_scores(context_opening_results)
    best_openings = merge_opening_fit_metrics(best_openings, opening_fit_metrics)
    report_mode_data = detect_report_mode(
        title=player.get("title"),
        total_games=len(analysed_games),
        player_level=player.get("title"),
        username=player.get("username", username),
    )
    report_mode = report_mode_data["report_mode"]
    best_openings = adapt_openings_for_report_mode(best_openings, report_mode)
    top_openings = adapt_openings_for_report_mode(top_openings, report_mode)
    opening_recommendations = build_colour_aware_recommendations(context_opening_results)
    opening_fit_profile = build_opening_fit_profile(
        best_openings,
        opening_recommendations,
        len(analysed_games),
        style_profile,
    )
    training_plan = build_training_plan(
        style_profile,
        preferred_white,
        preferred_black,
        best_openings,
        report_mode,
    )
    recommended_action = build_recommended_action(
        preferred_white,
        preferred_black,
        best_openings,
        training_plan,
        report_mode,
    )
    recommendations = build_recommendations(
        preferred_white,
        preferred_black,
        best_openings,
        style_profile,
        report_mode,
    )
    style_based_recommendations = build_style_based_recommendations(
        style_profile,
        best_openings,
        top_openings,
        len(analysed_games),
    )
    recommended_openings = build_style_opening_recommendations(
        style_fingerprint,
        current_opening_stats=best_openings,
        player_rating=None,
        colour_needs=["white", "black_vs_e4", "black_vs_d4"],
        existing_openings=list(opening_counter.keys()),
    )
    basic_opening_recommendations = build_basic_recommendation_summary(recommended_openings)

    premium_data = build_premium_data(best_openings, style_profile)
    diagnostic_summary = build_diagnostic_summary(recent_games, username=username)

    recent_games = sorted(recent_games, key=lambda x: x["end_time"] or 0, reverse=True)[:10]

    result = {
        "username": player.get("username", username),
        "player_url": player.get("url"),
        "playerUrl": player.get("url"),
        "platform": "chess.com",
        "importPlatform": "chess.com",
        "title": player.get("title"),
        "chessTitle": player.get("title"),
        "chess_title": player.get("title"),
        "total_games": len(analysed_games),
        "totalGames": len(analysed_games),
        "gamesImported": len(analysed_games),
        "gamesFound": len(all_games),
        "gamesAnalysed": len(analysed_games),
        "gamesAnalyzed": len(analysed_games),
        "skippedGames": len(all_games) - len(analysed_games),
        "skipped_game_reasons": skipped_reason_counts,
        "skippedGameReasons": skipped_reason_items(skipped_reason_counts),
        "months_checked": len(selected_archives),
        "monthsChecked": len(selected_archives),
        "archives_checked": archive_breakdown,
        "archivesChecked": archive_breakdown,
        "top_openings": top_openings,
        "topOpenings": top_openings,
        "preferred_white": preferred_white,
        "preferredWhite": preferred_white,
        "preferred_black": preferred_black,
        "preferredBlack": preferred_black,
        "recommendations": recommendations,
        "recent_games": recent_games,
        "recentGames": recent_games,
        "opening_games": opening_game_samples,
        "openingGames": opening_game_samples,
        "style_profile": style_profile,
        "styleProfile": style_profile,
        "style_fingerprint": style_fingerprint,
        "styleFingerprint": style_fingerprint,
        "engine_summary": engine_summary,
        "engineSummary": engine_summary,
        "diagnostic_summary": diagnostic_summary,
        "diagnosticSummary": diagnostic_summary,
        "opening_fit_metrics": opening_fit_metrics,
        "openingFitMetrics": opening_fit_metrics,
        "style_based_recommendations": style_based_recommendations,
        "styleBasedRecommendations": style_based_recommendations,
        "recommended_openings": recommended_openings,
        "recommendedOpeningsByStyle": recommended_openings,
        "basic_opening_recommendations": basic_opening_recommendations,
        "basicOpeningRecommendations": basic_opening_recommendations,
        "best_openings": best_openings[:8],
        "bestOpenings": best_openings[:8],
        "opening_recommendations": opening_recommendations,
        "openingRecommendations": opening_recommendations,
        "recommendedOpenings": opening_recommendations,
        "recommended_action": recommended_action,
        "recommendedAction": recommended_action,
        "training_plan": training_plan,
        "trainingPlan": training_plan,
        "lastUpdated": now_iso(),
        "importedAt": now_iso(),
        **opening_fit_profile,
        **report_mode_data,
        **premium_data,
    }

    profile = save_user_profile(username, result)

    log_analytics_event(
        "games_imported",
        {
            "username": username,
            "platform": "chess.com",
            "gamesImported": len(analysed_games),
            "gamesFound": len(all_games),
            "skippedGames": len(all_games) - len(analysed_games),
            "monthsChecked": len(selected_archives),
        },
    )

    result["savedProfile"] = {
        "username": profile["username"],
        "lastUpdated": profile["lastUpdated"],
        "importHistory": profile["importHistory"],
        "isPremium": profile["isPremium"],
    }

    return result


def lichess_user_name(player: Dict[str, Any], fallback: str) -> str:
    user = player.get("user") or {}
    return user.get("name") or user.get("id") or fallback


def get_lichess_result(game: Dict[str, Any], username: str) -> str:
    username_lower = username.lower()

    players = game.get("players", {})
    white_name = lichess_user_name(players.get("white", {}), "White")
    black_name = lichess_user_name(players.get("black", {}), "Black")

    winner = game.get("winner")

    is_white = white_name.lower() == username_lower
    is_black = black_name.lower() == username_lower

    if not winner:
        return "draw"

    if is_white and winner == "white":
        return "win"

    if is_black and winner == "black":
        return "win"

    return "loss"


def get_lichess_colour(game: Dict[str, Any], username: str) -> str:
    username_lower = username.lower()

    players = game.get("players", {})
    white_name = lichess_user_name(players.get("white", {}), "White")
    black_name = lichess_user_name(players.get("black", {}), "Black")

    if white_name.lower() == username_lower:
        return "white"

    if black_name.lower() == username_lower:
        return "black"

    return "unknown"


def get_lichess_opening_name(game: Dict[str, Any]) -> str:
    opening = game.get("opening") or {}

    if isinstance(opening, dict):
        name = opening.get("name")
        if name:
            return normalize_opening_name(name)

    moves_text = game.get("moves", "")
    moves = moves_text.split() if moves_text else []
    return normalize_opening_name(opening_from_move_sequence(moves))


def lichess_time_class(game: Dict[str, Any]) -> str:
    return game.get("speed") or game.get("perf") or "unknown"


def build_lichess_analysis(
    username: str,
    games: List[Dict[str, Any]],
    months: int,
    games_found: Optional[int] = None,
    skipped_reason_counts: Optional[Dict[str, int]] = None,
):
    games_found = games_found if games_found is not None else len(games)
    skipped_reason_counts = skipped_reason_counts or {key: 0 for key in SKIPPED_REASON_LABELS}
    opening_counter = Counter()
    white_opening_counter = Counter()
    black_opening_counter = Counter()
    opening_results = defaultdict(empty_opening_stats)
    context_opening_results = defaultdict(empty_opening_stats)
    recent_games = []
    opening_game_samples = []
    player_ratings = []

    for game in games:
        opening = get_lichess_opening_name(game)
        colour = get_lichess_colour(game, username)
        result = get_lichess_result(game, username)

        players = game.get("players", {})
        white_player = players.get("white", {})
        black_player = players.get("black", {})
        white_name = lichess_user_name(white_player, "White")
        black_name = lichess_user_name(black_player, "Black")

        username_lower = username.lower()

        if white_name.lower() == username_lower:
            rating_value = white_player.get("rating")
            if isinstance(rating_value, (int, float)):
                player_ratings.append(int(rating_value))

        if black_name.lower() == username_lower:
            rating_value = black_player.get("rating")
            if isinstance(rating_value, (int, float)):
                player_ratings.append(int(rating_value))

        moves_text = game.get("moves", "")
        moves = moves_text.split() if moves_text else []
        first_white_move = moves[0] if moves else ""
        repertoire_context = opening_context_for_game(colour, first_white_move)

        pgn_moves = []
        for index in range(0, len(moves), 2):
            move_number = (index // 2) + 1
            white_move = moves[index]
            black_move = moves[index + 1] if index + 1 < len(moves) else None

            if black_move:
                pgn_moves.append(f"{move_number}. {white_move} {black_move}")
            else:
                pgn_moves.append(f"{move_number}. {white_move}")

        simple_pgn = "\n".join([
            f'[White "{white_name}"]',
            f'[Black "{black_name}"]',
            f'[Opening "{opening}"]',
            "",
            " ".join(pgn_moves),
        ]).strip()

        opening_counter[opening] += 1

        if colour == "white":
            white_opening_counter[opening] += 1
        elif colour == "black":
            black_opening_counter[opening] += 1

        context_key = f"{opening}::{repertoire_context}"
        for stats in (opening_results[opening], context_opening_results[context_key]):
            stats["name"] = opening
            stats["games"] += 1
            if colour in {"white", "black"}:
                stats[colour] += 1
            stats[repertoire_context] += 1

            if result == "win":
                stats["wins"] += 1
            elif result == "draw":
                stats["draws"] += 1
            elif result == "loss":
                stats["losses"] += 1

        recent_games.append(
            {
                "url": f"https://lichess.org/{game.get('id')}" if game.get("id") else "",
                "time_class": lichess_time_class(game),
                "timeClass": lichess_time_class(game),
                "rated": game.get("rated"),
                "colour": colour,
                "color": colour,
                "result": result,
                "opening": opening,
                "context": repertoire_context,
                "contextLabel": context_label(repertoire_context),
                "repertoireContext": repertoire_context,
                "end_time": game.get("lastMoveAt") or game.get("createdAt"),
                "endTime": game.get("lastMoveAt") or game.get("createdAt"),
                "pgn": simple_pgn,
                "moves": moves,
                "movesText": moves_text,
                "white_username": white_name,
                "whiteUsername": white_name,
                "black_username": black_name,
                "blackUsername": black_name,
            }
        )
        opening_game_samples.append(
            {
                "url": f"https://lichess.org/{game.get('id')}" if game.get("id") else "",
                "time_class": lichess_time_class(game),
                "timeClass": lichess_time_class(game),
                "rated": game.get("rated"),
                "colour": colour,
                "color": colour,
                "result": result,
                "opening": opening,
                "name": opening,
                "context": repertoire_context,
                "contextLabel": context_label(repertoire_context),
                "repertoireContext": repertoire_context,
                "end_time": game.get("lastMoveAt") or game.get("createdAt"),
                "endTime": game.get("lastMoveAt") or game.get("createdAt"),
            }
        )

    top_openings = []

    for opening, _count in opening_counter.most_common(10):
        stats = opening_results[opening]
        games_count = stats["games"]
        win_rate = round((stats["wins"] / games_count) * 100, 1) if games_count else 0
        explanation = opening_explanation(opening)

        top_openings.append(
            {
                "name": opening,
                "games": games_count,
                "wins": stats["wins"],
                "draws": stats["draws"],
                "losses": stats["losses"],
                "win_rate": win_rate,
                "winRate": win_rate,
                "colour": dominant_opening_colour(stats),
                "color": dominant_opening_colour(stats),
                "context": dominant_opening_context(stats),
                "contextLabel": context_label(dominant_opening_context(stats)),
                "repertoireContext": dominant_opening_context(stats),
                **explanation,
            }
        )

    preferred_white = [
        {
            "name": n,
            "games": g,
            "context": "played_as_white",
            "contextLabel": context_label("played_as_white"),
            "repertoireContext": "played_as_white",
            "colour": "white",
            "color": "white",
            **opening_explanation(n),
        }
        for n, g in white_opening_counter.most_common(5)
        if not is_unknown_opening_name(n) and context_is_compatible(n, "played_as_white")
    ]

    preferred_black = [
        {
            "name": n,
            "games": g,
            "context": dominant_opening_context(opening_results[n]),
            "contextLabel": context_label(dominant_opening_context(opening_results[n])),
            "repertoireContext": dominant_opening_context(opening_results[n]),
            "colour": "black",
            "color": "black",
            **opening_explanation(n),
        }
        for n, g in black_opening_counter.most_common(5)
        if not is_unknown_opening_name(n) and context_is_compatible(n, dominant_opening_context(opening_results[n]))
    ]

    best_openings = build_opening_scores(context_opening_results)
    style_profile = build_lichess_style_profile(top_openings, preferred_white, preferred_black)
    style_fingerprint = build_style_fingerprint(recent_games, username=username)
    engine_summary = build_engine_summary(recent_games, username=username, is_premium=False)
    style_fingerprint = apply_engine_adjustments_to_style_fingerprint(style_fingerprint, engine_summary)
    opening_fit_metrics = build_opening_fit_metrics(recent_games)
    top_openings = merge_opening_fit_metrics(top_openings, opening_fit_metrics)
    best_openings = merge_opening_fit_metrics(best_openings, opening_fit_metrics)
    current_rating = max(player_ratings) if player_ratings else None

    if current_rating is None:
        player_level = "Unknown"
    elif current_rating < 900:
        player_level = "Beginner"
    elif current_rating < 1400:
        player_level = "Intermediate"
    elif current_rating < 1800:
        player_level = "Club Player"
    elif current_rating < 2200:
        player_level = "Advanced"
    else:
        player_level = "Master"

    report_mode_data = detect_report_mode(
        rating=current_rating,
        total_games=len(games),
        player_level=player_level,
        username=username,
    )
    report_mode = report_mode_data["report_mode"]
    best_openings = adapt_openings_for_report_mode(best_openings, report_mode)
    top_openings = adapt_openings_for_report_mode(top_openings, report_mode)
    opening_recommendations = build_colour_aware_recommendations(context_opening_results)
    opening_fit_profile = build_opening_fit_profile(
        best_openings,
        opening_recommendations,
        len(games),
        style_profile,
    )
    training_plan = build_training_plan(
        style_profile,
        preferred_white,
        preferred_black,
        best_openings,
        report_mode,
    )
    recommended_action = build_recommended_action(
        preferred_white,
        preferred_black,
        best_openings,
        training_plan,
        report_mode,
    )
    recommendations = build_recommendations(
        preferred_white,
        preferred_black,
        best_openings,
        style_profile,
        report_mode,
    )
    style_based_recommendations = build_style_based_recommendations(
        style_profile,
        best_openings,
        top_openings,
        len(games),
    )
    recommended_openings = build_style_opening_recommendations(
        style_fingerprint,
        current_opening_stats=best_openings,
        player_rating=current_rating,
        colour_needs=["white", "black_vs_e4", "black_vs_d4"],
        existing_openings=list(opening_counter.keys()),
    )
    basic_opening_recommendations = build_basic_recommendation_summary(recommended_openings)

    premium_data = build_premium_data(best_openings, style_profile)
    diagnostic_summary = build_diagnostic_summary(recent_games, username=username)
    recent_games = sorted(recent_games, key=lambda x: x["end_time"] or 0, reverse=True)[:10]

    result = {
        "username": username,
        "player_url": f"https://lichess.org/@/{username}",
        "playerUrl": f"https://lichess.org/@/{username}",
        "platform": "lichess",
        "importPlatform": "lichess",
        "rating": current_rating,
        "lichess_rating": current_rating,
        "lichessRating": current_rating,
        "player_level": player_level,
        "playerLevel": player_level,
        "total_games": len(games),
        "totalGames": len(games),
        "gamesImported": len(games),
        "gamesFound": games_found,
        "gamesAnalysed": len(games),
        "gamesAnalyzed": len(games),
        "skippedGames": max(0, games_found - len(games)),
        "skipped_game_reasons": skipped_reason_counts,
        "skippedGameReasons": skipped_reason_items(skipped_reason_counts),
        "months_checked": months,
        "monthsChecked": months,
        "archives_checked": [
            {
                "archive": f"lichess-last-{months}-months",
                "games_found": games_found,
                "gamesFound": games_found,
            }
        ],
        "archivesChecked": [
            {
                "archive": f"lichess-last-{months}-months",
                "games_found": games_found,
                "gamesFound": games_found,
            }
        ],
        "top_openings": top_openings,
        "topOpenings": top_openings,
        "preferred_white": preferred_white,
        "preferredWhite": preferred_white,
        "preferred_black": preferred_black,
        "preferredBlack": preferred_black,
        "recommendations": recommendations,
        "recent_games": recent_games,
        "recentGames": recent_games,
        "opening_games": opening_game_samples,
        "openingGames": opening_game_samples,
        "style_profile": style_profile,
        "styleProfile": style_profile,
        "style_fingerprint": style_fingerprint,
        "styleFingerprint": style_fingerprint,
        "engine_summary": engine_summary,
        "engineSummary": engine_summary,
        "diagnostic_summary": diagnostic_summary,
        "diagnosticSummary": diagnostic_summary,
        "opening_fit_metrics": opening_fit_metrics,
        "openingFitMetrics": opening_fit_metrics,
        "style_based_recommendations": style_based_recommendations,
        "styleBasedRecommendations": style_based_recommendations,
        "recommended_openings": recommended_openings,
        "recommendedOpeningsByStyle": recommended_openings,
        "basic_opening_recommendations": basic_opening_recommendations,
        "basicOpeningRecommendations": basic_opening_recommendations,
        "best_openings": best_openings[:8],
        "bestOpenings": best_openings[:8],
        "opening_recommendations": opening_recommendations,
        "openingRecommendations": opening_recommendations,
        "recommendedOpenings": opening_recommendations,
        "recommended_action": recommended_action,
        "recommendedAction": recommended_action,
        "training_plan": training_plan,
        "trainingPlan": training_plan,
        "lastUpdated": now_iso(),
        "importedAt": now_iso(),
        **opening_fit_profile,
        **report_mode_data,
        **premium_data,
    }

    profile = save_user_profile(username, result)

    log_analytics_event(
        "games_imported",
        {
            "username": username,
            "platform": "lichess",
            "gamesImported": len(games),
            "gamesFound": games_found,
            "skippedGames": max(0, games_found - len(games)),
            "monthsChecked": months,
        },
    )

    result["savedProfile"] = {
        "username": profile["username"],
        "lastUpdated": profile["lastUpdated"],
        "importHistory": profile["importHistory"],
        "isPremium": profile["isPremium"],
    }

    return result


def import_lichess_logic(username: str, months: int = 3):
    username = username.strip()

    if not username:
        raise HTTPException(status_code=400, detail="Username is required.")

    if months < 1:
        raise HTTPException(status_code=400, detail="Months must be at least 1.")

    if months > 12:
        months = 12

    log_analytics_event(
        "import_started",
        {
            "username": username,
            "platform": "lichess",
            "months": months,
        },
    )

    max_games = 300 if months >= 12 else 100
    since_date = datetime.now(timezone.utc) - timedelta(days=months * 31)
    since_ms = int(since_date.timestamp() * 1000)

    url = f"https://lichess.org/api/games/user/{username}"

    params = {
        "max": max_games,
        "since": since_ms,
        "opening": "true",
        "moves": "true",
        "pgnInJson": "false",
        "clocks": "false",
        "evals": "false",
        "perfType": "bullet,blitz,rapid,classical",
        "sort": "dateDesc",
    }

    try:
        response = requests.get(url, params=params, headers=LICHESS_HEADERS, timeout=30)
    except requests.RequestException:
        raise HTTPException(
            status_code=503,
            detail="Could not connect to Lichess right now. Please try again later.",
        )

    if response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail="Could not find that Lichess username. Check the spelling and try again.",
        )

    if response.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="Lichess is temporarily rate limiting requests. Try again in a minute.",
        )

    if not response.ok:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Lichess import failed: {response.text[:300]}",
        )

    games = []

    for line in response.text.splitlines():
        if not line.strip():
            continue

        try:
            games.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    if not games:
        raise HTTPException(
            status_code=404,
            detail="This Lichess profile exists, but no recent blitz, rapid, or classical public games were found.",
        )

    analysed_games, skipped_reason_counts = split_usable_games(games, lichess_skip_reason)

    return build_lichess_analysis(
        username,
        analysed_games,
        months,
        games_found=len(games),
        skipped_reason_counts=skipped_reason_counts,
    )


@app.get("/import/chesscom/{username}")
def import_chesscom(username: str, months: int = 3):
    return import_chesscom_logic(username, months)


@app.get("/api/import/chesscom/{username}")
def api_import_chesscom(username: str, months: int = 3):
    return import_chesscom_logic(username, months)


@app.get("/import/lichess/{username}")
def import_lichess(username: str, months: int = 3):
    return import_lichess_logic(username, months)


@app.get("/api/import/lichess/{username}")
def api_import_lichess(username: str, months: int = 3):
    return import_lichess_logic(username, months)


@app.get("/api/profile/{username}")
def get_saved_profile(username: str, platform: Optional[str] = None):
    profile = load_user_profile(username, platform)

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="No saved profile found for this username yet. Import games first.",
        )

    log_analytics_event(
        "saved_profile_loaded",
        {
            "username": username,
            "platform": profile.get("platform"),
        },
    )

    return profile


@app.post("/api/feedback")
def submit_feedback(request: FeedbackRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Feedback message cannot be empty.")

    saved = save_feedback(
        message=request.message.strip(),
        contact=request.contact,
        username=request.username,
        platform=request.platform,
    )

    log_analytics_event(
        "feedback_submitted",
        {
            "username": request.username,
            "platform": request.platform,
            "hasContact": bool(request.contact),
        },
    )

    return {
        "status": "ok",
        "message": "Thanks — feedback saved.",
        "feedback": saved,
    }


@app.post("/api/analytics/event")
def analytics_event(request: AnalyticsEventRequest):
    if not request.event.strip():
        raise HTTPException(status_code=400, detail="Event name cannot be empty.")

    log_analytics_event(request.event.strip(), request.data or {})

    return {"status": "ok"}


@app.get("/api/demo")
def demo_profile():
    demo_best_openings = [
        {
            "name": "Vienna Game",
            "games": 8,
            "wins": 5,
            "draws": 1,
            "losses": 2,
            "win_rate": 62.5,
            "winRate": 62.5,
            "score": 0.69,
            "verdict": "Keep",
            "colour": "white",
            "color": "white",
            "context": "played_as_white",
            "contextLabel": context_label("played_as_white"),
            "repertoireContext": "played_as_white",
            **opening_explanation("Vienna Game"),
        },
        {
            "name": "Scandinavian Defence",
            "games": 7,
            "wins": 4,
            "draws": 0,
            "losses": 3,
            "win_rate": 57.1,
            "winRate": 57.1,
            "score": 0.57,
            "verdict": "Improve",
            "colour": "black",
            "color": "black",
            "context": "black_vs_e4",
            "contextLabel": context_label("black_vs_e4"),
            "repertoireContext": "black_vs_e4",
            **opening_explanation("Scandinavian Defence"),
        },
        {
            "name": "Queen Pawn Game",
            "games": 6,
            "wins": 1,
            "draws": 1,
            "losses": 4,
            "win_rate": 16.7,
            "winRate": 16.7,
            "score": 0.25,
            "verdict": "Avoid",
            "colour": "white",
            "color": "white",
            "context": "played_as_white",
            "contextLabel": context_label("played_as_white"),
            "repertoireContext": "played_as_white",
            **opening_explanation("Queen Pawn Game"),
        },
    ]

    style_profile = {
        "primaryStyle": "Aggressive Tactical",
        "labels": ["Aggressive", "Tactical"],
        "summary": "You tend to do best in open positions where pieces develop quickly and attacking chances appear early.",
        "top_opening_families": ["Vienna Game", "Scandinavian Defence", "Italian Game"],
        "topOpeningFamilies": ["Vienna Game", "Scandinavian Defence", "Italian Game"],
        "scores": {
            "aggressive": 8,
            "solid": 3,
            "tactical": 7,
            "flexible": 2,
        },
    }
    style_fingerprint = {
        "primary_style": "Tactical Attacker",
        "primaryStyle": "Tactical Attacker",
        "secondary_style": "Open Position Player",
        "secondaryStyle": "Open Position Player",
        "confidence": "medium",
        "traits": {
            "tactical_tendency": 78,
            "positional_tendency": 52,
            "open_position_preference": 82,
            "closed_position_comfort": 44,
            "gambit_comfort": 64,
            "early_attack_frequency": 68,
            "queen_trade_frequency": 38,
            "simplified_position_comfort": 46,
            "castling_consistency": 72,
            "opposite_side_castling_frequency": 42,
            "central_pawn_break_frequency": 70,
            "development_speed": 76,
            "king_safety_risk": 58,
            "endgame_conversion": 46,
            "short_game_success": 73,
            "long_game_success": 42,
            "opening_phase_stability": 66,
        },
        "evidence": [
            "You score best in games where the centre opens early.",
            "Your wins are often decided before move 30.",
            "Your losses often include delayed castling or exposed king positions.",
        ],
        "sample_size": 24,
        "sampleSize": 24,
        "method": "deterministic_pgn_heuristics_v1",
    }

    opening_recommendations = {
        "white_repertoire": [
            opening_item("Vienna Game", 8, "played_as_white", {"games": 8, "wins": 5}),
            opening_item("Italian Game", 5, "played_as_white", {"games": 5, "wins": 3}),
        ],
        "black_vs_e4": [
            opening_item("Scandinavian Defence", 7, "black_vs_e4", {"games": 7, "wins": 4}),
            opening_item("Caro-Kann Defence", 4, "black_vs_e4", {"games": 4, "wins": 2}),
        ],
        "black_vs_d4": [
            opening_item("Queen's Gambit Declined", 3, "black_vs_d4", {"games": 3, "wins": 1}),
        ],
        "black_vs_other": [
            opening_item("King's Indian setup", 2, "black_vs_other", {"games": 2, "wins": 1}),
        ],
        "experimental_rare": [
            opening_item("Englund Gambit", 1, "black_vs_d4", {"games": 1, "wins": 0}),
        ],
        "too_little_data": [
            {
                **opening_item("Unclear transposition", 1, "unknown_mixed", {"games": 1, "wins": 0}),
                "recommendationCopy": SAFE_CONTEXT_FALLBACK_COPY,
            }
        ],
    }
    opening_recommendations.update(
        {
            "white": [item["name"] for item in opening_recommendations["white_repertoire"]],
            "black": [
                item["name"]
                for item in (
                    opening_recommendations["black_vs_e4"]
                    + opening_recommendations["black_vs_d4"]
                    + opening_recommendations["black_vs_other"]
                )
            ],
            "blackVsE4": [item["name"] for item in opening_recommendations["black_vs_e4"]],
            "blackVsD4": [item["name"] for item in opening_recommendations["black_vs_d4"]],
            "blackVsOther": [item["name"] for item in opening_recommendations["black_vs_other"]],
            "blackVsD4Other": [
                item["name"]
                for item in (
                    opening_recommendations["black_vs_d4"]
                    + opening_recommendations["black_vs_other"]
                )
            ],
            "whiteDetailed": opening_recommendations["white_repertoire"],
            "blackDetailed": (
                opening_recommendations["black_vs_e4"]
                + opening_recommendations["black_vs_d4"]
                + opening_recommendations["black_vs_other"]
            ),
            "blackVsE4Detailed": opening_recommendations["black_vs_e4"],
            "blackVsD4Detailed": opening_recommendations["black_vs_d4"],
            "blackVsOtherDetailed": opening_recommendations["black_vs_other"],
            "blackVsD4OtherDetailed": (
                opening_recommendations["black_vs_d4"]
                + opening_recommendations["black_vs_other"]
            ),
            "experimentalRare": opening_recommendations["experimental_rare"],
            "tooLittleData": opening_recommendations["too_little_data"],
            "sections": [
                {"key": "white_repertoire", "title": "White repertoire", "items": opening_recommendations["white_repertoire"]},
                {"key": "black_vs_e4", "title": "Black vs 1.e4", "items": opening_recommendations["black_vs_e4"]},
                {"key": "black_vs_d4", "title": "Black vs 1.d4", "items": opening_recommendations["black_vs_d4"]},
                {"key": "black_vs_other", "title": "Black vs other first moves", "items": opening_recommendations["black_vs_other"]},
                {"key": "experimental_rare", "title": "Experimental / rare openings", "items": opening_recommendations["experimental_rare"]},
                {"key": "too_little_data", "title": "Too little data", "items": opening_recommendations["too_little_data"]},
            ],
        }
    )

    premium_data = build_premium_data(demo_best_openings, style_profile)
    opening_fit_profile = build_opening_fit_profile(
        demo_best_openings,
        opening_recommendations,
        24,
        style_profile,
    )
    engine_summary = build_engine_summary([], username="DemoPlayer", is_premium=False)
    style_fingerprint = apply_engine_adjustments_to_style_fingerprint(style_fingerprint, engine_summary)
    recommended_openings = build_style_opening_recommendations(
        style_fingerprint,
        current_opening_stats=demo_best_openings,
        player_rating=1300,
        colour_needs=["white", "black_vs_e4", "black_vs_d4"],
        existing_openings=[item["name"] for item in demo_best_openings],
    )

    demo_data = {
        "username": "DemoPlayer",
        "player_url": None,
        "playerUrl": None,
        "platform": "demo",
        "importPlatform": "demo",
        "report_mode": "normal_user",
        "reportMode": "normal_user",
        "reportModeReasons": [],
        "publicAccountCaution": "",
        "total_games": 24,
        "totalGames": 24,
        "gamesImported": 24,
        "gamesFound": 24,
        "gamesAnalysed": 24,
        "gamesAnalyzed": 24,
        "skippedGames": 0,
        "months_checked": 3,
        "monthsChecked": 3,
        "archives_checked": [
            {"archive": "demo-1", "games_found": 8, "gamesFound": 8},
            {"archive": "demo-2", "games_found": 8, "gamesFound": 8},
            {"archive": "demo-3", "games_found": 8, "gamesFound": 8},
        ],
        "archivesChecked": [
            {"archive": "demo-1", "games_found": 8, "gamesFound": 8},
            {"archive": "demo-2", "games_found": 8, "gamesFound": 8},
            {"archive": "demo-3", "games_found": 8, "gamesFound": 8},
        ],
        "lastUpdated": now_iso(),
        "importedAt": now_iso(),
        **opening_fit_profile,
        "style_profile": style_profile,
        "styleProfile": style_profile,
        "style_fingerprint": style_fingerprint,
        "styleFingerprint": style_fingerprint,
        "engine_summary": engine_summary,
        "engineSummary": engine_summary,
        "recommended_openings": recommended_openings,
        "recommendedOpeningsByStyle": recommended_openings,
        "top_openings": demo_best_openings,
        "topOpenings": demo_best_openings,
        "best_openings": demo_best_openings,
        "bestOpenings": demo_best_openings,
        "preferred_white": [
            {"name": "Vienna Game", "games": 8, "colour": "white", "color": "white", "context": "played_as_white", "contextLabel": context_label("played_as_white"), **opening_explanation("Vienna Game")},
            {"name": "Italian Game", "games": 5, "colour": "white", "color": "white", "context": "played_as_white", "contextLabel": context_label("played_as_white"), **opening_explanation("Italian Game")},
        ],
        "preferredWhite": [
            {"name": "Vienna Game", "games": 8, "colour": "white", "color": "white", "context": "played_as_white", "contextLabel": context_label("played_as_white"), **opening_explanation("Vienna Game")},
            {"name": "Italian Game", "games": 5, "colour": "white", "color": "white", "context": "played_as_white", "contextLabel": context_label("played_as_white"), **opening_explanation("Italian Game")},
        ],
        "preferred_black": [
            {"name": "Scandinavian Defence", "games": 7, "colour": "black", "color": "black", "context": "black_vs_e4", "contextLabel": context_label("black_vs_e4"), **opening_explanation("Scandinavian Defence")},
            {"name": "Caro-Kann Defence", "games": 4, "colour": "black", "color": "black", "context": "black_vs_e4", "contextLabel": context_label("black_vs_e4"), **opening_explanation("Caro-Kann Defence")},
        ],
        "preferredBlack": [
            {"name": "Scandinavian Defence", "games": 7, "colour": "black", "color": "black", "context": "black_vs_e4", "contextLabel": context_label("black_vs_e4"), **opening_explanation("Scandinavian Defence")},
            {"name": "Caro-Kann Defence", "games": 4, "colour": "black", "color": "black", "context": "black_vs_e4", "contextLabel": context_label("black_vs_e4"), **opening_explanation("Caro-Kann Defence")},
        ],
        "recommendations": [
            "As White, your most common practical choice is Vienna Game.",
            "As Black, your most common structure is Scandinavian Defence.",
            "Your best-scoring recurring opening is Vienna Game.",
            "You seem to score best when you play actively rather than passively.",
            "Your results suggest tactics and initiative are worth leaning into.",
        ],
        "opening_recommendations": opening_recommendations,
        "openingRecommendations": opening_recommendations,
        "recommendedOpenings": opening_recommendations,
        "recommended_action": "Train this line: Vienna Game as White.",
        "recommendedAction": "Train this line: Vienna Game as White.",
        "training_plan": [
            "As White, play Vienna Game for your next 10 to 15 games.",
            "As Black, stick with Scandinavian Defence and learn the first 6 to 8 moves well.",
            "Keep building around Vienna Game. It is currently your best practical opening.",
            "Study 2 tactical motifs from your main openings and look for initiative before material.",
            "After each game, review where tactics first appeared rather than only the final blunder.",
            "Do not switch openings every session. Give one opening a real test sample before judging it.",
        ],
        "trainingPlan": [
            "As White, play Vienna Game for your next 10 to 15 games.",
            "As Black, stick with Scandinavian Defence and learn the first 6 to 8 moves well.",
            "Keep building around Vienna Game. It is currently your best practical opening.",
            "Study 2 tactical motifs from your main openings and look for initiative before material.",
            "After each game, review where tactics first appeared rather than only the final blunder.",
            "Do not switch openings every session. Give one opening a real test sample before judging it.",
        ],
        "recent_games": [],
        "recentGames": [],
        "savedProfile": {
            "username": "DemoPlayer",
            "lastUpdated": now_iso(),
            "importHistory": [
                {
                    "date": now_iso(),
                    "gamesImported": 24,
                    "monthsChecked": 3,
                }
            ],
            "isPremium": False,
        },
        **premium_data,
    }

    log_analytics_event("demo_loaded", {"username": "DemoPlayer"})

    return demo_data

# =========================================================
# Cloud saved user state
# Saves local app state to Supabase by platform + username.
# =========================================================

from urllib.parse import quote
from typing import Dict, Any


class UserStatePayload(BaseModel):
    username: str
    platform: str = "chesscom"
    state: Dict[str, Any]


def get_supabase_config():
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_SERVICE_KEY", "").strip()
        or os.getenv("SUPABASE_KEY", "").strip()
        or os.getenv("SUPABASE_ANON_KEY", "").strip()
    )

    if not supabase_url or not supabase_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your backend environment.",
        )

    return supabase_url, supabase_key


def supabase_headers(extra=None):
    _, supabase_key = get_supabase_config()

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    if extra:
        headers.update(extra)

    return headers


@app.get("/api/user-state/{platform}/{username}")
def get_user_state(platform: str, username: str, request: Request):
    get_auth_user(request)
    raise HTTPException(
        status_code=410,
        detail="This username-based cloud state endpoint is deprecated. Use /api/account/state/{user_id}.",
    )
    clean_username = username.strip()
    clean_platform = platform.strip().lower() or "chesscom"

    if not clean_username:
        raise HTTPException(status_code=400, detail="Username is required.")

    supabase_url, _ = get_supabase_config()

    query = (
        f"{supabase_url}/rest/v1/user_states"
        f"?platform=eq.{quote(clean_platform)}"
        f"&username=eq.{quote(clean_username)}"
        f"&select=username,platform,state,updated_at"
        f"&limit=1"
    )

    response = requests.get(
        query,
        headers=supabase_headers(),
        timeout=20,
    )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text,
        )

    rows = response.json()

    if not rows:
        return {
            "found": False,
            "username": clean_username,
            "platform": clean_platform,
            "state": {},
            "updated_at": None,
        }

    row = rows[0]

    return {
        "found": True,
        "username": row.get("username", clean_username),
        "platform": row.get("platform", clean_platform),
        "state": row.get("state") or {},
        "updated_at": row.get("updated_at"),
    }


@app.post("/api/user-state")
def save_user_state(payload: UserStatePayload, request: Request):
    get_auth_user(request)
    raise HTTPException(
        status_code=410,
        detail="This username-based cloud state endpoint is deprecated. Use /api/account/state.",
    )
    clean_username = payload.username.strip()
    clean_platform = payload.platform.strip().lower() or "chesscom"

    if not clean_username:
        raise HTTPException(status_code=400, detail="Username is required.")

    supabase_url, _ = get_supabase_config()

    row = {
        "username": clean_username,
        "platform": clean_platform,
        "state": payload.state,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    response = requests.post(
        f"{supabase_url}/rest/v1/user_states?on_conflict=platform,username",
        headers=supabase_headers(
            {
                "Prefer": "resolution=merge-duplicates,return=representation",
            }
        ),
        json=row,
        timeout=20,
    )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text,
        )

    saved_rows = response.json()

    return {
        "saved": True,
        "username": clean_username,
        "platform": clean_platform,
        "updated_at": saved_rows[0].get("updated_at") if saved_rows else row["updated_at"],
    }

# -----------------------------
# Premium / Stockfish endpoints
# -----------------------------

import io
import shutil
from typing import Optional as _Optional

try:
    import chess
    import chess.pgn
    import chess.engine
except Exception:
    chess = None


class PremiumStockfishRequest(BaseModel):
    pgn: str
    depth: int = 8
    max_moves: int = 80


class OpeningFitPositionRequest(BaseModel):
    pgn: Optional[str] = None
    fen: Optional[str] = None
    moveHistory: Optional[List[str]] = None
    depth: int = 8
    maxMoves: int = 24


def _find_stockfish_path() -> _Optional[str]:
    env_path = os.getenv("STOCKFISH_PATH", "").strip()
    if env_path and Path(env_path).exists():
        return env_path

    possible_paths = [
        shutil.which("stockfish"),
        "/usr/games/stockfish",
        "/usr/bin/stockfish",
        "/opt/homebrew/bin/stockfish",
    ]

    for path in possible_paths:
        if path and Path(path).exists():
            return path

    return None


def parse_position_for_openingfit(payload: OpeningFitPositionRequest) -> Dict[str, Any]:
    if chess is None:
        raise HTTPException(
            status_code=503,
            detail="python-chess is not installed on the backend.",
        )

    pgn_text = (payload.pgn or "").strip()
    fen_text = (payload.fen or "").strip()
    max_moves = max(4, min(int(payload.maxMoves or 24), 80))

    if fen_text:
        try:
            board = chess.Board(fen_text)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid FEN: {exc}")

        moves = [str(move).strip() for move in (payload.moveHistory or []) if str(move).strip()]
        return {
            "board": board,
            "fen": board.fen(),
            "moves": moves[:max_moves],
            "source": "fen",
        }

    if not pgn_text:
        raise HTTPException(status_code=400, detail="PGN or FEN is required.")

    game = chess.pgn.read_game(io.StringIO(pgn_text))

    if game is None:
        raise HTTPException(status_code=400, detail="Could not parse PGN.")

    board = game.board()
    san_moves = []

    for move in list(game.mainline_moves())[:max_moves]:
        san_moves.append(board.san(move))
        board.push(move)

    return {
        "board": board,
        "fen": board.fen(),
        "moves": san_moves,
        "source": "pgn",
        "taggedOpening": normalize_opening_name(pgn_tag_opening(pgn_text)),
        "eco": pgn_tag_value(pgn_text, "ECO"),
        "ecoUrl": pgn_tag_value(pgn_text, "ECOUrl"),
    }


def detect_opening_family_for_position(
    moves: List[str],
    tagged_opening: str = "",
    eco: str = "",
    eco_url: str = "",
) -> Dict[str, Any]:
    return detect_opening(
        moves,
        tagged_opening=tagged_opening,
        eco=eco,
        eco_url=eco_url,
    )


def format_engine_move(board, move) -> str:
    if not move:
        return ""

    san = board.san(move)
    return f"...{san}" if board.turn == chess.BLACK else san


def analyse_position_with_stockfish(board, depth: int = 8) -> Dict[str, Any]:
    if chess is None:
        return {
            "enabled": False,
            "layer": "stockfish_engine",
            "role": "best moves, evaluations, blunder checks, and tactical training moments",
            "reason": "python-chess is not installed on the backend.",
        }

    engine_path = _find_stockfish_path()

    if not engine_path:
        return {
            "enabled": False,
            "layer": "stockfish_engine",
            "role": "best moves, evaluations, blunder checks, and tactical training moments",
            "reason": "Stockfish is not installed or STOCKFISH_PATH is not set.",
        }

    depth = max(4, min(int(depth or 8), 14))

    try:
        with chess.engine.SimpleEngine.popen_uci(engine_path) as engine:
            analysis = engine.analyse(board, chess.engine.Limit(depth=depth))
    except Exception as exc:
        return {
            "enabled": False,
            "layer": "stockfish_engine",
            "role": "best moves, evaluations, blunder checks, and tactical training moments",
            "reason": f"Stockfish analysis failed: {exc}",
        }

    best_move = analysis.get("pv", [None])[0]
    score = analysis["score"].pov(board.turn)
    cp_score = score.score(mate_score=100000)

    return {
        "enabled": True,
        "layer": "stockfish_engine",
        "role": "best moves, evaluations, blunder checks, and tactical training moments",
        "depth": depth,
        "bestMove": format_engine_move(board, best_move),
        "bestMoveUci": best_move.uci() if best_move else None,
        "evaluation": {
            "centipawns": cp_score,
            "mate": score.mate(),
            "sideToMove": "white" if board.turn == chess.WHITE else "black",
        },
    }


def build_openingfit_suggestion(
    opening_family: Dict[str, Any],
    engine_result: Dict[str, Any],
) -> Dict[str, Any]:
    themes = opening_family.get("themes") or []
    main_theme = themes[0] if themes else "find the right pawn break"
    family = opening_family.get("family") or "opening structure"
    opening = opening_family.get("opening") or "Unknown Opening"
    typical_plans = opening_family.get("typicalPlans") or []
    signals = opening_family.get("signals") or []
    signal_types = sorted({signal.get("type") for signal in signals if signal.get("type")})

    opening_intelligence = {
        "layer": "opening_intelligence",
        "role": "opening names, families, ECO codes, transpositions, structures, repertoire buckets, and human plans",
        "summary": f"This position resembles the {family}.",
        "opening": opening,
        "family": family,
        "confidence": opening_family.get("confidence", "low"),
        "confidenceScore": opening_family.get("confidenceScore", 0),
        "eco": next((signal.get("eco") for signal in signals if signal.get("eco")), None),
        "themes": themes,
        "typicalPlans": typical_plans,
        "repertoireBucket": opening_family.get("repertoireBucket", "Flexible transposition bucket"),
        "evidence": [signal.get("evidence") for signal in signals[:4] if signal.get("evidence")],
        "signalTypes": signal_types,
        "answers": {
            "openingFamily": family,
            "typicalPlan": main_theme,
            "repertoireBucket": opening_family.get("repertoireBucket", "Flexible transposition bucket"),
        },
    }

    if engine_result.get("enabled") and engine_result.get("bestMove"):
        engine_summary = f"In this exact position, Stockfish recommends {engine_result['bestMove']}."
        engine_note = "Engine move included as a position-specific check, not as the whole opening recommendation."
    else:
        engine_summary = "Stockfish is not available here, so the move check is skipped."
        engine_note = engine_result.get("reason")

    stockfish_engine = {
        **engine_result,
        "layer": "stockfish_engine",
        "role": "best moves, evaluations, blunder checks, and tactical training moments",
        "summary": engine_summary,
        "answers": {
            "bestMove": engine_result.get("bestMove"),
            "evaluation": engine_result.get("evaluation"),
            "available": bool(engine_result.get("enabled")),
        },
    }

    summary = (
        f"Opening intelligence: this position resembles the {family}. "
        f"Typical plan: {main_theme}. "
        f"Stockfish layer: {engine_summary}"
    )

    return {
        "summary": summary,
        "openingIntelligence": opening_intelligence,
        "stockfishEngine": stockfish_engine,
        "openingFamily": opening_family,
        "engine": engine_result,
        "engineNote": engine_note,
        "pipeline": [
            "parse_position",
            "detect_opening_family",
            "analyse_with_stockfish_if_available",
            "combine_signals",
        ],
    }


@app.get("/api/premium/stockfish-status")
def premium_stockfish_status():
    if chess is None:
        return {
            "enabled": False,
            "message": "python-chess is not installed.",
        }

    engine_path = _find_stockfish_path()

    if not engine_path:
        return {
            "enabled": False,
            "message": "Stockfish is not installed or STOCKFISH_PATH is not set.",
        }

    return {
        "enabled": True,
        "enginePath": engine_path,
        "message": "Stockfish is available.",
    }


@app.post("/api/openingfit/analyse-position")
def analyse_openingfit_position(payload: OpeningFitPositionRequest):
    position = parse_position_for_openingfit(payload)
    opening_family = detect_opening_family_for_position(
        position["moves"],
        tagged_opening=position.get("taggedOpening", ""),
        eco=position.get("eco", ""),
        eco_url=position.get("ecoUrl", ""),
    )
    engine_result = analyse_position_with_stockfish(position["board"], depth=payload.depth)
    suggestion = build_openingfit_suggestion(opening_family, engine_result)

    return {
        "fen": position["fen"],
        "source": position["source"],
        "moves": position["moves"],
        "openingIntelligence": suggestion["openingIntelligence"],
        "stockfishEngine": suggestion["stockfishEngine"],
        "openingFamily": opening_family,
        "engineResult": engine_result,
        "suggestion": suggestion,
    }


@app.post("/api/premium/stockfish-game")
def premium_stockfish_game(payload: PremiumStockfishRequest):
    if chess is None:
        raise HTTPException(
            status_code=503,
            detail="python-chess is not installed on the backend.",
        )

    engine_path = _find_stockfish_path()

    if not engine_path:
        return {
            "enabled": False,
            "summary": "Stockfish is not available yet, but premium analysis is ready to connect.",
            "mistakes": [],
            "bestMoves": [],
        }

    pgn_text = (payload.pgn or "").strip()

    if not pgn_text:
        raise HTTPException(status_code=400, detail="PGN is required.")

    game = chess.pgn.read_game(io.StringIO(pgn_text))

    if game is None:
        raise HTTPException(status_code=400, detail="Could not parse PGN.")

    depth = max(4, min(int(payload.depth or 8), 14))
    max_moves = max(12, min(int(payload.max_moves or 80), 120))

    board = game.board()
    moves = list(game.mainline_moves())[:max_moves]

    mistakes = []
    best_moves = []

    try:
        with chess.engine.SimpleEngine.popen_uci(engine_path) as engine:
            for index, move in enumerate(moves, start=1):
                side_to_move = board.turn
                move_san = board.san(move)

                before = engine.analyse(
                    board,
                    chess.engine.Limit(depth=depth),
                )

                best_move = before.get("pv", [None])[0]
                before_score = before["score"].pov(side_to_move).score(mate_score=100000)

                if best_move:
                    best_moves.append(
                        {
                            "moveNumber": (index + 1) // 2,
                            "ply": index,
                            "side": "White" if side_to_move == chess.WHITE else "Black",
                            "played": move_san,
                            "bestMove": board.san(best_move),
                        }
                    )

                board.push(move)

                after = engine.analyse(
                    board,
                    chess.engine.Limit(depth=depth),
                )

                after_score = after["score"].pov(side_to_move).score(mate_score=100000)

                if before_score is None or after_score is None:
                    continue

                centipawn_loss = max(0, before_score - after_score)

                if centipawn_loss >= 80:
                    mistakes.append(
                        {
                            "moveNumber": (index + 1) // 2,
                            "ply": index,
                            "side": "White" if side_to_move == chess.WHITE else "Black",
                            "played": move_san,
                            "centipawnLoss": int(centipawn_loss),
                            "severity": (
                                "Blunder"
                                if centipawn_loss >= 300
                                else "Mistake"
                                if centipawn_loss >= 160
                                else "Inaccuracy"
                            ),
                        }
                    )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Stockfish analysis failed: {exc}",
        )

    mistakes = sorted(
        mistakes,
        key=lambda item: item["centipawnLoss"],
        reverse=True,
    )[:10]

    return {
        "enabled": True,
        "summary": (
            "Stockfish reviewed the game and found "
            f"{len(mistakes)} notable opening or middlegame moments."
        ),
        "mistakes": mistakes,
        "bestMoves": best_moves[:12],
        "depth": depth,
    }


# --- OpeningFit local feedback fallback ---
# This is intentionally separate from /api/feedback so it does not break any
# Supabase-backed feedback route already in the app.
try:
    from pydantic import BaseModel as _OpeningFitBaseModel
    from typing import Any as _OpeningFitAny, Optional as _OpeningFitOptional, Dict as _OpeningFitDict
    from datetime import datetime as _OpeningFitDatetime, timezone as _OpeningFitTimezone
    import json as _OpeningFitJson
    from pathlib import Path as _OpeningFitPath

    class _OpeningFitFeedbackLocalPayload(_OpeningFitBaseModel):
        message: str
        email: _OpeningFitOptional[str] = None
        username: _OpeningFitOptional[str] = None
        page: _OpeningFitOptional[str] = None
        report_summary: _OpeningFitOptional[_OpeningFitDict[str, _OpeningFitAny]] = None
        created_at: _OpeningFitOptional[str] = None

    @app.post("/api/feedback-local")
    def openingfit_feedback_local(payload: _OpeningFitFeedbackLocalPayload):
        data_dir = _OpeningFitPath("data")
        data_dir.mkdir(parents=True, exist_ok=True)

        entry = payload.model_dump()
        entry["stored_at"] = _OpeningFitDatetime.now(_OpeningFitTimezone.utc).isoformat()

        with (data_dir / "feedback_local.jsonl").open("a", encoding="utf-8") as handle:
            handle.write(_OpeningFitJson.dumps(entry, ensure_ascii=False) + "\n")

        return {"status": "ok", "stored": "local"}
except Exception as exc:
    print("OpeningFit local feedback fallback failed to initialise:", exc)
# --- End OpeningFit local feedback fallback ---


# --- OpeningFit Chess.com import diagnostics ---
try:
    from fastapi import HTTPException as _OpeningFitHTTPException
    import json as _OpeningFitJson
    import urllib.request as _OpeningFitUrlRequest
    import urllib.error as _OpeningFitUrlError

    def _openingfit_fetch_json(url: str, timeout: int = 8):
        request = _OpeningFitUrlRequest.Request(
            url,
            headers={
                "User-Agent": "OpeningFit diagnostics contact: openingfit.com",
                "Accept": "application/json",
            },
        )

        with _OpeningFitUrlRequest.urlopen(request, timeout=timeout) as response:
            status = getattr(response, "status", 200)
            body = response.read().decode("utf-8", errors="replace")
            return status, _OpeningFitJson.loads(body)

    @app.get("/api/diagnose/chesscom/{username}")
    def openingfit_diagnose_chesscom(username: str):
        clean_username = username.strip()

        if not clean_username:
            raise _OpeningFitHTTPException(status_code=400, detail="Username is required.")

        checks = []

        profile_url = f"https://api.chess.com/pub/player/{clean_username}"
        archives_url = f"https://api.chess.com/pub/player/{clean_username}/games/archives"

        try:
            profile_status, profile = _openingfit_fetch_json(profile_url)
            profile_ok = profile_status == 200 and isinstance(profile, dict)
        except _OpeningFitUrlError.HTTPError as exc:
            if exc.code == 404:
                return {
                    "status": "error",
                    "title": "Chess.com username not found",
                    "message": f"Chess.com could not find '{clean_username}'. Check spelling and try again.",
                    "checks": [
                        {"label": "Backend", "ok": True, "detail": "FastAPI responded."},
                        {"label": "Chess.com profile", "ok": False, "detail": "Profile returned 404."},
                        {"label": "Archives", "ok": False, "detail": "Skipped because profile was not found."},
                        {"label": "Next action", "ok": False, "detail": "Check the username spelling."},
                    ],
                }

            return {
                "status": "error",
                "title": "Chess.com profile check failed",
                "message": f"Chess.com returned HTTP {exc.code} while checking the profile.",
                "checks": [
                    {"label": "Backend", "ok": True, "detail": "FastAPI responded."},
                    {"label": "Chess.com profile", "ok": False, "detail": f"HTTP {exc.code}."},
                ],
            }
        except Exception as exc:
            return {
                "status": "error",
                "title": "Could not reach Chess.com",
                "message": f"The backend could not reach Chess.com right now: {exc}",
                "checks": [
                    {"label": "Backend", "ok": True, "detail": "FastAPI responded."},
                    {"label": "Chess.com", "ok": False, "detail": "Request failed."},
                ],
            }

        checks.append({"label": "Backend", "ok": True, "detail": "FastAPI responded."})
        checks.append({"label": "Chess.com profile", "ok": profile_ok, "detail": "Profile found." if profile_ok else "Profile response was invalid."})

        try:
            archive_status, archives = _openingfit_fetch_json(archives_url)
            archive_list = archives.get("archives", []) if isinstance(archives, dict) else []
            archive_count = len(archive_list)
            archive_ok = archive_status == 200 and archive_count > 0

            checks.append({
                "label": "Game archives",
                "ok": archive_ok,
                "detail": f"{archive_count} monthly archive(s) found.",
            })

            if archive_count == 0:
                return {
                    "status": "warning",
                    "title": "Profile found, but no game archives",
                    "message": f"'{clean_username}' exists, but Chess.com did not return monthly game archives.",
                    "checks": checks + [
                        {"label": "Next action", "ok": False, "detail": "Try another username or check if games are public."}
                    ],
                }

            recent_archives = archive_list[-3:]

            checks.append({
                "label": "Recent months",
                "ok": True,
                "detail": f"Latest archive: {recent_archives[-1] if recent_archives else 'unknown'}",
            })

            return {
                "status": "ok",
                "title": "Import should work",
                "message": f"'{clean_username}' exists and has {archive_count} monthly Chess.com archive(s). If import still fails, the issue is likely inside the analysis route rather than username lookup.",
                "username": clean_username,
                "profile": {
                    "username": profile.get("username"),
                    "title": profile.get("title"),
                    "followers": profile.get("followers"),
                    "country": profile.get("country"),
                },
                "archive_count": archive_count,
                "recent_archives": recent_archives,
                "checks": checks,
            }

        except _OpeningFitUrlError.HTTPError as exc:
            return {
                "status": "error",
                "title": "Archive check failed",
                "message": f"Profile exists, but Chess.com returned HTTP {exc.code} for game archives.",
                "checks": checks + [
                    {"label": "Game archives", "ok": False, "detail": f"HTTP {exc.code}."}
                ],
            }
        except Exception as exc:
            return {
                "status": "error",
                "title": "Could not check game archives",
                "message": f"Profile exists, but archive lookup failed: {exc}",
                "checks": checks + [
                    {"label": "Game archives", "ok": False, "detail": "Archive request failed."}
                ],
            }
except Exception as exc:
    print("OpeningFit diagnostics route failed to initialise:", exc)
# --- End OpeningFit Chess.com import diagnostics ---


# --- Lichess import support ---------------------------------------------------
# Public Lichess games can be downloaded as PGN without needing a login.
# This endpoint returns PGN text in the same spirit as Chess.com imports,
# so the frontend can pass it into the existing analyser flow.

import httpx
from fastapi import Query


@app.get("/api/lichess/games")
async def get_lichess_games(
    username: str = Query(..., min_length=1),
    months: int = Query(3, ge=1, le=12),
    max_games: int = Query(80, ge=1, le=300),
):
    clean_username = username.strip().lstrip("@")

    if not clean_username:
        raise HTTPException(status_code=400, detail="Missing Lichess username.")

    # Rough limit: more months = more games, but capped so imports stay fast.
    calculated_max = min(max_games, max(20, months * 35))

    url = f"https://lichess.org/api/games/user/{clean_username}"

    params = {
        "max": calculated_max,
        "moves": "true",
        "pgnInJson": "false",
        "tags": "true",
        "clocks": "false",
        "evals": "false",
        "opening": "true",
        "perfType": "blitz,rapid,classical",
    }

    headers = {
        "Accept": "application/x-chess-pgn",
        "User-Agent": "OpeningFit beta import",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, params=params, headers=headers)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not connect to Lichess: {exc}",
        )

    if response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail=f"Lichess user '{clean_username}' was not found.",
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Lichess import failed with status {response.status_code}.",
        )

    pgn_text = response.text.strip()

    if not pgn_text:
        raise HTTPException(
            status_code=404,
            detail=f"No recent rated rapid, blitz, or classical games found for '{clean_username}'.",
        )

    game_count = pgn_text.count("[Event ")

    return {
        "platform": "lichess",
        "username": clean_username,
        "months": months,
        "maxGames": calculated_max,
        "gameCount": game_count,
        "pgnText": pgn_text,
    }
# --- End Lichess import support ----------------------------------------------


def is_valid_uuid(value: str) -> bool:
    try:
        UUID(str(value))
        return True
    except Exception:
        return False

# =========================================================
# Opening Fit account sync + Stripe premium support
# =========================================================

class AccountProfilePayload(BaseModel):
    userId: str
    email: Optional[str] = None
    displayName: Optional[str] = None
    platform: Optional[str] = "chesscom"
    username: Optional[str] = None
    lastReport: Optional[Dict[str, Any]] = None


def get_supabase_admin_client():
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not supabase_url or not service_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )

    return create_client(supabase_url, service_key)


def get_auth_user(request: Request):
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token.")

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token.")

    try:
        auth_response = get_supabase_admin_client().auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid auth token: {exc}")

    user = getattr(auth_response, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid auth token.")

    return user


def require_matching_auth_user(request: Request, user_id: str):
    auth_user = get_auth_user(request)
    auth_user_id = str(getattr(auth_user, "id", "") or "")
    if auth_user_id != str(user_id):
        raise HTTPException(status_code=403, detail="Forbidden.")
    return auth_user


def checkout_error_response(status_code: int, message: str, log_message: str, **details):
    print("OpeningFit checkout error:", log_message, details)
    return JSONResponse(status_code=status_code, content={"error": message})


def stripe_value(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def stripe_metadata(obj: Any) -> Dict[str, Any]:
    metadata = stripe_value(obj, "metadata", {}) or {}
    return dict(metadata) if isinstance(metadata, dict) else {}


def upsert_premium_entitlement(supabase_admin, payload: Dict[str, Any]) -> None:
    optional_stripe_columns = {
        "stripe_subscription_id",
        "stripe_payment_intent_id",
        "stripe_price_id",
        "checkout_mode",
    }
    active_payload = dict(payload)

    try:
        supabase_admin.table("premium_entitlements").upsert(
            active_payload,
            on_conflict="user_id",
        ).execute()
    except Exception as exc:
        missing_columns = [
            column
            for column in optional_stripe_columns
            if column in active_payload and column in str(exc)
        ]
        if not missing_columns:
            raise

        for column in missing_columns:
            active_payload.pop(column, None)
        print("OpeningFit premium entitlement retrying without optional Stripe columns", missing_columns)
        supabase_admin.table("premium_entitlements").upsert(
            active_payload,
            on_conflict="user_id",
        ).execute()


def find_premium_user_id_for_stripe_object(supabase_admin, stripe_object: Any) -> Optional[str]:
    metadata = stripe_metadata(stripe_object)
    user_id = metadata.get("user_id")
    if user_id:
        return str(user_id)

    client_reference_id = stripe_value(stripe_object, "client_reference_id")
    if client_reference_id:
        return str(client_reference_id)

    subscription_id = stripe_value(stripe_object, "subscription") or stripe_value(stripe_object, "id")
    payment_intent_id = stripe_value(stripe_object, "payment_intent")
    customer_id = stripe_value(stripe_object, "customer")

    lookup_columns = [
        ("stripe_subscription_id", subscription_id),
        ("stripe_payment_intent_id", payment_intent_id),
        ("stripe_customer_id", customer_id),
    ]

    for column, value in lookup_columns:
        if not value:
            continue
        try:
            result = (
                supabase_admin
                .table("premium_entitlements")
                .select("user_id")
                .eq(column, value)
                .limit(1)
                .execute()
            )
            if result.data:
                return str(result.data[0].get("user_id"))
        except Exception as exc:
            print("OpeningFit Stripe entitlement user lookup failed", {
                "column": column,
                "value": value,
                "error": str(exc),
            })

    return None


def set_profile_premium_status(supabase_admin, user_id: str, is_premium: bool, when: str) -> None:
    supabase_admin.table("profiles").upsert(
        {
            "user_id": user_id,
            "is_premium": is_premium,
            "updated_at": when,
        },
        on_conflict="user_id",
    ).execute()


def checkout_session_is_paid(session: Any) -> bool:
    status = str(stripe_value(session, "status", "") or "").lower()
    payment_status = str(stripe_value(session, "payment_status", "") or "").lower()
    mode = str(stripe_value(session, "mode", "") or "").lower()

    if status != "complete":
        return False

    if mode == "subscription":
        return payment_status in {"paid", "no_payment_required"}

    return payment_status == "paid"


def activate_premium_from_checkout_session(supabase_admin, session: Any, source: str = "stripe_checkout") -> Dict[str, Any]:
    user_id = stripe_value(session, "client_reference_id") or stripe_metadata(session).get("user_id")
    if not user_id:
        raise ValueError("Stripe checkout session is missing user_id metadata.")

    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "user_id": str(user_id),
        "status": "active",
        "source": source,
        "premium_since": now,
        "expires_at": None,
        "stripe_customer_id": stripe_value(session, "customer"),
        "stripe_checkout_session_id": stripe_value(session, "id"),
        "stripe_subscription_id": stripe_value(session, "subscription"),
        "stripe_payment_intent_id": stripe_value(session, "payment_intent"),
        "stripe_price_id": stripe_metadata(session).get("price_id"),
        "checkout_mode": stripe_value(session, "mode"),
        "updated_at": now,
    }

    upsert_premium_entitlement(supabase_admin, payload)
    supabase_admin.table("profiles").upsert(
        {
            "user_id": str(user_id),
            "email": stripe_value(session, "customer_email"),
            "is_premium": True,
            "updated_at": now,
        },
        on_conflict="user_id",
    ).execute()

    return {
        "user_id": str(user_id),
        "status": "active",
        "updated_at": now,
    }


@app.post("/api/account/sync")
async def sync_account_profile(payload: AccountProfilePayload, request: Request):
    require_matching_auth_user(request, payload.userId)
    supabase_admin = get_supabase_admin_client()

    profile = {
        "user_id": payload.userId,
        "email": payload.email,
        "display_name": payload.displayName,
        "platform": payload.platform or "chesscom",
        "username": payload.username,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if payload.lastReport:
        profile["last_report"] = payload.lastReport

    result = (
        supabase_admin
        .table("profiles")
        .upsert(profile, on_conflict="user_id")
        .execute()
    )

    return {
        "ok": True,
        "profile": result.data[0] if result.data else profile,
    }


@app.get("/api/account/profile/{user_id}")
async def get_account_profile(user_id: str, request: Request):
    if not is_valid_uuid(user_id):
        return {"ok": True, "profile": None}

    require_matching_auth_user(request, user_id)
    supabase_admin = get_supabase_admin_client()

    try:
        result = (
            supabase_admin
            .table("profiles")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        print("Supabase account profile lookup failed:", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Supabase account profile lookup failed: {exc}",
        )

    return {
        "ok": True,
        "profile": result.data[0] if result.data else None,
    }


@app.post("/api/account/create-checkout-session")
async def create_checkout_session(payload: Dict[str, Any], request: Request):
    stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    stripe_price_id = (
        os.getenv("STRIPE_PRICE_ID", "").strip()
        or os.getenv("STRIPE_PREMIUM_PRICE_ID", "").strip()
        or os.getenv("STRIPE_FOUNDER_PASS_PRICE_ID", "").strip()
    )
    frontend_url = (
        os.getenv("FRONTEND_URL", "").strip()
        or os.getenv("CLIENT_URL", "").strip()
        or "http://localhost:5173"
    ).rstrip("/")

    if not stripe_secret_key or not stripe_price_id:
        missing = [
            "STRIPE_SECRET_KEY" if not stripe_secret_key else None,
            "STRIPE_PRICE_ID or STRIPE_PREMIUM_PRICE_ID" if not stripe_price_id else None,
        ]
        return checkout_error_response(
            500,
            "We could not start checkout. Please try again.",
            "missing Stripe environment variables",
            missing=[item for item in missing if item],
        )

    stripe.api_key = stripe_secret_key

    requested_user_id = payload.get("userId")

    if not requested_user_id:
        return checkout_error_response(
            400,
            "Please sign in or create an account before upgrading.",
            "missing userId in checkout payload",
        )

    if not is_valid_uuid(requested_user_id):
        return checkout_error_response(
            400,
            "Please sign in or create an account before upgrading.",
            "invalid userId in checkout payload",
            user_id=requested_user_id,
        )

    try:
        auth_user = require_matching_auth_user(request, requested_user_id)
    except HTTPException as exc:
        return checkout_error_response(
            exc.status_code,
            "Please sign in or create an account before upgrading.",
            "checkout auth validation failed",
            status_code=exc.status_code,
            detail=exc.detail,
            user_id=requested_user_id,
        )

    user_id = str(auth_user.id)
    email = getattr(auth_user, "email", None) or payload.get("email")

    try:
        price = stripe.Price.retrieve(stripe_price_id)
        checkout_mode = "subscription" if stripe_value(price, "recurring") else "payment"
        session_params = {
            "mode": checkout_mode,
            "line_items": [
                {
                    "price": stripe_price_id,
                    "quantity": 1,
                }
            ],
            "success_url": f"{frontend_url}/account?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{frontend_url}/account?checkout=cancelled",
            "customer_email": email,
            "client_reference_id": user_id,
            "metadata": {
                "user_id": user_id,
                "price_id": stripe_price_id,
                "product": "openingfit_premium",
            },
        }

        if checkout_mode == "subscription":
            session_params["subscription_data"] = {
                "metadata": {
                    "user_id": user_id,
                    "price_id": stripe_price_id,
                    "product": "openingfit_premium",
                },
            }
        else:
            session_params["payment_intent_data"] = {
                "metadata": {
                    "user_id": user_id,
                    "price_id": stripe_price_id,
                    "product": "openingfit_premium",
                },
            }

        session = stripe.checkout.Session.create(**session_params)
    except Exception as exc:
        return checkout_error_response(
            500,
            "We could not start checkout. Please try again.",
            "Stripe checkout session creation failed",
            error=str(exc),
            user_id=user_id,
        )

    if not getattr(session, "url", None):
        return checkout_error_response(
            500,
            "We could not start checkout. Please try again.",
            "Stripe checkout session returned no URL",
            user_id=user_id,
            session_id=getattr(session, "id", None),
        )

    print("OpeningFit checkout session created", {
        "user_id": user_id,
        "session_id": getattr(session, "id", None),
        "mode": getattr(session, "mode", None),
        "has_url": True,
    })

    return {"url": session.url}


@app.post("/api/account/sync-checkout-session")
async def sync_checkout_session(payload: Dict[str, Any], request: Request):
    stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if not stripe_secret_key:
        return checkout_error_response(
            500,
            "We could not verify checkout yet. Please try restore access again.",
            "missing Stripe secret key for checkout sync",
        )

    stripe.api_key = stripe_secret_key
    requested_user_id = payload.get("userId")
    session_id = str(payload.get("sessionId") or "").strip()

    if not requested_user_id or not is_valid_uuid(requested_user_id):
        return checkout_error_response(
            400,
            "Please sign in or create an account before restoring access.",
            "invalid userId in checkout sync payload",
            user_id=requested_user_id,
        )

    if not session_id.startswith("cs_"):
        return checkout_error_response(
            400,
            "We could not verify that checkout session. Please try restore access again.",
            "invalid checkout session id",
            session_id=session_id,
        )

    try:
        auth_user = require_matching_auth_user(request, requested_user_id)
    except HTTPException as exc:
        return checkout_error_response(
            exc.status_code,
            "Please sign in or create an account before restoring access.",
            "checkout sync auth validation failed",
            status_code=exc.status_code,
            detail=exc.detail,
            user_id=requested_user_id,
        )

    user_id = str(auth_user.id)

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as exc:
        return checkout_error_response(
            502,
            "Stripe has not confirmed that checkout session yet. Please try restore access again.",
            "Stripe checkout session retrieve failed",
            error=str(exc),
            user_id=user_id,
            session_id=session_id,
        )

    session_user_id = stripe_value(session, "client_reference_id") or stripe_metadata(session).get("user_id")
    if str(session_user_id or "") != user_id:
        return checkout_error_response(
            403,
            "That checkout session belongs to a different account.",
            "checkout sync user mismatch",
            user_id=user_id,
            session_user_id=session_user_id,
            session_id=session_id,
        )

    if not checkout_session_is_paid(session):
        return {
            "ok": True,
            "hasPremiumAccess": False,
            "status": stripe_value(session, "status"),
            "paymentStatus": stripe_value(session, "payment_status"),
        }

    try:
        result = activate_premium_from_checkout_session(
            get_supabase_admin_client(),
            session,
            source="stripe_checkout_success_sync",
        )
    except Exception as exc:
        print("OpeningFit checkout success sync failed:", {
            "user_id": user_id,
            "session_id": session_id,
            "error": str(exc),
        })
        raise HTTPException(status_code=500, detail="Premium checkout sync failed.")

    return {
        "ok": True,
        "hasPremiumAccess": True,
        "entitlement": result,
    }


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

    if not stripe_secret_key or not webhook_secret:
        print("OpeningFit Stripe webhook error: missing webhook configuration")
        return JSONResponse(
            status_code=500,
            content={"error": "Stripe webhook is not configured."},
        )

    stripe.api_key = stripe_secret_key

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=webhook_secret,
        )
    except Exception as exc:
        print("OpeningFit Stripe webhook signature verification failed:", exc)
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(exc)}")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = stripe_value(session, "client_reference_id") or stripe_metadata(session).get("user_id")

        if user_id:
            try:
                result = activate_premium_from_checkout_session(
                    get_supabase_admin_client(),
                    session,
                    source="stripe_checkout",
                )

                print("OpeningFit premium entitlement activated", {
                    "user_id": result["user_id"],
                    "session_id": stripe_value(session, "id"),
                    "subscription_id": stripe_value(session, "subscription"),
                    "payment_intent_id": stripe_value(session, "payment_intent"),
                })
            except Exception as exc:
                print("OpeningFit premium entitlement update failed:", {
                    "user_id": user_id,
                    "session_id": stripe_value(session, "id"),
                    "error": str(exc),
                })
                raise HTTPException(status_code=500, detail="Premium entitlement update failed.")
        else:
            print("OpeningFit Stripe checkout completed without a user id", {
                "session_id": stripe_value(session, "id"),
            })
    elif event["type"] == "checkout.session.expired":
        session = event["data"]["object"]
        print("OpeningFit Stripe checkout expired", {
            "session_id": stripe_value(session, "id"),
            "user_id": stripe_value(session, "client_reference_id") or stripe_metadata(session).get("user_id"),
        })
    elif event["type"] in {
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.payment_failed",
    }:
        stripe_object = event["data"]["object"]
        event_type = event["type"]
        subscription_status = str(stripe_value(stripe_object, "status", "") or "").lower()
        now = datetime.now(timezone.utc).isoformat()

        active_statuses = {"active", "trialing"}
        inactive_statuses = {"canceled", "cancelled", "unpaid", "incomplete_expired", "past_due"}
        is_active = event_type != "invoice.payment_failed" and subscription_status in active_statuses
        should_update = (
            is_active
            or event_type == "customer.subscription.deleted"
            or event_type == "invoice.payment_failed"
            or subscription_status in inactive_statuses
        )

        if should_update:
            try:
                supabase_admin = get_supabase_admin_client()
                user_id = find_premium_user_id_for_stripe_object(supabase_admin, stripe_object)

                if user_id:
                    subscription_id = (
                        stripe_value(stripe_object, "subscription")
                        or stripe_value(stripe_object, "id")
                    )
                    customer_id = stripe_value(stripe_object, "customer")
                    status = "active" if is_active else ("past_due" if event_type == "invoice.payment_failed" else "inactive")

                    upsert_premium_entitlement(
                        supabase_admin,
                        {
                            "user_id": user_id,
                            "status": status,
                            "source": f"stripe_{event_type}",
                            "stripe_customer_id": customer_id,
                            "stripe_subscription_id": subscription_id,
                            "expires_at": None if is_active else now,
                            "updated_at": now,
                        },
                    )
                    set_profile_premium_status(supabase_admin, user_id, is_active, now)
                    print("OpeningFit premium entitlement lifecycle update", {
                        "user_id": user_id,
                        "event_type": event_type,
                        "status": status,
                        "subscription_status": subscription_status,
                    })
                else:
                    print("OpeningFit Stripe lifecycle event could not be matched to a user", {
                        "event_type": event_type,
                        "subscription_id": stripe_value(stripe_object, "subscription") or stripe_value(stripe_object, "id"),
                        "customer_id": stripe_value(stripe_object, "customer"),
                    })
            except Exception as exc:
                print("OpeningFit premium lifecycle update failed:", {
                    "event_type": event_type,
                    "error": str(exc),
                })
                raise HTTPException(status_code=500, detail="Premium lifecycle update failed.")
    elif event["type"] in {"charge.refunded", "refund.updated"}:
        stripe_object = event["data"]["object"]
        event_type = event["type"]
        refund_status = str(stripe_value(stripe_object, "status", "") or "").lower()
        should_deactivate = event_type == "charge.refunded" or refund_status in {"succeeded", "requires_action"}

        if should_deactivate:
            try:
                supabase_admin = get_supabase_admin_client()
                user_id = find_premium_user_id_for_stripe_object(supabase_admin, stripe_object)
                now = datetime.now(timezone.utc).isoformat()

                if user_id:
                    upsert_premium_entitlement(
                        supabase_admin,
                        {
                            "user_id": user_id,
                            "status": "refunded",
                            "source": f"stripe_{event_type}",
                            "stripe_customer_id": stripe_value(stripe_object, "customer"),
                            "stripe_payment_intent_id": stripe_value(stripe_object, "payment_intent"),
                            "expires_at": now,
                            "updated_at": now,
                        },
                    )
                    set_profile_premium_status(supabase_admin, user_id, False, now)
                    print("OpeningFit premium entitlement refunded", {
                        "user_id": user_id,
                        "event_type": event_type,
                        "payment_intent_id": stripe_value(stripe_object, "payment_intent"),
                    })
                else:
                    print("OpeningFit refund event could not be matched to a user", {
                        "event_type": event_type,
                        "customer_id": stripe_value(stripe_object, "customer"),
                        "payment_intent_id": stripe_value(stripe_object, "payment_intent"),
                    })
            except Exception as exc:
                print("OpeningFit premium refund update failed:", {
                    "event_type": event_type,
                    "error": str(exc),
                })
                raise HTTPException(status_code=500, detail="Premium refund update failed.")

    return {"received": True}


@app.delete("/api/account/{user_id}")
async def delete_account(user_id: str, request: Request):
    if not is_valid_uuid(user_id):
        raise HTTPException(status_code=400, detail="Invalid account id.")

    require_matching_auth_user(request, user_id)
    supabase_admin = get_supabase_admin_client()

    supabase_admin.table("profiles").delete().eq("user_id", user_id).execute()
    supabase_admin.table("user_profiles").delete().eq("id", user_id).execute()
    supabase_admin.auth.admin.delete_user(user_id)

    return {"ok": True}
# =========================================================
# End account sync + Stripe premium support
# =========================================================



# ---------------------------------------------------------------------------
# OpeningFit cloud user state
# Stores report/progress state for logged-in accounts.
# Logged-out users can still use localStorage on the frontend.
# ---------------------------------------------------------------------------

from typing import Optional, Dict, Any
from pydantic import BaseModel


class OpeningFitUserStatePayload(BaseModel):
    user_id: str
    platform: str = "unknown"
    username: str = "guest"
    last_report: Optional[Dict[str, Any]] = None
    coach_progress: Optional[Dict[str, Any]] = None
    progress_history: Optional[list] = None
    import_history: Optional[list] = None


def _get_supabase_for_user_state():
    """
    Use the existing admin Supabase helper when available.
    This is more reliable than relying on the global `supabase` variable,
    because get_supabase_admin_client() reads the current backend env directly.
    """
    helper = globals().get("get_supabase_admin_client")
    if callable(helper):
        return helper()

    client = globals().get("supabase")
    if client is not None:
        return client

    client = globals().get("supabase_client")
    if client is not None:
        return client

    raise HTTPException(
        status_code=500,
        detail="Supabase is not configured on the backend. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    )


def _clean_platform(value: str) -> str:
    value = str(value or "unknown").strip().lower()
    if value in {"chess.com", "chesscom", "chess_com"}:
        return "chesscom"
    if value in {"lichess", "lichess.org"}:
        return "lichess"
    return value or "unknown"


def _clean_username(value: str) -> str:
    return str(value or "guest").strip() or "guest"


@app.get("/api/account/state/{user_id}")
def get_openingfit_user_state(
    request: Request,
    user_id: str,
    platform: str = "unknown",
    username: str = "guest",
):
    require_matching_auth_user(request, user_id)
    sb = _get_supabase_for_user_state()

    platform = _clean_platform(platform)
    username = _clean_username(username)

    try:
        result = (
            sb.table("openingfit_user_state")
            .select("*")
            .eq("user_id", user_id)
            .eq("platform", platform)
            .eq("username", username)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Cloud state lookup failed: {exc}",
        )

    rows = getattr(result, "data", None) or []

    if not rows:
        return {
            "found": False,
            "user_id": user_id,
            "platform": platform,
            "username": username,
            "last_report": None,
            "coach_progress": {},
            "progress_history": [],
            "import_history": [],
        }

    row = rows[0]

    return {
        "found": True,
        "user_id": row.get("user_id"),
        "platform": row.get("platform"),
        "username": row.get("username"),
        "last_report": row.get("last_report"),
        "coach_progress": row.get("coach_progress") or {},
        "progress_history": row.get("progress_history") or [],
        "import_history": row.get("import_history") or [],
        "updated_at": row.get("updated_at"),
    }


@app.post("/api/account/state")
def save_openingfit_user_state(payload: OpeningFitUserStatePayload, request: Request):
    require_matching_auth_user(request, payload.user_id)
    sb = _get_supabase_for_user_state()

    platform = _clean_platform(payload.platform)
    username = _clean_username(payload.username)

    row = {
        "user_id": payload.user_id,
        "platform": platform,
        "username": username,
    }

    if payload.last_report is not None:
        row["last_report"] = payload.last_report

    if payload.coach_progress is not None:
        row["coach_progress"] = payload.coach_progress

    if payload.progress_history is not None:
        row["progress_history"] = payload.progress_history

    if payload.import_history is not None:
        row["import_history"] = payload.import_history

    try:
        result = (
            sb.table("openingfit_user_state")
            .upsert(row, on_conflict="user_id,platform,username")
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Cloud state save failed: {exc}",
        )

    return {
        "ok": True,
        "saved": True,
        "platform": platform,
        "username": username,
        "data": getattr(result, "data", None),
    }
