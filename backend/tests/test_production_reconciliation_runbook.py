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


def test_reviewed_source_is_exact_and_consistent_across_operator_sql():
    approved_source = "legacy_lifetime_repair"
    paths = [
        "supabase/migrations/202607200002_production_entitlement_preservation.sql",
        "scripts/identify_production_reconciliation_candidates.sql",
        "scripts/preview_production_reconciliation_impact.sql",
        "scripts/validate_production_subscription_schema.sql",
        "scripts/diagnose_reviewed_production_entitlements.sql",
    ]
    for path in paths:
        sql = read(path)
        assert f"'{approved_source}'" in sql

    for path in paths:
        sql = normalized_predicate_fragment(read(path))
        assert approved_source in sql
        assert f"like '%{approved_source}%'" not in sql
        assert f"ilike '%{approved_source}%'" not in sql
        assert f"~ '{approved_source}" not in sql
        assert f"~* '{approved_source}" not in sql
        assert f"similar to '{approved_source}" not in sql
        assert f"'{approved_source}%" not in sql


def test_reviewed_source_cardinality_and_profile_backfill_are_fail_closed():
    migration = read(
        "supabase/migrations/202607200002_production_entitlement_preservation.sql"
    )
    validator = read("scripts/validate_production_subscription_schema.sql")
    harness = read("scripts/test_production_reconciliation.ps1")
    assert (
        "expected exactly two reviewed conservative lifetime entitlements"
        in migration
    )
    assert "conservative_candidate_count = 2" in migration
    assert "reviewed_source_total_count <> 2" in migration
    assert "reviewed_candidate_count = 2" in migration
    assert "reviewed_canonical_count = 2" in migration
    assert "reviewed_conflicting_count <> 0" in migration
    assert migration.count("coalesce(cancel_at_period_end, false) is false") >= 2
    assert "phase_number < 3 then 2 else 0" in validator
    assert "expected_count := 0;" in validator
    assert 'Invoke-CandidateCheck "openingfit_clean" 2 0' in harness
    assert "failure_entitlement_reviewed_candidate_count.sql" in harness
    assert "failure_entitlement_reviewed_candidate_extra.sql" in harness
    assert "failure_entitlement_reviewed_source_near_match.sql" in harness
    assert "failure_entitlement_reviewed_source_recurring.sql" in harness
    assert "failure_entitlement_reviewed_source_cancel_flag.sql" in harness
    assert "failure_entitlement_reviewed_source_third_recurring.sql" in harness
    assert "production_reconciliation_third_recurring_rollback_assertions.sql" in harness
    assert "failure_entitlement_reviewed_source_mixed.sql" in harness
    assert "failure_entitlement_reviewed_source_partial.sql" in harness


def test_reviewed_source_total_is_counted_before_evidence_filtering():
    migration = normalized_predicate_fragment(
        read("supabase/migrations/202607200002_production_entitlement_preservation.sql")
    )
    cohort_select = migration.split("select count(*) into conservative_candidate_count", 1)[1]
    cohort_select = cohort_select.split("reviewed_conflicting_count :=", 1)[0]
    assert "select count(*), count(*) filter" in cohort_select
    assert "where source = 'legacy_lifetime_repair'" in cohort_select
    assert cohort_select.rsplit("where source = 'legacy_lifetime_repair'", 1)[1].strip() == ";"

    for path in [
        "scripts/identify_production_reconciliation_candidates.sql",
        "scripts/preview_production_reconciliation_impact.sql",
        "scripts/validate_production_subscription_schema.sql",
        "scripts/diagnose_reviewed_production_entitlements.sql",
    ]:
        sql = read(path)
        assert "total_exact_source_cohort" in sql or "reviewed_source_total_exact_cohort" in sql
        assert "pristine_reviewed" in sql
        assert "canonical_reviewed" in sql
        assert "conflicting" in sql


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


def test_runbook_records_two_existing_lifetimes_and_no_profile_backfill():
    runbook = read("docs/production-reconciliation-execution-runbook.md")
    record = read("docs/production-reconciliation-execution-record.md")
    for text in (runbook, record):
        assert "ofr-v1-9bccdb630af841fe" in text
        assert "ofr-v1-3e8058d82714f9ee" in text
    assert "conservative candidates" in runbook
    assert "profile-without-entitlement" in runbook
    assert "profile-only backfill" in runbook
    assert "zero profile-derived entitlement insertions" in runbook
