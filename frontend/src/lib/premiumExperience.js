export const DEFAULT_BILLING_CONFIGURATION = Object.freeze({
  monthly: { available: false, configured: false, amount: 4.99, currency: "GBP" },
  annual: { available: false, configured: false, amount: 39.99, currency: "GBP" },
  foundingOffer: { enabled: false, firstYearAmount: null, renewsAtAmount: null },
  subscriptionsEnabled: false,
  checkoutReady: false,
  checkoutStatus: "backend_unavailable",
  unavailableReasons: ["backend_unavailable"],
  lifetimeMembersRetainAccess: true,
});

export const BILLING_INTERVAL_STORAGE_KEY = "openingFit:selectedBillingInterval";

const finiteMoney = (value, fallback) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;

export function normaliseBillingConfiguration(value = {}) {
  const monthlyAvailable = Boolean(value.monthly?.available);
  const annualAvailable = Boolean(value.annual?.available);
  const unavailableReasons = Array.isArray(value.unavailableReasons)
    ? value.unavailableReasons.filter((reason) => typeof reason === "string")
    : [];
  return {
    monthly: { available: monthlyAvailable, configured: value.monthly?.configured !== false, amount: finiteMoney(value.monthly?.amount, 4.99), currency: "GBP" },
    annual: { available: annualAvailable, configured: value.annual?.configured !== false, amount: finiteMoney(value.annual?.amount, 39.99), currency: "GBP" },
    foundingOffer: {
      enabled: Boolean(value.foundingOffer?.enabled && value.annual?.available),
      firstYearAmount: finiteMoney(value.foundingOffer?.firstYearAmount, null),
      renewsAtAmount: finiteMoney(value.foundingOffer?.renewsAtAmount, 39.99),
    },
    subscriptionsEnabled: Boolean(value.subscriptionsEnabled),
    checkoutReady: Boolean(value.checkoutReady ?? (monthlyAvailable && annualAvailable)),
    checkoutStatus: typeof value.checkoutStatus === "string" ? value.checkoutStatus : monthlyAvailable && annualAvailable ? "available" : "backend_unavailable",
    unavailableReasons,
    lifetimeMembersRetainAccess: value.lifetimeMembersRetainAccess !== false,
  };
}

export function normaliseBillingInterval(value) {
  return value === "annual" ? "annual" : "monthly";
}

export function annualSavings(config) {
  const billing = normaliseBillingConfiguration(config);
  return Math.round((billing.monthly.amount * 12 - billing.annual.amount) * 100) / 100;
}

export function checkoutUnavailableMessage(config, state = "ready") {
  if (state === "loading") return "Checking secure checkout availability…";
  if (state === "error") return "The payment service could not be reached. You can still compare plans; please retry shortly.";
  const billing = normaliseBillingConfiguration(config);
  const reasons = new Set(billing.unavailableReasons.length ? billing.unavailableReasons : [billing.checkoutStatus]);
  if (reasons.has("subscriptions_disabled")) return "New subscriptions are not open yet. Existing paid and lifetime access is unaffected.";
  if (reasons.has("monthly_price_missing") && reasons.has("annual_price_missing")) return "Monthly and annual checkout are not configured yet. Existing paid and lifetime access is unaffected.";
  if (reasons.has("monthly_price_missing")) return "Monthly checkout is not configured yet, so subscriptions remain safely paused.";
  if (reasons.has("annual_price_missing")) return "Annual checkout is not configured yet, so subscriptions remain safely paused.";
  if (reasons.has("stripe_secret_missing")) return "Secure Stripe checkout is not configured yet. No payment can be started.";
  if (reasons.has("webhook_secret_missing")) return "Payment confirmation is not configured yet. No payment can be started.";
  if (reasons.has("billing_schema_not_ready")) return "Subscriptions are paused while secure account storage is completed. Existing paid and lifetime access is unaffected.";
  return "Secure checkout is currently unavailable. You can still compare monthly and annual billing.";
}

export function formatGbp(amount) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(Number(amount) || 0);
}

export function annualEffectiveMonthly(config) {
  const billing = normaliseBillingConfiguration(config);
  return Math.round((billing.annual.amount / 12) * 100) / 100;
}

export function canUsePremiumPreview({ isDevelopment = false, requested = false } = {}) { return Boolean(isDevelopment && requested); }
export function canStartCheckout(user) { return Boolean(user?.id); }
export function premiumFeatureStructure() {
  return {
    free: ["Useful first report", "Basic score and style", "One Keep recommendation", "One Repair recommendation", "Limited refreshes", "Weekly-plan preview"],
    premium: ["Living repertoire", "Weekly training from your games", "Progress between reports", "Training outcomes", "Saved report history", "Full recommendation evidence"],
  };
}
export function checkoutReturnState(value) { if (value === "cancelled") return { state: "cancelled", canRetry: true, repurchase: false }; if (value === "confirmed") return { state: "confirmed", canRetry: false, repurchase: false }; if (value === "delayed") return { state: "delayed", canRetry: true, repurchase: false }; return { state: "processing", canRetry: true, repurchase: false }; }
export async function confirmEntitlementWithRetry(restore, { attempts = 3, delay = async () => {} } = {}) { for (let attempt = 1; attempt <= attempts; attempt += 1) { try { if (await restore()) return { confirmed: true, attempts: attempt }; } catch { /* Retry delayed confirmation. */ } if (attempt < attempts) await delay(attempt * 750); } return { confirmed: false, attempts }; }
