from collections import Counter, defaultdict
from typing import List, Dict, Any, Optional
import os
import re
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="Opening Fit API")


FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip().rstrip("/")

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

if FRONTEND_URL and FRONTEND_URL not in allowed_origins:
    allowed_origins.append(FRONTEND_URL)

print("CORS allowed origins:", allowed_origins)

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
FEEDBACK_FILE = DATA_DIR / "feedback.jsonl"
ANALYTICS_FILE = DATA_DIR / "analytics.jsonl"

DATA_DIR.mkdir(exist_ok=True)
PROFILES_DIR.mkdir(exist_ok=True)


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
        "date": now_iso(),
        "message": message,
        "contact": contact,
        "username": username,
        "platform": platform,
    }

    with FEEDBACK_FILE.open("a") as f:
        f.write(json.dumps(item) + "\n")

    return item


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

        if top["verdict"] == "Keep":
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
        recommendations.append(
            f"Your best-scoring recurring opening is {best_openings[0]['name']}."
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
    opening_results = defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0})
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
    opening_results = defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0})
    recent_games = []

    for game in games:
        opening = get_lichess_opening_name(game)
        colour = get_lichess_colour(game, username)
        result = get_lichess_result(game, username)

        players = game.get("players", {})
        white_name = lichess_user_name(players.get("white", {}), "White")
        black_name = lichess_user_name(players.get("black", {}), "Black")

        moves_text = game.get("moves", "")
        moves = moves_text.split() if moves_text else []

        opening_counter[opening] += 1

        if colour == "white":
            white_opening_counter[opening] += 1
        elif colour == "black":
            black_opening_counter[opening] += 1

        opening_results[opening]["games"] += 1

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
                "pgn": "",
                "moves": moves,
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

    result = {
        "username": username,
        "player_url": f"https://lichess.org/@/{username}",
        "playerUrl": f"https://lichess.org/@/{username}",
        "platform": "lichess",
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
        "perfType": "blitz,rapid,classical",
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

# ---- Contact / feedback capture to Supabase ----

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()


class ContactMessageRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    contact: Optional[str] = None
    message: str
    username: Optional[str] = None
    platform: Optional[str] = None
    page: Optional[str] = None


def save_contact_message_to_supabase(request: ContactMessageRequest):
    clean_message = request.message.strip()

    if not clean_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    created_at = now_iso()

    item = {
        "created_at": created_at,
        "name": (request.name or "").strip(),
        "email": (request.email or request.contact or "").strip(),
        "message": clean_message,
        "page": (request.page or "Opening Fit contact form").strip(),
        "source": "opening-fit",
    }

    # Local backup file as a fallback
    try:
        with FEEDBACK_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
    except Exception as exc:
        print("Local contact backup failed:", str(exc))

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("Supabase is not configured. Saved contact locally only.")
        return item

    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/contact_messages",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json=item,
            timeout=15,
        )
    except requests.RequestException as exc:
        print("Supabase contact save request failed:", str(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not save your message right now. Please try again.",
        )

    if response.status_code >= 400:
        print("Supabase contact save failed:", response.status_code, response.text)
        raise HTTPException(
            status_code=500,
            detail="Could not save your message right now. Please try again.",
        )

    return item


@app.post("/api/contact")
def submit_contact_message(request: ContactMessageRequest):
    saved = save_contact_message_to_supabase(request)

    log_analytics_event(
        "contact_message_submitted",
        {
            "hasEmail": bool(request.email or request.contact),
            "username": request.username,
            "platform": request.platform,
            "savedToSupabase": bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY),
        },
    )

    return {
        "status": "ok",
        "message": "Thanks — your message has been sent.",
        "contact": saved,
    }
