const CORE_MOBILE_NAVIGATION = Object.freeze([
  Object.freeze({ key: "home", label: "Home", activeViews: ["home", "dashboard", "analyse", "import"] }),
  Object.freeze({ key: "report", label: "Report", needsReport: true, activeViews: ["report", "recommendations", "openings", "weakspots", "verdicts"] }),
  Object.freeze({ key: "train", label: "Train", activeViews: ["train", "training", "interactive", "practice"] }),
  Object.freeze({ key: "account", label: "Account", activeViews: ["profile", "account", "login", "history", "progress", "premium", "upgrade"] }),
]);

/**
 * Mobile navigation consumes the already-resolved protected entitlement. It
 * deliberately does not infer access from Stripe labels, preview flags, URLs,
 * or browser state.
 */
export function buildMobileNavigationItems({ authenticated = false, entitlement = null, entitlementState = "loading", nativeApp = false } = {}) {
  void authenticated; void entitlement; void entitlementState; void nativeApp;
  return CORE_MOBILE_NAVIGATION.map((item) => ({ ...item }));
}

export function isMobileNavigationItemActive(item, activeView, activeSection) {
  return activeView === item.key ||
    item.activeViews?.includes(activeView) ||
    item.activeSections?.includes(activeSection) ||
    (!item.activeViews && !item.activeSections && activeSection === item.key);
}
