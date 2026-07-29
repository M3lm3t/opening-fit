export const REPORT_VIEWS = Object.freeze([
  { key: "summary", label: "Summary", hash: "report-summary", headingId: "primary-report-title" },
  { key: "repertoire", label: "Repertoire", hash: "report-repertoire", headingId: "report-repertoire-view-title" },
  { key: "problems", label: "Problems", hash: "report-problems", headingId: "report-problems-view-title" },
  { key: "train", label: "Train", hash: "report-train", headingId: "report-train-view-title" },
  { key: "evidence", label: "Evidence", hash: "report-evidence", headingId: "report-evidence-view-title" },
]);

export function normaliseReportView(value) {
  const clean = String(value || "").replace(/^#/, "").trim().toLowerCase();
  return REPORT_VIEWS.find((view) => view.key === clean || view.hash === clean)?.key || "summary";
}

export function reportViewHash(view) {
  return `#${REPORT_VIEWS.find((item) => item.key === normaliseReportView(view))?.hash || REPORT_VIEWS[0].hash}`;
}

export function reportViewHeadingId(view) {
  return REPORT_VIEWS.find((item) => item.key === normaliseReportView(view))?.headingId || REPORT_VIEWS[0].headingId;
}

export function reportViewFromLocation(location = globalThis.location) {
  return normaliseReportView(location?.hash);
}
