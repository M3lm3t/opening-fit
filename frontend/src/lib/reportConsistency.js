import { canonicalReportAction } from "./reportViews.js";

const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? "").trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

function contextKey(row = {}) {
  return [row.openingId || row.opening_id || row.openingName || row.opening, row.repertoireRole || row.repertoire_role, row.role, row.relationship, row.playerColour || row.player_colour].map(text).join("::");
}

function confidenceDimensions(row = {}) {
  return [
    ["sample-size", row.sampleSizeConfidence || row.evidenceConfidence],
    ["classification", row.classificationConfidence],
    ["role-attribution", row.roleAttributionConfidence],
    ["recommendation", row.recommendationConfidence],
  ];
}

function firstWhiteMove(game = {}) {
  const explicit = text(game.firstWhiteMove || game.first_white_move).replace(/[+#?!]+$/g, "");
  if (explicit) return explicit;
  if (Array.isArray(game.moves)) return text(game.moves[0]).replace(/[+#?!]+$/g, "");
  if (typeof game.moves === "string") return text(game.moves.split(/\s+/)[0]).replace(/[+#?!]+$/g, "");
  const body = text(game.pgn).split(/\r?\n/).filter((line) => !line.trim().startsWith("[")).join(" ").replace(/\{[^}]*\}|\([^)]*\)|\$\d+/g, " ");
  for (const token of body.split(/\s+/)) {
    const move = token.replace(/^\d+\.(\.\.)?/, "").replace(/[+#?!]+$/g, "");
    if (move && !["1-0", "0-1", "1/2-1/2", "*"].includes(move)) return move;
  }
  return "";
}

export function roleIsLegal(role, game = {}) {
  const colour = text(game.playerColour || game.player_colour || game.perspective?.userColour).toLowerCase();
  const move = firstWhiteMove(game);
  const relationship = text(game.relationship || game.perspective?.relationship).toLowerCase();
  const played = ["played", "played_by_user"].includes(relationship);
  if (role === "white") return colour === "white" && played;
  if (role === "black_vs_e4") return colour === "black" && played && move === "e4";
  if (role === "black_vs_d4") return colour === "black" && played && move === "d4";
  return false;
}

function gameIndexForReport(report = {}) {
  const games = [
    ...list(report.analysis_game_index || report.analysisGameIndex),
    ...list(report.opening_games || report.openingGames),
  ];
  return new Map(games.map((game) => [text(game.gameId || game.game_id || game.url), game]).filter(([id]) => id));
}

function roleSupport(row = {}) {
  const ids = list(row.evidenceGameIds || row.supportingGameIds || row.sample?.gameIds || row.sample?.game_ids).map(text).filter(Boolean);
  const declared = number(row.supportingGameCount ?? row.evidenceCount ?? row.sampleSize ?? row.sample?.games ?? row.games);
  return { ids, declared };
}

function roleClaimValidation(row, gameIndex) {
  const role = text(row?.repertoireRole || row?.repertoire_role || row?.repertoireSlot || row?.repertoire_slot || row?.context || row?.role).toLowerCase();
  if (!["white", "black_vs_e4", "black_vs_d4"].includes(role)) return { role, valid: true, reason: null };
  const relationship = text(row.relationship || row.perspective?.relationship).toLowerCase();
  if (["faced", "faced_by_user", "opponent"].includes(relationship)) return { role, valid: true, reason: null };
  const { ids, declared } = roleSupport(row);
  const opening = text(row.currentOpening || row.openingName || row.opening_name || row.opening);
  const status = text(row.status || row.evidenceStatus).toLowerCase();
  if (!ids.length && (declared === 0 || (!opening && ["insufficient", "unresolved"].includes(status)))) {
    return { role, valid: true, reason: null };
  }
  if (!ids.length || (declared !== null && declared !== ids.length)) return { role, valid: false, reason: "missing_role_support_context" };
  const invalidId = ids.find((id) => !gameIndex.has(id) || !roleIsLegal(role, gameIndex.get(id)));
  return { role, valid: !invalidId, reason: invalidId ? `illegal_role_support:${role}:${invalidId}` : null };
}

function unresolvedRole(row = {}) {
  const threshold = number(row.requiredGameCount ?? row.sampleThreshold ?? row.evidenceRequirement?.threshold) ?? 5;
  return {
    ...row,
    status: "insufficient",
    evidenceStatus: "insufficient",
    currentOpening: null,
    openingName: null,
    supportingGameCount: 0,
    evidenceCount: 0,
    relevantGameCount: 0,
    evidenceGameIds: [],
    supportingGameIds: [],
    gamesNeeded: threshold,
    roleContractVerified: false,
    validation: { ...(row.validation || {}), valid: false, reason: "unverifiable_role_context" },
  };
}

export function enforceReportRoleContract(report = {}) {
  if (!report || typeof report !== "object") return { report, valid: false, violations: ["invalid_report"] };
  const gameIndex = gameIndexForReport(report);
  const sourceDecision = report.reportDecision || report.report_decision;
  if (!sourceDecision || typeof sourceDecision !== "object") return { report, valid: true, violations: [] };
  const violations = [];
  const roles = list(sourceDecision.repertoireRoles || sourceDecision.roleDecisions).map((row) => {
    const result = roleClaimValidation(row, gameIndex);
    if (!result.valid) {
      violations.push(result.reason);
      return unresolvedRole(row);
    }
    return { ...row, roleContractVerified: true, validation: { ...(row.validation || {}), valid: true } };
  });
  const recommendations = list(sourceDecision.recommendations).flatMap((row) => {
    const result = roleClaimValidation(row, gameIndex);
    if (!result.valid) {
      violations.push(result.reason);
      return [];
    }
    return [{ ...row, roleContractVerified: true, validation: { ...(row.validation || {}), valid: true } }];
  });
  const decision = { ...sourceDecision, repertoireRoles: roles, roleDecisions: roles, recommendations };
  const keepUntrustedOpening = (row, { blackBucket = false } = {}) => {
    if (!row || typeof row !== "object") return !blackBucket;
    const role = text(row.repertoireRole || row.repertoire_role || row.repertoireSlot || row.repertoire_slot || row.context || row.role).toLowerCase();
    const colour = text(row.playerColour || row.player_colour || row.colour || row.color || row.openingSide).toLowerCase();
    if (!["white", "black_vs_e4", "black_vs_d4"].includes(role) && colour !== "black" && !blackBucket) return true;
    if (blackBucket && !["black_vs_e4", "black_vs_d4"].includes(role)) return false;
    return roleClaimValidation(row, gameIndex).valid && (!blackBucket || role.startsWith("black_"));
  };
  const cleanReport = { ...report, reportDecision: decision, report_decision: decision, repertoireRoles: roles };
  for (const key of ["top_openings", "topOpenings", "best_openings", "bestOpenings", "preferred_white", "preferredWhite"]) {
    if (Array.isArray(cleanReport[key])) cleanReport[key] = cleanReport[key].filter((row) => keepUntrustedOpening(row));
  }
  for (const key of ["preferred_black", "preferredBlack"]) {
    if (Array.isArray(cleanReport[key])) cleanReport[key] = cleanReport[key].filter((row) => keepUntrustedOpening(row, { blackBucket: true }));
  }
  for (const key of ["opening_recommendations", "openingRecommendations"]) {
    const source = cleanReport[key];
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    cleanReport[key] = Object.fromEntries(Object.entries(source).map(([bucket, rows]) => [
      bucket,
      list(rows).filter((row) => keepUntrustedOpening(row, { blackBucket: ["black_vs_e4", "blackVsE4", "black_vs_d4", "blackVsD4"].includes(bucket) })),
    ]));
  }
  return {
    report: cleanReport,
    valid: violations.length === 0,
    violations: [...new Set(violations)],
  };
}

const ACTION_SUPPORT = Object.freeze({
  open_evidence: "evidence",
  open_diagnosed_problem: "problems",
  open_repertoire_priority: "repertoire",
  open_training_priority: "train",
});

export function validateReportConsistency(report = {}) {
  const decision = report.reportDecision || report.report_decision || {};
  const recommendations = list(decision.recommendations);
  const enforceable = Number(decision.schemaVersion || decision.schema_version || 0) >= 5;
  const violations = [];
  const verdictById = new Map();
  const contexts = new Set();
  const gameIndex = gameIndexForReport(report);

  for (const row of recommendations) {
    const decisionId = text(row.decisionId || row.recommendationId);
    const verdict = text(row.verdict).toLowerCase();
    if (decisionId && verdictById.has(decisionId) && verdictById.get(decisionId) !== verdict) violations.push(`conflicting_verdict:${decisionId}`);
    if (decisionId) verdictById.set(decisionId, verdict);

    const ids = list(row.sample?.gameIds || row.sample?.game_ids).map(text).filter(Boolean);
    if (ids.length !== new Set(ids).size) violations.push(`duplicate_game_in_aggregate:${decisionId || contextKey(row)}`);

    const key = contextKey(row);
    if (contexts.has(key)) violations.push(`duplicate_opening_context:${key}`);
    contexts.add(key);

    const colour = text(row.playerColour || row.player_colour).toLowerCase();
    const role = text(row.repertoireRole || row.repertoire_role).toLowerCase();
    if (colour === "white" && role.startsWith("black_")) violations.push(`white_candidate_in_black_role:${decisionId || key}`);

    if (enforceable) {
      const claim = roleClaimValidation(row, gameIndex);
      if (!claim.valid) violations.push(`${claim.reason}:recommendation:${decisionId || key}`);
    }

    if (enforceable) {
      for (const [dimension, confidence] of confidenceDimensions(row)) {
        const label = text(confidence?.label || confidence?.scope);
        if (!confidence || !label) violations.push(`missing_${dimension}_confidence:${decisionId || key}`);
      }
    }
  }

  for (const role of list(decision.repertoireRoles || decision.roleDecisions)) {
    const roleId = text(role.repertoireRole || role.role);
    const supportingIds = list(role.evidenceGameIds || role.supportingGameIds).map(text).filter(Boolean);
    const declaredSupport = number(role.supportingGameCount ?? role.evidenceCount ?? role.sampleSize);
    if (enforceable && declaredSupport !== null && declaredSupport !== supportingIds.length) violations.push(`role_support_count_mismatch:${roleId}`);
    for (const gameId of supportingIds) {
      const game = gameIndex.get(gameId);
      if (!game || !roleIsLegal(roleId, game)) violations.push(`illegal_role_support:${roleId}:${gameId}`);
    }
    const current = number(role.supportingGameCount ?? role.evidenceCount ?? role.sampleSize);
    const threshold = number(role.requiredGameCount ?? role.sampleThreshold ?? role.evidenceRequirement?.threshold);
    const stated = number(role.evidenceRequirement?.additionalRelevantGamesRequired ?? role.evidenceFunnel?.additionalRequired ?? role.gamesNeeded);
    if (current !== null && threshold !== null && stated !== null && stated !== Math.max(0, threshold - current)) violations.push(`games_needed_mismatch:${text(role.repertoireRole || role.key)}`);
    const action = decision.primaryAction || decision.nextTrainingAction || {};
    if (text(action.repertoireRole) === text(role.repertoireRole) && action.completionTarget?.type === "new_games" && stated !== null && number(action.completionTarget.count) !== stated) violations.push(`games_needed_cta_mismatch:${text(role.repertoireRole)}`);
  }

  const diagnoses = list(report.displayedDiagnoses || decision.displayedDiagnoses);
  const diagnosisIds = diagnoses.map((item) => text(item?.diagnosisId || item?.diagnosis_id)).filter(Boolean);
  if (diagnosisIds.length !== new Set(diagnosisIds).size) violations.push("duplicate_diagnosis_id");
  if (diagnoses.some((item) => !text(item?.diagnosisId || item?.diagnosis_id))) violations.push("missing_diagnosis_id");
  const canonicalDiagnosis = decision.openingDiagnosis || decision.opening_diagnosis;
  if (canonicalDiagnosis?.openingScopeEvidence) {
    const openingIds = list(canonicalDiagnosis.openingScopeEvidence.supportingGameIds).map(text).filter(Boolean);
    if (openingIds.length !== new Set(openingIds).size || openingIds.length !== number(canonicalDiagnosis.openingScopeEvidence.supportingGameCount)) violations.push("opening_diagnosis_scope_mismatch");
    const line = canonicalDiagnosis.repeatedLineEvidence;
    if (line) {
      const lineIds = list(line.supportingGameIds).map(text).filter(Boolean);
      if (lineIds.length !== new Set(lineIds).size || lineIds.length !== number(line.supportingGameCount) || lineIds.some((id) => !openingIds.includes(id))) violations.push("line_diagnosis_scope_mismatch");
    }
  }

  for (const rawAction of list(report.reportActions)) {
    const action = canonicalReportAction(rawAction);
    if (!action.destinationRoute || !action.destinationSection) violations.push(`unknown_action_destination:${action.actionType}`);
    const supportedSection = ACTION_SUPPORT[action.actionType];
    if (supportedSection && action.destinationSection !== supportedSection) violations.push(`unsupported_action_destination:${action.actionType}`);
    if (action.actionType === "start_training" && !/^\/train(?:\?|$)/.test(action.destinationRoute)) violations.push("unsupported_action_destination:start_training");
  }

  const quality = report.importQuality || report.gameImportQuality || {};
  const complete = quality.reportCompleteness?.complete;
  const category = text(quality.category).toLowerCase();
  if (/strong|excellent/.test(category) && complete !== true) violations.push("quality_exceeds_report_completeness");

  const componentClaims = new Map();
  for (const component of list(decision.repertoireHealth?.components || report.repertoireHealth?.components)) {
    const healthIds = list(component.supportingGameIds).map(text).filter(Boolean);
    if (enforceable && (healthIds.length !== new Set(healthIds).size || healthIds.length !== number(component.supportingGameCount))) violations.push(`health_support_count_mismatch:${text(component.componentId)}`);
    if (enforceable && [component.componentId, component.targetCanonicalContextId, component.context, component.metric, component.direction, component.explanationReasonCode, component.destinationActionId].some((value) => !text(value))) violations.push(`unstructured_health_component:${text(component.componentId)}`);
    const target = text(component.targetDecisionId || component.targetDiagnosisId);
    const source = text(component.metric || component.evidenceSource || component.source);
    if (!target || !source) continue;
    const claim = `${text(component.status)} ${text(component.explanation)}`.toLowerCase();
    const polarity = /drag|hurt|negative|weak/.test(claim) ? "negative" : /help|strength|positive|support/.test(claim) ? "positive" : "neutral";
    const key = `${text(component.targetCanonicalContextId) || target}::${source}`;
    if (componentClaims.has(key) && componentClaims.get(key) !== polarity && ![componentClaims.get(key), polarity].includes("neutral")) violations.push(`contradictory_health_component:${key}`);
    componentClaims.set(key, polarity);
  }

  return { valid: violations.length === 0, enforceable, violations };
}

export function assertGeneratedReportConsistency(report = {}) {
  const result = validateReportConsistency(report);
  if (result.enforceable && !result.valid) throw new Error(`report_consistency: ${result.violations.join(", ")}`);
  return result;
}
