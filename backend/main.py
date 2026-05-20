import stripe
from collections import Counter, defaultdict
from fastapi.responses import JSONResponse, Response
from intelligence import enrich_analysis_result
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
    if not name:
        return "Unknown Opening"

    lower = name.lower()

    mapping = [
        (["vienna"], "Vienna Game"),
        (["scandinavian"], "Scandinavian Defence"),
        (["sicilian"], "Sicilian Defence"),
        (["caro-kann", "caro kann"], "Caro-Kann Defence"),
        (["french"], "French Defence"),
        (["ruy lopez", "spanish"], "Ruy Lopez"),
        (["italian"], "Italian Game"),
        (["queen's gambit", "queens gambit"], "Queen's Gambit"),
        (["london"], "London System"),
        (["jobava"], "Jobava London"),
        (["king's indian", "kings indian"], "King's Indian Defence"),
        (["pirc"], "Pirc Defence"),
        (["modern"], "Modern Defence"),
        (["english"], "English Opening"),
        (["reti", "réti"], "Réti Opening"),
        (["scotch"], "Scotch Game"),
        (["four knights"], "Four Knights Game"),
        (["dutch"], "Dutch Defence"),
        (["grünfeld", "grunfeld"], "Grünfeld Defence"),
        (["nimzo"], "Nimzo-Indian Defence"),
        (["catalan"], "Catalan Opening"),
    ]

    for keys, value in mapping:
        if any(k in lower for k in keys):
            return value

    return name.strip()


def pgn_tag_opening(pgn: str) -> str:
    if not pgn:
        return ""

    for line in pgn.splitlines():
        if line.startswith("[Opening "):
            parts = line.split('"')
            if len(parts) >= 2:
                return parts[1].strip()

    return ""


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

    if s.startswith("d4 Nf6 c4 g6"):
        return "King's Indian Defence"

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
    tagged = normalize_opening_name(pgn_tag_opening(pgn))
    if tagged != "Unknown Opening":
        return tagged

    moves = clean_moves_from_pgn(pgn)
    return normalize_opening_name(opening_from_move_sequence(moves))


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


def build_opening_scores(opening_results: Dict[str, Dict[str, int]]) -> List[Dict[str, Any]]:
    scored = []

    for opening, stats in opening_results.items():
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

        scored.append(
            {
                "name": opening,
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
            }
        )

    scored.sort(key=lambda x: (x["games"] >= 5, x["score"], x["games"]), reverse=True)
    return scored


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


def build_training_plan(
    style_profile: Dict[str, Any],
    preferred_white: List[Dict[str, Any]],
    preferred_black: List[Dict[str, Any]],
    best_openings: List[Dict[str, Any]],
) -> List[str]:
    plan = []

    if preferred_white:
        plan.append(f"As White, play {preferred_white[0]['name']} for your next 10 to 15 games.")

    if preferred_black:
        plan.append(f"As Black, stick with {preferred_black[0]['name']} and learn the first 6 to 8 moves well.")

    if best_openings:
        top = best_openings[0]

        if top["games"] < 8:
            plan.append(f"Treat {top['name']} as an emerging pattern and collect more games before judging it.")
        elif top["verdict"] == "Keep":
            plan.append(f"Keep building around {top['name']}. It is currently your best practical opening.")
        elif top["verdict"] == "Improve":
            plan.append(f"Keep {top['name']} in your pool, but review the early middlegame plans.")
        elif top["verdict"] == "Avoid":
            plan.append(f"Reduce how often you play {top['name']} until your understanding improves.")

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


def build_recommendations(
    preferred_white: List[Dict[str, Any]],
    preferred_black: List[Dict[str, Any]],
    best_openings: List[Dict[str, Any]],
    style_profile: Dict[str, Any],
) -> List[str]:
    recommendations = []

    if preferred_white:
        recommendations.append(
            f"As White, your most common practical choice is {preferred_white[0]['name']}."
        )

    if preferred_black:
        recommendations.append(
            f"As Black, your most common structure is {preferred_black[0]['name']}."
        )

    if best_openings:
        top = best_openings[0]
        if top["games"] < 8:
            recommendations.append(
                f"{top['name']} is an emerging pattern, but it needs more games before a strong verdict."
            )
        else:
            recommendations.append(
                f"Your best-scoring recurring opening is {top['name']}."
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

    opening_counter = Counter()
    white_opening_counter = Counter()
    black_opening_counter = Counter()
    opening_results = defaultdict(
        lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0, "white": 0, "black": 0}
    )
    recent_games = []

    for game in all_games:
        opening = guess_opening_from_pgn(game.get("pgn", ""))
        colour = colour_for_user(game, username)
        result = result_for_user(game, username)

        opening_counter[opening] += 1

        if colour == "white":
            white_opening_counter[opening] += 1
        elif colour == "black":
            black_opening_counter[opening] += 1

        opening_results[opening]["games"] += 1
        if colour in {"white", "black"}:
            opening_results[opening][colour] += 1

        if result == "win":
            opening_results[opening]["wins"] += 1
        elif result == "draw":
            opening_results[opening]["draws"] += 1
        elif result == "loss":
            opening_results[opening]["losses"] += 1

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
                "end_time": game.get("end_time"),
                "endTime": game.get("end_time"),
                "pgn": game.get("pgn", ""),
                "white_username": game.get("white", {}).get("username", ""),
                "whiteUsername": game.get("white", {}).get("username", ""),
                "black_username": game.get("black", {}).get("username", ""),
                "blackUsername": game.get("black", {}).get("username", ""),
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
                **explanation,
            }
        )

    preferred_white = [
        {
            "name": n,
            "games": g,
            **opening_explanation(n),
        }
        for n, g in white_opening_counter.most_common(5)
    ]

    preferred_black = [
        {
            "name": n,
            "games": g,
            **opening_explanation(n),
        }
        for n, g in black_opening_counter.most_common(5)
    ]

    style_profile = build_style_profile(all_games, username)
    best_openings = build_opening_scores(opening_results)
    opening_recommendations = recommend_openings_from_style(style_profile)
    training_plan = build_training_plan(style_profile, preferred_white, preferred_black, best_openings)
    recommendations = build_recommendations(
        preferred_white,
        preferred_black,
        best_openings,
        style_profile,
    )

    premium_data = build_premium_data(best_openings, style_profile)

    recent_games = sorted(recent_games, key=lambda x: x["end_time"] or 0, reverse=True)[:10]

    result = {
        "username": player.get("username", username),
        "player_url": player.get("url"),
        "playerUrl": player.get("url"),
        "platform": "chess.com",
        "total_games": len(all_games),
        "totalGames": len(all_games),
        "gamesImported": len(all_games),
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
        "style_profile": style_profile,
        "styleProfile": style_profile,
        "best_openings": best_openings[:8],
        "bestOpenings": best_openings[:8],
        "opening_recommendations": opening_recommendations,
        "openingRecommendations": opening_recommendations,
        "recommendedOpenings": opening_recommendations,
        "training_plan": training_plan,
        "trainingPlan": training_plan,
        "lastUpdated": now_iso(),
        **premium_data,
    }

    profile = save_user_profile(username, result)

    log_analytics_event(
        "games_imported",
        {
            "username": username,
            "platform": "chess.com",
            "gamesImported": len(all_games),
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


def build_lichess_analysis(username: str, games: List[Dict[str, Any]], months: int):
    opening_counter = Counter()
    white_opening_counter = Counter()
    black_opening_counter = Counter()
    opening_results = defaultdict(
        lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0, "white": 0, "black": 0}
    )
    recent_games = []
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

        opening_results[opening]["games"] += 1
        if colour in {"white", "black"}:
            opening_results[opening][colour] += 1

        if result == "win":
            opening_results[opening]["wins"] += 1
        elif result == "draw":
            opening_results[opening]["draws"] += 1
        elif result == "loss":
            opening_results[opening]["losses"] += 1

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
                **explanation,
            }
        )

    preferred_white = [
        {
            "name": n,
            "games": g,
            **opening_explanation(n),
        }
        for n, g in white_opening_counter.most_common(5)
    ]

    preferred_black = [
        {
            "name": n,
            "games": g,
            **opening_explanation(n),
        }
        for n, g in black_opening_counter.most_common(5)
    ]

    best_openings = build_opening_scores(opening_results)
    style_profile = build_lichess_style_profile(top_openings, preferred_white, preferred_black)
    opening_recommendations = recommend_openings_from_style(style_profile)
    training_plan = build_training_plan(style_profile, preferred_white, preferred_black, best_openings)
    recommendations = build_recommendations(
        preferred_white,
        preferred_black,
        best_openings,
        style_profile,
    )

    premium_data = build_premium_data(best_openings, style_profile)
    recent_games = sorted(recent_games, key=lambda x: x["end_time"] or 0, reverse=True)[:10]

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

    result = {
        "username": username,
        "player_url": f"https://lichess.org/@/{username}",
        "playerUrl": f"https://lichess.org/@/{username}",
        "platform": "lichess",
        "rating": current_rating,
        "lichess_rating": current_rating,
        "lichessRating": current_rating,
        "player_level": player_level,
        "playerLevel": player_level,
        "total_games": len(games),
        "totalGames": len(games),
        "gamesImported": len(games),
        "months_checked": months,
        "monthsChecked": months,
        "archives_checked": [
            {
                "archive": f"lichess-last-{months}-months",
                "games_found": len(games),
                "gamesFound": len(games),
            }
        ],
        "archivesChecked": [
            {
                "archive": f"lichess-last-{months}-months",
                "games_found": len(games),
                "gamesFound": len(games),
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
        "style_profile": style_profile,
        "styleProfile": style_profile,
        "best_openings": best_openings[:8],
        "bestOpenings": best_openings[:8],
        "opening_recommendations": opening_recommendations,
        "openingRecommendations": opening_recommendations,
        "recommendedOpenings": opening_recommendations,
        "training_plan": training_plan,
        "trainingPlan": training_plan,
        "lastUpdated": now_iso(),
        **premium_data,
    }

    profile = save_user_profile(username, result)

    log_analytics_event(
        "games_imported",
        {
            "username": username,
            "platform": "lichess",
            "gamesImported": len(games),
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

    return build_lichess_analysis(username, games, months)


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

    opening_recommendations = {
        "white": ["Vienna Game", "Italian Game", "Scotch Game"],
        "black": ["Scandinavian Defence", "Sicilian Defence", "Caro-Kann Defence"],
        "whiteDetailed": enrich_opening_list(["Vienna Game", "Italian Game", "Scotch Game"]),
        "blackDetailed": enrich_opening_list(
            ["Scandinavian Defence", "Sicilian Defence", "Caro-Kann Defence"]
        ),
    }

    premium_data = build_premium_data(demo_best_openings, style_profile)

    demo_data = {
        "username": "DemoPlayer",
        "player_url": None,
        "playerUrl": None,
        "platform": "demo",
        "total_games": 24,
        "totalGames": 24,
        "gamesImported": 24,
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
        "style_profile": style_profile,
        "styleProfile": style_profile,
        "top_openings": demo_best_openings,
        "topOpenings": demo_best_openings,
        "best_openings": demo_best_openings,
        "bestOpenings": demo_best_openings,
        "preferred_white": [
            {"name": "Vienna Game", "games": 8, **opening_explanation("Vienna Game")},
            {"name": "Italian Game", "games": 5, **opening_explanation("Italian Game")},
        ],
        "preferredWhite": [
            {"name": "Vienna Game", "games": 8, **opening_explanation("Vienna Game")},
            {"name": "Italian Game", "games": 5, **opening_explanation("Italian Game")},
        ],
        "preferred_black": [
            {"name": "Scandinavian Defence", "games": 7, **opening_explanation("Scandinavian Defence")},
            {"name": "Caro-Kann Defence", "games": 4, **opening_explanation("Caro-Kann Defence")},
        ],
        "preferredBlack": [
            {"name": "Scandinavian Defence", "games": 7, **opening_explanation("Scandinavian Defence")},
            {"name": "Caro-Kann Defence", "games": 4, **opening_explanation("Caro-Kann Defence")},
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
def get_user_state(platform: str, username: str):
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
def save_user_state(payload: UserStatePayload):
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


@app.post("/api/account/sync")
async def sync_account_profile(payload: AccountProfilePayload):
    supabase_admin = get_supabase_admin_client()

    profile = {
        "id": payload.userId,
        "email": payload.email,
        "display_name": payload.displayName,
        "platform": payload.platform or "chesscom",
        "username": payload.username,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if payload.lastReport:
        profile["last_report"] = payload.lastReport
        profile["last_report_platform"] = payload.platform
        profile["last_report_username"] = payload.username

    result = (
        supabase_admin
        .table("user_profiles")
        .upsert(profile, on_conflict="id")
        .execute()
    )

    return {
        "ok": True,
        "profile": result.data[0] if result.data else profile,
    }


@app.get("/api/account/profile/{user_id}")
async def get_account_profile(user_id: str):
    if not is_valid_uuid(user_id):
        return {"ok": True, "profile": None}

    supabase_admin = get_supabase_admin_client()

    try:
        result = (
            supabase_admin
            .table("user_profiles")
            .select("*")
            .eq("id", user_id)
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
async def create_checkout_session(payload: Dict[str, Any]):
    stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    stripe_price_id = os.getenv("STRIPE_PREMIUM_PRICE_ID", "").strip()
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()

    if not stripe_secret_key or not stripe_price_id:
        raise HTTPException(
            status_code=500,
            detail="Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_PREMIUM_PRICE_ID.",
        )

    stripe.api_key = stripe_secret_key

    user_id = payload.get("userId")
    email = payload.get("email")

    if not user_id:
        raise HTTPException(status_code=400, detail="Missing userId.")

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[
            {
                "price": stripe_price_id,
                "quantity": 1,
            }
        ],
        success_url=f"{frontend_url}?payment=success",
        cancel_url=f"{frontend_url}?payment=cancelled",
        customer_email=email,
        client_reference_id=user_id,
        metadata={
            "user_id": user_id,
            "product": "openingfit_premium",
        },
    )

    return {"url": session.url}


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

    if not stripe_secret_key or not webhook_secret:
        raise HTTPException(
            status_code=500,
            detail="Stripe webhook is not configured.",
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
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(exc)}")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("client_reference_id") or session.get("metadata", {}).get("user_id")

        if user_id:
            supabase_admin = get_supabase_admin_client()

            supabase_admin.table("user_profiles").upsert(
                {
                    "id": user_id,
                    "email": session.get("customer_email"),
                    "is_premium": True,
                    "premium_source": "stripe_checkout",
                    "premium_since": datetime.now(timezone.utc).isoformat(),
                    "stripe_customer_id": session.get("customer"),
                    "stripe_checkout_session_id": session.get("id"),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="id",
            ).execute()

    return {"received": True}


@app.delete("/api/account/{user_id}")
async def delete_account(user_id: str):
    if not is_valid_uuid(user_id):
        raise HTTPException(status_code=400, detail="Invalid account id.")

    supabase_admin = get_supabase_admin_client()

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
    user_id: str,
    platform: str = "unknown",
    username: str = "guest",
):
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
def save_openingfit_user_state(payload: OpeningFitUserStatePayload):
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
