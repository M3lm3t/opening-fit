from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def normalized_predicate_fragment(sql: str) -> str:
    return " ".join(sql.lower().split())


def test_identifier_safe_query_contains_exact_conservative_predicate():
    migration = normalized_predicate_fragment(
        read("supabase/migrations/202607200002_production_entitlement_preservation.sql")
    )
    locator = normalized_predicate_fragment(
        read("scripts/identify_production_reconciliation_candidates.sql")
    )

    required = [
        "access_type", "status", "expires_at", "stripe_customer_id",
        "stripe_subscription_id", "stripe_payment_intent_id", "stripe_price_id",
        "checkout_mode", "plan_interval", "stripe_status", "current_period_start",
        "current_period_end", "last_stripe_event_id",
        "last_stripe_event_created_at", "legacy_lifetime_backfill", "manual_support",
    ]
    for token in required:
        assert token in migration
        assert token in locator

    # cancel_at_period_end is deliberately not part of migration 2's candidate
    # predicate and must not accidentally narrow the locator.
    candidate_section = locator.split("union all", 1)[0]
    assert "cancel_at_period_end" not in candidate_section
    assert "or e.row_data ->> 'source' in" in candidate_section


def test_candidate_output_is_redacted_and_has_stop_evidence_gate():
    sql = read("scripts/identify_production_reconciliation_candidates.sql")
    output_sections = sql[sql.index("select\n  candidate_type,") :]
    assert "ofr-v1-" in output_sections
    assert "evidence_type_count" in output_sections
    assert "matching_webhook_rows" in output_sections
    assert "then 'STOP'" in output_sections
    assert "email" not in output_sections.lower()
    assert "full_name" not in output_sections.lower()


def test_operator_smokes_are_rollback_only_except_named_audit_row():
    reversible = [
        "scripts/smoke_production_reconciliation_foundation.sql",
        "scripts/smoke_production_reconciliation_entitlement.sql",
        "scripts/smoke_production_reconciliation.sql",
    ]
    for path in reversible:
        sql = normalized_predicate_fragment(read(path))
        assert sql.startswith("--")
        assert "begin;" in sql
        assert sql.endswith("rollback;")

    retained = normalized_predicate_fragment(
        read("scripts/retain_production_reconciliation_webhook_audit.sql")
    )
    assert "openingfit.reconciliation.smoke" in retained
    assert "commit;" in retained
    assert "stripe_webhook_events" in retained


def test_expected_failure_handlers_require_exact_error_contracts():
    reviewed = [
        "scripts/smoke_production_reconciliation_foundation.sql",
        "scripts/smoke_production_reconciliation.sql",
        "supabase/tests/production_reconciliation_assertions.sql",
        "supabase/tests/production_reconciliation_expected_error_contract.sql",
    ]
    combined = "\n".join(read(path).lower() for path in reviewed)
    assert combined.count("when others") == combined.count("get stacked diagnostics")
    assert "sqlerrm" not in combined

    foundation = read(
        "scripts/smoke_production_reconciliation_foundation.sql"
    )
    full = read("scripts/smoke_production_reconciliation.sql")
    assertions = read("supabase/tests/production_reconciliation_assertions.sql")
    for sql in (foundation, full, assertions):
        assert "returned_sqlstate" in sql
        assert "message_text" in sql
        assert "raise;" in sql
    assert "caught_state <> 'P0001'" in foundation
    assert (
        "caught_message <> 'profiles.is_premium can only be updated by trusted server code'"
        in foundation
    )
    assert full.count("caught_state <> '42501'") == 3
    assert full.count(
        "caught_message <> 'Paid OpeningFit access is required for this feature'"
    ) == 3


def test_expected_error_regression_covers_failure_modes_and_cleanup():
    sql = read("supabase/tests/production_reconciliation_expected_error_contract.sql")
    for case in [
        "The precise expected authorization contract is accepted",
        "no error",
        "incorrect SQLSTATE",
        "correct SQLSTATE with wrong message",
        "unrelated constraint error",
        "survived rollback",
    ]:
        assert case in sql


def test_runbook_forbids_history_repair_and_records_all_required_gates():
    runbook = read("docs/production-reconciliation-execution-runbook.md").lower()
    required = [
        "not restore-tested", "second complete **read-only** review",
        "blocked_session_count", "transactions_older_than_five_minutes",
        "approve lifetime", "migration-history", "production-schema-before.sql",
        "production-schema-after.sql", "zero persistent rows must change",
        "sole intentional persistent smoke change", "do not use `db push`",
    ]
    for phrase in required:
        assert phrase in runbook


def test_execution_record_has_required_evidence_fields():
    record = read("docs/production-reconciliation-execution-record.md").lower()
    for phrase in [
        "production project reference", "operator", "independent approver",
        "sha-256", "supabase cli version", "backup/pitr", "utc timestamp",
        "aggregate counts", "candidate decisions", "proceed/stop",
        "intentionally changed counts", "not restore-tested",
    ]:
        assert phrase in record
