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
from typing import List, Dict, Any, Optional, Tuple
import os
from dotenv import load_dotenv
import re
import json
import math
import hashlib
import shutil
from pathlib import Path
from datetime import datetime, timezone, timedelta
from uuid import UUID

import requests
import chess
import chess.engine
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
ENGINE_CACHE_FILE = DATA_DIR / "engine_validation_cache.json"

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


def previous_saved_report(username: str, platform: str) -> Optional[Dict[str, Any]]:
    profile = load_user_profile(username, platform)
    if not profile:
        return None
    report = profile.get("latestResult") or profile.get("latest_report") or profile.get("last_report")
    return report if isinstance(report, dict) else None


def numeric_report_value(report: Dict[str, Any], *keys: str) -> Optional[float]:
    for key in keys:
        value = report.get(key)
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def report_opening_map(report: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    openings = report.get("bestOpenings") or report.get("best_openings") or report.get("topOpenings") or report.get("top_openings") or []
    if not isinstance(openings, list):
        return {}
    mapped = {}
    for item in openings:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or item.get("opening") or "").strip()
        if not name or is_unknown_opening_name(name):
            continue
        context = str(item.get("context") or item.get("repertoireContext") or item.get("colour") or item.get("color") or "")
        mapped[f"{normalise_opening_key(name)}::{context}"] = item
    return mapped


def report_gap_map(report: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    coverage = report.get("repertoireCoverage") or report.get("repertoire_coverage") or {}
    rows = []
    if isinstance(coverage, dict):
        rows = (coverage.get("white") or []) + (coverage.get("black") or [])
    mapped = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        key = str(row.get("key") or row.get("label") or "").strip()
        if key:
            mapped[key] = row
    return mapped


def report_problem_line_map(report: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    lines = report.get("problemLines") or report.get("problem_lines") or []
    mapped = {}
    if not isinstance(lines, list):
        return mapped
    for line in lines:
        if not isinstance(line, dict):
            continue
        key = f"{normalise_opening_key(str(line.get('opening') or line.get('name') or ''))}::{line.get('line') or ''}"
        if key.strip(":"):
            mapped[key] = line
    return mapped


def report_study_task_map(report: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    tasks = report.get("studyQueue") or report.get("study_queue") or []
    mapped = {}
    if not isinstance(tasks, list):
        return mapped
    for task in tasks:
        if not isinstance(task, dict):
            continue
        key = str(task.get("source") or task.get("title") or "").strip().lower()
        if key:
            mapped[key] = task
    return mapped


def change_direction(current: float, previous: float, margin: float = 0.5) -> str:
    if current > previous + margin:
        return "improved"
    if current < previous - margin:
        return "dropped"
    return "stable"


def build_report_progress_comparison(current: Dict[str, Any], previous: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not previous:
        return {"enabled": False, "available": False, "items": [], "summary": ""}

    items: List[Dict[str, Any]] = []
    current_openings = report_opening_map(current)
    previous_openings = report_opening_map(previous)

    current_fit = numeric_report_value(current, "openingFitScore", "opening_fit_score")
    previous_fit = numeric_report_value(previous, "openingFitScore", "opening_fit_score")
    if current_fit is not None and previous_fit is not None:
        direction = change_direction(current_fit, previous_fit, 1)
        if direction != "stable":
            verb = "improved" if direction == "improved" else "dropped"
            items.append(
                {
                    "type": "fit_score",
                    "status": direction,
                    "title": f"OpeningFit score {verb}",
                    "copy": f"Your OpeningFit score {verb} from {round(previous_fit)} to {round(current_fit)}.",
                    "previous": previous_fit,
                    "current": current_fit,
                }
            )

    current_top = list(current_openings.values())[:3]
    previous_top = list(previous_openings.values())[:3]
    current_top_names = {normalise_opening_key(str(item.get("name") or "")) for item in current_top}
    previous_top_names = {normalise_opening_key(str(item.get("name") or "")) for item in previous_top}
    added_top = [item for item in current_top if normalise_opening_key(str(item.get("name") or "")) not in previous_top_names]
    dropped_top = [item for item in previous_top if normalise_opening_key(str(item.get("name") or "")) not in current_top_names]
    if added_top:
        name = str(added_top[0].get("name") or "A new opening")
        games = int(added_top[0].get("games", 0) or 0)
        items.append(
            {
                "type": "top_openings",
                "status": "changed",
                "title": f"{name} is now a top opening",
                "copy": f"{name} entered your top opening group with {games} game{'' if games == 1 else 's'} in this report.",
                "opening": name,
            }
        )
    if dropped_top:
        name = str(dropped_top[0].get("name") or "A previous opening")
        items.append(
            {
                "type": "top_openings",
                "status": "changed",
                "title": f"{name} is less prominent now",
                "copy": f"{name} dropped out of your top opening group since the previous report.",
                "opening": name,
            }
        )

    for key, current_item in current_openings.items():
        previous_item = previous_openings.get(key)
        if not previous_item:
            continue
        name = str(current_item.get("name") or "This opening")
        current_score = numeric_report_value(current_item, "winRate", "win_rate", "scorePct", "score")
        previous_score = numeric_report_value(previous_item, "winRate", "win_rate", "scorePct", "score")
        if current_score is not None and previous_score is not None:
            direction = change_direction(current_score, previous_score)
            if direction != "stable":
                verb = "improved" if direction == "improved" else "dropped"
                items.append(
                    {
                        "type": "opening_score",
                        "status": direction,
                        "title": f"{name} score {verb}",
                        "copy": f"Since your last report, your {name} score {verb} from {round(previous_score, 1)}% to {round(current_score, 1)}%.",
                        "opening": name,
                        "previous": previous_score,
                        "current": current_score,
                    }
                )

        current_confidence = str(current_item.get("confidence") or current_item.get("confidenceLabel") or "").strip()
        previous_confidence = str(previous_item.get("confidence") or previous_item.get("confidenceLabel") or "").strip()
        if current_confidence and previous_confidence and current_confidence != previous_confidence:
            items.append(
                {
                    "type": "confidence",
                    "status": "changed",
                    "title": f"{name} confidence changed",
                    "copy": f"{name} moved from {previous_confidence} to {current_confidence}.",
                    "opening": name,
                    "previous": previous_confidence,
                    "current": current_confidence,
                }
            )

    previous_gaps = report_gap_map(previous)
    current_gaps = report_gap_map(current)
    unresolved_statuses = {"No clear plan", "Too little data", "Needs work"}
    for key, current_gap in current_gaps.items():
        previous_gap = previous_gaps.get(key)
        if not previous_gap:
            continue
        current_status = current_gap.get("status")
        previous_status = previous_gap.get("status")
        label = current_gap.get("label") or key
        if current_status in unresolved_statuses and previous_status in unresolved_statuses:
            items.append(
                {
                    "type": "repertoire_gap",
                    "status": "unresolved",
                    "title": f"{label} still needs work",
                    "copy": f"Your {label} gap is still unresolved.",
                    "area": label,
                    "previous": previous_status,
                    "current": current_status,
                }
            )
        elif current_status == "Covered" and previous_status in unresolved_statuses:
            items.append(
                {
                    "type": "repertoire_gap",
                    "status": "resolved",
                    "title": f"{label} improved",
                    "copy": f"{label} moved from {previous_status} to Covered.",
                    "area": label,
                    "previous": previous_status,
                    "current": current_status,
                }
            )

    previous_lines = report_problem_line_map(previous)
    current_lines = report_problem_line_map(current)
    for key, current_line in current_lines.items():
        previous_line = previous_lines.get(key)
        if previous_line:
            opening = current_line.get("opening") or current_line.get("name") or "This line"
            items.append(
                {
                    "type": "problem_line",
                    "status": "repeated",
                    "title": f"{opening} problem line repeated",
                    "copy": current_line.get("summary") or f"{opening} is still appearing as a problem line.",
                    "opening": opening,
                }
            )
            continue
        opening = current_line.get("opening") or current_line.get("name") or "This line"
        items.append(
            {
                "type": "problem_line",
                "status": "new",
                "title": f"New problem line: {opening}",
                "copy": current_line.get("summary") or f"{opening} newly appears as a problem line.",
                "opening": opening,
            }
        )

    resolved_lines = [
        line for key, line in previous_lines.items()
        if key not in current_lines
    ]
    if resolved_lines:
        line = resolved_lines[0]
        opening = line.get("opening") or line.get("name") or "A previous line"
        items.append(
            {
                "type": "problem_line",
                "status": "resolved",
                "title": f"{opening} line no longer flagged",
                "copy": f"{opening} is no longer showing as a repeated problem line.",
                "opening": opening,
            }
        )

    current_coherence = numeric_report_value(current.get("repertoireCoherence") or current.get("repertoire_coherence") or {}, "score")
    previous_coherence = numeric_report_value(previous.get("repertoireCoherence") or previous.get("repertoire_coherence") or {}, "score")
    if current_coherence is not None and previous_coherence is not None:
        direction = change_direction(current_coherence, previous_coherence, 1)
        if direction != "stable":
            verb = "improved" if direction == "improved" else "dropped"
            items.append(
                {
                    "type": "coherence",
                    "status": direction,
                    "title": f"Repertoire coherence {verb}",
                    "copy": f"Your repertoire coherence score {verb} from {round(previous_coherence)} to {round(current_coherence)}.",
                    "previous": previous_coherence,
                    "current": current_coherence,
                }
            )

    previous_tasks = report_study_task_map(previous)
    current_tasks = report_study_task_map(current)
    improved_tasks = [
        task for key, task in previous_tasks.items()
        if key and key not in current_tasks
    ]
    if improved_tasks:
        task = improved_tasks[0]
        items.append(
            {
                "type": "study_action",
                "status": "improved",
                "title": "One study task may be improving",
                "copy": f"'{task.get('title')}' is no longer in the current study queue.",
            }
        )

    if not items:
        items.append(
            {
                "type": "stable",
                "status": "stable",
                "title": "Report is mostly stable",
                "copy": "Your main openings, gaps, and study priorities are broadly similar to the previous report.",
            }
        )

    priority = {"improved": 0, "resolved": 0, "dropped": 1, "unresolved": 1, "changed": 2, "repeated": 2, "new": 2, "stable": 3}
    items = sorted(items, key=lambda item: priority.get(str(item.get("status")), 4))[:6]
    return {
        "enabled": True,
        "available": True,
        "summary": f"Compared with your previous saved report from {previous.get('importedAt') or previous.get('lastUpdated') or 'the last import'}.",
        "items": items,
        "previousImportedAt": previous.get("importedAt") or previous.get("lastUpdated"),
        "currentImportedAt": current.get("importedAt") or current.get("lastUpdated"),
    }


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

    if verdict in {"Fix", "Improve"}:
        return "Lower-scoring sample"

    if verdict in {"Replace", "Avoid"}:
        return "Recent underperformer"

    if verdict == "Experiment":
        return "Not enough context to judge"

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
        "opening_losses": 0,
        "middlegame_losses": 0,
        "late_losses": 0,
        "unknown_losses": 0,
        "move_orders_4": {},
        "move_orders_6": {},
        "move_orders_8": {},
        "move_orders_10": {},
        "plan_structures_6": {},
        "plan_structures_8": {},
        "plan_structures_10": {},
    }


def move_order_key(moves: List[str], plies: int) -> str:
    cleaned = [clean_san_move(move).rstrip("+#?!") for move in (moves or [])[:plies]]
    cleaned = [move for move in cleaned if move]
    return " ".join(cleaned)


def add_move_order_to_stats(stats: Dict[str, Any], moves: List[str]) -> None:
    for plies in (4, 6, 8, 10):
        key = move_order_key(moves, plies)
        if not key:
            continue
        bucket = stats.setdefault(f"move_orders_{plies}", {})
        bucket[key] = int(bucket.get(key, 0) or 0) + 1


def add_plan_structure_to_stats(stats: Dict[str, Any], moves: List[str], result: str) -> None:
    for plies in (6, 8, 10):
        key = move_order_key(moves, plies)
        if not key:
            continue
        bucket = stats.setdefault(f"plan_structures_{plies}", {})
        row = bucket.setdefault(key, {"games": 0, "wins": 0, "draws": 0, "losses": 0})
        row["games"] += 1
        if result == "win":
            row["wins"] += 1
        elif result == "draw":
            row["draws"] += 1
        elif result == "loss":
            row["losses"] += 1


def move_order_consistency_fields(opening: Dict[str, Any]) -> Dict[str, Any]:
    games = int(opening.get("games", 0) or 0)
    breakdown = {}
    best_sequence = ""
    best_ply = 0
    best_count = 0
    weighted_pct = 0.0
    weight_total = 0.0

    for plies, weight in [(4, 0.15), (6, 0.25), (8, 0.30), (10, 0.30)]:
        orders = opening.get(f"move_orders_{plies}") or opening.get(f"moveOrders{plies}") or {}
        if not isinstance(orders, dict) or not orders:
            breakdown[str(plies)] = {
                "plies": plies,
                "topSequence": "",
                "topCount": 0,
                "topPercentage": 0,
                "variationCount": 0,
            }
            continue

        total = sum(int(value or 0) for value in orders.values())
        top_sequence, top_count = sorted(
            orders.items(),
            key=lambda item: (int(item[1] or 0), -len(str(item[0]))),
            reverse=True,
        )[0]
        top_pct = round((int(top_count or 0) / total) * 100, 1) if total else 0
        weighted_pct += top_pct * weight
        weight_total += weight
        breakdown[str(plies)] = {
            "plies": plies,
            "topSequence": top_sequence,
            "topCount": int(top_count or 0),
            "topPercentage": top_pct,
            "variationCount": len(orders),
        }
        if int(top_count or 0) > best_count or (int(top_count or 0) == best_count and plies > best_ply):
            best_sequence = str(top_sequence)
            best_ply = plies
            best_count = int(top_count or 0)

    score = round(weighted_pct / weight_total) if weight_total else 0
    variation_count = max((row["variationCount"] for row in breakdown.values()), default=0)

    if games < 3 or not best_sequence:
        status = "No clear move order"
        note = "There is not enough repeated move-order data to judge this opening plan yet."
    elif score >= 70 and best_count >= 3:
        status = "Consistent"
        note = f"{opening.get('name', 'This opening')}: Consistent. You usually reach the same setup by move {max(2, best_ply // 2)}."
    elif score >= 50:
        status = "Some variation"
        note = f"{opening.get('name', 'This opening')}: Some variation. Your main setup is visible, but the early move order still changes."
    else:
        status = "Unstable"
        note = f"{opening.get('name', 'This opening')}: Unstable. You use several different early move orders, so the plan is not settled yet."

    return {
        "move_order_status": status,
        "moveOrderStatus": status,
        "move_order_score": score,
        "moveOrderScore": score,
        "move_order_note": note,
        "moveOrderNote": note,
        "most_reliable_move_order": best_sequence,
        "mostReliableMoveOrder": best_sequence,
        "most_reliable_move_order_plies": best_ply,
        "mostReliableMoveOrderPlies": best_ply,
        "move_order_variation_count": variation_count,
        "moveOrderVariationCount": variation_count,
        "move_order_breakdown": breakdown,
        "moveOrderBreakdown": breakdown,
    }


def plan_clarity_fields(opening: Dict[str, Any]) -> Dict[str, Any]:
    games = int(opening.get("games", 0) or 0)
    move_breakdown = opening.get("moveOrderBreakdown") or opening.get("move_order_breakdown") or {}
    structure_breakdown = {}
    weighted_concentration = 0.0
    weight_total = 0.0
    best_sequence = ""
    best_count = 0
    best_plies = 0
    structure_scores = []

    for plies, weight in [(6, 0.30), (8, 0.35), (10, 0.35)]:
        row = move_breakdown.get(str(plies), {}) if isinstance(move_breakdown, dict) else {}
        top_pct = float(row.get("topPercentage", 0) or 0)
        weighted_concentration += top_pct * weight
        weight_total += weight
        if int(row.get("topCount", 0) or 0) > best_count:
            best_count = int(row.get("topCount", 0) or 0)
            best_sequence = str(row.get("topSequence") or "")
            best_plies = plies

        structures = opening.get(f"plan_structures_{plies}") or opening.get(f"planStructures{plies}") or {}
        repeated = []
        if isinstance(structures, dict):
            for sequence, stats in structures.items():
                structure_games = int((stats or {}).get("games", 0) or 0)
                if structure_games < 2:
                    continue
                wins = int((stats or {}).get("wins", 0) or 0)
                draws = int((stats or {}).get("draws", 0) or 0)
                score = round(((wins + 0.5 * draws) / structure_games) * 100, 1)
                repeated.append({"sequence": sequence, "games": structure_games, "score": score})
                structure_scores.append(score)
        structure_breakdown[str(plies)] = repeated[:4]

    concentration_score = round(weighted_concentration / weight_total) if weight_total else 0
    if len(structure_scores) >= 2:
        spread = max(structure_scores) - min(structure_scores)
        stability_score = max(20, round(100 - min(80, spread)))
    elif structure_scores:
        stability_score = 70
    else:
        stability_score = 35

    move_order_score = int(opening.get("moveOrderScore", opening.get("move_order_score", 0)) or 0)
    score = round(concentration_score * 0.55 + move_order_score * 0.20 + stability_score * 0.25)

    if games < 3 or not best_sequence:
        status = "Too little data"
        note = f"{opening.get('name', 'This opening')}: Too little data. There are not enough repeated games to judge the plan after the opening."
    elif score >= 72 and best_count >= 3:
        status = "Clear plan"
        note = f"{opening.get('name', 'This opening')}: Clear plan. You usually reach similar structures by move {max(3, best_plies // 2)}."
    elif score >= 52:
        status = "Some plan"
        note = f"{opening.get('name', 'This opening')}: Some plan. A main setup is visible, but your follow-up choices still branch."
    else:
        status = "Unclear plan"
        note = f"{opening.get('name', 'This opening')}: Unclear plan. Your early setup and follow-up structures vary heavily."

    return {
        "plan_clarity_status": status,
        "planClarityStatus": status,
        "plan_clarity_score": score,
        "planClarityScore": score,
        "plan_clarity_note": note,
        "planClarityNote": note,
        "plan_clarity_best_sequence": best_sequence,
        "planClarityBestSequence": best_sequence,
        "plan_clarity_structure_stability": stability_score,
        "planClarityStructureStability": stability_score,
        "plan_clarity_breakdown": structure_breakdown,
        "planClarityBreakdown": structure_breakdown,
    }


def move_count_from_moves(moves: List[str]) -> int:
    return math.ceil(len(moves or []) / 2)


def classify_loss_timing(result: str, moves: Optional[List[str]] = None, pgn: str = "") -> Dict[str, Any]:
    if str(result or "").lower() != "loss":
        return {
            "bucket": "none",
            "label": "Not a loss",
            "move_count": move_count_from_moves(moves or clean_moves_from_pgn(pgn)),
        }

    clean_moves = moves if isinstance(moves, list) else clean_moves_from_pgn(pgn)
    move_count = move_count_from_moves(clean_moves)

    if not move_count:
        return {
            "bucket": "unknown",
            "label": "Unknown",
            "move_count": 0,
        }
    if move_count <= 15:
        return {
            "bucket": "opening",
            "label": "Opening loss",
            "move_count": move_count,
        }
    if move_count <= 35:
        return {
            "bucket": "middlegame",
            "label": "Middlegame loss",
            "move_count": move_count,
        }
    return {
        "bucket": "late",
        "label": "Late loss",
        "move_count": move_count,
    }


def add_loss_timing_to_stats(stats: Dict[str, Any], timing: Dict[str, Any]) -> None:
    bucket = str(timing.get("bucket") or "unknown")
    if bucket == "opening":
        stats["opening_losses"] += 1
    elif bucket == "middlegame":
        stats["middlegame_losses"] += 1
    elif bucket == "late":
        stats["late_losses"] += 1
    elif bucket == "unknown":
        stats["unknown_losses"] += 1


def loss_timing_fields(opening: Dict[str, Any]) -> Dict[str, Any]:
    opening_losses = int(opening.get("opening_losses", opening.get("openingLosses", 0)) or 0)
    middlegame_losses = int(opening.get("middlegame_losses", opening.get("middlegameLosses", 0)) or 0)
    late_losses = int(opening.get("late_losses", opening.get("lateLosses", 0)) or 0)
    unknown_losses = int(opening.get("unknown_losses", opening.get("unknownLosses", 0)) or 0)
    total_losses = int(opening.get("losses", 0) or 0)
    weighted_losses = opening_losses + middlegame_losses * 0.65 + late_losses * 0.25 + unknown_losses * 0.75

    note = ""
    if total_losses:
        name = str(opening.get("name") or "this opening")
        if late_losses >= max(2, math.ceil(total_losses * 0.5)):
            note = (
                f"You lost {total_losses} game{'' if total_losses == 1 else 's'} in {name}, "
                f"but {late_losses} were long games, so OpeningFit is not blaming the opening too strongly."
            )
        elif opening_losses >= max(2, math.ceil(total_losses * 0.5)):
            note = (
                f"Your {name} losses mostly happen before move 15, so this may be a real opening issue."
            )
        elif middlegame_losses >= max(2, math.ceil(total_losses * 0.5)):
            note = (
                f"Most {name} losses happen after the opening phase, so review early middlegame plans before blaming the opening itself."
            )

    return {
        "opening_losses": opening_losses,
        "openingLosses": opening_losses,
        "middlegame_losses": middlegame_losses,
        "middlegameLosses": middlegame_losses,
        "late_losses": late_losses,
        "lateLosses": late_losses,
        "unknown_losses": unknown_losses,
        "unknownLosses": unknown_losses,
        "weighted_opening_losses": round(weighted_losses, 2),
        "weightedOpeningLosses": round(weighted_losses, 2),
        "loss_timing_note": note,
        "lossTimingNote": note,
        "loss_timing": {
            "opening": opening_losses,
            "middlegame": middlegame_losses,
            "late": late_losses,
            "unknown": unknown_losses,
            "weightedOpeningLosses": round(weighted_losses, 2),
        },
        "lossTiming": {
            "opening": opening_losses,
            "middlegame": middlegame_losses,
            "late": late_losses,
            "unknown": unknown_losses,
            "weightedOpeningLosses": round(weighted_losses, 2),
        },
    }


def opening_item(
    name: str,
    games: int,
    context: str,
    stats: Optional[Dict[str, int]] = None,
    total_games: int = 0,
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
        "opening_losses": int(stats.get("opening_losses", 0) or 0),
        "middlegame_losses": int(stats.get("middlegame_losses", 0) or 0),
        "late_losses": int(stats.get("late_losses", 0) or 0),
        "unknown_losses": int(stats.get("unknown_losses", 0) or 0),
        "move_orders_4": dict(stats.get("move_orders_4", {}) or {}),
        "move_orders_6": dict(stats.get("move_orders_6", {}) or {}),
        "move_orders_8": dict(stats.get("move_orders_8", {}) or {}),
        "move_orders_10": dict(stats.get("move_orders_10", {}) or {}),
        "plan_structures_6": dict(stats.get("plan_structures_6", {}) or {}),
        "plan_structures_8": dict(stats.get("plan_structures_8", {}) or {}),
        "plan_structures_10": dict(stats.get("plan_structures_10", {}) or {}),
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

    item.update(loss_timing_fields(item))
    item.update(move_order_consistency_fields(item))
    item.update(plan_clarity_fields(item))
    item.update(opening_confidence_fields(item, total_games))
    item.update(balanced_opening_fit_score(item))
    item = apply_opening_risk_profile(item)
    item["evidence"] = opening_evidence_bullets(item)
    item["evidenceBullets"] = item["evidence"]

    return item


def opening_confidence_fields(opening: Dict[str, Any], total_games: int = 0) -> Dict[str, Any]:
    games = int(opening.get("games", 0) or 0)
    total = int(total_games or 0)
    sample_pct = round((games / total) * 100, 1) if total > 0 else 0
    context = str(opening.get("context") or opening.get("repertoireContext") or "unknown_mixed")
    clean_context = context != "unknown_mixed" and context_is_compatible(str(opening.get("name", "")), context)
    score = opening.get("winRate", opening.get("win_rate"))
    wins = int(opening.get("wins", 0) or 0)
    draws = int(opening.get("draws", 0) or 0)
    losses = int(opening.get("losses", 0) or 0)
    decisive_gap = abs(wins - losses)
    score_text = f"{round(float(score), 1)}% score" if score is not None else "score unavailable"
    sample_text = f"{games} game{'' if games == 1 else 's'}"
    pct_text = f"{sample_pct}% of your imported games" if sample_pct else "a small share of your imported games"

    if games < 5:
        label = "Too little data"
        tier = "too_little_data"
        reason = (
            f"You only reached this structure in {sample_text}, so OpeningFit cannot judge it properly yet."
        )
    elif clean_context and games >= 15 and sample_pct >= 8 and decisive_gap >= 4:
        label = "High confidence"
        tier = "high"
        reason = (
            f"You have played it regularly ({sample_text}, {pct_text}), the colour context is clear, "
            f"and the result pattern is stable at {score_text}."
        )
    elif clean_context and games >= 10 and sample_pct >= 4:
        label = "Medium confidence"
        tier = "medium"
        reason = (
            f"You have a useful sample ({sample_text}, {pct_text}) in the right colour context, "
            f"but more games would make the verdict sharper."
        )
    elif clean_context and games >= 5:
        label = "Low confidence"
        tier = "low"
        reason = (
            f"This is an early signal ({sample_text}, {pct_text}) with {score_text}; treat it as a trend to watch."
        )
    else:
        label = "Low confidence"
        tier = "low"
        reason = "The sample exists, but the colour or repertoire context is not clean enough for a firm verdict."

    return {
        "confidence": label,
        "confidence_label": label,
        "confidenceLabel": label,
        "confidence_level": tier,
        "confidenceLevel": tier,
        "confidence_reason": reason,
        "confidenceReason": reason,
        "sample_percentage": sample_pct,
        "samplePercentage": sample_pct,
    }


def confidence_numeric_score(confidence_level: str) -> int:
    level = str(confidence_level or "").lower()
    if "high" in level:
        return 100
    if "medium" in level:
        return 72
    if "low" in level:
        return 42
    return 12


def balanced_opening_fit_score(opening: Dict[str, Any]) -> Dict[str, Any]:
    games = int(opening.get("games", 0) or 0)
    wins = int(opening.get("wins", 0) or 0)
    draws = int(opening.get("draws", 0) or 0)
    losses = int(opening.get("losses", 0) or 0)
    timing = loss_timing_fields(opening)
    weighted_opening_losses = float(timing.get("weighted_opening_losses", 0) or 0)
    confidence_score = confidence_numeric_score(opening.get("confidence_level") or opening.get("confidence"))
    raw_result_score = round(((wins + 0.5 * draws) / games) * 100) if games else 0
    opening_adjusted_score = round(
        ((wins + 0.5 * draws + max(0, losses - weighted_opening_losses) * 0.35) / games) * 100
    ) if games else 0
    result_score = min(100, max(raw_result_score, opening_adjusted_score))
    context = str(opening.get("context") or opening.get("repertoireContext") or "")
    move_order_score = int(opening.get("moveOrderScore", opening.get("move_order_score", 0)) or 0)
    plan_clarity_score = int(opening.get("planClarityScore", opening.get("plan_clarity_score", 0)) or 0)
    if is_clean_repertoire_context(opening):
        if move_order_score or plan_clarity_score:
            style_score = round(42 + move_order_score * 0.25 + plan_clarity_score * 0.45)
        else:
            style_score = 68
    else:
        style_score = 35
    stability_penalty = abs(wins - weighted_opening_losses) * 7
    stability_score = max(20, 100 - min(80, stability_penalty)) if games >= 5 else 25
    recent_score = result_score

    fit_score = round(
        confidence_score * 0.25
        + result_score * 0.25
        + style_score * 0.25
        + stability_score * 0.15
        + recent_score * 0.10
    )

    if games < 5:
        fit_score = min(fit_score, 42)

    return {
        "fitScore": max(0, min(100, fit_score)),
        "fit_score": max(0, min(100, fit_score)),
        "openingAdjustedScore": result_score,
        "opening_adjusted_score": result_score,
        "rawResultScore": raw_result_score,
        "raw_result_score": raw_result_score,
        "fitScoreBreakdown": {
            "sampleConfidence": confidence_score,
            "resultScore": result_score,
            "rawResultScore": raw_result_score,
            "styleMatch": style_score,
            "moveOrderConsistency": move_order_score,
            "planClarity": plan_clarity_score,
            "stability": stability_score,
            "recentForm": recent_score,
            "context": context,
            "lossTiming": timing.get("loss_timing"),
        },
        "fit_score_breakdown": {
            "sample_confidence": confidence_score,
            "result_score": result_score,
            "raw_result_score": raw_result_score,
            "style_match": style_score,
            "move_order_consistency": move_order_score,
            "plan_clarity": plan_clarity_score,
            "stability": stability_score,
            "recent_form": recent_score,
            "context": context,
            "loss_timing": timing.get("loss_timing"),
        },
    }


def opening_evidence_bullets(opening: Dict[str, Any]) -> List[str]:
    games = int(opening.get("games", 0) or 0)
    score = opening.get("winRate", opening.get("win_rate"))
    confidence = str(opening.get("confidence") or "Too little data")
    context = str(opening.get("contextLabel") or context_label(str(opening.get("context") or "")))
    bullets = [
        f"You played this opening {games} time{'' if games == 1 else 's'}.",
        f"Colour context: {context}.",
    ]

    if score is not None:
        bullets.append(f"You scored {round(float(score), 1)}%.")

    timing_note = opening.get("lossTimingNote") or opening.get("loss_timing_note")
    if timing_note:
        bullets.append(str(timing_note))

    move_order_note = opening.get("moveOrderNote") or opening.get("move_order_note")
    if move_order_note and "no clear move order" not in str(move_order_note).lower():
        bullets.append(str(move_order_note))

    plan_clarity_note = opening.get("planClarityNote") or opening.get("plan_clarity_note")
    if plan_clarity_note:
        bullets.append(str(plan_clarity_note))

    practical_note = opening.get("practicalDifficultyNote") or opening.get("practical_difficulty_note")
    if practical_note:
        bullets.append(str(practical_note))

    if "too little" in confidence.lower():
        bullets.append("There is not enough data yet to judge this strongly.")
    elif "low" in confidence.lower():
        bullets.append("The sample is still early, so treat this as a trend to watch.")
    elif "high" in confidence.lower():
        bullets.append("The sample is repeated enough to treat as a reliable pattern.")

    return bullets[:5]


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
    rating: Optional[int] = None,
) -> Dict[str, Any]:
    total_opening_games = sum(int(stats.get("games", 0) or 0) for stats in opening_results.values())
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
        item = opening_item(display_name, games, context, stats, total_games=total_opening_games)
        item = apply_opening_risk_profile(item, rating)

        if is_unknown_opening_name(display_name):
            adjusted = {
                **item,
                "context": "unknown_mixed",
                "contextLabel": context_label("unknown_mixed"),
                "repertoireContext": "unknown_mixed",
                "colour": "mixed",
                "color": "mixed",
                "recommendationCopy": SAFE_CONTEXT_FALLBACK_COPY,
            }
            adjusted.update(opening_confidence_fields(adjusted, total_opening_games))
            adjusted = apply_opening_risk_profile(adjusted, rating)
            sections["too_little_data"].append(
                adjusted
            )
            continue

        if games <= 2:
            sections["too_little_data"].append(item)
            continue

        if context == "unknown_mixed" or not context_is_compatible(display_name, context):
            adjusted = {
                **item,
                "context": "unknown_mixed",
                "contextLabel": context_label("unknown_mixed"),
                "repertoireContext": "unknown_mixed",
                "colour": "mixed",
                "color": "mixed",
                "recommendationCopy": SAFE_CONTEXT_FALLBACK_COPY,
            }
            adjusted.update(opening_confidence_fields(adjusted, total_opening_games))
            adjusted = apply_opening_risk_profile(adjusted, rating)
            sections["too_little_data"].append(
                adjusted
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
                item.get("fitScore", 0),
                item.get("moveOrderScore", item.get("move_order_score", 0)),
                item.get("win_rate") if item.get("win_rate") is not None else -1,
            ),
            reverse=True,
        )[:max_items]

    sections = {key: rank(value) for key, value in sections.items()}
    sections = sanitise_recommendation_sections(sections)
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
    total_opening_games = sum(int(stats.get("games", 0) or 0) for stats in opening_results.values())

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

        context = dominant_opening_context(stats)

        item = {
                "name": display_name,
                "games": games,
                "wins": wins,
                "draws": draws,
                "losses": losses,
                "opening_losses": int(stats.get("opening_losses", 0) or 0),
                "middlegame_losses": int(stats.get("middlegame_losses", 0) or 0),
                "late_losses": int(stats.get("late_losses", 0) or 0),
                "unknown_losses": int(stats.get("unknown_losses", 0) or 0),
                "move_orders_4": dict(stats.get("move_orders_4", {}) or {}),
                "move_orders_6": dict(stats.get("move_orders_6", {}) or {}),
                "move_orders_8": dict(stats.get("move_orders_8", {}) or {}),
                "move_orders_10": dict(stats.get("move_orders_10", {}) or {}),
                "plan_structures_6": dict(stats.get("plan_structures_6", {}) or {}),
                "plan_structures_8": dict(stats.get("plan_structures_8", {}) or {}),
                "plan_structures_10": dict(stats.get("plan_structures_10", {}) or {}),
                "win_rate": win_rate,
                "winRate": win_rate,
                "score": score,
                "colour": dominant_opening_colour(stats),
                "color": dominant_opening_colour(stats),
                "context": context,
                "contextLabel": context_label(context),
                "repertoireContext": context,
            }
        item.update(loss_timing_fields(item))
        item.update(move_order_consistency_fields(item))
        item.update(plan_clarity_fields(item))
        item.update(opening_confidence_fields(item, total_opening_games))
        item.update(balanced_opening_fit_score(item))
        adjusted_score = float(item.get("openingAdjustedScore", win_rate) or 0)
        opening_losses = int(item.get("openingLosses", 0) or 0)
        has_fixable_issue = (
            str(item.get("moveOrderStatus") or "").lower() == "unstable"
            or str(item.get("planClarityStatus") or "").lower() == "unclear plan"
            or opening_losses >= 2
            or int(item.get("middlegameLosses", 0) or 0) >= 2
        )
        if games < 5:
            verdict = "Experiment"
        elif adjusted_score >= 55 and not has_fixable_issue:
            verdict = "Keep"
        elif adjusted_score >= 40 or (has_fixable_issue and adjusted_score >= 35) or (losses and opening_losses < max(2, math.ceil(losses * 0.5))):
            verdict = "Fix"
        else:
            verdict = "Replace"
        item["verdict"] = verdict
        item["fitVerdict"] = verdict
        item["fit_verdict"] = verdict
        item["recommendationCategory"] = verdict
        item["recommendation_category"] = verdict
        item = apply_opening_risk_profile(item)
        item["evidence"] = opening_evidence_bullets(item)
        item["evidenceBullets"] = item["evidence"]
        scored.append(item)

    scored.sort(key=lambda x: (x["games"] >= 5, x.get("fitScore", 0), x["score"], x["games"]), reverse=True)
    return scored


def line_key_from_pgn(pgn: str, plies: int = 8) -> str:
    moves = clean_moves_from_pgn(pgn)
    return " ".join(move.rstrip("+#?!") for move in moves[:plies])


def load_engine_cache() -> Dict[str, Any]:
    if not ENGINE_CACHE_FILE.exists():
        return {}
    try:
        data = json.loads(ENGINE_CACHE_FILE.read_text())
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_engine_cache(cache: Dict[str, Any]) -> None:
    try:
        ENGINE_CACHE_FILE.write_text(json.dumps(cache, indent=2))
    except Exception:
        pass


def stockfish_path() -> Optional[str]:
    configured = os.getenv("OPENINGFIT_STOCKFISH_PATH", "").strip()
    if configured and Path(configured).exists():
        return configured
    return shutil.which("stockfish") or shutil.which("/usr/games/stockfish")


def stockfish_validation_enabled() -> bool:
    flag = os.getenv("OPENINGFIT_ENABLE_STOCKFISH", "1").strip().lower()
    return flag not in {"0", "false", "no", "off"}


def moves_to_board_at_ply(moves: List[str], ply: int) -> Optional[chess.Board]:
    board = chess.Board()
    for move in moves[:ply]:
        try:
            board.push_san(clean_san_move(move))
        except Exception:
            return None
    return board


def engine_score_cp(info: Dict[str, Any], colour: chess.Color) -> Optional[int]:
    score = info.get("score") if isinstance(info, dict) else None
    if not score:
        return None
    try:
        return score.pov(colour).score(mate_score=10000)
    except Exception:
        return None


def engine_verdict(cp: Optional[int]) -> str:
    if cp is None:
        return "unknown"
    if cp <= -250:
        return "opening position losing/serious issue"
    if cp <= -90:
        return "opening position slightly worse"
    return "opening position acceptable"


def line_user_colour(context: str) -> chess.Color:
    return chess.WHITE if context == "played_as_white" else chess.BLACK


def validate_problem_lines_with_stockfish(problem_lines: List[Dict[str, Any]], max_lines: int = 2) -> Dict[str, Any]:
    if not problem_lines:
        return {
            "enabled": False,
            "available": False,
            "status": "no_problem_lines",
            "summary": "No repeated problem lines needed engine validation.",
            "items": [],
        }
    if not stockfish_validation_enabled():
        return {
            "enabled": False,
            "available": False,
            "status": "disabled",
            "summary": "Stockfish validation is optional and currently disabled.",
            "items": [],
        }

    path = stockfish_path()
    if not path:
        return {
            "enabled": True,
            "available": False,
            "status": "engine_unavailable",
            "summary": "Stockfish validation was skipped because no engine binary was found.",
            "items": [],
        }

    cache = load_engine_cache()
    items = []
    changed = False
    engine = None

    try:
        engine = chess.engine.SimpleEngine.popen_uci(path)
        for line in problem_lines[:max_lines]:
            moves = line.get("sampleMoves") or line.get("sample_moves") or []
            if not moves:
                moves = clean_moves_from_pgn(str(line.get("samplePgn") or line.get("sample_pgn") or ""))
            if not moves:
                continue
            checkpoints = [ply for ply in [8, 12, 16] if len(moves) >= ply]
            if not checkpoints:
                continue

            cache_key = hashlib.sha256(
                json.dumps({"moves": moves[:16], "checkpoints": checkpoints, "context": line.get("context")}, sort_keys=True).encode()
            ).hexdigest()
            if cache_key in cache:
                items.append(cache[cache_key])
                continue

            colour = line_user_colour(str(line.get("context") or ""))
            evaluations = []
            previous_cp = None
            first_drop = None
            for ply in checkpoints:
                board = moves_to_board_at_ply(moves, ply)
                if not board:
                    continue
                info = engine.analyse(board, chess.engine.Limit(time=0.04))
                cp = engine_score_cp(info, colour)
                evaluation = {
                    "ply": ply,
                    "moveNumber": math.ceil(ply / 2),
                    "fen": board.fen(),
                    "cp": cp,
                    "verdict": engine_verdict(cp),
                }
                evaluations.append(evaluation)
                if previous_cp is not None and cp is not None and cp <= previous_cp - 120 and first_drop is None:
                    first_drop = {
                        "fromPly": evaluations[-2]["ply"],
                        "toPly": ply,
                        "dropCp": previous_cp - cp,
                        "copy": f"First major evaluation drop appears around move {math.ceil(ply / 2)}.",
                    }
                if cp is not None:
                    previous_cp = cp

            if not evaluations:
                continue
            worst = min((item for item in evaluations if item.get("cp") is not None), key=lambda item: item["cp"], default=evaluations[-1])
            result = {
                "opening": line.get("opening") or line.get("name"),
                "line": line.get("line"),
                "context": line.get("context"),
                "contextLabel": line.get("contextLabel") or context_label(str(line.get("context") or "")),
                "status": worst.get("verdict", "unknown"),
                "evaluations": evaluations,
                "firstMajorDrop": first_drop,
                "first_major_drop": first_drop,
                "cached": False,
                "summary": f"{line.get('opening') or 'This line'}: Stockfish says the sampled opening position is {worst.get('verdict', 'unknown')}.",
            }
            cache[cache_key] = {**result, "cached": True}
            changed = True
            items.append(result)
    except Exception as exc:
        return {
            "enabled": True,
            "available": False,
            "status": "engine_error",
            "summary": f"Stockfish validation was skipped after an engine error: {exc}",
            "items": items,
        }
    finally:
        if engine:
            try:
                engine.quit()
            except Exception:
                pass
        if changed:
            save_engine_cache(cache)

    return {
        "enabled": True,
        "available": True,
        "status": "completed" if items else "no_usable_samples",
        "summary": "Stockfish checked only repeated problem-line samples at moves 8, 12, and 16.",
        "items": items,
    }


def build_problem_lines(games: List[Dict[str, Any]], min_games: int = 3) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}

    for game in games or []:
        opening = str(game.get("opening") or game.get("name") or "").strip()
        line = line_key_from_pgn(str(game.get("pgn") or ""))
        if not opening or not line:
            continue

        context = str(game.get("context") or game.get("repertoireContext") or "unknown_mixed")
        key = f"{opening}::{context}::{line}"
        row = grouped.setdefault(
            key,
            {
                "opening": opening,
                "name": opening,
                "context": context,
                "contextLabel": context_label(context),
                "line": line,
                "games": 0,
                "wins": 0,
                "draws": 0,
                "losses": 0,
                "samplePgn": str(game.get("pgn") or ""),
                "sample_pgn": str(game.get("pgn") or ""),
                "sampleMoves": clean_moves_from_pgn(str(game.get("pgn") or ""))[:20],
                "sample_moves": clean_moves_from_pgn(str(game.get("pgn") or ""))[:20],
            },
        )
        row["games"] += 1
        result = str(game.get("result") or "").lower()
        if result == "win":
            row["wins"] += 1
        elif result == "draw":
            row["draws"] += 1
        elif result == "loss":
            row["losses"] += 1

    problem_lines = []
    for row in grouped.values():
        games_count = int(row["games"])
        if games_count < min_games:
            continue
        score = round(((row["wins"] + 0.5 * row["draws"]) / games_count) * 100, 1)
        loss_rate = round((row["losses"] / games_count) * 100, 1)
        if row["losses"] < 2 or loss_rate < 45:
            continue
        row["score"] = score
        row["scorePct"] = score
        row["lossRate"] = loss_rate
        row["summary"] = (
            f"{row['opening']}: results drop in the line {row['line']} "
            f"({games_count} games, {loss_rate}% losses)."
        )
        row["evidence"] = [
            f"You reached this early sequence {games_count} times.",
            f"You lost {row['losses']} of those games.",
            f"Your score in this line was {score}%.",
        ]
        problem_lines.append(row)

    problem_lines.sort(key=lambda item: (item["lossRate"], item["losses"], item["games"]), reverse=True)
    return problem_lines[:6]


def clean_san_move(move: str) -> str:
    cleaned = str(move or "").strip()
    cleaned = re.sub(r"^[0-9]+\.(\.\.)?", "", cleaned)
    cleaned = cleaned.replace("+", "").replace("#", "")
    cleaned = cleaned.replace("!", "").replace("?", "")
    return cleaned.strip()


def own_opening_moves(game: Dict[str, Any], plies: int = 20) -> List[Dict[str, Any]]:
    moves = game.get("moves")
    if isinstance(moves, list) and moves:
        all_moves = [clean_san_move(move) for move in moves]
    else:
        all_moves = [clean_san_move(move) for move in clean_moves_from_pgn(str(game.get("pgn") or ""))]

    colour = str(game.get("colour") or game.get("color") or "").lower()
    if colour not in {"white", "black"}:
        return []

    own_parity = 0 if colour == "white" else 1
    own_moves = []
    for index, move in enumerate(all_moves[:plies]):
        if index % 2 != own_parity or not move:
            continue
        own_moves.append(
            {
                "san": move,
                "ply": index + 1,
                "moveNumber": (index // 2) + 1,
            }
        )
    return own_moves


def is_castle_move(move: str) -> bool:
    return move in {"O-O", "O-O-O", "0-0", "0-0-0"}


def is_pawn_move(move: str) -> bool:
    return bool(move) and move[0].islower()


def is_flank_pawn_move(move: str) -> bool:
    return bool(re.match(r"^[abgh](?:x[a-h])?[1-8]", move))


def opening_phase_issues_for_game(game: Dict[str, Any]) -> List[Dict[str, str]]:
    own_moves = own_opening_moves(game)
    if not own_moves:
        return []

    castled_move = next((move for move in own_moves if is_castle_move(move["san"])), None)
    queen_moves = [move for move in own_moves if move["san"].startswith("Q")]
    minor_moves_by_move_8 = [
        move for move in own_moves
        if move["moveNumber"] <= 8 and move["san"][:1] in {"N", "B"}
    ]
    minor_moves_by_move_10 = [
        move for move in own_moves
        if move["moveNumber"] <= 10 and move["san"][:1] in {"N", "B"}
    ]
    pawn_moves_by_move_8 = [
        move for move in own_moves
        if move["moveNumber"] <= 8 and is_pawn_move(move["san"])
    ]
    early_flank_pawns = [
        move for move in pawn_moves_by_move_8
        if is_flank_pawn_move(move["san"]) and len(minor_moves_by_move_8) < 2
    ]
    king_moves = [
        move for move in own_moves
        if move["san"].startswith("K") and not is_castle_move(move["san"])
    ]
    early_rook_moves = [
        move for move in own_moves
        if move["moveNumber"] <= 8 and move["san"].startswith("R")
    ]

    piece_counts: Dict[str, int] = defaultdict(int)
    repeated_piece_symbol = ""
    for move in own_moves:
        symbol = move["san"][:1]
        if symbol in {"Q", "R", "B", "N"}:
            piece_counts[symbol] += 1
            if piece_counts[symbol] >= 3 and not repeated_piece_symbol:
                repeated_piece_symbol = symbol

    issues = []

    def add_issue(issue: str, label: str, advice: str) -> None:
        issues.append({"issue": issue, "label": label, "advice": advice})

    if not castled_move:
        add_issue(
            "castled_late_or_never",
            "Castling was delayed or missing",
            "Castle earlier when the centre can open, especially before launching extra pawn moves.",
        )
    elif castled_move["moveNumber"] > 8:
        add_issue(
            "castled_late_or_never",
            "Castling often happens late",
            "Try to finish kingside development and castle before move 8 in this opening.",
        )

    if queen_moves and queen_moves[0]["moveNumber"] <= 5:
        add_issue(
            "queen_moved_too_early",
            "Queen moved too early",
            "Develop minor pieces first unless the queen move wins something concrete.",
        )
    if len(queen_moves) >= 2 and queen_moves[1]["moveNumber"] <= 8:
        add_issue(
            "queen_moved_multiple_times",
            "Queen moved multiple times before move 8",
            "Avoid spending several opening tempi on the queen while pieces are still undeveloped.",
        )

    if repeated_piece_symbol:
        piece_name = {"Q": "queen", "R": "rook", "B": "bishop", "N": "knight"}.get(repeated_piece_symbol, "piece")
        add_issue(
            "same_piece_repeated",
            "Same piece moved repeatedly",
            f"The {piece_name} moved several times early; use those tempi to bring new pieces out.",
        )

    if len(minor_moves_by_move_10) < 2:
        add_issue(
            "minor_pieces_undeveloped",
            "Minor pieces still undeveloped by move 10",
            "Aim to develop at least two knights or bishops before starting side plans.",
        )

    if early_flank_pawns:
        add_issue(
            "early_flank_pawn_pushes",
            "Flank pawns moved before development",
            "Save wing pawn moves until your centre, minor pieces, and king safety are under control.",
        )

    if king_moves:
        add_issue(
            "lost_castling_rights_early",
            "Castling rights were lost early",
            "Avoid early king moves unless forced; they leave the king in the centre and cost time.",
        )

    if king_moves or not castled_move:
        add_issue(
            "king_stuck_in_centre",
            "King stayed in the centre",
            "Make king safety part of the opening plan, not something to fix after tactics start.",
        )

    if early_rook_moves:
        add_issue(
            "lost_castling_rights_early",
            "A rook moved before development",
            "Early rook moves can spoil castling plans; develop pieces first unless there is a clear tactic.",
        )

    if len(pawn_moves_by_move_8) >= 5 and len(minor_moves_by_move_8) < 2:
        add_issue(
            "too_many_pawn_moves",
            "Too many pawn moves before development",
            "Use fewer pawn moves in the first 8 moves and bring pieces toward the centre.",
        )

    unique: Dict[str, Dict[str, str]] = {}
    for issue in issues:
        unique.setdefault(issue["issue"], issue)
    return list(unique.values())


def build_opening_phase_habits(games: List[Dict[str, Any]], min_games: int = 2) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}

    for game in games or []:
        opening = str(game.get("opening") or game.get("name") or "").strip()
        if not opening or is_unknown_opening_name(opening):
            continue
        context = str(game.get("context") or game.get("repertoireContext") or "unknown_mixed")
        result = str(game.get("result") or "").lower()
        issues = opening_phase_issues_for_game(game)
        if not issues:
            continue

        for issue in issues:
            key = f"{opening}::{context}::{issue['issue']}"
            row = grouped.setdefault(
                key,
                {
                    "opening": opening,
                    "name": opening,
                    "context": context,
                    "contextLabel": context_label(context),
                    "issue": issue["issue"],
                    "label": issue["label"],
                    "advice": issue["advice"],
                    "games": 0,
                    "wins": 0,
                    "draws": 0,
                    "losses": 0,
                },
            )
            row["games"] += 1
            if result == "win":
                row["wins"] += 1
            elif result == "draw":
                row["draws"] += 1
            elif result == "loss":
                row["losses"] += 1

    habits = []
    for row in grouped.values():
        games_count = int(row["games"])
        if games_count < min_games:
            continue
        score = round(((row["wins"] + 0.5 * row["draws"]) / games_count) * 100, 1)
        loss_rate = round((row["losses"] / games_count) * 100, 1)
        row["score"] = score
        row["scorePct"] = score
        row["lossRate"] = loss_rate
        row["summary"] = f"{row['opening']}: {row['label'].lower()} appeared in {games_count} games."
        if row["issue"] == "queen_moved_multiple_times":
            row["summary"] = f"{row['opening']}: your results can suffer when the queen moves multiple times before move 8."
        elif row["issue"] == "castled_late_or_never":
            row["summary"] = f"{row['opening']}: your kingside castling is often delayed or missing."
        elif row["issue"] == "minor_pieces_undeveloped":
            row["summary"] = f"{row['opening']}: minor pieces are often still undeveloped around move 8 to 10."
        elif row["issue"] == "too_many_pawn_moves":
            row["summary"] = f"{row['opening']}: too many early pawn moves are slowing development."
        row["evidence"] = [
            f"Detected in {games_count} {row['opening']} game{'' if games_count == 1 else 's'}.",
            f"Score in those games: {score}%.",
            row["advice"],
        ]
        habits.append(row)

    habits.sort(key=lambda item: (item["games"], item["lossRate"], 100 - item["score"]), reverse=True)
    return habits[:8]


WHITE_RESPONSE_AREAS = [
    ("e5", "vs ...e5", "1.e4 e5"),
    ("c5", "vs ...c5", "Sicilian Defence"),
    ("e6", "vs ...e6", "French Defence"),
    ("c6", "vs ...c6", "Caro-Kann"),
    ("d5", "vs ...d5", "Scandinavian / direct ...d5"),
    ("other", "other", "other first replies"),
]


BLACK_RESPONSE_AREAS = [
    ("e4", "vs 1.e4", "1.e4"),
    ("d4", "vs 1.d4", "1.d4"),
    ("c4", "vs 1.c4", "1.c4"),
    ("Nf3", "vs 1.Nf3", "1.Nf3"),
    ("other", "other", "other first moves"),
]


def game_moves(game: Dict[str, Any]) -> List[str]:
    moves = game.get("moves")
    if isinstance(moves, list) and moves:
        return [clean_san_move(move) for move in moves if clean_san_move(move)]
    return [clean_san_move(move) for move in clean_moves_from_pgn(str(game.get("pgn") or ""))]


def white_response_key(moves: List[str]) -> str:
    if len(moves) < 2:
        return "other"
    response = clean_san_move(moves[1])
    if response in {"e5", "c5", "e6", "c6", "d5"}:
        return response
    return "other"


def black_response_key(moves: List[str]) -> str:
    if not moves:
        return "other"
    first = clean_san_move(moves[0])
    if first in {"e4", "d4", "c4", "Nf3"}:
        return first
    return "other"


def response_status(games_count: int, score: Optional[float]) -> str:
    if games_count <= 0:
        return "No data"
    if games_count < 3:
        return "Too little data"
    if score is not None and score >= 55:
        return "Strong"
    if score is not None and score >= 40:
        return "Needs work"
    return "Weak"


def response_row(key: str, label: str, name: str, stats: Dict[str, int]) -> Dict[str, Any]:
    games_count = int(stats.get("games", 0) or 0)
    wins = int(stats.get("wins", 0) or 0)
    draws = int(stats.get("draws", 0) or 0)
    losses = int(stats.get("losses", 0) or 0)
    score = round(((wins + 0.5 * draws) / games_count) * 100, 1) if games_count else None
    status = response_status(games_count, score)
    evidence = [f"{games_count} game{'' if games_count == 1 else 's'} in this area."]
    if score is not None:
        evidence.append(f"Score: {score}%.")
    else:
        evidence.append("No imported games reached this area.")
    return {
        "key": key,
        "label": label,
        "name": name,
        "games": games_count,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "score": score,
        "scorePct": score,
        "status": status,
        "evidence": evidence,
    }


def strongest_response(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    candidates = [
        row for row in rows
        if int(row.get("games", 0) or 0) >= 3
        and row.get("score") is not None
        and row.get("score", 0) >= 40
    ]
    if not candidates:
        return None
    return sorted(candidates, key=lambda row: (row["score"], row["games"]), reverse=True)[0]


def weakest_response(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    candidates = [row for row in rows if int(row.get("games", 0) or 0) >= 3 and row.get("score") is not None]
    if not candidates:
        return None
    return sorted(candidates, key=lambda row: (row["score"], -row["games"]))[0]


def response_priority(side: str, rows: List[Dict[str, Any]]) -> str:
    weak = weakest_response(rows)
    no_data = [row for row in rows if int(row.get("games", 0) or 0) == 0 and row["key"] != "other"]
    too_little = [
        row for row in rows
        if 0 < int(row.get("games", 0) or 0) < 3 and row["key"] != "other"
    ]

    if weak and weak.get("score", 100) < 40:
        if side == "white":
            return f"As White, your biggest gap is {weak['label']} ({weak['score']}% score). Study one stable plan for {weak['name']}."
        return f"As Black, your biggest gap is {weak['label']} ({weak['score']}% score). Choose one stable system there."

    if too_little:
        area = too_little[0]
        if side == "white":
            return f"As White, you have too few stable games after {area['name']} to judge it properly yet."
        return f"As Black, you have too few stable games {area['label']} to judge that system properly yet."

    if no_data:
        area = no_data[0]
        if side == "white":
            return f"As White, there is no imported sample against {area['name']} yet."
        return f"As Black, you have no stable system shown {area['label']} yet."

    strong = strongest_response(rows)
    if strong:
        if side == "white":
            return f"As White, keep your current plan {strong['label']}, then review the next lowest-scoring response area."
        return f"As Black, keep your current answer {strong['label']}, then review the next lowest-scoring first move."

    return "No response-area priority yet because the imported sample is too small."


def build_opponent_response_report(games: List[Dict[str, Any]]) -> Dict[str, Any]:
    white_stats = {key: {"games": 0, "wins": 0, "draws": 0, "losses": 0} for key, _label, _name in WHITE_RESPONSE_AREAS}
    black_stats = {key: {"games": 0, "wins": 0, "draws": 0, "losses": 0} for key, _label, _name in BLACK_RESPONSE_AREAS}

    for game in games or []:
        colour = str(game.get("colour") or game.get("color") or "").lower()
        moves = game_moves(game)
        result = str(game.get("result") or "").lower()
        if colour == "white":
            bucket = white_response_key(moves)
            stats = white_stats[bucket]
        elif colour == "black":
            bucket = black_response_key(moves)
            stats = black_stats[bucket]
        else:
            continue
        stats["games"] += 1
        if result == "win":
            stats["wins"] += 1
        elif result == "draw":
            stats["draws"] += 1
        elif result == "loss":
            stats["losses"] += 1

    white_rows = [
        response_row(key, label, name, white_stats[key])
        for key, label, name in WHITE_RESPONSE_AREAS
    ]
    black_rows = [
        response_row(key, label, name, black_stats[key])
        for key, label, name in BLACK_RESPONSE_AREAS
    ]

    white_strongest = strongest_response(white_rows)
    white_weakest = weakest_response(white_rows)
    black_strongest = strongest_response(black_rows)
    black_weakest = weakest_response(black_rows)

    return {
        "white": {
            "title": "White response areas",
            "rows": white_rows,
            "strongest": white_strongest,
            "weakest": white_weakest,
            "noDataAreas": [row for row in white_rows if row["games"] == 0 and row["key"] != "other"],
            "studyPriority": response_priority("white", white_rows),
        },
        "black": {
            "title": "Black response areas",
            "rows": black_rows,
            "strongest": black_strongest,
            "weakest": black_weakest,
            "noDataAreas": [row for row in black_rows if row["games"] == 0 and row["key"] != "other"],
            "studyPriority": response_priority("black", black_rows),
        },
    }


STYLE_OPENING_FAMILIES = {
    "Tactical Attacker": {
        "white": ["Vienna Game", "Scotch Game", "Italian Game", "King's Gambit"],
        "black_vs_e4": ["Scandinavian Defence", "Sicilian Defence", "e5 systems"],
        "black_vs_d4": ["Dutch Defence", "King's Indian as future option"],
    },
    "Solid Builder": {
        "white": ["London System", "Queen's Gambit", "Colle System"],
        "black_vs_e4": ["Caro-Kann Defence", "French Defence"],
        "black_vs_d4": ["Queen's Gambit Declined", "Slav Defence"],
    },
    "System Player": {
        "white": ["London System", "Colle System", "King's Indian Attack", "Stonewall structures"],
        "black_vs_e4": ["Caro-Kann Defence", "e5 systems"],
        "black_vs_d4": ["Queen's Gambit Declined setup", "Slav Defence"],
    },
    "Positional Grinder": {
        "white": ["Queen's Gambit", "English Opening", "Catalan-style setups"],
        "black_vs_e4": ["Caro-Kann Defence", "French Defence"],
        "black_vs_d4": ["Queen's Gambit Declined", "Slav Defence"],
    },
    "Chaos Handler": {
        "white": ["Scotch Game", "Vienna Game", "Jobava London"],
        "black_vs_e4": ["Sicilian Defence", "Scandinavian Defence"],
        "black_vs_d4": ["Dutch Defence", "King's Indian as future option"],
    },
    "Balanced Improver": {
        "white": ["Italian Game", "Queen's Gambit", "London System"],
        "black_vs_e4": ["Caro-Kann Defence", "e5 systems"],
        "black_vs_d4": ["Queen's Gambit Declined setup", "Slav Defence"],
    },
}


def normalise_opening_key(name: str) -> str:
    return str(name or "").strip().lower().replace("’", "'")


def infer_style_opening_match(games: List[Dict[str, Any]], best_openings: List[Dict[str, Any]], rating: Optional[int] = None) -> Dict[str, Any]:
    total = len(games or [])
    signals = {
        "open_games": 0,
        "closed_games": 0,
        "short_games": 0,
        "long_games": 0,
        "early_queen": 0,
        "early_attack": 0,
        "pawn_storms": 0,
        "castled_kingside": 0,
        "castled_queenside": 0,
        "system_openings": 0,
        "chaos_openings": 0,
        "solid_openings": 0,
        "positional_openings": 0,
    }
    structure_results: Dict[str, Dict[str, int]] = defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0})

    for game in games or []:
        moves = game_moves(game)
        own_moves = own_opening_moves(game)
        opening = str(game.get("opening") or "").lower()
        result = str(game.get("result") or "").lower()
        move_count = int(game.get("moveCount") or game.get("move_count") or move_count_from_moves(moves))
        first = moves[0] if moves else ""
        second = moves[1] if len(moves) > 1 else ""
        structure = "open" if first == "e4" and second in {"e5", "c5"} else "closed"

        if structure == "open":
            signals["open_games"] += 1
        else:
            signals["closed_games"] += 1
        if move_count and move_count <= 25:
            signals["short_games"] += 1
        if move_count >= 45:
            signals["long_games"] += 1

        own_sans = [move["san"] for move in own_moves]
        if any(move.startswith("Q") for move in own_sans[:5]):
            signals["early_queen"] += 1
        if any(move in {"f4", "g4", "h4", "b4", "a4"} for move in own_sans[:6]):
            signals["early_attack"] += 1
        if sum(1 for move in own_sans[:10] if is_flank_pawn_move(move)) >= 2:
            signals["pawn_storms"] += 1
        if any(is_castle_move(move) and move in {"O-O", "0-0"} for move in own_sans[:10]):
            signals["castled_kingside"] += 1
        if any(is_castle_move(move) and move in {"O-O-O", "0-0-0"} for move in own_sans[:10]):
            signals["castled_queenside"] += 1

        if any(token in opening for token in ["london", "colle", "stonewall"]):
            signals["system_openings"] += 1
        if any(token in opening for token in ["sicilian", "scandinavian", "gambit", "dutch", "king's indian"]):
            signals["chaos_openings"] += 1
        if any(token in opening for token in ["caro-kann", "french", "queen's gambit declined", "slav"]):
            signals["solid_openings"] += 1
        if any(token in opening for token in ["queen's gambit", "english", "catalan", "reti", "réti"]):
            signals["positional_openings"] += 1

        row = structure_results[structure]
        row["games"] += 1
        if result == "win":
            row["wins"] += 1
        elif result == "draw":
            row["draws"] += 1
        elif result == "loss":
            row["losses"] += 1

    tactical_score = signals["open_games"] + signals["early_attack"] * 2 + signals["early_queen"] + signals["short_games"] + signals["chaos_openings"]
    solid_score = signals["solid_openings"] * 2 + signals["castled_kingside"] + signals["long_games"]
    system_score = signals["system_openings"] * 3 + max(0, signals["closed_games"] - signals["open_games"])
    positional_score = signals["positional_openings"] * 2 + signals["closed_games"] + signals["long_games"]
    chaos_score = signals["chaos_openings"] * 2 + signals["pawn_storms"] * 2 + signals["early_queen"]

    style_scores = {
        "Tactical Attacker": tactical_score,
        "Solid Builder": solid_score,
        "System Player": system_score,
        "Positional Grinder": positional_score,
        "Chaos Handler": chaos_score,
        "Balanced Improver": max(1, total) + min(tactical_score, solid_score, positional_score),
    }
    style_label = max(style_scores.items(), key=lambda item: item[1])[0] if total else "Balanced Improver"
    if total < 8 or max(style_scores.values() or [0]) < max(4, total * 0.35):
        style_label = "Balanced Improver"

    existing = {normalise_opening_key(item.get("name", "")): item for item in best_openings or []}
    families = STYLE_OPENING_FAMILIES.get(style_label, STYLE_OPENING_FAMILIES["Balanced Improver"])
    evidence = [
        f"Analysed {total} game{'' if total == 1 else 's'} for style signals.",
        f"Open-game signals: {signals['open_games']}; closed/system signals: {signals['closed_games'] + signals['system_openings']}.",
        f"Early attacking signals: {signals['early_attack'] + signals['early_queen']}; pawn-storm signals: {signals['pawn_storms']}.",
    ]

    def item_for(name: str, slot: str) -> Dict[str, Any]:
        key = normalise_opening_key(name)
        played = existing.get(key)
        games_count = int(played.get("games", 0) or 0) if played else 0
        risk_profile = opening_risk_profile(name)
        difficulty_penalty = opening_difficulty_penalty(risk_profile, rating)
        confidence = "Medium confidence" if games_count >= 5 or total >= 20 else "Low confidence"
        recommendation_type = "style fit" if games_count >= 3 else "experiment"
        if rating and rating < 1100 and any(token in name.lower() for token in ["king's gambit", "sicilian", "dutch", "king's indian"]):
            confidence = "Low confidence"
            recommendation_type = "experiment"
        if difficulty_penalty >= 10 and games_count < 15:
            confidence = "Low confidence"
            recommendation_type = "experiment"
        explanation = (
            f"{name} is a {recommendation_type} for your {style_label} profile: "
            f"it matches the style signals in your games, but it is not being presented as a proven repertoire result."
        )
        if played and games_count >= 3:
            explanation = (
                f"{name} is a style fit for your {style_label} profile and you already have {games_count} game"
                f"{'' if games_count == 1 else 's'} of experience with it."
            )
        risk_note = opening_practical_note(name, risk_profile, rating, played or {"games": games_count})
        if difficulty_penalty >= 10:
            explanation = f"{risk_note} Treat it as an experiment until your sample supports it."
        return {
            "name": name,
            "slot": slot,
            "role": slot,
            "label": "Style fit" if recommendation_type == "style fit" else "Experiment",
            "verdict": "Experiment" if recommendation_type == "experiment" else "Fix",
            "recommendationCategory": "Experiment" if recommendation_type == "experiment" else "Fix",
            "recommendation_category": "Experiment" if recommendation_type == "experiment" else "Fix",
            "recommendationType": recommendation_type,
            "recommendation_type": recommendation_type,
            "confidence": confidence,
            "confidenceLabel": confidence,
            "confidence_label": confidence,
            "confidenceLevel": confidence.lower().split()[0],
            "confidence_level": confidence.lower().split()[0],
            "explanation": explanation,
            "whyItFits": explanation,
            "why_it_fits": explanation,
            "openingRiskProfile": risk_profile,
            "opening_risk_profile": risk_profile,
            "practicalDifficultyPenalty": difficulty_penalty,
            "practical_difficulty_penalty": difficulty_penalty,
            "practicalDifficultyNote": risk_note,
            "practical_difficulty_note": risk_note,
            "currentlyPlayed": bool(played),
            "currently_played": bool(played),
            "games": games_count,
            "evidence": (evidence[:2] + [risk_note])[:3],
            "corePlan": STARTER_OPENING_LIBRARY.get(name, {}).get("corePlan", opening_explanation(name).get("plan")),
            "starterMoveSequence": STARTER_OPENING_LIBRARY.get(name, {}).get("starterMoves", []),
        }

    sections = []
    for slot, title in [("white", "White style fits"), ("black_vs_e4", "Black style fits vs 1.e4"), ("black_vs_d4", "Black style fits vs 1.d4")]:
        sections.append(
            {
                "key": slot,
                "title": title,
                "items": [item_for(name, slot) for name in families.get(slot, [])[:4]],
            }
        )

    return {
        "styleLabel": style_label,
        "style_label": style_label,
        "styleScores": style_scores,
        "style_scores": style_scores,
        "signals": signals,
        "structureResults": dict(structure_results),
        "structure_results": dict(structure_results),
        "evidence": evidence,
        "sections": sections,
    }


def coverage_status(item: Optional[Dict[str, Any]]) -> str:
    if not item:
        return "No clear plan"
    games = int(item.get("games", 0) or 0)
    confidence = str(item.get("confidence") or "").lower()
    if games < 3 or "too little" in confidence:
        return "Too little data"
    if games >= 8 and str(item.get("verdict") or "").lower() in {"keep", "fix", "improve"}:
        return "Covered"
    return "Needs work"


def best_by_context(best_openings: List[Dict[str, Any]], context: str) -> Optional[Dict[str, Any]]:
    candidates = [
        item for item in best_openings
        if str(item.get("context") or item.get("repertoireContext") or "") == context
        and is_clean_repertoire_context(item)
    ]
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: (confidence_numeric_score(item.get("confidence")), item.get("games", 0), item.get("fitScore", 0)), reverse=True)[0]


def build_repertoire_coverage(best_openings: List[Dict[str, Any]]) -> Dict[str, Any]:
    white = best_by_context(best_openings, "played_as_white")
    black_e4 = best_by_context(best_openings, "black_vs_e4")
    black_d4 = best_by_context(best_openings, "black_vs_d4")
    black_other = best_by_context(best_openings, "black_vs_other") or best_by_context(best_openings, "black_vs_d4_other")

    def row(key: str, label: str, item: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "key": key,
            "label": label,
            "status": coverage_status(item),
            "opening": item.get("name") if item else "",
            "confidence": item.get("confidence") if item else "Too little data",
            "games": item.get("games", 0) if item else 0,
        }

    white_rows = [
        row("main_white", "Main White opening", white),
        row("vs_sicilian", "White vs Sicilian", None),
        row("vs_french", "White vs French", None),
        row("vs_caro_kann", "White vs Caro-Kann", None),
        row("vs_e5", "White vs 1...e5", white if white and any(token in str(white.get("name", "")).lower() for token in ["vienna", "italian", "ruy", "scotch"]) else None),
    ]
    black_rows = [
        row("black_vs_e4", "Black vs 1.e4", black_e4),
        row("black_vs_d4", "Black vs 1.d4", black_d4),
        row("black_vs_c4_nf3", "Black vs 1.c4 / 1.Nf3", black_other),
    ]

    missing = [item["label"] for item in white_rows + black_rows if item["status"] in {"No clear plan", "Too little data"}]
    return {
        "white": white_rows,
        "black": black_rows,
        "missing": missing,
        "summary": "Coverage is strongest where status is Covered; No clear plan marks the next repertoire gap.",
    }


def repertoire_lane_label(key: str) -> str:
    return {
        "white": "White repertoire",
        "black_vs_e4": "Black vs 1.e4",
        "black_vs_d4": "Black vs 1.d4",
    }.get(key, key)


def lane_coherence(key: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    total_games = sum(int(item.get("games", 0) or 0) for item in items)
    sorted_items = sorted(items, key=lambda item: int(item.get("games", 0) or 0), reverse=True)
    main_items = [item for item in sorted_items if int(item.get("games", 0) or 0) >= 3]
    low_sample_items = [item for item in sorted_items if 0 < int(item.get("games", 0) or 0) < 3]
    top_three = sorted_items[:3]
    top_one_games = int(sorted_items[0].get("games", 0) or 0) if sorted_items else 0
    top_three_games = sum(int(item.get("games", 0) or 0) for item in top_three)
    top_one_pct = round((top_one_games / total_games) * 100, 1) if total_games else 0
    top_three_pct = round((top_three_games / total_games) * 100, 1) if total_games else 0
    random_pct = round((sum(int(item.get("games", 0) or 0) for item in low_sample_items) / total_games) * 100, 1) if total_games else 0

    if total_games < 3:
        status = "Too random to train efficiently"
        score = 0
    else:
        score = round(max(0, min(100, top_three_pct - max(0, len(main_items) - 3) * 8 - random_pct * 0.7)))
        if top_one_pct >= 60 or (top_three_pct >= 85 and len(main_items) <= 3 and random_pct <= 12):
            status = "Simple and focused"
        elif top_three_pct >= 70 and len(main_items) <= 5 and random_pct <= 22:
            status = "Mostly focused"
        elif top_three_pct >= 50 and random_pct <= 35:
            status = "Fragmented"
        else:
            status = "Too random to train efficiently"

    names = [item.get("name", "Unknown") for item in top_three if int(item.get("games", 0) or 0) > 0]
    label = repertoire_lane_label(key)
    if status in {"Simple and focused", "Mostly focused"} and names:
        summary = f"{label} is focused: {top_three_pct}% of games use {', '.join(names)}."
    elif total_games:
        summary = f"{label} is fragmented: {random_pct}% of games are low-sample openings and the top three systems cover {top_three_pct}%."
    else:
        summary = f"{label} has no clear imported sample yet."

    advice = (
        f"Keep training around {names[0]} before adding new systems."
        if status in {"Simple and focused", "Mostly focused"} and names
        else f"Simplify {label.lower()} to one main system and one backup until the sample stabilises."
    )

    return {
        "key": key,
        "label": label,
        "status": status,
        "score": score,
        "totalGames": total_games,
        "total_games": total_games,
        "mainOpeningCount": len(main_items),
        "main_opening_count": len(main_items),
        "lowSampleOpeningCount": len(low_sample_items),
        "low_sample_opening_count": len(low_sample_items),
        "topOneCoverage": top_one_pct,
        "top_one_coverage": top_one_pct,
        "topThreeCoverage": top_three_pct,
        "top_three_coverage": top_three_pct,
        "randomOpeningShare": random_pct,
        "random_opening_share": random_pct,
        "topSystems": names,
        "top_systems": names,
        "summary": summary,
        "advice": advice,
    }


def build_repertoire_coherence(best_openings: List[Dict[str, Any]]) -> Dict[str, Any]:
    lanes = {
        "white": [],
        "black_vs_e4": [],
        "black_vs_d4": [],
    }

    for item in best_openings or []:
        context = str(item.get("context") or item.get("repertoireContext") or "")
        if context == "played_as_white":
            lanes["white"].append(item)
        elif context == "black_vs_e4":
            lanes["black_vs_e4"].append(item)
        elif context in {"black_vs_d4", "black_vs_other", "black_vs_d4_other"}:
            lanes["black_vs_d4"].append(item)

    lane_rows = [lane_coherence(key, value) for key, value in lanes.items()]
    active = [row for row in lane_rows if row["totalGames"] > 0]
    overall_score = round(sum(row["score"] for row in active) / len(active)) if active else 0

    if not active:
        status = "Too random to train efficiently"
    elif overall_score >= 82:
        status = "Simple and focused"
    elif overall_score >= 65:
        status = "Mostly focused"
    elif overall_score >= 45:
        status = "Fragmented"
    else:
        status = "Too random to train efficiently"

    messy = [row for row in lane_rows if row["status"] in {"Fragmented", "Too random to train efficiently"} and row["totalGames"] > 0]
    if messy:
        advice = f"Simplify {messy[0]['label']} first: {messy[0]['advice']}"
    elif active:
        advice = "Your repertoire is trainable. Keep adding games to the same core systems before expanding."
    else:
        advice = "Collect a few more games before judging repertoire coherence."

    return {
        "status": status,
        "score": overall_score,
        "lanes": lane_rows,
        "rows": lane_rows,
        "advice": advice,
        "summary": f"Repertoire coherence: {status} ({overall_score}/100).",
    }


def opening_family_key(name: str) -> str:
    lower = normalise_opening_key(name)
    families = {
        "vienna": "Vienna",
        "italian": "Italian",
        "scotch": "Scotch",
        "ruy": "Ruy Lopez",
        "london": "London",
        "queen": "Queen's Gambit",
        "caro": "Caro-Kann",
        "french": "French",
        "sicilian": "Sicilian",
        "scandinavian": "Scandinavian",
        "slav": "Slav",
        "dutch": "Dutch",
        "kings indian": "King's Indian",
        "king s indian": "King's Indian",
        "nimzo": "Nimzo-Indian",
        "gruenfeld": "Grunfeld",
        "grunfeld": "Grunfeld",
        "pirc": "Pirc",
        "modern": "Modern",
        "benoni": "Benoni",
        "alekhine": "Alekhine",
    }
    for token, label in families.items():
        if token in lower:
            return label
    first = str(name or "Unknown opening").split(":")[0].strip()
    return first or "Unknown opening"


def build_repertoire_maintenance_cost(
    best_openings: List[Dict[str, Any]],
    coverage: Dict[str, Any],
    rating: Optional[int] = None,
) -> Dict[str, Any]:
    repeated = [
        item for item in best_openings or []
        if is_clean_repertoire_context(item)
        and not is_unknown_opening_name(item.get("name", ""))
        and int(item.get("games", 0) or 0) > 0
    ]
    main_openings = [item for item in repeated if int(item.get("games", 0) or 0) >= 3]
    families = sorted({opening_family_key(str(item.get("name") or "")) for item in main_openings})
    band = rating_band(rating)
    uncovered = [
        row for row in (coverage or {}).get("white", []) + (coverage or {}).get("black", [])
        if row.get("status") in {"No clear plan", "Too little data", "Needs work"}
    ]

    high_theory = []
    sharp = []
    unstable = []
    clear_plan = []
    for item in main_openings:
        risk = item.get("openingRiskProfile") or item.get("opening_risk_profile") or opening_risk_profile(str(item.get("name") or ""))
        theory = str(risk.get("theoryLoad") or risk.get("theory_load") or "medium")
        tactical = str(risk.get("tacticalSharpness") or risk.get("tactical_sharpness") or "medium")
        if theory == "high":
            high_theory.append(item)
        if tactical == "high":
            sharp.append(item)
        if str(item.get("moveOrderStatus") or item.get("move_order_status") or "").lower() in {"unstable", "some variation"}:
            unstable.append(item)
        if str(item.get("planClarityStatus") or item.get("plan_clarity_status") or "") == "Clear plan":
            clear_plan.append(item)

    cost = 20
    cost += max(0, len(families) - 2) * 10
    cost += len(high_theory) * 12
    cost += len(sharp) * 7
    cost += len(unstable) * 8
    cost += len(uncovered) * 9
    if band in {"under_1000", "1000_1400"}:
        cost += len(high_theory) * 8 + max(0, len(families) - 3) * 6
    elif band == "1400_1800":
        cost += len(high_theory) * 3
    cost -= min(18, len(clear_plan) * 5)
    cost = max(0, min(100, round(cost)))

    if cost >= 68:
        category = "High maintenance"
    elif cost >= 38:
        category = "Medium maintenance"
    else:
        category = "Low maintenance"

    reasons = []
    if len(families) > 3:
        reasons.append(f"You use {len(families)} different opening families.")
    elif families:
        family_word = "family" if len(families) == 1 else "families"
        reasons.append(f"Your main repertoire uses {len(families)} opening {family_word}.")
    if high_theory:
        opening_word = "opening carries" if len(high_theory) == 1 else "openings carry"
        reasons.append(f"{len(high_theory)} main {opening_word} a high theory load.")
    if sharp:
        reasons.append(f"{len(sharp)} repeated opening{'' if len(sharp) == 1 else 's'} are tactically sharp.")
    if unstable:
        reasons.append(f"{len(unstable)} opening{'' if len(unstable) == 1 else 's'} show move-order instability.")
    if uncovered:
        reasons.append(f"{len(uncovered)} common response area{'' if len(uncovered) == 1 else 's'} are not fully covered.")
    if clear_plan:
        reasons.append(f"{len(clear_plan)} opening{'' if len(clear_plan) == 1 else 's'} have clear repeatable plans.")

    if category == "High maintenance":
        summary = "Your repertoire is high maintenance because it asks you to remember too many sharp, theory-heavy, or uncovered areas."
        advice = "Simplify first: keep one main White plan, one Black answer to 1.e4, and one stable Black system vs 1.d4 before adding sidelines."
    elif category == "Medium maintenance":
        summary = "Your repertoire is medium maintenance: it is trainable, but a few areas still need regular upkeep."
        advice = "Keep the useful core, then reduce unstable move orders and fill the biggest uncovered response area."
    else:
        summary = "Your repertoire is low maintenance because your openings use repeatable plans and do not demand excessive theory."
        advice = "Keep building games in the same systems and avoid adding theory-heavy openings unless the current core stays stable."

    if band in {"under_1000", "1000_1400"} and category != "Low maintenance":
        advice = f"{advice} For this rating band, a simpler focused repertoire is usually the fastest way to improve."

    return {
        "category": category,
        "score": cost,
        "maintenanceCost": cost,
        "maintenance_cost": cost,
        "ratingBand": band,
        "rating_band": band,
        "familyCount": len(families),
        "family_count": len(families),
        "families": families[:8],
        "highTheoryCount": len(high_theory),
        "high_theory_count": len(high_theory),
        "sharpOpeningCount": len(sharp),
        "sharp_opening_count": len(sharp),
        "unstableMoveOrderCount": len(unstable),
        "unstable_move_order_count": len(unstable),
        "uncoveredResponseCount": len(uncovered),
        "uncovered_response_count": len(uncovered),
        "summary": summary,
        "advice": advice,
        "reasons": reasons[:5],
    }


def epoch_seconds(value: Any) -> Optional[float]:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric > 10_000_000_000:
        numeric = numeric / 1000
    return numeric


def build_game_import_quality(
    games: List[Dict[str, Any]],
    skipped_reason_counts: Optional[Dict[str, int]] = None,
    total_found: Optional[int] = None,
) -> Dict[str, Any]:
    skipped = skipped_reason_counts or {}
    analysed = len(games or [])
    found = int(total_found if total_found is not None else analysed + sum(int(value or 0) for value in skipped.values()))
    very_short = int(skipped.get("veryShort", 0) or 0)
    missing_opening = int(skipped.get("missingOpening", 0) or 0)
    classified_candidates = max(1, found - int(skipped.get("variants", 0) or 0) - very_short)
    classification_success = round((analysed / classified_candidates) * 100, 1) if classified_candidates else 0

    now_ts = datetime.now(timezone.utc).timestamp()
    recent_count = 0
    time_controls = Counter()
    rated_known = 0
    rated_count = 0
    colour_counts = Counter()
    analysed_short = 0

    for game in games or []:
        end_time = epoch_seconds(game.get("end_time") or game.get("endTime"))
        if end_time and now_ts - end_time <= 90 * 24 * 60 * 60:
            recent_count += 1
        time_control = str(game.get("time_class") or game.get("timeClass") or "unknown").lower()
        time_controls[time_control] += 1
        rated = game.get("rated")
        if rated is not None:
            rated_known += 1
            if bool(rated):
                rated_count += 1
        colour = str(game.get("colour") or game.get("color") or "unknown").lower()
        colour_counts[colour] += 1
        if int(game.get("move_count", game.get("moveCount", 0)) or 0) <= 10:
            analysed_short += 1

    if analysed and recent_count == 0:
        recent_count = analysed

    dominant_time_control, dominant_time_count = time_controls.most_common(1)[0] if time_controls else ("unknown", 0)
    dominant_time_pct = round((dominant_time_count / analysed) * 100, 1) if analysed else 0
    rated_pct = round((rated_count / rated_known) * 100, 1) if rated_known else None
    white = int(colour_counts.get("white", 0) or 0)
    black = int(colour_counts.get("black", 0) or 0)
    colour_balance = round((min(white, black) / max(1, white + black)) * 100, 1) if white or black else 0
    short_total = very_short + analysed_short
    short_pct = round((short_total / max(1, found)) * 100, 1)

    score = 0
    if analysed >= 60:
        score += 35
    elif analysed >= 30:
        score += 28
    elif analysed >= 15:
        score += 20
    elif analysed >= 8:
        score += 12
    elif analysed >= 4:
        score += 6

    if recent_count >= 30:
        score += 20
    elif recent_count >= 15:
        score += 15
    elif recent_count >= 8:
        score += 10
    elif recent_count >= 4:
        score += 5

    score += 12 if classification_success >= 90 else 8 if classification_success >= 75 else 3 if classification_success >= 55 else 0
    score += 10 if colour_balance >= 35 else 6 if colour_balance >= 25 else 2 if colour_balance >= 12 else 0
    if rated_pct is None:
        score += 5
    else:
        score += 10 if rated_pct >= 70 else 6 if rated_pct >= 40 else 2
    score += 8 if dominant_time_pct <= 70 else 4 if dominant_time_pct <= 85 else 1
    score += 5 if short_pct <= 8 else 2 if short_pct <= 18 else 0
    score = max(0, min(100, round(score)))

    if analysed < 5:
        category = "Not enough data"
    elif score < 45:
        category = "Weak data"
    elif score < 72:
        category = "Usable data"
    else:
        category = "Strong data"

    warnings = []
    if analysed < 12:
        warnings.append(f"Only {analysed} analysed game{'' if analysed == 1 else 's'} found, so recommendations are lower confidence.")
    if dominant_time_pct >= 80 and dominant_time_control in {"bullet", "blitz"}:
        warnings.append(f"Skewed data: {dominant_time_pct}% of analysed games are {dominant_time_control}, so use this as a rough guide.")
    elif dominant_time_pct >= 85 and dominant_time_control != "unknown":
        warnings.append(f"Time-control mix is narrow: {dominant_time_pct}% of analysed games are {dominant_time_control}.")
    if colour_balance < 25 and analysed >= 8:
        warnings.append("Colour balance is uneven, so one side of the repertoire is less reliable.")
    if short_pct > 18:
        warnings.append(f"{short_pct}% of found games were very short or opening-light, which weakens the opening signal.")
    if classification_success < 75:
        warnings.append(f"Opening classification succeeded on about {classification_success}% of usable games.")
    if rated_pct is not None and rated_pct < 40:
        warnings.append("Many imported games were unrated, so treat performance signals more cautiously.")

    if category == "Strong data":
        summary = f"Strong data: {analysed} recent {dominant_time_control} game{'' if analysed == 1 else 's'} analysed."
    elif category == "Usable data":
        summary = f"Usable data: {analysed} games analysed, enough for a practical but still cautious report."
    elif category == "Weak data":
        summary = f"Weak data: only {analysed} games produced usable opening signals, so recommendations are lower confidence."
    else:
        summary = f"Not enough data: only {analysed} usable game{'' if analysed == 1 else 's'} found."

    if warnings:
        summary = f"{summary} {warnings[0]}"

    return {
        "category": category,
        "score": score,
        "summary": summary,
        "warnings": warnings[:5],
        "confidenceImpact": "none" if category == "Strong data" else "minor" if category == "Usable data" else "major",
        "confidence_impact": "none" if category == "Strong data" else "minor" if category == "Usable data" else "major",
        "metrics": {
            "gamesAnalysed": analysed,
            "gamesAnalyzed": analysed,
            "gamesFound": found,
            "recentGames": recent_count,
            "dominantTimeControl": dominant_time_control,
            "dominantTimeControlShare": dominant_time_pct,
            "ratedShare": rated_pct,
            "colourBalance": colour_balance,
            "colorBalance": colour_balance,
            "veryShortGames": very_short,
            "shortGameShare": short_pct,
            "openingClassificationSuccessRate": classification_success,
            "missingOpeningCount": missing_opening,
        },
    }


def cap_confidence_for_import_quality(openings: List[Dict[str, Any]], import_quality: Dict[str, Any]) -> List[Dict[str, Any]]:
    category = str((import_quality or {}).get("category") or "")
    if category == "Strong data":
        return openings

    caps = {
        "Usable data": ("Medium confidence", "medium"),
        "Weak data": ("Low confidence", "low"),
        "Not enough data": ("Too little data", "too_little_data"),
    }
    cap_label, cap_level = caps.get(category, ("Low confidence", "low"))
    cap_score = confidence_numeric_score(cap_label)
    summary = str((import_quality or {}).get("summary") or "The imported data quality limits confidence.")
    adjusted = []
    for opening in openings or []:
        current_label = str(opening.get("confidence") or opening.get("confidenceLabel") or "")
        if confidence_numeric_score(current_label) <= cap_score:
            adjusted.append(opening)
            continue
        item = {**opening}
        item["confidence"] = cap_label
        item["confidence_label"] = cap_label
        item["confidenceLabel"] = cap_label
        item["confidence_level"] = cap_level
        item["confidenceLevel"] = cap_level
        item["confidenceReason"] = f"{summary} This caps the recommendation at {cap_label.lower()}."
        item["confidence_reason"] = item["confidenceReason"]
        evidence = list(item.get("evidence") or item.get("evidenceBullets") or [])
        if item["confidenceReason"] not in evidence:
            evidence.append(item["confidenceReason"])
        item["evidence"] = evidence[:5]
        item["evidenceBullets"] = item["evidence"]
        adjusted.append(item)
    return adjusted


def normalise_time_control_group(value: Any) -> str:
    text = str(value or "unknown").strip().lower()
    if text in {"bullet"}:
        return "bullet"
    if text in {"blitz"}:
        return "blitz"
    if text in {"rapid"}:
        return "rapid"
    if text in {"daily", "classical", "correspondence"}:
        return "daily/classical"
    return "unknown"


def time_control_confidence(games: int) -> str:
    if games >= 12:
        return "High confidence"
    if games >= 7:
        return "Medium confidence"
    if games >= 3:
        return "Low confidence"
    return "Too little data"


def time_control_result_score(row: Dict[str, int]) -> float:
    games = int(row.get("games", 0) or 0)
    if not games:
        return 0
    return round(((int(row.get("wins", 0) or 0) + int(row.get("draws", 0) or 0) * 0.5) / games) * 100, 1)


def build_time_control_opening_report(
    games: List[Dict[str, Any]],
    best_openings: List[Dict[str, Any]],
    min_total_games: int = 8,
    min_group_games: int = 3,
) -> Dict[str, Any]:
    opening_lookup = {
        (normalise_opening_key(str(item.get("name") or item.get("opening") or "")), str(item.get("context") or item.get("repertoireContext") or "")): item
        for item in best_openings or []
    }
    grouped: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for game in games or []:
        opening = str(game.get("opening") or game.get("name") or "").strip()
        if not opening or is_unknown_opening_name(opening):
            continue
        context = str(game.get("context") or game.get("repertoireContext") or "unknown_mixed")
        key = (normalise_opening_key(opening), context)
        row = grouped.setdefault(
            key,
            {
                "opening": opening,
                "name": opening,
                "context": context,
                "contextLabel": context_label(context),
                "groups": defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0, "opening_losses": 0, "middlegame_losses": 0, "late_losses": 0, "unknown_losses": 0}),
            },
        )
        group = normalise_time_control_group(game.get("time_class") or game.get("timeClass"))
        stats = row["groups"][group]
        stats["games"] += 1
        result = str(game.get("result") or "").lower()
        if result == "win":
            stats["wins"] += 1
        elif result == "draw":
            stats["draws"] += 1
        elif result == "loss":
            stats["losses"] += 1
            timing = game.get("loss_timing") or game.get("lossTiming") or {}
            bucket = str(timing.get("bucket") or "")
            if bucket == "opening":
                stats["opening_losses"] += 1
            elif bucket == "middlegame":
                stats["middlegame_losses"] += 1
            elif bucket == "late":
                stats["late_losses"] += 1
            else:
                stats["unknown_losses"] += 1

    items = []
    for key, row in grouped.items():
        groups = []
        total_games = 0
        for label in ["bullet", "blitz", "rapid", "daily/classical", "unknown"]:
            stats = row["groups"].get(label)
            if not stats:
                continue
            games_count = int(stats.get("games", 0) or 0)
            total_games += games_count
            score = time_control_result_score(stats)
            groups.append(
                {
                    "group": label,
                    "label": label.title() if label != "daily/classical" else "Daily/classical",
                    "games": games_count,
                    "score": score,
                    "resultScore": score,
                    "result_score": score,
                    "confidence": time_control_confidence(games_count),
                    "lossTiming": {
                        "opening": int(stats.get("opening_losses", 0) or 0),
                        "middlegame": int(stats.get("middlegame_losses", 0) or 0),
                        "late": int(stats.get("late_losses", 0) or 0),
                        "unknown": int(stats.get("unknown_losses", 0) or 0),
                    },
                    "loss_timing": {
                        "opening": int(stats.get("opening_losses", 0) or 0),
                        "middlegame": int(stats.get("middlegame_losses", 0) or 0),
                        "late": int(stats.get("late_losses", 0) or 0),
                        "unknown": int(stats.get("unknown_losses", 0) or 0),
                    },
                }
            )

        meaningful = [item for item in groups if int(item.get("games", 0) or 0) >= min_group_games]
        if total_games < min_total_games or len(meaningful) < 2:
            continue

        best_group = max(meaningful, key=lambda item: (float(item.get("score", 0) or 0), int(item.get("games", 0) or 0)))
        weakest_group = min(meaningful, key=lambda item: (float(item.get("score", 0) or 0), -int(item.get("games", 0) or 0)))
        delta = round(float(best_group.get("score", 0) or 0) - float(weakest_group.get("score", 0) or 0), 1)
        opening_info = opening_lookup.get(key) or opening_lookup.get((key[0], "unknown_mixed")) or {}
        plan_status = str(opening_info.get("planClarityStatus") or opening_info.get("plan_clarity_status") or "Unavailable")
        plan_score = int(opening_info.get("planClarityScore", opening_info.get("plan_clarity_score", 0)) or 0)

        if delta < 12:
            summary = f"{row['opening']}: results are similar across meaningful time-control samples."
            advice = "Do not change the opening by time control yet; the difference is not large enough."
        else:
            summary = f"{row['opening']}: stronger in {best_group['group']} than {weakest_group['group']}."
            if weakest_group["group"] in {"bullet", "blitz"}:
                advice = f"Treat weak {weakest_group['group']} results as a speed-practice issue before replacing the opening."
            else:
                advice = f"Review why {row['opening']} drops in {weakest_group['group']} before using the same advice across all time controls."

        if weakest_group["lossTiming"]["opening"] >= max(2, math.ceil(int(weakest_group.get("games", 0) or 0) * 0.4)):
            advice = f"{advice} Losses in {weakest_group['group']} often happen early, so the opening plan may need review there."

        items.append(
            {
                "opening": row["opening"],
                "name": row["opening"],
                "context": row["context"],
                "contextLabel": row["contextLabel"],
                "totalGames": total_games,
                "total_games": total_games,
                "groups": groups,
                "meaningfulGroups": meaningful,
                "meaningful_groups": meaningful,
                "bestGroup": best_group,
                "best_group": best_group,
                "weakestGroup": weakest_group,
                "weakest_group": weakest_group,
                "scoreDelta": delta,
                "score_delta": delta,
                "planClarityStatus": plan_status,
                "plan_clarity_status": plan_status,
                "planClarityScore": plan_score,
                "plan_clarity_score": plan_score,
                "summary": summary,
                "advice": advice,
                "confidence": "Medium confidence" if min(int(best_group.get("games", 0) or 0), int(weakest_group.get("games", 0) or 0)) >= 7 else "Low confidence",
            }
        )

    items.sort(key=lambda item: (float(item.get("scoreDelta", 0) or 0), int(item.get("totalGames", 0) or 0)), reverse=True)
    if not items:
        return {
            "enabled": False,
            "summary": "Time-control split needs at least two meaningful samples for the same opening before it can compare advice.",
            "items": [],
        }

    return {
        "enabled": True,
        "summary": "Time-control split checks whether opening advice changes between bullet, blitz, rapid, and longer games.",
        "items": items[:5],
    }


def sanitise_recommendation_sections(sections: Dict[str, Any]) -> Dict[str, Any]:
    primary_keys = ["white_repertoire", "black_vs_e4", "black_vs_d4", "black_vs_other"]
    seen: Dict[str, Dict[str, Any]] = {}
    alternatives = list(sections.get("experimental_rare") or [])

    for key in primary_keys:
        cleaned = []
        for item in sections.get(key, []):
            name_key = str(item.get("name") or "").lower()
            incompatible = (
                (key == "white_repertoire" and opening_name_colour_hint(item.get("name", "")) == "black")
                or (key.startswith("black") and opening_name_colour_hint(item.get("name", "")) == "white")
            )
            if incompatible or str(item.get("confidence", "")).lower().startswith("too little"):
                demoted = {**item, "sanityNote": "Demoted because the colour context or sample size is not strong enough."}
                alternatives.append(demoted)
                continue
            current = seen.get(name_key)
            if current:
                stronger = max(
                    [current["item"], item],
                    key=lambda value: (confidence_numeric_score(value.get("confidence")), value.get("games", 0), value.get("fitScore", 0)),
                )
                weaker = item if stronger is current["item"] else current["item"]
                alternatives.append({**weaker, "upgrade_type": "alternative", "upgradeType": "alternative", "sanityNote": "Alternative to explore; a higher-confidence recommendation kept the main slot."})
                if stronger is not current["item"]:
                    seen[name_key] = {"section": key, "item": item}
                    cleaned.append(item)
                continue
            seen[name_key] = {"section": key, "item": item}
            cleaned.append(item)
        sections[key] = cleaned

    sections["experimental_rare"] = alternatives[:5]
    return sections


def rating_band(rating: Optional[int]) -> str:
    if not rating:
        return "unknown"
    if rating < 1000:
        return "under_1000"
    if rating < 1400:
        return "1000_1400"
    if rating < 1800:
        return "1400_1800"
    return "1800_plus"


OPENING_RISK_PROFILES: Dict[str, Dict[str, Any]] = {
    "vienna": {
        "theoryLoad": "medium",
        "theory_load": "medium",
        "tacticalSharpness": "medium",
        "tactical_sharpness": "medium",
        "solidTendency": "medium",
        "solid_tendency": "medium",
        "planClarity": "high",
        "plan_clarity": "high",
        "beginnerFriendliness": "high",
        "beginner_friendliness": "high",
        "attackingPotential": "high",
        "attacking_potential": "high",
        "positionalComplexity": "medium",
        "positional_complexity": "medium",
        "practicalSummary": "The Vienna gives attacking chances without requiring extreme theory depth.",
        "practical_summary": "The Vienna gives attacking chances without requiring extreme theory depth.",
    },
    "italian": {
        "theoryLoad": "medium",
        "theory_load": "medium",
        "tacticalSharpness": "medium",
        "tactical_sharpness": "medium",
        "solidTendency": "medium",
        "solid_tendency": "medium",
        "planClarity": "high",
        "plan_clarity": "high",
        "beginnerFriendliness": "high",
        "beginner_friendliness": "high",
        "attackingPotential": "medium",
        "attacking_potential": "medium",
        "positionalComplexity": "medium",
        "positional_complexity": "medium",
        "practicalSummary": "The Italian gives clear development rules with enough tactics to stay useful.",
        "practical_summary": "The Italian gives clear development rules with enough tactics to stay useful.",
    },
    "scotch": {
        "theoryLoad": "medium",
        "theory_load": "medium",
        "tacticalSharpness": "high",
        "tactical_sharpness": "high",
        "solidTendency": "low",
        "solid_tendency": "low",
        "planClarity": "medium",
        "plan_clarity": "medium",
        "beginnerFriendliness": "medium",
        "beginner_friendliness": "medium",
        "attackingPotential": "high",
        "attacking_potential": "high",
        "positionalComplexity": "medium",
        "positional_complexity": "medium",
        "practicalSummary": "The Scotch is practical for tactical players, but early calculation matters.",
        "practical_summary": "The Scotch is practical for tactical players, but early calculation matters.",
    },
    "sicilian": {
        "theoryLoad": "high",
        "theory_load": "high",
        "tacticalSharpness": "high",
        "tactical_sharpness": "high",
        "solidTendency": "low",
        "solid_tendency": "low",
        "planClarity": "medium",
        "plan_clarity": "medium",
        "beginnerFriendliness": "low",
        "beginner_friendliness": "low",
        "attackingPotential": "high",
        "attacking_potential": "high",
        "positionalComplexity": "high",
        "positional_complexity": "high",
        "practicalSummary": "The Sicilian offers winning chances, but the theory load and sharpness can punish unstable opening habits.",
        "practical_summary": "The Sicilian offers winning chances, but the theory load and sharpness can punish unstable opening habits.",
    },
    "scandinavian": {
        "theoryLoad": "low",
        "theory_load": "low",
        "tacticalSharpness": "medium",
        "tactical_sharpness": "medium",
        "solidTendency": "medium",
        "solid_tendency": "medium",
        "planClarity": "high",
        "plan_clarity": "high",
        "beginnerFriendliness": "high",
        "beginner_friendliness": "high",
        "attackingPotential": "medium",
        "attacking_potential": "medium",
        "positionalComplexity": "low",
        "positional_complexity": "low",
        "practicalSummary": "The Scandinavian is easy to start, but repeated queen moves can make it risky in practice.",
        "practical_summary": "The Scandinavian is easy to start, but repeated queen moves can make it risky in practice.",
    },
    "caro": {
        "theoryLoad": "medium",
        "theory_load": "medium",
        "tacticalSharpness": "low",
        "tactical_sharpness": "low",
        "solidTendency": "high",
        "solid_tendency": "high",
        "planClarity": "high",
        "plan_clarity": "high",
        "beginnerFriendliness": "high",
        "beginner_friendliness": "high",
        "attackingPotential": "low",
        "attacking_potential": "low",
        "positionalComplexity": "medium",
        "positional_complexity": "medium",
        "practicalSummary": "The Caro-Kann is a practical solid choice with clear structure and moderate theory.",
        "practical_summary": "The Caro-Kann is a practical solid choice with clear structure and moderate theory.",
    },
    "french": {
        "theoryLoad": "medium",
        "theory_load": "medium",
        "tacticalSharpness": "medium",
        "tactical_sharpness": "medium",
        "solidTendency": "high",
        "solid_tendency": "high",
        "planClarity": "medium",
        "plan_clarity": "medium",
        "beginnerFriendliness": "medium",
        "beginner_friendliness": "medium",
        "attackingPotential": "medium",
        "attacking_potential": "medium",
        "positionalComplexity": "high",
        "positional_complexity": "high",
        "practicalSummary": "The French is solid, but pawn-chain plans and the light-square bishop need attention.",
        "practical_summary": "The French is solid, but pawn-chain plans and the light-square bishop need attention.",
    },
    "london": {
        "theoryLoad": "low",
        "theory_load": "low",
        "tacticalSharpness": "low",
        "tactical_sharpness": "low",
        "solidTendency": "high",
        "solid_tendency": "high",
        "planClarity": "high",
        "plan_clarity": "high",
        "beginnerFriendliness": "high",
        "beginner_friendliness": "high",
        "attackingPotential": "medium",
        "attacking_potential": "medium",
        "positionalComplexity": "low",
        "positional_complexity": "low",
        "practicalSummary": "The London is low-theory and clear, which helps players who need a repeatable plan.",
        "practical_summary": "The London is low-theory and clear, which helps players who need a repeatable plan.",
    },
    "queen's gambit": {
        "theoryLoad": "medium",
        "theory_load": "medium",
        "tacticalSharpness": "medium",
        "tactical_sharpness": "medium",
        "solidTendency": "high",
        "solid_tendency": "high",
        "planClarity": "medium",
        "plan_clarity": "medium",
        "beginnerFriendliness": "medium",
        "beginner_friendliness": "medium",
        "attackingPotential": "medium",
        "attacking_potential": "medium",
        "positionalComplexity": "high",
        "positional_complexity": "high",
        "practicalSummary": "The Queen's Gambit is healthy and structured, but it asks for more pawn-structure understanding.",
        "practical_summary": "The Queen's Gambit is healthy and structured, but it asks for more pawn-structure understanding.",
    },
    "king's indian": {
        "theoryLoad": "high",
        "theory_load": "high",
        "tacticalSharpness": "high",
        "tactical_sharpness": "high",
        "solidTendency": "low",
        "solid_tendency": "low",
        "planClarity": "medium",
        "plan_clarity": "medium",
        "beginnerFriendliness": "low",
        "beginner_friendliness": "low",
        "attackingPotential": "high",
        "attacking_potential": "high",
        "positionalComplexity": "high",
        "positional_complexity": "high",
        "practicalSummary": "King's Indian structures are powerful, but the theory and strategic complexity are high.",
        "practical_summary": "King's Indian structures are powerful, but the theory and strategic complexity are high.",
    },
    "english": {
        "theoryLoad": "medium",
        "theory_load": "medium",
        "tacticalSharpness": "low",
        "tactical_sharpness": "low",
        "solidTendency": "high",
        "solid_tendency": "high",
        "planClarity": "medium",
        "plan_clarity": "medium",
        "beginnerFriendliness": "medium",
        "beginner_friendliness": "medium",
        "attackingPotential": "medium",
        "attacking_potential": "medium",
        "positionalComplexity": "high",
        "positional_complexity": "high",
        "practicalSummary": "The English is flexible and solid, but it can feel vague without a clear setup.",
        "practical_summary": "The English is flexible and solid, but it can feel vague without a clear setup.",
    },
}


DEFAULT_OPENING_RISK_PROFILE = {
    "theoryLoad": "medium",
    "theory_load": "medium",
    "tacticalSharpness": "medium",
    "tactical_sharpness": "medium",
    "solidTendency": "medium",
    "solid_tendency": "medium",
    "planClarity": "medium",
    "plan_clarity": "medium",
    "beginnerFriendliness": "medium",
    "beginner_friendliness": "medium",
    "attackingPotential": "medium",
    "attacking_potential": "medium",
    "positionalComplexity": "medium",
    "positional_complexity": "medium",
    "practicalSummary": "OpeningFit does not have a detailed risk profile for this opening yet, so it treats the practical difficulty as medium.",
    "practical_summary": "OpeningFit does not have a detailed risk profile for this opening yet, so it treats the practical difficulty as medium.",
}


def opening_risk_profile(name: str) -> Dict[str, Any]:
    lower = normalise_opening_key(name)
    for token, profile in OPENING_RISK_PROFILES.items():
        if token in lower:
            return {**profile}
    return {**DEFAULT_OPENING_RISK_PROFILE}


def opening_difficulty_penalty(profile: Dict[str, Any], rating: Optional[int]) -> int:
    band = rating_band(rating)
    theory = str(profile.get("theoryLoad") or profile.get("theory_load") or "medium")
    sharpness = str(profile.get("tacticalSharpness") or profile.get("tactical_sharpness") or "medium")
    clarity = str(profile.get("planClarity") or profile.get("plan_clarity") or "medium")
    beginner = str(profile.get("beginnerFriendliness") or profile.get("beginner_friendliness") or "medium")
    penalty = 0

    if band == "under_1000":
        if theory == "high":
            penalty += 14
        elif theory == "medium":
            penalty += 4
        if sharpness == "high":
            penalty += 8
        if clarity == "low" or beginner == "low":
            penalty += 6
    elif band == "1000_1400":
        if theory == "high":
            penalty += 10
        if sharpness == "high":
            penalty += 4
        if clarity == "low":
            penalty += 4
    elif band == "1400_1800":
        if theory == "high":
            penalty += 4
    elif band == "unknown":
        if theory == "high":
            penalty += 5

    return penalty


def opening_practical_note(name: str, profile: Dict[str, Any], rating: Optional[int], opening: Optional[Dict[str, Any]] = None) -> str:
    band = rating_band(rating)
    theory = str(profile.get("theoryLoad") or profile.get("theory_load") or "medium")
    sharpness = str(profile.get("tacticalSharpness") or profile.get("tactical_sharpness") or "medium")
    clarity = str(profile.get("planClarity") or profile.get("plan_clarity") or "medium")
    score = float((opening or {}).get("openingAdjustedScore", (opening or {}).get("winRate", 50)) or 50)
    games = int((opening or {}).get("games", 0) or 0)

    if theory == "high" and band in {"under_1000", "1000_1400"} and (games < 15 or score < 55):
        return (
            f"OpeningFit is cautious with {name} as a main choice because your rating band and current sample "
            "suggest the theory load may be too high right now."
        )
    if theory == "high" and band == "unknown":
        return f"{name} has a high theory load, so OpeningFit treats it as a careful experiment unless your results are clearly strong."
    if clarity == "high" and theory in {"low", "medium"}:
        return f"{name} fits practically because it gives clear plans without requiring extreme theory depth."
    if sharpness == "high":
        return f"{name} can fit attacking players, but the sharpness means repeated opening habits matter more."
    return str(profile.get("practicalSummary") or profile.get("practical_summary") or DEFAULT_OPENING_RISK_PROFILE["practicalSummary"])


def apply_opening_risk_profile(opening: Dict[str, Any], rating: Optional[int] = None) -> Dict[str, Any]:
    name = str(opening.get("name") or opening.get("opening") or "")
    profile = opening_risk_profile(name)
    penalty = opening_difficulty_penalty(profile, rating)
    adjusted = {**opening}
    adjusted["openingRiskProfile"] = profile
    adjusted["opening_risk_profile"] = profile
    adjusted["practicalDifficultyPenalty"] = penalty
    adjusted["practical_difficulty_penalty"] = penalty
    adjusted["practicalDifficultyNote"] = opening_practical_note(name or "this opening", profile, rating, opening)
    adjusted["practical_difficulty_note"] = adjusted["practicalDifficultyNote"]

    if penalty and adjusted.get("fitScore") is not None:
        new_score = max(0, int(adjusted.get("fitScore", 0) or 0) - penalty)
        adjusted["fitScore"] = new_score
        adjusted["fit_score"] = new_score
        if isinstance(adjusted.get("fitScoreBreakdown"), dict):
            adjusted["fitScoreBreakdown"] = {
                **adjusted["fitScoreBreakdown"],
                "practicalDifficultyPenalty": penalty,
            }
        if isinstance(adjusted.get("fit_score_breakdown"), dict):
            adjusted["fit_score_breakdown"] = {
                **adjusted["fit_score_breakdown"],
                "practical_difficulty_penalty": penalty,
            }

    verdict = str(adjusted.get("verdict") or "").lower()
    games = int(adjusted.get("games", 0) or 0)
    if penalty >= 10 and verdict == "keep" and games < 20:
        adjusted["verdict"] = "Fix"
        adjusted["fitVerdict"] = "Fix"
        adjusted["fit_verdict"] = "Fix"
        adjusted["recommendationCategory"] = "Fix"
        adjusted["recommendation_category"] = "Fix"
        adjusted["riskAdjustedVerdict"] = "Fix"
        adjusted["risk_adjusted_verdict"] = "Fix"

    evidence = list(adjusted.get("evidence") or adjusted.get("evidenceBullets") or [])
    note = adjusted["practicalDifficultyNote"]
    if note and note not in evidence:
        evidence.append(note)
    adjusted["evidence"] = evidence[:5]
    adjusted["evidenceBullets"] = adjusted["evidence"]
    return adjusted


def apply_opening_risk_profiles(openings: List[Dict[str, Any]], rating: Optional[int] = None) -> List[Dict[str, Any]]:
    return [apply_opening_risk_profile(item, rating) for item in openings or []]


def opening_fixability_fields(
    opening: Dict[str, Any],
    related_problem_lines: Optional[List[Dict[str, Any]]] = None,
    rating: Optional[int] = None,
) -> Dict[str, Any]:
    name = str(opening.get("name") or opening.get("opening") or "this opening")
    games = int(opening.get("games", 0) or 0)
    losses = int(opening.get("losses", 0) or 0)
    score = float(opening.get("openingAdjustedScore", opening.get("winRate", opening.get("win_rate", 50))) or 50)
    opening_losses = int(opening.get("openingLosses", opening.get("opening_losses", 0)) or 0)
    late_losses = int(opening.get("lateLosses", opening.get("late_losses", 0)) or 0)
    plan_score = int(opening.get("planClarityScore", opening.get("plan_clarity_score", 0)) or 0)
    variation_count = int(opening.get("moveOrderVariationCount", opening.get("move_order_variation_count", 0)) or 0)
    related_lines = related_problem_lines or []
    problem_line_count = len(related_lines)
    risk = opening.get("openingRiskProfile") or opening.get("opening_risk_profile") or opening_risk_profile(name)
    theory = str(risk.get("theoryLoad") or risk.get("theory_load") or "medium")
    band = rating_band(rating)
    penalty = int(opening.get("practicalDifficultyPenalty", opening.get("practical_difficulty_penalty", 0)) or 0)

    ease = 55
    reasons = []

    if games < 5:
        ease -= 18
        reasons.append("The sample is still small, so the fix/replace call is provisional.")
    elif games >= 12:
        ease += 8
        reasons.append(f"The sample is useful enough to judge: {games} games.")
    else:
        reasons.append(f"The sample is moderate: {games} games.")

    if problem_line_count == 1:
        ease += 18
        reasons.append("The issue appears concentrated in one repeated line.")
    elif problem_line_count >= 3:
        ease -= 22
        reasons.append("Problems appear across several unrelated early lines.")
    elif problem_line_count == 2:
        ease -= 8
        reasons.append("There are two separate repeated problem lines.")
    elif variation_count >= 5:
        ease -= 12
        reasons.append("Your early move orders vary a lot, so the fix is less targeted.")

    if losses:
        if opening_losses >= max(2, math.ceil(losses * 0.5)):
            ease += 10
            reasons.append("Losses are happening early, which makes the opening issue easier to isolate.")
        elif late_losses >= max(2, math.ceil(losses * 0.5)):
            ease -= 8
            reasons.append("Many losses are late, so the opening may not be the main cause.")

    if plan_score >= 70:
        ease += 10
        reasons.append("Plan clarity is good, so one branch may be fixable without changing openings.")
    elif plan_score and plan_score < 45:
        ease -= 14
        reasons.append("Plan clarity is low, so the problem may be structural rather than one move.")

    if theory == "high":
        ease -= 14
        reasons.append("The opening has a high theory load.")
    elif theory == "low":
        ease += 6
        reasons.append("The opening is practical enough to repair without heavy theory.")

    if band in {"under_1000", "1000_1400"} and (theory == "high" or penalty >= 10):
        ease -= 12
        reasons.append("For this rating band, the practical difficulty is a real factor.")

    if score < 38:
        ease -= 12
        reasons.append(f"The adjusted score is low at {round(score, 1)}%.")
    elif score >= 50:
        ease += 8
        reasons.append(f"The adjusted score is still workable at {round(score, 1)}%.")

    ease = max(0, min(100, round(ease)))

    enough_to_replace = games >= 8 and confidence_numeric_score(str(opening.get("confidence") or "")) >= 42
    broad_and_hard = problem_line_count >= 3 or (variation_count >= 6 and plan_score < 45)
    difficult_for_band = theory == "high" and band in {"under_1000", "1000_1400", "unknown"}

    if enough_to_replace and score < 42 and (broad_and_hard or difficult_for_band):
        category = "Better to replace"
        explanation = (
            f"Better to replace: {name} is scoring poorly across a hard-to-isolate pattern, "
            "so a simpler system may save study time."
        )
    elif ease >= 70:
        category = "Easy fix"
        explanation = f"Easy fix: {name} is workable overall, but one repeated issue is hurting results."
    elif ease >= 45:
        category = "Medium fix"
        explanation = f"Medium fix: {name} is probably repairable, but the fix needs a focused review plan."
    else:
        category = "Hard fix"
        explanation = f"Hard fix: {name} has multiple or unclear problems, so repair may take more work than usual."

    return {
        "fixabilityScore": ease,
        "fixability_score": ease,
        "fixabilityCategory": category,
        "fixability_category": category,
        "fixabilityExplanation": explanation,
        "fixability_explanation": explanation,
        "fixabilityReasons": reasons[:5],
        "fixability_reasons": reasons[:5],
        "problemLineCount": problem_line_count,
        "problem_line_count": problem_line_count,
    }


def apply_opening_fixability(
    opening: Dict[str, Any],
    related_problem_lines: Optional[List[Dict[str, Any]]] = None,
    rating: Optional[int] = None,
) -> Dict[str, Any]:
    adjusted = {**opening}
    adjusted.update(opening_fixability_fields(adjusted, related_problem_lines, rating))
    category = str(adjusted.get("fixabilityCategory") or "")
    games = int(adjusted.get("games", 0) or 0)

    if category == "Better to replace" and games >= 8:
        verdict = "Replace"
    elif category in {"Easy fix", "Medium fix"} and str(adjusted.get("verdict") or "").lower() == "replace":
        verdict = "Fix"
    else:
        verdict = str(adjusted.get("verdict") or adjusted.get("fitVerdict") or "Fix")

    adjusted["verdict"] = verdict
    adjusted["fitVerdict"] = verdict
    adjusted["fit_verdict"] = verdict
    adjusted["recommendationCategory"] = verdict
    adjusted["recommendation_category"] = verdict
    adjusted["verdictReason"] = adjusted["fixabilityExplanation"]
    adjusted["verdict_reason"] = adjusted["fixabilityExplanation"]

    evidence = list(adjusted.get("evidence") or adjusted.get("evidenceBullets") or [])
    if adjusted["fixabilityExplanation"] not in evidence:
        evidence.append(adjusted["fixabilityExplanation"])
    adjusted["evidence"] = evidence[:5]
    adjusted["evidenceBullets"] = adjusted["evidence"]
    return adjusted


def apply_opening_fixability_scores(
    openings: List[Dict[str, Any]],
    problem_lines: List[Dict[str, Any]],
    rating: Optional[int] = None,
) -> List[Dict[str, Any]]:
    lines_by_opening = defaultdict(list)
    for line in problem_lines or []:
        key = normalise_opening_key(str(line.get("opening") or line.get("name") or ""))
        if key:
            lines_by_opening[key].append(line)

    enriched = []
    for opening in openings or []:
        key = normalise_opening_key(str(opening.get("name") or opening.get("opening") or ""))
        enriched.append(apply_opening_fixability(opening, lines_by_opening.get(key, []), rating))
    return enriched


def sort_openings_for_recommendation(openings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        openings or [],
        key=lambda item: (
            int(item.get("games", 0) or 0) >= 5,
            int(item.get("fitScore", 0) or 0),
            float(item.get("score", item.get("winRate", item.get("win_rate", 0))) or 0),
            int(item.get("games", 0) or 0),
            -int(item.get("practicalDifficultyPenalty", item.get("practical_difficulty_penalty", 0)) or 0),
        ),
        reverse=True,
    )


RATING_BAND_BENCHMARKS = {
    "under_1000": {
        "label": "Under 1000",
        "expectedMainOpenings": "1 simple White setup and 1 simple Black setup",
        "expected_main_openings": "1 simple White setup and 1 simple Black setup",
        "expectedCoverage": "A clear answer as White and one basic Black plan is enough.",
        "expected_coverage": "A clear answer as White and one basic Black plan is enough.",
        "acceptableTheoryDepth": "Very light theory: development, king safety, and one pawn break.",
        "acceptable_theory_depth": "Very light theory: development, king safety, and one pawn break.",
        "sampleSizeNeeded": 5,
        "sample_size_needed": 5,
        "commonTrainingPriority": "Reach safe, developed positions more often than memorising lines.",
        "common_training_priority": "Reach safe, developed positions more often than memorising lines.",
    },
    "1000_1400": {
        "label": "1000-1400",
        "expectedMainOpenings": "2-3 main systems across White and Black",
        "expected_main_openings": "2-3 main systems across White and Black",
        "expectedCoverage": "One White plan plus clear Black replies to 1.e4 and 1.d4.",
        "expected_coverage": "One White plan plus clear Black replies to 1.e4 and 1.d4.",
        "acceptableTheoryDepth": "Practical plans and first 6-8 moves, not heavy sidelines.",
        "acceptable_theory_depth": "Practical plans and first 6-8 moves, not heavy sidelines.",
        "sampleSizeNeeded": 8,
        "sample_size_needed": 8,
        "commonTrainingPriority": "Keep the repertoire focused before adding more openings.",
        "common_training_priority": "Keep the repertoire focused before adding more openings.",
    },
    "1400_1800": {
        "label": "1400-1800",
        "expectedMainOpenings": "3-5 stable systems with clear side-specific coverage",
        "expected_main_openings": "3-5 stable systems with clear side-specific coverage",
        "expectedCoverage": "White plans by opponent response and Black plans versus 1.e4, 1.d4, and flank openings.",
        "expected_coverage": "White plans by opponent response and Black plans versus 1.e4, 1.d4, and flank openings.",
        "acceptableTheoryDepth": "Structured main lines with known plans and common problem branches.",
        "acceptable_theory_depth": "Structured main lines with known plans and common problem branches.",
        "sampleSizeNeeded": 12,
        "sample_size_needed": 12,
        "commonTrainingPriority": "Fix recurring branches and move-order issues before replacing openings.",
        "common_training_priority": "Fix recurring branches and move-order issues before replacing openings.",
    },
    "1800_plus": {
        "label": "1800+",
        "expectedMainOpenings": "A compact but prepared repertoire with opponent-specific branches",
        "expected_main_openings": "A compact but prepared repertoire with opponent-specific branches",
        "expectedCoverage": "Clear coverage across common first moves, transpositions, and repeated sidelines.",
        "expected_coverage": "Clear coverage across common first moves, transpositions, and repeated sidelines.",
        "acceptableTheoryDepth": "Deeper theory is useful, but only where the player repeats the positions.",
        "acceptable_theory_depth": "Deeper theory is useful, but only where the player repeats the positions.",
        "sampleSizeNeeded": 15,
        "sample_size_needed": 15,
        "commonTrainingPriority": "Audit move orders, recurring problem lines, and opponent-specific preparation.",
        "common_training_priority": "Audit move orders, recurring problem lines, and opponent-specific preparation.",
    },
    "unknown": {
        "label": "Rating unavailable",
        "expectedMainOpenings": "A small set of repeatable White and Black systems",
        "expected_main_openings": "A small set of repeatable White and Black systems",
        "expectedCoverage": "At least one White plan and one Black answer to the most common first moves.",
        "expected_coverage": "At least one White plan and one Black answer to the most common first moves.",
        "acceptableTheoryDepth": "Practical plans first; add theory only after the sample repeats.",
        "acceptable_theory_depth": "Practical plans first; add theory only after the sample repeats.",
        "sampleSizeNeeded": 8,
        "sample_size_needed": 8,
        "commonTrainingPriority": "Build a stable sample before making rating-specific repertoire changes.",
        "common_training_priority": "Build a stable sample before making rating-specific repertoire changes.",
    },
}


def build_rating_band_benchmark(
    rating: Optional[int],
    best_openings: List[Dict[str, Any]],
    coverage: Dict[str, Any],
    coherence: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    band = rating_band(rating)
    benchmark = RATING_BAND_BENCHMARKS.get(band, RATING_BAND_BENCHMARKS["unknown"])
    sample_needed = int(benchmark["sampleSizeNeeded"])
    repeated_openings = [
        item for item in best_openings or []
        if is_clean_repertoire_context(item)
        and not is_unknown_opening_name(item.get("name", ""))
        and int(item.get("games", 0) or 0) >= 3
    ]
    confident_openings = [item for item in repeated_openings if int(item.get("games", 0) or 0) >= sample_needed]
    low_sample_openings = [
        item for item in best_openings or []
        if is_clean_repertoire_context(item)
        and not is_unknown_opening_name(item.get("name", ""))
        and 0 < int(item.get("games", 0) or 0) < sample_needed
    ]
    coverage_rows = (coverage or {}).get("white", []) + (coverage or {}).get("black", [])
    covered = [row for row in coverage_rows if row.get("status") == "Covered"]
    needs_work = [row for row in coverage_rows if row.get("status") in {"Needs work", "No clear plan", "Too little data"}]
    coherence_status = str((coherence or {}).get("status") or "Unknown")
    top_systems = []
    for row in (coherence or {}).get("rows", []) or (coherence or {}).get("lanes", []) or []:
        top_systems.extend(row.get("topSystems", []) or row.get("top_systems", []) or [])
    top_systems = list(dict.fromkeys(str(name) for name in top_systems if name))[:3]

    feedback = []
    if band == "unknown":
        feedback.append("Rating was not available, so this benchmark uses conservative repertoire expectations rather than a precise rating target.")
    if coherence_status in {"Simple and focused", "Mostly focused"}:
        feedback.append(f"Your repertoire is {coherence_status.lower()}, which fits the benchmark preference for repeatable systems.")
    elif coherence_status in {"Fragmented", "Too random to train efficiently"}:
        feedback.append(f"Your repertoire is {coherence_status.lower()}, so the benchmark points toward simplifying before adding theory.")
    if covered:
        feedback.append(f"{len(covered)} repertoire area{'' if len(covered) == 1 else 's'} look covered against this benchmark.")
    if needs_work:
        feedback.append(f"{needs_work[0]['label']} is the clearest benchmark gap to address next.")
    if low_sample_openings and not confident_openings:
        feedback.append(f"Your opening samples are still below the {sample_needed}-game confidence target for this band.")

    if band == "1000_1400":
        summary = "For 1000-1400 players, a focused repertoire usually beats learning many openings."
    elif band == "under_1000":
        summary = "For under-1000 players, simple development plans matter more than broad opening theory."
    elif band == "1400_1800":
        summary = "For 1400-1800 players, a structured repertoire should cover common first moves without becoming too wide."
    elif band == "1800_plus":
        summary = "For 1800+ players, repertoire health depends more on coverage, move orders, and repeated problem branches."
    else:
        summary = "Without a rating, OpeningFit compares your repertoire to a practical club-player benchmark."

    if coherence_status in {"Simple and focused", "Mostly focused"} and needs_work:
        summary = f"{summary} Your repertoire is focused overall, but {needs_work[0]['label']} still needs work."
    elif coherence_status in {"Fragmented", "Too random to train efficiently"}:
        summary = f"{summary} Your current sample is more fragmented than this benchmark would prefer."

    return {
        "band": band,
        "rating": rating,
        "benchmark": benchmark,
        "summary": summary,
        "feedback": feedback[:4],
        "measured": {
            "mainOpeningCount": len(repeated_openings),
            "main_opening_count": len(repeated_openings),
            "confidentOpeningCount": len(confident_openings),
            "confident_opening_count": len(confident_openings),
            "lowSampleOpeningCount": len(low_sample_openings),
            "low_sample_opening_count": len(low_sample_openings),
            "coveredAreaCount": len(covered),
            "covered_area_count": len(covered),
            "gapCount": len(needs_work),
            "gap_count": len(needs_work),
            "coherenceStatus": coherence_status,
            "coherence_status": coherence_status,
            "topSystems": top_systems,
            "top_systems": top_systems,
        },
        "caution": "This is a practical benchmark, not an exact rating model.",
    }


def build_next_training_actions(
    best_openings: List[Dict[str, Any]],
    coverage: Dict[str, Any],
    problem_lines: List[Dict[str, Any]],
    rating: Optional[int] = None,
    coherence: Optional[Dict[str, Any]] = None,
) -> List[str]:
    band = rating_band(rating)
    actions: List[str] = []
    keep = next((item for item in best_openings if str(item.get("verdict", "")).lower() == "keep" and is_clean_repertoire_context(item) and int(item.get("games", 0) or 0) >= 5), None)
    weak = next((item for item in best_openings if str(item.get("verdict", "")).lower() in {"fix", "replace", "improve", "avoid"} and is_clean_repertoire_context(item) and int(item.get("games", 0) or 0) >= 5), None)

    if keep:
        actions.append(f"Keep playing {repertoire_context_title(keep)}; {keep.get('confidenceReason') or keep.get('confidence_reason')}")
    if problem_lines:
        actions.append(f"Study this problem line: {problem_lines[0]['summary']}")
    elif weak:
        actions.append(f"Review {repertoire_context_title(weak)} because it is your clearest lower-scoring repeated sample.")

    missing = coverage.get("missing") or []
    if missing:
        actions.append(f"Choose one plan for {missing[0]} because the current games do not show stable coverage there.")

    if coherence and coherence.get("status") in {"Fragmented", "Too random to train efficiently"}:
        actions.append(str(coherence.get("advice") or "Simplify the repertoire before adding new openings."))

    if band == "under_1000":
        actions.append("Use simple development plans and avoid adding theory-heavy openings until the sample is stable.")
    elif band == "1000_1400":
        actions.append("Pick practical openings with clear first plans; do not rotate systems after one or two games.")
    elif band == "1400_1800":
        actions.append("Build one structured White plan and one Black plan before adding sidelines.")
    elif band == "1800_plus":
        actions.append("Audit move-order details and opponent-specific branches before changing the repertoire.")
    else:
        actions.append("Play 5 more games in your main opening, then re-import to confirm the pattern.")

    deduped = []
    for action in actions:
        if action and action not in deduped:
            deduped.append(action)
    fallback_actions = [
        "Keep the current main opening sample together long enough to measure it.",
        "Review one repeated loss from your lowest-scoring opening before adding a new system.",
        "Play 5 more games, then re-import to confirm whether the pattern is stable.",
    ]
    for action in fallback_actions:
        if len(deduped) >= 3:
            break
        if action not in deduped:
            deduped.append(action)
    return deduped[:3]


def study_task(
    title: str,
    why: str,
    action: str,
    priority: str,
    opening: str = "",
    colour: str = "",
    source: str = "",
) -> Dict[str, str]:
    return {
        "title": title,
        "why": why,
        "whyItMatters": why,
        "why_it_matters": why,
        "recommendedAction": action,
        "recommended_action": action,
        "action": action,
        "priority": priority,
        "relatedOpening": opening,
        "related_opening": opening,
        "colour": colour,
        "color": colour,
        "source": source,
    }


def context_colour_label(context: str) -> str:
    key = str(context or "").lower()
    if key == "played_as_white" or key.startswith("white"):
        return "White"
    if key == "black_vs_e4":
        return "Black vs 1.e4"
    if key in {"black_vs_d4", "black_vs_d4_other", "black_vs_other"}:
        return "Black vs 1.d4 / 1.c4 / 1.Nf3"
    if key.startswith("black"):
        return "Black"
    return "Mixed"


def first_style_experiment(style_opening_match: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for section in (style_opening_match or {}).get("sections", []) or []:
        for item in section.get("items", []) or []:
            label = str(item.get("label") or item.get("recommendationType") or item.get("recommendation_type") or "").lower()
            verdict = str(item.get("verdict") or item.get("recommendationCategory") or "").lower()
            games = int(item.get("games", 0) or 0)
            if "experiment" in label or "experiment" in verdict or games < 3:
                return {**item, "sectionKey": section.get("key"), "sectionTitle": section.get("title")}
    return None


def fixability_priority_value(category: str) -> int:
    label = str(category or "").lower()
    if "easy" in label:
        return 0
    if "medium" in label:
        return 1
    if "hard" in label:
        return 2
    if "replace" in label:
        return 3
    return 4


def build_study_queue(
    best_openings: List[Dict[str, Any]],
    problem_lines: List[Dict[str, Any]],
    opening_phase_habits: List[Dict[str, Any]],
    coverage: Dict[str, Any],
    coherence: Optional[Dict[str, Any]] = None,
    style_opening_match: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, str]]:
    tasks: List[Dict[str, str]] = []
    opening_by_key = {
        normalise_opening_key(str(item.get("name") or item.get("opening") or "")): item
        for item in best_openings or []
    }

    if problem_lines:
        def line_priority(line_item: Dict[str, Any]) -> Tuple[int, int, float, int]:
            opening = opening_by_key.get(normalise_opening_key(str(line_item.get("opening") or line_item.get("name") or ""))) or {}
            return (
                fixability_priority_value(str(opening.get("fixabilityCategory") or opening.get("fixability_category") or "")),
                -int(opening.get("games", 0) or line_item.get("games", 0) or 0),
                -float(line_item.get("lossRate", 0) or 0),
                -int(line_item.get("losses", 0) or 0),
            )

        line = sorted(problem_lines, key=line_priority)[0]
        opening = str(line.get("opening") or line.get("name") or "this opening")
        move_line = str(line.get("line") or "the repeated early line")
        losses = int(line.get("losses", 0) or 0)
        games = int(line.get("games", 0) or 0)
        opening_row = opening_by_key.get(normalise_opening_key(opening), {})
        fixability = str(opening_row.get("fixabilityCategory") or opening_row.get("fixability_category") or "Medium fix")
        fixability_explanation = str(opening_row.get("fixabilityExplanation") or opening_row.get("fixability_explanation") or "")
        tasks.append(
            study_task(
                f"Fix your {opening} line",
                f"{fixability}: your results drop after {move_line}; this line produced {losses} loss{'' if losses == 1 else 'es'} in {games} repeated games.",
                "Review one simple setup for this line, then play 5 focused games and re-import.",
                "high" if fixability in {"Easy fix", "Medium fix"} else "medium",
                opening,
                context_colour_label(str(line.get("context") or "")),
                "weakest_repeated_line",
            )
        )
        if fixability_explanation:
            tasks[-1]["why"] = f"{tasks[-1]['why']} {fixability_explanation}"
            tasks[-1]["whyItMatters"] = tasks[-1]["why"]
            tasks[-1]["why_it_matters"] = tasks[-1]["why"]

    missing_rows = []
    for row in (coverage or {}).get("white", []) + (coverage or {}).get("black", []):
        if row.get("status") in {"No clear plan", "Too little data", "Needs work"}:
            missing_rows.append(row)
    if missing_rows:
        gap = sorted(missing_rows, key=lambda row: (row.get("status") == "Needs work", int(row.get("games", 0) or 0)))[0]
        label = str(gap.get("label") or "a repertoire gap")
        games = int(gap.get("games", 0) or 0)
        tasks.append(
            study_task(
                f"Choose a plan for {label}",
                f"The report marks {label} as {gap.get('status')}; only {games} imported game{'' if games == 1 else 's'} support the current plan.",
                "Pick one practical setup for this area and use it consistently for the next small sample.",
                "high" if gap.get("status") == "No clear plan" else "medium",
                str(gap.get("opening") or ""),
                "White" if str(gap.get("key") or "").startswith(("main_white", "vs_")) else "Black",
                "biggest_repertoire_gap",
            )
        )

    experiment = first_style_experiment(style_opening_match)
    if experiment:
        name = str(experiment.get("name") or "a style-fit opening")
        tasks.append(
            study_task(
                f"Test {name} as an experiment",
                str(experiment.get("whyItFits") or experiment.get("explanation") or f"{name} matches your style profile, but the sample is still low-confidence."),
                "Learn the starter plan, play 3 to 5 focused games, and keep it experimental until the sample grows.",
                "low",
                name,
                context_colour_label(str(experiment.get("sectionKey") or experiment.get("slot") or "")),
                "low_confidence_promising_opening",
            )
        )

    if opening_phase_habits:
        habit = sorted(
            opening_phase_habits,
            key=lambda item: (float(item.get("lossRate", 0) or 0), int(item.get("games", 0) or 0)),
            reverse=True,
        )[0]
        opening = str(habit.get("opening") or habit.get("name") or "your opening")
        tasks.append(
            study_task(
                f"Clean up {habit.get('label', 'your opening habit').lower()}",
                str(habit.get("summary") or f"This habit repeats in {opening} and is hurting your opening phase."),
                str(habit.get("advice") or "Play through the first 10 moves slowly and prioritise development, king safety, and one clear pawn break."),
                "high" if float(habit.get("lossRate", 0) or 0) >= 50 else "medium",
                opening,
                context_colour_label(str(habit.get("context") or "")),
                "most_harmful_opening_habit",
            )
        )

    messy_lane = None
    for row in (coherence or {}).get("rows", []) or (coherence or {}).get("lanes", []) or []:
        if row.get("status") in {"Fragmented", "Too random to train efficiently"} and int(row.get("totalGames", 0) or 0) > 0:
            messy_lane = row
            break
    if messy_lane:
        tasks.append(
            study_task(
                f"Simplify {messy_lane.get('label', 'one repertoire area')}",
                str(messy_lane.get("summary") or "This repertoire area is spread across too many unrelated openings."),
                str(messy_lane.get("advice") or "Choose one main system and one backup until your results stabilise."),
                "medium",
                ", ".join(messy_lane.get("topSystems", []) or messy_lane.get("top_systems", []) or []),
                str(messy_lane.get("label") or ""),
                "fragmented_repertoire_area",
            )
        )

    fallback_opening = next(
        (
            item for item in best_openings or []
            if is_clean_repertoire_context(item) and not is_unknown_opening_name(item.get("name", ""))
        ),
        None,
    )
    if len(tasks) < 3 and fallback_opening:
        opening = str(fallback_opening.get("name") or "your main opening")
        tasks.append(
            study_task(
                f"Build a reliable {opening} sample",
                f"{opening} is the clearest repeated opening in the report, but the next decision needs more focused games.",
                "Play 5 games with the same early plan, then re-import to confirm the pattern.",
                "medium",
                opening,
                context_colour_label(str(fallback_opening.get("context") or "")),
                "fallback_repeated_opening",
            )
        )

    fallback_tasks = [
        study_task(
            "Review one repeated opening loss",
            "The report needs a concrete review target before changing the repertoire.",
            "Pick the most recent opening loss, write down where development or king safety first went wrong, then play one focused rematch.",
            "medium",
            "",
            "Mixed",
            "fallback_review",
        ),
        study_task(
            "Collect a stable opening sample",
            "OpeningFit needs repeated games in the same structures before making stronger judgments.",
            "Play 5 games using one White plan and one Black plan, then re-import.",
            "low",
            "",
            "Mixed",
            "fallback_sample",
        ),
    ]
    for task in fallback_tasks:
        if len(tasks) >= 3:
            break
        tasks.append(task)

    deduped: List[Dict[str, str]] = []
    seen_titles = set()
    for task in tasks:
        title = task["title"].lower()
        if title in seen_titles:
            continue
        seen_titles.add(title)
        deduped.append(task)
        if len(deduped) >= 5:
            break
    priority_rank = {"high": 0, "medium": 1, "low": 2}
    source_rank = {"weakest_repeated_line": 0, "most_harmful_opening_habit": 1, "biggest_repertoire_gap": 2}
    deduped.sort(key=lambda task: (priority_rank.get(task.get("priority", "medium"), 1), source_rank.get(task.get("source", ""), 4)))
    return deduped[:5]


def roi_category(score: int, games: int) -> str:
    if games < 3:
        return "Ignore for now"
    if score >= 72:
        return "High ROI"
    if score >= 48:
        return "Medium ROI"
    if score >= 25:
        return "Low ROI"
    return "Ignore for now"


def build_opening_roi(
    best_openings: List[Dict[str, Any]],
    problem_lines: List[Dict[str, Any]],
    opening_phase_habits: List[Dict[str, Any]],
    coverage: Dict[str, Any],
    total_games: int,
) -> Dict[str, Any]:
    problem_by_opening = defaultdict(list)
    for line in problem_lines or []:
        problem_by_opening[normalise_opening_key(str(line.get("opening") or line.get("name") or ""))].append(line)

    habit_by_opening = defaultdict(list)
    for habit in opening_phase_habits or []:
        habit_by_opening[normalise_opening_key(str(habit.get("opening") or habit.get("name") or ""))].append(habit)

    gap_openings = {
        normalise_opening_key(str(row.get("opening") or "")): row
        for row in (coverage or {}).get("white", []) + (coverage or {}).get("black", [])
        if row.get("opening") and row.get("status") in {"Needs work", "No clear plan", "Too little data"}
    }

    items = []
    total = max(1, int(total_games or 0))
    for opening in best_openings or []:
        name = str(opening.get("name") or "")
        if not name or is_unknown_opening_name(name):
            continue
        games = int(opening.get("games", 0) or 0)
        if games <= 0:
            continue
        key = normalise_opening_key(name)
        score_pct = float(opening.get("openingAdjustedScore", opening.get("winRate", opening.get("win_rate", 50))) or 50)
        sample_pct = round((games / total) * 100, 1)
        frequency_score = min(35, round(sample_pct * 1.5))
        weakness_score = max(0, min(25, round((55 - score_pct) * 0.8)))
        sample_score = 0 if games < 3 else min(15, games)
        fixable_score = 0
        reasons = []
        if problem_by_opening.get(key):
            fixable_score += 18
            reasons.append("repeated problem line")
        if habit_by_opening.get(key):
            fixable_score += 10
            reasons.append("repeated opening habit")
        if str(opening.get("moveOrderStatus") or "").lower() in {"unstable", "some variation"}:
            fixable_score += 8
            reasons.append("move-order inconsistency")
        if str(opening.get("planClarityStatus") or "").lower() == "unclear plan":
            fixable_score += 12
            reasons.append("unclear repeatable plan")
        coverage_score = 0
        if key in gap_openings:
            coverage_score = 12
            reasons.append("repertoire coverage gap")
        elif is_clean_repertoire_context(opening):
            coverage_score = 6
            reasons.append("main repertoire area")
        if games < 3:
            score = min(20, frequency_score + weakness_score)
            reasons = ["sample too small"]
        else:
            score = min(100, frequency_score + weakness_score + sample_score + min(25, fixable_score) + coverage_score)

        category = roi_category(score, games)
        if category == "High ROI":
            advice = f"Study {name} first: it appears often enough and has a repeated, fixable issue."
        elif category == "Medium ROI":
            advice = f"Review {name} after the highest-impact issue; the sample is useful but not the only priority."
        elif category == "Low ROI":
            advice = f"Keep {name} on the watch list, but do not let it crowd out higher-impact openings."
        else:
            advice = f"Do not spend study time on {name} yet; the sample is too small or low impact."

        items.append(
            {
                "name": name,
                "opening": name,
                "context": opening.get("context"),
                "contextLabel": opening.get("contextLabel") or context_label(str(opening.get("context") or "")),
                "games": games,
                "samplePercentage": sample_pct,
                "sample_percentage": sample_pct,
                "score": score,
                "roiScore": score,
                "roi_score": score,
                "category": category,
                "roiCategory": category,
                "roi_category": category,
                "reasons": reasons[:4],
                "advice": advice,
                "summary": (
                    f"{category}: {name}. It appears in {sample_pct}% of analysed games"
                    f"{' and has ' + ', '.join(reasons[:2]) if reasons else ''}."
                ),
            }
        )

    items.sort(key=lambda item: (item["category"] != "Ignore for now", item["score"], item["games"]), reverse=True)
    top = [item for item in items if item["category"] in {"High ROI", "Medium ROI"}][:3]
    if not top:
        top = items[:3]
    return {
        "summary": "Opening ROI prioritises the openings most likely to reward study time.",
        "topItems": top,
        "top_items": top,
        "items": items,
    }


def build_do_not_study_yet(
    best_openings: List[Dict[str, Any]],
    opening_roi: Dict[str, Any],
    coverage: Dict[str, Any],
    rating: Optional[int] = None,
) -> Dict[str, Any]:
    items = []
    seen = set()
    missing = coverage.get("missing") or []
    bigger_gap = missing[0] if missing else ""

    def add_item(key: str, title: str, why: str, redirect: str, opening: str = "", reason: str = "") -> None:
        if key in seen or len(items) >= 4:
            return
        seen.add(key)
        items.append(
            {
                "title": title,
                "why": why,
                "whyItMatters": why,
                "why_it_matters": why,
                "redirect": redirect,
                "recommendedAlternative": redirect,
                "recommended_alternative": redirect,
                "opening": opening,
                "reason": reason,
            }
        )

    for roi_item in (opening_roi or {}).get("items", []):
        name = str(roi_item.get("name") or roi_item.get("opening") or "")
        games = int(roi_item.get("games", 0) or 0)
        category = str(roi_item.get("category") or roi_item.get("roiCategory") or "")
        sample_pct = float(roi_item.get("samplePercentage", roi_item.get("sample_percentage", 0)) or 0)
        if category == "Ignore for now" or games < 3:
            add_item(
                f"sample-{normalise_opening_key(name)}",
                f"Do not study {name} yet",
                f"Only {games} game{'' if games == 1 else 's'} found, so the sample is too small to spend study time here.",
                f"Put that time into {bigger_gap} first." if bigger_gap else "Build a larger sample in your main repertoire first.",
                name,
                "low_sample",
            )
        elif category == "Low ROI" or sample_pct < 5:
            add_item(
                f"rare-{normalise_opening_key(name)}",
                f"Do not study rare {name} sidelines yet",
                f"{name} appears in only {sample_pct}% of analysed games, so it is unlikely to move your results quickly.",
                f"Prioritise {bigger_gap} instead." if bigger_gap else "Prioritise the highest-ROI opening first.",
                name,
                "rare_low_impact",
            )

    for opening in best_openings or []:
        name = str(opening.get("name") or "")
        if not name or is_unknown_opening_name(name):
            continue
        games = int(opening.get("games", 0) or 0)
        verdict = str(opening.get("verdict") or "").lower()
        risk = opening.get("openingRiskProfile") or opening.get("opening_risk_profile") or {}
        theory = str(risk.get("theoryLoad") or risk.get("theory_load") or "medium")
        penalty = int(opening.get("practicalDifficultyPenalty", opening.get("practical_difficulty_penalty", 0)) or 0)
        if games <= 2 and verdict in {"replace", "avoid", "fix"}:
            add_item(
                f"do-not-replace-{normalise_opening_key(name)}",
                f"Do not replace {name} based on this sample",
                f"{name} has only {games} imported game{'' if games == 1 else 's'}, so bad results may be noise.",
                f"Study {bigger_gap} first." if bigger_gap else "Collect more games before making a repertoire decision.",
                name,
                "do_not_overreact",
            )
        if theory == "high" and penalty >= 10 and games < 15:
            add_item(
                f"theory-{normalise_opening_key(name)}",
                f"Do not make {name} a main study project yet",
                f"{name} is theory-heavy for your current rating band and does not have enough strong sample support yet.",
                f"Use a clearer plan for {bigger_gap} first." if bigger_gap else "Focus on a lower-theory main system first.",
                name,
                "theory_heavy",
            )

    if bigger_gap:
        add_item(
            "rare-sidelines-general",
            "Do not study rare sidelines yet",
            f"Your main improvement area is {bigger_gap}, which will affect more games than rare sidelines.",
            f"Choose one practical plan for {bigger_gap}.",
            "",
            "bigger_gap_exists",
        )

    return {
        "summary": "These are the openings or areas OpeningFit does not think deserve study time yet.",
        "items": items[:4],
        "enabled": bool(items),
    }


def style_profile_label(style_profile: Dict[str, Any]) -> str:
    if style_profile.get("primaryStyle"):
        return str(style_profile["primaryStyle"])
    if style_profile.get("label"):
        return str(style_profile["label"])
    labels = [str(label) for label in style_profile.get("labels", []) if label]
    if labels:
        return " ".join(labels[:2])
    return "practical"


def repertoire_anchor(best_openings: List[Dict[str, Any]], context: str, min_games: int = 3) -> Optional[Dict[str, Any]]:
    item = best_by_context(best_openings, context)
    if item and int(item.get("games", 0) or 0) >= min_games:
        return item
    return None


def build_repertoire_identity_summary(
    best_openings: List[Dict[str, Any]],
    style_profile: Dict[str, Any],
    coherence: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    white = repertoire_anchor(best_openings, "played_as_white")
    black_e4 = repertoire_anchor(best_openings, "black_vs_e4")
    black_d4 = repertoire_anchor(best_openings, "black_vs_d4") or repertoire_anchor(best_openings, "black_vs_d4_other") or repertoire_anchor(best_openings, "black_vs_other")
    coherence_status = str((coherence or {}).get("status") or "Unknown")
    coherence_score = int((coherence or {}).get("score", 0) or 0)
    style = style_profile_label(style_profile)
    anchors = [item for item in [white, black_e4, black_d4] if item]

    if len(anchors) < 2 or coherence_status in {"Fragmented", "Too random to train efficiently"} and coherence_score < 45:
        summary = "You currently have no clear repertoire identity because your openings are fragmented."
        confidence = "Low confidence"
        identity = "No clear repertoire identity yet"
    else:
        names = [item["name"] for item in anchors[:3]]
        identity = " + ".join(names)
        style_article = "an" if style[:1].lower() in {"a", "e", "i", "o", "u"} else "a"
        summary = f"You are a {identity} player with {style_article} {style.lower()} style."
        confidence = "Medium confidence" if len(anchors) == 2 else "High confidence"

    evidence = []
    if white:
        evidence.append(f"Main White sample: {white['name']} ({white.get('games', 0)} games).")
    if black_e4:
        evidence.append(f"Black vs 1.e4 sample: {black_e4['name']} ({black_e4.get('games', 0)} games).")
    if black_d4:
        evidence.append(f"Black vs 1.d4/flank sample: {black_d4['name']} ({black_d4.get('games', 0)} games).")
    evidence.append(f"Repertoire coherence: {coherence_status} ({coherence_score}/100).")

    return {
        "identity": identity,
        "summary": summary,
        "styleLabel": style,
        "style_label": style,
        "confidence": confidence,
        "whiteOpening": white.get("name") if white else "",
        "white_opening": white.get("name") if white else "",
        "blackVsE4": black_e4.get("name") if black_e4 else "",
        "black_vs_e4": black_e4.get("name") if black_e4 else "",
        "blackVsD4": black_d4.get("name") if black_d4 else "",
        "black_vs_d4": black_d4.get("name") if black_d4 else "",
        "coherenceStatus": coherence_status,
        "coherence_status": coherence_status,
        "evidence": evidence[:4],
    }


def build_plan_clarity_report(best_openings: List[Dict[str, Any]]) -> Dict[str, Any]:
    items = []
    for opening in best_openings or []:
        name = str(opening.get("name") or "")
        if not name or is_unknown_opening_name(name):
            continue
        games = int(opening.get("games", 0) or 0)
        if games <= 0:
            continue
        status = str(opening.get("planClarityStatus") or opening.get("plan_clarity_status") or "Too little data")
        items.append(
            {
                "name": name,
                "opening": name,
                "context": opening.get("context"),
                "contextLabel": opening.get("contextLabel") or context_label(str(opening.get("context") or "")),
                "games": games,
                "status": status,
                "score": opening.get("planClarityScore", opening.get("plan_clarity_score", 0)),
                "note": opening.get("planClarityNote") or opening.get("plan_clarity_note"),
                "bestSequence": opening.get("planClarityBestSequence") or opening.get("plan_clarity_best_sequence"),
                "best_sequence": opening.get("planClarityBestSequence") or opening.get("plan_clarity_best_sequence"),
            }
        )

    priority = {"Unclear plan": 0, "Some plan": 1, "Clear plan": 2, "Too little data": 3}
    items.sort(key=lambda item: (priority.get(item["status"], 4), -int(item.get("games", 0) or 0)))
    summary = "Plan clarity checks whether your games repeat a usable setup after the opening name appears."
    return {
        "summary": summary,
        "items": items[:6],
        "clearCount": len([item for item in items if item["status"] == "Clear plan"]),
        "clear_count": len([item for item in items if item["status"] == "Clear plan"]),
        "unclearCount": len([item for item in items if item["status"] == "Unclear plan"]),
        "unclear_count": len([item for item in items if item["status"] == "Unclear plan"]),
    }


def opening_score_pct(opening: Optional[Dict[str, Any]], fallback: float = 50) -> float:
    if not opening:
        return fallback
    value = opening.get("openingAdjustedScore", opening.get("winRate", opening.get("win_rate", fallback)))
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def main_leak_confidence_label(score: int) -> str:
    if score >= 75:
        return "High confidence"
    if score >= 58:
        return "Medium confidence"
    if score >= 40:
        return "Low confidence"
    return "Too little data"


def build_main_opening_leak(
    best_openings: List[Dict[str, Any]],
    coverage: Dict[str, Any],
    problem_lines: List[Dict[str, Any]],
    opening_phase_habits: List[Dict[str, Any]],
    coherence: Optional[Dict[str, Any]],
    plan_clarity_report: Optional[Dict[str, Any]],
    opening_roi: Optional[Dict[str, Any]],
    total_games: int,
    rating: Optional[int] = None,
) -> Dict[str, Any]:
    repeated = [
        item for item in best_openings or []
        if is_clean_repertoire_context(item)
        and not is_unknown_opening_name(item.get("name", ""))
        and int(item.get("games", 0) or 0) >= 3
    ]
    if total_games < 10 or not repeated:
        return {
            "available": False,
            "hasLeak": False,
            "has_leak": False,
            "type": "too_little_data",
            "title": "Main opening leak not clear yet",
            "summary": "OpeningFit needs more repeated games before naming one main opening leak.",
            "suggestedAction": "Play 5 more games in your main White and Black systems, then re-import.",
            "suggested_action": "Play 5 more games in your main White and Black systems, then re-import.",
            "candidates": [],
        }

    candidates = []

    def add_candidate(
        leak_type: str,
        title: str,
        summary: str,
        action: str,
        frequency: int,
        severity: int,
        confidence: int,
        fixability: int,
        rating_relevance: int,
        opening: str = "",
        evidence: Optional[List[str]] = None,
    ) -> None:
        score = round(
            frequency * 0.24
            + severity * 0.30
            + confidence * 0.18
            + fixability * 0.18
            + rating_relevance * 0.10
        )
        candidates.append(
            {
                "type": leak_type,
                "title": title,
                "summary": summary,
                "suggestedAction": action,
                "suggested_action": action,
                "opening": opening,
                "score": score,
                "confidence": main_leak_confidence_label(confidence),
                "factors": {
                    "frequency": frequency,
                    "severity": severity,
                    "sampleConfidence": confidence,
                    "sample_confidence": confidence,
                    "fixability": fixability,
                    "ratingRelevance": rating_relevance,
                    "rating_relevance": rating_relevance,
                },
                "evidence": [str(item).strip() for item in evidence or [] if str(item).strip()][:4],
            }
        )

    total_opening_games = max(1, sum(int(item.get("games", 0) or 0) for item in repeated))
    black_d4 = best_by_context(best_openings, "black_vs_d4") or best_by_context(best_openings, "black_vs_d4_other") or best_by_context(best_openings, "black_vs_other")
    black_d4_row = next((row for row in (coverage or {}).get("black", []) if row.get("key") == "black_vs_d4"), None)
    if black_d4_row and black_d4_row.get("status") in {"No clear plan", "Too little data", "Needs work"}:
        games = int((black_d4 or {}).get("games", black_d4_row.get("games", 0)) or 0)
        add_candidate(
            "black_vs_d4_gap",
            "Main opening leak: Black vs 1.d4",
            "Your main opening leak is Black vs 1.d4. You do not currently have a stable system there.",
            "Choose one simple Black setup against 1.d4 and use it for the next 5 games.",
            frequency=min(100, 45 + games * 3),
            severity=88 if black_d4_row.get("status") == "No clear plan" else 72,
            confidence=75 if total_games >= 20 else 55,
            fixability=88,
            rating_relevance=82 if rating_band(rating) in {"under_1000", "1000_1400", "1400_1800", "unknown"} else 65,
            opening=str((black_d4 or {}).get("name") or ""),
            evidence=[f"Coverage status: {black_d4_row.get('status')}.", "A stable Black answer to 1.d4 affects a core repertoire area."],
        )

    black_e4 = best_by_context(best_openings, "black_vs_e4")
    if black_e4 and int(black_e4.get("games", 0) or 0) >= 5 and opening_score_pct(black_e4) < 45:
        games = int(black_e4.get("games", 0) or 0)
        score = opening_score_pct(black_e4)
        add_candidate(
            "black_vs_e4_poor_results",
            f"Main opening leak: {black_e4.get('name')} vs 1.e4",
            f"Your main Black defence vs 1.e4 is underperforming at {round(score, 1)}%.",
            f"Review your last 3 {black_e4.get('name')} games and fix the first repeated branch before changing openings.",
            frequency=min(100, round((games / total_opening_games) * 100)),
            severity=min(100, round(80 + max(0, 45 - score))),
            confidence=confidence_numeric_score(str(black_e4.get("confidence") or "")),
            fixability=76,
            rating_relevance=80,
            opening=str(black_e4.get("name") or ""),
            evidence=[f"{games} games in this Black vs 1.e4 sample.", f"Score: {round(score, 1)}%."],
        )

    white_lane = next((row for row in (coherence or {}).get("rows", []) or [] if row.get("key") == "white"), None)
    if white_lane and white_lane.get("status") in {"Fragmented", "Too random to train efficiently"}:
        add_candidate(
            "white_fragmented",
            "Main opening leak: fragmented White repertoire",
            "Your White repertoire is too fragmented, so it is hard to build one repeatable plan.",
            "Pick one main White opening and avoid adding new White systems until the sample stabilises.",
            frequency=min(100, int(white_lane.get("totalGames", 0) or 0) * 4),
            severity=78 if white_lane.get("status") == "Fragmented" else 88,
            confidence=70 if int(white_lane.get("totalGames", 0) or 0) >= 8 else 45,
            fixability=82,
            rating_relevance=86,
            evidence=[str(white_lane.get("summary") or ""), str(white_lane.get("advice") or "")],
        )

    if problem_lines:
        line = problem_lines[0]
        games = int(line.get("games", 0) or 0)
        loss_rate = float(line.get("lossRate", 0) or 0)
        opening = str(line.get("opening") or line.get("name") or "this opening")
        add_candidate(
            "repeated_early_losses",
            f"Main opening leak: repeated early losses in {opening}",
            str(line.get("summary") or f"{opening} has a repeated early problem line."),
            f"Study the repeated {opening} line first, then play 5 focused games from the same setup.",
            frequency=min(100, games * 16),
            severity=min(100, round(loss_rate + 25)),
            confidence=80 if games >= 4 else 58,
            fixability=90,
            rating_relevance=82,
            opening=opening,
            evidence=list(line.get("evidence") or [])[:3],
        )

    clarity_items = (plan_clarity_report or {}).get("items", []) or []
    most_common = max(repeated, key=lambda item: int(item.get("games", 0) or 0), default=None)
    if most_common:
        clarity = next((item for item in clarity_items if normalise_opening_key(item.get("name", "")) == normalise_opening_key(most_common.get("name", ""))), None)
        status = str((clarity or {}).get("status") or most_common.get("planClarityStatus") or "")
        if status == "Unclear plan":
            games = int(most_common.get("games", 0) or 0)
            add_candidate(
                "low_plan_clarity_main_opening",
                f"Main opening leak: unclear plan in {most_common.get('name')}",
                f"{most_common.get('name')} is your most common opening, but the follow-up plan is unclear.",
                f"Write one move-10 plan for {most_common.get('name')} and use the same setup for the next 5 games.",
                frequency=min(100, round((games / total_opening_games) * 100)),
                severity=78,
                confidence=75 if games >= 5 else 50,
                fixability=88,
                rating_relevance=84,
                opening=str(most_common.get("name") or ""),
                evidence=[str((clarity or {}).get("note") or most_common.get("planClarityNote") or "")],
            )

    messy = [
        row for row in (coherence or {}).get("rows", []) or []
        if row.get("status") in {"Fragmented", "Too random to train efficiently"}
        and int(row.get("lowSampleOpeningCount", row.get("low_sample_opening_count", 0)) or 0) >= 2
    ]
    if messy:
        row = sorted(messy, key=lambda value: int(value.get("lowSampleOpeningCount", value.get("low_sample_opening_count", 0)) or 0), reverse=True)[0]
        low_count = int(row.get("lowSampleOpeningCount", row.get("low_sample_opening_count", 0)) or 0)
        add_candidate(
            "too_many_random_openings",
            f"Main opening leak: too many random openings in {row.get('label')}",
            f"{row.get('label')} has {low_count} low-sample openings, which makes training inefficient.",
            f"Simplify {str(row.get('label') or 'this repertoire area').lower()} to one main system and one backup.",
            frequency=min(100, int(row.get("totalGames", 0) or 0) * 4),
            severity=70 + min(20, low_count * 4),
            confidence=70,
            fixability=84,
            rating_relevance=88,
            evidence=[str(row.get("summary") or ""), str(row.get("advice") or "")],
        )

    if opening_phase_habits:
        habit = sorted(opening_phase_habits, key=lambda item: (float(item.get("lossRate", 0) or 0), int(item.get("games", 0) or 0)), reverse=True)[0]
        if habit.get("issue") in {"castled_late_or_never", "minor_pieces_undeveloped", "too_many_pawn_moves", "king_stuck_in_centre"}:
            games = int(habit.get("games", 0) or 0)
            add_candidate(
                "development_castling_habit",
                f"Main opening leak: {str(habit.get('label') or 'opening habit').lower()}",
                str(habit.get("summary") or "A repeated development or castling habit is hurting your openings."),
                str(habit.get("advice") or "Prioritise development and king safety in the first 10 moves."),
                frequency=min(100, games * 16),
                severity=min(100, round(float(habit.get("lossRate", 0) or 0) + 20)),
                confidence=70 if games >= 3 else 48,
                fixability=92,
                rating_relevance=90 if rating_band(rating) in {"under_1000", "1000_1400", "unknown"} else 72,
                opening=str(habit.get("opening") or habit.get("name") or ""),
                evidence=list(habit.get("evidence") or [])[:3],
            )

    candidates.sort(key=lambda item: item["score"], reverse=True)
    if not candidates or candidates[0]["score"] < 52:
        return {
            "available": False,
            "hasLeak": False,
            "has_leak": False,
            "type": "too_weak_signal",
            "title": "Main opening leak not clear yet",
            "summary": "No single opening leak is strong enough to isolate from the current data.",
            "suggestedAction": "Keep collecting games in the same core repertoire before changing study priorities.",
            "suggested_action": "Keep collecting games in the same core repertoire before changing study priorities.",
            "candidates": candidates[:4],
        }

    winner = candidates[0]
    return {
        "available": True,
        "hasLeak": True,
        "has_leak": True,
        **winner,
        "candidates": candidates[:4],
    }


def connect_main_leak_to_training_actions(main_opening_leak: Dict[str, Any], actions: List[str]) -> List[str]:
    cleaned = [str(action).strip() for action in actions or [] if str(action).strip()]
    if not main_opening_leak.get("hasLeak") and not main_opening_leak.get("available"):
        return cleaned[:3]

    leak_action = str(
        main_opening_leak.get("suggestedAction")
        or main_opening_leak.get("suggested_action")
        or ""
    ).strip()
    if not leak_action:
        return cleaned[:3]

    deduped = [leak_action]
    for action in cleaned:
        if action not in deduped:
            deduped.append(action)
        if len(deduped) >= 3:
            break
    return deduped[:3]


def simple_gap_filler(slot: str, rating: Optional[int], style_profile: Dict[str, Any]) -> Dict[str, str]:
    band = rating_band(rating)
    style_text = " ".join(style_profile.get("labels", []) + [style_profile.get("primaryStyle", ""), style_profile.get("summary", "")]).lower()
    solid = "solid" in style_text or "positional" in style_text

    if slot == "main_white":
        name = "London System" if solid or band in {"under_1000", "1000_1400", "unknown"} else "Italian Game"
        return {"name": name, "label": "gap filler", "action": f"Add {name} as a simple main White plan until your White sample stabilises."}
    if slot == "white_vs_e5":
        return {"name": "Italian/Vienna-style development", "label": "gap filler", "action": "Use a simple e4-e5 development setup: develop knights and bishops, castle, then choose the central break."}
    if slot == "white_vs_sicilian":
        return {"name": "Simple Anti-Sicilian setup", "label": "gap filler", "action": "Use one quiet Anti-Sicilian setup rather than learning several sharp Sicilian sidelines."}
    if slot == "white_vs_french":
        return {"name": "Simple French Defence plan", "label": "gap filler", "action": "Use one practical plan against the French and focus on development before pawn breaks."}
    if slot == "white_vs_caro":
        return {"name": "Simple Caro-Kann plan", "label": "gap filler", "action": "Use one practical plan against the Caro-Kann and avoid switching lines after one result."}
    if slot == "black_vs_e4":
        name = "Caro-Kann Defence" if solid or band in {"under_1000", "1000_1400", "unknown"} else "e5 systems"
        return {"name": name, "label": "gap filler", "action": f"Add {name} as your simple answer to 1.e4."}
    if slot == "black_vs_d4":
        return {"name": "Queen's Gambit Declined setup", "label": "gap filler", "action": "Add a simple QGD-style setup because your data does not show a stable plan against 1.d4."}
    return {"name": "QGD/Slav-style setup", "label": "gap filler", "action": "Use one Queen's Gambit Declined or Slav-style setup against 1.c4 and 1.Nf3 until you have enough games to specialise."}


def repertoire_plan_item(
    slot: str,
    title: str,
    existing: Optional[Dict[str, Any]],
    rating: Optional[int],
    style_profile: Dict[str, Any],
    fallback_slot: str,
) -> Dict[str, Any]:
    if existing and int(existing.get("games", 0) or 0) >= 5 and str(existing.get("verdict", "")).lower() in {"keep", "fix"}:
        verdict = str(existing.get("verdict") or "Keep")
        action = (
            f"Keep {existing['name']} here."
            if verdict.lower() == "keep"
            else f"Keep {existing['name']}, but fix the repeated issues before adding alternatives."
        )
        return {
            "slot": slot,
            "title": title,
            "opening": existing["name"],
            "label": "existing repertoire",
            "action": action,
            "confidence": existing.get("confidence", "Low confidence"),
            "games": existing.get("games", 0),
        }

    filler = simple_gap_filler(fallback_slot, rating, style_profile)
    return {
        "slot": slot,
        "title": title,
        "opening": filler["name"],
        "label": filler["label"],
        "action": filler["action"],
        "confidence": "New suggestion",
        "games": 0,
    }


def build_recommended_repertoire_plan(
    best_openings: List[Dict[str, Any]],
    coverage: Dict[str, Any],
    style_profile: Dict[str, Any],
    rating: Optional[int] = None,
    style_opening_match: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    white = repertoire_anchor(best_openings, "played_as_white", min_games=5)
    black_e4 = repertoire_anchor(best_openings, "black_vs_e4", min_games=5)
    black_d4 = repertoire_anchor(best_openings, "black_vs_d4", min_games=5)
    black_other = repertoire_anchor(best_openings, "black_vs_other", min_games=5) or repertoire_anchor(best_openings, "black_vs_d4_other", min_games=5)

    items = [
        repertoire_plan_item("main_white", "Main White opening", white, rating, style_profile, "main_white"),
        repertoire_plan_item("white_vs_e5", "White plan vs ...e5", white if white and any(token in white["name"].lower() for token in ["vienna", "italian", "scotch", "ruy"]) else None, rating, style_profile, "white_vs_e5"),
        repertoire_plan_item("white_vs_sicilian", "White plan vs Sicilian", None, rating, style_profile, "white_vs_sicilian"),
        repertoire_plan_item("white_vs_french", "White plan vs French", None, rating, style_profile, "white_vs_french"),
        repertoire_plan_item("white_vs_caro", "White plan vs Caro-Kann", None, rating, style_profile, "white_vs_caro"),
        repertoire_plan_item("black_vs_e4", "Black plan vs 1.e4", black_e4, rating, style_profile, "black_vs_e4"),
        repertoire_plan_item("black_vs_d4", "Black plan vs 1.d4", black_d4, rating, style_profile, "black_vs_d4"),
    ]

    if black_other or "Black vs 1.c4 / 1.Nf3" in (coverage.get("missing") or []):
        items.append(repertoire_plan_item("black_vs_c4_nf3", "Black plan vs 1.c4 / 1.Nf3", black_other, rating, style_profile, "black_vs_c4_nf3"))

    experiment = first_style_experiment(style_opening_match)
    if experiment:
        items.append(
            {
                "slot": "experimental_option",
                "title": "Experimental option",
                "opening": experiment.get("name"),
                "label": "experimental",
                "action": f"Treat {experiment.get('name')} as an experiment only; play 3 to 5 focused games before judging it.",
                "confidence": experiment.get("confidence", "Low confidence"),
                "games": experiment.get("games", 0),
            }
        )

    return {
        "summary": "One coherent repertoire plan based on your current data and rating band.",
        "items": items,
        "white": [item for item in items if item["slot"].startswith("white") or item["slot"] == "main_white"],
        "black": [item for item in items if item["slot"].startswith("black")],
        "experimental": [item for item in items if item["slot"] == "experimental_option"],
    }


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
    risk_profile = opening_risk_profile(name)
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
    risk_note = opening_practical_note(name, risk_profile, None, {"games": 0})

    return {
        "name": name,
        "role": library.get("role", "general"),
        "label": "Style-Based Recommendation",
        "recommendationType": "style_based",
        "recommendation_type": "style_based",
        "confidence": confidence,
        "confidenceLevel": confidence,
        "confidence_level": confidence,
        "whyItFits": f"{name} fits your current {label_text.lower()} profile because it gives you a clearer opening plan without depending on a large existing repertoire sample. {risk_note}",
        "why_it_fits": f"{name} fits your current {label_text.lower()} profile because it gives you a clearer opening plan without depending on a large existing repertoire sample. {risk_note}",
        "openingRiskProfile": risk_profile,
        "opening_risk_profile": risk_profile,
        "practicalDifficultyNote": risk_note,
        "practical_difficulty_note": risk_note,
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
        elif top["verdict"] in {"Fix", "Improve"}:
            plan.append(f"Keep {top_title} in your pool, but fix the repeated problem lines before expanding it.")
        elif top["verdict"] in {"Replace", "Avoid"}:
            plan.append(f"Review {top_title} before using it again as a main repertoire choice.")
        elif top["verdict"] == "Experiment":
            plan.append(f"Treat {top_title} as an experiment until it has enough games for a firm verdict.")

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
        if top.get("fixabilityCategory") and str(top.get("fixabilityCategory")) != "Easy fix":
            recommendations.append(
                str(top.get("fixabilityExplanation") or "OpeningFit also checked whether this problem looks fixable or replaceable.")
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
        pgn = game.get("pgn", "")
        moves = clean_moves_from_pgn(pgn)
        move_count = move_count_from_moves(moves)
        opening = guess_opening_from_pgn(pgn)
        colour = colour_for_user(game, username)
        result = result_for_user(game, username)
        loss_timing = classify_loss_timing(result, moves=moves)
        first_white_move = extract_first_white_move_from_text(pgn)
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
            add_move_order_to_stats(stats, moves)
            if colour in {"white", "black"}:
                stats[colour] += 1
            stats[repertoire_context] += 1

            if result == "win":
                stats["wins"] += 1
            elif result == "draw":
                stats["draws"] += 1
            elif result == "loss":
                stats["losses"] += 1
                add_loss_timing_to_stats(stats, loss_timing)
            add_plan_structure_to_stats(stats, moves, result)

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
                "pgn": pgn,
                "moves": moves,
                "move_count": move_count,
                "moveCount": move_count,
                "loss_timing": loss_timing,
                "lossTiming": loss_timing,
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
                "move_count": move_count,
                "moveCount": move_count,
                "loss_timing": loss_timing,
                "lossTiming": loss_timing,
            }
        )

    top_openings = []
    total_opening_games = sum(int(stats.get("games", 0) or 0) for stats in opening_results.values())

    for opening, _count in opening_counter.most_common(10):
        stats = opening_results[opening]
        games = stats["games"]
        win_rate = round((stats["wins"] / games) * 100, 1) if games else 0
        explanation = opening_explanation(opening)
        item = {
            "name": opening,
            "games": games,
            "wins": stats["wins"],
            "draws": stats["draws"],
            "losses": stats["losses"],
            "opening_losses": int(stats.get("opening_losses", 0) or 0),
            "middlegame_losses": int(stats.get("middlegame_losses", 0) or 0),
            "late_losses": int(stats.get("late_losses", 0) or 0),
            "unknown_losses": int(stats.get("unknown_losses", 0) or 0),
                "move_orders_4": dict(stats.get("move_orders_4", {}) or {}),
                "move_orders_6": dict(stats.get("move_orders_6", {}) or {}),
                "move_orders_8": dict(stats.get("move_orders_8", {}) or {}),
                "move_orders_10": dict(stats.get("move_orders_10", {}) or {}),
                "plan_structures_6": dict(stats.get("plan_structures_6", {}) or {}),
                "plan_structures_8": dict(stats.get("plan_structures_8", {}) or {}),
                "plan_structures_10": dict(stats.get("plan_structures_10", {}) or {}),
            "win_rate": win_rate,
            "winRate": win_rate,
            "colour": dominant_opening_colour(stats),
            "color": dominant_opening_colour(stats),
            "context": dominant_opening_context(stats),
            "contextLabel": context_label(dominant_opening_context(stats)),
            "repertoireContext": dominant_opening_context(stats),
            **explanation,
        }
        item.update(loss_timing_fields(item))
        item.update(move_order_consistency_fields(item))
        item.update(plan_clarity_fields(item))
        item.update(opening_confidence_fields(item, total_opening_games))
        item.update(balanced_opening_fit_score(item))
        item["evidence"] = opening_evidence_bullets(item)
        item["evidenceBullets"] = item["evidence"]
        top_openings.append(item)

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
    best_openings = sort_openings_for_recommendation(apply_opening_risk_profiles(best_openings, None))
    top_openings = sort_openings_for_recommendation(apply_opening_risk_profiles(top_openings, None))
    opening_recommendations = build_colour_aware_recommendations(context_opening_results, rating=None)
    problem_lines = build_problem_lines(recent_games)
    engine_opening_validation = validate_problem_lines_with_stockfish(problem_lines)
    best_openings = sort_openings_for_recommendation(apply_opening_fixability_scores(best_openings, problem_lines, None))
    top_openings = sort_openings_for_recommendation(apply_opening_fixability_scores(top_openings, problem_lines, None))
    import_quality = build_game_import_quality(recent_games, skipped_reason_counts, len(all_games))
    best_openings = sort_openings_for_recommendation(cap_confidence_for_import_quality(best_openings, import_quality))
    top_openings = sort_openings_for_recommendation(cap_confidence_for_import_quality(top_openings, import_quality))
    opening_phase_habits = build_opening_phase_habits(recent_games)
    opponent_response_report = build_opponent_response_report(recent_games)
    repertoire_coverage = build_repertoire_coverage(best_openings)
    repertoire_coherence = build_repertoire_coherence(best_openings)
    repertoire_maintenance_cost = build_repertoire_maintenance_cost(best_openings, repertoire_coverage, None)
    opening_roi = build_opening_roi(
        best_openings,
        problem_lines,
        opening_phase_habits,
        repertoire_coverage,
        len(analysed_games),
    )
    do_not_study_yet = build_do_not_study_yet(best_openings, opening_roi, repertoire_coverage, None)
    rating_band_benchmark = build_rating_band_benchmark(None, best_openings, repertoire_coverage, repertoire_coherence)
    style_opening_match = infer_style_opening_match(recent_games, best_openings, None)
    plan_clarity_report = build_plan_clarity_report(best_openings)
    time_control_opening_report = build_time_control_opening_report(recent_games, best_openings)
    repertoire_identity_summary = build_repertoire_identity_summary(best_openings, style_profile, repertoire_coherence)
    recommended_repertoire_plan = build_recommended_repertoire_plan(
        best_openings,
        repertoire_coverage,
        style_profile,
        None,
        style_opening_match,
    )
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
    next_training_actions = build_next_training_actions(
        best_openings,
        repertoire_coverage,
        problem_lines,
        None,
        repertoire_coherence,
    )
    study_queue = build_study_queue(
        best_openings,
        problem_lines,
        opening_phase_habits,
        repertoire_coverage,
        repertoire_coherence,
        style_opening_match,
    )
    main_opening_leak = build_main_opening_leak(
        best_openings,
        repertoire_coverage,
        problem_lines,
        opening_phase_habits,
        repertoire_coherence,
        plan_clarity_report,
        opening_roi,
        len(analysed_games),
        None,
    )
    next_training_actions = connect_main_leak_to_training_actions(main_opening_leak, next_training_actions)
    training_plan = next_training_actions
    if next_training_actions:
        recommended_action = next_training_actions[0]
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
        "problem_lines": problem_lines,
        "problemLines": problem_lines,
        "engine_opening_validation": engine_opening_validation,
        "engineOpeningValidation": engine_opening_validation,
        "opening_phase_habits": opening_phase_habits,
        "openingPhaseHabits": opening_phase_habits,
        "opponent_response_report": opponent_response_report,
        "opponentResponseReport": opponent_response_report,
        "style_opening_match": style_opening_match,
        "styleOpeningMatch": style_opening_match,
        "repertoire_coverage": repertoire_coverage,
        "repertoireCoverage": repertoire_coverage,
        "repertoire_coherence": repertoire_coherence,
        "repertoireCoherence": repertoire_coherence,
        "repertoire_maintenance_cost": repertoire_maintenance_cost,
        "repertoireMaintenanceCost": repertoire_maintenance_cost,
        "import_quality": import_quality,
        "importQuality": import_quality,
        "game_import_quality": import_quality,
        "gameImportQuality": import_quality,
        "opening_roi": opening_roi,
        "openingRoi": opening_roi,
        "openingROI": opening_roi,
        "do_not_study_yet": do_not_study_yet,
        "doNotStudyYet": do_not_study_yet,
        "rating_band_benchmark": rating_band_benchmark,
        "ratingBandBenchmark": rating_band_benchmark,
        "repertoire_identity_summary": repertoire_identity_summary,
        "repertoireIdentitySummary": repertoire_identity_summary,
        "recommended_repertoire_plan": recommended_repertoire_plan,
        "recommendedRepertoirePlan": recommended_repertoire_plan,
        "plan_clarity_report": plan_clarity_report,
        "planClarityReport": plan_clarity_report,
        "time_control_opening_report": time_control_opening_report,
        "timeControlOpeningReport": time_control_opening_report,
        "main_opening_leak": main_opening_leak,
        "mainOpeningLeak": main_opening_leak,
        "next_training_actions": next_training_actions,
        "nextTrainingActions": next_training_actions,
        "study_queue": study_queue,
        "studyQueue": study_queue,
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

    result["progress_comparison"] = build_report_progress_comparison(
        result,
        previous_saved_report(username, "chess.com"),
    )
    result["progressComparison"] = result["progress_comparison"]

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
        move_count = move_count_from_moves(moves)
        first_white_move = moves[0] if moves else ""
        repertoire_context = opening_context_for_game(colour, first_white_move)
        loss_timing = classify_loss_timing(result, moves=moves)

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
            add_move_order_to_stats(stats, moves)
            if colour in {"white", "black"}:
                stats[colour] += 1
            stats[repertoire_context] += 1

            if result == "win":
                stats["wins"] += 1
            elif result == "draw":
                stats["draws"] += 1
            elif result == "loss":
                stats["losses"] += 1
                add_loss_timing_to_stats(stats, loss_timing)
            add_plan_structure_to_stats(stats, moves, result)

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
                "move_count": move_count,
                "moveCount": move_count,
                "loss_timing": loss_timing,
                "lossTiming": loss_timing,
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
                "move_count": move_count,
                "moveCount": move_count,
                "loss_timing": loss_timing,
                "lossTiming": loss_timing,
            }
        )

    top_openings = []
    total_opening_games = sum(int(stats.get("games", 0) or 0) for stats in opening_results.values())

    for opening, _count in opening_counter.most_common(10):
        stats = opening_results[opening]
        games_count = stats["games"]
        win_rate = round((stats["wins"] / games_count) * 100, 1) if games_count else 0
        explanation = opening_explanation(opening)
        item = {
            "name": opening,
            "games": games_count,
            "wins": stats["wins"],
            "draws": stats["draws"],
            "losses": stats["losses"],
            "opening_losses": int(stats.get("opening_losses", 0) or 0),
            "middlegame_losses": int(stats.get("middlegame_losses", 0) or 0),
            "late_losses": int(stats.get("late_losses", 0) or 0),
            "unknown_losses": int(stats.get("unknown_losses", 0) or 0),
                "move_orders_4": dict(stats.get("move_orders_4", {}) or {}),
                "move_orders_6": dict(stats.get("move_orders_6", {}) or {}),
                "move_orders_8": dict(stats.get("move_orders_8", {}) or {}),
                "move_orders_10": dict(stats.get("move_orders_10", {}) or {}),
                "plan_structures_6": dict(stats.get("plan_structures_6", {}) or {}),
                "plan_structures_8": dict(stats.get("plan_structures_8", {}) or {}),
                "plan_structures_10": dict(stats.get("plan_structures_10", {}) or {}),
            "win_rate": win_rate,
            "winRate": win_rate,
            "colour": dominant_opening_colour(stats),
            "color": dominant_opening_colour(stats),
            "context": dominant_opening_context(stats),
            "contextLabel": context_label(dominant_opening_context(stats)),
            "repertoireContext": dominant_opening_context(stats),
            **explanation,
        }
        item.update(loss_timing_fields(item))
        item.update(move_order_consistency_fields(item))
        item.update(plan_clarity_fields(item))
        item.update(opening_confidence_fields(item, total_opening_games))
        item.update(balanced_opening_fit_score(item))
        item["evidence"] = opening_evidence_bullets(item)
        item["evidenceBullets"] = item["evidence"]
        top_openings.append(item)

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
    best_openings = sort_openings_for_recommendation(apply_opening_risk_profiles(best_openings, current_rating))
    top_openings = sort_openings_for_recommendation(apply_opening_risk_profiles(top_openings, current_rating))
    opening_recommendations = build_colour_aware_recommendations(context_opening_results, rating=current_rating)
    problem_lines = build_problem_lines(recent_games)
    engine_opening_validation = validate_problem_lines_with_stockfish(problem_lines)
    best_openings = sort_openings_for_recommendation(apply_opening_fixability_scores(best_openings, problem_lines, current_rating))
    top_openings = sort_openings_for_recommendation(apply_opening_fixability_scores(top_openings, problem_lines, current_rating))
    import_quality = build_game_import_quality(recent_games, skipped_reason_counts, games_found)
    best_openings = sort_openings_for_recommendation(cap_confidence_for_import_quality(best_openings, import_quality))
    top_openings = sort_openings_for_recommendation(cap_confidence_for_import_quality(top_openings, import_quality))
    opening_phase_habits = build_opening_phase_habits(recent_games)
    opponent_response_report = build_opponent_response_report(recent_games)
    repertoire_coverage = build_repertoire_coverage(best_openings)
    repertoire_coherence = build_repertoire_coherence(best_openings)
    repertoire_maintenance_cost = build_repertoire_maintenance_cost(best_openings, repertoire_coverage, current_rating)
    opening_roi = build_opening_roi(
        best_openings,
        problem_lines,
        opening_phase_habits,
        repertoire_coverage,
        len(games),
    )
    do_not_study_yet = build_do_not_study_yet(best_openings, opening_roi, repertoire_coverage, current_rating)
    rating_band_benchmark = build_rating_band_benchmark(current_rating, best_openings, repertoire_coverage, repertoire_coherence)
    style_opening_match = infer_style_opening_match(recent_games, best_openings, current_rating)
    plan_clarity_report = build_plan_clarity_report(best_openings)
    time_control_opening_report = build_time_control_opening_report(recent_games, best_openings)
    repertoire_identity_summary = build_repertoire_identity_summary(best_openings, style_profile, repertoire_coherence)
    recommended_repertoire_plan = build_recommended_repertoire_plan(
        best_openings,
        repertoire_coverage,
        style_profile,
        current_rating,
        style_opening_match,
    )
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
    next_training_actions = build_next_training_actions(
        best_openings,
        repertoire_coverage,
        problem_lines,
        current_rating,
        repertoire_coherence,
    )
    study_queue = build_study_queue(
        best_openings,
        problem_lines,
        opening_phase_habits,
        repertoire_coverage,
        repertoire_coherence,
        style_opening_match,
    )
    main_opening_leak = build_main_opening_leak(
        best_openings,
        repertoire_coverage,
        problem_lines,
        opening_phase_habits,
        repertoire_coherence,
        plan_clarity_report,
        opening_roi,
        len(games),
        current_rating,
    )
    next_training_actions = connect_main_leak_to_training_actions(main_opening_leak, next_training_actions)
    training_plan = next_training_actions
    if next_training_actions:
        recommended_action = next_training_actions[0]
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
        "problem_lines": problem_lines,
        "problemLines": problem_lines,
        "engine_opening_validation": engine_opening_validation,
        "engineOpeningValidation": engine_opening_validation,
        "opening_phase_habits": opening_phase_habits,
        "openingPhaseHabits": opening_phase_habits,
        "opponent_response_report": opponent_response_report,
        "opponentResponseReport": opponent_response_report,
        "style_opening_match": style_opening_match,
        "styleOpeningMatch": style_opening_match,
        "repertoire_coverage": repertoire_coverage,
        "repertoireCoverage": repertoire_coverage,
        "repertoire_coherence": repertoire_coherence,
        "repertoireCoherence": repertoire_coherence,
        "repertoire_maintenance_cost": repertoire_maintenance_cost,
        "repertoireMaintenanceCost": repertoire_maintenance_cost,
        "import_quality": import_quality,
        "importQuality": import_quality,
        "game_import_quality": import_quality,
        "gameImportQuality": import_quality,
        "opening_roi": opening_roi,
        "openingRoi": opening_roi,
        "openingROI": opening_roi,
        "do_not_study_yet": do_not_study_yet,
        "doNotStudyYet": do_not_study_yet,
        "rating_band_benchmark": rating_band_benchmark,
        "ratingBandBenchmark": rating_band_benchmark,
        "repertoire_identity_summary": repertoire_identity_summary,
        "repertoireIdentitySummary": repertoire_identity_summary,
        "recommended_repertoire_plan": recommended_repertoire_plan,
        "recommendedRepertoirePlan": recommended_repertoire_plan,
        "plan_clarity_report": plan_clarity_report,
        "planClarityReport": plan_clarity_report,
        "time_control_opening_report": time_control_opening_report,
        "timeControlOpeningReport": time_control_opening_report,
        "main_opening_leak": main_opening_leak,
        "mainOpeningLeak": main_opening_leak,
        "next_training_actions": next_training_actions,
        "nextTrainingActions": next_training_actions,
        "study_queue": study_queue,
        "studyQueue": study_queue,
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

    result["progress_comparison"] = build_report_progress_comparison(
        result,
        previous_saved_report(username, "lichess"),
    )
    result["progressComparison"] = result["progress_comparison"]

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
