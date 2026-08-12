const CORE_MOBILE_NAVIGATION = Object.freeze([
  Object.freeze({ key: "report", label: "Report", needsReport: true, activeViews: ["report", "recommendations", "openings", "weakspots", "verdicts"] }),
  Object.freeze({ key: "repertoire", label: "Repertoire", needsReport: true, activeViews: ["repertoire"] }),
  Object.freeze({ key: "train", label: "Train", activeViews: ["train", "training", "interactive", "practice"] }),
  Object.freeze({ key: "progress", label: "Progress", activeViews: ["progress"] }),
]);

/**
 * Mobile navigation consumes the already-resolved protected entitlement. It
 * deliberately does not infer access from Stripe labels, preview flags, URLs,
 * or browser state.
 */
export function buildMobileNavigationItems({ authenticated = false, entitlement = null, entitlementState = "loading", nativeApp = false } = {}) {
  const items = CORE_MOBILE_NAVIGATION.map((item) => ({ ...item }));
  if (nativeApp) {
    items.push({
      key: "account",
      label: "Account",
      activeViews: ["profile", "account", "login", "history"],
    });
    return items;
  }
  if (entitlementState !== "ready") return items;

  if (entitlement?.hasPremiumAccess) {
    items.push({
      key: "account",
      label: entitlement.accessType === "lifetime" ? "Access" : "Account",
      activeViews: ["profile", "account", "history"],
    });
    return items;
  }

  items.push({
    key: "premium",
    label: authenticated ? "Plus" : "Pricing",
    activeViews: ["premium", "upgrade"],
  });
  return items;
}

export function isMobileNavigationItemActive(item, activeView, activeSection) {
  return activeView === item.key ||
    item.activeViews?.includes(activeView) ||
    item.activeSections?.includes(activeSection) ||
    (!item.activeViews && !item.activeSections && activeSection === item.key);
}
