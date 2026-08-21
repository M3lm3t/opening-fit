export const OPENINGFIT_PLUS_NAME = "OpeningFit Plus";
export const ACCOUNT_SAVE_EXPLANATION = "An account saves your reports, repertoire, training progress and preferences across devices.";
export const GOOGLE_AUTH_EXPLANATION = "Google sign-in uses OpeningFit's secure authentication provider and returns you here when complete.";

export function accountExperienceState({ authLoading = false, authHydrated = true, profileLoading = false, user = null } = {}) {
  if (authLoading || !authHydrated) return "checking_session";
  if (user?.id && profileLoading) return "restoring_account";
  return user?.id ? "authenticated" : "signed_out";
}

export function subscriptionPresentation(entitlement = {}) {
  const accessType = entitlement?.accessType || "free";
  if (accessType === "monthly_subscription") return {
    planName: OPENINGFIT_PLUS_NAME,
    accessLabel: "Monthly subscription",
    billingDescription: "Monthly billing renews each month until cancelled.",
    kind: "subscription",
  };
  if (accessType === "annual_subscription") return {
    planName: OPENINGFIT_PLUS_NAME,
    accessLabel: "Annual subscription",
    billingDescription: "Annual billing renews each year until cancelled.",
    kind: "subscription",
  };
  if (accessType === "lifetime") return {
    planName: "OpeningFit lifetime access",
    accessLabel: "Grandfathered lifetime access",
    billingDescription: "Grandfathered lifetime access has no recurring subscription.",
    kind: "lifetime",
  };
  return {
    planName: "OpeningFit Free",
    accessLabel: "Free account",
    billingDescription: "No recurring subscription.",
    kind: "free",
  };
}

export function membershipAccessState(entitlement, entitlementState = "ready") {
  if (entitlementState !== "ready" || !entitlement) return { resolved: false, kind: "unresolved", label: "Membership status unavailable", canUpgrade: false, canManage: false, benefits: ["Your existing access is not changed while status is being checked."] };
  const accessType = entitlement.accessType || "free";
  const active = entitlement.hasPremiumAccess === true;
  if (accessType === "lifetime") return { resolved: true, kind: "lifetime", label: active ? "Lifetime access active" : "Lifetime access needs attention", canUpgrade: false, canManage: false, benefits: ["No recurring subscription", "Saved reports and progress", "Included OpeningFit Plus features"] };
  if (["monthly_subscription", "annual_subscription"].includes(accessType)) return { resolved: true, kind: "subscription", label: active ? "OpeningFit Plus active" : "Subscription needs attention", canUpgrade: false, canManage: Boolean(entitlement.stripeCustomerId), benefits: ["Extended game history", "Saved weekly training", "Report comparisons and progress history"] };
  if (accessType === "free" && entitlement.hasPremiumAccess === false) return { resolved: true, kind: "free", label: "OpeningFit Free", canUpgrade: true, canManage: false, benefits: ["Opening report", "Repertoire coverage", "One evidence-backed next training action"] };
  return { resolved: false, kind: "unresolved", label: "Membership status unavailable", canUpgrade: false, canManage: false, benefits: ["Your existing access is not changed while status is being checked."] };
}
