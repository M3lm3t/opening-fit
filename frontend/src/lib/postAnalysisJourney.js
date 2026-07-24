import { canUseFeature, getFeatureAccess } from "./premiumEntitlement.js";

export const REPORT_JOURNEY = Object.freeze({
  view: "report",
  path: "/report",
  reportMode: "summary",
  dialog: null,
  personalisationOpen: false,
});

export function completedAnalysisJourney() {
  return { ...REPORT_JOURNEY, source: "analysis_completed" };
}

export function restoredReportJourney() {
  return { ...REPORT_JOURNEY, source: "report_restored" };
}

export function viewFullReportJourney() {
  return {
    view: "report",
    path: "/report",
    reportMode: "full",
    target: "full-report-details",
    dialog: null,
    upgrade: false,
  };
}

export function premiumFeatureJourney({ feature, entitlement, intentional = false } = {}) {
  const definition = getFeatureAccess(feature);
  const genuinelyPremium = definition?.tier === "paid";
  const entitled = genuinelyPremium && canUseFeature(entitlement, feature);
  if (!intentional || !genuinelyPremium || entitled) {
    return { upgrade: false, feature, entitled };
  }
  return { upgrade: true, feature, entitled: false, view: "premium", path: "/premium" };
}
