export const DEFAULT_BILLING_CONFIGURATION = Object.freeze({
  monthly: { available: false, amount: 4.99, currency: "GBP" },
  annual: { available: false, amount: 39.99, currency: "GBP" },
  foundingOffer: { enabled: false, firstYearAmount: null, renewsAtAmount: null },
  lifetimeMembersRetainAccess: true,
});

const finiteMoney = (value, fallback) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;

export function normaliseBillingConfiguration(value = {}) {
  return {
    monthly: { available: Boolean(value.monthly?.available), amount: finiteMoney(value.monthly?.amount, 4.99), currency: "GBP" },
    annual: { available: Boolean(value.annual?.available), amount: finiteMoney(value.annual?.amount, 39.99), currency: "GBP" },
    foundingOffer: {
      enabled: Boolean(value.foundingOffer?.enabled && value.annual?.available),
      firstYearAmount: finiteMoney(value.foundingOffer?.firstYearAmount, null),
      renewsAtAmount: finiteMoney(value.foundingOffer?.renewsAtAmount, 39.99),
    },
    lifetimeMembersRetainAccess: value.lifetimeMembersRetainAccess !== false,
  };
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
