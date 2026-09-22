"""Conservative interpretation policy; never recalculates stored reports."""
from datetime import datetime

POLICY_VERSION = "report_comparison_v1"
HEALTH_VERSIONS = {"openingfit_score_v1", "repertoire_coverage_v2", "repertoire_coverage_v3", "repertoire_health_v2", "repertoire_health_v3", "repertoire_health_v4"}
DECISION_VERSIONS = {f"report_decision_v{i}" for i in range(1, 8)} | {"legacy_compatibility_v1"}


def build_comparison_cohort(games, months, time_control, counts):
    versions = {game.get("classificationContractVersion") for game in games}
    return {"version": POLICY_VERSION, "windowMonths": months, "timeControlFilter": time_control,
            "selectionRule": counts.get("analysisSelectionRule"), "analysisLimit": (counts["analysisLimit"] if counts["analysisLimit"] is not None else "unlimited") if "analysisLimit" in counts else None,
            "filterPolicyVersion": counts.get("contractVersion"),
            "classificationVersion": next(iter(versions)) if len(versions) == 1 else None,
            "timeControls": sorted({str(game.get("timeControl") or "unknown") for game in games}),
            "gameIds": sorted({str(game["gameId"]) for game in games if game.get("gameId")})}


def _date(report):
    try:
        return datetime.fromisoformat(str(report.get("generated_at") or report.get("importedAt") or report.get("imported_at") or report.get("lastUpdated") or "").replace("Z", "+00:00")).timestamp()
    except (ValueError, TypeError):
        return None


def comparison_eligibility(previous, current):
    previous, current = previous or {}, current or {}
    reasons = []
    def decision(report):
        return report.get("reportDecision") or report.get("report_decision") or {}
    def health(report):
        contract = (decision(report).get("repertoireHealth") or report.get("repertoireHealth") or report.get("repertoire_health") or report.get("repertoireCoverageScore") or report.get("repertoire_coverage_score") or report.get("openingFitScoreContract") or report.get("opening_fit_score_contract") or report.get("score_contract") or {})
        return contract.get("version") or contract.get("formulaVersion") or contract.get("formula_version")
    if health(previous) not in HEALTH_VERSIONS or health(previous) != health(current):
        reasons.append("Calculation versions are missing, unsupported or different.")
    if decision(previous).get("version") not in DECISION_VERSIONS or decision(previous).get("version") != decision(current).get("version"):
        reasons.append("Decision policies are missing, unsupported or different.")
    for label, keys in (("player", ("source_username", "username", "playerName")), ("platform", ("source_platform", "platform", "importPlatform"))):
        values = [str(next((report.get(key) for key in keys if report.get(key)), "")).strip().lower() for report in (previous, current)]
        if label == "platform":
            values = ["chess.com" if value == "chesscom" else value for value in values]
        if not all(values) or values[0] != values[1]:
            reasons.append(f"The {label} identity is missing or different.")
    a, b = [report.get("comparisonCohort") or report.get("comparison_cohort") or {} for report in (previous, current)]
    if a.get("version") != POLICY_VERSION or b.get("version") != POLICY_VERSION:
        reasons.append("Comparable cohort provenance is unavailable.")
    for key in ("windowMonths", "timeControlFilter", "selectionRule", "analysisLimit", "filterPolicyVersion", "classificationVersion"):
        if a.get(key) in (None, "") or b.get(key) in (None, "") or a.get(key) != b.get(key):
            reasons.append(f"Cohort {key} is missing or different.")
    for key in ("import_months", "filters"):
        av, bv = [(report.get("analysis_metadata") or {}).get(key) for report in (previous, current)]
        if av != bv:
            reasons.append(f"Reported {key} differs.")
    controls = lambda cohort: {str(value).strip().lower() for value in cohort.get("timeControls", [])}
    if not controls(a) or "unknown" in controls(a) or controls(a) != controls(b):
        reasons.append("Observed time controls are missing or different.")
    before_ids, after_ids = [set(map(str, cohort.get("gameIds") or [])) for cohort in (a, b)]
    if min(len(before_ids), len(after_ids)) < 5:
        reasons.append("At least five identified games are required in each report.")
    if len(after_ids) < len(before_ids):
        reasons.append("The current report has reduced game exposure.")
    if not after_ids - before_ids:
        reasons.append("No new identified games are available.")
    if _date(previous) is None or _date(current) is None or _date(previous) >= _date(current):
        reasons.append("Report chronology is missing or invalid.")
    return {"comparable": not reasons, "reasons": reasons, "policyVersion": POLICY_VERSION}


def opening_context_identity(row):
    context = row.get("canonicalContextId") or row.get("canonical_context_id")
    role = row.get("repertoireRole") or row.get("repertoire_role")
    colour = row.get("playerColour") or row.get("colour") or row.get("color")
    if not context or role not in {"white", "black_vs_e4", "black_vs_d4"} or colour != ("white" if role == "white" else "black"):
        return None
    return f"{context}|{role}|{colour}"


def observed_opening_performance(row):
    sample = row.get("sample") or row
    values = [sample.get(key) for key in ("wins", "draws", "losses")]
    if any(type(value) is not int or value < 0 for value in values):
        return None
    wins, draws, losses = values
    known = wins + draws + losses
    games = sample.get("games", row.get("games"))
    if not known or not isinstance(games, (int, float)) or known > games:
        return None
    return {"metric": "opening_score_rate", "version": "observed_performance_v1", "games": games, "knownResults": known, "winRate": 100 * wins / known, "scoreRate": 100 * (wins + .5 * draws) / known}
