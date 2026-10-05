"""Owner-scoped service for the isolated report namespace and legacy reads.

The isolated table has no anon/authenticated grants. Only authenticated API
requests reach this adapter; every query explicitly scopes the verified owner.
No writes, deletes or updates are ever sent to legacy tables here.
"""
from datetime import datetime, timezone
import hashlib
import json
from uuid import uuid4
from fastapi import HTTPException
from report_rollout import require_enabled

COLLECTIONS = frozenset({
    "report_history", "profiles", "openingfit_user_state", "openingfit_retention_snapshots",
    "recommendation_history", "analysed_games", "activity_history", "analysis_history",
    "saved_recommendations", "weekly_reports", "user_profiles", "repertoire", "saved_openings",
    "weekly_training_plans", "coaching_weekly_reviews", "coaching_response_plans",
    "repertoire_entries", "repertoires", "settings",
})
TABLE = "openingfit_report_store_v2"


def require_writable(client):
    require_enabled()
    rows = client.table("openingfit_report_rollout").select("enabled").eq("id", 1).execute().data or []
    if not rows or rows[0].get("enabled") is not True:
        raise HTTPException(503, "New report storage is disabled. Saved reports remain readable.")


def row_key(collection, row):
    if collection == "profiles":
        return "profile"
    if collection == "openingfit_user_state":
        return json.dumps([row.get("platform"), row.get("username")], separators=(",", ":"))
    if collection == "settings":
        return "settings"
    for key in ("report_key", "snapshot_key", "analysis_fingerprint", "game_id", "id"):
        if row.get(key):
            return str(row[key])
    return hashlib.sha256(json.dumps(row, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def read_rows(client, owner, collection):
    if collection not in COLLECTIONS:
        raise HTTPException(400, "Unsupported report collection.")
    # No error fallback to another owner, public username, or unfiltered query.
    legacy = client.table(collection).select("*").eq("user_id", owner).limit(500).execute().data or []
    isolated = client.table(TABLE).select("row_key,payload").eq("user_id", owner).eq("collection", collection).limit(500).execute().data or []
    rows = {row_key(collection, row): row for row in legacy}
    rows.update({row["row_key"]: row["payload"] for row in isolated})
    if collection == "profiles":
        # Profile metadata is not an entitlement source. Keep protected fields
        # authoritative even if a stored client payload contains them.
        for row in rows.values():
            row["is_premium"] = bool(legacy and legacy[0].get("is_premium"))
    return list(rows.values())


def write_rows(client, owner, collection, values, *, insert_only=False):
    if collection not in COLLECTIONS:
        raise HTTPException(400, "Unsupported report collection.")
    require_writable(client)
    result = []
    for supplied in values:
        if not isinstance(supplied, dict) or supplied.get("user_id", owner) != owner:
            raise HTTPException(403, "Report ownership mismatch.")
    for supplied in values:
        row = dict(supplied, user_id=owner)
        if collection == "profiles":
            row.pop("is_premium", None)
        key = row_key(collection, row)
        if collection in {"report_history", "analysis_history"}:
            legacy = client.table(collection).select("*").eq("user_id", owner).limit(500).execute().data or []
            original = next((item for item in legacy if row_key(collection, item) == key
                or (row.get("id") and item.get("id") == row["id"])), None)
            if original:
                result.append(original)
                continue
        existing = client.table(TABLE).select("payload").eq("user_id", owner).eq("collection", collection).eq("row_key", key).execute().data or []
        if existing and (insert_only or collection in {"report_history", "analysis_history"}):
            result.append(existing[0]["payload"])
            continue
        now = datetime.now(timezone.utc).isoformat()
        if existing:
            row = {**existing[0]["payload"], **row}
        row.setdefault("id", str(uuid4()))
        row.setdefault("created_at", now)
        row["updated_at"] = now
        client.table(TABLE).upsert({"user_id": owner, "collection": collection, "row_key": key,
            "payload": row}, on_conflict="user_id,collection,row_key").execute()
        result.append(row)
    return result


def query_store(client, owner, payload):
    collection = payload.collection
    filters = payload.filters
    for field, operator, value in filters:
        if operator not in {"eq", "in", "is", "neq", "gte", "lte"}:
            raise HTTPException(400, "Unsupported report filter.")
        if field == "user_id" and (operator != "eq" or value != owner):
            raise HTTPException(403, "Report ownership mismatch.")
    def matches(row):
        for field, op, value in filters:
            current = row.get(field)
            if op in {"eq", "is"} and current != value: return False
            if op == "neq" and current == value: return False
            if op == "in" and current not in value: return False
            if op == "gte" and (current is None or current < value): return False
            if op == "lte" and (current is None or current > value): return False
        return True
    if payload.operation in {"insert", "upsert"}:
        values = payload.values if isinstance(payload.values, list) else [payload.values]
        rows = write_rows(client, owner, collection, values, insert_only=payload.operation == "insert")
    elif payload.operation in {"select", "update"}:
        rows = [row for row in read_rows(client, owner, collection) if matches(row)]
        if payload.operation == "update":
            if collection in {"report_history", "analysis_history"}:
                raise HTTPException(409, "Saved reports are immutable.")
            if not isinstance(payload.values, dict):
                raise HTTPException(400, "Invalid report update.")
            rows = write_rows(client, owner, collection, [dict(row, **payload.values) for row in rows])
    else:
        raise HTTPException(409, "Historical reports are retained; this operation is unavailable.")
    for field, ascending in reversed(payload.order):
        rows.sort(key=lambda row: str(row.get(field) or ""), reverse=not ascending)
    rows = rows[:payload.limit]
    if payload.single:
        if len(rows) > 1 or (not rows and payload.single == "single"):
            return {"data": None, "error": {"code": "PGRST116", "message": "Expected one report row."}}
        return {"data": rows[0] if rows else None, "error": None}
    return {"data": rows, "error": None}
