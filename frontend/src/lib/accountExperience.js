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
