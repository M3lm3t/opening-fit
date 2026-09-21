// Isolated rendering of the real component, loaded only by the loopback test.
import { createRoot } from 'react-dom/client';
import PrimaryReportSummary from '/src/components/PrimaryReportSummary.jsx';
import { SAMPLE_REPORT } from '/src/fixtures/sampleReport.js';
import { buildReportDecisionModel } from '/src/lib/reportDecisionModel.js';
import { buildPrimaryReportSummary } from '/src/lib/primaryReportSummary.js';

let root;
export function renderPriorityCards(count) {
  if (!root) {
    const host = document.createElement('div');
    host.className = 'of-report-layout priorityLayoutFixture';
    host.style.cssText = 'width:calc(100% - 32px);max-width:1180px;margin:16px auto';
    document.querySelector('.appReportPage').append(host);
    root = createRoot(host);
  }
  const view = buildPrimaryReportSummary(buildReportDecisionModel(SAMPLE_REPORT), SAMPLE_REPORT);
  view.repair.available = true;
  view.keep.available = count >= 2;
  view.experiment = count === 3 ? { ...view.keep, hasPersonalEvidence: true } : null;
  root.render(<PrimaryReportSummary section="priorities" view={view} report={SAMPLE_REPORT} />);
}
