import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, rows):
        self.rows = rows
        self.filters = []

    def select(self, _columns): return self
    def eq(self, column, value): self.filters.append((column, str(value))); return self
    def gte(self, _column, _value): return self
    def lte(self, _column, _value): return self
    def order(self, _column, desc=False): return self
    def in_(self, column, values): self.filters.append((column, {str(value) for value in values})); return self

    def execute(self):
        rows = self.rows
        for column, value in self.filters:
            if isinstance(value, set):
                rows = [row for row in rows if str(row.get(column)) in value]
            else:
                rows = [row for row in rows if str(row.get(column)) == value]
        return Result([dict(row) for row in rows])


class AdminStore:
    def __init__(self):
        self.rows = {
            "referral_partners": [{"id": "partner-1", "name": "Coach", "code": "coach", "email": "coach@example.com", "commission_type": "fixed", "commission_value": 2, "is_active": True, "created_at": "2026-07-01T00:00:00Z"}],
            "referral_visits": [
                {"referral_partner_id": "partner-1", "referral_code": "coach", "visitor_id": "one", "landing_path": "/", "created_at": "2026-07-10T10:00:00Z"},
                {"referral_partner_id": "partner-1", "referral_code": "coach", "visitor_id": "two", "landing_path": "/pricing", "created_at": "2026-07-10T11:00:00Z"},
            ],
            "referral_attributions": [
                {"referral_partner_id": "partner-1", "referral_code": "coach", "referred_user_id": "user-a", "status": "converted", "gross_amount": 10, "commission_amount": 2, "currency": "gbp", "registered_at": "2026-07-10T00:00:00Z", "converted_at": "2026-07-11T00:00:00Z", "refunded_at": None},
                {"referral_partner_id": "partner-1", "referral_code": "coach", "referred_user_id": "user-b", "status": "refunded", "gross_amount": 10, "commission_amount": 2, "currency": "gbp", "registered_at": "2026-07-10T00:00:00Z", "converted_at": "2026-07-11T00:00:00Z", "refunded_at": "2026-07-12T00:00:00Z"},
            ],
            "profiles": [
                {"user_id": "user-a", "email": "alice@example.com"},
                {"user_id": "user-b", "email": "bob@example.com"},
            ],
        }

    def table(self, name):
        return Query(self.rows[name])


def test_admin_allow_list_is_fail_closed(monkeypatch):
    monkeypatch.delenv("OPENINGFIT_ADMIN_USER_IDS", raising=False)
    monkeypatch.delenv("OPENINGFIT_ADMIN_EMAILS", raising=False)
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id="owner", email="owner@example.com"))
    with pytest.raises(HTTPException) as exc:
        main.require_admin_user(SimpleNamespace())
    assert exc.value.status_code == 403


def test_admin_allow_list_accepts_configured_id_or_email(monkeypatch):
    monkeypatch.setenv("OPENINGFIT_ADMIN_USER_IDS", "owner-id")
    monkeypatch.setenv("OPENINGFIT_ADMIN_EMAILS", "OWNER@EXAMPLE.COM")
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id="owner-id", email="different@example.com"))
    assert main.require_admin_user(SimpleNamespace()).id == "owner-id"
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id="other", email="owner@example.com"))
    assert main.require_admin_user(SimpleNamespace()).email == "owner@example.com"


def test_admin_report_masks_users_and_excludes_refunds_from_commission_owed():
    report = main.build_referral_admin_report(AdminStore())
    assert report["summary"] == {
        "totalVisits": 2,
        "registrations": 2,
        "confirmedSales": 2,
        "conversionRate": 100.0,
        "grossRevenue": 20.0,
        "outstandingCommission": 2.0,
        "refundedReferrals": 1,
    }
    assert report["partners"][0]["commissionOwed"] == 2.0
    assert report["referrals"][0]["referredEmail"] == "a****@example.com"
    assert all("referred_user_id" not in row for row in report["referrals"])
    assert report["visitsOverTime"] == [{"partnerId": "partner-1", "date": "2026-07-10", "visits": 2}]
