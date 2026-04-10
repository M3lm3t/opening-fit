from collections import Counter, defaultdict
from datetime import datetime
from typing import List, Dict, Any

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Opening Fit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CHESSCOM_HEADERS = {
    "User-Agent": "opening-fit-app/1.0"
}


@app.get("/")
def root():
    return {"message": "Opening Fit backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


def safe_get(url: str) -> Dict[str, Any]:
    try:
        response = requests.get(url, headers=CHESSCOM_HEADERS, timeout=20)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Request failed: {str(exc)}")

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Chess.com user or resource not found")

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Chess.com API returned status {response.status_code}"
        )

    try:
        return response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Invalid JSON returned from Chess.com")


def fetch_archives(username: str) -> List[str]:
    url = f"https://api.chess.com/pub/player/{username}/games/archives"
    data = safe_get(url)
    archives = data.get("archives", [])
    if not archives:
        raise HTTPException(status_code=404, detail="No game archives found for this user")
    return archives


def fetch_games_from_archive(archive_url: str) -> List[Dict[str, Any]]:
    data = safe_get(archive_url)
    return data.get("games", [])


def guess_opening_from_pgn(pgn: str) -> str:
    if not pgn:
        return "Unknown Opening"

    pgn_lower = pgn.lower()

    opening_markers = [
        ('[opening "', '"]'),
        ('[ecourl "', '"]'),
    ]

    for start_marker, end_marker in opening_markers:
        start = pgn_lower.find(start_marker)
        if start != -1:
            actual_start = start + len(start_marker)
            end = pgn_lower.find(end_marker, actual_start)
            if end != -1:
                raw = pgn[actual_start:end].strip()
                if raw:
                    return raw

    return "Unknown Opening"


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
    if res in {"agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"}:
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


@app.get("/import/chesscom/{username}")
def import_chesscom(username: str, months: int = 3):
    username = username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

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

        archive_breakdown.append({
            "archive": extract_year_month(archive_url),
            "games_found": len(user_games)
        })
        all_games.extend(user_games)

    if not all_games:
        raise HTTPException(status_code=404, detail="No games found for this user in selected archives")

    opening_counter = Counter()
    white_opening_counter = Counter()
    black_opening_counter = Counter()

    opening_results = defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0})

    recent_games = []

    for game in all_games:
        pgn = game.get("pgn", "")
        opening = guess_opening_from_pgn(pgn)
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

        recent_games.append({
            "url": game.get("url"),
            "time_class": game.get("time_class"),
            "rated": game.get("rated"),
            "colour": colour,
            "result": result,
            "opening": opening,
            "end_time": game.get("end_time"),
        })

    top_openings = []
    for opening, count in opening_counter.most_common(10):
        stats = opening_results[opening]
        games = stats["games"]
        win_rate = round((stats["wins"] / games) * 100, 1) if games else 0

        top_openings.append({
            "name": opening,
            "games": games,
            "wins": stats["wins"],
            "draws": stats["draws"],
            "losses": stats["losses"],
            "win_rate": win_rate
        })

    preferred_white = white_opening_counter.most_common(5)
    preferred_black = black_opening_counter.most_common(5)

    recommendations = []
    if preferred_white:
        recommendations.append(
            f"As White, you most often reach {preferred_white[0][0]}. Build a simple repeatable setup around that."
        )
    if preferred_black:
        recommendations.append(
            f"As Black, you most often face or play {preferred_black[0][0]}. Study the first 6-8 moves and common plans there."
        )

    if top_openings:
        best_by_winrate = sorted(
            [o for o in top_openings if o["games"] >= 2],
            key=lambda x: x["win_rate"],
            reverse=True
        )
        if best_by_winrate:
            recommendations.append(
                f"Your most successful recurring opening is {best_by_winrate[0]['name']} with a {best_by_winrate[0]['win_rate']}% win rate."
            )

    if not recommendations:
        recommendations.append("Play more games to unlock stronger opening suggestions.")

    recent_games = sorted(
        recent_games,
        key=lambda x: x["end_time"] or 0,
        reverse=True
    )[:10]

    return {
        "username": username,
        "months_checked": len(selected_archives),
        "total_games": len(all_games),
        "archives_checked": archive_breakdown,
        "top_openings": top_openings,
        "preferred_white": [{"name": n, "games": g} for n, g in preferred_white],
        "preferred_black": [{"name": n, "games": g} for n, g in preferred_black],
        "recommendations": recommendations,
        "recent_games": recent_games
    }