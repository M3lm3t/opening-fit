import { buildApiUrl } from "./apiBase.js";
import { PILOT_CLIENT, REPORT_CAPABILITIES } from "./reportRollout.js";

export const isPilotEntry = ({ enabled, native, pathname }) => enabled === true && !native && pathname === "/report-pilot";

async function pilotRequest(path, session, options = {}) {
  if (!session?.user?.id || !session.access_token) throw new Error("Sign in to your approved test account first.");
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, "X-OpeningFit-Report-Client": PILOT_CLIENT },
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error?.message || (typeof body.detail === "string" ? body.detail : "The report pilot is unavailable. Your existing reports are unchanged."));
  return body;
}

export async function loadPilotEligibility(session, signal) {
  const result = await pilotRequest("/api/report-pilot", session, { signal });
  if (result.userId !== session.user.id || result.scope !== "reports-only" || typeof result.allowed !== "boolean" || typeof result.creationEnabled !== "boolean") {
    throw new Error("The server did not confirm this account's report pilot access.");
  }
  return result;
}

export async function loadPilotHistory(session, signal) {
  const result = await pilotRequest("/api/v2/report-store/query", session, { method: "POST", signal,
    body: JSON.stringify({ capabilities: REPORT_CAPABILITIES, collection: "report_history", operation: "select",
      filters: [["user_id", "eq", session.user.id]], order: [["created_at", false]], limit: 100 }),
  });
  if (!Array.isArray(result.data) || result.data.some((row) => row.user_id !== session.user.id)) throw new Error("Saved report ownership could not be verified.");
  return result.data;
}

export function confirmedPilotReport(rows, result) {
  const row = result?.analysisId && rows.find((item) => item.analysis_id === result.analysisId || item.report?.analysisId === result.analysisId);
  if (!row || row.report?.reportGeneration !== "stage6_v1") throw new Error("Analysis finished, but its saved report could not be verified. Reload saved reports before retrying. No training completion was recorded.");
  return row;
}
