from __future__ import annotations

import hashlib
import io
import re
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Tuple

import chess
import chess.pgn

try:
    from backend.opening_detection import BOOK_LINES, detect_opening, normalise_opening_name
except ImportError:  # Runtime entrypoint adds backend/ directly to sys.path.
    from opening_detection import BOOK_LINES, detect_opening, normalise_opening_name


OPENING_PHASE_END_MOVE = 12
DEFAULT_OPPORTUNITY_LIMIT = 12
DEFAULT_GAME_INPUT_LIMIT = 120
SUPPORTED_ANALYSIS_ISSUES = {
    "poor_development": "missing_development_move",
    "missing_development_move": "missing_development_move",
    "king_safety": "delayed_castling",
    "delayed_castling": "delayed_castling",
    "premature_queen_movement": "early_queen_movement",
    "early_queen_move": "early_queen_movement",
    "early_queen_movement": "early_queen_movement",
    "bad_pawn_structure": "pawn_structure_mistake",
    "pawn_structure_mistake": "pawn_structure_mistake",
    "left_opening_territory": "left_known_opening_territory",
    "left_known_opening_territory": "left_known_opening_territory",
    "unsuitable_plan": "unsuitable_opening_plan",
    "unsuitable_opening_plan": "unsuitable_opening_plan",
    "repertoire_deviation": "intended_repertoire_move_missed",
    "intended_repertoire_move_missed": "intended_repertoire_move_missed",
}


def _text(value: Any) -> str:
    return str(value or "").strip()


def _list(value: Any) -> List[Any]:
    return [item for item in value if item is not None] if isinstance(value, list) else []


def _game_timestamp(game: Any) -> float:
    if not isinstance(game, dict):
        return 0
    try:
        return float(game.get("end_time") or game.get("endTime") or 0)
    except (TypeError, ValueError):
        return 0


def _clean_san(value: Any) -> str:
    return re.sub(r"[!?+#]+$", "", _text(value)).replace("0-0-0", "O-O-O").replace("0-0", "O-O")


def _canonical_opening_id(name: str) -> str:
    normalised = normalise_opening_name(name)
    value = normalised.lower().replace("defence", "defense").replace("grünfeld", "grunfeld").replace("réti", "reti")
    value = value.replace("queen's", "queens").replace("king's", "kings")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "unknown-opening"


def _normalised_position(board_or_fen: Any) -> str:
    fen = board_or_fen.fen() if hasattr(board_or_fen, "fen") else _text(board_or_fen)
    fields = fen.split()
    return " ".join(fields[:4]) if len(fields) >= 4 else fen


def _game_from_pgn(pgn: str):
    try:
        return chess.pgn.read_game(io.StringIO(pgn)) if pgn else None
    except Exception:
        return None


def _game_id(game: Dict[str, Any], pgn: str) -> str:
    direct = game.get("gameId") or game.get("game_id") or game.get("id") or game.get("url")
    return _text(direct) or f"pgn-{hashlib.sha256(pgn.encode('utf-8', errors='ignore')).hexdigest()[:16]}"


def _user_colour(game: Dict[str, Any], parsed: Any, username: str) -> Optional[bool]:
    colour = _text(game.get("colour") or game.get("color") or game.get("side")).lower()
    if colour == "white":
        return chess.WHITE
    if colour == "black":
        return chess.BLACK
    username = username.lower()
    if username and _text(parsed.headers.get("White")).lower() == username:
        return chess.WHITE
    if username and _text(parsed.headers.get("Black")).lower() == username:
        return chess.BLACK
    return None


def _snapshots(parsed: Any, colour: bool) -> Tuple[List[Dict[str, Any]], List[str]]:
    board = parsed.board()
    snapshots: List[Dict[str, Any]] = []
    sans: List[str] = []
    for ply, move in enumerate(parsed.mainline_moves()):
        san = board.san(move)
        sans.append(san)
        if board.turn == colour:
            snapshots.append(
                {
                    "ply": ply,
                    "moveNumber": board.fullmove_number,
                    "positionFen": board.fen(),
                    "positionKey": _normalised_position(board),
                    "playedMove": san,
                    "board": board.copy(stack=False),
                }
            )
        board.push(move)
    return snapshots, sans


def _opening_name(game: Dict[str, Any], parsed: Any, sans: List[str]) -> str:
    direct = _text(game.get("opening") or game.get("openingName") or game.get("opening_name") or parsed.headers.get("Opening"))
    if direct:
        return normalise_opening_name(direct)
    return normalise_opening_name(detect_opening(sans).get("opening"))


def _line_moves(value: Any) -> List[str]:
    if isinstance(value, list):
        return [_clean_san(move) for move in value if _clean_san(move)]
    raw = _text(value)
    if not raw:
        return []
    raw = re.sub(r"\{[^}]*\}|\([^)]*\)|\$\d+|\d+\.(\.\.)?|1-0|0-1|1/2-1/2|\*", " ", raw)
    return [_clean_san(move) for move in raw.split() if _clean_san(move)]


def _expected_line(game: Dict[str, Any], opening_name: str, opening_id: str, repertoire: Iterable[Dict[str, Any]]) -> Tuple[List[str], str]:
    direct = next((game.get(key) for key in ("expectedMoves", "expected_moves", "expectedLine", "expected_line") if game.get(key)), None)
    if direct:
        return _line_moves(direct), "report_expected_line"
    for entry in repertoire or []:
        if _text(entry.get("status") or "active").lower() != "active":
            continue
        entry_id = _text(entry.get("canonical_opening_id") or entry.get("canonicalOpeningId"))
        entry_name = _text(entry.get("canonical_name") or entry.get("display_name") or entry.get("displayName") or entry.get("name"))
        if entry_id != opening_id and normalise_opening_name(entry_name) != normalise_opening_name(opening_name):
            continue
        moves = next((_line_moves(entry.get(key)) for key in ("expectedMoves", "expected_moves", "moves", "line") if entry.get(key)), [])
        if moves:
            return moves, "active_repertoire_line"
    book = [line for line in BOOK_LINES if normalise_opening_name(line.name) == normalise_opening_name(opening_name)]
    if len(book) == 1:
        return list(book[0].moves), "opening_reference_line"
    return [], ""


def _legal_san(board: chess.Board, value: Any) -> Optional[str]:
    candidate = _clean_san(value)
    if not candidate:
        return None
    try:
        return board.san(board.parse_san(candidate))
    except Exception:
        return None


def _base_candidate(
    *, game_id: str, opening_id: str, side: str, snapshot: Dict[str, Any], issue_type: str,
    explanation: str, evidence: str, confidence: float, source: str,
    recommended_move: Optional[str] = None, alternatives: Optional[List[str]] = None,
) -> Dict[str, Any]:
    return {
        "gameId": game_id,
        "openingId": opening_id,
        "side": side,
        "moveNumber": int(snapshot["moveNumber"]),
        "positionFen": snapshot["positionFen"],
        "positionKey": snapshot["positionKey"],
        "playedMove": snapshot["playedMove"],
        "recommendedMove": recommended_move,
        "alternativeMoves": alternatives or [],
        "issueType": issue_type,
        "explanation": explanation,
        "evidence": evidence,
        "confidence": max(0.0, min(1.0, confidence)),
        "source": source,
        "reviewType": "move_review" if recommended_move else "concept_review",
    }


def _expected_line_candidate(game_id: str, opening_id: str, side: str, snapshots: List[Dict[str, Any]], sans: List[str], expected: List[str], source: str) -> Optional[Dict[str, Any]]:
    if not expected:
        return None
    by_ply = {snapshot["ply"]: snapshot for snapshot in snapshots}
    for ply, (played, intended) in enumerate(zip(sans, expected)):
        if _clean_san(played) == _clean_san(intended):
            continue
        snapshot = by_ply.get(ply)
        if not snapshot:  # The opponent left the line, so do not blame the user.
            return None
        if snapshot["moveNumber"] > OPENING_PHASE_END_MOVE:
            return None
        recommended = _legal_san(snapshot["board"], intended)
        if not recommended:
            return None
        repertoire_source = source == "active_repertoire_line"
        candidate = _base_candidate(
            game_id=game_id,
            opening_id=opening_id,
            side=side,
            snapshot=snapshot,
            issue_type="intended_repertoire_move_missed" if repertoire_source else "left_known_opening_territory",
            explanation=("The game diverged from the saved active repertoire line at this position." if repertoire_source else "The game left the available expected opening line at this position."),
            evidence=f"The saved {('repertoire' if repertoire_source else 'opening reference')} line contains {recommended}, while the PGN records {snapshot['playedMove']}.",
            confidence=0.86 if repertoire_source else 0.76,
            source=source,
            recommended_move=recommended,
        )
        candidate["expectedMoves"] = expected[ply : ply + 6]
        return candidate
    return None


def _analysis_candidates(game: Dict[str, Any], game_id: str, opening_id: str, side: str, snapshots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows = next((_list(game.get(key)) for key in ("moveAnalysis", "move_analysis", "openingMoveAnalysis", "opening_move_analysis") if game.get(key)), [])
    candidates = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        issue = SUPPORTED_ANALYSIS_ISSUES.get(_text(row.get("issueType") or row.get("issue_type")).lower())
        explanation = _text(row.get("explanation") or row.get("reason") or row.get("evidence"))
        if not issue or not explanation:
            continue
        move_number = int(row.get("moveNumber") or row.get("move_number") or 0)
        opening_plan_related = bool(row.get("openingPlanRelated") or row.get("opening_plan_related"))
        if move_number > OPENING_PHASE_END_MOVE and not opening_plan_related:
            continue
        position_key = _normalised_position(row.get("positionFen") or row.get("position_fen"))
        snapshot = next((item for item in snapshots if position_key and item["positionKey"] == position_key), None)
        if not snapshot:
            snapshot = next((item for item in snapshots if item["moveNumber"] == move_number), None)
        if not snapshot:
            continue
        raw_confidence = row.get("confidence")
        confidence_labels = {"low": 0.45, "medium": 0.65, "high": 0.82}
        if _text(raw_confidence).lower() in confidence_labels:
            confidence = confidence_labels[_text(raw_confidence).lower()]
        else:
            try:
                confidence = float(raw_confidence)
                if confidence > 1:
                    confidence /= 100
            except (TypeError, ValueError):
                confidence = 0.68
        analysis_source = _text(row.get("source") or "existing_move_analysis").lower()
        raw_recommended = row.get("recommendedMove") or row.get("recommended_move")
        explicit_reliability = row.get("recommendedMoveReliable") if "recommendedMoveReliable" in row else row.get("recommended_move_reliable")
        if explicit_reliability is not None:
            reliable = bool(explicit_reliability)
        elif raw_confidence is not None:
            reliable = confidence >= 0.65
        else:
            reliable = any(token in analysis_source for token in ("engine", "book", "repertoire", "expected"))
        recommended = _legal_san(snapshot["board"], raw_recommended) if reliable else None
        alternatives = []
        if reliable:
            for alternative in _list(row.get("alternativeMoves") or row.get("alternative_moves")):
                legal = _legal_san(snapshot["board"], alternative)
                if legal and legal != recommended and legal not in alternatives:
                    alternatives.append(legal)
        evidence = _text(row.get("evidenceText") or row.get("evidence_text")) or explanation
        candidate = _base_candidate(game_id=game_id, opening_id=opening_id, side=side, snapshot=snapshot, issue_type=issue, explanation=explanation, evidence=evidence, confidence=confidence, source=_text(row.get("source") or "existing_move_analysis"), recommended_move=recommended, alternatives=alternatives[:4])
        saved_line = next((_line_moves(row.get(key)) for key in ("expectedMoves", "expected_moves", "lineMoves", "line_moves") if row.get(key)), [])
        if saved_line:
            candidate["expectedMoves"] = saved_line[:12]
        candidates.append(candidate)
    return candidates


def _developed_minors(board: chess.Board, colour: bool) -> int:
    home = {chess.WHITE: {chess.B1, chess.C1, chess.F1, chess.G1}, chess.BLACK: {chess.B8, chess.C8, chess.F8, chess.G8}}[colour]
    return sum(1 for square in board.pieces(chess.KNIGHT, colour) | board.pieces(chess.BISHOP, colour) if square not in home)


def _heuristic_candidates(game_id: str, opening_id: str, side: str, colour: bool, snapshots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    opening = [snapshot for snapshot in snapshots if snapshot["moveNumber"] <= OPENING_PHASE_END_MOVE]
    if not opening:
        return []
    candidates = []
    queen = next((snapshot for snapshot in opening if snapshot["moveNumber"] <= 5 and snapshot["playedMove"].startswith("Q") and _developed_minors(snapshot["board"], colour) < 2), None)
    if queen:
        candidates.append(_base_candidate(game_id=game_id, opening_id=opening_id, side=side, snapshot=queen, issue_type="early_queen_movement", explanation="The queen moved before two minor pieces were developed, which can spend an opening tempo and give the opponent a target.", evidence=f"The PGN records {queen['playedMove']} on move {queen['moveNumber']} while fewer than two minor pieces had left their starting squares.", confidence=0.58, source="deterministic_pgn_heuristic"))

    reached_ten = any(snapshot["moveNumber"] >= 10 for snapshot in opening)
    castled_by_ten = any(snapshot["moveNumber"] <= 10 and snapshot["playedMove"] in {"O-O", "O-O-O"} for snapshot in opening)
    delayed = next((snapshot for snapshot in opening if snapshot["moveNumber"] >= 9 and snapshot["board"].has_castling_rights(colour)), None)
    if reached_ten and not castled_by_ten and delayed:
        candidates.append(_base_candidate(game_id=game_id, opening_id=opening_id, side=side, snapshot=delayed, issue_type="delayed_castling", explanation="The king remained uncastled through move 10 while castling rights were still available.", evidence="The PGN reaches move 10 without the user's king castling; this is a king-safety review cue, not a claim that castling was tactically forced.", confidence=0.54, source="deterministic_pgn_heuristic"))

    late = next((snapshot for snapshot in reversed(opening) if snapshot["moveNumber"] <= 10), None)
    if reached_ten and late and _developed_minors(late["board"], colour) < 2:
        candidates.append(_base_candidate(game_id=game_id, opening_id=opening_id, side=side, snapshot=late, issue_type="missing_development_move", explanation="Fewer than two minor pieces were developed by move 10.", evidence="The reconstructed PGN position still has at least three minor pieces on their starting squares around move 10.", confidence=0.55, source="deterministic_pgn_heuristic"))
    return candidates


def _group_candidates(candidates: List[Dict[str, Any]], user_id: str, limit: int) -> List[Dict[str, Any]]:
    grouped: Dict[Tuple[str, str, str, str], List[Dict[str, Any]]] = defaultdict(list)
    for candidate in candidates:
        grouped[(candidate["openingId"], candidate["side"], candidate["positionKey"], candidate["issueType"])].append(candidate)
    opportunities = []
    for key, rows in grouped.items():
        unique_games = sorted({row["gameId"] for row in rows})
        representative = sorted(rows, key=lambda row: (row["gameId"], row["moveNumber"], row["playedMove"]))[0]
        recurrence = len(unique_games)
        confidence = min(0.95, float(representative["confidence"]) + min(0.14, max(0, recurrence - 1) * 0.07))
        digest = hashlib.sha256(f"{user_id}|{'|'.join(key)}".encode("utf-8", errors="ignore")).hexdigest()[:20]
        recurrence_evidence = f" Detected in {recurrence} analysed game{'s' if recurrence != 1 else ''} at the same normalised position." if recurrence > 1 else ""
        opportunity = {field: value for field, value in representative.items() if field not in {"positionKey", "board"}}
        opportunity.update({"opportunityId": f"opening-opportunity-{digest}", "userId": user_id, "confidence": round(confidence, 2), "recurrenceCount": recurrence, "evidence": f"{representative['evidence']}{recurrence_evidence}"})
        opportunities.append(opportunity)
    def source_priority(source: str) -> int:
        source = _text(source).lower()
        if source == "active_repertoire_line":
            return 4
        if any(token in source for token in ("engine", "move_analysis", "expected")):
            return 3
        if source == "opening_reference_line":
            return 2
        return 1

    opportunities.sort(key=lambda row: (-row["recurrenceCount"], -source_priority(row["source"]), -row["confidence"], row["moveNumber"], row["opportunityId"]))
    return opportunities[: max(1, min(30, int(limit or DEFAULT_OPPORTUNITY_LIMIT)))]


def extract_opening_training_opportunities(
    games: List[Dict[str, Any]], *, user_id: str, username: str = "",
    repertoire: Optional[List[Dict[str, Any]]] = None, limit: int = DEFAULT_OPPORTUNITY_LIMIT,
) -> List[Dict[str, Any]]:
    """Extract bounded, deterministic opening opportunities without running an engine."""
    candidates: List[Dict[str, Any]] = []
    recent_games = sorted(
        games or [],
        key=_game_timestamp,
        reverse=True,
    )[:DEFAULT_GAME_INPUT_LIMIT]
    for raw_game in recent_games:
        if not isinstance(raw_game, dict):
            continue
        pgn = _text(raw_game.get("pgn") or raw_game.get("rawPgn") or raw_game.get("raw_pgn"))
        parsed = _game_from_pgn(pgn)
        if not parsed:
            continue
        colour = _user_colour(raw_game, parsed, username)
        if colour is None:
            continue
        snapshots, sans = _snapshots(parsed, colour)
        if not snapshots:
            continue
        name = _opening_name(raw_game, parsed, sans)
        opening_id = _text(raw_game.get("openingId") or raw_game.get("opening_id")) or _canonical_opening_id(name)
        side = "white" if colour == chess.WHITE else "black"
        game_id = _game_id(raw_game, pgn)
        expected, expected_source = _expected_line(raw_game, name, opening_id, repertoire or [])
        expected_candidate = _expected_line_candidate(game_id, opening_id, side, snapshots, sans, expected, expected_source)
        if expected_candidate:
            candidates.append(expected_candidate)
        candidates.extend(_analysis_candidates(raw_game, game_id, opening_id, side, snapshots))
        candidates.extend(_heuristic_candidates(game_id, opening_id, side, colour, snapshots))
    return _group_candidates(candidates, _text(user_id), limit)
