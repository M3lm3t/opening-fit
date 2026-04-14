from collections import Counter, defaultdict
from typing import List, Dict, Any
import os
import re

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Opening Fit API")

FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip()

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

if FRONTEND_URL:
    allowed_origins.append(FRONTEND_URL)

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


@app.get("/")
def root():
    return {
        "message": "Opening Fit backend is running",
        "health": "/health",
        "api_health": "/api/health",
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


def safe_get(url: str) -> Dict[str, Any]:
    try:
        response = requests.get(url, headers=CHESSCOM_HEADERS, timeout=20)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Request failed: {str(exc)}")

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Not found: {url}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Chess.com API returned status {response.status_code} for {url}",
        )

    try:
        return response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail=f"Invalid JSON returned from {url}")


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
            detail=f"No public game archives found for Chess.com user '{username}'",
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
    ]

    for keys, value in mapping:
        if any(k in lower for k in keys):
            return value

    return name.strip()


def pgn_tag_opening(pgn: str) -> str:
    if not pgn:
        return ""

    for line in pgn.splitlines():
        if line.startswith('[Opening '):
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

    return {
        "labels": labels or ["Developing"],
        "summary": " ".join(summary_parts),
        "top_opening_families": [name for name, _ in opening_counts.most_common(3)],
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
                "score": score,
                "verdict": verdict,
            }
        )

    scored.sort(key=lambda x: (x["games"] >= 5, x["score"], x["games"]), reverse=True)
    return scored


def recommend_openings_from_style(style_profile: Dict[str, Any]) -> Dict[str, List[str]]:
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

    return {
        "white": dedupe(white_recs)[:5],
        "black": dedupe(black_recs)[:5],
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
        plan.append("Focus on development, king safety, and reaching familiar pawn structures every game.")
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


def import_chesscom_logic(username: str, months: int = 3):
    username = username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    if months < 1:
        raise HTTPException(status_code=400, detail="Months must be at least 1")

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
            }
        )
        all_games.extend(user_games)

    if not all_games:
        raise HTTPException(
            status_code=404,
            detail=f"No games found for Chess.com user '{username}' in the selected archives",
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
                "rated": game.get("rated"),
                "colour": colour,
                "result": result,
                "opening": opening,
                "end_time": game.get("end_time"),
                "pgn": game.get("pgn", ""),
                "white_username": game.get("white", {}).get("username", ""),
                "black_username": game.get("black", {}).get("username", ""),
            }
        )

    top_openings = []
    for opening, _count in opening_counter.most_common(10):
        stats = opening_results[opening]
        games = stats["games"]
        win_rate = round((stats["wins"] / games) * 100, 1) if games else 0

        top_openings.append(
            {
                "name": opening,
                "games": games,
                "wins": stats["wins"],
                "draws": stats["draws"],
                "losses": stats["losses"],
                "win_rate": win_rate,
            }
        )

    preferred_white = [{"name": n, "games": g} for n, g in white_opening_counter.most_common(5)]
    preferred_black = [{"name": n, "games": g} for n, g in black_opening_counter.most_common(5)]

    style_profile = build_style_profile(all_games, username)
    best_openings = build_opening_scores(opening_results)
    opening_recommendations = recommend_openings_from_style(style_profile)
    training_plan = build_training_plan(style_profile, preferred_white, preferred_black, best_openings)
    recommendations = build_recommendations(
        preferred_white, preferred_black, best_openings, style_profile
    )

    premium_preview = {
        "best_opening_for_you": best_openings[:3],
        "style_profile_summary": style_profile["summary"],
        "premium_features": [
            "Full opening ranking",
            "Keep / Improve / Avoid engine",
            "Training plan by style",
            "Opening recommendations",
            "More months of game history",
            "Opponent-specific prep",
        ],
    }

    recent_games = sorted(recent_games, key=lambda x: x["end_time"] or 0, reverse=True)[:10]

    return {
        "username": player.get("username", username),
        "player_url": player.get("url"),
        "total_games": len(all_games),
        "months_checked": len(selected_archives),
        "archives_checked": archive_breakdown,
        "top_openings": top_openings,
        "preferred_white": preferred_white,
        "preferred_black": preferred_black,
        "recommendations": recommendations,
        "recent_games": recent_games,
        "style_profile": style_profile,
        "best_openings": best_openings[:8],
        "opening_recommendations": opening_recommendations,
        "training_plan": training_plan,
        "premium_preview": premium_preview,
    }


@app.get("/import/chesscom/{username}")
def import_chesscom(username: str, months: int = 3):
    return import_chesscom_logic(username, months)


@app.get("/api/import/chesscom/{username}")
def api_import_chesscom(username: str, months: int = 3):
    return import_chesscom_logic(username, months)