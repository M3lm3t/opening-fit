/**
 * @typedef {'free' | 'monthly_subscription' | 'annual_subscription' | 'lifetime'} PremiumAccessType
 * @typedef {'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'expired'} PremiumStatus
 *
 * @typedef {Object} PremiumEntitlement
 * @property {boolean} hasPremiumAccess
 * @property {PremiumAccessType} accessType
 * @property {PremiumStatus} status
 * @property {string | null} currentPeriodEnd
 * @property {boolean} cancelAtPeriodEnd
 * @property {string | null} stripeCustomerId
 * @property {string | null} stripeSubscriptionId
 */

const SUBSCRIPTION_TYPES = new Set(["monthly_subscription", "annual_subscription"]);

export const OPENINGFIT_FEATURES = Object.freeze({
  INITIAL_REPORT: "initial_report",
  BASIC_SCORE: "basic_score",
  STYLE_PROFILE: "style_profile",
  KEEP_RECOMMENDATION: "keep_recommendation",
  REPAIR_RECOMMENDATION: "repair_recommendation",
  NEXT_ACTION: "next_action",
  REPORT_REFRESH: "report_refresh",
  GAME_HISTORY: "game_history",
  WEEKLY_PLAN_PREVIEW: "weekly_plan_preview",
  REPORT_COMPARISON: "report_comparison",
  FULL_REPERTOIRE: "full_repertoire",
  WEEKLY_PLAN: "weekly_plan",
  OWN_GAME_DRILLS: "own_game_drills",
  TRAINING_HISTORY: "training_history",
  PROGRESS_OUTCOMES: "progress_outcomes",
  SAVED_REPORT_HISTORY: "saved_report_history",
  FULL_RECOMMENDATION_EVIDENCE: "full_recommendation_evidence",
});

const free = (limits = {}) => Object.freeze({ tier: "free", preview: false, limits: Object.freeze(limits) });
const paid = (preview, limits = {}) => Object.freeze({ tier: "paid", preview, limits: Object.freeze(limits) });

/** One packaging matrix. Components may ask about capabilities, never plan names. */
export const FEATURE_ENTITLEMENTS = Object.freeze({
  [OPENINGFIT_FEATURES.INITIAL_REPORT]: free({ reports: 1 }),
  [OPENINGFIT_FEATURES.BASIC_SCORE]: free(),
  [OPENINGFIT_FEATURES.STYLE_PROFILE]: free(),
  [OPENINGFIT_FEATURES.KEEP_RECOMMENDATION]: free({ items: 1 }),
  [OPENINGFIT_FEATURES.REPAIR_RECOMMENDATION]: free({ items: 1 }),
  [OPENINGFIT_FEATURES.NEXT_ACTION]: free({ items: 1 }),
  [OPENINGFIT_FEATURES.REPORT_REFRESH]: free({ minimumMinutesBetweenRefreshes: 60 }),
  [OPENINGFIT_FEATURES.GAME_HISTORY]: free({ months: 3, evidenceGames: 8 }),
  [OPENINGFIT_FEATURES.WEEKLY_PLAN_PREVIEW]: free({ tasks: 1 }),
  [OPENINGFIT_FEATURES.REPORT_COMPARISON]: paid("Compare this report with your previous analysis."),
  [OPENINGFIT_FEATURES.FULL_REPERTOIRE]: paid("Save a complete White and Black repertoire workspace."),
  [OPENINGFIT_FEATURES.WEEKLY_PLAN]: paid("Turn your report into a complete personalised week of training.", { tasks: 5 }),
  [OPENINGFIT_FEATURES.OWN_GAME_DRILLS]: paid("Practise positions and recurring mistakes from your own games."),
  [OPENINGFIT_FEATURES.TRAINING_HISTORY]: paid("Review completed training and revisit earlier focuses."),
  [OPENINGFIT_FEATURES.PROGRESS_OUTCOMES]: paid("See whether trained ideas appeared in later games."),
  [OPENINGFIT_FEATURES.SAVED_REPORT_HISTORY]: paid("Keep reports safely and revisit your OpeningFit progress.", { reports: 50 }),
  [OPENINGFIT_FEATURES.FULL_RECOMMENDATION_EVIDENCE]: paid("See every supporting game and the full evidence behind recommendations.", { evidenceGames: 48 }),
});

export function getFeatureAccess(featureName) {
  return FEATURE_ENTITLEMENTS[featureName] || null;
}

export function canUseFeature(userEntitlement, featureName) {
  const feature = getFeatureAccess(featureName);
  if (!feature) return false;
  return feature.tier === "free" || Boolean(userEntitlement?.hasPremiumAccess);
}

export function featureLimit(userEntitlement, featureName, limitName, fallback = null) {
  const feature = getFeatureAccess(featureName);
  if (!feature || !canUseFeature(userEntitlement, featureName)) return fallback;
  if (userEntitlement?.hasPremiumAccess) {
    if (featureName === OPENINGFIT_FEATURES.GAME_HISTORY && limitName === "months") return 12;
    if (featureName === OPENINGFIT_FEATURES.GAME_HISTORY && limitName === "evidenceGames") return 48;
    if (featureName === OPENINGFIT_FEATURES.REPORT_REFRESH && limitName === "minimumMinutesBetweenRefreshes") return 5;
  }
  return feature.limits?.[limitName] ?? fallback;
}

export function featurePreview(featureName) {
  return getFeatureAccess(featureName)?.preview || "Upgrade to unlock this OpeningFit feature.";
}

function timestamp(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function accessTypeFor(row) {
  const stored = String(row?.access_type || "").toLowerCase();
  if (stored === "lifetime" || SUBSCRIPTION_TYPES.has(stored)) return stored;
  if (String(row?.checkout_mode || "").toLowerCase() === "payment") return "lifetime";
  if (String(row?.checkout_mode || "").toLowerCase() === "subscription") return "monthly_subscription";
  return "free";
}

function statusFor(row, accessType) {
  const raw = String(row?.status || "").toLowerCase();
  if (accessType === "lifetime") {
    return row?.is_grandfathered_lifetime || raw === "active" || raw === "trialing" ? "active" : "expired";
  }
  if (["active", "trialing", "past_due", "canceled", "incomplete", "expired"].includes(raw)) return raw;
  if (raw === "cancelled") return "canceled";
  return "expired";
}

/**
 * Canonical frontend resolver. Its input must be rows read from the protected
 * premium_entitlements table; profile fields, redirects and browser state are
 * deliberately not accepted.
 *
 * @param {Array<Record<string, any>>} entitlementRows
 * @param {{ now?: number }} options
 * @returns {PremiumEntitlement}
 */
export function resolvePremiumEntitlement(entitlementRows = [], { now = Date.now() } = {}) {
  const rows = Array.isArray(entitlementRows) ? entitlementRows.filter(Boolean) : [];
  const lifetime = rows.find((row) => accessTypeFor(row) === "lifetime");
  const row = lifetime || rows[0] || null;
  const accessType = accessTypeFor(row);
  const status = statusFor(row, accessType);
  const currentPeriodEnd = accessType === "lifetime"
    ? null
    : timestamp(row?.current_period_end || row?.expires_at);
  const periodIsCurrent = Boolean(currentPeriodEnd && Date.parse(currentPeriodEnd) > now);
  const previouslyActivated = Boolean(row?.premium_since);

  let hasPremiumAccess = accessType === "lifetime" && status === "active";
  if (SUBSCRIPTION_TYPES.has(accessType)) {
    hasPremiumAccess = status === "active" || status === "trialing";
    if (status === "canceled") hasPremiumAccess = periodIsCurrent;
    if (status === "past_due" || status === "incomplete") {
      hasPremiumAccess = previouslyActivated && periodIsCurrent;
    }
  }

  return {
    hasPremiumAccess,
    accessType,
    status,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    stripeCustomerId: row?.stripe_customer_id || null,
    stripeSubscriptionId: row?.stripe_subscription_id || null,
  };
}

export const FREE_ENTITLEMENT = Object.freeze(resolvePremiumEntitlement());
